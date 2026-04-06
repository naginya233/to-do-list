# 服务器部署傻瓜式教程（Ubuntu + Nginx + PostgreSQL）

这份教程按顺序执行，尽量不需要你懂运维。

## 0. 准备信息（先改这 3 项）

把下面 3 个占位符记住，后面整篇都会用到：

- `YOUR_DOMAIN`：你的域名（例如 `todo.example.com`）
- `DB_PASSWORD`：数据库用户密码（自己定一个强密码）
- `ADMIN_PASSWORD`：管理员初始密码（自己定一个强密码）

## 1. 安装基础软件

```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-contrib certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

检查版本：

```bash
node -v
npm -v
psql --version
nginx -v
```

## 2. 拉取项目到服务器

```bash
sudo mkdir -p /srv/todolist
sudo chown -R $USER:$USER /srv/todolist
git clone <你的仓库地址> /srv/todolist
cd /srv/todolist
npm ci
```

## 3. 创建数据库和账号

```bash
sudo -u postgres psql
```

在 psql 里执行：

```sql
CREATE USER todolist_app WITH PASSWORD 'DB_PASSWORD';
CREATE DATABASE todolist OWNER todolist_app;
\q
```

初始化表结构：

```bash
psql -h 127.0.0.1 -U todolist_app -d todolist -f database/schema.sql
```

## 4. 生成密钥并写 .env

生成密钥：

```bash
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
SYNC_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "$JWT_SECRET"
echo "$SYNC_ENCRYPTION_KEY"
```

创建 `.env`：

```bash
cp .env.production.example .env
```

编辑 `.env`（必须改）：

- `CORS_ORIGIN=https://YOUR_DOMAIN`
- `DATABASE_URL=postgresql://todolist_app:DB_PASSWORD@127.0.0.1:5432/todolist`
- `JWT_SECRET=<上面生成的值>`
- `SYNC_ENCRYPTION_KEY=<上面生成的值>`
- `ADMIN_BOOTSTRAP_PASSWORD=ADMIN_PASSWORD`

## 5. 配置 systemd（推荐）

复制服务文件：

```bash
sudo cp deploy/systemd/todolist-api.service /etc/systemd/system/todolist-api.service
```

让服务账号有读取项目权限：

```bash
sudo chown -R www-data:www-data /srv/todolist
```

启动并开机自启：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now todolist-api
sudo systemctl status todolist-api
```

看日志：

```bash
sudo journalctl -u todolist-api -f
```

## 6. 配置 Nginx + HTTPS

复制模板并替换域名：

```bash
sudo cp deploy/nginx/todolist-https.conf /etc/nginx/sites-available/todolist.conf
sudo sed -i 's/your-domain.com/YOUR_DOMAIN/g' /etc/nginx/sites-available/todolist.conf
sudo ln -sf /etc/nginx/sites-available/todolist.conf /etc/nginx/sites-enabled/todolist.conf
sudo nginx -t
sudo systemctl reload nginx
```

申请证书：

```bash
sudo certbot --nginx -d YOUR_DOMAIN
```

再次检查：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 7. 上线验收（按顺序）

1. 打开 `https://YOUR_DOMAIN/api/health`，应看到：
- `"status":"ok"`
- `"db":"connected"`
- `"encryption":"enabled"`

2. 打开主页：
- `https://YOUR_DOMAIN/`

3. 打开管理页：
- `https://YOUR_DOMAIN/admin.html`

4. 用 `.env` 里的管理员账号登录，测试：
- 创建用户
- 锁定/解锁用户
- 查看同步概览

## 8. 常见报错速查

1. `/api/health` 显示 `db: disabled`
- 你没配置 `DATABASE_URL` 或写错了。

2. `/api/sync/*` 返回 503
- 你没配置 `SYNC_ENCRYPTION_KEY` 或长度不对（必须 64 位 hex）。

3. 登录报 401/403
- 用户名密码错误，或账号被锁。

4. 页面打开但请求 /api 失败
- Nginx 配置没生效，执行：
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 9. 上线后建议（强烈建议）

1. 禁止公开注册：`PUBLIC_SIGNUP_ENABLED=false`
2. 定期备份数据库：
```bash
pg_dump -h 127.0.0.1 -U todolist_app -d todolist > ~/todolist-$(date +%F).sql
```
3. 开启自动安全更新：
```bash
sudo apt install -y unattended-upgrades
```
