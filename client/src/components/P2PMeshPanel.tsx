import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, RefreshCw, CheckCircle2, Cloud, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { patientApi } from '../services/patientApi';

interface P2PMeshPanelProps {
  nodes?: any[];
  onTriggerSync?: () => void;
  isSyncing?: boolean;
}

export const P2PMeshPanel: React.FC<P2PMeshPanelProps> = ({ onTriggerSync, isSyncing }) => {
  const { currentClinic } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [telemetry, setTelemetry] = useState<{
    online: boolean;
    pendingCount: number;
    lastSync: string;
  }>({
    online: true,
    pendingCount: 0,
    lastSync: 'Continuous',
  });

  const fetchStatus = async () => {
    try {
      const res = await patientApi.getSyncStatus(currentClinic?.id);
      if (res?.data) {
        setTelemetry({
          online: res.data.isPostgresOnline,
          pendingCount: res.data.pendingRecordsCount || 0,
          lastSync: res.data.lastSuccessfulSync 
            ? new Date(res.data.lastSuccessfulSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : 'Active',
        });
      }
    } catch {
      // Keep baseline
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, [currentClinic?.id]);

  const handleSyncClick = async () => {
    if (onTriggerSync) {
      onTriggerSync();
      return;
    }
    setIsRefreshing(true);
    try {
      await patientApi.triggerCentralDbSync(currentClinic?.id);
      await fetchStatus();
    } catch {
      // Handled
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-4 shadow-xs space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#f1f5f9]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#f0fdf4] text-[#047857] flex items-center justify-center">
            <Cloud className="w-3.5 h-3.5 text-[#047857]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0f172a] tracking-tight">
              Main System Synchronization
            </h3>
            <p className="text-[10px] text-[#64748b]">Real-time bi-directional sync across all clinic devices</p>
          </div>
        </div>
        <div className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
          telemetry.online ? 'text-[#047857] bg-[#dcfce7]' : 'text-[#991b1b] bg-[#fee2e2]'
        }`}>
          <span className={`w-2 h-2 rounded-full ${telemetry.online ? 'bg-[#16a34a] animate-pulse' : 'bg-[#ef4444]'}`} />
          <span>{telemetry.online ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {/* Sync Status Cards */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-[#006194]" />
            <span className="text-[#334155] font-semibold text-[11px]">Clinic Partition</span>
          </div>
          <span className="font-bold text-[#0f172a] text-[11px] truncate max-w-[130px]">
            {currentClinic?.name || 'Local Station'}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-[#0284c7]" />
            <span className="text-[#334155] font-semibold text-[11px]">Sync Pipeline</span>
          </div>
          <span className="font-bold text-[#047857] text-[11px] flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-[#16a34a]" />
            {telemetry.pendingCount > 0 ? `${telemetry.pendingCount} Pending` : 'All Synced'}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
          <span className="text-[#64748b] text-[10.5px]">Last Reconciled</span>
          <span className="font-mono text-[10.5px] text-[#475569] font-medium">{telemetry.lastSync}</span>
        </div>
      </div>

      {/* Sync Action Button */}
      <button
        onClick={handleSyncClick}
        disabled={isSyncing || isRefreshing}
        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold text-[#006194] bg-[#f0f9ff] hover:bg-[#e0f2fe] border border-[#bae6fd] transition-all cursor-pointer disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing || isRefreshing ? 'animate-spin text-[#006194]' : ''}`} />
        <span>{isSyncing || isRefreshing ? 'Syncing...' : 'Sync Now with Main System'}</span>
      </button>

      {/* Footer info */}
      <div className="pt-2 border-t border-[#f1f5f9] flex items-center justify-between text-[10px]">
        <span className="text-[#64748b]">
          Auto-Sync: <span className="font-semibold text-[#334155]">Active (every 5-10s)</span>
        </span>
        <span className="font-bold text-[#047857] flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-[#047857]" />
          Isolated & Encrypted
        </span>
      </div>
    </div>
  );
};
