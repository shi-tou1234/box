import {
  state,
  $,
  showToast,
  refreshFilters,
} from './admin-state.js';
import {
  settingsRead,
  settingsWrite,
  storageWrite,
  summarizeChanges,
  nowIso,
  escapeHtml,
  STORAGE_WRITE_ERROR_MESSAGE,
} from '../src/shared.js';

import {
  renderAdminList,
  renderDetail,
  renderInventory,
  renderSyncStatus,
} from './admin-render.js';

export function normalizeGistUrl(url) {
  if (!url) return '';
  const raw = String(url).trim();
  try {
    const parsed = new URL(raw);
    if (parsed.hostname !== 'gist.github.com') return '';
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length < 2) return '';
    return `https://gist.github.com/${segments[0]}/${segments[1]}`;
  } catch {
    return '';
  }
}

const GITHUB_TIMEOUT_MS = 20000;

// 带超时的 fetch：网络挂起时不再让同步按钮永久停留在禁用态
function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function fetchOrThrow(url, options = {}) {
  try {
    return await fetchWithTimeout(url, options);
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error(`请求超时（${Math.round(GITHUB_TIMEOUT_MS / 1000)} 秒），请检查网络连接`);
    }
    throw new Error('网络请求失败，请检查网络连接');
  }
}

export async function githubRequest(path, options = {}) {
  const currentSettings = settingsRead();
  const token = (options.token || currentSettings.token || '').trim();
  if (!token) {
    throw new Error('请先在设置中填写 GitHub Token');
  }
  const response = await fetchOrThrow(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const message = await readGitHubError(response);
    throw new Error(message || `GitHub 请求失败：${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

export async function readGitHubError(response) {
  try {
    const data = await response.json();
    return data.message || response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function findGistFile(gist, filename = 'components.json') {
  if (!gist || !gist.files) return null;
  const file = gist.files[filename];
  return file || null;
}

// 解析 Gist 中的元器件 JSON，内容非法时给出可读的中文报错
function parseGistComponents(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Gist 文件内容不是有效的 JSON');
  }
  if (!Array.isArray(data)) {
    throw new Error('Gist 数据格式不正确，需要是 JSON 数组');
  }
  return data.map((item) => ({
    ...item,
    quantity: Number.isFinite(item.quantity) ? Math.max(0, Math.trunc(item.quantity)) : 0,
  }));
}

export async function readGistContent(gist, filename = 'components.json') {
  const file = await findGistFile(gist, filename);
  if (!file || typeof file.content === 'undefined') {
    return [];
  }
  if (file.truncated && file.raw_url) {
    const response = await fetchOrThrow(file.raw_url);
    if (!response.ok) {
      throw new Error('读取 Gist 文件内容失败');
    }
    return parseGistComponents(await response.text());
  }
  return parseGistComponents(file.content);
}

export async function syncFromGist() {
  if (state.syncLoading) return;
  state.syncLoading = true;
  setSyncLoading(true);

  try {
    const currentSettings = settingsRead();
    const gistUrl = normalizeGistUrl(currentSettings.gistUrl || '');

    if (!gistUrl) {
      showToast('请先在设置中配置 Gist 地址', { duration: 2400 });
      return;
    }

    showToast('正在从 Gist 恢复数据...');
    const gist = await githubRequest(`/gists/${gistUrl.split('/').pop()}`);
    const remoteItems = await readGistContent(gist);
    const summary = summarizeChanges(state.items, remoteItems);

    if (!confirm(`将从 Gist 恢复 ${summary.totalTarget} 条记录，其中新增 ${summary.added} 条、删除 ${summary.removed} 条，是否继续？`)) {
      showToast('已取消恢复');
      return;
    }

    if (!storageWrite(remoteItems)) {
      showToast('恢复失败：' + STORAGE_WRITE_ERROR_MESSAGE, { isError: true });
      return;
    }
    state.items = remoteItems;
    settingsWrite({ ...currentSettings, gistUrl, lastSyncAt: nowIso() });
    refreshFilters();
    renderAdminList();
    renderDetail();
    renderInventory();
    renderSyncStatus();
    showToast('已从 Gist 恢复');
  } catch (error) {
    console.error(error);
    showToast(error.message || '同步失败');
  } finally {
    state.syncLoading = false;
    setSyncLoading(false);
  }
}

export async function syncToGist() {
  if (state.syncLoading) return;
  state.syncLoading = true;
  setSyncLoading(true);

  try {
    const currentSettings = settingsRead();
    if (!currentSettings.token) {
      showToast('请先在设置中填写 GitHub Token', { duration: 2400 });
      return;
    }

    showToast('正在上传到 Gist...');
    const filename = 'components.json';
    const content = JSON.stringify(state.items, null, 2);
    let gistId = currentSettings.gistUrl ? currentSettings.gistUrl.split('/').pop() : '';
    let gist;

    if (gistId) {
      try {
        gist = await githubRequest(`/gists/${gistId}`);
      } catch (error) {
        console.warn('读取已有 Gist 失败，将创建新的', error);
        gistId = '';
      }
    }

    if (!gistId || !gist) {
      gist = await githubRequest('/gists', {
        method: 'POST',
        body: JSON.stringify({ public: false, files: { [filename]: { content } } }),
      });
    } else {
      gist = await githubRequest(`/gists/${gistId}`, {
        method: 'PATCH',
        body: JSON.stringify({ files: { [filename]: { content } } }),
      });
    }

    const normalized = normalizeGistUrl(gist.html_url || currentSettings.gistUrl || '');
    settingsWrite({ ...currentSettings, gistUrl: normalized, lastSyncAt: nowIso() });
    renderSyncStatus();
    showToast(`已同步到 Gist${normalized ? '：' + normalized : ''}`);
  } catch (error) {
    console.error(error);
    showToast(error.message || '同步失败');
  } finally {
    state.syncLoading = false;
    setSyncLoading(false);
  }
}

export function setSyncLoading(loading) {
  const syncBtn = $('#adminSyncToBtn');
  const restoreBtn = $('#adminSyncFromBtn');
  if (syncBtn) {
    syncBtn.disabled = loading;
    syncBtn.textContent = loading ? '同步中...' : '上传到 Gist';
  }
  if (restoreBtn) {
    restoreBtn.disabled = loading;
    restoreBtn.textContent = loading ? '恢复中...' : '从 Gist 恢复';
  }
}
