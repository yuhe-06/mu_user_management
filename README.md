# MU User Management

MU User Management 是一个面向 Molecular Universe 的内部管理后台，集成用户管理、平台数据监控、用户行为概览以及 StarSeeker / Ask / search / 模型功能使用分析。

项目采用 FastAPI + PostgreSQL + 原生前端实现，前端静态资源与 API 同源部署，适合本地运行、Docker 部署或 Render / AWS 等云服务部署。

## 核心功能

- 管理员登录：仅允许 `permissions = admin` 且未删除的用户登录后台。
- 用户管理：支持用户查询、字段筛选、列展示配置、排序、新增、编辑、软删除。
- 批量新增用户：支持批量邮箱导入、插入前预览、随机临时密码生成、创建后发送邮件。
- 临时密码邮件：可为单个用户生成临时密码，并在管理员确认后更新密码并发送邮件。
- 中英文切换：后台菜单、表格、按钮和主要说明支持中英文切换。
- 统计报告邮件：支持生成并发送用户权限统计报告。

## 数据监控页面

左侧菜单按「数据监控」和「用户管理」组织。数据监控下包含：

- `MU概览`：查看平台整体注册、活跃、功能调用等指标。
- `用户概览`：查看用户规模、活跃行为、热门调用接口、用户角色与组织分布。
- `StarSeeker概览`：查看 StarSeeker Session、会话趋势、用户分布、留存与粘性分析。
- `Ask概览`：按 Ask 接口调用查看调用次数、调用用户、趋势和明细。
- `search概览`：按 search 相关接口调用查看调用次数、调用用户、趋势和明细。
- `模型概览`：统计除 StarSeeker、Ask、search 之外的模型功能调用，包含指标卡、模型组合饼图、趋势图、排行榜和调用明细。

各监控页面都有独立日期筛选和用户群体筛选。默认统计近 30 天，用户群体支持：

- `全部`
- `SES 内部`：组织字段为 `SES AI`、`ses.ai`、`SES` 等 SES 内部组织。
- `外部客户`：非 SES 内部组织。

## 数据来源

- 用户管理与平台基础数据来自 `umap_db.public.users`。
- 平台与用户行为数据来自 `umap_db.public.activity`。
- StarSeeker / Agent 数据来自 Deerflow `store`，会话轮数相关数据来自 Deerflow checkpoint 数据。
- Ask 数据来自 `umap_db.public.activity` 中 `/rag` 和 `/rag-search-literature` 相关接口。
- search 数据来自 `umap_db.public.activity` 中 `/search`、`/search-35`、`/find-friend-with-image`、`/api/molecule_details` 相关接口。
- 模型概览统计 `umap_db.public.activity` 中除 StarSeeker、Ask、search 之外的模型功能分类调用。

## 本地运行

```bash
cd mu_user_management
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8010
```

打开：

```text
http://localhost:8010
```

使用已有 admin 账号登录。

## Docker Compose 运行

```bash
cd mu_user_management
cp .env.example .env
docker compose up -d --build
```

打开：

```text
http://localhost:8010
```

停止服务：

```bash
docker compose down
```

## Render 部署

项目已提供 `render.yaml` 和 `Dockerfile`，可以在 Render 上从 GitHub 仓库部署为 Web Service。

1. 打开 Render Dashboard，选择 `New` -> `Blueprint`。
2. 连接 GitHub 仓库 `yuhe-06/mu_user_management`。
3. Render 读取 `render.yaml` 并创建 `mu-user-management` 服务。
4. 在 Render 服务的 `Environment` 页面填写环境变量。
5. 部署完成后，Render 会生成公网访问链接。

说明：前端和 API 同源部署，通常不需要额外配置 `CORS_ORIGINS`。如果后续拆成前后端分离，再把前端域名加入 `CORS_ORIGINS`。

## 环境变量

- `DATABASE_URL`：PostgreSQL 连接串，指向包含 `public.users` 的主数据库。
- `PLATFORM_DATABASE_URL`：平台监控读取数据库连接串，可选；未配置时回退到 `PLATFORM_READ_DATABASE_URL` 或 `DATABASE_URL`。
- `PLATFORM_READ_DATABASE_URL`：平台监控只读数据库连接串。
- `DEERFLOW_DATABASE_URL`：StarSeeker / Agent 监控读取 Deerflow 数据的连接串。
- `SECRET_KEY`：JWT 签名密钥，生产环境必须替换为长随机字符串。
- `ALGORITHM`：JWT 算法，默认 `HS256`。
- `ACCESS_TOKEN_EXPIRE_MINUTES`：管理端登录有效期，默认 720 分钟。
- `CORS_ORIGINS`：允许的跨域来源，逗号分隔。
- `SMTP_HOST`：SMTP 服务地址。
- `SMTP_PORT`：SMTP 服务端口，默认 587。
- `SMTP_USER`：SMTP 登录用户。
- `SMTP_PASS`：SMTP 登录密码。
- `MAIL_FROM`：邮件发件人地址。

## 主要 API

认证：

- `POST /api/auth/login`
- `GET /api/auth/me`

用户管理：

- `GET /api/users`
- `POST /api/users`
- `POST /api/users/batch/preview`
- `POST /api/users/batch/create-send`
- `GET /api/users/{id}`
- `PUT /api/users/{id}`
- `DELETE /api/users/{id}`
- `POST /api/users/{id}/generate-password`
- `POST /api/users/{id}/send-email`

报表与监控：

- `GET /api/reports/dashboard`
- `GET /api/reports/ask-dashboard`
- `GET /api/reports/search-dashboard`
- `GET /api/reports/feature-dashboard`
- `GET /api/reports/user-activity`
- `GET /api/reports/agent-sessions/{thread_id}/export`
- `GET /api/reports/user-permissions/recipients`
- `POST /api/reports/user-permissions/send`

健康检查：

- `GET /health`

## 开发说明

- 静态页面位于 `static/`，核心交互逻辑在 `static/app.js`，样式在 `static/styles.css`。
- 后端入口为 `app/main.py`，路由位于 `app/routers/`。
- 不要将 `.env`、数据库连接串、SMTP 密码、导出数据等敏感内容提交到 Git。
- 本地导出的数据建议放在 `exports/`，该目录不应进入代码提交。
