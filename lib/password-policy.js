const STORE_PASSWORD_ROTATION_DAYS = Number(process.env.STORE_PASSWORD_ROTATION_DAYS || 30);

export function isStoreFacingRole(role) {
  return role === 'agent' || role === 'manager';
}

export function getPasswordExpiryDate(fromDate = new Date()) {
  const days = Number.isFinite(STORE_PASSWORD_ROTATION_DAYS) && STORE_PASSWORD_ROTATION_DAYS > 0
    ? STORE_PASSWORD_ROTATION_DAYS
    : 30;
  return new Date(fromDate.getTime() + days * 24 * 60 * 60 * 1000);
}

export function isPasswordExpired(user) {
  if (!user || !isStoreFacingRole(user.role)) return false;
  if (user.mustChangePassword) return true;
  if (!user.passwordExpiresAt) return false;
  return new Date(user.passwordExpiresAt).getTime() <= Date.now();
}

export function needsPasswordPolicyBackfill(user) {
  return Boolean(user && isStoreFacingRole(user.role) && !user.passwordExpiresAt);
}

export function getPasswordPolicyFields(role, changedAt = new Date()) {
  if (!isStoreFacingRole(role)) {
    return {
      passwordChangedAt: changedAt,
      passwordExpiresAt: null,
      mustChangePassword: false
    };
  }

  return {
    passwordChangedAt: changedAt,
    passwordExpiresAt: getPasswordExpiryDate(changedAt),
    mustChangePassword: false
  };
}
