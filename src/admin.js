import {
  STORAGE_KEY,
  SETTINGS_KEY,
  AUTH_KEY,
  storageRead,
  storageWrite,
  settingsRead,
  settingsWrite,
  authReadPassword,
  authWritePassword,
  authClear,
  authIsLoggedIn,
  authLogin,
  authLogout,
  coerceQuantity,
  generateId,
  nowIso,
  escapeHtml,
  summarizeChanges,
  getSortedItems,
  parseImportedText,
  getCategoryOptions,
  getPackageSuggestions,
  resolveCategoryKey,
} from '../src/shared.js';

const state = {
  items: [],
  selectedId: null,
  filterText: '',
  filterCategory: '',
  filterPackage: '',
  filterStock: 'all',
  sortKey: 'updatedAt',
  sortDirection: 'desc',
  syncLoading: false,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function showToast(message, options = {}) {
  const container = $('#toast');
  const item = document.createElement('div');
  item.className = 'toast__item';
  item.textContent = message;
  if (options.duration) {
    setTimeout(() => item.remove(), options.duration);
  }
  container.appendChild(item);
}

function getFilteredItems() {
  const text = state.filterText.trim().toLowerCase();
  const category = state.filterCategory.trim();
  const pkg = state.filterPackage.trim();
  const stockMode = state.filterStock;

  return getSortedItems(state.items, state.sortKey, state.sortDirection).filter((item) => {
    const matchText =
      !text ||
      (item.name || '').toLowerCase().includes(text) ||
      (item.model || '').toLowerCase().includes(text);
    const matchCategory = !category || item.category === category;
    const matchPackage = !pkg || item.package === pkg;
    const matchStock =
      stockMode === 'all' ||
      (stockMode === 'in' && item.quantity > 0) ||
      (stockMode === 'out' && item.quantity <= 0);
    return matchText && matchCategory && matchPackage && matchStock;
  });
}

function getUniqueValues(key) {
  const values = state.items.map((item) => (item[key] || '').trim()).filter(Boolean);
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'zh'));
}

function refreshFilters() {
  const categorySelect = $('#filterCategory');
  const packageSelect = $('#filterPackage');
  if (!categorySelect || !packageSelect) return;

  const categories = getUniqueValues('category');
  const packages = getUniqueValues('package');

  categorySelect.innerHTML = '<option value="">全部</option>' + categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  packageSelect.innerHTML = '<option value="">全部</option>' + packages.map((pkg) => `<option value="${escapeHtml(pkg)}">${escapeHtml(pkg)}</option>`).join('');

  state.filterCategory = categorySelect.value;
  state.filterPackage = packageSelect.value;
}

function renderCategoryDatalist() {
  const datalist = $('#categoryOptions');
  if (!datalist) return;
  const options = Array.from(new Set(getCategoryOptions().concat(getUniqueValues('category')))).sort((a, b) => a.localeCompare(b, 'zh'));
  datalist.innerHTML = options.map((option) => `<option value="${escapeHtml(option)}"></option>`).join('');
}

function renderPackageDatalist(category = '') {
  const datalist = $('#packageOptions');
  if (!datalist) return;
  const suggestions = getPackageSuggestions(category);
  const options = Array.from(new Set(suggestions.concat(getUniqueValues('package')))).sort((a, b) => a.localeCompare(b, 'zh'));
  datalist.innerHTML = options.map((option) => `<option value="${escapeHtml(option)}"></option>`).join('');
}

