import { Router } from 'express';
import {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientStats,
  getPatientQRCode,
  addPatientVisit,
  recalculatePatientRisk,
  checkPatientNic,
} from '../controllers/patientController.js';

const router = Router();

// GET summary stats (must come before /:id)
router.get('/stats', getPatientStats);

// Check duplicate NIC in local or cloud DB (must come before /:id)
router.get('/check-nic', checkPatientNic);

// List patients with query filtering
router.get('/', getAllPatients);

// Get unique QR code for mobile data transfer
router.get('/:id/qr', getPatientQRCode);

// Recalculate 3-model risk on demand for single patient
router.post('/:id/evaluate-risk', recalculatePatientRisk);

// Get single patient by ID
router.get('/:id', getPatientById);

// Create new patient record
router.post('/', createPatient);

// Add Antenatal Clinic (ANC) visit
router.post('/:id/visits', addPatientVisit);

// Update existing patient record
router.put('/:id', updatePatient);

// Delete patient record
router.delete('/:id', deletePatient);

export default router;

