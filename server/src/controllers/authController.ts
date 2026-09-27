import type { Request, Response } from 'express';
import { tenantStore } from '../db/tenantStore.js';

export const authController = {
  /**
   * GET /api/auth/clinics
   * Returns list of configured clinics on this station / deployment.
   */
  async getClinics(_req: Request, res: Response) {
    try {
      const clinics = await tenantStore.getClinics();
      return res.status(200).json({
        success: true,
        count: clinics.length,
        data: clinics,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Error fetching clinics list.',
      });
    }
  },

  /**
   * GET /api/auth/clinics/:clinicId/staff
   * Returns list of authorized staff members for the chosen clinic (strictly scoped).
   */
  async getClinicStaff(req: Request, res: Response) {
    try {
      const { clinicId } = req.params;
      const staff = await tenantStore.getStaffForClinic(clinicId);
      return res.status(200).json({
        success: true,
        clinicId,
        count: staff.length,
        data: staff,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Error fetching staff members.',
      });
    }
  },

  /**
   * POST /api/auth/staff
   * Dynamically registers a new midwife or clinician with automatic random salt generation.
   */
  async createStaff(req: Request, res: Response) {
    try {
      const { id, name, title, role, clinicId, password, avatarUrl, assignedBeats } = req.body;

      if (!name || !title || !role || !clinicId || !password) {
        return res.status(400).json({
          success: false,
          message: 'Please provide name, title, role, clinicId, and password.',
        });
      }

      const result = await tenantStore.createStaffMember({
        id,
        name,
        title,
        role,
        clinicId,
        password,
        avatarUrl,
        assignedBeats,
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Error registering new staff member.',
      });
    }
  },

  /**
   * POST /api/auth/login
   * Authenticates a staff member using High-Security Password (with automatic offline fallback)
   * and attaches an httpOnly session cookie.
   */
  async login(req: Request, res: Response) {
    try {
      const { clinicId, staffId, password, pin } = req.body;
      const credential = password || pin;

      if (!clinicId || !staffId || !credential) {
        return res.status(400).json({
          success: false,
          message: 'Please provide clinic ID, staff ID, and password.',
        });
      }

      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const result = await tenantStore.authenticateStaff(clinicId, staffId, credential, clientIp);
      if (!result.success) {
        return res.status(401).json(result);
      }

      // Attach secure httpOnly session cookie (Valid for 12 hours)
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 12 * 60 * 60 * 1000, // 12 hours
        path: '/',
      });

      return res.status(200).json({
        success: true,
        message: result.message,
        user: result.user,
        clinic: result.clinic,
        expiresAt: result.expiresAt,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Error during login.',
      });
    }
  },

  /**
   * GET /api/auth/me
   * Validates active session via httpOnly cookie or Authorization header.
   */
  async getMe(req: Request, res: Response) {
    try {
      const token = req.cookies?.token || (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : null);

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'No active session cookie found.',
        });
      }

      const verification = tenantStore.verifyToken(token);
      if (!verification.valid || !verification.session) {
        res.clearCookie('token', { path: '/' });
        return res.status(401).json({
          success: false,
          message: verification.error || 'Invalid or expired session cookie.',
        });
      }

      const { clinicId, userId } = verification.session;
      const clinic = await tenantStore.getClinicById(clinicId);
      const user = await tenantStore.getStaffUserById(clinicId, userId);

      if (!clinic || !user) {
        return res.status(401).json({
          success: false,
          message: 'User account or clinic station not found.',
        });
      }

      return res.status(200).json({
        success: true,
        user,
        clinic: {
          id: clinic.id,
          code: clinic.code,
          name: clinic.name,
          division: clinic.division,
          district: clinic.district,
          mohArea: clinic.mohArea,
          activeMothersCount: clinic.activeMothersCount,
        },
        expiresAt: verification.session.expiresAt,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Error verifying session cookie.',
      });
    }
  },

  /**
   * POST /api/auth/logout
   * Clears httpOnly authentication cookie and invalidates session.
   */
  async logout(_req: Request, res: Response) {
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      res.clearCookie('token', {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
      });

      return res.status(200).json({
        success: true,
        message: 'Logged out successfully.',
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Error during logout.',
      });
    }
  },

  /**
   * POST /api/auth/verify-offline
   * Validates an offline shift token (for client/node handshake if needed).
   */
  verifyOffline(req: Request, res: Response) {
    try {
      const token = req.body?.token || req.cookies?.token;
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Token is required.',
        });
      }

      const verification = tenantStore.verifyToken(token);
      if (!verification.valid) {
        return res.status(401).json({
          success: false,
          message: verification.error || 'Invalid session.',
        });
      }

      return res.status(200).json({
        success: true,
        session: verification.session,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Error verifying session.',
      });
    }
  },
};
