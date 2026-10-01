import { Router } from 'express';
import { getSyncStatus, checkConnection, triggerSync, ingestSyncQueue } from '../controllers/syncController.js';
import { idempotencyFilter } from '../middleware/idempotencyMiddleware.js';
import { verifyStationSignature } from '../middleware/stationSignatureMiddleware.js';

const router = Router();

// GET /api/sync/status
router.get('/status', getSyncStatus);

// GET /api/sync/check-connection
router.get('/check-connection', checkConnection);

// POST /api/sync/trigger (Protected by SHA-256 Idempotency & Station Signing)
router.post('/trigger', idempotencyFilter(), verifyStationSignature(), triggerSync);

// POST /api/sync/queue (Section 4.6.3 Sequence Step 3: HTTPS POST /sync/queue (UUID + SHA256))
router.post('/queue', idempotencyFilter(), verifyStationSignature(), ingestSyncQueue);

export default router;
