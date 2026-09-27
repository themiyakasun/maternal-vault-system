import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, Lock, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onTriggerSync?: () => void;
  onOpenCentralDbSync?: () => void;
  isSyncing?: boolean;
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  onTriggerSync, 
  onOpenCentralDbSync,
  isSyncing = false,
  onOpenMobileMenu
}) => {
  const { currentUser, currentClinic, lockScreen, logout } = useAuth();
  const [timeStr, setTimeStr] = useState('10:42 AM IST');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      setTimeStr(`${formattedHours}:${minutes} ${ampm} IST`);
    };

    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const displayName = currentUser?.name || 'Sister Priya Sharma';
  const displayTitle = currentUser?.title || 'Midwife Lead';
  const displayInitials = currentUser?.initials || 'PS';
  const clinicName = currentClinic?.name || 'Primary Health Post 4B';
  const divisionName = currentClinic?.division || 'Rampur Sub-Center';

  const handleSyncClick = () => {
    if (onOpenCentralDbSync) {
      onOpenCentralDbSync();
    } else if (onTriggerSync) {
      onTriggerSync();
    }
  };

  return (
    <header className="bg-[#ffffff] border-b border-[#e2e8f0] px-3.5 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
      {/* Clinic & Operating Mode */}
      <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
        {/* Mobile Hamburger / Brand Button */}
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-1.5 -ml-1 rounded-lg text-[#334155] hover:bg-[#eaedff] active:bg-[#dae2fd] transition-colors cursor-pointer shrink-0"
            title="Open Menu"
          >
            <Menu className="w-5 h-5 text-[#006194]" />
          </button>
        )}

        <div className="min-w-0">
          <h2 className="text-xs sm:text-sm font-bold text-[#0f172a] leading-tight flex items-center gap-1.5 truncate">
            <span className="truncate">{clinicName}</span>
            <span className="hidden sm:inline text-xs font-normal text-[#64748b]">• {divisionName}</span>
          </h2>
          <p className="text-[10px] sm:text-[11px] font-medium text-[#047857] flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] inline-block shrink-0"></span>
            <span className="truncate">Working Offline • Auto-Saving</span>
          </p>
        </div>
      </div>

      {/* Sync Status, Lock Screen & Midwife Profile */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Sync Telemetry (Desktop clock, mobile sync icon) */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-[#475569]">
          <div className="flex items-center gap-1.5 font-medium">
            <Clock className="w-3.5 h-3.5 text-[#64748b]" />
            <span>{timeStr}</span>
          </div>

          <span className="text-[#cbd5e1]">•</span>

          <button 
            onClick={handleSyncClick}
            title="Click to check connection with Central PostgreSQL database and push records"
            className="flex items-center gap-1.5 font-semibold text-[#006194] hover:text-[#004f7b] bg-[#f0f9ff] hover:bg-[#e0f2fe] px-2.5 py-1 rounded-full border border-[#bae6fd] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#0284c7] ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Central DB Sync'}</span>
          </button>
        </div>

        {/* Mobile Quick Sync Icon Button */}
        <button
          onClick={handleSyncClick}
          title="Central DB Sync"
          className="sm:hidden p-1.5 text-[#006194] bg-[#f0f9ff] hover:bg-[#e0f2fe] border border-[#bae6fd] rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#0284c7] ${isSyncing ? 'animate-spin' : ''}`} />
        </button>


        {/* Lock Station Action */}
        <button
          onClick={lockScreen}
          className="flex items-center gap-1.5 text-[#475569] hover:text-[#0f172a] bg-[#f8fafc] hover:bg-[#f1f5f9] active:bg-[#e2e8f0] border border-[#cbd5e1] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-2xs cursor-pointer"
          title="Lock Station (Protects patient records)"
        >
          <Lock className="w-3.5 h-3.5 text-[#64748b]" />
          <span className="hidden md:inline">Lock</span>
        </button>

        {/* Midwife User Profile Capsule */}
        <div className="flex items-center gap-2 sm:gap-2.5 pl-2 sm:pl-3 border-l border-[#e2e8f0]">
          {/* Avatar with status indicator */}
          <div className="relative shrink-0">
            {currentUser?.avatarUrl ? (
              <img 
                src={currentUser.avatarUrl} 
                alt={displayName}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover ring-2 ring-[#006194]/20 bg-[#e0f2fe]"
              />
            ) : (
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#006194] text-white font-bold text-xs flex items-center justify-center ring-2 ring-[#006194]/20 shadow-2xs">
                {displayInitials}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#16a34a] ring-2 ring-white" title="Online" />
          </div>

          {/* Name & Title */}
          <div className="text-left hidden lg:block">
            <div className="text-xs font-bold text-[#0f172a] leading-tight truncate max-w-[130px]">
              {displayName}
            </div>
            <div className="inline-flex items-center gap-1 mt-0.5">
              <span className="bg-[#e0f2fe] text-[#004b73] text-[10px] font-bold px-1.5 py-0.2 rounded border border-[#bae6fd]">
                {displayTitle}
              </span>
            </div>
          </div>

          {/* Dedicated Logout Button */}
          <button
            onClick={logout}
            title="Sign Out / Switch Midwife Account"
            className="flex items-center gap-1.5 text-[#64748b] hover:text-[#dc2626] bg-[#f8fafc] hover:bg-[#fef2f2] active:bg-[#fee2e2] border border-[#cbd5e1] hover:border-[#fca5a5] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-2xs cursor-pointer ml-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

