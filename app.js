const STORAGE_KEY = 'solder_pm.components.v1';
const SETTINGS_KEY = 'solder_pm.settings.v1';
const AUTH_KEY = 'solder_pm.auth.v1';

const emptyState = {
  id: null,
  name: '',
  category: '',
  model: '',
  package: '',
  quantity: 0,
  location: '',
  datasheet: '',
  notes: '',
  createdAt: null,
  updatedAt: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const state = {
  items: [],
  selectedId: null,
  filterText: '',
  filterCategory: '',
  filterPackage: '',
  filterStock: 'all',
  sortKey: 'updatedAt',
  sortDirection: 'desc',
  adminSelectedId: null,
  syncLoading: false,
  currentView: 'query',
};

const storage = {
  read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.map((item) => ({
        ...emptyState,
        ...item,
        quantity: coerceQuantity(item.quantity),
      }));
    } catch (error) {
      console.error('读取本地数据失败', error);
      return [];
    }
  },
  write(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  },
};

const settings = {
  read() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { token: '', gistUrl: '', lowStockThreshold: 5 };
      const data = JSON.parse(raw);
      return {
        token: String(data.token || ''),
        gistUrl: String(data.gistUrl || ''),
        lowStockThreshold: Number(data.lowStockThreshold),
      };
    } catch (error) {
      console.error('读取设置失败', error);
      return { token: '', gistUrl: '', lowStockThreshold: 5 };
    }
  },
  write(value) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
  },
};

const auth = {
  readPassword() {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (!raw) return '';
      const data = JSON.parse(raw);
      return String(data.password || '');
    } catch (error) {
      console.error('读取认证信息失败', error);
      return '';
    }
  },
  writePassword(password) {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ password }));
  },
  clear() {
    localStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem('solder_pm.admin_ok');
  },
  isLoggedIn() {
    return sessionStorage.getItem('solder_pm.admin_ok') === '1';
  },
  login(password) {
    const stored = this.readPassword();
    if (!stored) {
      this.writePassword(password);
      sessionStorage.setItem('solder_pm.admin_ok', '1');
      return true;
    }
    if (stored === password) {
      sessionStorage.setItem('solder_pm.admin_ok', '1');
      return true;
    }
    return false;
  },
  logout() {
    this.clear();
  },
};

