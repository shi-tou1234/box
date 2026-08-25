# BENCH-01 · 焊接元器件查询/管理工具

本地优先（Local-First）的焊接元器件库存查询与管理工具，纯静态前端，无需后端，适配 GitHub Pages 部署。前台只读查询，管理后台独立路由，登录后才能维护数据。

## 功能特性

### 前台查询页（`/`）
- 关键字搜索（名称、封装、位置、备注）
- 按种类筛选 + 网格 / 表格双视图
- 仪表盘统计卡片：元器件种类、近期变动
- 分类分布条形图、封装类型占比环形图
- 点击条目查看详情弹窗，支持数据手册链接跳转
- 明暗主题切换，跟随系统偏好
- 移动端底部导航

## 数据存储

- 元器件数据：`localStorage` 键名 `solder_pm.components.v1`
- 应用设置：`localStorage` 键名 `solder_pm.settings.v1`
- 鉴权状态：`sessionStorage` 键名 `solder_pm.admin_ok`
- 数据格式：JSON 数组，字段包含 `name / category / package / location / datasheet / notes / createdAt / updatedAt`

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

> 注意：ES Modules 需通过 HTTP 访问，部分浏览器不允许 `file://` 协议直接打开。

## 使用流程

1. 打开前台 `/` 查询元器件
2. 首次进入 `/admin/` 时设置管理密码（密码仅存本地）
3. 在管理后台「元器件」标签新增、编辑或导入数据
4. 在「同步」标签配置 GitHub Token 和 Gist 地址，实现跨设备备份
5. 在「设置」标签维护管理密码

## 技术栈

- 原生 HTML / CSS / JavaScript（ES Modules）
- `<dialog>` 元素实现弹窗
- `localStorage` / `sessionStorage` 本地存储
- GitHub Gist API 远程同步（带超时与错误提示）

## 字段说明

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| name | string | 名称（必填） |
| category | string | 种类（必填，支持电阻、电容、MCU 等） |
| package | string | 封装（0805、SOT-23 等） |
| location | string | 位置/库位 |
| datasheet | string | 数据手册链接 |
| notes | string | 备注 |
| createdAt | ISO string | 创建时间 |
| updatedAt | ISO string | 更新时间 |

## License

MIT
