import { Router } from 'express';
import { getSyncStatus, checkConnection, triggerSync } from '../controllers/syncController.js';

const router = Router();

// GET /api/sync/status
router.get('/status', getSyncStatus);

// GET /api/sync/check-connection
router.get('/check-connection', checkConnection);

// POST /api/sync/trigger
router.post('/trigger', triggerSync);

export default router;

