import React, { useState } from 'react';
import { Search, Mic, Lock, RotateCcw, ChevronDown, SlidersHorizontal, X, Upload } from 'lucide-react';

interface RecordsFilterToolbarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  riskFilter: string;
  setRiskFilter: (risk: string) => void;
  trimesterFilter: string;
  setTrimesterFilter: (trim: string) => void;
  syncFilter: string;
  setSyncFilter: (sync: string) => void;
  conditionFilter: string;
  setConditionFilter: (cond: string) => void;
  totalFiltered: number;
  totalRegistered: number;
  onResetFilters: () => void;
  onOpenImportVault?: () => void;
}

export const RecordsFilterToolbar: React.FC<RecordsFilterToolbarProps> = ({
  searchQuery,
  setSearchQuery,
  riskFilter,
  setRiskFilter,
  trimesterFilter,
  setTrimesterFilter,
  syncFilter,
  setSyncFilter,
  conditionFilter,
  setConditionFilter,
  totalFiltered,
  totalRegistered,
  onResetFilters,
  onOpenImportVault,
}) => {
  const [showAdvancedMobile, setShowAdvancedMobile] = useState(false);

  const isAnyFilterActive = 
    riskFilter !== 'all' || 
    trimesterFilter !== 'all' || 
    syncFilter !== 'all' || 
    conditionFilter !== 'all' || 
    searchQuery.trim() !== '';

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-xl p-3 sm:p-3.5 space-y-3 shadow-xs">
      {/* 1. Primary Search Row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 flex items-center">
          <Search className="w-4 h-4 text-[#64748b] absolute left-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search mother's name, ABHA ID, village..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-14 py-2 text-xs border border-[#cbd5e1] rounded-lg bg-[#ffffff] focus:outline-hidden focus:border-[#006194] focus:ring-1 focus:ring-[#006194] text-[#0f172a] placeholder-[#94a3b8]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-7 text-[#94a3b8] hover:text-[#0f172a] p-1 cursor-pointer"
              title="Clear Search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            title="Voice Search"
            className="absolute right-2.5 text-[#64748b] hover:text-[#006194] p-0.5 cursor-pointer"
          >
            <Mic className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile Filter Toggle Button */}
        <button
          onClick={() => setShowAdvancedMobile(!showAdvancedMobile)}
          className={`md:hidden flex items-center gap-1 px-3 py-2 border rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            showAdvancedMobile || isAnyFilterActive
              ? 'bg-[#006194] text-white border-[#006194]'
              : 'bg-white text-[#334155] border-[#cbd5e1] hover:bg-[#f8fafc]'
          }`}
          title="Filter options"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filters</span>
        </button>
      </div>

      {/* 2. Mobile Quick Pills (1-Thumb Tapable) */}
      <div className="md:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setRiskFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
            riskFilter === 'all'
              ? 'bg-[#1e293b] text-white'
              : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setRiskFilter(riskFilter === 'high' ? 'all' : 'high')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1 cursor-pointer transition-all ${
            riskFilter === 'high'
              ? 'bg-[#ef4444] text-white'
              : 'bg-[#fee2e2] text-[#991b1b]'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
          High Risk
        </button>
        <button
          onClick={() => setRiskFilter(riskFilter === 'moderate' ? 'all' : 'moderate')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
            riskFilter === 'moderate'
              ? 'bg-[#0284c7] text-white'
              : 'bg-[#e0f2fe] text-[#0369a1]'
          }`}
        >
          Moderate
        </button>
        <button
          onClick={() => setRiskFilter(riskFilter === 'low' ? 'all' : 'low')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
            riskFilter === 'low'
              ? 'bg-[#10b981] text-white'
              : 'bg-[#d1fae5] text-[#065f46]'
          }`}
        >
          Routine
        </button>
        <button
          onClick={() => setTrimesterFilter(trimesterFilter === '3' ? 'all' : '3')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
            trimesterFilter === '3'
              ? 'bg-[#006194] text-white'
              : 'bg-[#eaedff] text-[#004b73]'
          }`}
        >
          3rd Trim (28w+)
        </button>
      </div>

      {/* 3. Detailed Filters Grid (Always visible on desktop, toggleable on mobile) */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 items-center ${
        showAdvancedMobile ? 'block' : 'hidden md:grid'
      }`}>
        {/* Risk Filter */}
        <div className="relative">
          <label className="md:hidden block text-[10px] font-bold text-[#64748b] uppercase mb-0.5">Care Priority</label>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="w-full appearance-none px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg bg-white text-[#334155] font-medium pr-7 focus:outline-hidden focus:border-[#006194] cursor-pointer"
          >
            <option value="all">All Care Priorities</option>
            <option value="high">High Risk (Pre-eclampsia/Severe)</option>
            <option value="moderate">Moderate Attention</option>
            <option value="low">Routine Care</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#64748b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none md:top-1/2" />
        </div>

        {/* Trimester Filter */}
        <div className="relative">
          <label className="md:hidden block text-[10px] font-bold text-[#64748b] uppercase mb-0.5">Gestational Stage</label>
          <select
            value={trimesterFilter}
            onChange={(e) => setTrimesterFilter(e.target.value)}
            className="w-full appearance-none px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg bg-white text-[#334155] font-medium pr-7 focus:outline-hidden focus:border-[#006194] cursor-pointer"
          >
            <option value="all">All Gestational Stages</option>
            <option value="1">1st Trimester (1-13 wks)</option>
            <option value="2">2nd Trimester (14-27 wks)</option>
            <option value="3">3rd Trimester (28+ wks)</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#64748b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Sync State Filter */}
        <div className="relative">
          <label className="md:hidden block text-[10px] font-bold text-[#64748b] uppercase mb-0.5">Sync Telemetry</label>
          <select
            value={syncFilter}
            onChange={(e) => setSyncFilter(e.target.value)}
            className="w-full appearance-none px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg bg-white text-[#334155] font-medium pr-7 focus:outline-hidden focus:border-[#006194] cursor-pointer"
          >
            <option value="all">All Sync Statuses</option>
            <option value="synced-p2p">Synced via BLE/WiFi</option>
            <option value="updated-local">Saved on Tablet Only</option>
            <option value="pending-mesh">Pending Synchronization</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#64748b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Specific Conditions Filter */}
        <div className="relative">
          <label className="md:hidden block text-[10px] font-bold text-[#64748b] uppercase mb-0.5">Clinical Condition</label>
          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="w-full appearance-none px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg bg-white text-[#334155] font-medium pr-7 focus:outline-hidden focus:border-[#006194] cursor-pointer"
          >
            <option value="all">All Specific Conditions</option>
            <option value="Pre-eclampsia">Pre-eclampsia</option>
            <option value="Gestational HTN">Gestational HTN</option>
            <option value="Gestational Anemia">Gestational Anemia</option>
            <option value="Prior C-Section">Prior C-Section</option>
            <option value="Fetal Growth Restriction">Fetal Growth Restr.</option>
            <option value="Teenage Pregnancy">Teenage Primigravida</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#64748b] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* 4. Bottom Status Info Strip */}
      <div className="pt-2 border-t border-[#f1f5f9] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-[#475569] flex-wrap">
          <span>
            Showing <strong className="text-[#0f172a] font-mono">{totalFiltered}</strong> of {totalRegistered} Mothers
          </span>
          <span className="hidden sm:inline text-[#cbd5e1]">•</span>
          <span className="text-[#047857] font-semibold flex items-center gap-1 text-[11px]">
            <Lock className="w-3 h-3 text-[#047857]" />
            Saved on Tablet
          </span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onOpenImportVault && (
            <button
              onClick={onOpenImportVault}
              className="text-xs font-semibold text-[#006194] hover:text-[#004f7b] bg-[#f0f9ff] hover:bg-[#e0f2fe] border border-[#bae6fd] px-2.5 py-1 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
              title="Import Scanned QR Pass or JSON Vault File"
            >
              <Upload className="w-3 h-3" />
              <span>Import Health Vault</span>
            </button>
          )}

          {isAnyFilterActive && (
            <button
              onClick={onResetFilters}
              className="text-xs font-semibold text-[#006194] hover:text-[#004f7b] flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset All Filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