function renderAdminList() {
  const listEl = $('#adminComponentList');
  const emptyEl = $('#adminListEmpty');
  const items = getFilteredItems();

  $('#adminListSummary').textContent = `共 ${items.length} 项 / 全部 ${state.items.length} 项`;

  if (!items.length) {
    listEl.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }

  emptyEl.hidden = true;
  listEl.innerHTML = items
    .map((item) => {
      const activeClass = item.id === state.selectedId ? 'is-active' : '';
      return `
        <button type="button" class="list__item ${activeClass}" data-id="${escapeHtml(item.id)}">
          <span class="list__primary">
            <span class="list__name">${escapeHtml(item.name || '未命名')}</span>
            <span class="list__meta">${escapeHtml([item.category, item.model, item.package].filter(Boolean).join(' / ') || '暂无完整信息')}</span>
          </span>
          <span class="list__badges">
            <span class="badge badge--accent">${escapeHtml(item.category || '未分类')}</span>
            <span class="badge ${item.quantity <= 0 ? 'badge--danger' : 'badge--muted'}">${coerceQuantity(item.quantity)}</span>
          </span>
        </button>
      `;
    })
    .join('');

  $$('.list__item').forEach((node) => {
    node.addEventListener('click', () => selectItem(node.dataset.id));
  });
}

function renderInventory() {
  const tbody = $('#inventoryBody');
  const emptyEl = $('#inventoryEmpty');
  if (!tbody) return;
  const threshold = Number($('#lowStockThreshold')?.value ?? settingsRead().lowStockThreshold);
  const items = getSortedItems(state.items, 'name', 'asc');

  if (!items.length) {
    tbody.innerHTML = '';
    emptyEl?.classList.remove('hidden');
    return;
  }

  emptyEl?.classList.add('hidden');
  tbody.innerHTML = items
    .map((item) => {
      const quantity = coerceQuantity(item.quantity);
      const isLow = quantity <= threshold;
      const statusText = quantity <= 0 ? '缺货' : isLow ? '低库存' : '正常';
      const statusClass = quantity <= 0 ? 'text-danger' : isLow ? 'text-danger' : 'text-muted';
      return `
        <tr>
          <td><input type="checkbox" class="inventory-check" value="${escapeHtml(item.id)}" /></td>
          <td>${escapeHtml(item.name || '-')}</td>
          <td>${escapeHtml(item.category || '-')}</td>
          <td>${escapeHtml(item.model || '-')}</td>
          <td>${escapeHtml(item.package || '-')}</td>
          <td>${quantity}</td>
          <td>${escapeHtml(item.location || '-')}</td>
          <td class="${statusClass}">${statusText}</td>
        </tr>
      `;
    })
    .join('');
}

function getSelectedInventoryIds() {
  return Array.from($$('.inventory-check:checked')).map((node) => node.value);
}

function updateSyncStatus() {
  const current = settingsRead();
  const text = $('#syncStatusText');
  if (!text) return;
  text.textContent = current.gistUrl ? `已配置 Gist：${current.gistUrl}` : '未配置 Gist 地址';
}

function showAdminPanel(panelId) {
  const buttons = $$('#adminSidebar .admin-tab-btn');
  const panels = $$('.admin-panel');
  buttons.forEach((btn) => {
    const selected = btn.getAttribute('data-tab') === panelId;
    btn.setAttribute('aria-selected', selected ? 'true' : 'false');
  });
  panels.forEach((panel) => {
    const panelIdAttr = panel.getAttribute('data-panel');
    if (panelIdAttr === panelId) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  });
  if (panelId === 'inventory') {
    renderInventory();
  }
  if (panelId === 'sync') {
    updateSyncStatus();
  }
  if (panelId === 'settings') {
    const current = settingsRead();
    $('#adminGithubToken').value = current.token;
    $('#adminGistUrl').value = current.gistUrl;
    $('#adminPassword').value = authReadPassword();
    $('#lowStockThreshold').value = current.lowStockThreshold;
  }
}

