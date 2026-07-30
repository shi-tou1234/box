import {
  state,
  $,
  $$,
  showToast,
  refreshFilters,
  renderCategoryDatalist,
  applyLoginVisibility,
  applyAdminPanelVisibility,
  authIsLoggedIn,
  authLogin,
  authLogout,
  authClear,
  readSettingsLastSync,
  getSelectedInventoryIds,
} from './admin-state.js';
import {
  openForm,
  closeForm,
  submitForm,
  closeQuantityDialog,
  submitQuantity,
  exportJson,
  importJson,
  renderSettings,
  renderAdminList,
  renderDetail,
  renderInventory,
  renderSyncStatus,
} from './admin-render.js';
import { syncToGist, syncFromGist } from './admin-sync.js';
import {
  settingsRead,
  settingsWrite,
  authReadPassword,
  authWritePassword,
  storageRead,
  nowIso,
} from '../src/shared.js';

function bindLoginForm() {
  const form = $('#adminLoginForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = $('#adminLoginPassword')?.value || '';
    try {
      if (await authLogin(password)) {
        applyAdminPanelVisibility();
        showAdminPanel('components');
        showToast('已进入管理后台');
      } else {
        showToast('密码错误', { duration: 2400 });
      }
    } catch (error) {
      console.error('登录失败', error);
      showToast('认证系统异常，请确认浏览器支持 Web Crypto API', { duration: 6000 });
    }
  });
}

function bindResetPasswordBtn() {
  $('#resetPasswordBtn')?.addEventListener('click', () => {
    if (confirm('确定要重置密码吗？这将清除旧的密码凭据，之后输入的新密码将成为管理密码。')) {
      authClear();
      const input = $('#adminLoginPassword');
      if (input) input.value = '';
      const hint = $('#adminLoginHint');
      if (hint) hint.textContent = '密码已重置，请输入新密码（首次输入将设为管理密码）。';
      showToast('密码已重置，请输入新密码');
    }
  });
}

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
        ? '请输入管理密码'
        : '首次输入密码将自动设为管理密码，请妥善记忆。';
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
    const thresholdInput = $('#lowStockThreshold');
    if (tokenInput) tokenInput.value = current.token;
    if (gistInput) gistInput.value = current.gistUrl;
    if (thresholdInput) thresholdInput.value = current.lowStockThreshold;
    renderSettings();
  }
}

function init() {
  state.items = storageRead();

  // 优先绑定登录表单，确保即使后续渲染函数出错也不会导致表单无法提交
  bindLoginForm();
  bindResetPasswordBtn();

  // 后台渲染（用 try/catch 保护，避免未登录时渲染隐藏面板出错中断 init）
  try {
    refreshFilters();
    renderCategoryDatalist();
    renderAdminList();
    renderDetail();
    renderSyncStatus();
  } catch (err) {
    console.error('后台渲染初始化出错（不影响登录）:', err);
  }

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

  $('#adminSettingsForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const token = $('#adminGithubToken').value.trim();
      const gistUrl = $('#adminGistUrl').value.trim();
      const oldPassword = $('#adminOldPassword').value || '';
      const newPassword = $('#adminPassword').value || '';
      const lowStockThreshold = Number($('#lowStockThreshold').value);
      const current = settingsRead();
      settingsWrite({
        ...current,
        token,
        gistUrl,
        lowStockThreshold: Number.isFinite(lowStockThreshold) ? Math.max(0, lowStockThreshold) : 5,
        lastSyncAt: readSettingsLastSync(),
      });

      if (newPassword) {
        const hasExisting = !!authReadPassword();
        if (hasExisting) {
          const verified = await authLogin(oldPassword);
          if (!verified) {
            showToast('当前密码验证失败，密码未修改', { duration: 4000 });
            showAdminPanel('settings');
            return;
          }
        }
        await authWritePassword(newPassword);
        showToast('管理密码已更新');
      } else {
        showToast('设置已保存');
      }
      $('#adminOldPassword').value = '';
      $('#adminPassword').value = '';
    } catch (error) {
      console.error('保存设置失败', error);
      showToast('保存失败：' + (error.message || '未知错误'), { duration: 6000 });
    }
    showAdminPanel('settings');
  });

  $('#adminSettingsResetBtn')?.addEventListener('click', () => {
    $('#adminGithubToken').value = '';
    $('#adminGistUrl').value = '';
    $('#adminOldPassword').value = '';
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
