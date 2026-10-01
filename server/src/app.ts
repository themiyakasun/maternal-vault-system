import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import patientRoutes from './routes/patientRoutes.js';
import syncRoutes from './routes/syncRoutes.js';
import authRoutes from './routes/authRoutes.js';
import fhirRoutes from './routes/fhirRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { isDatabaseConnected } from './db/index.js';
import { localEncryptedDb } from './db/localEncryptedDb.js';
import { getSyncTelemetry } from './services/syncService.js';
import { getPatientMobileView } from './controllers/patientController.js';

dotenv.config();

const app = express();

// Global Middleware with httpOnly cookie credentials support
app.use(cors({
  origin: (origin, callback) => {
    callback(null, origin || true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
}));
app.use(cookieParser());
app.use(express.json({ type: ['application/json', 'application/fhir+json', 'application/*+json'] }));
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

// HL7 FHIR R4 Ingestion & Interoperability Routes (Section 4.4.3 NFR-03 & Section 4.8.1)
app.use('/fhir/R4', fhirRoutes);
app.use('/api/fhir', fhirRoutes);

// Mobile Browser Emergency Health Pass Viewer (for smartphone cameras)
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

export default app;
