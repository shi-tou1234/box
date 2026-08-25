import {
  storageRead,
  escapeHtml,
  safeUrl,
  resolveCategoryKey,
  showToast,
  STORAGE_KEY,
} from './shared.js';

/* ==========================================================================
   SOLDER Hub — 前台渲染逻辑
   数据来源：localStorage（shared.js），与后台共用同一份数据
========================================================================== */

const state = {
  items: [],
  currentPage: 'dashboard',
  filterCategory: 'all',
  viewMode: 'grid',
  searchText: '',
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function debounce(fn, wait = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/* --------------------------------------------------------------------------
   类别视觉映射（中文规范类别 → 视觉 key + 颜色 + 标签类）
-------------------------------------------------------------------------- */
const CATEGORY_VISUAL = {
  resistor:   { key: 'resistor',   name: '电阻',          color: '#ffa726', tag: 'tag-resistor' },
  capacitor:  { key: 'capacitor',  name: '电容',          color: '#4dd0c1', tag: 'tag-capacitor' },
  ic:         { key: 'ic',         name: '集成电路',      color: '#e879f9', tag: 'tag-ic' },
  diode:      { key: 'diode',      name: '二极管',        color: '#66bb6a', tag: 'tag-diode' },
  transistor: { key: 'transistor', name: '三极管',        color: '#ffb300', tag: 'tag-transistor' },
  connector:  { key: 'connector',  name: '接插件',        color: '#80deea', tag: 'tag-connector' },
  crystal:    { key: 'crystal',    name: '晶振',          color: '#f48fb1', tag: 'tag-crystal' },
  inductor:   { key: 'inductor',   name: '电感',          color: '#ff8a65', tag: 'tag-inductor' },
  led:        { key: 'led',        name: 'LED',           color: '#fbbf24', tag: 'tag-led' },
  default:    { key: 'default',    name: '其他',          color: '#8b94a6', tag: 'tag-default' },
};

const CATEGORY_KEY_TO_VISUAL = {
  '电阻': 'resistor',
  '电容': 'capacitor',
  '电感': 'inductor',
  '二极管': 'diode',
  '三极管/MOSFET': 'transistor',
  'IC/集成电路': 'ic',
  'MCU/单片机': 'ic',
  'LED': 'led',
  '连接器': 'connector',
  '晶振': 'crystal',
};

function getVisualKey(category) {
  const resolved = resolveCategoryKey(category);
  return CATEGORY_KEY_TO_VISUAL[resolved] || 'default';
}

function getVisual(category) {
  return CATEGORY_VISUAL[getVisualKey(category)];
}

/* --------------------------------------------------------------------------
   元器件 SVG 可视化
-------------------------------------------------------------------------- */
function getComponentSVG(visualKey, color) {
  const c = color;
  switch (visualKey) {
    case 'resistor':
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <line x1="2" y1="30" x2="12" y2="30" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="48" y1="30" x2="58" y2="30" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M12 30 L16 22 L22 38 L28 22 L34 38 L40 22 L44 38 L48 30" stroke="${c}" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
      </svg>`;
    case 'capacitor':
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <line x1="2" y1="30" x2="24" y2="30" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="36" y1="30" x2="58" y2="30" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="24" y1="12" x2="24" y2="48" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M36 12 Q30 22 36 30 Q30 38 36 48" stroke="${c}" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      </svg>`;
    case 'ic':
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <rect x="16" y="12" width="28" height="36" rx="2" fill="${c}" fill-opacity="0.1" stroke="${c}" stroke-width="1.5"/>
        <path d="M22 12 A5 5 0 0 0 22 12" stroke="${c}" stroke-width="0" fill="none"/>
        <circle cx="20" cy="17" r="2" fill="${c}" fill-opacity="0.6"/>
        ${[0,1,2,3,4].map((i) => `<line x1="8" y1="${18 + i * 7}" x2="16" y2="${18 + i * 7}" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>`).join('')}
        ${[0,1,2,3,4].map((i) => `<line x1="44" y1="${18 + i * 7}" x2="52" y2="${18 + i * 7}" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>`).join('')}
      </svg>`;
    case 'diode':
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <line x1="2" y1="30" x2="18" y2="30" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="42" y1="30" x2="58" y2="30" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <polygon points="18,16 18,44 40,30" fill="${c}" fill-opacity="0.2" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/>
        <line x1="40" y1="16" x2="40" y2="44" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`;
    case 'transistor':
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <circle cx="30" cy="30" r="18" fill="${c}" fill-opacity="0.08" stroke="${c}" stroke-width="1.5"/>
        <line x1="20" y1="20" x2="20" y2="40" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="20" y1="25" x2="6" y2="18" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="20" y1="35" x2="6" y2="42" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="20" y1="30" x2="48" y2="30" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <polygon points="44,27 44,33 50,30" fill="${c}"/>
      </svg>`;
    case 'crystal':
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <line x1="2" y1="30" x2="14" y2="30" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="46" y1="30" x2="58" y2="30" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="16" y1="14" x2="16" y2="46" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
        <line x1="44" y1="14" x2="44" y2="46" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
        <rect x="18" y="20" width="24" height="20" rx="2" fill="${c}" fill-opacity="0.1" stroke="${c}" stroke-width="1.2"/>
      </svg>`;
    case 'inductor':
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <line x1="2" y1="34" x2="10" y2="34" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="50" y1="34" x2="58" y2="34" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M10 34 C10 24 18 24 18 34 C18 24 26 24 26 34 C26 24 34 24 34 34 C34 24 42 24 42 34 C42 24 50 24 50 34" stroke="${c}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      </svg>`;
    case 'connector':
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <rect x="6" y="16" width="48" height="28" rx="3" fill="${c}" fill-opacity="0.08" stroke="${c}" stroke-width="1.5"/>
        <rect x="10" y="20" width="8" height="20" rx="1.5" fill="${c}" fill-opacity="0.25" stroke="${c}" stroke-width="1"/>
        <rect x="20" y="20" width="8" height="20" rx="1.5" fill="${c}" fill-opacity="0.25" stroke="${c}" stroke-width="1"/>
        <rect x="30" y="20" width="8" height="20" rx="1.5" fill="${c}" fill-opacity="0.25" stroke="${c}" stroke-width="1"/>
        <rect x="40" y="20" width="8" height="20" rx="1.5" fill="${c}" fill-opacity="0.25" stroke="${c}" stroke-width="1"/>
      </svg>`;
    case 'led':
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <polygon points="18,16 18,44 38,30" fill="${c}" fill-opacity="0.15" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/>
        <line x1="38" y1="16" x2="38" y2="44" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="38" y1="30" x2="52" y2="30" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="10" y1="30" x2="18" y2="30" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="26" y1="12" x2="22" y2="6" stroke="${c}" stroke-width="1.2" stroke-linecap="round"/>
        <line x1="32" y1="12" x2="32" y2="5" stroke="${c}" stroke-width="1.2" stroke-linecap="round"/>
        <line x1="36" y1="12" x2="40" y2="6" stroke="${c}" stroke-width="1.2" stroke-linecap="round"/>
        <polygon points="20,4 22,6 19,7" fill="${c}"/>
        <polygon points="30,3 32,5 29,6" fill="${c}"/>
        <polygon points="38,4 40,6 37,7" fill="${c}"/>
      </svg>`;
    default:
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <circle cx="30" cy="30" r="14" stroke="${c}" stroke-width="1.5" fill="${c}" fill-opacity="0.12"/>
        <circle cx="30" cy="30" r="4" fill="${c}" fill-opacity="0.3"/>
      </svg>`;
  }
}

/* --------------------------------------------------------------------------
   工具函数
-------------------------------------------------------------------------- */
function getPrimaryText(item) {
  return item.name || '未命名元器件';
}

function getSecondaryText(item) {
  if (item.notes) return item.notes;
  return [item.category, item.package].filter(Boolean).join(' · ');
}

function timeAgo(iso) {
  if (!iso) return '未知';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '未知';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

/* --------------------------------------------------------------------------
   衍生数据
-------------------------------------------------------------------------- */
function getFilteredItems() {
  const text = state.searchText.trim().toLowerCase();
  return state.items.filter((item) => {
    if (state.filterCategory !== 'all') {
      if (getVisualKey(item.category) !== state.filterCategory) return false;
    }
    if (text) {
      const hay = [item.name, item.package, item.location, item.notes, item.category]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });
}

function getRecentActivities(limit = 6) {
  return state.items
    .map((item) => {
      const time = item.updatedAt || item.createdAt;
      const created = item.createdAt;
      const isCreate = !created || !item.updatedAt || created === item.updatedAt;
      return { item, time, isCreate };
    })
    .filter((entry) => entry.time)
    .sort((a, b) => (b.time || '').localeCompare(a.time || ''))
    .slice(0, limit);
}

function getUsedCategories() {
  const counts = {};
  state.items.forEach((item) => {
    const key = getVisualKey(item.category);
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([key, count]) => ({ key, ...CATEGORY_VISUAL[key], count }))
    .sort((a, b) => b.count - a.count);
}

/* --------------------------------------------------------------------------
   仪表盘
-------------------------------------------------------------------------- */
function renderDashboard() {
  const totalTypes = state.items.length;
  const recentCount = getRecentActivities(8).length;

  const kpis = [
    {
      label: '元器件种类', value: totalTypes, icon: 'fa-cubes', color: 'var(--accent)',
      bg: 'var(--accent-soft)', sub: `${getUsedCategories().length} 个类别`,
    },
    {
      label: '近期变动', value: recentCount, icon: 'fa-right-left', color: 'var(--success)',
      bg: 'var(--success-soft)', sub: '最近更新的记录',
    },
  ];

  return `
    <section class="hero fade-up">
      <div class="hero__content">
        <div class="hero__left">
          <div class="hero__tag"><span class="pulse"></span>元器件目录</div>
          <h1>焊接元器件 <span class="accent">智能管理</span></h1>
          <p>统一元器件管理平台，让每一次焊接都心中有数。</p>
        </div>
        <div class="hero__stats">
          <div class="hero__stat">
            <div class="hero__stat__num accent">${totalTypes}</div>
            <div class="hero__stat__lbl">元器件种类</div>
          </div>
        </div>
      </div>
    </section>

    <section class="kpi-grid">
      ${kpis.map((k) => `
        <div class="kpi-card fade-up">
          <div class="kpi-card__top">
            <div class="kpi-icon" style="background: ${k.bg}; color: ${k.color};">
              <i class="fa-solid ${k.icon}"></i>
            </div>
          </div>
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-value" style="color: ${k.color};">${k.value}</div>
          <div class="kpi-trend" style="color: var(--text-muted);">${k.sub}</div>
        </div>
      `).join('')}
    </section>

    <section class="bottom-grid">
      <div class="hub-panel fade-up">
        <div class="hub-panel__header">
          <div class="hub-panel__title">最近活动</div>
        </div>
        ${renderActivityList()}
      </div>
    </section>
  `;
}

function renderActivityList() {
  const activities = getRecentActivities(6);
  if (!activities.length) {
    return `<div class="hub-empty"><i class="fa-solid fa-clock-rotate-left"></i>暂无活动记录</div>`;
  }

  return `
    <div class="activity-list">
      ${activities.map(({ item, time, isCreate }) => {
        const icon = isCreate ? 'fa-plus' : 'fa-pen';
        const color = isCreate ? 'var(--success)' : 'var(--cyan)';
        const bg = isCreate ? 'var(--success-soft)' : 'var(--cyan-soft)';
        const text = isCreate
          ? `新增 <span class="mono">${escapeHtml(getPrimaryText(item))}</span>`
          : `更新 <span class="mono">${escapeHtml(getPrimaryText(item))}</span>`;
        return `
          <div class="activity-item">
            <div class="activity-icon" style="background: ${bg}; color: ${color};">
              <i class="fa-solid ${icon}"></i>
            </div>
            <div class="activity-content">
              <div class="activity-text">${text}</div>
              <div class="activity-meta">
                <span><i class="fa-regular fa-clock"></i> ${timeAgo(time)}</span>
                <span><i class="fa-regular fa-user"></i> 本地</span>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* --------------------------------------------------------------------------
   元器件库
-------------------------------------------------------------------------- */
function renderInventory() {
  const total = state.items.length;
  const cats = getUsedCategories();

  return `
    <div class="fade-up" style="margin-bottom: var(--space-5);">
      <div class="hero" style="padding: 22px 28px;">
        <div class="hero__content">
          <div class="hero__left">
            <div class="hero__tag"><span class="pulse"></span>共 ${total} 种元器件</div>
            <h1 style="font-size: 24px;">元器件 <span class="accent">库存目录</span></h1>
            <p>浏览所有焊接元器件的封装、位置与备注信息。点击任一条目可查看详细参数。</p>
          </div>
        </div>
      </div>
    </div>

    <div class="hub-toolbar fade-up">
      <div class="filter-group" id="filterGroup">
        <button class="chip is-active" data-cat="all">全部 <span class="count">${total}</span></button>
        ${cats.map((c) => `
          <button class="chip" data-cat="${c.key}">
            <span class="cat-dot" style="background: ${c.color};"></span>
            ${c.name} <span class="count">${c.count}</span>
          </button>
        `).join('')}
      </div>
      <div style="margin-left: auto; display: flex; gap: 8px; align-items: center;">
        <div class="hub-search" style="width: 240px; margin: 0; position: relative;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" placeholder="搜索名称、位置..." id="invSearch" style="padding: 6px 12px 6px 32px; font-size: 12px;" />
        </div>
        <div class="view-toggle">
          <button class="${state.viewMode === 'grid' ? 'is-active' : ''}" data-view="grid" title="网格视图" type="button"><i class="fa-solid fa-grip"></i></button>
          <button class="${state.viewMode === 'table' ? 'is-active' : ''}" data-view="table" title="表格视图" type="button"><i class="fa-solid fa-list"></i></button>
        </div>
      </div>
    </div>

    <div id="inventoryView"></div>
  `;
}

function renderInventoryView() {
  const view = $('#inventoryView');
  if (!view) return;

  const filtered = getFilteredItems();

  if (!filtered.length) {
    view.innerHTML = `<div class="hub-empty"><i class="fa-solid fa-magnifying-glass"></i>未找到匹配的元器件</div>`;
    return;
  }

  if (state.viewMode === 'grid') {
    view.innerHTML = `
      <div class="component-grid">
        ${filtered.map((item) => {
          const vis = getVisual(item.category);
          return `
            <button type="button" class="component-card" data-detail-id="${escapeHtml(item.id)}" style="text-align: left;">
              <div class="card-header">
                <div style="min-width: 0; flex: 1;">
                  <div class="card-model">${escapeHtml(getPrimaryText(item))}</div>
                  <div class="card-value">${escapeHtml(getSecondaryText(item))}</div>
                </div>
                <span class="tag ${vis.tag}">${escapeHtml(vis.name)}</span>
              </div>
              <div class="card-meta">
                <span><i class="fa-solid fa-cube"></i> ${escapeHtml(item.package || '-')}</span>
                <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(item.location || '-')}</span>
                ${item.datasheet ? `<span><i class="fa-solid fa-file-lines"></i> 手册</span>` : ''}
              </div>
              <div class="card-visual">${getComponentSVG(vis.key, vis.color)}</div>
            </button>
          `;
        }).join('')}
      </div>
    `;
  } else {
    view.innerHTML = `
      <div class="hub-panel fade-up" style="padding: 0;">
        <div class="hub-table-wrap" style="margin: 0;">
          <table class="hub-table">
            <thead>
              <tr>
                <th>名称</th><th>类别</th><th>封装</th><th>规格</th><th>位置</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map((item) => {
                const vis = getVisual(item.category);
                return `
                  <tr style="cursor: pointer;" tabindex="0" aria-label="查看详情" data-detail-id="${escapeHtml(item.id)}">
                    <td class="mono" style="color: var(--accent); font-weight: 600;">${escapeHtml(getPrimaryText(item))}</td>
                    <td><span class="tag ${vis.tag}">${escapeHtml(vis.name)}</span></td>
                    <td class="mono" style="color: var(--text-secondary);">${escapeHtml(item.package || '-')}</td>
                    <td style="color: var(--text-secondary); max-width: 220px;" class="truncate">${escapeHtml(getSecondaryText(item))}</td>
                    <td class="mono" style="color: var(--text-muted);">${escapeHtml(item.location || '-')}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}

/* --------------------------------------------------------------------------
   低库存预警页 / 数据统计页
-------------------------------------------------------------------------- */
function renderStatsPage() {
  const cats = getUsedCategories();
  const total = state.items.length;

  return `
    <section class="hero fade-up" style="padding: 22px 28px;">
      <div class="hero__content">
        <div class="hero__left">
          <div class="hero__tag"><span class="pulse"></span>数据统计</div>
          <h1 style="font-size: 24px;">元器件 <span class="accent">统计分析</span></h1>
          <p>按类别与封装维度查看分布，辅助盘点决策。</p>
        </div>
      </div>
    </section>

    <section class="kpi-grid">
      <div class="kpi-card fade-up">
        <div class="kpi-card__top"><div class="kpi-icon" style="background: var(--accent-soft); color: var(--accent);"><i class="fa-solid fa-cubes"></i></div></div>
        <div class="kpi-label">元器件种类</div>
        <div class="kpi-value" style="color: var(--accent);">${total}</div>
      </div>
      <div class="kpi-card fade-up">
        <div class="kpi-card__top"><div class="kpi-icon" style="background: var(--success-soft); color: var(--success);"><i class="fa-solid fa-shapes"></i></div></div>
        <div class="kpi-label">活跃类别数</div>
        <div class="kpi-value" style="color: var(--success);">${cats.length}</div>
      </div>
    </section>

    <section class="charts-grid">
      <div class="hub-panel fade-up">
        <div class="hub-panel__header"><div class="hub-panel__title">分类分布 <span class="sub">按元器件类别</span></div></div>
        <div class="cat-bars" id="catBars"></div>
      </div>
      <div class="hub-panel fade-up">
        <div class="hub-panel__header"><div class="hub-panel__title">封装类型占比</div></div>
        <div class="donut-container">
          <div class="donut" id="donut"></div>
          <div class="donut-legend" id="donutLegend"></div>
        </div>
      </div>
    </section>
  `;
}

/* --------------------------------------------------------------------------
   图表渲染
-------------------------------------------------------------------------- */
function renderCatBars() {
  const el = $('#catBars');
  if (!el) return;

  const data = getUsedCategories().map((c) => {
    const items = state.items.filter((it) => getVisualKey(it.category) === c.key);
    return { ...c, count: items.length };
  }).filter((d) => d.count > 0).sort((a, b) => b.count - a.count);

  if (!data.length) {
    el.innerHTML = `<div class="hub-empty" style="padding: 30px;"><i class="fa-solid fa-chart-column"></i>暂无数据</div>`;
    return;
  }

  const values = data.map((d) => d.count);
  const max = Math.max(...values, 1);
  const total = values.reduce((s, v) => s + v, 0) || 1;

  el.innerHTML = data.map((d) => {
    const val = d.count;
    return `
      <div class="cat-bar">
        <div class="cat-name">
          <span class="cat-dot" style="background: ${d.color};"></span>
          ${d.name}
        </div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="background: linear-gradient(90deg, ${d.color}33, ${d.color}); width: 0%;" data-width="${(val / max) * 100}%"></div>
        </div>
        <div class="cat-value">${val.toLocaleString()}<span class="pct">${((val / total) * 100).toFixed(1)}%</span></div>
      </div>
    `;
  }).join('');

  // 双 rAF 确保浏览器先绘制 width:0 的初始状态，触发填充动画
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      $$('#catBars .cat-bar-fill').forEach((node) => {
        node.style.width = node.dataset.width;
      });
    });
  });
}

function renderDonut() {
  const donutEl = $('#donut');
  const legendEl = $('#donutLegend');
  if (!donutEl || !legendEl) return;

  const groups = {};
  state.items.forEach((it) => {
    const pkg = it.package || '未指定';
    groups[pkg] = (groups[pkg] || 0) + 1;
  });

  const data = Object.entries(groups)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  if (!data.length) {
    donutEl.innerHTML = '';
    legendEl.innerHTML = `<div class="hub-empty" style="padding: 20px;"><i class="fa-solid fa-chart-pie"></i>暂无数据</div>`;
    return;
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  const palette = ['#ffa726', '#4dd0c1', '#e879f9', '#66bb6a', '#ffb300', '#80deea'];
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const circles = data.map((d, i) => {
    const percent = d.value / total;
    const dash = percent * circumference;
    const circle = `<circle cx="80" cy="80" r="${radius}"
      fill="none"
      stroke="${palette[i]}"
      stroke-width="16"
      stroke-dasharray="${dash} ${circumference - dash}"
      stroke-dashoffset="${-offset}"
      style="transition: stroke-dasharray 1s ease;"/>`;
    offset += dash;
    return circle;
  }).join('');

  donutEl.innerHTML = `
    <svg width="160" height="160" aria-hidden="true">${circles}</svg>
    <div class="donut-center">
      <div class="donut-center__num">${total}</div>
      <div class="donut-center__lbl">封装种类</div>
    </div>
  `;

  legendEl.innerHTML = data.map((d, i) => `
    <div class="legend-item">
      <span class="legend-color" style="background: ${palette[i]};"></span>
      <span class="legend-name" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</span>
      <span class="legend-value">${d.value} 种</span>
    </div>
  `).join('');
}

/* --------------------------------------------------------------------------
   侧边栏 — 仓库使用率
-------------------------------------------------------------------------- */
function renderUsage() {
  // 展示真实的 localStorage 占用（按常见 5MB 配额估算），不再使用虚构的"仓库容量"
  const QUOTA_BYTES = 5 * 1024 * 1024;
  let bytes = 0;
  try {
    bytes = new Blob([localStorage.getItem(STORAGE_KEY) || '']).size;
  } catch {
    bytes = 0;
  }
  const pct = Math.min(100, Math.max(1, Math.round((bytes / QUOTA_BYTES) * 100)));
  const formatSize = (b) =>
    b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
  const pctEl = $('#usagePct');
  const barEl = $('#usageBar');
  const usedEl = $('#usageUsed');
  const totalEl = $('#usageTotal');
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (barEl) barEl.style.width = `${pct}%`;
  if (usedEl) usedEl.textContent = `数据 ${formatSize(bytes)}`;
  if (totalEl) totalEl.textContent = '配额约 5 MB';
}

/* --------------------------------------------------------------------------
   页面切换
-------------------------------------------------------------------------- */
const PAGE_TITLES = {
  dashboard: ['仪表盘', '/ 总览'],
  inventory: ['元器件库', '/ 库存目录'],
  stats: ['数据统计', '/ 分析'],
};

function switchPage(page) {
  state.currentPage = page;
  const [t, s] = PAGE_TITLES[page] || ['', ''];
  $('#pageTitle').innerHTML = `${t}<span class="page-title__crumb">${s}</span>`;

  let html = '';
  if (page === 'dashboard') html = renderDashboard();
  else if (page === 'inventory') html = renderInventory();
  else if (page === 'stats') html = renderStatsPage();
  else html = renderPlaceholder(t);

  // innerHTML 是同步的，直接渲染即可，无需 setTimeout 延迟
  $('#content').innerHTML = html;

  if (page === 'dashboard' || page === 'stats') {
    renderCatBars();
    renderDonut();
  }
  if (page === 'inventory') {
    renderInventoryView();
    bindInventoryControls();
  }

  $$('.hub-nav__item[data-page], .mobile-nav__item[data-page]').forEach((node) => {
    node.classList.toggle('is-active', node.dataset.page === page);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* --------------------------------------------------------------------------
   元器件详情弹窗
-------------------------------------------------------------------------- */
function findItemById(id) {
  return state.items.find((it) => String(it.id) === String(id));
}

function renderDetailDialog(item) {
  const vis = getVisual(item.category);
  const primary = getPrimaryText(item);
  const secondary = getSecondaryText(item);
  const created = item.createdAt ? timeAgo(item.createdAt) : '—';
  const updated = item.updatedAt ? timeAgo(item.updatedAt) : '—';

  const specs = [
    { label: '名称', value: item.name, icon: 'fa-tag' },
    { label: '类别', value: vis.name, icon: 'fa-shapes' },
    { label: '封装', value: item.package, icon: 'fa-cube' },
    { label: '位置/库位', value: item.location, icon: 'fa-location-dot' },
  ].filter((s) => s.value !== undefined && s.value !== null && String(s.value).trim() !== '');

  const specsHtml = specs.map((s) => `
    <div class="detail-spec">
      <div class="detail-spec__label">
        <i class="fa-solid ${s.icon}"></i>${escapeHtml(s.label)}
      </div>
      <div class="detail-spec__value mono">${escapeHtml(s.value)}</div>
    </div>
  `).join('');

  const notesHtml = item.notes && String(item.notes).trim()
    ? `<div class="detail-section">
         <div class="detail-section__title"><i class="fa-solid fa-note-sticky"></i> 备注</div>
         <div class="detail-notes">${escapeHtml(item.notes)}</div>
       </div>`
    : '';

  const safeDatasheet = safeUrl(item.datasheet);
  const datasheetHtml = safeDatasheet
    ? `<a class="btn btn-primary" href="${escapeHtml(safeDatasheet)}" target="_blank" rel="noopener noreferrer">
         <i class="fa-solid fa-file-lines"></i> 查看数据手册
       </a>`
    : '';

  return `
    <div class="detail-dialog__header">
      <div class="detail-dialog__visual" style="color: ${vis.color};">
        ${getComponentSVG(vis.key, vis.color)}
      </div>
      <div class="detail-dialog__heading">
        <div class="detail-dialog__title">${escapeHtml(primary)}</div>
        <div class="detail-dialog__sub">
          <span class="tag ${vis.tag}">${escapeHtml(vis.name)}</span>
          ${secondary ? `<span class="detail-dialog__secondary">${escapeHtml(secondary)}</span>` : ''}
        </div>
      </div>
      <button type="button" class="icon-btn detail-dialog__close" id="detailCloseBtn" aria-label="关闭" title="关闭">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="detail-section">
      <div class="detail-section__title"><i class="fa-solid fa-list-check"></i> 元器件参数</div>
      <div class="detail-specs">${specsHtml}</div>
    </div>

    ${notesHtml}

    <div class="detail-section">
      <div class="detail-section__title"><i class="fa-regular fa-clock"></i> 时间信息</div>
      <div class="detail-specs">
        <div class="detail-spec">
          <div class="detail-spec__label"><i class="fa-solid fa-calendar-plus"></i> 创建时间</div>
          <div class="detail-spec__value mono">${escapeHtml(created)}</div>
        </div>
        <div class="detail-spec">
          <div class="detail-spec__label"><i class="fa-solid fa-calendar-check"></i> 最后更新</div>
          <div class="detail-spec__value mono">${escapeHtml(updated)}</div>
        </div>
      </div>
    </div>

    ${datasheetHtml ? `<div class="detail-dialog__footer">${datasheetHtml}</div>` : ''}
  `;
}

function openDetailDialog(id) {
  const item = findItemById(id);
  if (!item) {
    showToast('未找到该元器件', { isError: true });
    return;
  }
  const dialog = $('#detailDialog');
  const body = $('#detailDialogBody');
  if (!dialog || !body) return;
  body.innerHTML = renderDetailDialog(item);
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
  $('#detailCloseBtn')?.addEventListener('click', () => dialog.close());
}

/* 详情弹窗的打开事件在 init 中对 #content 做一次性委托（含表格行键盘可达） */

function renderPlaceholder(title) {
  return `
    <div class="hub-panel hub-placeholder fade-up">
      <div class="hub-placeholder__icon"><i class="fa-solid fa-screwdriver-wrench"></i></div>
      <h2>${escapeHtml(title)} 模块</h2>
      <p>该模块正在建设中，敬请期待。</p>
    </div>
  `;
}

function bindInventoryControls() {
  $$('#filterGroup .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      $$('#filterGroup .chip').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      state.filterCategory = chip.dataset.cat;
      renderInventoryView();
    });
  });
  $$('.view-toggle button').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.view-toggle button').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.viewMode = btn.dataset.view;
      renderInventoryView();
    });
  });
  const invSearch = $('#invSearch');
  if (invSearch) {
    const runSearch = debounce((value) => {
      state.searchText = value;
      renderInventoryView();
    });
    invSearch.addEventListener('input', (e) => runSearch(e.target.value));
  }
}

