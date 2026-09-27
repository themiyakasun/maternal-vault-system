import React, { useState, useEffect } from 'react';
import { 
  X, 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Wifi, 
  WifiOff, 
  ShieldCheck, 
  Server, 
  HardDrive,
  Building2,
  ArrowUpRight,
  Activity
} from 'lucide-react';
import { patientApi } from '../../services/patientApi';
import { useAuth } from '../../context/AuthContext';

interface CentralDbSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

interface DbConnectionStatus {
  online: boolean;
  latencyMs: number | null;
  host: string | null;
  database: string | null;
  port: number | null;
  serverVersion: string | null;
  postgresTotalPatients: number;
  postgresTenantPatients: number;
  postgresTenantsCount: number;
  localTotalRecords: number;
  localPendingRecords: number;
  localSyncedRecords: number;
  activeClinicId: string | null;
  lastSyncAttempt: string | null;
  lastSuccessfulSync: string | null;
  checkedAt: string;
  error?: string;
}

export const CentralDbSyncModal: React.FC<CentralDbSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
}) => {
  const { currentClinic } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<DbConnectionStatus | null>(null);
  const [resultToast, setResultToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const activeTenantId = currentClinic?.id || 'clinic-4b-rampur';

  // Perform connection check
  const handleCheckConnection = async () => {
    setIsChecking(true);
    setResultToast(null);
    try {
      const res = await patientApi.checkCentralDbConnection(activeTenantId);
      if (res?.success && res?.data) {
        setConnectionStatus(res.data);
      } else {
        setConnectionStatus({
          online: false,
          latencyMs: null,
          host: null,
          database: null,
          port: null,
          serverVersion: null,
          postgresTotalPatients: 0,
          postgresTenantPatients: 0,
          postgresTenantsCount: 0,
          localTotalRecords: 0,
          localPendingRecords: 0,
          localSyncedRecords: 0,
          activeClinicId: activeTenantId,
          lastSyncAttempt: null,
          lastSuccessfulSync: null,
          checkedAt: new Date().toISOString(),
          error: res?.message || 'Connection check failed',
        });
      }
    } catch (err: any) {
      setConnectionStatus({
        online: false,
        latencyMs: null,
        host: null,
        database: null,
        port: null,
        serverVersion: null,
        postgresTotalPatients: 0,
        postgresTenantPatients: 0,
        postgresTenantsCount: 0,
        localTotalRecords: 0,
        localPendingRecords: 0,
        localSyncedRecords: 0,
        activeClinicId: activeTenantId,
        lastSyncAttempt: null,
        lastSuccessfulSync: null,
        checkedAt: new Date().toISOString(),
        error: err?.message || 'Central server unreachable',
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Pre-flight check whenever modal opens
  useEffect(() => {
    if (isOpen) {
      handleCheckConnection();
    } else {
      setResultToast(null);
    }
  }, [isOpen, activeTenantId]);

  // Push local records to PostgreSQL
  const handlePushToCentralDb = async () => {
    // 1. Check connection before pushing
    setIsPushing(true);
    setResultToast(null);

    try {
      const res = await patientApi.triggerCentralDbSync(activeTenantId);
      if (res?.success) {
        setResultToast({
          type: 'success',
          message: res.message || `Successfully pushed ${res.syncedCount || 0} records to Central PostgreSQL Database.`,
        });
        if (res.connectionStatus) {
          setConnectionStatus(res.connectionStatus);
        }
        if (onSyncComplete) {
          onSyncComplete();
        }
      } else {
        setResultToast({
          type: 'error',
          message: res.message || 'Failed to push records to Central PostgreSQL Database.',
        });
        if (res.connectionStatus) {
          setConnectionStatus(res.connectionStatus);
        }
      }
    } catch (err: any) {
      setResultToast({
        type: 'error',
        message: err?.message || 'Network error occurred while syncing with Central PostgreSQL.',
      });
    } finally {
      setIsPushing(false);
    }
  };

  if (!isOpen) return null;

  const isOnline = connectionStatus?.online ?? false;
  const pendingCount = connectionStatus?.localPendingRecords ?? 0;
  const syncedLocalCount = connectionStatus?.localSyncedRecords ?? 0;
  const totalLocalCount = connectionStatus?.localTotalRecords ?? 0;
  const postgresTenantCount = connectionStatus?.postgresTenantPatients ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#cbd5e1] max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#006194] to-[#0284c7] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shadow-inner">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight">Central Database Synchronization</h3>
                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  PostgreSQL
                </span>
              </div>
              <p className="text-[11px] text-[#e0f2fe] mt-0.5">
                Centralized Clinic & Staff Tenancy with Offline-Resilient Patient Push
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white rounded-lg p-1.5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          
          {/* Clinic Tenant Scope Banner */}
          <div className="flex items-center justify-between bg-[#f0f9ff] border border-[#bae6fd] rounded-xl p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#e0f2fe] text-[#006194] flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#006194] uppercase tracking-wider">
                  Active Clinic Tenant
                </div>
                <div className="text-xs font-extrabold text-[#0f172a]">
                  {currentClinic?.name || 'Primary Health Post 4B'}
                </div>
                <div className="text-[11px] text-[#64748b]">
                  {currentClinic?.division || 'Rampur Division'} • MOH: {currentClinic?.mohArea || 'MOH Rampur Central'}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block bg-[#006194] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                {currentClinic?.code || 'PHP-4B'}
              </span>
            </div>
          </div>

          {/* Connection Status Card */}
          <div className={`border rounded-xl p-4 transition-all ${
            isOnline 
              ? 'bg-[#f0fdf4] border-[#86efac]' 
              : 'bg-[#fef2f2] border-[#fca5a5]'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                {isOnline ? (
                  <div className="w-8 h-8 rounded-full bg-[#dcfce7] flex items-center justify-center text-[#16a34a] shrink-0">
                    <Wifi className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#fee2e2] flex items-center justify-center text-[#dc2626] shrink-0">
                    <WifiOff className="w-4 h-4" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-[#0f172a]">
                      {isOnline ? 'PostgreSQL Central DB Online' : 'PostgreSQL Connection Offline'}
                    </span>
                    {isOnline && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[#16a34a] bg-[#dcfce7] px-2 py-0.2 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-pulse"></span>
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#64748b]">
                    {isOnline 
                      ? `Latency: ${connectionStatus?.latencyMs ?? 0}ms • Host: ${connectionStatus?.host || 'localhost'}:${connectionStatus?.port || 5432}`
                      : 'Central database currently unreachable. Offline AES-256 vault active.'}
                  </p>
                </div>
              </div>

              {/* Re-check connection button */}
              <button
                onClick={handleCheckConnection}
                disabled={isChecking || isPushing}
                title="Ping central database"
                className="flex items-center gap-1.5 text-xs font-bold text-[#334155] hover:text-[#0f172a] bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] px-2.5 py-1.5 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#006194] ${isChecking ? 'animate-spin' : ''}`} />
                <span>{isChecking ? 'Testing...' : 'Test Connection'}</span>
              </button>
            </div>

            {/* Diagnostic Details Grid */}
            {isOnline ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#bbf7d0] text-xs">
                <div className="bg-white/80 p-2 rounded-lg border border-[#dcfce7]">
                  <span className="text-[10px] text-[#64748b] block">Database</span>
                  <span className="font-bold text-[#0f172a] font-mono">{connectionStatus?.database || 'maternal_vault'}</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-[#dcfce7]">
                  <span className="text-[10px] text-[#64748b] block">Clinic Tenants</span>
                  <span className="font-bold text-[#0f172a]">{connectionStatus?.postgresTenantsCount || 2} registered</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-[#dcfce7]">
                  <span className="text-[10px] text-[#64748b] block">Central Records</span>
                  <span className="font-bold text-[#006194]">{postgresTenantCount} for this clinic</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-[#dcfce7]">
                  <span className="text-[10px] text-[#64748b] block">Last Sync Time</span>
                  <span className="font-bold text-[#0f172a] truncate block">
                    {connectionStatus?.lastSuccessfulSync 
                      ? new Date(connectionStatus.lastSuccessfulSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Just now'}
                  </span>
                </div>
              </div>
            ) : (
              connectionStatus?.error && (
                <div className="text-[11px] text-[#dc2626] bg-white/80 p-2 rounded-lg border border-[#fecaca] mt-2 font-mono">
                  {connectionStatus.error}
                </div>
              )
            )}
          </div>

          {/* Sync Telemetry Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-[#64748b] mb-1">
                <HardDrive className="w-3.5 h-3.5 text-[#64748b]" />
                <span>Local Clinic Records</span>
              </div>
              <div className="text-2xl font-black text-[#0f172a]">
                {totalLocalCount}
              </div>
              <span className="text-[10px] text-[#64748b]">Encrypted AES-256</span>
            </div>

            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-[#047857] mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#16a34a]" />
                <span>Synced with Central</span>
              </div>
              <div className="text-2xl font-black text-[#16a34a]">
                {syncedLocalCount}
              </div>
              <span className="text-[10px] text-[#16a34a] font-medium">Up to date</span>
            </div>

            <div className={`rounded-xl p-3.5 text-center border ${
              pendingCount > 0 
                ? 'bg-[#fffbeb] border-[#fde68a]' 
                : 'bg-[#f8fafc] border-[#e2e8f0]'
            }`}>
              <div className={`flex items-center justify-center gap-1 text-[11px] font-bold mb-1 ${
                pendingCount > 0 ? 'text-[#b45309]' : 'text-[#64748b]'
              }`}>
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Pending Central Push</span>
              </div>
              <div className={`text-2xl font-black ${
                pendingCount > 0 ? 'text-[#d97706]' : 'text-[#0f172a]'
              }`}>
                {pendingCount}
              </div>
              <span className="text-[10px] text-[#64748b]">
                {pendingCount > 0 ? 'Waiting to upload' : 'All synced'}
              </span>
            </div>
          </div>

          {/* Feedback Toast */}
          {resultToast && (
            <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2.5 border ${
              resultToast.type === 'success' 
                ? 'bg-[#dcfce7] border-[#86efac] text-[#14532d]' 
                : 'bg-[#fee2e2] border-[#fca5a5] text-[#991b1b]'
            }`}>
              {resultToast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#16a34a] shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-[#dc2626] shrink-0" />
              )}
              <span>{resultToast.message}</span>
            </div>
          )}

          {/* Offline-First Information Box */}
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5 space-y-1.5 text-xs text-[#475569]">
            <div className="flex items-center gap-1.5 font-bold text-[#0f172a]">
              <Server className="w-3.5 h-3.5 text-[#006194]" />
              <span>Multi-Tenant Architecture & Resilience</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Midwife logins and clinic tenant profiles are governed centrally in PostgreSQL (<code className="bg-[#e2e8f0] px-1 py-0.2 rounded text-[10px]">tenants</code> & <code className="bg-[#e2e8f0] px-1 py-0.2 rounded text-[10px]">staff_users</code>). 
              When field midwives have connectivity, patient records automatically or manually push into central storage linked to <code className="bg-[#e2e8f0] px-1 py-0.2 rounded text-[10px]">tenant_id</code>.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#f8fafc] px-5 py-3.5 border-t border-[#e2e8f0] flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="text-[11px] text-[#64748b] flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#006194]" />
            <span>Connection is checked before every push</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              disabled={isPushing}
              className="flex-1 sm:flex-initial px-4 py-2 text-xs font-bold text-[#475569] hover:text-[#0f172a] border border-[#cbd5e1] hover:border-[#94a3b8] rounded-xl bg-white transition-colors cursor-pointer disabled:opacity-50"
            >
              Close
            </button>

            <button
              onClick={handlePushToCentralDb}
              disabled={!isOnline || isPushing || isChecking}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md cursor-pointer active:scale-98 ${
                isOnline 
                  ? 'bg-[#006194] hover:bg-[#004f7b]' 
                  : 'bg-slate-400 cursor-not-allowed opacity-60'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPushing ? 'animate-spin' : ''}`} />
              <span>
                {isPushing 
                  ? 'Pushing Records to PostgreSQL...' 
                  : pendingCount > 0 
                  ? `Push ${pendingCount} Record${pendingCount > 1 ? 's' : ''} to Central DB` 
                  : 'Push / Sync All to Central DB'}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
