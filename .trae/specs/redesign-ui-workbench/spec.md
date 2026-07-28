# UI 全面重构：工业工作台风格 Spec

## Why
当前前台与后台界面存在以下可用性问题：后台顶部 SVG 图标因缺少尺寸约束被浏览器按默认尺寸渲染，占据整个视口；前台查询页留白过多，列表与详情区域狭小，信息密度低；整体视觉风格零散、组件不成体系。需要一次统一、高信息密度的 UI 重写。

## What Changes
- 采用 **Industrial Workbench（工业工作台）** 美学方向：深色仪器面板 + 琥珀/橙色强调 + 紧凑网格 + 等宽数据字体。
- 重写 `styles/variables.css` 与 `styles/components.css`，建立统一设计系统（颜色、字体、间距、组件、布局骨架）。
- 重写 `index.html` 前台结构：顶部紧凑工具栏，下方为全宽列表与可折叠详情面板，消除无效留白。
- 重写 `admin/index.html` 后台结构：顶部紧凑状态栏，左侧垂直导航，主内容区最大化，修复 SVG 图标尺寸约束。
- 调整 `src/front.js` 与 `src/admin.js` 以适配新的 DOM 结构与 class 命名。
- 保留所有现有业务逻辑与本地存储数据结构，仅改动表现层。

## Impact
- 受影响能力：前台查询、后台管理、主题切换、移动端适配。
- 受影响文件：`index.html`、`admin/index.html`、`styles/variables.css`、`styles/components.css`、`src/front.js`、`src/admin.js`。
- 不受影响：`src/shared.js`、`sw.js`、本地存储键名与数据格式。

## ADDED Requirements
### Requirement: 视觉设计系统
The system SHALL provide a cohesive Industrial Workbench visual system with CSS variables for color, typography, spacing, radius, and shadows.

#### Scenario: 主题切换
- **WHEN** 用户点击主题切换按钮
- **THEN** 页面在明暗两套工业风格主题间切换，且所有组件颜色同步变化

### Requirement: 前台高空间利用率
The system SHALL present the query interface as a compact, full-width data grid with a collapsible detail panel and minimal empty space.

#### Scenario: 选择元器件
- **WHEN** 用户在列表中点击某个元器件
- **THEN** 右侧（或底部，移动端）详情面板展开并显示完整字段，无需跳转页面

#### Scenario: 筛选与搜索
- **WHEN** 用户在搜索框输入关键字或更改筛选条件
- **THEN** 列表实时过滤并显示匹配结果数量

### Requirement: 后台图标尺寸约束
The system SHALL constrain all SVG icons in the admin header and navigation to a fixed small size, preventing oversized rendering.

#### Scenario: 加载后台页面
- **WHEN** 用户访问 `/admin/`
- **THEN** 顶部 logo 与导航图标均显示为 20px–24px 的常规尺寸

## MODIFIED Requirements
### Requirement: 后台布局
The admin interface SHALL use a top status bar + left sidebar + maximized main area layout instead of the current scattered panel structure.

#### Scenario: 登录前
- **WHEN** 用户未登录
- **THEN** 仅显示居中登录卡片，侧边栏与主内容区隐藏

#### Scenario: 登录后
- **WHEN** 用户登录成功
- **THEN** 显示侧边栏导航与所选功能面板，主内容区占满剩余空间

## REMOVED Requirements
### Requirement: 前台管理按钮与弹窗
**Reason**: 用户已明确要求前台不出现管理相关符号，管理功能全部放在 `/admin/`。
**Migration**: 新增/编辑/导入/导出/同步/设置功能已通过 `/admin/` 提供，前台不再保留这些入口。