function renderDetail() {
  const detailEl = $('#detail');
  if (!detailEl) return;
  const item = state.items.find((entry) => entry.id === state.selectedId) || null;
  const titleEl = $('#detailTitle');
  const actionsEl = $('#detailActions');

  if (!item) {
    titleEl.textContent = '选择一个元器件查看详情';
    actionsEl.hidden = true;
    detailEl.innerHTML = `
      <div class="empty">
        <div class="empty__title">未选择条目</div>
        <div class="empty__desc">从列表选择一个元器件，即可查看详情与快速操作。</div>
      </div>
    `;
    return;
  }

  titleEl.textContent = item.name || '未命名元器件';
  actionsEl.hidden = false;

  const createdAtText = item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '-';
  const updatedAtText = item.updatedAt ? new Date(item.updatedAt).toLocaleString('zh-CN') : '-';
  const datasheetHtml = item.datasheet
    ? `<a class="link" href="${escapeHtml(item.datasheet)}" target="_blank" rel="noopener noreferrer">打开数据手册</a><div class="field__hint mt-2">${escapeHtml(item.datasheet)}</div>`
    : `<span class="text-muted">暂无</span>`;

  detailEl.innerHTML = `
    <div>
      <div class="detail__section">
        <div class="field">
          <div class="field__label">名称</div>
          <div class="mono">${escapeHtml(item.name || '-')}</div>
        </div>
        <div class="field">
          <div class="field__label">种类</div>
          <div class="mono">${escapeHtml(item.category || '-')}</div>
        </div>
        <div class="field">
          <div class="field__label">型号</div>
          <div class="mono">${escapeHtml(item.model || '-')}</div>
        </div>
        <div class="field">
          <div class="field__label">封装</div>
          <div class="mono">${escapeHtml(item.package || '-')}</div>
        </div>
        <div class="field">
          <div class="field__label">当前数量</div>
          <div>
            <span class="badge ${item.quantity <= 0 ? 'badge--danger' : 'badge--accent'}">${coerceQuantity(item.quantity)}</span>
          </div>
        </div>
        <div class="field">
          <div class="field__label">位置/库位</div>
          <div class="mono">${escapeHtml(item.location || '-')}</div>
        </div>
        <div class="field">
          <div class="field__label">数据手册</div>
          <div>${datasheetHtml}</div>
        </div>
        <div class="field field--full">
          <div class="field__label">备注</div>
          <div class="mono">${escapeHtml(item.notes || '-')}</div>
        </div>
        <div class="field field--full">
          <div class="field__label">创建时间</div>
          <div class="mono">${escapeHtml(createdAtText)}</div>
        </div>
        <div class="field field--full">
          <div class="field__label">更新时间</div>
          <div class="mono">${escapeHtml(updatedAtText)}</div>
        </div>
      </div>
      <div class="detail__actions">
        <button class="button button--ghost" id="editBtn">编辑</button>
        <button class="button button--ghost" id="copyBtn">复制</button>
        <button class="button button--ghost" id="quantityBtn">调整数量</button>
        <button class="button button--danger" id="detailDeleteBtn">删除</button>
      </div>
    </div>
  `;

  $('#editBtn')?.addEventListener('click', () => openForm(item));
  $('#copyBtn')?.addEventListener('click', () => duplicateItem(item));
  $('#quantityBtn')?.addEventListener('click', () => openQuantityDialog(item));
  $('#detailDeleteBtn')?.addEventListener('click', () => deleteItem(item.id));
}

function selectItem(id) {
  state.selectedId = id;
  renderAdminList();
  const item = state.items.find((entry) => entry.id === id) || null;
  if (item) openForm(item);
}

function upsertItem(payload) {
  const existing = state.items.find((item) => item.id === payload.id) || null;
  const next = {
    ...payload,
    id: payload.id || generateId(),
    quantity: coerceQuantity(payload.quantity),
    createdAt: existing ? existing.createdAt : nowIso(),
    updatedAt: nowIso(),
  };

  state.items = state.items.filter((item) => item.id !== next.id);
  state.items.push(next);
  storageWrite(state.items);
  refreshFilters();
  renderCategoryDatalist();
  renderPackageDatalist(next.category);
  renderAdminList();
  if (state.selectedId === next.id) {
    renderDetail();
  }
}

