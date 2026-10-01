import React from 'react';
import { 
  Users, 
  HeartPulse, 
  Database, 
  BookOpen, 
  Sliders, 
  ShieldCheck,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MaternaVaultLogo } from './Common/MaternaVaultLogo';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenIntake?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const { currentClinic, currentUser } = useAuth();
  const isDoctor = currentUser?.role === 'doctor' || currentUser?.role === 'admin';

  const navItems = [
    { id: 'records', label: 'Maternal Records', icon: Users, badge: null },
    { 
      id: 'triage', 
      label: isDoctor ? 'Divisional High-Risk Queue' : 'Priority Care Queue', 
      icon: HeartPulse,
      badge: isDoctor ? 'UC-06 Doctor' : 'PHM Field'
    },
    { id: 'mesh-logs', label: 'System & Cloud Sync', icon: Database, badge: null },
    { id: 'diagnostics', label: 'Clinical Health Guides', icon: BookOpen, badge: null },
    { id: 'settings', label: 'Clinic Settings', icon: Sliders, badge: null },
  ];

  const handleSelectNav = (id: string) => {
    setActiveTab(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const stationSubtitle = currentUser?.role === 'doctor'
    ? 'MOH Supervisory Station'
    : currentUser?.role === 'admin'
    ? 'District Admin Console'
    : 'Midwife Clinic Station';

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full select-none bg-[#f8fafc]">
      {/* Brand Header */}
      <div>
        <div className="p-4 sm:p-5 border-b border-[#e2e8f0] flex items-center justify-between bg-[#faf8ff]">
          <div className="flex items-center gap-3">
            <MaternaVaultLogo 
              size={38} 
              variant="badge" 
              showText 
              subtitle={stationSubtitle} 
            />
          </div>

          {/* Close button on mobile drawer */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-[#eaedff] transition-colors cursor-pointer"
              title="Close Menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Menu */}
        <div className="p-3">
          <div className="px-3 pt-3 pb-2 text-[10px] font-bold text-[#707881] uppercase tracking-wider flex items-center justify-between">
            <span>{isDoctor ? 'MOH Doctor Console' : 'Midwife Workstation'}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
              isDoctor ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {currentUser?.role || 'phm'}
            </span>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectNav(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-xs font-semibold transition-all duration-150 text-left cursor-pointer active:scale-98 ${
                    isActive
                      ? 'bg-[#006194] text-white shadow-xs'
                      : 'text-[#334155] hover:bg-[#eaedff] hover:text-[#006194]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#707881]'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      isActive 
                        ? 'bg-white/20 text-white' 
                        : isDoctor ? 'bg-purple-50 text-purple-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Storage & Offline Protection Footer Widget */}
      <div className="p-3 pb-safe">
        <div className="bg-[#eaedff]/70 border border-[#cbd5e1] rounded-xl p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-[#006194] font-semibold text-xs">
            <ShieldCheck className="w-4 h-4 text-[#006194]" />
            <span className="text-[12px] font-bold tracking-tight">Offline Safety Active</span>
          </div>
          
          <div className="text-[11px] text-[#334155] leading-relaxed">
            All records safely protected on this tablet. Works anytime without internet.
          </div>

          <div className="pt-2 border-t border-[#dae2fd] flex items-center justify-between text-[10.5px]">
            <span className="text-[#707881] font-medium">Clinic Area:</span>
            <span className="font-bold text-[#006194] tracking-tight truncate max-w-[120px]">{currentClinic?.division || 'Rampur Division'}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden md:flex w-64 bg-[#f8fafc] border-r border-[#e2e8f0] flex-col justify-between h-screen shrink-0 sticky top-0 select-none">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Out Drawer Overlay */}
      {isOpenMobile && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={onCloseMobile}
          />
          {/* Drawer Container */}
          <div className="relative w-4/5 max-w-xs h-full bg-[#f8fafc] shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
