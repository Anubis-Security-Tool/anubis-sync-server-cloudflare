/**
 * Authentication middleware for Anubis Sync Server
 */
import { ExtendedRequest, Env } from './types'
import { jwtVerify } from 'jose'

/**
 * Verifies a JWT token from the request headers
 * @param request - The incoming request
 * @param env - Environment variables
 * @returns A Response if authentication fails, otherwise null
 */
export const verifyJWT = async (
  request: ExtendedRequest,
  env: Pick<Env, 'JWT_SECRET' | 'JWT_USERS'>
): Promise<Response | null> => {
  const users = (env.JWT_USERS ?? '').split(',').map(user => user.trim()).filter(Boolean)
  if (typeof env.JWT_SECRET !== 'string' || env.JWT_SECRET.length < 32 || users.length === 0) {
    console.error('Sync authentication requires JWT_SECRET (32+ characters) and JWT_USERS')
    return new Response('Sync authentication is not configured', { status: 503 })
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader === null || !authHeader.startsWith('Bearer ')) {
    return new Response('Unauthorized - Missing or invalid authorization header', { status: 401 })
  }

  const token = authHeader.substring(7)
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(env.JWT_SECRET), {
      algorithms: ['HS256']
    })
    if (typeof payload.id !== 'string' || !users.includes(payload.id)) {
      return new Response('Unauthorized - Invalid user', { status: 401 })
    }

    // Add user ID to request for later use
    request.userId = payload.id
    return null
  } catch {
    return new Response('Unauthorized - Invalid or expired token', { status: 401 })
  }
}

/**
 * Authentication middleware wrapper
 * @param request - The incoming request
 * @param env - Environment variables
 * @returns A Response if authentication fails, otherwise null
 */
export async function authenticate (request: ExtendedRequest, env: Env): Promise<Response | null> {
  return await verifyJWT(request, env)
}
