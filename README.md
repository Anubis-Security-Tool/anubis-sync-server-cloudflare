<h1 align="center" style="padding-top: 60px;padding-bottom: 40px;">
    Anubis-Security-Tool
</h1>

[English](./README.md) | [中文](./README_CN.md)

# Anubis Sync Server - Cloudflare Workers + D1

A Cloudflare Workers implementation of the Anubis-Security-Tool sync server using D1 as the database backend. A lightweight, scalable, serverless alternative to the Node.js implementation. Intended host: `sync.anubis.locker`.

## Features

- **Serverless Architecture**: Runs on Cloudflare's global edge network
- **D1 Database**: SQLite-compatible database distributed across Cloudflare's network
- **JWT Authentication**: Secure authentication using JSON Web Tokens
- **Simple API**: Compatible with the Anubis sync protocol

## Prerequisites

- [Node.js](https://nodejs.org/) (24 LTS recommended)
- A Cloudflare account with Workers and D1 enabled

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/Anubis-Security-Tool/anubis-sync-server-cloudflare.git
cd anubis-sync-server-cloudflare
npm ci --registry=https://npm.anubis.locker/
```

### 2. Create a D1 Database

```bash
npx wrangler d1 create anubis_sync_db
```

Take note of the database ID in the output; put it into `wrangler.jsonc` (`database_id`).

### 3. Apply the Database Schema

```bash
npx wrangler d1 execute anubis_sync_db --file=./bin/schema.sql
npx wrangler d1 execute anubis_sync_db --file=./bin/schema.sql --remote
```

### 4. Configure

Edit `wrangler.jsonc` and replace `YOUR_D1_DATABASE_ID` with the ID from step 2.

### 5. Deploy the Worker

```bash
npm run deploy
```

In the Cloudflare worker settings, set `JWT_SECRET` to at least 32 random
characters and set `JWT_USERS` to the allowed comma-separated user IDs.
Alternatively use `npx wrangler secret put JWT_SECRET` and
`npx wrangler secret put JWT_USERS`, entering values through the private
interactive prompt rather than command arguments. Unconfigured protected
routes return HTTP 503; there is no shared development signing key or default
user allowlist. Optionally bind the custom domain `sync.anubis.locker`.

## API Endpoints

- `GET /test`: Basic health check endpoint
- `GET /api/sync`: Retrieve user data (requires JWT authentication)
- `PUT /api/sync`: Update user data (requires JWT authentication)
- `POST /api/sync`: Test authentication (requires JWT authentication)

## Authentication

All `/api/sync` endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

The token must contain an `id` claim matching one of the user IDs in the `JWT_USERS` environment variable.

## Local Development

```bash
npm start
```

First apply the local D1 schema and create an owner-only `.dev.vars` containing
your own `JWT_SECRET` and `JWT_USERS`; this file is ignored by Git. Local
development does not create or configure a remote D1 database.

## Local test

```bash
npm run test
```

The tests create a private temporary configuration, apply the schema to an
isolated local D1 database, start Wrangler on a free loopback port and clean up
their own Worker process. They do not deploy, use your production bindings or
write to a remote database. Authentication tests include missing configuration,
expired tokens and rejected algorithms.

## Usage with Anubis-Security-Tool

1. Go to Settings > Sync -> Custom
2. Enter:
   - Sync server: your worker URL (e.g., `https://sync.anubis.locker/api/sync`)
   - JWT secret: the `JWT_SECRET` configured in the worker settings
   - User ID: one of the `JWT_USERS` configured in the worker settings

## Links

<p>
  <a href="https://download.anubis.locker">Downloads</a> ·
  <a href="https://docs.anubis.locker">Docs</a> ·
  <a href="https://theme.anubis.locker">Theme</a> ·
  <a href="https://ai.anubis.locker">AI</a> ·
  <a href="https://demo.anubis.locker">Online demo</a> ·
  <a href="https://github.com/Anubis-Security-Tool/anubis-web">anubis-web</a>
</p>

## License

MIT
