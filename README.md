# Toolbox TodoList

这是一个基于 Node.js 的全功能工具箱应用，提供了待办事项管理、习惯追踪、AI 助手、番茄钟等多种实用工具。

## 功能特性

- **待办事项 (Todo)**：高效管理您的日常任务。
- **习惯追踪 (Habit)**：帮助您养成良好的生活习惯。
- **AI 助手 (AI)**：集成 AI 功能，提供智能建议与辅助。
- **番茄钟 (Pomodoro)**：专注力管理工具，提升工作效率。
- **密码管理 (Password)**：安全存储和管理您的个人密码。
- **笔记工具 (Notes)**：随时记录灵感与重要信息。
- **决策辅助 (Decision)**：帮助您在犹豫不决时做出选择。
- **颜色工具 (Color)**：设计师必备的颜色提取与管理工具。
- **Jupyter 集成 (Jupyter)**：支持代码实验与文档记录。

## 技术栈

- **后端**: Node.js, Express, PostgreSQL (可选同步)
- **前端**: HTML, CSS, JavaScript
- **其他**: CORS, dotenv, helmet, JWT, bcryptjs, node-fetch

## 快速开始

### 1. 环境准备

确保您的系统中已安装 Node.js。

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境

在根目录创建 `.env` 文件并配置必要的环境变量：

```env
PORT=3000
CORS_ORIGIN=*
ZHIPU_API_KEY=
NVIDIA_API_KEY=

# 开启 PostgreSQL 同步时配置
DATABASE_URL=postgresql://app_user:strong_password@127.0.0.1:5432/todolist
DB_SSL=false

# 鉴权
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
PUBLIC_SIGNUP_ENABLED=false

# 可选：自动初始化管理员账号
ADMIN_BOOTSTRAP_USERNAME=admin
ADMIN_BOOTSTRAP_PASSWORD=change-me-please

# 必填：同步数据加密密钥（64位HEX或32字节base64）
SYNC_ENCRYPTION_KEY=replace-with-64-char-hex-or-base64-key
```

### 4. 运行应用

```bash
npm start
```

访问 `http://localhost:3000` 即可开始使用。

## 傻瓜式服务器部署

如果你是第一次部署，直接按这份文档一步步执行：

- `docs/deploy-beginner.md`

仓库中已准备好的部署配置模板：

- 生产环境变量模板：`.env.production.example`
- HTTPS Nginx 模板：`deploy/nginx/todolist-https.conf`
- Systemd 服务模板：`deploy/systemd/todolist-api.service`
- PM2 配置模板：`deploy/pm2/ecosystem.config.cjs`

## PostgreSQL 同步（推荐生产）

前端当前已接入统一同步层 `sync-client.js`，核心行为为：

- 本地缓存优先渲染（localStorage）。
- 所有核心工具（Todo/Habit/Notes/Jupyter）保存时双写：本地立即生效 + `/api/sync` 异步写库。
- 同步接口使用 Bearer Token 自动绑定用户，实现用户级隔离。
- 启动时自动执行冲突合并（Last-Write-Wins + 版本冲突回退）。
- 数据入库前使用 AES-256-GCM 加密，避免明文存储。

前端已在侧栏新增登录入口：

- 未登录时显示 `Login`。
- 登录后显示当前用户名。
- 点击用户名可退出当前账户。

独立管理页：

- 地址：`/admin.html`
- 功能：管理员登录、创建用户、角色切换、账户锁定、同步记录概览
- 权限：仅 `admin` 角色可访问管理接口（页面会进行角色校验）

完整数据库与冲突策略文档见：`docs/database-sync.md`。

### 1. 初始化数据库

先在 PostgreSQL 中创建数据库与用户，然后执行：

```bash
psql -U app_user -d todolist -f database/schema.sql
```

`database/schema.sql` 会创建 `app_users` 与 `app_sync_data_secure` 表。

### 2. 启动后端 API

```bash
npm start
```

可用接口：

- `GET /api/health`：检查服务与数据库状态。

鉴权接口：

- `POST /api/auth/register`：公开注册（仅当 `PUBLIC_SIGNUP_ENABLED=true`）
- `POST /api/auth/login`：登录获取访问令牌
- `GET /api/auth/me`：获取当前用户

同步接口（需 Bearer Token）：

- `GET /api/sync/:toolKey`
- `PUT /api/sync/:toolKey`（body: `{ "data": ..., "expectedVersion": 1 }`）
- `DELETE /api/sync/:toolKey?expectedVersion=1`

管理员接口（需 admin）：

- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id/role`
- `PATCH /api/admin/users/:id/lock`
- `GET /api/admin/sync/overview`

说明：如果未设置 `DATABASE_URL`，后端仍会启动，但同步接口会返回 `503`。

## Nginx 部署（个人服务器）

仓库内已提供模板：

- `deploy/nginx/todolist.conf`（基础 HTTP）
- `deploy/nginx/todolist-https.conf`（生产推荐，含 HTTPS）

### 1. 部署静态文件

将前端文件放到例如 `/var/www/todolist`。

### 2. 配置反向代理

复制模板到 Nginx 站点目录并修改域名：

```bash
sudo cp deploy/nginx/todolist.conf /etc/nginx/sites-available/todolist.conf
sudo ln -s /etc/nginx/sites-available/todolist.conf /etc/nginx/sites-enabled/todolist.conf
sudo nginx -t
sudo systemctl reload nginx
```

### 3. 进程守护

建议用 `systemd` 或 `pm2` 守护 Node 进程，避免服务中断。

## 项目结构

- `server.js`: 后端服务器入口。
- `index.html`: 前端界面。
- `admin.html`: 独立可视化管理页。
- `admin.js` & `admin.css`: 管理页脚本与样式。
- `style.css`: 样式文件。
- `sync-client.js`: 前端统一同步客户端（本地缓存 + API 双写）。
- `tools/`: 包含所有核心功能的逻辑实现。
- `toolbox-core.js` & `toolbox-config.js`: 项目核心配置与管理逻辑。
- `database/schema.sql`: PostgreSQL 建表脚本。
- `docs/database-sync.md`: 数据库结构、键映射、冲突策略文档。
- `docs/deploy-beginner.md`: 新手服务器部署手册（一步一步照做）。
- `.env.production.example`: 生产环境变量模板。
- `deploy/nginx/todolist.conf`: Nginx 站点配置模板。
- `deploy/nginx/todolist-https.conf`: Nginx HTTPS 模板。
- `deploy/systemd/todolist-api.service`: systemd 服务模板。
- `deploy/pm2/ecosystem.config.cjs`: PM2 进程守护模板。

## 许可证

本项目采用 ISC 许可证。
