// Permission utilities for CRUD operations

// Available modules
export const MODULES = {
  USERS: 'users',
  PRODUCTS: 'products',
  SALES: 'sales',
  PURCHASES: 'purchases',
  CUSTOMERS: 'customers',
  INVENTORY: 'inventory',
  REPORTS: 'reports'
};

// Available operations
export const OPERATIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete'
};

// Generate permission string: "module:operation"
export function generatePermission(module, operation) {
  return `${module}:${operation}`;
}

// Parse permission string
export function parsePermission(permission) {
  const [module, operation] = permission.split(':');
  return { module, operation };
}

// Check if user has specific permission
export function hasPermission(userPermissions, module, operation) {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  
  // 'all' permission grants everything
  if (userPermissions.includes('all')) return true;
  
  // Check for specific permission
  const permission = generatePermission(module, operation);
  return userPermissions.includes(permission);
}

// Check if user can perform any operation on a module
export function hasModuleAccess(userPermissions, module) {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  
  if (userPermissions.includes('all')) return true;
  
  // Check if user has any permission for this module
  return userPermissions.some(perm => {
    if (perm === 'all') return true;
    const { module: permModule } = parsePermission(perm);
    return permModule === module;
  });
}

// Get default permissions for a role
export function getDefaultPermissions(role) {
  switch (role) {
    case 'superadmin':
      return ['all']; // Superadmin has all permissions
    case 'admin':
      return [
        generatePermission(MODULES.PRODUCTS, OPERATIONS.CREATE),
        generatePermission(MODULES.PRODUCTS, OPERATIONS.READ),
        generatePermission(MODULES.PRODUCTS, OPERATIONS.UPDATE),
        generatePermission(MODULES.PRODUCTS, OPERATIONS.DELETE),
        generatePermission(MODULES.SALES, OPERATIONS.CREATE),
        generatePermission(MODULES.SALES, OPERATIONS.READ),
        generatePermission(MODULES.SALES, OPERATIONS.UPDATE),
        generatePermission(MODULES.PURCHASES, OPERATIONS.CREATE),
        generatePermission(MODULES.PURCHASES, OPERATIONS.READ),
        generatePermission(MODULES.PURCHASES, OPERATIONS.UPDATE),
        generatePermission(MODULES.CUSTOMERS, OPERATIONS.CREATE),
        generatePermission(MODULES.CUSTOMERS, OPERATIONS.READ),
        generatePermission(MODULES.CUSTOMERS, OPERATIONS.UPDATE),
        generatePermission(MODULES.CUSTOMERS, OPERATIONS.DELETE),
        generatePermission(MODULES.INVENTORY, OPERATIONS.CREATE),
        generatePermission(MODULES.INVENTORY, OPERATIONS.READ),
        generatePermission(MODULES.INVENTORY, OPERATIONS.UPDATE),
      ];
    case 'agent':
      return [
        generatePermission(MODULES.SALES, OPERATIONS.CREATE),
        generatePermission(MODULES.SALES, OPERATIONS.READ),
        generatePermission(MODULES.PRODUCTS, OPERATIONS.READ),
        generatePermission(MODULES.CUSTOMERS, OPERATIONS.READ),
      ];
    case 'manager':
      return [
        generatePermission(MODULES.PRODUCTS, OPERATIONS.READ),
        generatePermission(MODULES.PRODUCTS, OPERATIONS.UPDATE),
      ];
    default:
      return [];
  }
}

// Get all available permissions for UI
export function getAllAvailablePermissions() {
  const permissions = {};
  
  Object.values(MODULES).forEach(module => {
    permissions[module] = Object.values(OPERATIONS).map(operation => ({
      operation,
      permission: generatePermission(module, operation),
      label: `${operation.charAt(0).toUpperCase() + operation.slice(1)} ${module.charAt(0).toUpperCase() + module.slice(1)}`
    }));
  });
  
  return permissions;
}

// Check CRUD permissions for API routes
export function checkPermission(userPermissions, module, operation) {
  if (!hasPermission(userPermissions, module, operation)) {
    throw new Error(`Permission denied: ${module}:${operation}`);
  }
  return true;
}

