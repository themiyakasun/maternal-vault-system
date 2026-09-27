import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import patientRoutes from './routes/patientRoutes.js';
import syncRoutes from './routes/syncRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initDatabase, isDatabaseConnected } from './db/index.js';
import { localEncryptedDb } from './db/localEncryptedDb.js';
import { startBackgroundSyncWorker, getSyncTelemetry } from './services/syncService.js';
import { startMLDaemon, stopMLDaemon } from './services/mlRiskService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Global Middleware with httpOnly cookie credentials support
app.use(cors({
  origin: (origin, callback) => {
    // Dynamically reflect origin to allow any local/network web client with credentials
    callback(null, origin || true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint with Local Encrypted DB & Sync Telemetry
app.get('/api/health', (_req, res) => {
  const encMeta = localEncryptedDb.getEncryptionMeta();
  const syncTelemetry = getSyncTelemetry();
  res.json({
    status: 'healthy',
    service: 'MaternaVault Edge Clinical API',
    version: '1.0.0',
    mlModels: {
      maternalRiskModel: 'XGBoost v1.0',
      anemiaTrackerModel: 'SMOTE-XGBoost v1.0',
      prenatalDepressionModel: 'ADASYN-XGBoost v1.0',
    },
    storageMode: 'Local AES-256-GCM Encrypted Primary Store',
    encryption: {
      cipher: encMeta.cipher,
      encryptedChecksum: encMeta.checksum,
      lastEncrypted: encMeta.lastEncrypted,
      recordsInMemory: encMeta.recordsInMemory,
    },
    syncTelemetry,
    postgresConnected: isDatabaseConnected,
    timestamp: new Date().toISOString(),
  });
});

// Authentication & Clinic Multi-Tenant Routes
app.use('/api/auth', authRoutes);

// Patient Routes
app.use('/api/patients', patientRoutes);

// Sync Telemetry & Manual Sync Routes
app.use('/api/sync', syncRoutes);

// Mobile Browser Emergency Health Pass Viewer (for smartphone cameras)
import { getPatientMobileView } from './controllers/patientController.js';
app.get('/mobile/patient/:id', getPatientMobileView);

// 404 Route Handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
  });
});

// Error Handler
app.use(errorHandler);

// Process termination hooks
process.on('SIGINT', () => {
  stopMLDaemon();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopMLDaemon();
  process.exit(0);
});

// Start Server
app.listen(PORT, async () => {
  console.log(`🚀 MaternaVault Edge Server running on http://localhost:${PORT}`);
  
  // 1. Initialize Local AES-256-GCM Encrypted Database
  localEncryptedDb.init();

  // 2. Start 3-Model ML Risk Inference Engine (maternal, anemia, depression)
  startMLDaemon();

  // 3. Try initializing PostgreSQL connection pool opportunistically
  await initDatabase();

  // 4. Start opportunistic background auto-sync worker (polls every 15s)
  startBackgroundSyncWorker(15000);
});

export default app;

