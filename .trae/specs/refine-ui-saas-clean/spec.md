# UI 精修：SaaS 清爽风格 + Toast 与 Gist 反馈优化 Spec

## Why
用户对当前 Industrial Workbench 风格仍不满意，认为"AI 感重"、"丑"；同时发现弹窗/Toast 不会自动消失，Gist 同步后用户找不到备份位置。需要参考真实电子元器件管理产品（如 PartBolt）的简洁 SaaS 风格，重新打磨表现层，并完善反馈机制。

## 参考来源
- PartBolt (https://partbolt.com/)：电子元器件库存管理 SaaS，采用卡片式列表、浅色干净背景、清晰的型号/库存/封装信息层级。
- 通用现代数据管理 UI（Linear / Notion）：柔和阴影、细边框、小圆角、高可读性字体层级、16px 图标。

## What Changes
- 从 Industrial Workbench 调整为 **Clean SaaS / Workbench Hybrid** 风格：保留紧凑信息密度，但使用更柔和的配色、白色卡片、细边框、靛蓝/蓝色强调色。
- 重写 `styles/variables.css` 与 `styles/components.css`：
  - 浅色主题改为干净的灰白底色 + 白色卡片 + 细边框
  - 深色主题改为深 slate 背景 + 稍亮的卡片
  - 强调色从琥珀橙改为靛蓝/蓝色系，更贴近现代 SaaS
  - 卡片式列表 `.card-list`、卡片项 `.card-item`、卡片元信息 `.card-meta`
  - 图标固定 16px，按钮更精致
- 重写 `index.html`：前台改为卡片式列表 + 右侧详情，更清爽。
- 重写 `admin/index.html`：后台各面板采用卡片式布局，登录卡片更简洁。
- 调整 `src/front.js` 与 `src/admin.js`：
  - `showToast` 增加 `duration` 参数，默认 3 秒后自动移除；错误类 Toast 可停留更久。
  - 同步成功后把当前 Gist URL 写入 settings，并在"同步"面板顶部清晰展示"当前 Gist：URL"和"最后同步时间"。
  - 在"设置"面板也展示当前已保存的 Gist URL。
- 删除本地临时文件：浏览器验证产生的截图、缓存等临时文件（不删除 `.trae/specs` 中的 spec 文档）。

## Impact
- 受影响能力：前台查询、后台管理、主题切换、Toast 反馈、Gist 同步反馈。
- 受影响文件：`styles/variables.css`、`styles/components.css`、`index.html`、`admin/index.html`、`src/front.js`、`src/admin.js`。
- 不受影响：`src/shared.js`、`sw.js`、本地存储键名与数据格式。

## ADDED Requirements
### Requirement: Toast 自动消失
The system SHALL automatically dismiss Toast messages after a configurable duration, unless the message is an error that should remain visible longer.

#### Scenario: 保存成功
- **WHEN** 用户保存设置或新增元器件
- **THEN** 页面顶部出现 Toast，3 秒后自动淡出并移除

#### Scenario: 同步失败
- **WHEN** Gist 同步失败
- **THEN** 出现错误 Toast，默认停留 6 秒或直到用户手动关闭

### Requirement: Gist 存储位置可视化
The system SHALL display the current Gist URL and last sync time in the sync panel and settings panel after a successful sync.

#### Scenario: 首次同步成功
- **WHEN** 用户点击"上传到 Gist"并同步成功
- **THEN** 同步面板显示"当前 Gist：https://gist.github.com/..."和"最后同步：刚刚"

#### Scenario: 查看设置
- **WHEN** 用户打开设置面板
- **THEN** 已保存的 Gist 地址以只读链接形式展示在表单下方

## MODIFIED Requirements
### Requirement: 视觉风格
The interface SHALL use a clean SaaS aesthetic with card-based lists, soft shadows, subtle borders, and an indigo/blue accent color instead of the current industrial amber theme.

#### Scenario: 前台列表
- **WHEN** 用户打开前台
- **THEN** 看到白色卡片式列表，每张卡片显示型号、名称、种类、封装、库存，信息层级清晰

#### Scenario: 后台面板
- **WHEN** 用户登录后台
- **THEN** 各功能面板使用卡片式布局，按钮和表格更精致，无 oversized 图标

## REMOVED Requirements
### Requirement: Industrial Workbench 主题
**Reason**: 用户反馈该风格 AI 感重、不够美观，希望更清爽的 SaaS 风格。
**Migration**: 用 Clean SaaS 风格替换变量和组件，业务逻辑保持不变。
