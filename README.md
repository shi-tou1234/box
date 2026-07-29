# BENCH-01 · 焊接元器件查询/管理工具

本地优先（Local-First）的焊接元器件库存查询与管理工具，纯静态前端，无需后端，适配 GitHub Pages 部署。前台只读查询，管理后台独立路由，登录后才能维护数据。

## 功能特性

### 前台查询页（`/`）
- 关键字搜索（按名称、型号）
- 种类 / 封装 / 库存状态多级筛选
- 仪表盘统计卡片：总元件数、总库存、低库存提醒、缺货计数
- 分类分布条形图
- 库存状态圆点指示器（绿/黄/红）
- 列表 + 详情双栏布局，详情面板带面包屑导航
- 数据手册链接快速跳转
- 明暗主题切换，跟随系统偏好
- 移动端底部导航

### 管理后台（`/admin/`）
- 密码登录校验（密码仅存于当前浏览器）
- 元器件管理：新增 / 编辑 / 复制 / 删除
- 库存管理：批量清零、批量删除、低库存提醒
- 导入导出：JSON 全量备份，导入前差异比对
- Gist 同步：通过 GitHub Gist 备份与恢复
- 系统设置：Token、Gist 地址、管理密码、低库存阈值

## 目录结构

```
.
├── index.html              # 前台查询页
├── admin/
│   └── index.html          # 管理后台页
├── src/
│   ├── shared.js           # 共享逻辑（存储、设置、鉴权、分类映射）
│   ├── front.js            # 前台查询逻辑
│   └── admin.js            # 后台管理逻辑
├── styles/
│   ├── variables.css       # CSS 变量（配色、间距、圆角）
│   └── components.css      # 组件样式
├── sw.js                   # Service Worker（离线缓存）
└── README.md
```

## 数据存储

- 元器件数据：`localStorage` 键名 `solder_pm.components.v1`
- 应用设置：`localStorage` 键名 `solder_pm.settings.v1`
- 鉴权状态：`sessionStorage` 键名 `solder_pm.admin_ok`
- 数据格式：JSON 数组，字段包含 `name / category / model / package / quantity / location / datasheet / notes / createdAt / updatedAt`

数据仅保存在本地浏览器，不会上传到任何第三方服务（Gist 同步需自行配置 Token）。

## 部署

### GitHub Pages
1. 将仓库推送到 GitHub
2. 仓库 Settings → Pages → Source 选择 `main` 分支根目录
3. 访问 `https://<用户名>.github.io/<仓库名>/` 打开前台
4. 访问 `https://<用户名>.github.io/<仓库名>/admin/` 进入管理后台

### 本地预览
直接用浏览器打开 `index.html` 即可，或启动任意静态服务器：

```bash
npx serve .
# 或
python -m http.server 8000
```

## 使用流程

1. 打开前台 `/` 查询元器件
2. 首次进入 `/admin/` 时设置管理密码（密码仅存本地）
3. 在管理后台「元器件」标签新增、编辑或导入数据
4. 在「库存」标签批量管理数量与状态
5. 在「同步」标签配置 GitHub Token 和 Gist 地址，实现跨设备备份
6. 在「设置」标签调整低库存阈值等参数

## 技术栈

- 原生 HTML / CSS / JavaScript（ES Modules）
- `<dialog>` 元素实现弹窗
- `localStorage` / `sessionStorage` 本地存储
- GitHub Gist API 远程同步
- Service Worker 离线缓存

## 字段说明

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| name | string | 名称（必填） |
| category | string | 种类（必填，支持电阻、电容、MCU 等） |
| model | string | 型号 |
| package | string | 封装（0805、SOT-23 等） |
| quantity | number | 数量（非负整数） |
| location | string | 位置/库位 |
| datasheet | string | 数据手册链接 |
| notes | string | 备注 |
| createdAt | ISO string | 创建时间 |
| updatedAt | ISO string | 更新时间 |

## License

MIT
