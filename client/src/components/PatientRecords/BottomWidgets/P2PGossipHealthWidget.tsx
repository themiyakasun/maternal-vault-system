import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cloud, Database, Lock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { patientApi } from '../../../services/patientApi';

export const P2PGossipHealthWidget: React.FC = () => {
  const { currentClinic } = useAuth();
  const [online, setOnline] = useState(true);
  const [lastSync, setLastSync] = useState('Continuous');

  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      try {
        const res = await patientApi.getSyncStatus(currentClinic?.id);
        if (isMounted && res?.data) {
          setOnline(res.data.isPostgresOnline);
          if (res.data.lastSuccessfulSync) {
            setLastSync(new Date(res.data.lastSuccessfulSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          }
        }
      } catch {
        // Fallback
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentClinic?.id]);

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg p-4 shadow-xs flex flex-col justify-between space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
            Multi-Device Synchronization
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
            online 
              ? 'bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]'
              : 'bg-[#fef2f2] text-[#991b1b] border-[#fecaca]'
          }`}>
            {online ? '● Cloud Connected' : '○ Offline Storage'}
          </span>
        </div>

        <h3 className="text-sm font-bold text-[#0f172a] mt-1.5">
          Real-Time Clinic Sync
        </h3>
        <p className="text-[11px] text-[#64748b] mt-0.5 leading-snug">
          Changes made on this tablet or the main system are automatically synchronized across all clinic devices.
        </p>

        {/* Real Status Rows */}
        <div className="mt-3 border border-[#f1f5f9] rounded-lg divide-y divide-[#f8fafc] text-xs">
          <div className="p-2 flex items-center justify-between hover:bg-[#faf8ff]">
            <div className="flex items-center gap-2">
              <Cloud className="w-3.5 h-3.5 text-[#006194]" />
              <span className="font-semibold text-[#0f172a] text-xs">Main Database</span>
            </div>
            <span className="text-[11px] font-medium text-[#047857] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-[#16a34a]" />
              {online ? 'Live PostgreSQL' : 'Local Primary'}
            </span>
          </div>

          <div className="p-2 flex items-center justify-between hover:bg-[#faf8ff]">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-[#0284c7]" />
              <span className="font-semibold text-[#0f172a] text-xs">Data Isolation</span>
            </div>
            <span className="text-[11px] font-medium text-[#475569] truncate max-w-[130px]">
              {currentClinic?.name || 'Clinic Partition'}
            </span>
          </div>

          <div className="p-2 flex items-center justify-between hover:bg-[#faf8ff]">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-[#7c3aed]" />
              <span className="font-semibold text-[#0f172a] text-xs">Reconciliation</span>
            </div>
            <span className="text-[11px] font-mono font-medium text-[#64748b]">
              {lastSync}
            </span>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="pt-2 border-t border-[#f1f5f9] flex items-center justify-between text-[10.5px]">
        <span className="text-[#64748b]">
          Auto-Sync: <strong className="text-[#334155]">Active across devices</strong>
        </span>
        <span className="text-[#047857] font-bold flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-[#047857]" />
          Safe & Encrypted
        </span>
      </div>
    </div>
  );
};