function deleteItem(id) {
  if (!confirm('确定要删除这条元器件记录吗？')) {
    return;
  }
  state.items = state.items.filter((item) => item.id !== id);
  if (state.selectedId === id) {
    state.selectedId = null;
  }
  storageWrite(state.items);
  refreshFilters();
  renderAdminList();
  renderDetail();
  showToast('已删除');
}

function duplicateItem(item) {
  if (!item) return;
  const clone = {
    ...item,
    id: undefined,
    name: `${item.name || '元器件'}（复制）`,
    quantity: 0,
    createdAt: undefined,
    updatedAt: undefined,
  };
  upsertItem(clone);
  showToast('已复制并新增副本');
}

function resetForm(item = null) {
  $('#formId').value = item ? item.id : '';
  $('#formName').value = item ? item.name || '' : '';
  $('#formCategory').value = item ? item.category || '' : '';
  $('#formModel').value = item ? item.model || '' : '';
  $('#formPackage').value = item ? item.package || '' : '';
  $('#formQuantity').value = item ? (item.quantity || 0) : 0;
  $('#formLocation').value = item ? item.location || '' : '';
  $('#formDatasheet').value = item ? item.datasheet || '' : '';
  $('#formNotes').value = item ? item.notes || '' : '';
}

function readForm() {
  return {
    id: $('#formId').value || undefined,
    name: $('#formName').value.trim(),
    category: $('#formCategory').value.trim(),
    model: $('#formModel').value.trim(),
    package: $('#formPackage').value.trim(),
    quantity: $('#formQuantity').value,
    location: $('#formLocation').value.trim(),
    datasheet: $('#formDatasheet').value.trim(),
    notes: $('#formNotes').value.trim(),
  };
}

function validateForm(payload) {
  if (!payload.name) {
    $('#formName').focus();
    throw new Error('请填写名称');
  }
  if (!payload.category) {
    $('#formCategory').focus();
    throw new Error('请填写种类');
  }
}

function openForm(item = null) {
  const dialog = $('#formDialog');
  $('#formDialogTitle').textContent = item ? '编辑元器件' : '新增元器件';
  resetForm(item);
  renderCategoryDatalist();
  renderPackageDatalist(item ? item.category : '');
  dialog.showModal();
}

function closeForm() {
  $('#formDialog').close();
}

function submitForm(event) {
  event.preventDefault();
  const payload = readForm();
  try {
    validateForm(payload);
  } catch (error) {
    showToast(error.message, { duration: 2400 });
    return;
  }
  upsertItem(payload);
  closeForm();
  showToast('已保存');
}

function openQuantityDialog(item) {
  if (!item) return;
  $('#quantityId').value = item.id;
  $('#quantityMode').value = 'increase';
  $('#quantityValue').value = '1';
  $('#quantityDialog').showModal();
}

function closeQuantityDialog() {
  $('#quantityDialog').close();
}

function submitQuantity(event) {
  event.preventDefault();
  const id = $('#quantityId').value;
  const item = state.items.find((entry) => entry.id === id);
  const mode = $('#quantityMode').value;
  const value = coerceQuantity($('#quantityValue').value);

  if (!id || !item) {
    showToast('请先选择一个元器件');
    return;
  }
  if (value <= 0 && mode !== 'set') {
    showToast('数量必须大于 0');
    return;
  }

  if (mode === 'increase') {
    item.quantity = item.quantity + value;
  } else if (mode === 'decrease') {
    item.quantity = Math.max(0, item.quantity - value);
  } else {
    item.quantity = value;
  }

  item.updatedAt = nowIso();
  storageWrite(state.items);
  refreshFilters();
  renderAdminList();
  renderDetail();
  renderInventory();
  closeQuantityDialog();
  showToast('数量已更新');
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state.items, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'solder-components.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('已导出 JSON');
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const remoteItems = parseImportedText(reader.result);
      const summary = summarizeChanges(state.items, remoteItems);
      if (!confirm(`将导入 ${summary.totalTarget} 条记录，其中新增 ${summary.added} 条、删除 ${summary.removed} 条，是否继续？`)) {
        showToast('已取消导入');
        return;
      }
      state.items = remoteItems;
      storageWrite(state.items);
      refreshFilters();
      renderAdminList();
      renderDetail();
      renderInventory();
      showToast('导入成功');
    } catch (error) {
      console.error(error);
      showToast(error.message || '导入失败');
    }
  };
  reader.readAsText(file);
}

