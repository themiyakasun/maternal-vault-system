import app from './app.js';
import { initDatabase } from './db/index.js';
import { localEncryptedDb } from './db/localEncryptedDb.js';
import { startBackgroundSyncWorker } from './services/syncService.js';
import { startMLDaemon, stopMLDaemon } from './services/mlRiskService.js';

const PORT = process.env.PORT || 5000;

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
