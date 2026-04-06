# 数据库与同步文档

## 1. 目标

本项目已升级为多用户架构，核心目标：

- 用户隔离：每个用户只能访问自己的工具数据。
- 管理可控：管理员可进行用户创建、封禁、角色管理。
- 数据保密：同步数据以 AES-256-GCM 加密后入库。
- 并发安全：通过行级锁 + 版本号防止并发覆盖。

## 2. 核心表结构

### 2.1 用户表 app_users

```sql
CREATE TABLE IF NOT EXISTS app_users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);
```

说明：

- role：`user` 或 `admin`。
- is_active：账户锁，管理员可封禁用户。

### 2.2 同步表 app_sync_data_secure

```sql
CREATE TABLE IF NOT EXISTS app_sync_data_secure (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    tool_key TEXT NOT NULL,
    payload_ciphertext TEXT NOT NULL,
    data_hash TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, tool_key)
);

CREATE INDEX IF NOT EXISTS idx_sync_secure_user_id ON app_sync_data_secure (user_id);
CREATE INDEX IF NOT EXISTS idx_sync_secure_tool_key ON app_sync_data_secure (tool_key);
```

说明：

- payload_ciphertext：加密后的数据包，避免明文落库。
- data_hash：内容摘要，便于审计与排查。
- version：并发控制版本号。

## 3. 多用户隔离机制

后端同步接口不再接受 `userId` 参数作为数据归属依据，而是：

1. 使用 `Authorization: Bearer <token>` 解析当前用户。
2. 所有同步读写都以 `req.authUser.id` 作为 `user_id`。
3. 普通用户无法读取或写入其他用户数据。

## 4. 保密机制

### 4.1 传输保密

- 客户端与服务器之间建议全站 HTTPS（Nginx + 证书）。
- API 使用 Bearer Token 做鉴权。

### 4.2 存储保密

- 同步数据使用 `SYNC_ENCRYPTION_KEY` 做 AES-256-GCM 加密。
- 未配置该密钥时，`/api/sync/*` 会返回 503，防止明文写库。

密钥要求：

- 64 位十六进制（32 字节）
- 或 32 字节的 base64

## 5. 用户数据锁机制

用户级锁（账户锁）：

- 管理员可通过 `PATCH /api/admin/users/:id/lock` 设置 `isActive`。
- 被锁用户将无法登录和访问受保护 API。

管理员保护：

- 禁止封禁最后一个活跃管理员。
- 禁止将最后一个活跃管理员降级为普通用户。

## 6. 并发机制

### 6.1 行级锁

写入和删除使用事务 + `SELECT ... FOR UPDATE`：

- 同一用户同一工具记录在并发请求时会串行更新。
- 避免并发写造成中间态覆盖。

### 6.2 乐观并发控制

客户端写入时提交 `expectedVersion`：

- 若 `expectedVersion` 与数据库当前 `version` 不一致，返回 409。
- 返回体附带当前服务端版本与数据，供客户端做冲突处理。

前端冲突策略：

- 默认 Last-Write-Wins（时间较新者胜出）。
- 冲突后会自动重试或回退为服务端版本。

## 7. API 契约

## 7.1 鉴权接口

- `POST /api/auth/register`：公开注册（需 `PUBLIC_SIGNUP_ENABLED=true`）
- `POST /api/auth/login`：登录，返回 JWT
- `GET /api/auth/me`：获取当前用户信息

## 7.2 同步接口（需 Bearer Token）

- `GET /api/sync/:toolKey`
- `PUT /api/sync/:toolKey`，body:

```json
{
  "data": { "any": "json" },
  "expectedVersion": 3
}
```

- `DELETE /api/sync/:toolKey?expectedVersion=3`

## 7.3 管理员接口（需 admin）

- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id/role`
- `PATCH /api/admin/users/:id/lock`
- `GET /api/admin/sync/overview`

## 8. 前端键映射

| 工具 | tool_key | 本地 localStorage key |
|---|---|---|
| Todo | `todo` | `tasks` |
| Habit | `habit` | `habit-data` |
| Notes | `notes` | `quick-notes-v2` |
| Jupyter | `jupyter` | `jupyter-cells` |

同步元数据（前端）：

- `sync-meta:<tool_key>`：localUpdatedAt / remoteUpdatedAt / version
- `auth-access-token`：访问令牌
- `auth-user-profile`：当前登录用户

## 9. 启动与初始化建议

1. 配置 `.env`，至少包含：`DATABASE_URL`、`JWT_SECRET`、`SYNC_ENCRYPTION_KEY`。
2. 可配置 `ADMIN_BOOTSTRAP_USERNAME` 与 `ADMIN_BOOTSTRAP_PASSWORD` 自动创建管理员。
3. 启动服务后调用 `/api/health` 确认 db/auth/encryption 状态。

## 10. 线上加固建议

- Nginx 仅暴露 80/443，Node 与 PostgreSQL 仅内网监听。
- 开启 HTTPS 并强制跳转。
- JWT 设短有效期并周期轮换密钥。
- 定期 `pg_dump` 备份并验证恢复流程。
- 管理员接口建议额外加 IP 白名单或二次认证。
