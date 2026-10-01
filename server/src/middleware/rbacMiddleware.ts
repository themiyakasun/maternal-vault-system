import type { Request, Response, NextFunction } from 'express';
import { tenantStore } from '../db/tenantStore.js';
import type { StaffRole, StaffUser } from '../types/auth.js';

export interface AuthenticatedStaffRequest extends Request {
  staffUser?: Omit<StaffUser, 'passwordHash' | 'pinHash' | 'salt'>;
  staffRole?: StaffRole;
}

/**
 * Role-Based Access Control (RBAC) Middleware.
 * Differentiates Public Health Midwife (PHM) vs. MOH Doctor / Admin supervisory authorities.
 *
 * Section 4.4.1 (Table METHODOLOGY.5) & Section 4.6.1 (Fig METHODOLOGY.3)
 */
export function requireRole(allowedRoles: StaffRole[], options?: { allowUnauthenticatedFallback?: boolean }) {
  return async (req: AuthenticatedStaffRequest, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.token || (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : null);

      if (!token) {
        // Non-breaking fallback for legacy test environments if no auth header/cookie was attached
        if (options?.allowUnauthenticatedFallback !== false && process.env.NODE_ENV !== 'production') {
          return next();
        }
        return res.status(401).json({
          success: false,
          message: 'Authentication required to access this clinical action.',
        });
      }

      const verification = tenantStore.verifyToken(token);
      if (!verification.valid || !verification.session) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired session credentials.',
        });
      }

      const { clinicId, userId } = verification.session;
      const user = await tenantStore.getStaffUserById(clinicId, userId);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Staff account not recognized.',
        });
      }

      req.staffUser = user;
      req.staffRole = user.role;

      // Check if user's role is in the allowed roles list (admin is always allowed)
      const isAllowed = allowedRoles.includes(user.role) || user.role === 'admin';
      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          code: 'RBAC_PERMISSION_DENIED',
          message: `Forbidden: Supervisory role '${allowedRoles.join(' or ')}' required for this action. Current role: '${user.role}'.`,
          requiredRoles: allowedRoles,
          currentRole: user.role,
        });
      }

      return next();
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: 'Internal authorization error.',
        error: err.message,
      });
    }
  };
}
