import React from 'react';
import { User, Calendar, AlertTriangle, Share2, TrendingUp } from 'lucide-react';

interface MaternalRecordsStatsProps {
  totalRegistered?: number;
  firstTrim?: number;
  secondTrim?: number;
  thirdTrim?: number;
  highRiskCount?: number;
  syncedPercentage?: string;
  syncedCount?: number;
}

export const MaternalRecordsStats: React.FC<MaternalRecordsStatsProps> = ({
  totalRegistered = 0,
  firstTrim = 0,
  secondTrim = 0,
  thirdTrim = 0,
  highRiskCount = 0,
  syncedPercentage = '100%',
  syncedCount = 0,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* 1. Total Registered */}
      <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-xl p-3 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
            Registered Mothers
          </span>
          <div className="w-6 h-6 rounded bg-[#e0f2fe] text-[#0284c7] flex items-center justify-center">
            <User className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold font-mono text-[#0f172a] tracking-tight">
              {totalRegistered}
            </span>
            <span className="text-xs text-[#64748b]">Total</span>
          </div>
          <div className="text-[10.5px] font-bold text-[#047857] flex items-center gap-0.5 mt-0.5">
            <TrendingUp className="w-3 h-3" />
            +6 this week
          </div>
        </div>
      </div>

      {/* 2. First Trimester */}
      <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-xl p-3 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
            1st Trimester
          </span>
          <div className="w-6 h-6 rounded bg-[#e0f2fe] text-[#0284c7] flex items-center justify-center">
            <Calendar className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold font-mono text-[#0f172a] tracking-tight">
              {firstTrim}
            </span>
            <span className="text-[11px] text-[#64748b]">(1-13 wks)</span>
          </div>
          <div className="text-[10px] text-[#64748b] mt-0.5">Early Intake</div>
        </div>
      </div>

      {/* 3. Second Trimester */}
      <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-xl p-3 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
            2nd Trimester
          </span>
          <div className="w-6 h-6 rounded bg-[#e0f2fe] text-[#0284c7] flex items-center justify-center">
            <Calendar className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold font-mono text-[#0f172a] tracking-tight">
              {secondTrim}
            </span>
            <span className="text-[11px] text-[#64748b]">(14-27 wks)</span>
          </div>
          <div className="text-[10px] text-[#64748b] mt-0.5">Mid Pregnancy</div>
        </div>
      </div>

      {/* 4. Third Trimester */}
      <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-xl p-3 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
            3rd Trimester
          </span>
          <div className="w-6 h-6 rounded bg-[#e0f2fe] text-[#0284c7] flex items-center justify-center">
            <Calendar className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold font-mono text-[#0f172a] tracking-tight">
              {thirdTrim}
            </span>
            <span className="text-[11px] text-[#64748b]">(28+ wks)</span>
          </div>
          <div className="text-[10px] text-[#006194] font-semibold mt-0.5">Near Delivery</div>
        </div>
      </div>

      {/* 5. High Risk Triage */}
      <div className="bg-[#ffffff] border border-[#fca5a5]/80 rounded-xl p-3 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#991b1b] uppercase tracking-wider">
            High Attention
          </span>
          <div className="w-6 h-6 rounded bg-[#fee2e2] text-[#b91c1c] flex items-center justify-center">
            <AlertTriangle className="w-3.5 h-3.5 text-[#ef4444]" />
          </div>
        </div>
        <div className="mt-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold font-mono text-[#b91c1c] tracking-tight">
              {highRiskCount}
            </span>
            <span className="text-[10.5px] font-bold text-[#b91c1c]">Mothers</span>
          </div>
          <div className="text-[10px] font-bold text-[#b91c1c] mt-0.5">
            Needs Priority Care
          </div>
        </div>
      </div>

      {/* 6. P2P Mesh Synced */}
      <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-xl p-3 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
            Offline Saved
          </span>
          <div className="w-6 h-6 rounded bg-[#f0fdf4] text-[#047857] flex items-center justify-center">
            <Share2 className="w-3.5 h-3.5 text-[#047857]" />
          </div>
        </div>
        <div className="mt-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold font-mono text-[#047857] tracking-tight">
              {syncedPercentage}
            </span>
            <span className="text-[11px] font-mono text-[#64748b]">{syncedCount}/{totalRegistered}</span>
          </div>
          <div className="text-[10px] text-[#047857] font-semibold mt-0.5">
            ✓ Backed up on tablet
          </div>
        </div>
      </div>
    </div>
  );
};
