# Tasks

- [ ] Task 1: 建立 Industrial Workbench 设计系统
  - [ ] SubTask 1.1: 重写 `styles/variables.css`，定义明暗主题颜色、字体、间距、圆角、阴影
  - [ ] SubTask 1.2: 重写 `styles/components.css`，实现按钮、输入框、表格、列表、卡片、标签、对话框、登录卡片、布局骨架等基础组件
  - [ ] SubTask 1.3: 为所有 SVG 图标添加固定尺寸约束，防止 oversized 渲染

- [ ] Task 2: 重写前台查询页结构
  - [ ] SubTask 2.1: 重写 `index.html`，采用顶部紧凑工具栏 + 全宽列表/详情双栏布局，移除管理相关符号与弹窗
  - [ ] SubTask 2.2: 调整 `src/front.js`，适配新的 DOM 结构与 class 命名，保留只读查询逻辑

- [ ] Task 3: 重写后台管理页结构
  - [ ] SubTask 3.1: 重写 `admin/index.html`，采用顶部状态栏 + 左侧导航 + 最大化主内容区布局
  - [ ] SubTask 3.2: 调整 `src/admin.js`，适配新的 DOM 结构与 class 命名，保留登录/增删改/库存/导入导出/同步/设置逻辑

- [ ] Task 4: 验证与提交
  - [ ] SubTask 4.1: 启动本地服务器，用浏览器验证前台搜索/筛选/详情/主题切换
  - [ ] SubTask 4.2: 用浏览器验证后台登录/新增/编辑/删除/库存/同步/设置，确认无 oversized icon
  - [ ] SubTask 4.3: 验证移动端布局无严重错位
  - [ ] SubTask 4.4: 提交并推送至 `https://github.com/shi-tou1234/box`

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2 and Task 3
