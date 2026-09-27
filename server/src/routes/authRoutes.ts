import { Router } from 'express';
import { authController } from '../controllers/authController.js';

const router = Router();

// GET /api/auth/clinics - List all available clinics
router.get('/clinics', authController.getClinics);

// GET /api/auth/clinics/:clinicId/staff - Get staff for clinic (scoped)
router.get('/clinics/:clinicId/staff', authController.getClinicStaff);

// POST /api/auth/staff - Dynamically register new midwife / clinician
router.post('/staff', authController.createStaff);

// POST /api/auth/login - High-security password login (with httpOnly cookie)
router.post('/login', authController.login);

// GET /api/auth/me - Validate current session via httpOnly cookie
router.get('/me', authController.getMe);

// POST /api/auth/logout - Clear httpOnly session cookie
router.post('/logout', authController.logout);

// POST /api/auth/verify-offline - Verify session token
router.post('/verify-offline', authController.verifyOffline);

export default router;
