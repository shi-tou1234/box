import {
  state,
  $,
  $$,
  showToast,
  refreshFilters,
  renderCategoryDatalist,
  renderAdminList,
  renderDetail,
  renderInventory,
  renderSyncStatus,
  renderSettings,
  applyLoginVisibility,
  applyAdminPanelVisibility,
  authIsLoggedIn,
  authLogin,
  authLogout,
  readSettingsLastSync,
} from './admin-state.js';
import {
  selectItem,
  upsertItem,
  deleteItem,
  duplicateItem,
  openForm,
  closeForm,
  submitForm,
  openQuantityDialog,
  closeQuantityDialog,
  submitQuantity,
  exportJson,
  importJson,
} from './admin-render.js';
import { syncToGist, syncFromGist, setSyncLoading } from './admin-sync.js';
import {
  settingsRead,
  settingsWrite,
  authReadPassword,
  authWritePassword,
  storageRead,
} from '../src/shared.js';

function initAdminLayout() {
  const adminBody = $('#adminBody');
  const logoutBtn = $('#adminLogoutBtn');
  const isLoggedIn = authIsLoggedIn();

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

  const tabBtns = adminBody?.querySelectorAll('.nav-item');
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
    state.selectedId = null;
    applyLoginVisibility();
    showToast('已退出管理后台');
  });
}

function showAdminPanel(panelId) {
  const buttons = $$('#adminSidebar .nav-item');
  const panels = $$('.admin-panel');
  buttons.forEach((btn) => {
    const selected = btn.getAttribute('data-tab') === panelId;
    btn.setAttribute('aria-selected', selected ? 'true' : 'false');
    btn.classList.toggle('nav-item--active', selected);
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
    renderSyncStatus();
  }
  if (panelId === 'settings') {
    const current = settingsRead();
    const tokenInput = $('#adminGithubToken');
    const gistInput = $('#adminGistUrl');
    const passwordInput = $('#adminPassword');
    const thresholdInput = $('#lowStockThreshold');
    if (tokenInput) tokenInput.value = current.token;
    if (gistInput) gistInput.value = current.gistUrl;
    if (passwordInput) passwordInput.value = authReadPassword();
    if (thresholdInput) thresholdInput.value = current.lowStockThreshold;
    renderSettings();
  }
}

function init() {
  state.items = storageRead();
  refreshFilters();
  renderCategoryDatalist();
  renderAdminList();
  renderDetail();
  renderSyncStatus();

  $('#adminSearch')?.addEventListener('input', (event) => {
    state.filterText = event.target.value;
    renderAdminList();
  });

  $('#filterCategory')?.addEventListener('change', (event) => {
    state.filterCategory = event.target.value;
    renderAdminList();
  });

  $('#filterPackage')?.addEventListener('change', (event) => {
    state.filterPackage = event.target.value;
    renderAdminList();
  });

  $('#filterStock')?.addEventListener('change', (event) => {
    state.filterStock = event.target.value;
    renderAdminList();
  });

  $('#adminNewBtn')?.addEventListener('click', () => openForm());
  $('#closeFormBtn')?.addEventListener('click', closeForm);
  $('#cancelFormBtn')?.addEventListener('click', closeForm);
  $('#componentForm')?.addEventListener('submit', submitForm);

  $('#formDialog')?.addEventListener('click', (event) => {
    if (event.target === $('#formDialog')) closeForm();
  });

  $('#quantityDialog')?.addEventListener('click', (event) => {
    if (event.target === $('#quantityDialog')) closeQuantityDialog();
  });
  $('#closeQuantityBtn')?.addEventListener('click', closeQuantityDialog);
  $('#cancelQuantityBtn')?.addEventListener('click', closeQuantityDialog);
  $('#quantityForm')?.addEventListener('submit', submitQuantity);

  $('#adminLoginForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const password = $('#adminLoginPassword').value || '';
    if (authLogin(password)) {
      applyAdminPanelVisibility();
      showAdminPanel('components');
      showToast('已进入管理后台');
    } else {
      showToast('密码错误', { duration: 2400 });
    }
  });

  $('#adminSettingsForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const token = $('#adminGithubToken').value.trim();
    const gistUrl = $('#adminGistUrl').value.trim();
    const password = $('#adminPassword').value || '';
    const lowStockThreshold = Number($('#lowStockThreshold').value);
    const current = settingsRead();
    settingsWrite({ ...current, token, gistUrl, lowStockThreshold: Number.isFinite(lowStockThreshold) ? Math.max(0, lowStockThreshold) : 5, lastSyncAt: readSettingsLastSync() });
    if (password) authWritePassword(password);
    showToast('设置已保存');
    showAdminPanel('settings');
  });

  $('#adminSettingsResetBtn')?.addEventListener('click', () => {
    $('#adminGithubToken').value = '';
    $('#adminGistUrl').value = '';
    $('#adminPassword').value = '';
    $('#lowStockThreshold').value = '5';
  });

  $('#inventoryCheckAll')?.addEventListener('change', (event) => {
    const checked = event.target.checked;
    $$('.inventory-check').forEach((node) => (node.checked = checked));
  });

  $('#batchDeleteBtn')?.addEventListener('click', () => {
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

  $('#batchClearBtn')?.addEventListener('click', () => {
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

  $('#adminExportBtn')?.addEventListener('click', exportJson);
  $('#adminImportBtn')?.addEventListener('click', () => $('#adminImportFile').click());
  $('#adminImportFile')?.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) importJson(file);
    event.target.value = '';
  });
  $('#adminSyncToBtn')?.addEventListener('click', syncToGist);
  $('#adminSyncFromBtn')?.addEventListener('click', syncFromGist);

  initAdminLayout();
  if (authIsLoggedIn()) {
    showAdminPanel('components');
  }
}

document.addEventListener('DOMContentLoaded', init);
