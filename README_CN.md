<h1 align="center" style="padding-top: 60px;padding-bottom: 40px;">
    Anubis-Security-Tool
</h1>

[English](./README.md) | [中文](./README_CN.md)

# Anubis 同步服务器 - Cloudflare Workers + D1

基于 Cloudflare Workers 的 Anubis-Security-Tool 同步服务器实现，使用 D1 作为数据库后端，是 Node.js 实现的轻量、可扩展的无服务器替代方案。预期域名：`sync.anubis.locker`。

## 功能

- **无服务器架构**：运行在 Cloudflare 全球边缘网络
- **D1 数据库**：兼容 SQLite 的分布式数据库
- **JWT 认证**：使用 JSON Web Token 进行安全认证
- **简单的 API**：与 Anubis 同步协议兼容

## 前置条件

- [Node.js](https://nodejs.org/)（v20 或更高）
- 已启用 Workers 和 D1 的 Cloudflare 账号

## 安装步骤

### 1. 克隆仓库

```bash
git clone https://github.com/Anubis-Security-Tool/anubis-sync-server-cloudflare.git
cd anubis-sync-cloudflare
npm install
npm i -g wrangler
```

### 2. 创建 D1 数据库

```bash
wrangler d1 create anubis_sync_db
```

记下输出中的数据库 ID，填入 `wrangler.jsonc` 的 `database_id`。

### 3. 应用数据库结构

```bash
wrangler d1 execute anubis_sync_db --file=./bin/schema.sql
wrangler d1 execute anubis_sync_db --file=./bin/schema.sql --remote
```

### 4. 配置

编辑 `wrangler.jsonc`，将 `YOUR_D1_DATABASE_ID` 替换为第 2 步得到的 ID。

### 5. 部署

```bash
npm run deploy
```

**然后在 Cloudflare worker 设置中配置 JWT_SECRET 和 JWT_USERS（user1,user2...）**。可选：绑定自定义域名 `sync.anubis.locker`。

## API 接口

- `GET /test`：健康检查
- `GET /api/sync`：获取用户数据（需要 JWT 认证）
- `PUT /api/sync`：更新用户数据（需要 JWT 认证）
- `POST /api/sync`：测试认证（需要 JWT 认证）

## 认证

所有 `/api/sync` 接口都需要在 Authorization 头中携带有效的 JWT：

```
Authorization: Bearer <token>
```

令牌需包含 `id` 声明，且其值须在 `JWT_USERS` 环境变量中。

## 本地开发

```bash
npm run dev
```

## 本地测试

```bash
npm run test
```

## 与 Anubis-Security-Tool 一起使用

1. 打开 设置 > 同步 -> 自定义
2. 填写：
   - 同步服务器：worker 地址（如 `https://sync.anubis.locker/api/sync`）
   - JWT secret：worker 设置中配置的 `JWT_SECRET`
   - 用户 ID：worker 设置中配置的 `JWT_USERS` 之一

## 链接

<p>
  <a href="https://download.anubis.locker">主页 / 下载</a> ·
  <a href="https://docs.anubis.locker">文档</a> ·
  <a href="https://theme.anubis.locker">主题</a> ·
  <a href="https://ai.anubis.locker">AI</a> ·
  <a href="https://demo.anubis.locker">在线演示</a> ·
  <a href="https://github.com/Anubis-Security-Tool/anubis-web">anubis-web</a>
</p>

## 许可证

MIT
