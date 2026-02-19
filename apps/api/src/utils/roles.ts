export const ADMIN_ROLES = ['ORG_OWNER', 'ADMIN'];
export const USER_ROLES = ['MEMBER'];
export const ALL_DASHBOARD_ROLES = [...ADMIN_ROLES, ...USER_ROLES];

export function isAdminRole(role: string): boolean {
    return ADMIN_ROLES.includes(role);
}

export function isUserRole(role: string): boolean {
    return USER_ROLES.includes(role);
}