function normalizeGistUrl(url) {
  if (!url) return '';
  const match = String(url).match(/gist\.github\.com\/([^/]+\/[^/?#]+)/);
  return match ? `https://gist.github.com/${match[1]}` : String(url).trim();
}

async function githubRequest(path, options = {}) {
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

async function readGitHubError(response) {
  try {
    const data = await response.json();
    return data.message || response.statusText;
  } catch {
    return response.statusText;
  }
}

async function findGistFile(gist, filename = 'components.json') {
  if (!gist || !gist.files) return null;
  const file = gist.files[filename];
  if (!file || !file.truncated) return file || null;
  return file;
}

async function readGistContent(gist, filename = 'components.json') {
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
    return parseImportedText(text);
  }
  return parseImportedText(file.content);
}

async function syncFromGist() {
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
    refreshFilters();
    renderAdminList();
    renderDetail();
    renderInventory();
    showToast('已从 Gist 恢复');
  } catch (error) {
    console.error(error);
    showToast(error.message || '同步失败');
  } finally {
    state.syncLoading = false;
    setSyncLoading(false);
  }
}

async function syncToGist() {
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
    settingsWrite({ ...currentSettings, gistUrl: normalized });
    showToast(`已同步到 Gist${normalized ? '：' + normalized : ''}`);
  } catch (error) {
    console.error(error);
    showToast(error.message || '同步失败');
  } finally {
    state.syncLoading = false;
    setSyncLoading(false);
  }
}

function setSyncLoading(loading) {
  const syncBtn = $('#adminSyncToBtn');
  syncBtn.disabled = loading;
  syncBtn.textContent = loading ? '同步中...' : '上传到 Gist';

  const restoreBtn = $('#adminSyncFromBtn');
  restoreBtn.disabled = loading;
  restoreBtn.textContent = loading ? '恢复中...' : '从 Gist 恢复';
}

function initAdminLayout() {
  const sidebar = $('#adminSidebar');
  const logoutBtn = $('#adminLogoutBtn');
  const isLoggedIn = authIsLoggedIn();

  function applyAdminPanelVisibility() {
    sidebar?.classList.remove('hidden');
    logoutBtn?.classList.remove('hidden');
    document.getElementById('adminLoginPanel')?.classList.add('hidden');
  }

  function applyLoginVisibility() {
    sidebar?.classList.add('hidden');
    logoutBtn?.classList.add('hidden');
    document.getElementById('adminLoginPanel')?.classList.remove('hidden');
  }

  if (isLoggedIn) {
    applyAdminPanelVisibility();
  } else {
    applyLoginVisibility();
    const hint = $('#adminLoginHint');
    if (hint) {
      hint.textContent = authReadPassword()
        ? '请输入管理密码。忘记密码可在浏览器 localStorage 中清除 solder_pm.auth 键。'
        : '首次进入时输入的密码将被设为管理密码，请妥善记忆。';
    }
  }

  const tabBtns = sidebar?.querySelectorAll('.admin-tab-btn');
  tabBtns?.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      if (!tabId) return;
      applyAdminPanelVisibility();
      showAdminPanel(tabId);
    });
  });

  logoutBtn?.addEventListener('click', () => {
    authLogout();
    applyLoginVisibility();
    showToast('已退出管理后台');
  });
}

