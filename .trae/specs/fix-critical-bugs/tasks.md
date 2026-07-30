# Tasks

- [x] Task 1: 修复 admin-sync.js 致命 import 缺失
  - [x] SubTask 1.1: 在 admin-sync.js 顶部 import 语句中,从 `shared.js` 补充导入 `summarizeChanges`、`settingsWrite`、`nowIso`
  - [x] SubTask 1.2: 从 `admin-state.js` 补充导入 `refreshFilters`
  - [x] SubTask 1.3: 从 `admin-render.js` 补充导入 `renderAdminList`、`renderDetail`、`renderInventory`
  - [x] SubTask 1.4: 移除未使用的 import:`$$`、`applyAdminPanelVisibility`、`applyLoginVisibility`、`storageRead`
  - [x] SubTask 1.5: 简化 `findGistFile` 的死逻辑分支(移除无效的 `truncated` 判断)

- [x] Task 2: 修复 admin.js 致命 import 缺失
  - [x] SubTask 2.1: 从 `admin-state.js` 补充导入 `getSelectedInventoryIds`
  - [x] SubTask 2.2: 从 `shared.js` 补充导入 `nowIso`
  - [x] SubTask 2.3: 移除未使用的 import:`selectItem`、`upsertItem`、`deleteItem`、`duplicateItem`、`openQuantityDialog`、`setSyncLoading`(注:`renderInventory` 实际被调用,已保留)

- [x] Task 3: 修复 admin-render.js 事件监听累积 bug
  - [x] SubTask 3.1: 将 `#editBtn`、`#copyBtn`、`#quantityBtn`、`#detailDeleteBtn` 的事件绑定逻辑从 `renderDetail` 中移除
  - [x] SubTask 3.2: 新增 `bindDetailActions()` 函数在模块顶层调用,为四个按钮绑定一次性 click 监听器,通过 `state.selectedId` 获取当前 item
  - [x] SubTask 3.3: `renderDetail` 仅负责更新 DOM 文本/可见性,不再 `addEventListener`
  - [x] SubTask 3.4: 移除未使用的 import:`getSelectedInventoryIds`、`applyAdminPanelVisibility`、`applyLoginVisibility`、`storageRead`、`settingsWrite`

- [x] Task 4: 修复低库存阈值 fallback 不一致
  - [x] SubTask 4.1: `admin-render.js` 的 `renderInventory` 中 threshold 改为 `Number.isFinite(...) ? ... : 5`
  - [x] SubTask 4.2: `admin-state.js` 的 `getStockStatus` 中 threshold 改为 `Number.isFinite(...) ? ... : 5`
  - [x] SubTask 4.3: `front.js` 中 `getLowStockCount`、`getStockStatus`、stat-card hint 三处 `|| 5` 统一修复

- [x] Task 5: 修复 sw.js 离线策略
  - [x] SubTask 5.1: HTML 请求改为 network-first 带缓存 fallback
  - [x] SubTask 5.2: JS 请求改为 network-first 带缓存 fallback
  - [x] SubTask 5.3: 静态资源 SWR 在无缓存且 fetch 失败时返回 `Response.error()`

- [x] Task 6: 清理 shared.js 和 admin-state.js 死代码
  - [x] SubTask 6.1: 删除 `shared.js` 中 `getUsedPackages` 函数
  - [x] SubTask 6.2: 清理 `admin-state.js` 顶部 10 个未使用 import(re-export 保留)

- [x] Task 7: 修复 front.js 一致性问题
  - [x] SubTask 7.1: `renderList` 中 badge class 判断使用 `coerceQuantity(item.quantity) <= 0`
  - [x] SubTask 7.2: 统一 `|| 5` 为 `Number.isFinite` 判断

- [x] Task 8: 验证并提交 git
  - [x] SubTask 8.1: 代码级验证前台修改(renderList coerce、阈值一致)
  - [x] SubTask 8.2: 代码级验证后台 renderDetail 不再累积事件监听(grep 确认)
  - [x] SubTask 8.3: 代码级验证 admin.js 的 renderInventory import 已保留
  - [x] SubTask 8.4: 代码级验证 admin-sync.js 的 7 个缺失 import 已补充
  - [x] SubTask 8.5: 代码级验证 sw.js 所有 fetch 均有 catch fallback
  - [x] SubTask 8.6: 提交修复并推送到 `https://github.com/shi-tou1234/box`

# Task Dependencies
- Task 1、Task 2、Task 3、Task 4、Task 5、Task 6、Task 7 之间无依赖,可并行执行
- Task 8 依赖 Task 1-7 全部完成
