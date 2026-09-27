import React from 'react';
import { 
  Users, 
  HeartPulse, 
  Plus, 
  Wifi, 
  Menu
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenIntake: () => void;
  onOpenMobileMenu: () => void;
  totalMothers?: number;
  criticalCount?: number;
  isSyncing?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenIntake,
  onOpenMobileMenu,
  totalMothers = 0,
  criticalCount = 0,
  isSyncing = false,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#e2e8f0] shadow-lg transition-transform pb-[env(safe-area-inset-bottom,0px)]">
      <div className="grid grid-cols-5 items-center h-16 max-w-lg mx-auto px-1">
        {/* 1. Records Tab */}
        <button
          onClick={() => setActiveTab('records')}
          className={`flex flex-col items-center justify-center py-1.5 relative transition-colors cursor-pointer ${
            activeTab === 'records' ? 'text-[#006194]' : 'text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          <div className="relative">
            <Users className={`w-5 h-5 transition-transform ${activeTab === 'records' ? 'scale-110 stroke-[2.5]' : 'stroke-2'}`} />
            {totalMothers > 0 && (
              <span className="absolute -top-1 -right-2 bg-[#006194] text-white text-[9px] font-bold font-mono px-1 rounded-full min-w-[14px] h-[14px] flex items-center justify-center leading-none">
                {totalMothers}
              </span>
            )}
          </div>
          <span className={`text-[10px] mt-1 tracking-tight font-medium ${activeTab === 'records' ? 'font-bold text-[#006194]' : ''}`}>
            Records
          </span>
        </button>

        {/* 2. Priority Care Queue Tab */}
        <button
          onClick={() => setActiveTab('triage')}
          className={`flex flex-col items-center justify-center py-1.5 relative transition-colors cursor-pointer ${
            activeTab === 'triage' ? 'text-[#006194]' : 'text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          <div className="relative">
            <HeartPulse className={`w-5 h-5 transition-transform ${activeTab === 'triage' ? 'scale-110 stroke-[2.5]' : 'stroke-2'}`} />
            {criticalCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-[#ef4444] text-white text-[9px] font-bold font-mono px-1 rounded-full min-w-[14px] h-[14px] flex items-center justify-center animate-pulse leading-none">
                {criticalCount}
              </span>
            )}
          </div>
          <span className={`text-[10px] mt-1 tracking-tight font-medium ${activeTab === 'triage' ? 'font-bold text-[#006194]' : ''}`}>
            Care Queue
          </span>
        </button>

        {/* 3. Center Elevated + Add Mother Action */}
        <div className="flex items-center justify-center">
          <button
            onClick={onOpenIntake}
            className="w-12 h-12 rounded-full bg-[#006194] hover:bg-[#004f7b] active:scale-95 text-white flex items-center justify-center shadow-md shadow-[#006194]/25 transition-all -mt-4 border-2 border-white cursor-pointer"
            title="Add Mother via Smart Card Scanner"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* 4. Sync & Devices Tab */}
        <button
          onClick={() => setActiveTab('mesh-logs')}
          className={`flex flex-col items-center justify-center py-1.5 relative transition-colors cursor-pointer ${
            activeTab === 'mesh-logs' ? 'text-[#006194]' : 'text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          <div className="relative">
            <Wifi className={`w-5 h-5 transition-transform ${activeTab === 'mesh-logs' ? 'scale-110 stroke-[2.5]' : 'stroke-2'} ${isSyncing ? 'animate-spin text-[#006194]' : ''}`} />
            <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#10b981] ring-1 ring-white" />
          </div>
          <span className={`text-[10px] mt-1 tracking-tight font-medium ${activeTab === 'mesh-logs' ? 'font-bold text-[#006194]' : ''}`}>
            Sync
          </span>
        </button>

        {/* 5. More / Drawer Menu */}
        <button
          onClick={onOpenMobileMenu}
          className={`flex flex-col items-center justify-center py-1.5 relative transition-colors cursor-pointer ${
            activeTab === 'diagnostics' || activeTab === 'settings' ? 'text-[#006194]' : 'text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          <div className="relative">
            <Menu className="w-5 h-5 stroke-2" />
          </div>
          <span className={`text-[10px] mt-1 tracking-tight font-medium ${activeTab === 'diagnostics' || activeTab === 'settings' ? 'font-bold text-[#006194]' : ''}`}>
            Menu
          </span>
        </button>
      </div>
    </nav>
  );
};
