import {
  state,
  $,
  $$,
  showToast,
  getFilteredItems,
  getUniqueValues,
  getStockStatus,
  formatLastSync,
  readSettingsLastSync,
  renderCategoryDatalist,
  renderPackageDatalist,
} from './admin-state.js';
import {
  storageWrite,
  settingsRead,
  coerceQuantity,
  generateId,
  nowIso,
  escapeHtml,
  safeUrl,
  getSortedItems,
  parseImportedText,
  summarizeChanges,
} from '../src/shared.js';

export function renderAdminList() {
  const listEl = $('#adminComponentList');
  const emptyEl = $('#adminListEmpty');
  const items = getFilteredItems();

  const summaryEl = $('#adminListSummary');
  if (summaryEl) {
    summaryEl.textContent = `共 ${items.length} 项 / 全部 ${state.items.length} 项`;
  }

  if (!items.length) {
    if (listEl) listEl.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');
  if (!listEl) return;

  listEl.innerHTML = items
    .map((item) => {
      const activeClass = item.id === state.selectedId ? 'is-active' : '';
      const statusClass = getStockStatus(item);
      const statusLabel = statusClass === 'in-stock' ? '有货' : statusClass === 'low-stock' ? '低库存' : '缺货';
      return `
        <button type="button" class="list__item ${activeClass}" data-id="${escapeHtml(item.id)}">
          <span class="status-dot status-dot--${statusClass}" title="${statusLabel}"></span>
          <span class="list__primary">
            <span class="list__name">${escapeHtml(item.name || '未命名')}</span>
            <span class="list__meta">${escapeHtml([item.category, item.model, item.package].filter(Boolean).join(' / ') || '暂无完整信息')}</span>
          </span>
          <span class="list__badges">
            <span class="badge badge--accent">${escapeHtml(item.category || '未分类')}</span>
            <span class="badge ${item.quantity <= 0 ? 'badge--danger' : 'badge--muted'}">${coerceQuantity(item.quantity)}</span>
          </span>
        </button>
      `;
    })
    .join('');

  $$('.list__item').forEach((node) => {
    node.addEventListener('click', () => selectItem(node.dataset.id));
  });
}

export function renderInventory() {
  const tbody = $('#inventoryBody');
  const emptyEl = $('#inventoryEmpty');
  if (!tbody) return;
  const threshold = Number.isFinite(settingsRead().lowStockThreshold) ? settingsRead().lowStockThreshold : 5;
  const items = getSortedItems(state.items, 'name', 'asc');

  if (!items.length) {
    tbody.innerHTML = '';
    emptyEl?.classList.remove('hidden');
    return;
  }

  emptyEl?.classList.add('hidden');
  tbody.innerHTML = items
    .map((item) => {
      const quantity = coerceQuantity(item.quantity);
      const isLow = quantity > 0 && quantity <= threshold;
      const statusText = quantity <= 0 ? '缺货' : isLow ? '低库存' : '正常';
      const statusClass = quantity <= 0 ? 'text-danger' : isLow ? 'text-warning' : 'text-muted';
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

export function renderSyncStatus() {
  const current = settingsRead();
  const statusEl = $('#syncStatusText');
  const timeEl = $('#syncLastTime');
  if (statusEl) {
    if (current.gistUrl) {
      const url = escapeHtml(current.gistUrl);
      statusEl.innerHTML = `当前 Gist：<a href="${url}" target="_blank">${url}</a>`;
    } else {
      statusEl.textContent = '未配置 Gist 地址';
    }
  }
  if (timeEl) {
    timeEl.textContent = formatLastSync(readSettingsLastSync());
  }
}

export function renderSettings() {
  const current = settingsRead();
  const currentGistEl = $('#settingsCurrentGist');
  if (!currentGistEl) return;
  if (current.gistUrl) {
    const url = escapeHtml(current.gistUrl);
    currentGistEl.innerHTML = `当前已保存的 Gist：<a href="${url}" target="_blank">${url}</a>`;
  } else {
    currentGistEl.textContent = '当前已保存的 Gist：未配置';
  }
}

export function renderDetail() {
  const detailEl = $('#detail');
  if (!detailEl) return;
  const item = state.items.find((entry) => entry.id === state.selectedId) || null;
  const titleEl = $('#detailTitle');
  const actionsEl = $('#detailActions');

  if (!item) {
    if (titleEl) titleEl.textContent = '选择一个元器件查看详情';
    if (actionsEl) actionsEl.hidden = true;
    detailEl.innerHTML = `
      <div class="empty">
        <div class="empty__title">未选择条目</div>
        <div class="empty__desc">从左侧列表选择一个元器件，即可查看详情与快速操作。</div>
      </div>
    `;
    return;
  }

  if (titleEl) titleEl.textContent = item.name || '未命名元器件';
  if (actionsEl) actionsEl.hidden = false;

  const createdAtText = item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '-';
  const updatedAtText = item.updatedAt ? new Date(item.updatedAt).toLocaleString('zh-CN') : '-';
  const safeDatasheet = safeUrl(item.datasheet);
  const datasheetHtml = safeDatasheet
    ? `<a class="link" href="${escapeHtml(safeDatasheet)}" target="_blank" rel="noopener noreferrer">打开数据手册</a><div class="field__hint mt-2">${escapeHtml(safeDatasheet)}</div>`
    : `<span class="text-muted">暂无</span>`;

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
    </div>
  `;

}

function bindDetailActions() {
  const editBtn = $('#editBtn');
  const copyBtn = $('#copyBtn');
  const quantityBtn = $('#quantityBtn');
  const deleteBtn = $('#detailDeleteBtn');

  editBtn?.addEventListener('click', () => {
    const item = state.items.find((entry) => entry.id === state.selectedId);
    if (!item) return;
    openForm(item);
  });
  copyBtn?.addEventListener('click', () => {
    const item = state.items.find((entry) => entry.id === state.selectedId);
    if (!item) return;
    duplicateItem(item);
  });
  quantityBtn?.addEventListener('click', () => {
    const item = state.items.find((entry) => entry.id === state.selectedId);
    if (!item) return;
    openQuantityDialog(item);
  });
  deleteBtn?.addEventListener('click', () => {
    const item = state.items.find((entry) => entry.id === state.selectedId);
    if (!item) return;
    deleteItem(item.id);
  });
}

bindDetailActions();

export function selectItem(id) {
  state.selectedId = id;
  renderAdminList();
  renderDetail();
}

export function upsertItem(payload) {
  const existing = state.items.find((item) => item.id === payload.id) || null;
  const next = {
    ...payload,
    id: payload.id || generateId(),
    quantity: coerceQuantity(payload.quantity),
    createdAt: existing ? existing.createdAt : nowIso(),
    updatedAt: nowIso(),
  };

  state.items = state.items.filter((item) => item.id !== next.id);
  state.items.push(next);
  storageWrite(state.items);
  refreshFilters();
  renderCategoryDatalist();
  renderPackageDatalist(next.category);
  renderAdminList();
  if (state.selectedId === next.id) {
    renderDetail();
  }
}

export function deleteItem(id) {
  if (!confirm('确定要删除这条元器件记录吗？')) {
    return;
  }
  state.items = state.items.filter((item) => item.id !== id);
  if (state.selectedId === id) {
    state.selectedId = null;
  }
  storageWrite(state.items);
  refreshFilters();
  renderAdminList();
  renderDetail();
  showToast('已删除');
}

export function duplicateItem(item) {
  if (!item) return;
  const clone = {
    ...item,
    id: undefined,
    name: `${item.name || '元器件'}（复制）`,
    quantity: 0,
    createdAt: undefined,
    updatedAt: undefined,
  };
  upsertItem(clone);
  showToast('已复制并新增副本');
}

export function resetForm(item = null) {
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

export function readForm() {
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

function markFieldInvalid(inputId, errorId, message) {
  const input = $(`#${inputId}`);
  const errorEl = $(`#${errorId}`);
  if (input) {
    input.classList.add('is-invalid');
    input.addEventListener('input', () => {
      input.classList.remove('is-invalid');
      if (errorEl) errorEl.hidden = true;
    }, { once: true });
    input.focus();
  }
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
}

export function clearFormValidation() {
  ['formName', 'formCategory'].forEach((id) => {
    const input = $(`#${id}`);
    if (input) input.classList.remove('is-invalid');
  });
  ['formNameError', 'formCategoryError', 'quantityValueError'].forEach((id) => {
    const errorEl = $(`#${id}`);
    if (errorEl) errorEl.hidden = true;
  });
  const quantityInput = $('#quantityValue');
  if (quantityInput) quantityInput.classList.remove('is-invalid');
}

export function validateForm(payload) {
  clearFormValidation();
  if (!payload.name) {
    markFieldInvalid('formName', 'formNameError', '请填写名称');
    throw new Error('请填写名称');
  }
  if (!payload.category) {
    markFieldInvalid('formCategory', 'formCategoryError', '请填写种类');
    throw new Error('请填写种类');
  }
}

export function openForm(item = null) {
  const dialog = $('#formDialog');
  $('#formDialogTitle').textContent = item ? '编辑元器件' : '新增元器件';
  resetForm(item);
  clearFormValidation();
  renderCategoryDatalist();
  renderPackageDatalist(item ? item.category : '');
  dialog.showModal();
}

export function closeForm() {
  $('#formDialog').close();
}

export function submitForm(event) {
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

export function openQuantityDialog(item) {
  if (!item) return;
  $('#quantityId').value = item.id;
  $('#quantityMode').value = 'increase';
  $('#quantityValue').value = '1';
  clearFormValidation();
  $('#quantityDialog').showModal();
}

export function closeQuantityDialog() {
  $('#quantityDialog').close();
}

export function submitQuantity(event) {
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
    markFieldInvalid('quantityValue', 'quantityValueError', '数量必须大于 0');
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
  storageWrite(state.items);
  refreshFilters();
  renderAdminList();
  renderDetail();
  renderInventory();
  closeQuantityDialog();
  showToast('数量已更新');
}

export function exportJson() {
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

export function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const remoteItems = parseImportedText(reader.result);
      const summary = summarizeChanges(state.items, remoteItems);
      if (!confirm(`将导入 ${summary.totalTarget} 条记录，其中新增 ${summary.added} 条、删除 ${summary.removed} 条，是否继续？`)) {
        showToast('已取消导入');
        return;
      }
      state.items = remoteItems;
      storageWrite(state.items);
      refreshFilters();
      renderAdminList();
      renderDetail();
      renderInventory();
      showToast('导入成功');
    } catch (error) {
      console.error(error);
      showToast(error.message || '导入失败');
    }
  };
  reader.readAsText(file);
}
