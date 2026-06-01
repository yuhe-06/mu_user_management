# mu_user_management

独立的用户管理 Web 项目，用于管理 `public.users` 表。项目参考 `mu_backend/mu_user` 的用户模型和管理接口，提供管理员登录、用户查询、新增、编辑、软删除功能。

## 功能

- 管理员登录：仅允许 `permissions = admin` 且未删除的账号进入。
- 用户列表：支持保留字段关键词模糊搜索，可按用户名、邮箱、组织、权限做筛选，支持点击列名排序和自定义展示列。
- 新增用户：写入 `username`、`email`、`permissions`，并对密码做 bcrypt 哈希。
- 批量新增用户：输入多个邮箱、组织、权限和订阅时间，先预览随机密码和插入信息，确认后逐条插入并发送邮件，失败用户单独汇总。
- 发送邮件：在用户列表中为单个用户生成临时密码并弹框展示，管理员确认后才修改用户密码并发送 Molecular Universe 临时密码邮件。
- 编辑用户：支持更新用户表业务字段；密码留空时不会修改原密码。
- 删除用户：软删除，将 `deleted` 置为 `true`。

## 本地运行

```bash
cd mu_user_management
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8010
```

打开 `http://localhost:8010`，使用已有 admin 账号登录。

## Docker Compose 运行

```bash
cd mu_user_management
cp .env.example .env
docker compose up -d --build
```

打开 `http://localhost:8010`，使用已有 admin 账号登录。停止服务：

```bash
docker compose down
```

## 环境变量

- `DATABASE_URL`：PostgreSQL 连接串，指向包含 `public.users` 的数据库。
- `SECRET_KEY`：JWT 签名密钥，生产环境必须替换为长随机字符串。
- `ALGORITHM`：JWT 算法，默认 `HS256`。
- `ACCESS_TOKEN_EXPIRE_MINUTES`：管理端登录有效期，默认 720 分钟。
- `CORS_ORIGINS`：允许的跨域来源，逗号分隔。
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM`：发送临时密码邮件使用的 SMTP 配置。

## API

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/users`
- `POST /api/users`
- `POST /api/users/batch/preview`
- `POST /api/users/batch/create-send`
- `GET /api/users/{id}`
- `POST /api/users/{id}/generate-password`
- `POST /api/users/{id}/send-email`
- `PUT /api/users/{id}`
- `DELETE /api/users/{id}`
