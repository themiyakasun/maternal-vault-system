import { Request, Response } from 'express';
import { syncLocalToPostgres, getSyncTelemetry, probePostgres, checkConnectionAndStatus } from '../services/syncService.js';
import { localEncryptedDb } from '../db/localEncryptedDb.js';

export const getSyncStatus = async (req: Request, res: Response) => {
  try {
    const tenantId = (req.query.tenantId as string) || undefined;
    await probePostgres();
    const telemetry = getSyncTelemetry(tenantId);
    const encryptionMeta = localEncryptedDb.getEncryptionMeta();
    const stats = localEncryptedDb.getStats();

    return res.json({
      success: true,
      data: {
        telemetry,
        encryptionMeta,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * Pre-flight connection and pending sync check
 * GET /api/sync/check-connection?tenantId=...
 */
export const checkConnection = async (req: Request, res: Response) => {
  try {
    const tenantId = (req.query.tenantId as string) || (req.headers['x-clinic-id'] as string) || undefined;
    const status = await checkConnectionAndStatus(tenantId);
    return res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    console.error('Error checking central DB connection:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error checking connection to central database.',
    });
  }
};

/**
 * Trigger sync to central PostgreSQL
 * POST /api/sync/trigger
 */
export const triggerSync = async (req: Request, res: Response) => {
  try {
    const tenantId = req.body?.tenantId || (req.query.tenantId as string) || (req.headers['x-clinic-id'] as string) || undefined;
    const result = await syncLocalToPostgres(tenantId);
    return res.json(result);
  } catch (error) {
    console.error('Error triggering sync:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

