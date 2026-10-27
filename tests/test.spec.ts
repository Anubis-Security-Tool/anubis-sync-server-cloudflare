// tests/e2e.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn, execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import fetch from 'node-fetch'
import jwt from 'jsonwebtoken'

// Server management
let wranglerProcess: ReturnType<typeof spawn> | undefined
let serverUrl: string
let temporaryRoot: string | undefined
let workerExit: Promise<unknown> | undefined

// Test data
let validUserId: string
const invalidUserId = 'invalid-user'
let validToken: string
let invalidToken: string
const testData = { test: 'data' }

beforeAll(async () => {
  const JWT_SECRET = randomBytes(32).toString('hex')
  const JWT_USERS = 'test-user,testuser2'

  // Setup test data
  validUserId = JWT_USERS.split(',')[0]
  validToken = jwt.sign({ id: validUserId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' })
  invalidToken = jwt.sign({ id: invalidUserId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' })

  const root = fileURLToPath(new URL('../', import.meta.url))
  const cli = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
  temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'anubis-worker-test-'))
  fs.chmodSync(temporaryRoot, 0o700)
  const config = path.join(temporaryRoot, 'wrangler.json')
  const state = path.join(temporaryRoot, 'state')
  fs.writeFileSync(config, JSON.stringify({
    name: 'anubis-sync-test',
    main: path.join(root, 'src', 'index.ts'),
    compatibility_date: '2023-05-18',
    d1_databases: [{
      binding: 'DB',
      database_name: 'anubis_sync_db',
      database_id: '00000000-0000-0000-0000-000000000001'
    }]
  }), { flag: 'wx' })
  fs.writeFileSync(path.join(temporaryRoot, '.dev.vars'),
    `JWT_SECRET="${JWT_SECRET}"\nJWT_USERS="${JWT_USERS}"\n`,
    { flag: 'wx', mode: 0o600 })
  const env = { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' }
  execFileSync(process.execPath, [
    cli, 'd1', 'execute', 'anubis_sync_db', '--local',
    '--config', config, '--persist-to', state,
    '--file', path.join(root, 'bin', 'schema.sql')
  ], { cwd: temporaryRoot, env, stdio: 'pipe', timeout: 30000 })
  const listener = net.createServer()
  listener.listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const address = listener.address()
  if (address === null || typeof address === 'string') throw new Error('No owned test port')
  const port = address.port
  await new Promise<void>((resolve, reject) => listener.close(error => error != null ? reject(error) : resolve()))
  serverUrl = `http://127.0.0.1:${port}`
  wranglerProcess = spawn(process.execPath, [
    cli, 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port),
    '--config', config, '--persist-to', state
  ], {
    cwd: temporaryRoot,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    env
  })
  workerExit = once(wranglerProcess, 'exit')
  let diagnostics = ''
  for (const stream of [wranglerProcess.stdout, wranglerProcess.stderr]) {
    stream?.on('data', chunk => {
      diagnostics = (diagnostics + chunk.toString().split(JWT_SECRET).join('[redacted]')).slice(-5000)
    })
  }
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    if (wranglerProcess.exitCode !== null || wranglerProcess.signalCode !== null) {
      throw new Error(`Local Worker exited before readiness: ${diagnostics}`)
    }
    try {
      const response = await fetch(`${serverUrl}/test`, { signal: AbortSignal.timeout(500) })
      if (response.status === 200 && await response.text() === 'ok') return
    } catch (error) {
      if (!(error instanceof Error) || !['FetchError', 'AbortError', 'TimeoutError'].includes(error.name)) throw error
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Local Worker was not ready: ${diagnostics}`)
}, 65000)

afterAll(async () => {
  const child = wranglerProcess
  if (child?.pid != null && child.exitCode === null && child.signalCode === null) {
    if (process.platform === 'win32') {
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        `$ErrorActionPreference='Stop'; function Stop-Owned([int]$Id) { foreach($c in Get-CimInstance Win32_Process -Filter "ParentProcessId=$Id") { Stop-Owned $c.ProcessId }; Stop-Process -Id $Id -ErrorAction SilentlyContinue }; Stop-Owned ${child.pid}`
      ], { stdio: 'pipe', timeout: 10000 })
    } else {
      process.kill(-child.pid, 'SIGTERM')
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        workerExit,
        new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Owned Worker did not stop')), 10000)
        })
      ])
    } finally { clearTimeout(timer) }
  }
  if (temporaryRoot !== undefined) {
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  }
}, 15000)

describe('API Endpoints', () => {
  describe('GET /test', () => {
    it('should return 200 OK', async () => {
      const response = await fetch(`${serverUrl}/test`)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('ok')
    })
  })

  describe('PUT /api/sync', () => {
    it('should return 401 without token', async () => {
      const response = await fetch(`${serverUrl}/api/sync`, {
        method: 'PUT',
        body: JSON.stringify(testData),
        headers: { 'Content-Type': 'application/json' }
      })
      expect(response.status).toBe(401)
    })

    it('should return 401 with invalid token', async () => {
      const response = await fetch(`${serverUrl}/api/sync`, {
        method: 'PUT',
        body: JSON.stringify(testData),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${invalidToken}`
        }
      })
      expect(response.status).toBe(401)
    })

    it('should return 200 with valid token', async () => {
      const response = await fetch(`${serverUrl}/api/sync`, {
        method: 'PUT',
        body: JSON.stringify(testData),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`
        }
      })
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('ok')
    })
  })

  describe('POST /api/sync', () => {
    it('should return 401 without token', async () => {
      const response = await fetch(`${serverUrl}/api/sync`, {
        method: 'POST'
      })
      expect(response.status).toBe(401)
    })

    it('should return 401 with invalid token', async () => {
      const response = await fetch(`${serverUrl}/api/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${invalidToken}`
        }
      })
      expect(response.status).toBe(401)
    })

    it('should return 200 with valid token', async () => {
      const response = await fetch(`${serverUrl}/api/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`
        }
      })
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('test ok')
    })
  })

  describe('GET /api/sync', () => {
    it('should return 401 without token', async () => {
      const response = await fetch(`${serverUrl}/api/sync`)
      expect(response.status).toBe(401)
    })

    it('should return 401 with invalid token', async () => {
      const response = await fetch(`${serverUrl}/api/sync`, {
        headers: {
          Authorization: `Bearer ${invalidToken}`
        }
      })
      expect(response.status).toBe(401)
    })

    it('should return previously stored data with valid token', async () => {
      // First store some data
      await fetch(`${serverUrl}/api/sync`, {
        method: 'PUT',
        body: JSON.stringify(testData),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`
        }
      })

      // Then retrieve it
      const response = await fetch(`${serverUrl}/api/sync`, {
        headers: {
          Authorization: `Bearer ${validToken}`
        }
      })
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toEqual(testData)
    })
  })
})
