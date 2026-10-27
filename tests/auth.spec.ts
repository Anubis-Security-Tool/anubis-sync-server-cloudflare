import { describe, it, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { verifyJWT } from '../src/auth'

const secret = randomBytes(32).toString('hex')
const env = { JWT_SECRET: secret, JWT_USERS: 'test-user' }
const request = (token: string): Request => new Request('http://127.0.0.1/api/sync', {
  headers: { authorization: `Bearer ${token}` }
})

describe('Worker authentication configuration', () => {
  it('refuses missing or weak configuration instead of a development credential', async () => {
    const token = jwt.sign({ id: 'test-user' }, 'default-secret-for-dev')
    for (const invalid of [
      { JWT_SECRET: undefined, JWT_USERS: undefined },
      { JWT_SECRET: 'short', JWT_USERS: 'test-user' },
      { JWT_SECRET: secret, JWT_USERS: '' }
    ]) {
      expect((await verifyJWT(request(token), invalid))?.status).toBe(503)
    }
  })

  it('rejects expired tokens and non-HS256 algorithms', async () => {
    const tokens = [
      jwt.sign({ id: 'test-user' }, secret, { expiresIn: -1 }),
      jwt.sign({ id: 'test-user' }, secret, { algorithm: 'HS384' }),
      jwt.sign({ id: 'test-user' }, '', { algorithm: 'none' })
    ]
    for (const token of tokens) {
      expect((await verifyJWT(request(token), env))?.status).toBe(401)
    }
  })

  it('retains the authenticated user namespace for a valid token', async () => {
    const value = request(jwt.sign({ id: 'test-user' }, secret, { expiresIn: '1m' }))
    expect(await verifyJWT(value, env)).toBeNull()
    expect((value as Request & { userId?: string }).userId).toBe('test-user')
  })
})