function coerceQuantity(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showToast(message, options = {}) {
  const container = $('#toast');
  const item = document.createElement('div');
  item.className = 'toast__item';
  item.textContent = message;
  if (options.duration) {
    setTimeout(() => {
      item.remove();
    }, options.duration);
  }
  container.appendChild(item);
}

function summarizeChanges(base, target) {
  const added = target.filter((item) => !base.some((existing) => existing.id === item.id));
  const removed = base.filter((item) => !target.some((existing) => existing.id === item.id));
  const maybeUpdated = target.filter((item) => {
    const current = base.find((existing) => existing.id === item.id);
    return current ? current.updatedAt !== item.updatedAt : false;
  });
  return {
    totalBase: base.length,
    totalTarget: target.length,
    added: added.length,
    removed: removed.length,
    maybeUpdated: maybeUpdated.length,
  };
}

function getSortedItems(items = state.items) {
  const sorted = items.slice();
  sorted.sort((a, b) => {
    const quantityA = coerceQuantity(a.quantity);
    const quantityB = coerceQuantity(b.quantity);
    if (state.sortKey === 'name') {
      return state.sortDirection === 'asc' ? a.name.localeCompare(b.name, 'zh') : b.name.localeCompare(a.name, 'zh');
    }
    if (state.sortKey === 'quantity') {
      return state.sortDirection === 'asc' ? quantityA - quantityB : quantityB - quantityA;
    }
    const timeA = a.updatedAt || a.createdAt || '';
    const timeB = b.updatedAt || b.createdAt || '';
    return state.sortDirection === 'asc' ? timeA.localeCompare(timeB) : timeB.localeCompare(timeA);
  });
  return sorted;
}

function getFilteredItems() {
  const text = state.filterText.trim().toLowerCase();
  const category = state.filterCategory.trim();
  const pkg = state.filterPackage.trim();
  const stockMode = state.filterStock;

  return getSortedItems(state.items).filter((item) => {
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
  const categories = getUniqueValues('category');
  const packages = getUniqueValues('package');

  const categorySelect = $('#filterCategory');
  const packageSelect = $('#filterPackage');

  categorySelect.innerHTML = '<option value=\"\">全部</option>' + categories.map((category) => `<option value=\"${escapeHtml(category)}\">${escapeHtml(category)}</option>`).join('');
  packageSelect.innerHTML = '<option value=\"\">全部</option>' + packages.map((pkg) => `<option value=\"${escapeHtml(pkg)}\">${escapeHtml(pkg)}</option>`).join('');

  state.filterCategory = categorySelect.value;
  state.filterPackage = packageSelect.value;
}

function renderCategoryDatalist() {
  const datalist = $('#categoryOptions');
  if (!datalist) return;
  const options = Array.from(new Set(getCategoryOptions().concat(getUniqueValues('category')))).sort((a, b) => a.localeCompare(b, 'zh'));
  datalist.innerHTML = options.map((option) => `<option value=\"${escapeHtml(option)}\"></option>`).join('');
}

function renderPackageDatalist(category = '') {
  const datalist = $('#packageOptions');
  if (!datalist) return;
  const suggestions = getPackageSuggestions(category);
  const used = state.items.filter((item) => resolveCategoryKey(item.category) === resolveCategoryKey(category)).map((item) => (item.package || '').trim()).filter(Boolean);
  const options = Array.from(new Set(suggestions.concat(used))).sort((a, b) => a.localeCompare(b, 'zh'));
  datalist.innerHTML = options.map((option) => `<option value=\"${escapeHtml(option)}\"></option>`).join('');
}

function renderList() {
  const filtered = getFilteredItems();
  const listEl = $('#componentList');
  const emptyEl = $('#listEmpty');

  $('#listSummary').textContent = `共 ${filtered.length} 项 / 全部 ${state.items.length} 项`;

  if (!filtered.length) {
    listEl.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }

  emptyEl.hidden = true;
  listEl.innerHTML = filtered
    .map((item) => {
      const statusClass = item.quantity <= 0 ? 'is-out' : item.quantity <= 5 ? 'is-low' : '';
      const activeClass = item.id === state.selectedId ? 'is-active' : '';
      return `
        <div class="list__item ${activeClass} ${statusClass}" data-id="${escapeHtml(item.id)}">
          <div class="list__primary">
            <div class="list__name">${escapeHtml(item.name || '未命名')}</div>
            <div class="list__meta">${escapeHtml([item.category, item.model, item.package].filter(Boolean).join(' · ') || '未填写型号/封装')}</div>
          </div>
          <div class="list__badges">
            <span class="badge badge--accent">${escapeHtml(item.category || '未分类')}</span>
            <span class="badge ${item.quantity <= 0 ? 'badge--danger' : 'badge--muted'}">${coerceQuantity(item.quantity)}</span>
          </div>
        </div>
      `;
    })
    .join('');

  $$('.list__item').forEach((node) => {
    node.addEventListener('click', () => selectItem(node.dataset.id));
  });
}

function renderAdminList() {
  const listEl = $('#adminComponentList');
  const emptyEl = $('#adminListEmpty');
  const items = getSortedItems(state.items);

  if (!items.length) {
    listEl.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }

  emptyEl.hidden = true;
  listEl.innerHTML = items
    .map((item) => {
      const activeClass = item.id === state.adminSelectedId ? 'is-active' : '';
      return `
        <div class="list__item ${activeClass}" data-id="${escapeHtml(item.id)}">
          <div class="list__primary">
            <div class="list__name">${escapeHtml(item.name || '未命名')}</div>
            <div class="list__meta">${escapeHtml([item.category, item.model, item.package, item.location].filter(Boolean).join(' · ') || '未填写完整信息')}</div>
          </div>
          <div class="list__badges">
            <span class="badge badge--accent">${escapeHtml(item.category || '未分类')}</span>
            <span class="badge ${item.quantity <= 0 ? 'badge--danger' : 'badge--muted'}">${coerceQuantity(item.quantity)}</span>
          </div>
        </div>
      `;
    })
    .join('');

  $$('#adminComponentList .list__item').forEach((node) => {
    node.addEventListener('click', () => {
      state.adminSelectedId = node.dataset.id;
      renderAdminList();
      openForm(state.items.find((entry) => entry.id === node.dataset.id) || null);
    });
  });
}

function renderInventory() {
  const tbody = $('#inventoryBody');
  const emptyEl = $('#inventoryEmpty');
  const threshold = Number(settings.read().lowStockThreshold);
  const items = state.items.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh'));

  $('#inventoryCheckAll').checked = false;

  if (!items.length) {
    tbody.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
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
  const current = settings.read();
  const text = $('#syncStatusText');
  if (!text) return;
  text.textContent = current.gistUrl ? `已配置 Gist：${current.gistUrl}` : '未配置 Gist 地址。';
}

function showView(view) {
  state.currentView = view;
  const queryView = $('#queryView');
  const adminView = $('#adminView');
  const queryNewBtn = $('#queryNewBtn');
  const headerActions = $('#headerActions');
  if (view === 'admin') {
    queryView.hidden = true;
    adminView.hidden = false;
    queryNewBtn.hidden = true;
    headerActions.hidden = true;
    renderAdminList();
    updateSyncStatus();
  } else {
    queryView.hidden = false;
    adminView.hidden = true;
    queryNewBtn.hidden = !state.items.length;
    headerActions.hidden = false;
    renderList();
  }
}

function navigateToAdmin() {
  if (!auth.isLoggedIn()) {
    $('#adminLoginPassword').value = '';
    $('#adminLoginPanel').classList.remove('hidden');
    switchAdminTab('login');
    showToast('请先输入管理密码');
    return;
  }
  $('#adminLoginPanel').classList.add('hidden');
  switchAdminTab('components');
  showView('admin');
}

function navigateToQuery() {
  showView('query');
  window.location.hash = '#/';
}

function switchAdminTab(tabId) {
  const buttons = $$('#adminSidebar .admin-tab-btn');
  const panels = $$('.admin-panel');
  buttons.forEach((btn) => {
    const selected = btn.getAttribute('data-tab') === tabId;
    btn.setAttribute('aria-selected', selected ? 'true' : 'false');
  });
  panels.forEach((panel) => {
    const panelId = panel.getAttribute('data-panel');
    if (panelId === tabId) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  });
  if (tabId === 'inventory') {
    renderInventory();
  }
  if (tabId === 'sync') {
    updateSyncStatus();
  }
  if (tabId === 'settings') {
    const current = settings.read();
    $('#adminGithubToken').value = current.token;
    $('#adminGistUrl').value = current.gistUrl;
    $('#adminPassword').value = auth.readPassword();
    $('#lowStockThreshold').value = current.lowStockThreshold;
  }
}

function renderDetail() {
  const item = state.items.find((entry) => entry.id === state.selectedId) || null;
  const titleEl = $('#detailTitle');
  const actionsEl = $('#detailActions');
  const detailEl = $('#detail');

  if (!item) {
    titleEl.textContent = '选择一个元器件查看详情';
    actionsEl.hidden = true;
    detailEl.innerHTML = `
      <div class="empty">
        <div class="empty__title">未选择条目</div>
        <div class="empty__desc">点击列表中的元器件可查看详情。</div>
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
    : `<span class="text-muted">未填写</span>`;

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
  renderList();
  renderDetail();
}

function upsertItem(payload) {
  const existing = state.items.find((item) => item.id === payload.id) || null;
  const next = {
    ...emptyState,
    ...payload,
    id: payload.id || generateId(),
    quantity: coerceQuantity(payload.quantity),
    createdAt: existing ? existing.createdAt : nowIso(),
    updatedAt: nowIso(),
  };

  state.items = state.items.filter((item) => item.id !== next.id);
  state.items.push(next);
  storage.write(state.items);
  refreshFilters();
  renderList();
  renderCategoryDatalist();
  if (state.currentView === 'query') {
    selectItem(next.id);
  } else {
    renderAdminList();
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
  storage.write(state.items);
  refreshFilters();
  renderList();
  renderDetail();
  renderAdminList();
  showToast('已删除');
}

function duplicateItem(item) {
  if (!item) return;
  const clone = {
    ...item,
    id: undefined,
    name: `${item.name || '元器件'}（副本）`,
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
  storage.write(state.items);
  refreshFilters();
  renderList();
  renderDetail();
  renderAdminList();
  closeQuantityDialog();
  showToast('数量已更新');
}

function openSettings() {
  const current = settings.read();
  $('#githubToken').value = current.token;
  $('#gistUrl').value = current.gistUrl;
  $('#settingsDialog').showModal();
}

function closeSettings() {
  $('#settingsDialog').close();
}

function submitSettings(event) {
  event.preventDefault();
  const token = $('#githubToken').value.trim();
  const gistUrl = $('#gistUrl').value.trim();
  settings.write({ ...settings.read(), token, gistUrl });
  closeSettings();
  showToast('设置已保存');
}

function normalizeGistUrl(url) {
  if (!url) return '';
  const match = String(url).match(/gist\.github\.com\/([^/]+\/[^/?#]+)/);
  return match ? `https://gist.github.com/${match[1]}` : String(url).trim();
}

async function githubRequest(path, options = {}) {
  const currentSettings = settings.read();
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

function parseImportedText(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) {
    throw new Error('导入文件格式不正确，需要是数组');
  }
  return data.map((item) => ({
    ...emptyState,
    ...item,
    quantity: coerceQuantity(item.quantity),
  }));
}

async function syncFromGist() {
  if (state.syncLoading) return;
  state.syncLoading = true;
  setSyncLoading(true);

  try {
    const currentSettings = settings.read();
    const gistUrl = normalizeGistUrl(currentSettings.gistUrl || '');

    if (!gistUrl) {
      showToast('请先在设置中填写已有 Gist 地址', { duration: 2400 });
      return;
    }

    showToast('正在从 Gist 恢复数据...');
    const gist = await githubRequest(`/gists/${gistUrl.split('/').pop()}`);
    const remoteItems = await readGistContent(gist);
    const summary = summarizeChanges(state.items, remoteItems);

    if (!confirm(`将从 Gist 恢复 ${summary.totalTarget} 条记录，其中新增 ${summary.added} 条、移除 ${summary.removed} 条。是否继续？`)) {
      showToast('已取消恢复');
      return;
    }

    state.items = remoteItems;
    storage.write(state.items);
    refreshFilters();
    renderList();
    selectItem(state.selectedId);
    renderAdminList();
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
    const currentSettings = settings.read();
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
        console.warn('读取已有 Gist 失败，将尝试创建新的', error);
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
    settings.write({ ...currentSettings, gistUrl: normalized });
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
  const syncBtn = $('#syncBtn');
  syncBtn.disabled = loading;
  syncBtn.textContent = loading ? '同步中...' : '同步';
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
      if (!confirm(`将导入 ${summary.totalTarget} 条记录，其中新增 ${summary.added} 条、移除 ${summary.removed} 条。是否继续？`)) {
        showToast('已取消导入');
        return;
      }
      state.items = remoteItems;
      storage.write(state.items);
      refreshFilters();
      renderList();
      selectItem(state.selectedId);
      renderAdminList();
      showToast('导入成功');
    } catch (error) {
      console.error(error);
      showToast(error.message || '导入失败');
    }
  };
  reader.readAsText(file);
}

function init() {
  state.items = storage.read();
  refreshFilters();
  renderCategoryDatalist();
  renderList();
  renderDetail();
  updateSyncStatus();

  $('#newBtn').addEventListener('click', () => openForm());
  $('#queryNewBtn').addEventListener('click', () => openForm());
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#syncBtn').addEventListener('click', syncToGist);
  $('#exportBtn').addEventListener('click', exportJson);
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#openAdminBtn').addEventListener('click', navigateToAdmin);
  $('#adminOpenQueryBtn').addEventListener('click', (event) => {
    event.preventDefault();
    navigateToQuery();
  });
  $('#adminLogoutBtn').addEventListener('click', () => {
    auth.logout();
    navigateToQuery();
    showToast('已退出管理');
  });
  $('#importFile').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) importJson(file);
    event.target.value = '';
  });
  $('#adminImportBtn').addEventListener('click', () => $('#adminImportFile').click());
  $('#adminImportFile').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) importJson(file);
    event.target.value = '';
  });

  $('#search').addEventListener('input', (event) => {
    state.filterText = event.target.value;
    renderList();
  });
  $('#filterCategory').addEventListener('change', (event) => {
    state.filterCategory = event.target.value;
    renderList();
    renderPackageDatalist(state.filterCategory);
  });
  $('#filterPackage').addEventListener('change', (event) => {
    state.filterPackage = event.target.value;
    renderList();
  });
  $('#filterStock').addEventListener('change', (event) => {
    state.filterStock = event.target.value;
    renderList();
  });
  $('#filterCategory').addEventListener('input', () => {
    renderPackageDatalist($('#filterCategory').value);
  });

  $('#saveBtn').addEventListener('click', () => {
    const item = state.items.find((entry) => entry.id === state.selectedId);
    openForm(item || null);
  });
  $('#deleteBtn').addEventListener('click', () => {
    if (state.selectedId) deleteItem(state.selectedId);
  });

  $('#adminNewBtn').addEventListener('click', () => openForm());

  $('#formDialog').addEventListener('click', (event) => {
    if (event.target === $('#formDialog')) closeForm();
  });
  $('#closeFormBtn').addEventListener('click', closeForm);
  $('#cancelFormBtn').addEventListener('click', closeForm);
  $('#componentForm').addEventListener('submit', submitForm);

  $('#quantityDialog').addEventListener('click', (event) => {
    if (event.target === $('#quantityDialog')) closeQuantityDialog();
  });
  $('#closeQuantityBtn').addEventListener('click', closeQuantityDialog);
  $('#cancelQuantityBtn').addEventListener('click', closeQuantityDialog);
  $('#quantityForm').addEventListener('submit', submitQuantity);

  $('#settingsDialog').addEventListener('click', (event) => {
    if (event.target === $('#settingsDialog')) closeSettings();
  });
  $('#closeSettingsBtn').addEventListener('click', closeSettings);
  $('#cancelSettingsBtn').addEventListener('click', closeSettings);
  $('#settingsForm').addEventListener('submit', submitSettings);

  $('#adminLoginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const password = $('#adminLoginPassword').value || '';
    if (auth.login(password)) {
      $('#adminLoginPanel').classList.add('hidden');
      switchAdminTab('components');
      showView('admin');
      showToast('已进入管理模式');
    } else {
      showToast('密码错误', { duration: 2400 });
    }
  });

  $('#adminSidebar').addEventListener('click', (event) => {
    const button = event.target.closest('.admin-tab-btn');
    if (!button) return;
    const tabId = button.getAttribute('data-tab');
    if (tabId) switchAdminTab(tabId);
  });

  $('#adminSettingsForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const token = $('#adminGithubToken').value.trim();
    const gistUrl = $('#adminGistUrl').value.trim();
    const password = $('#adminPassword').value || '';
    const lowStockThreshold = Number($('#lowStockThreshold').value);
    const current = settings.read();
    settings.write({ ...current, token, gistUrl, lowStockThreshold: Number.isFinite(lowStockThreshold) ? Math.max(0, lowStockThreshold) : 5 });
    if (password) auth.writePassword(password);
    showToast('设置已保存');
    switchAdminTab('settings');
  });

  $('#adminSettingsResetBtn').addEventListener('click', () => {
    $('#adminGithubToken').value = '';
    $('#adminGistUrl').value = '';
    $('#adminPassword').value = '';
    $('#lowStockThreshold').value = '5';
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
    storage.write(state.items);
    refreshFilters();
    renderList();
    renderDetail();
    renderAdminList();
    renderInventory();
    showToast('已批量删除');
  });

  $('#batchClearBtn').addEventListener('click', () => {
    const ids = getSelectedInventoryIds();
    if (!ids.length) {
      showToast('请先选择要清零的条目', { duration: 2400 });
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
    storage.write(state.items);
    refreshFilters();
    renderList();
    renderDetail();
    renderAdminList();
    renderInventory();
    showToast('已批量清零');
  });

  $('#inventoryCheckAll').addEventListener('change', (event) => {
    const checked = event.target.checked;
    $$('.inventory-check').forEach((node) => (node.checked = checked));
  });

  $('#adminExportBtn').addEventListener('click', exportJson);
  $('#adminImportBtn').addEventListener('click', () => $('#adminImportFile').click());
  $('#adminSyncToBtn').addEventListener('click', syncToGist);
  $('#adminSyncFromBtn').addEventListener('click', syncFromGist);

  showView('query');

  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#/admin') {
      navigateToAdmin();
    } else {
      navigateToQuery();
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