function init() {
  state.items = storageRead();
  refreshFilters();
  renderCategoryDatalist();
  renderAdminList();
  renderDetail();
  updateSyncStatus();

  $('#adminNewBtn').addEventListener('click', () => openForm());
  $('#closeFormBtn').addEventListener('click', closeForm);
  $('#cancelFormBtn').addEventListener('click', closeForm);
  $('#componentForm').addEventListener('submit', submitForm);

  $('#formDialog').addEventListener('click', (event) => {
    if (event.target === $('#formDialog')) closeForm();
  });

  $('#quantityDialog').addEventListener('click', (event) => {
    if (event.target === $('#quantityDialog')) closeQuantityDialog();
  });
  $('#closeQuantityBtn').addEventListener('click', closeQuantityDialog);
  $('#cancelQuantityBtn').addEventListener('click', closeQuantityDialog);
  $('#quantityForm').addEventListener('submit', submitQuantity);

  $('#adminLoginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const password = $('#adminLoginPassword').value || '';
    if (authLogin(password)) {
      $('#adminLoginPanel').classList.add('hidden');
      showAdminPanel('components');
      showToast('已进入管理后台');
    } else {
      showToast('密码错误', { duration: 2400 });
    }
  });

  $('#adminSettingsForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const token = $('#adminGithubToken').value.trim();
    const gistUrl = $('#adminGistUrl').value.trim();
    const password = $('#adminPassword').value || '';
    const lowStockThreshold = Number($('#lowStockThreshold').value);
    const current = settingsRead();
    settingsWrite({ ...current, token, gistUrl, lowStockThreshold: Number.isFinite(lowStockThreshold) ? Math.max(0, lowStockThreshold) : 5 });
    if (password) authWritePassword(password);
    showToast('设置已保存');
    showAdminPanel('settings');
  });

  $('#adminSettingsResetBtn').addEventListener('click', () => {
    $('#adminGithubToken').value = '';
    $('#adminGistUrl').value = '';
    $('#adminPassword').value = '';
    $('#lowStockThreshold').value = '5';
  });

  $('#inventoryCheckAll').addEventListener('change', (event) => {
    const checked = event.target.checked;
    $$('.inventory-check').forEach((node) => (node.checked = checked));
  });

  $('#batchDeleteBtn').addEventListener('click', () => {
    const ids = getSelectedInventoryIds();
    if (!ids.length) {
      showToast('请先选择要删除的条目', { duration: 2400 });
      return;
    }
    if (!confirm(`将删除 ${ids.length} 条库存记录，是否继续？`)) {
      return;
    }
    state.items = state.items.filter((item) => !ids.includes(item.id));
    storageWrite(state.items);
    refreshFilters();
    renderAdminList();
    renderDetail();
    renderInventory();
    showToast('已批量删除');
  });

  $('#batchClearBtn').addEventListener('click', () => {
    const ids = getSelectedInventoryIds();
    if (!ids.length) {
      showToast('请先选择要清空的条目', { duration: 2400 });
      return;
    }
    if (!confirm(`将清零 ${ids.length} 条库存记录的数量，是否继续？`)) {
      return;
    }
    state.items.forEach((item) => {
      if (ids.includes(item.id)) {
        item.quantity = 0;
        item.updatedAt = nowIso();
      }
    });
    storageWrite(state.items);
    refreshFilters();
    renderAdminList();
    renderDetail();
    renderInventory();
    showToast('已批量清空');
  });

  $('#adminExportBtn').addEventListener('click', exportJson);
  $('#adminImportBtn').addEventListener('click', () => $('#adminImportFile').click());
  $('#adminImportFile').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) importJson(file);
    event.target.value = '';
  });
  $('#adminSyncToBtn').addEventListener('click', syncToGist);
  $('#adminSyncFromBtn').addEventListener('click', syncFromGist);

  initAdminLayout();
  if (authIsLoggedIn()) {
    showAdminPanel('components');
  }
}

document.addEventListener('DOMContentLoaded', init);
