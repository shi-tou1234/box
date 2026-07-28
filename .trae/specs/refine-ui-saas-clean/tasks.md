# Tasks

- [ ] Task 1: 调研参考并定义 Clean SaaS 设计系统
  - [ ] SubTask 1.1: 基于 PartBolt / Linear / Notion 风格，在 `styles/variables.css` 中定义新的颜色、字体、间距、阴影变量（浅色灰白底 + 白色卡片 + 靛蓝强调，深色 slate 底）
  - [ ] SubTask 1.2: 在 `styles/components.css` 中重写组件：卡片式列表 `.card-list/.card-item`、清爽按钮、精致输入框、表格、导航、对话框、Toast、登录卡片
  - [ ] SubTask 1.3: 所有 SVG 图标统一固定 16px，确保无 oversized 渲染

- [ ] Task 2: 重写前台查询页为卡片式布局
  - [ ] SubTask 2.1: 重写 `index.html`，采用顶部紧凑工具栏 + 左侧卡片列表 + 右侧详情面板，移除管理符号
  - [ ] SubTask 2.2: 调整 `src/front.js`，适配新 DOM 与 class 命名，保留只读查询与主题切换逻辑

- [ ] Task 3: 重写后台管理页为卡片式布局
  - [ ] SubTask 3.1: 重写 `admin/index.html`，采用顶部状态栏 + 左侧导航 + 卡片式主内容区
  - [ ] SubTask 3.2: 调整 `src/admin.js`，适配新 DOM，保留所有管理功能

- [ ] Task 4: Toast 自动消失与 Gist 反馈增强
  - [ ] SubTask 4.1: 修改 `src/front.js` 和 `src/admin.js` 的 `showToast`，默认 3 秒自动淡出移除，错误 Toast 停留 6 秒
  - [ ] SubTask 4.2: 在 `src/admin.js` 的 Gist 同步成功后，将 Gist URL 和当前时间写入 settings
  - [ ] SubTask 4.3: 在后台"同步"面板展示当前 Gist URL（可点击链接）和最后同步时间
  - [ ] SubTask 4.4: 在后台"设置"面板表单下方展示当前已保存的 Gist URL

- [ ] Task 5: 验证、清理临时文件并提交
  - [ ] SubTask 5.1: 启动本地服务器，浏览器验证前台搜索/筛选/详情/主题切换
  - [ ] SubTask 5.2: 浏览器验证后台登录/新增/编辑/删除/库存/同步/设置/Toast 自动消失
  - [ ] SubTask 5.3: 删除浏览器验证产生的临时截图/缓存文件（不删除 `.trae/specs`）
  - [ ] SubTask 5.4: 提交并推送至 `https://github.com/shi-tou1234/box`

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 3
- Task 5 depends on Task 2, Task 3, Task 4
