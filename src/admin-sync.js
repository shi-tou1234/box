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
} from '../src/shared.js';

import {
  renderAdminList,
  renderDetail,
  renderInventory,
  renderSyncStatus,
} from './admin-render.js';

export function normalizeGistUrl(url) {
  if (!url) return '';
  const match = String(url).match(/gist\.github\.com\/([^/]+\/[^/?#]+)/);
  return match ? `https://gist.github.com/${match[1]}` : String(url).trim();
}

export async function githubRequest(path, options = {}) {
  const currentSettings = settingsRead();
  const token = (options.token || currentSettings.token || '').trim();
  if (!token) {
    throw new Error('请先在设置中填写 GitHub Token');
  }
  const response = await fetch(`https://api.github.com${path}`, {
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

export async function readGistContent(gist, filename = 'components.json') {
  const file = await findGistFile(gist, filename);
  if (!file || typeof file.content === 'undefined') {
    return [];
  }
  if (file.truncated && file.raw_url) {
    const response = await fetch(file.raw_url);
    if (!response.ok) {
      throw new Error('读取 Gist 文件内容失败');
    }
    const text = await response.text();
    return JSON.parse(text).map((item) => ({
      ...item,
      quantity: Number.isFinite(item.quantity) ? Math.max(0, Math.trunc(item.quantity)) : 0,
    }));
  }
  return JSON.parse(file.content).map((item) => ({
    ...item,
    quantity: Number.isFinite(item.quantity) ? Math.max(0, Math.trunc(item.quantity)) : 0,
  }));
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

    state.items = remoteItems;
    storageWrite(state.items);
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
