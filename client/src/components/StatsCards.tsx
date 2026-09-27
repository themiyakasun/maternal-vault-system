import React from 'react';
import { User, Bell, CheckSquare, TrendingUp } from 'lucide-react';

interface StatsCardsProps {
  totalActive: number;
  criticalAlerts: number;
  syncedRecords: number;
  totalRecords: number;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  totalActive = 0,
  criticalAlerts = 0,
  syncedRecords = 0,
  totalRecords = 0,
}) => {
  const syncPercentage = totalRecords > 0 ? ((syncedRecords / totalRecords) * 100).toFixed(1) : '100.0';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total Active Pregnancies */}
      <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-4 shadow-xs flex flex-col justify-between hover:border-[#cbd5e1] transition-all">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#64748b] tracking-wider uppercase">
              Total Active Pregnancies
            </span>
            <div className="w-8 h-8 rounded bg-[#e0f2fe] text-[#0284c7] flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1">
            <span className="text-3xl font-extrabold font-mono text-[#0f172a] tracking-tight">
              {totalActive}
            </span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-0.5 text-[#047857] font-bold">
            <TrendingUp className="w-3 h-3" />
            +4 this week
          </span>
          <span className="text-[#64748b] text-[11px]">
            In village jurisdiction • 18 due this month
          </span>
        </div>
      </div>

      {/* Critical Alerts */}
      <div className="bg-[#ffffff] border border-[#fca5a5]/70 rounded-lg p-4 shadow-xs flex flex-col justify-between hover:border-[#ef4444] transition-all">
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#64748b] tracking-wider uppercase">
                Critical Alerts
              </span>
              <span className="bg-[#fee2e2] text-[#991b1b] text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase">
                Action Req
              </span>
            </div>
            <div className="w-8 h-8 rounded bg-[#fee2e2] text-[#b91c1c] flex items-center justify-center">
              <Bell className="w-4 h-4 text-[#ef4444]" />
            </div>
          </div>
          <div className="mt-1">
            <span className="text-3xl font-extrabold font-mono text-[#b91c1c] tracking-tight">
              {criticalAlerts.toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#fee2e2] flex items-center gap-1.5 text-xs">
          <div className="w-2.5 h-2.5 rounded-full border-2 border-[#ef4444] flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-[#ef4444]" />
          </div>
          <span className="text-[#991b1b] text-[11px] font-medium leading-tight">
            Requires immediate midwife evaluation or tertiary referral
          </span>
        </div>
      </div>

      {/* P2P Records Synced */}
      <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-4 shadow-xs flex flex-col justify-between hover:border-[#cbd5e1] transition-all">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#64748b] tracking-wider uppercase">
              P2P Records Synced
            </span>
            <div className="w-8 h-8 rounded bg-[#e0f2fe] text-[#0284c7] flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1">
            <span className="text-3xl font-extrabold font-mono text-[#0f172a] tracking-tight">
              {syncedRecords} <span className="text-lg font-medium text-[#64748b]">/ {totalRecords}</span>
            </span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] flex items-center gap-2 text-xs">
          <span className="text-[#047857] font-bold font-mono text-xs">
            {syncPercentage}% Synced
          </span>
          <span className="text-[#64748b] text-[11px]">
            4 peer midwife field tablets linked
          </span>
        </div>
      </div>
    </div>
  );
};
