export const STORAGE_KEY = 'solder_pm.components.v1';
export const SETTINGS_KEY = 'solder_pm.settings.v1';
export const AUTH_KEY = 'solder_pm.auth.v1';

export const emptyState = {
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

export function coerceQuantity(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

export function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function storageRead() {
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
}

export function storageWrite(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function settingsRead() {
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
}

export function settingsWrite(value) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
}

/* ── 认证系统：PBKDF2-SHA256 ──────────────────────────────
 * 参考 blog 项目方案，使用 Web Crypto API 实现密码哈希。
 * 密码以 {salt, hash} 格式存储在 localStorage，永不存储明文。
 * 登录态由 sessionStorage 管理，关闭标签页自动登出。
 */

const PBKDF2_ITERATIONS = 600000;

function _toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function _fromBase64(str) {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function _hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

function _constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

/**
 * 读取存储的密码哈希数据。
 * @returns {{ salt: string, hash: string } | null}
 */
export function authReadPassword() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // 兼容旧格式 { password: 'xxx' } — 视作未设置
    if (data && typeof data.password === 'string') return null;
    if (data && data.salt && data.hash) {
      return { salt: String(data.salt), hash: String(data.hash) };
    }
    return null;
  } catch (error) {
    console.error('读取认证密码失败', error);
    return null;
  }
}

/**
 * 使用 PBKDF2-SHA256 哈希密码并存储。
 * @param {string} password
 */
export async function authWritePassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await _hashPassword(password, salt);
  localStorage.setItem(
    AUTH_KEY,
    JSON.stringify({ salt: _toBase64(salt), hash: _toBase64(hash) }),
  );
}

export function authClear() {
  localStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem('solder_pm.admin_ok');
}

export function authIsLoggedIn() {
  return sessionStorage.getItem('solder_pm.admin_ok') === '1';
}

/**
 * 验证密码并登录。首次使用时自动设置密码。
 * @param {string} password
 * @returns {Promise<boolean>}
 */
export async function authLogin(password) {
  const stored = authReadPassword();
  if (!stored) {
    // 首次设置密码
    await authWritePassword(password);
    sessionStorage.setItem('solder_pm.admin_ok', '1');
    return true;
  }
  const salt = _fromBase64(stored.salt);
  const storedHash = _fromBase64(stored.hash);
  const inputHash = await _hashPassword(password, salt);
  if (_constantTimeEqual(storedHash, inputHash)) {
    sessionStorage.setItem('solder_pm.admin_ok', '1');
    return true;
  }
  return false;
}

export function authLogout() {
  authClear();
}

export function summarizeChanges(base, target) {
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

export function getSortedItems(items, sortKey, sortDirection) {
  const sorted = items.slice();
  sorted.sort((a, b) => {
    const quantityA = coerceQuantity(a.quantity);
    const quantityB = coerceQuantity(b.quantity);
    if (sortKey === 'name') {
      return sortDirection === 'asc' ? a.name.localeCompare(b.name, 'zh') : b.name.localeCompare(a.name, 'zh');
    }
    if (sortKey === 'quantity') {
      return sortDirection === 'asc' ? quantityA - quantityB : quantityB - quantityA;
    }
    const timeA = a.updatedAt || a.createdAt || '';
    const timeB = b.updatedAt || b.createdAt || '';
    return sortDirection === 'asc' ? timeA.localeCompare(timeB) : timeB.localeCompare(timeA);
  });
  return sorted;
}

export function parseImportedText(text) {
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

export function resolveCategoryKey(category = '') {
  return CATEGORY_ALIAS_MAP.get(category.trim().toLowerCase()) || category.trim();
}

export function getPackageSuggestions(category = '') {
  const key = resolveCategoryKey(category);
  return PACKAGE_SUGGESTIONS[key] || [];
}

export function getCategoryOptions() {
  return Object.keys(PACKAGE_SUGGESTIONS);
}

const PACKAGE_SUGGESTIONS = {
  '电阻': ['0402', '0603', '0805', '1206', '1210', '2010', '2512', 'AXIAL-0.3', 'AXIAL-0.4', 'MELF'],
  '电容': ['0402', '0603', '0805', '1206', '1210', '1812', 'RADIAL-0.1', 'RADIAL-0.2', 'SMC', 'D-case'],
  '电感': ['0402', '0603', '0805', '1206', '2520', '3225', '4532', 'THT-axial'],
  '二极管': ['SOD-123', 'SOD-323', 'SOD-523', 'SMA', 'SMB', 'SMC', 'MELF', 'DO-35', 'DO-41'],
  '三极管/MOSFET': ['SOT-23', 'SOT-323', 'SOT-89', 'SOT-223', 'DPAK', 'D2PAK', 'TO-92', 'TO-220', 'TO-247'],
  'IC/集成电路': ['DIP-8', 'DIP-14', 'DIP-16', 'DIP-20', 'DIP-28', 'SOIC-8', 'SOIC-14', 'SOIC-16', 'TSSOP-20', 'QFN-32', 'LQFP-48', 'LQFP-64', 'BGA-100'],
  'MCU/单片机': ['LQFP-32', 'LQFP-48', 'LQFP-64', 'LQFP-100', 'QFN-32', 'QFN-48', 'TQFP-44'],
  'LED': ['0402', '0603', '0805', '1206', '5050', '3528', '2835', 'PLCC-2', '5mm-THT', '3mm-THT'],
  '连接器': ['XH-2.54', 'PH-2.0', 'ZH-1.5', 'KK-2.54', 'MX3.0', 'SMD-1.27'],
  '晶振': ['HC-49S', 'HC-49U', 'SMD-3225', 'SMD-5032', 'SMD-7050'],
  '按键/开关': ['1x2', '1x4', '1x8', '1x20', '2x4', '2x20', '2.54mm', '2.0mm', '1.27mm'],
  '继电器': ['DIP-4', 'DIP-5', 'DIP-6', 'DIP-8', 'SMD-4'],
  '保险丝': ['0603F', '0805F', '1203F', '5x20', '6x30'],
};

const CATEGORY_SYNONYMS = {
  '电阻': ['电阻', 'Resistor'],
  '电容': ['电容', 'Capacitor'],
  '电感': ['电感', 'Inductor'],
  '二极管': ['二极管', 'Diode'],
  '三极管/MOSFET': ['三极管', 'MOSFET', 'MOSFET / Transistor', 'Transistor'],
  'IC/集成电路': ['IC', '集成电路', 'IC / 集成电路'],
  'MCU/单片机': ['MCU', '单片机', 'MCU / 单片机'],
  'LED': ['LED'],
  '连接器': ['连接器', 'Connector', '连接器/Connector'],
  '晶振': ['晶振', 'Crystal', '晶振 / Crystal'],
  '按键/开关': ['按键', '开关', '按键/开关'],
  '继电器': ['继电器', 'Relay', '继电器/Relay'],
  '保险丝': ['保险丝', 'Fuse', '保险丝/Fuse'],
};

const CATEGORY_ALIAS_MAP = new Map();
Object.entries(CATEGORY_SYNONYMS).forEach(([key, aliases]) => {
  aliases.forEach((alias) => {
    CATEGORY_ALIAS_MAP.set(alias.trim().toLowerCase(), key);
  });
});
