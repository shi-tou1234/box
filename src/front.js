import {
  storageRead,
  settingsRead,
  coerceQuantity,
  escapeHtml,
  resolveCategoryKey,
} from './shared.js';

/* ==========================================================================
   SOLDER Hub — 前台渲染逻辑
   数据来源：localStorage（shared.js），与后台共用同一份数据
========================================================================== */

const state = {
  items: [],
  currentPage: 'dashboard',
  filterCategory: 'all',
  filterStock: 'all',
  viewMode: 'grid',
  searchText: '',
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

/* --------------------------------------------------------------------------
   类别视觉映射（中文规范类别 → 视觉 key + 颜色 + 标签类）
-------------------------------------------------------------------------- */
const CATEGORY_VISUAL = {
  resistor:   { name: '电阻',          color: '#ffa726', tag: 'tag-resistor' },
  capacitor:  { name: '电容',          color: '#4dd0c1', tag: 'tag-capacitor' },
  ic:         { name: '集成电路',      color: '#e879f9', tag: 'tag-ic' },
  diode:      { name: '二极管',        color: '#66bb6a', tag: 'tag-diode' },
  transistor: { name: '三极管',        color: '#ffb300', tag: 'tag-transistor' },
  connector:  { name: '接插件',        color: '#80deea', tag: 'tag-connector' },
  crystal:    { name: '晶振',          color: '#f48fb1', tag: 'tag-crystal' },
  inductor:   { name: '电感',          color: '#ff8a65', tag: 'tag-inductor' },
  led:        { name: 'LED',           color: '#fbbf24', tag: 'tag-led' },
  default:    { name: '其他',          color: '#8b94a6', tag: 'tag-default' },
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

function getThreshold() {
  const t = settingsRead().lowStockThreshold;
  return Number.isFinite(t) && t > 0 ? t : 5;
}

/* --------------------------------------------------------------------------
   元器件 SVG 可视化
-------------------------------------------------------------------------- */
function getComponentSVG(visualKey, color) {
  const c = color;
  switch (visualKey) {
    case 'resistor':
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <line x1="2" y1="30" x2="14" y2="30" stroke="${c}" stroke-width="1.5"/>
        <line x1="46" y1="30" x2="58" y2="30" stroke="${c}" stroke-width="1.5"/>
        <rect x="14" y="24" width="32" height="12" fill="${c}" fill-opacity="0.15" stroke="${c}" stroke-width="1.5" rx="1"/>
        <rect x="20" y="22" width="4" height="16" fill="${c}" fill-opacity="0.6"/>
        <rect x="26" y="22" width="4" height="16" fill="${c}" fill-opacity="0.4"/>
        <rect x="32" y="22" width="4" height="16" fill="${c}" fill-opacity="0.6"/>
        <rect x="38" y="22" width="4" height="16" fill="${c}" fill-opacity="0.4"/>
      </svg>`;
    case 'capacitor':
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <line x1="2" y1="30" x2="22" y2="30" stroke="${c}" stroke-width="1.5"/>
        <line x1="38" y1="30" x2="58" y2="30" stroke="${c}" stroke-width="1.5"/>
        <line x1="22" y1="14" x2="22" y2="46" stroke="${c}" stroke-width="2.5"/>
        <line x1="38" y1="14" x2="38" y2="46" stroke="${c}" stroke-width="2.5"/>
        <text x="30" y="11" text-anchor="middle" fill="${c}" font-size="9" font-family="JetBrains Mono" font-weight="600">µF</text>
      </svg>`;
    case 'ic':
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <rect x="14" y="14" width="32" height="32" fill="${c}" fill-opacity="0.15" stroke="${c}" stroke-width="1.5" rx="2"/>
        <circle cx="19" cy="19" r="1.8" fill="${c}"/>
        <text x="30" y="34" text-anchor="middle" fill="${c}" font-size="8" font-family="JetBrains Mono" font-weight="700">IC</text>
        ${[0,1,2,3].map((i) => `<line x1="6" y1="${20 + i * 8}" x2="14" y2="${20 + i * 8}" stroke="${c}" stroke-width="1.5"/>`).join('')}
        ${[0,1,2,3].map((i) => `<line x1="46" y1="${20 + i * 8}" x2="54" y2="${20 + i * 8}" stroke="${c}" stroke-width="1.5"/>`).join('')}
      </svg>`;
    case 'diode':
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <line x1="2" y1="30" x2="18" y2="30" stroke="${c}" stroke-width="1.5"/>
        <line x1="42" y1="30" x2="58" y2="30" stroke="${c}" stroke-width="1.5"/>
        <polygon points="18,18 18,42 38,30" fill="${c}" fill-opacity="0.3" stroke="${c}" stroke-width="1.5"/>
        <line x1="38" y1="18" x2="38" y2="42" stroke="${c}" stroke-width="2.5"/>
      </svg>`;
    case 'transistor':
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <circle cx="30" cy="30" r="18" fill="${c}" fill-opacity="0.12" stroke="${c}" stroke-width="1.5"/>
        <line x1="22" y1="20" x2="22" y2="40" stroke="${c}" stroke-width="2.5"/>
        <line x1="22" y1="24" x2="8" y2="18" stroke="${c}" stroke-width="1.5"/>
        <line x1="22" y1="32" x2="46" y2="32" stroke="${c}" stroke-width="1.5"/>
        <line x1="22" y1="36" x2="8" y2="42" stroke="${c}" stroke-width="1.5"/>
        <polygon points="42,28 42,36 48,32" fill="${c}"/>
      </svg>`;
    case 'crystal':
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <rect x="14" y="22" width="32" height="16" fill="${c}" fill-opacity="0.15" stroke="${c}" stroke-width="1.5" rx="1"/>
        <line x1="22" y1="22" x2="22" y2="38" stroke="${c}" stroke-width="2"/>
        <line x1="38" y1="22" x2="38" y2="38" stroke="${c}" stroke-width="2"/>
        <line x1="2" y1="30" x2="14" y2="30" stroke="${c}" stroke-width="1.5"/>
        <line x1="46" y1="30" x2="58" y2="30" stroke="${c}" stroke-width="1.5"/>
        <text x="30" y="33" text-anchor="middle" fill="${c}" font-size="7" font-family="JetBrains Mono" font-weight="600">XTAL</text>
      </svg>`;
    case 'inductor':
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <line x1="2" y1="35" x2="10" y2="35" stroke="${c}" stroke-width="1.5"/>
        <line x1="50" y1="35" x2="58" y2="35" stroke="${c}" stroke-width="1.5"/>
        <path d="M 10 35 Q 15 22 20 35 Q 25 22 30 35 Q 35 22 40 35 Q 45 22 50 35" stroke="${c}" stroke-width="1.8" fill="none"/>
      </svg>`;
    case 'connector':
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <rect x="8" y="18" width="44" height="22" fill="${c}" fill-opacity="0.15" stroke="${c}" stroke-width="1.5" rx="2"/>
        <rect x="12" y="22" width="36" height="4" fill="${c}" fill-opacity="0.5"/>
        <line x1="16" y1="40" x2="16" y2="50" stroke="${c}" stroke-width="1.5"/>
        <line x1="26" y1="40" x2="26" y2="50" stroke="${c}" stroke-width="1.5"/>
        <line x1="36" y1="40" x2="36" y2="50" stroke="${c}" stroke-width="1.5"/>
        <line x1="46" y1="40" x2="46" y2="50" stroke="${c}" stroke-width="1.5"/>
      </svg>`;
    case 'led':
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <circle cx="30" cy="26" r="14" fill="${c}" fill-opacity="0.18" stroke="${c}" stroke-width="1.5"/>
        <line x1="22" y1="40" x2="22" y2="50" stroke="${c}" stroke-width="1.5"/>
        <line x1="38" y1="40" x2="38" y2="50" stroke="${c}" stroke-width="1.5"/>
        <line x1="20" y1="14" x2="14" y2="8" stroke="${c}" stroke-width="1.2"/>
        <line x1="30" y1="10" x2="30" y2="4" stroke="${c}" stroke-width="1.2"/>
        <line x1="40" y1="14" x2="46" y2="8" stroke="${c}" stroke-width="1.2"/>
      </svg>`;
    default:
      return `<svg viewBox="0 0 60 60" fill="none" style="width:100%;height:100%">
        <circle cx="30" cy="30" r="15" stroke="${c}" stroke-width="1.5" fill="${c}" fill-opacity="0.18"/>
      </svg>`;
  }
}

/* --------------------------------------------------------------------------
   工具函数
-------------------------------------------------------------------------- */
function getStockTier(qty, threshold) {
  const q = coerceQuantity(qty);
  if (q <= 0) return { level: 'out', cls: 'stock-low', color: 'var(--danger)', label: '缺货' };
  if (q <= threshold) return { level: 'low', cls: 'stock-low', color: 'var(--danger)', label: '不足' };
  if (q <= threshold * 2) return { level: 'mid', cls: 'stock-mid', color: 'var(--warning)', label: '偏低' };
  return { level: 'ok', cls: 'stock-ok', color: 'var(--success)', label: '充足' };
}

function getPrimaryText(item) {
  return item.model || item.name || '未命名元器件';
}

function getSecondaryText(item) {
  if (item.model) return item.name || '';
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

function sparkline(data, color) {
  const w = 60, h = 28;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const lastX = w;
  const lastY = h - ((data[data.length - 1] - min) / range) * (h - 4) - 2;
  const gid = 'sp' + Math.random().toString(36).slice(2, 8);
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <polygon points="0,${h} ${points} ${w},${h}" fill="url(#${gid})"/>
    <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${lastX}" cy="${lastY}" r="2" fill="${color}"/>
  </svg>`;
}

function showToast(message, options = {}) {
  const container = $('#toast');
  if (!container) return;
  const isError = options.isError || /失败|错误|Failed/i.test(message);
  const duration = options.duration ?? (isError ? 6000 : 3000);
  const existing = Array.from(container.children);
  while (existing.length >= 5) existing.shift().remove();
  const item = document.createElement('div');
  item.className = 'toast__item';
  if (isError) item.classList.add('toast__item--danger');
  item.textContent = message;
  container.appendChild(item);
  const dismiss = () => {
    item.classList.add('toast--leave');
    item.addEventListener('animationend', () => item.remove(), { once: true });
  };
  if (options.persistent !== true) setTimeout(dismiss, duration);
  item.addEventListener('click', () => {
    if (!item.classList.contains('toast--leave')) dismiss();
  });
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
    if (state.filterStock !== 'all') {
      const threshold = getThreshold();
      const tier = getStockTier(item.quantity, threshold).level;
      if (state.filterStock === 'low' && !(tier === 'low' || tier === 'out')) return false;
      if (state.filterStock === 'ok' && tier !== 'ok' && tier !== 'mid') return false;
    }
    if (text) {
      const hay = [item.name, item.model, item.package, item.location, item.notes, item.category]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });
}

function getLowStockItems() {
  const threshold = getThreshold();
  return state.items.filter((item) => coerceQuantity(item.quantity) <= threshold);
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
  const totalStock = state.items.reduce((s, c) => s + coerceQuantity(c.quantity), 0);
  const lowStock = getLowStockItems().length;
  const recentCount = getRecentActivities(8).length;
  const threshold = getThreshold();

  const kpis = [
    {
      label: '元器件种类', value: totalTypes, icon: 'fa-cubes', color: 'var(--accent)',
      bg: 'var(--accent-soft)', trend: 'up', trendText: '本地已录入',
      spark: [2, 3, 4, 4, 5, 6, 7, 8, 9, 10, 11, 12].slice(-Math.max(4, totalTypes)),
    },
    {
      label: '总库存数量', value: totalStock.toLocaleString(), icon: 'fa-layer-group', color: 'var(--cyan)',
      bg: 'var(--cyan-soft)', trend: totalStock > 0 ? 'up' : 'warn',
      trendText: totalStock > 0 ? '库存健康' : '请补充库存',
      spark: [8, 12, 10, 18, 20, 24, 30, 28, 36, 40, 38, 42],
    },
    {
      label: '低库存预警', value: lowStock, icon: 'fa-triangle-exclamation', color: 'var(--danger)',
      bg: 'var(--danger-soft)', trend: lowStock > 0 ? 'warn' : 'up',
      trendText: lowStock > 0 ? `阈值 ≤ ${threshold}` : '暂无预警',
      spark: [1, 2, 1, 3, 2, 4, 3, 5, 4, 3, 4, lowStock],
    },
    {
      label: '近期变动', value: recentCount, icon: 'fa-right-left', color: 'var(--success)',
      bg: 'var(--success-soft)', trend: 'up', trendText: '近期更新记录',
      spark: [2, 3, 2, 4, 5, 4, 6, 5, 7, 6, 8, recentCount || 1],
    },
  ];

  return `
    <section class="hero fade-up">
      <div class="hero__content">
        <div class="hero__left">
          <div class="hero__tag"><span class="pulse"></span>实时库存监控</div>
          <h1>焊接元器件 <span class="accent">智能管理</span></h1>
          <p>统一元器件库存管理平台，覆盖入库、出库、预警、统计全流程，让每一次焊接都心中有数。</p>
        </div>
        <div class="hero__stats">
          <div class="hero__stat">
            <div class="hero__stat__num accent">${totalTypes}</div>
            <div class="hero__stat__lbl">元器件种类</div>
          </div>
          <div class="hero__stat">
            <div class="hero__stat__num">${totalStock.toLocaleString()}</div>
            <div class="hero__stat__lbl">总库存数</div>
          </div>
          <div class="hero__stat">
            <div class="hero__stat__num cyan">${lowStock}</div>
            <div class="hero__stat__lbl">低库存预警</div>
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
            <div class="kpi-spark">${sparkline(k.spark, k.color)}</div>
          </div>
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-value" style="color: ${k.color};">${k.value}</div>
          <div class="kpi-trend ${k.trend}">
            <i class="fa-solid fa-arrow-${k.trend === 'up' ? 'up' : k.trend === 'down' ? 'down' : 'right'}"></i> ${k.trendText}
          </div>
        </div>
      `).join('')}
    </section>

    <section class="charts-grid">
      <div class="hub-panel fade-up">
        <div class="hub-panel__header">
          <div class="hub-panel__title">分类库存分布 <span class="sub">按元器件类别</span></div>
          <div style="display:flex;gap:6px;">
            <button class="chip is-active" data-metric="stock">数量</button>
            <button class="chip" data-metric="count">种类</button>
          </div>
        </div>
        <div class="cat-bars" id="catBars"></div>
      </div>

      <div class="hub-panel fade-up">
        <div class="hub-panel__header">
          <div class="hub-panel__title">封装类型占比</div>
        </div>
        <div class="donut-container">
          <div class="donut" id="donut"></div>
          <div class="donut-legend" id="donutLegend"></div>
        </div>
      </div>
    </section>

    <section class="bottom-grid">
      <div class="hub-panel fade-up">
        <div class="hub-panel__header">
          <div class="hub-panel__title">低库存预警 <span class="sub">需补货</span></div>
          <button class="btn btn-ghost btn--small" data-page="alert">查看全部</button>
        </div>
        ${renderLowStockTable()}
      </div>

      <div class="hub-panel fade-up">
        <div class="hub-panel__header">
          <div class="hub-panel__title">最近活动</div>
        </div>
        ${renderActivityList()}
      </div>
    </section>
  `;
}

function renderLowStockTable() {
  const threshold = getThreshold();
  const items = getLowStockItems()
    .sort((a, b) => coerceQuantity(a.quantity) - coerceQuantity(b.quantity))
    .slice(0, 6);

  if (!items.length) {
    return `<div class="hub-empty"><i class="fa-solid fa-circle-check"></i>暂无低库存条目，库存充足</div>`;
  }

  return `
    <div class="hub-table-wrap">
      <table class="hub-table">
        <thead>
          <tr><th>型号</th><th>类别</th><th>封装</th><th>当前库存</th><th>阈值</th><th>位置</th></tr>
        </thead>
        <tbody>
          ${items.map((item) => {
            const vis = getVisual(item.category);
            return `
              <tr style="cursor: pointer;" data-detail-id="${escapeHtml(item.id)}">
                <td class="mono" style="color: var(--accent); font-weight: 600;">${escapeHtml(getPrimaryText(item))}</td>
                <td><span class="tag ${vis.tag}">${escapeHtml(vis.name)}</span></td>
                <td class="mono" style="color: var(--text-secondary);">${escapeHtml(item.package || '-')}</td>
                <td class="mono stock-low" style="font-weight: 700;">${coerceQuantity(item.quantity)}</td>
                <td class="mono" style="color: var(--text-muted);">${threshold}</td>
                <td class="mono" style="color: var(--text-muted);">${escapeHtml(item.location || '-')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
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
          ? `新增 <span class="mono">${escapeHtml(getPrimaryText(item))}</span> ×${coerceQuantity(item.quantity)}`
          : `更新 <span class="mono">${escapeHtml(getPrimaryText(item))}</span> ×${coerceQuantity(item.quantity)}`;
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
            <p>浏览所有焊接元器件的型号、封装、库存与位置信息。点击任一条目可查看详细参数。</p>
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
          <input type="text" placeholder="搜索型号..." id="invSearch" style="padding: 6px 12px 6px 32px; font-size: 12px;" />
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

  const threshold = getThreshold();
  const filtered = getFilteredItems();

  if (!filtered.length) {
    view.innerHTML = `<div class="hub-empty"><i class="fa-solid fa-magnifying-glass"></i>未找到匹配的元器件</div>`;
    return;
  }

  if (state.viewMode === 'grid') {
    view.innerHTML = `
      <div class="component-grid">
        ${filtered.map((item, i) => {
          const vis = getVisual(item.category);
          const qty = coerceQuantity(item.quantity);
          const tier = getStockTier(qty, threshold);
          const ratio = Math.min(1, qty / Math.max(1, threshold * 3));
          return `
            <button type="button" class="component-card fade-up" data-detail-id="${escapeHtml(item.id)}" style="animation-delay: ${i * 0.03}s; text-align: left;">
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
              <div class="card-body">
                <div>
                  <div class="card-stock ${tier.cls}" style="color: ${tier.color};">${qty.toLocaleString()}</div>
                  <div class="card-stock-label">库存 / 阈值 ${threshold}</div>
                </div>
                <div class="card-visual">${getComponentSVG(vis.key, vis.color)}</div>
              </div>
              <div class="stock-progress" style="margin-top: 10px;">
                <div class="stock-progress__fill" style="width: ${ratio * 100}%; background: ${tier.color};"></div>
              </div>
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
                <th>型号</th><th>类别</th><th>封装</th><th>规格</th>
                <th>库存</th><th>阈值</th><th>位置</th><th>状态</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map((item) => {
                const vis = getVisual(item.category);
                const qty = coerceQuantity(item.quantity);
                const tier = getStockTier(qty, threshold);
                return `
                  <tr style="cursor: pointer;" data-detail-id="${escapeHtml(item.id)}">
                    <td class="mono" style="color: var(--accent); font-weight: 600;">${escapeHtml(getPrimaryText(item))}</td>
                    <td><span class="tag ${vis.tag}">${escapeHtml(vis.name)}</span></td>
                    <td class="mono" style="color: var(--text-secondary);">${escapeHtml(item.package || '-')}</td>
                    <td style="color: var(--text-secondary); max-width: 220px;" class="truncate">${escapeHtml(getSecondaryText(item))}</td>
                    <td class="mono ${tier.cls}" style="font-weight: 700; font-size: 14px;">${qty.toLocaleString()}</td>
                    <td class="mono" style="color: var(--text-muted);">${threshold}</td>
                    <td class="mono" style="color: var(--text-muted);">${escapeHtml(item.location || '-')}</td>
                    <td><span style="color: ${tier.color}; font-size: 12px; font-weight: 600;">● ${tier.label}</span></td>
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
function renderAlertPage() {
  const threshold = getThreshold();
  const items = getLowStockItems().sort((a, b) => coerceQuantity(a.quantity) - coerceQuantity(b.quantity));

  return `
    <section class="hero fade-up" style="padding: 22px 28px;">
      <div class="hero__content">
        <div class="hero__left">
          <div class="hero__tag"><span class="pulse"></span>阈值 ≤ ${threshold}</div>
          <h1 style="font-size: 24px;">低库存 <span class="accent">预警列表</span></h1>
          <p>共 ${items.length} 条元器件库存低于阈值，建议尽快补货。点击条目查看详细参数。</p>
        </div>
      </div>
    </section>

    <div class="hub-panel fade-up" style="padding: 0;">
      ${items.length === 0
        ? `<div class="hub-empty"><i class="fa-solid fa-circle-check"></i>暂无低库存条目，库存充足</div>`
        : `<div class="hub-table-wrap" style="margin: 0;">
            <table class="hub-table">
              <thead>
                <tr><th>型号</th><th>类别</th><th>封装</th><th>规格</th><th>当前库存</th><th>阈值</th><th>位置</th><th>状态</th></tr>
              </thead>
              <tbody>
                ${items.map((item) => {
                  const vis = getVisual(item.category);
                  const qty = coerceQuantity(item.quantity);
                  const tier = getStockTier(qty, threshold);
                  return `
                    <tr style="cursor: pointer;" data-detail-id="${escapeHtml(item.id)}">
                      <td class="mono" style="color: var(--accent); font-weight: 600;">${escapeHtml(getPrimaryText(item))}</td>
                      <td><span class="tag ${vis.tag}">${escapeHtml(vis.name)}</span></td>
                      <td class="mono" style="color: var(--text-secondary);">${escapeHtml(item.package || '-')}</td>
                      <td style="color: var(--text-secondary);" class="truncate">${escapeHtml(getSecondaryText(item))}</td>
                      <td class="mono ${tier.cls}" style="font-weight: 700;">${qty.toLocaleString()}</td>
                      <td class="mono" style="color: var(--text-muted);">${threshold}</td>
                      <td class="mono" style="color: var(--text-muted);">${escapeHtml(item.location || '-')}</td>
                      <td><span style="color: ${tier.color}; font-size: 12px; font-weight: 600;">● ${tier.label}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>`}
    </div>
  `;
}

function renderStatsPage() {
  const cats = getUsedCategories();
  const total = state.items.length;
  const totalStock = state.items.reduce((s, c) => s + coerceQuantity(c.quantity), 0);
  const threshold = getThreshold();
  const lowCount = getLowStockItems().length;

  return `
    <section class="hero fade-up" style="padding: 22px 28px;">
      <div class="hero__content">
        <div class="hero__left">
          <div class="hero__tag"><span class="pulse"></span>数据统计</div>
          <h1 style="font-size: 24px;">元器件 <span class="accent">统计分析</span></h1>
          <p>按类别与封装维度查看库存分布，辅助补货与盘点决策。</p>
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
        <div class="kpi-card__top"><div class="kpi-icon" style="background: var(--cyan-soft); color: var(--cyan);"><i class="fa-solid fa-layer-group"></i></div></div>
        <div class="kpi-label">总库存数量</div>
        <div class="kpi-value" style="color: var(--cyan);">${totalStock.toLocaleString()}</div>
      </div>
      <div class="kpi-card fade-up">
        <div class="kpi-card__top"><div class="kpi-icon" style="background: var(--danger-soft); color: var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i></div></div>
        <div class="kpi-label">低库存条目</div>
        <div class="kpi-value" style="color: var(--danger);">${lowCount}</div>
      </div>
      <div class="kpi-card fade-up">
        <div class="kpi-card__top"><div class="kpi-icon" style="background: var(--success-soft); color: var(--success);"><i class="fa-solid fa-shapes"></i></div></div>
        <div class="kpi-label">活跃类别数</div>
        <div class="kpi-value" style="color: var(--success);">${cats.length}</div>
      </div>
    </section>

    <section class="charts-grid">
      <div class="hub-panel fade-up">
        <div class="hub-panel__header"><div class="hub-panel__title">分类库存分布 <span class="sub">数量</span></div></div>
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
let catMetric = 'stock';

function renderCatBars() {
  const el = $('#catBars');
  if (!el) return;

  const data = getUsedCategories().map((c) => {
    const items = state.items.filter((it) => getVisualKey(it.category) === c.key);
    const stock = items.reduce((s, it) => s + coerceQuantity(it.quantity), 0);
    return { ...c, stock, count: items.length };
  }).filter((d) => d.count > 0).sort((a, b) => (catMetric === 'stock' ? b.stock - a.stock : b.count - a.count));

  if (!data.length) {
    el.innerHTML = `<div class="hub-empty" style="padding: 30px;"><i class="fa-solid fa-chart-column"></i>暂无数据</div>`;
    return;
  }

  const values = data.map((d) => (catMetric === 'stock' ? d.stock : d.count));
  const max = Math.max(...values, 1);
  const total = values.reduce((s, v) => s + v, 0) || 1;

  el.innerHTML = data.map((d) => {
    const val = catMetric === 'stock' ? d.stock : d.count;
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

  setTimeout(() => {
    $$('#catBars .cat-bar-fill').forEach((node) => {
      node.style.width = node.dataset.width;
    });
  }, 80);
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
  const totalStock = state.items.reduce((s, c) => s + coerceQuantity(c.quantity), 0);
  const capacity = 4000;
  const pct = Math.min(100, Math.round((totalStock / capacity) * 100));
  const pctEl = $('#usagePct');
  const barEl = $('#usageBar');
  const usedEl = $('#usageUsed');
  const totalEl = $('#usageTotal');
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (barEl) barEl.style.width = `${pct}%`;
  if (usedEl) usedEl.textContent = `已用 ${totalStock.toLocaleString()} 位`;
  if (totalEl) totalEl.textContent = `共 ${capacity.toLocaleString()} 位`;

  const badge = $('#alertBadge');
  const lowCount = getLowStockItems().length;
  if (badge) {
    if (lowCount > 0) {
      badge.textContent = String(lowCount);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }
}

/* --------------------------------------------------------------------------
   页面切换
-------------------------------------------------------------------------- */
const PAGE_TITLES = {
  dashboard: ['仪表盘', '/ 总览'],
  inventory: ['元器件库', '/ 库存目录'],
  alert: ['低库存预警', '/ 待处理'],
  stats: ['数据统计', '/ 分析'],
};

function switchPage(page) {
  state.currentPage = page;
  const [t, s] = PAGE_TITLES[page] || ['', ''];
  $('#pageTitle').innerHTML = `${t}<span class="page-title__crumb">${s}</span>`;

  let html = '';
  if (page === 'dashboard') html = renderDashboard();
  else if (page === 'inventory') html = renderInventory();
  else if (page === 'alert') html = renderAlertPage();
  else if (page === 'stats') html = renderStatsPage();
  else html = renderPlaceholder(t);

  $('#content').innerHTML = html;

  if (page === 'dashboard' || page === 'stats') {
    setTimeout(() => { renderCatBars(); renderDonut(); bindChartToggles(); }, 50);
  }
  if (page === 'inventory') {
    setTimeout(() => {
      renderInventoryView();
      bindInventoryControls();
      bindDetailTriggers();
    }, 50);
  } else {
    setTimeout(bindDetailTriggers, 50);
  }

  $$('.hub-nav__item[data-page]').forEach((node) => {
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
  const qty = coerceQuantity(item.quantity);
  const threshold = getThreshold();
  const tier = getStockTier(qty, threshold);
  const primary = getPrimaryText(item);
  const secondary = getSecondaryText(item);
  const created = item.createdAt ? timeAgo(item.createdAt) : '—';
  const updated = item.updatedAt ? timeAgo(item.updatedAt) : '—';

  const specs = [
    { label: '名称', value: item.name, icon: 'fa-tag' },
    { label: '型号', value: item.model, icon: 'fa-microchip' },
    { label: '类别', value: vis.name, icon: 'fa-shapes' },
    { label: '封装', value: item.package, icon: 'fa-cube' },
    { label: '位置/库位', value: item.location, icon: 'fa-location-dot' },
    { label: '库存数量', value: qty.toLocaleString(), icon: 'fa-boxes-stacked' },
    { label: '低库存阈值', value: String(threshold), icon: 'fa-triangle-exclamation' },
    { label: '库存状态', value: tier.label, icon: 'fa-gauge' },
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

  const datasheetHtml = item.datasheet && String(item.datasheet).trim()
    ? `<a class="btn btn-primary" href="${escapeHtml(item.datasheet)}" target="_blank" rel="noopener noreferrer">
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

    <div class="detail-dialog__status">
      <div class="detail-status-pill" style="background: color-mix(in srgb, ${tier.color} 14%, transparent); color: ${tier.color};">
        <span class="status-dot" style="background: ${tier.color}; box-shadow: 0 0 0 3px color-mix(in srgb, ${tier.color} 18%, transparent);"></span>
        <span class="mono" style="font-weight: 700;">${qty.toLocaleString()}</span>
        <span style="opacity: 0.85;">/ 阈值 ${threshold} · ${tier.label}</span>
      </div>
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

function bindDetailTriggers() {
  $$('#content [data-detail-id]').forEach((el) => {
    el.addEventListener('click', (e) => {
      // 避免内部按钮（如数据手册链接）触发
      if (e.target.closest('a, button:not([data-detail-id])')) return;
      const id = el.dataset.detailId;
      if (id) openDetailDialog(id);
    });
  });
}

function renderPlaceholder(title) {
  return `
    <div class="hub-panel hub-placeholder fade-up">
      <div class="hub-placeholder__icon"><i class="fa-solid fa-screwdriver-wrench"></i></div>
      <h2>${escapeHtml(title)} 模块</h2>
      <p>该模块正在建设中，敬请期待。</p>
    </div>
  `;
}

function bindChartToggles() {
  $$('#catBars').forEach(() => {});
  $$('.hub-panel__header .chip[data-metric]').forEach((chip) => {
    chip.addEventListener('click', () => {
      $$('.hub-panel__header .chip[data-metric]').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      catMetric = chip.dataset.metric;
      renderCatBars();
    });
  });
}

function bindInventoryControls() {
  $$('#filterGroup .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      $$('#filterGroup .chip').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      state.filterCategory = chip.dataset.cat;
      renderInventoryView();
      bindDetailTriggers();
    });
  });
  $$('.view-toggle button').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.view-toggle button').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.viewMode = btn.dataset.view;
      renderInventoryView();
      bindDetailTriggers();
    });
  });
  const invSearch = $('#invSearch');
  if (invSearch) {
    invSearch.addEventListener('input', (e) => {
      state.searchText = e.target.value;
      renderInventoryView();
      bindDetailTriggers();
    });
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

  window.showToast = showToast;

  // 侧边栏导航
  $$('.hub-nav__item[data-page]').forEach((item) => {
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

  // 全局搜索：在元器件库页同步筛选，其它页跳转到元器件库
  $('#globalSearch').addEventListener('input', (e) => {
    state.searchText = e.target.value;
    if (state.currentPage !== 'inventory') {
      state.filterCategory = 'all';
      switchPage('inventory');
      setTimeout(() => {
        const invSearch = $('#invSearch');
        if (invSearch) invSearch.value = e.target.value;
      }, 60);
    } else {
      const invSearch = $('#invSearch');
      if (invSearch && invSearch.value !== e.target.value) {
        invSearch.value = e.target.value;
      }
      renderInventoryView();
      bindDetailTriggers();
    }
  });

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
