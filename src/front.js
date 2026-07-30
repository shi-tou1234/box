import {
  storageRead,
  settingsRead,
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

function getLowStockCount() {
  const threshold = Number.isFinite(settingsRead().lowStockThreshold) ? settingsRead().lowStockThreshold : 5;
  return state.items.filter((item) => item.quantity > 0 && item.quantity <= threshold).length;
}

function getOutOfStockCount() {
  return state.items.filter((item) => item.quantity <= 0).length;
}

function renderStatCards() {
  const total = state.items.length;
  const totalStock = state.items.reduce((sum, item) => sum + coerceQuantity(item.quantity), 0);
  const lowStock = getLowStockCount();
  const outOfStock = getOutOfStockCount();

  const container = $('#statCards');
  if (!container) return;

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-card__body">
        <div class="stat-card__title">总元件数</div>
        <div class="stat-card__value">${total}</div>
        <div class="stat-card__hint">已录入元器件</div>
      </div>
      <div class="stat-card__icon stat-card--brand">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-card__body">
        <div class="stat-card__title">总库存</div>
        <div class="stat-card__value">${totalStock}</div>
        <div class="stat-card__hint">全部元件数量合计</div>
      </div>
      <div class="stat-card__icon stat-card--success">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-card__body">
        <div class="stat-card__title">低库存</div>
        <div class="stat-card__value">${lowStock}</div>
        <div class="stat-card__hint">低于阈值 ${Number.isFinite(settingsRead().lowStockThreshold) ? settingsRead().lowStockThreshold : 5}</div>
      </div>
      <div class="stat-card__icon stat-card--warning">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-card__body">
        <div class="stat-card__title">缺货</div>
        <div class="stat-card__value">${outOfStock}</div>
        <div class="stat-card__hint">库存为零的元件</div>
      </div>
      <div class="stat-card__icon stat-card--danger">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      </div>
    </div>
  `;
}

function renderCategoryChart() {
  const chartSection = $('#categoryChartSection');
  const chartEl = $('#categoryChart');
  if (!chartSection || !chartEl) return;

  const counts = {};
  state.items.forEach((item) => {
    const cat = item.category || '未分类';
    counts[cat] = (counts[cat] || 0) + 1;
  });

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    chartSection.style.display = 'none';
    return;
  }

  chartSection.style.display = '';
  const maxVal = entries[0][1];

  chartEl.innerHTML = entries
    .map(
      ([cat, count]) => {
        const pct = Math.round((count / maxVal) * 100);
        return `
          <div class="chart-bar">
            <div class="chart-bar__label" title="${escapeHtml(cat)}">${escapeHtml(cat)}</div>
            <div class="chart-bar__track">
              <div class="chart-bar__fill" style="width: ${pct}%;"></div>
            </div>
            <div class="chart-bar__value">${count}</div>
          </div>
        `;
      }
    )
    .join('');
}

function getStockStatus(item) {
  const q = coerceQuantity(item.quantity);
  if (q <= 0) return 'out-of-stock';
  const threshold = Number.isFinite(settingsRead().lowStockThreshold) ? settingsRead().lowStockThreshold : 5;
  if (q <= threshold) return 'low-stock';
  return 'in-stock';
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
      const statusClass = getStockStatus(item);
      const quantityBadgeClass = coerceQuantity(item.quantity) <= 0 ? 'badge--danger' : 'badge--accent';
      return `
        <button type="button" class="card-item ${activeClass}" data-id="${escapeHtml(item.id)}">
          <div class="status-dot status-dot--${statusClass}" title="${
            statusClass === 'in-stock' ? '有货' : statusClass === 'low-stock' ? '低库存' : '缺货'
          }"></div>
          <div class="card-item__content">
            <div class="card-item__name truncate">${escapeHtml(item.name || '未命名')}</div>
            <div class="card-meta truncate">${escapeHtml(
              [item.category, item.model, item.package].filter(Boolean).join(' / ') || '暂无完整信息'
            )}</div>
          </div>
          <div class="card-item__actions">
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
    const breadcrumb = $('#detailBreadcrumb');
    if (breadcrumb) breadcrumb.innerHTML = '';
    titleEl.textContent = '详情';
    detailEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">未选择条目</div>
        <div class="empty-state__desc">从左侧列表选择一个元器件，即可查看详情。</div>
      </div>
    `;
    return;
  }

  const breadcrumb = $('#detailBreadcrumb');
  if (breadcrumb) {
    breadcrumb.innerHTML = `
      <span>元器件</span>
      <span class="breadcrumb__sep">/</span>
      <span class="breadcrumb__current">${escapeHtml(item.name || '未命名')}</span>
    `;
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
  renderStatCards();
  renderCategoryChart();
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
    renderStatCards();
    renderCategoryChart();
  });
}

document.addEventListener('DOMContentLoaded', init);
