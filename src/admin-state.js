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

export {
  authReadPassword,
  authWritePassword,
  authIsLoggedIn,
  authLogin,
  authLogout,
  authClear,
} from '../src/shared.js';

export const state = {
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

export function formatLastSync(iso) {
  if (!iso) return '从未同步';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '从未同步';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '最后同步：刚刚';
  return `最后同步：${minutes} 分钟前`;
}

export function readSettingsLastSync() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return '';
    return JSON.parse(raw).lastSyncAt || '';
  } catch {
    return '';
  }
}

export function showToast(message, options = {}) {
  const container = $('#toast');
  if (!container) return;

  const isError = options.isError || /失败|错误|Failed/i.test(message);
  const duration = options.duration ?? (isError ? 6000 : 3000);

  const existing = Array.from(container.children);
  const MAX_TOASTS = 5;
  while (existing.length >= MAX_TOASTS) {
    existing.shift().remove();
  }

  const item = document.createElement('div');
  item.className = 'toast__item';
  if (isError) item.classList.add('toast__item--danger');
  item.textContent = message;
  container.appendChild(item);

  const dismiss = () => {
    item.classList.add('toast--leave');
    item.addEventListener('animationend', () => item.remove(), { once: true });
  };

  if (options.persistent !== true) {
    setTimeout(dismiss, duration);
  }

  item.addEventListener('click', () => {
    if (!item.classList.contains('toast--leave')) dismiss();
  });
}

export function getFilteredItems() {
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

export function getUniqueValues(key) {
  const values = state.items.map((item) => (item[key] || '').trim()).filter(Boolean);
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'zh'));
}

export function refreshFilters() {
  const searchInput = $('#adminSearch');
  const categorySelect = $('#filterCategory');
  const packageSelect = $('#filterPackage');
  const stockSelect = $('#filterStock');
  if (!categorySelect || !packageSelect) return;

  const categories = getUniqueValues('category');
  const packages = getUniqueValues('package');

  categorySelect.innerHTML = '<option value="">全部</option>' + categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  packageSelect.innerHTML = '<option value="">全部</option>' + packages.map((pkg) => `<option value="${escapeHtml(pkg)}">${escapeHtml(pkg)}</option>`).join('');

  state.filterCategory = categorySelect.value;
  state.filterPackage = packageSelect.value;
  state.filterStock = stockSelect ? stockSelect.value : 'all';
  state.filterText = searchInput ? searchInput.value : '';
}

export function renderCategoryDatalist() {
  const datalist = $('#categoryOptions');
  if (!datalist) return;
  const options = Array.from(new Set(getCategoryOptions().concat(getUniqueValues('category')))).sort((a, b) => a.localeCompare(b, 'zh'));
  datalist.innerHTML = options.map((option) => `<option value="${escapeHtml(option)}"></option>`).join('');
}

export function renderPackageDatalist(category = '') {
  const datalist = $('#packageOptions');
  if (!datalist) return;
  const suggestions = getPackageSuggestions(category);
  const options = Array.from(new Set(suggestions.concat(getUniqueValues('package')))).sort((a, b) => a.localeCompare(b, 'zh'));
  datalist.innerHTML = options.map((option) => `<option value="${escapeHtml(option)}"></option>`).join('');
}

export function getStockStatus(item) {
  const q = coerceQuantity(item.quantity);
  if (q <= 0) return 'out-of-stock';
  const threshold = settingsRead().lowStockThreshold || 5;
  if (q <= threshold) return 'low-stock';
  return 'in-stock';
}

export function getSelectedInventoryIds() {
  return Array.from($$('.inventory-check:checked')).map((node) => node.value);
}

export function applyAdminPanelVisibility() {
  $('#adminBody')?.classList.remove('hidden');
  $('#adminLogoutBtn')?.classList.remove('hidden');
  $('#adminLoginPanel')?.classList.add('hidden');
}

export function applyLoginVisibility() {
  $('#adminBody')?.classList.add('hidden');
  $('#adminLogoutBtn')?.classList.add('hidden');
  $('#adminLoginPanel')?.classList.remove('hidden');
}