/* --------------------------------------------------------------------------
   主题（默认暗色，贴合 SOLDER 设计稿）
-------------------------------------------------------------------------- */
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
    root.classList.remove('dark');
  } else {
    root.setAttribute('data-theme', 'dark');
    root.classList.add('dark');
  }
  try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

function initTheme() {
  let saved = '';
  try { saved = localStorage.getItem('theme') || ''; } catch { saved = ''; }
  if (saved === 'light' || saved === 'dark') {
    applyTheme(saved);
    return;
  }
  // 默认暗色（贴合设计稿），尊重系统偏好为浅色时切换
  if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    applyTheme('light');
  } else {
    applyTheme('dark');
  }
}

/* --------------------------------------------------------------------------
   初始化
-------------------------------------------------------------------------- */
function init() {
  state.items = storageRead();
  initTheme();
  renderUsage();
  switchPage('dashboard');

  // 侧边栏 + 移动端底部导航
  $$('.hub-nav__item[data-page], .mobile-nav__item[data-page]').forEach((item) => {
    item.addEventListener('click', () => switchPage(item.dataset.page));
  });

  // 仪表盘"查看全部"按钮（事件委托，针对动态渲染的内部按钮）
  $('#content').addEventListener('click', (event) => {
    const target = event.target.closest('[data-page]');
    if (!target) return;
    const page = target.dataset.page;
    if (page && PAGE_TITLES[page]) {
      event.preventDefault();
      switchPage(page);
    }
  });

  // 详情弹窗打开：对 #content 做一次性事件委托，避免每次渲染重新绑定
  $('#content').addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-detail-id]');
    if (!trigger) return;
    // 避免内部按钮/链接（如数据手册）触发
    if (event.target.closest('a, button:not([data-detail-id])')) return;
    openDetailDialog(trigger.dataset.detailId);
  });
  $('#content').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const trigger = event.target.closest('tr[data-detail-id]');
    if (!trigger) return;
    event.preventDefault();
    openDetailDialog(trigger.dataset.detailId);
  });

  // 主题切换
  $('#themeBtn')?.addEventListener('click', toggleTheme);
  $('#themeBtnTop')?.addEventListener('click', toggleTheme);

  // 全局搜索：⌘K / Ctrl+K 聚焦
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      $('#globalSearch').focus();
    }
  });

  // 全局搜索：在元器件库页同步筛选，其它页跳转到元器件库（防抖减少重渲染）
  const runGlobalSearch = debounce((value) => {
    state.searchText = value;
    if (state.currentPage !== 'inventory') {
      state.filterCategory = 'all';
      switchPage('inventory');
      const invSearch = $('#invSearch');
      if (invSearch) invSearch.value = value;
    } else {
      const invSearch = $('#invSearch');
      if (invSearch && invSearch.value !== value) {
        invSearch.value = value;
      }
      renderInventoryView();
    }
  });
  $('#globalSearch').addEventListener('input', (e) => runGlobalSearch(e.target.value));

  // 详情弹窗：点击背景关闭
  $('#detailDialog')?.addEventListener('click', (e) => {
    const dialog = e.currentTarget;
    if (e.target === dialog) dialog.close();
  });

  // 就绪提示
  setTimeout(() => {
    showToast(`系统就绪 · 共加载 ${state.items.length} 种元器件`);
  }, 500);
}

document.addEventListener('DOMContentLoaded', init);
