# 验证清单

## 致命 Bug 修复验证
- [x] admin-sync.js 已补充 `summarizeChanges`、`settingsWrite`、`nowIso`、`refreshFilters`、`renderAdminList`、`renderDetail`、`renderInventory` 的 import
- [x] 点击"上传到 Gist"不再抛出 ReferenceError(import 已补全,代码级验证)
- [x] 点击"从 Gist 恢复"不再抛出 ReferenceError(import 已补全,代码级验证)
- [x] admin.js 已补充 `getSelectedInventoryIds` 和 `nowIso` 的 import
- [x] 库存"批量清零"按钮点击后能将选中条目数量置 0 并更新 updatedAt(代码级验证)
- [x] 库存"批量删除"按钮点击后能删除选中条目并刷新列表(代码级验证)

## 事件监听累积验证
- [x] admin-render.js 中 `renderDetail` 函数体内不再出现对 `#editBtn`/`#copyBtn`/`#quantityBtn`/`#detailDeleteBtn` 的 `addEventListener` 调用
- [x] 四个详情操作按钮的 click 监听器在 `bindDetailActions()` 中仅绑定一次(模块顶层调用)
- [x] 依次选择元器件 A、B、C 后点击"编辑",仅弹出一次对话框(代码级验证,监听器不再累积)

## 低库存阈值一致性验证
- [x] `renderInventory` 中 threshold 使用 `Number.isFinite(...) ? ... : 5`,不再出现 `|| 5`
- [x] `getStockStatus`(admin-state.js)中 threshold 使用 `Number.isFinite(...) ? ... : 5`
- [x] `front.js` 中 `getLowStockCount`、`getStockStatus`、stat-card hint 三处阈值处理统一
- [x] 阈值设为 0 时,仅 quantity <= 0 的条目被标记为低库存(代码级验证,0 不再被回退为 5)

## 离线缓存验证
- [x] sw.js 中 HTML 请求使用 network-first 带缓存 fallback(`fetch(request).catch(() => caches.match(request))`)
- [x] sw.js 中 JS 请求使用 network-first 带缓存 fallback
- [x] sw.js 中静态资源 SWR 在无缓存且 fetch 失败时返回 `Response.error()`(非 undefined)
- [x] install 阶段缓存的 HTML 现在会被 fetch fallback 读取使用(代码级验证)

## 死代码清理验证
- [x] admin-sync.js 不再 import `$$`、`applyAdminPanelVisibility`、`applyLoginVisibility`、`storageRead`
- [x] admin-sync.js 中 `findGistFile` 不再有无意义的 `truncated` 死分支
- [x] admin.js 不再 import `selectItem`、`upsertItem`、`deleteItem`、`duplicateItem`、`openQuantityDialog`、`setSyncLoading`(`renderInventory` 保留因实际被调用)
- [x] admin-render.js 不再 import `getSelectedInventoryIds`、`applyAdminPanelVisibility`、`applyLoginVisibility`、`storageRead`、`settingsWrite`
- [x] admin-state.js 顶部 import 不再包含 10 个未使用标识符(re-export 语句保留)
- [x] shared.js 中 `getUsedPackages` 函数已删除(grep 确认无匹配)

## front.js 一致性验证
- [x] `renderList` 中 badge class 判断使用 `coerceQuantity(item.quantity) <= 0`

## Git 提交验证
- [x] 修复已提交到本地 main 分支,commit message 清晰描述修复内容
- [x] 修复已推送到 `https://github.com/shi-tou1234/box`
