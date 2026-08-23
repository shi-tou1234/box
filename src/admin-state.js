import {
  SETTINGS_KEY,
  settingsRead,
  authReadPassword,
  authWritePassword,
  authClear,
  authIsLoggedIn,
  authLogin,
  authLogout,
  coerceQuantity,
  escapeHtml,
  getSortedItems,
  getCategoryOptions,
  getPackageSuggestions,
} from '../src/shared.js';
import { showToast } from '../src/shared.js';

export {
  authReadPassword,
  authWritePassword,
  authIsLoggedIn,
  authLogin,
  authLogout,
  authClear,
} from '../src/shared.js';

// 供 admin-render / admin-sync 复用（实现在 shared.js）
export { showToast };

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

export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => Array.from(document.querySelectorAll(selector));

export function formatLastSync(iso) {
  if (!iso) return '从未同步';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '从未同步';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '最后同步：刚刚';
  if (minutes < 60) return `最后同步：${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `最后同步：${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `最后同步：${days} 天前`;
  return `最后同步：${date.toLocaleDateString('zh-CN')}`;
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

  // 重建选项前记住当前选择，避免数据变更后筛选被静默重置为"全部"
  const prevCategory = categorySelect.value;
  const prevPackage = packageSelect.value;

  const categories = getUniqueValues('category');
  const packages = getUniqueValues('package');

  categorySelect.innerHTML = '<option value="">全部</option>' + categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  packageSelect.innerHTML = '<option value="">全部</option>' + packages.map((pkg) => `<option value="${escapeHtml(pkg)}">${escapeHtml(pkg)}</option>`).join('');

  categorySelect.value = categories.includes(prevCategory) ? prevCategory : '';
  packageSelect.value = packages.includes(prevPackage) ? prevPackage : '';
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
  // settingsRead 内部已对阈值做兜底（非法值回退为 5）
  if (q <= settingsRead().lowStockThreshold) return 'low-stock';
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
