import {
  storageRead,
  coerceQuantity,
  escapeHtml,
  getSortedItems,
} from './shared.js';

const state = {
  items: [],
  selectedId: null,
  filterText: '',
  filterCategory: '',
  filterPackage: '',
  filterStock: 'all',
  sortKey: 'updatedAt',
  sortDirection: 'desc',
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function showToast(message, options = {}) {
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
  const categories = getUniqueValues('category');
  const packages = getUniqueValues('package');

  const categorySelect = $('#filterCategory');
  const packageSelect = $('#filterPackage');

  categorySelect.innerHTML =
    '<option value="">全部</option>' +
    categories
      .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
      .join('');
  packageSelect.innerHTML =
    '<option value="">全部</option>' +
    packages
      .map((pkg) => `<option value="${escapeHtml(pkg)}">${escapeHtml(pkg)}</option>`)
      .join('');

  state.filterCategory = categorySelect.value;
  state.filterPackage = packageSelect.value;
}

function renderList() {
  const filtered = getFilteredItems();
  const listEl = $('#componentList');
  const emptyEl = $('#listEmpty');

  $('#listSummary').textContent = `共 ${filtered.length} 项 / 全部 ${state.items.length} 项`;

  if (!filtered.length) {
    listEl.innerHTML = '';
    listEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }

  listEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');
  listEl.innerHTML = filtered
    .map((item) => {
      const activeClass = item.id === state.selectedId ? 'is-active' : '';
      const quantityBadgeClass = item.quantity <= 0 ? 'badge--danger' : 'badge--accent';
      return `
        <button type="button" class="card-item ${activeClass}" data-id="${escapeHtml(item.id)}">
          <div style="min-width:0; flex:1; display:flex; flex-direction:column; gap:2px;">
            <div class="truncate" style="font-weight:600; font-size:var(--text-base); color:var(--text-primary);">${escapeHtml(item.name || '未命名')}</div>
            <div class="card-meta truncate">${escapeHtml(
              [item.category, item.model, item.package].filter(Boolean).join(' / ') || '暂无完整信息'
            )}</div>
          </div>
          <div style="display:flex; gap:var(--space-1); align-items:center; flex-shrink:0;">
            <span class="badge badge--accent">${escapeHtml(item.category || '未分类')}</span>
            <span class="badge ${quantityBadgeClass}">${coerceQuantity(item.quantity)}</span>
          </div>
        </button>
      `;
    })
    .join('');

  $$('.card-item').forEach((node) => {
    node.addEventListener('click', () => selectItem(node.dataset.id));
  });
}

function renderDetail() {
  const item = state.items.find((entry) => entry.id === state.selectedId) || null;
  const titleEl = $('#detailTitle');
  const detailEl = $('#detail');

  if (!item) {
    titleEl.textContent = '详情';
    detailEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">未选择条目</div>
        <div class="empty-state__desc">从左侧列表选择一个元器件，即可查看详情。</div>
      </div>
    `;
    return;
  }

  titleEl.textContent = item.name || '未命名元器件';

  const createdAtText = item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '-';
  const updatedAtText = item.updatedAt ? new Date(item.updatedAt).toLocaleString('zh-CN') : '-';
  const datasheetHtml = item.datasheet
    ? `<a class="link" href="${escapeHtml(item.datasheet)}" target="_blank" rel="noopener noreferrer">打开数据手册</a><div class="field__hint mt-2">${escapeHtml(item.datasheet)}</div>`
    : `<span class="text-muted">暂无</span>`;

  detailEl.innerHTML = `
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
  `;
}

function selectItem(id) {
  state.selectedId = id;
  renderList();
  renderDetail();
}

function updateThemeIcon(theme) {
  const sun = $('.theme-icon__sun');
  const moon = $('.theme-icon__moon');
  if (sun && moon) {
    sun.classList.toggle('hidden', theme === 'dark');
    moon.classList.toggle('hidden', theme !== 'dark');
  }
}

function toggleTheme(nextTheme) {
  const root = document.documentElement;
  const current = root.getAttribute('data-theme');
  const theme = typeof nextTheme === 'string' ? nextTheme : current === 'dark' ? 'light' : 'dark';
  if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark');
    root.classList.add('dark');
  } else {
    root.setAttribute('data-theme', 'light');
    root.classList.remove('dark');
  }
  updateThemeIcon(theme);
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // ignore storage errors in private modes.
  }
}

function initTheme() {
  const saved = (() => {
    try {
      return localStorage.getItem('theme');
    } catch {
      return '';
    }
  })();

  if (saved === 'dark' || saved === 'light') {
    toggleTheme(saved);
    return;
  }

  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    toggleTheme('dark');
  } else {
    updateThemeIcon('light');
  }
}

function initMobileNav() {
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
  $$('.mobile-nav__item').forEach((link) => {
    const href = link.getAttribute('href') || '/';
    const normalized = href.replace(/\/+$/, '') || '/';
    const isActive = normalized === currentPath || (normalized !== '/' && currentPath.startsWith(normalized));
    link.classList.toggle('is-active', isActive);
  });
}

function init() {
  state.items = storageRead();
  refreshFilters();
  renderList();
  renderDetail();
  initTheme();
  initMobileNav();

  window.showToast = showToast;

  $('#themeBtn').addEventListener('click', () => toggleTheme());

  $('#search').addEventListener('input', (event) => {
    state.filterText = event.target.value;
    renderList();
  });
  $('#filterCategory').addEventListener('change', (event) => {
    state.filterCategory = event.target.value;
    renderList();
  });
  $('#filterPackage').addEventListener('change', (event) => {
    state.filterPackage = event.target.value;
    renderList();
  });
  $('#filterStock').addEventListener('change', (event) => {
    state.filterStock = event.target.value;
    renderList();
  });
}

document.addEventListener('DOMContentLoaded', init);
