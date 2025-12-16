// Helper function to extract and verify Bearer token from request
import { verifyToken } from './auth';
import { userDB } from './database';
import { safeJsonParse, sanitizeSession } from './security-utils';

/**
 * Extract Bearer token from Authorization header
 * @param {Request} request - Next.js request object
 * @returns {string|null} - Token string or null
 */
export function getBearerToken(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7); // Remove 'Bearer ' prefix
}

/**
 * Get user session from Bearer token or session cookie
 * @param {Request} request - Next.js request object
 * @returns {Promise<Object|null>} - Session object or null
 */
export async function getSessionFromRequest(request) {
  // First, try to get from Bearer token
  const bearerToken = getBearerToken(request);
  
  if (bearerToken) {
    // Try to verify as JWT token first
    const jwtPayload = verifyToken(bearerToken);
    if (jwtPayload) {
      // JWT token verified, but fetch fresh user data to get latest permissions
      // This ensures permissions are up-to-date even if they were changed by superadmin
      try {
        if (jwtPayload.userId) {
          const user = await userDB.findById(jwtPayload.userId);
          if (user) {
            const userObj = user.toObject ? user.toObject() : user;
            return {
              userId: userObj._id?.toString() || userObj.id,
              email: userObj.email,
              role: userObj.role,
              token: userObj.token,
              name: userObj.name,
              permissions: userObj.permissions || []
            };
          }
        }
      } catch (error) {
        console.error('Error fetching fresh user data from JWT:', error);
        // Fallback to JWT payload if database fetch fails
      }
      
      // Fallback to JWT payload if database fetch failed
      return {
        userId: jwtPayload.userId,
        email: jwtPayload.email,
        role: jwtPayload.role,
        token: jwtPayload.token, // user token (agentToken, adminToken, superToken)
        name: jwtPayload.name || null,
        permissions: jwtPayload.permissions || []
      };
    }
    
    // If not JWT, try to find user by token (agentToken, adminToken, superToken)
    try {
      const user = await userDB.findByToken(bearerToken);
      if (user) {
        const userObj = user.toObject ? user.toObject() : user;
        return {
          userId: userObj._id?.toString() || userObj.id,
          email: userObj.email,
          role: userObj.role,
          token: userObj.token,
          name: userObj.name,
          permissions: userObj.permissions || []
        };
      }
    } catch (error) {
      console.error('Error finding user by token:', error);
    }
  }
  
  // Fallback to session cookie (secure parsing)
  const sessionCookie = request.cookies.get('session');
  if (sessionCookie) {
    // Use safe JSON parsing with size limits
    const parsed = safeJsonParse(sessionCookie.value, 10 * 1024); // 10KB max
    if (parsed) {
      // Sanitize and validate session data
      const session = sanitizeSession(parsed);
      if (session) {
        // Try to fetch fresh user data from database to get latest permissions
        try {
          if (session.userId) {
            const user = await userDB.findById(session.userId);
            if (user) {
              const userObj = user.toObject ? user.toObject() : user;
              return {
                userId: userObj._id?.toString() || userObj.id,
                email: userObj.email,
                role: userObj.role,
                token: userObj.token,
                name: userObj.name,
                permissions: userObj.permissions || []
              };
            }
          }
        } catch (error) {
          console.error('Error fetching fresh user data from session:', error);
          // Fallback to sanitized session data if database fetch fails
        }
        return session;
      }
    }
  }
  
  return null;
}

/**
 * Get JWT token from Bearer header or cookie
 * @param {Request} request - Next.js request object
 * @returns {string|null} - JWT token or null
 */
export function getJWTToken(request) {
  // Try Bearer token first
  const bearerToken = getBearerToken(request);
  if (bearerToken) {
    // Verify if it's a JWT
    const jwtPayload = verifyToken(bearerToken);
    if (jwtPayload) {
      return bearerToken;
    }
  }
  
  // Fallback to cookie
  const tokenCookie = request.cookies.get('token');
  return tokenCookie?.value || null;
}

