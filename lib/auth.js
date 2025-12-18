// Authentication utilities
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// JWT_SECRET must be set in environment variables for security
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev-secret-change-in-production-do-not-use-in-production');
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Please set it in your .env file.');
}

export async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

export async function comparePassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

export function createSession(user) {
  // Create JWT token
  const token = jwt.sign(
    {
      userId: user._id || user.id,
      email: user.email,
      role: user.role,
      token: user.token
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const session = {
    userId: user._id || user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    token: user.token, // superToken, adminToken, or agentToken
    permissions: user.permissions || []
  };
  
  return { session, token };
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function verifyRole(userRole, requiredRole) {
  const roleHierarchy = {
    'superadmin': 3,
    'admin': 2,
    'agent': 1
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

export function hasPermission(userPermissions, requiredPermission) {
  if (userPermissions.includes('all')) return true;
  return userPermissions.includes(requiredPermission);
}

// Import and re-export permission functions for backward compatibility
export { 
  hasPermission as hasCRUDPermission,
  checkPermission,
  MODULES,
  OPERATIONS,
  generatePermission,
  getDefaultPermissions
} from './permissions.js';

export function getTokenByRole(role) {
  if (role === 'superadmin') return 'superToken';
  if (role === 'admin') return 'adminToken';
  if (role === 'agent') return 'agentToken';
  return null;
}
