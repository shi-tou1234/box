# 修复本地代码 Bug Spec

## Why
项目当前存在多个致命级别的 bug,导致核心功能完全无法使用:
- **Gist 同步功能完全失效**:`admin-sync.js` 中 `syncFromGist`/`syncToGist` 调用了 7 个未导入的函数(`summarizeChanges`、`settingsWrite`、`nowIso`、`refreshFilters`、`renderAdminList`、`renderDetail`、`renderInventory`),一旦点击同步按钮就会抛出 ReferenceError。
- **库存批量操作完全失效**:`admin.js` 中"批量清零"和"批量删除"按钮调用了未导入的 `getSelectedInventoryIds` 和 `nowIso`,点击即报错。
- **详情面板按钮累积重复事件监听器**:`admin-render.js` 中 `renderDetail` 每次调用都为 `#editBtn`/`#copyBtn`/`#quantityBtn`/`#detailDeleteBtn` 累加监听器,选择 N 个元器件后点击一次按钮会触发 N 次动作。
- **离线缓存失效**:`sw.js` 对 HTML/JS 请求无网络失败 fallback,Service Worker 安装后离线访问仍失败,install 阶段缓存的 HTML 永远不被使用。
- **低库存阈值判断不一致**:`renderInventory` 缺少 fallback,设置缺失时 NaN 比较导致低库存条目被错误标记。

此外还存在大量未使用的 import(死代码)、永远返回 `[]` 的 `getUsedPackages` 死函数等清理项。

## What Changes
- **修复 admin-sync.js 的 import**:补充 `summarizeChanges`、`settingsWrite`、`nowIso`(从 shared.js)、`refreshFilters`(从 admin-state.js)、`renderAdminList`、`renderDetail`、`renderInventory`(从 admin-render.js);移除未使用的 `$$`、`applyAdminPanelVisibility`、`applyLoginVisibility`、`storageRead`。
- **修复 admin.js 的 import**:补充 `getSelectedInventoryIds`(从 admin-state.js)、`nowIso`(从 shared.js);移除未使用的 `selectItem`、`upsertItem`、`deleteItem`、`duplicateItem`、`openQuantityDialog`、`renderInventory`、`setSyncLoading`。
- **修复 admin-render.js 的事件监听累积**:将 `#editBtn`、`#copyBtn`、`#quantityBtn`、`#detailDeleteBtn` 的事件绑定移出 `renderDetail`,改为在 init 阶段绑定一次,通过 `state.selectedId` 获取当前 item。
- **修复 admin-render.js 阈值 fallback**:统一使用 `Number.isFinite(threshold) ? threshold : 5`,避免 `||` 对 0 的副作用,并修复 `getStockStatus` 中相同问题。
- **修复 sw.js 离线策略**:HTML/JS 请求改为 network-first 带缓存 fallback(`fetch(request).catch(() => caches.match(request))`);静态资源 SWR 在无缓存且 fetch 失败时返回 `Response.error()` 而非 undefined。
- **清理死代码**:移除 admin-sync.js 中 `findGistFile` 的死逻辑分支;删除 shared.js 中永远返回 `[]` 且无人调用的 `getUsedPackages`;清理 admin-render.js、admin-state.js、admin.js 中其它未使用的 import。
- **修复 front.js 一致性问题**:`renderList` 中 badge class 判断统一使用 `coerceQuantity(item.quantity)`。

## Impact
- 受影响能力:Gist 同步(上传/恢复)、库存批量管理(清零/删除)、元器件详情操作(编辑/复制/调整数量/删除)、离线访问、低库存状态显示。
- 受影响文件:
  - `src/admin-sync.js`(高优先级)
  - `src/admin.js`(高优先级)
  - `src/admin-render.js`(中高优先级)
  - `src/admin-state.js`(清理)
  - `src/shared.js`(清理)
  - `src/front.js`(低优先级)
  - `sw.js`(中优先级)
- 不受影响:`index.html`、`admin/index.html`、CSS 文件、本地存储数据格式、业务逻辑(仅修复 import 和事件绑定,不改业务规则)。
- **BREAKING**:无。所有修复都是让原本应工作的功能真正工作,不改变对外接口。

## ADDED Requirements
### Requirement: 模块导入完整性
The system SHALL ensure all functions called within a module are properly imported, preventing ReferenceError at runtime.

#### Scenario: Gist 同步
- **WHEN** 用户在管理后台"同步"面板点击"上传到 Gist"或"从 Gist 恢复"
- **THEN** 同步流程正常执行,不再因未导入函数抛出 ReferenceError

#### Scenario: 库存批量操作
- **WHEN** 用户在"库存"面板选中条目后点击"批量清零"或"批量删除"
- **THEN** 操作正常执行,不再因未导入 `getSelectedInventoryIds` 或 `nowIso` 报错

### Requirement: 详情面板事件单次触发
The system SHALL bind action button events exactly once, regardless of how many times `renderDetail` is called.

#### Scenario: 多次选择元器件后点击操作按钮
- **WHEN** 用户依次选择元器件 A、B、C,然后点击"编辑"
- **THEN** 仅弹出一次编辑对话框(包含元器件 C 的数据),不会弹出三次

### Requirement: 离线访问可用
The system SHALL serve cached HTML and JS when the network is unavailable, making the application usable offline after the first visit.

#### Scenario: 离线访问前台
- **WHEN** 用户在已访问过应用后断网,再次打开前台或后台
- **THEN** 页面从缓存加载并可用,而非显示浏览器离线错误

### Requirement: 低库存阈值判断一致
The system SHALL apply a consistent fallback for the low-stock threshold across all rendering paths, treating `0` as a valid threshold value.

#### Scenario: 阈值缺失
- **WHEN** localStorage 中的 settings 缺少 `lowStockThreshold` 字段
- **THEN** 所有渲染路径统一回退到默认值 5

#### Scenario: 阈值为 0
- **WHEN** 用户将低库存阈值设置为 0
- **THEN** 仅 quantity <= 0 的条目被标记为低库存,不会被错误地用 5 作为阈值

## MODIFIED Requirements
### Requirement: 代码整洁度
The codebase SHALL not contain dead code, unused imports, or functions that always return a constant value without using their parameters.

#### Scenario: 代码审查
- **WHEN** 开发者审查 `admin-sync.js`、`admin.js`、`admin-render.js`、`admin-state.js`、`shared.js`
- **THEN** 不存在未使用的 import、不存在永远返回常量的死函数、不存在无意义的条件分支

## REMOVED Requirements
### Requirement: `getUsedPackages` 函数
**Reason**: 该函数实现为空(永远返回 `[]`),且参数 `key` 计算后从未使用,全局无任何调用方。属于遗留的占位代码。
**Migration**: 直接删除。若未来需要"按种类列出已使用封装"的功能,应基于 `state.items` 重新实现,不复用此空壳。
