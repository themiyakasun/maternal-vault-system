import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { StaffUser } from '../../types/auth';
import { 
  ShieldCheck, 
  Building2, 
  ChevronDown, 
  AlertCircle, 
  Lock, 
  Eye, 
  EyeOff, 
  KeyRound, 
  LogIn 
} from 'lucide-react';
import { MaternaVaultLogo } from '../Common/MaternaVaultLogo';

export const MidwifeLoginModal: React.FC = () => {
  const { 
    currentUser, 
    currentClinic, 
    clinics, 
    clinicStaff, 
    isAuthenticated, 
    isLocked, 
    loginError, 
    login, 
    unlockScreen, 
    logout, 
    switchClinic 
  } = useAuth();

  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showClinicDropdown, setShowClinicDropdown] = useState<boolean>(false);

  // Synchronize selected staff
  useEffect(() => {
    if (isLocked && currentUser) {
      setSelectedStaff(currentUser);
    } else if (clinicStaff.length > 0 && (!selectedStaff || !clinicStaff.some(s => s.id === selectedStaff.id))) {
      setSelectedStaff(clinicStaff[0]);
    } else if (clinicStaff.length === 0) {
      setSelectedStaff(null);
    }
  }, [clinicStaff, isLocked, currentUser, selectedStaff]);

  // If fully authenticated and not locked, do not render login modal
  if (isAuthenticated && !isLocked) {
    return null;
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (isLocked && currentUser) {
        const ok = await unlockScreen(password);
        if (ok) setPassword('');
      } else if (currentClinic && selectedStaff) {
        const ok = await login(currentClinic.id, selectedStaff.id, password);
        if (ok) setPassword('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#cbd5e1] max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Brand & Clinic Banner Header */}
        <div className="bg-[#004b73] text-white p-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MaternaVaultLogo size={42} variant="badge" />
              <div>
                <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                  <span>MaternaVault</span>
                  <span className="bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/30 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                    Central Portal
                  </span>
                </h2>
                <p className="text-xs text-[#cce5ff] mt-0.5">
                  {isLocked ? 'Midwife Station Locked • Enter password to resume' : 'Midwife, Clinician & Staff High-Security Sign In'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="inline-flex items-center gap-1.5 bg-[#166534] text-[#dcfce7] border border-[#22c55e]/30 text-[10.5px] font-bold px-2.5 py-1 rounded-full shadow-inner">
                <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
                <span>PBKDF2-SHA512</span>
              </div>
            </div>
          </div>

          {/* Clinic Station Switcher Ribbon */}
          <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs">
            <div className="relative">
              {!isLocked ? (
                <button
                  type="button"
                  onClick={() => setShowClinicDropdown(!showClinicDropdown)}
                  className="flex items-center gap-1.5 text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span className="font-bold">{currentClinic?.name || (clinics.length === 0 ? 'No Clinic Configured' : 'Select Clinic')}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-white/70" />
                </button>
              ) : (
                <div className="flex items-center gap-1.5 text-white/90 bg-white/10 px-2.5 py-1 rounded-lg">
                  <Building2 className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span className="font-bold">{currentClinic?.name || 'No Clinic Configured'}</span>
                </div>
              )}

              {/* Clinic Dropdown Menu */}
              {showClinicDropdown && (
                <div className="absolute top-full left-0 mt-1.5 w-64 bg-white rounded-xl shadow-2xl border border-[#cbd5e1] p-1.5 z-30 text-[#0f172a] space-y-1">
                  <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider px-2 py-1">
                    Select Clinic / Tenant
                  </div>
                  {clinics.map((clinic) => (
                    <button
                      key={clinic.id}
                      type="button"
                      onClick={() => {
                        switchClinic(clinic.id);
                        setShowClinicDropdown(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex flex-col cursor-pointer ${
                        currentClinic?.id === clinic.id ? 'bg-[#e0f2fe] text-[#004b73] font-bold' : 'hover:bg-[#f1f5f9]'
                      }`}
                    >
                      <span>{clinic.name}</span>
                      <span className="text-[10.5px] text-[#64748b] font-normal">{clinic.division} • {clinic.activeMothersCount} Mothers</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="text-[11px] text-[#cce5ff]">
              {currentClinic?.division}
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          
          {/* Error Message */}
          {loginError && (
            <div className="bg-[#fef2f2] border border-[#fca5a5] p-3 rounded-xl text-[#991b1b] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#dc2626]" />
              <span className="font-semibold">{loginError}</span>
            </div>
          )}

          {/* Locked Mode vs Switcher Mode */}
          {isLocked && currentUser ? (
            <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
              <img
                src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1594824813501-4835002b1f3c?w=120&auto=format&fit=crop&q=80'}
                alt={currentUser.name}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-[#006194]"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#0f172a]">{currentUser.name}</h3>
                  <span className="text-[10px] font-bold bg-[#dcfce7] text-[#166534] px-2 py-0.5 rounded">
                    Active Shift
                  </span>
                </div>
                <p className="text-xs text-[#64748b] mt-0.5">{currentUser.title}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="text-xs text-[#006194] hover:text-[#004f7b] font-semibold underline p-1 cursor-pointer"
              >
                Switch
              </button>
            </div>
          ) : (
            /* Staff Profile Selector Cards */
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider">
                Select Midwife / Staff Account:
              </label>
              {clinics.length === 0 ? (
                <div className="bg-[#f8fafc] border border-dashed border-[#cbd5e1] p-4 rounded-xl text-center text-xs text-[#64748b]">
                  <p className="font-semibold text-[#334155]">No clinic tenants configured on this station.</p>
                  <p className="mt-1 text-[11px]">Please add clinic tenants and staff in your cloud PostgreSQL database.</p>
                </div>
              ) : clinicStaff.length === 0 ? (
                <div className="bg-[#f8fafc] border border-dashed border-[#cbd5e1] p-4 rounded-xl text-center text-xs text-[#64748b]">
                  <p className="font-semibold text-[#334155]">No staff members found for {currentClinic?.name || 'this clinic'}.</p>
                  <p className="mt-1 text-[11px]">Please add staff accounts in your cloud database.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {clinicStaff.map((staff) => {
                    const isSelected = selectedStaff?.id === staff.id;
                    return (
                      <button
                        key={staff.id}
                        type="button"
                        onClick={() => {
                          setSelectedStaff(staff);
                          setPassword('');
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-full ${
                          isSelected
                            ? 'border-[#006194] bg-[#f0f9ff] ring-2 ring-[#006194]/20 shadow-xs'
                            : 'border-[#e2e8f0] bg-white hover:bg-[#f8fafc] hover:border-[#cbd5e1]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            <img
                              src={staff.avatarUrl || 'https://images.unsplash.com/photo-1594824813501-4835002b1f3c?w=120&auto=format&fit=crop&q=80'}
                              alt={staff.name}
                              className="w-9 h-9 rounded-full object-cover border border-[#cbd5e1]"
                            />
                            {isSelected && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#006194] text-white rounded-full flex items-center justify-center text-[9px] font-bold">
                                ✓
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-[#0f172a] truncate">{staff.name}</div>
                            <div className="text-[10px] text-[#64748b] truncate">{staff.title}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Secure Web Password Input Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0f172a] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#006194]" />
                <span>Account Password</span>
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94a3b8]">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter secure password..."
                  disabled={!selectedStaff}
                  autoFocus
                  required
                  className="w-full pl-10 pr-11 py-2.5 text-sm bg-white border border-[#cbd5e1] rounded-xl text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#006194]/20 focus:border-[#006194] transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#64748b] hover:text-[#0f172a] cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !password.trim() || !selectedStaff}
              className={`w-full py-2.5 px-4 rounded-xl text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm ${
                isSubmitting || !password.trim() || !selectedStaff
                  ? 'bg-[#94a3b8] cursor-not-allowed'
                  : 'bg-[#006194] hover:bg-[#004f7b] active:scale-[0.99] cursor-pointer shadow-md'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : isLocked ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Unlock Midwife Station</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In to MaternaVault</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Security Badge */}
          <div className="pt-2 border-t border-[#f1f5f9] flex items-center justify-between text-[10.5px] text-[#64748b]">
            <span className="flex items-center gap-1.5 text-[#047857] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#047857]" />
              <span>PBKDF2-SHA512 Salted Cryptography (100k rounds)</span>
            </span>
            <span>Tenant: {currentClinic?.code || 'PHP-4B'}</span>
          </div>

        </div>
      </div>
    </div>
  );
};
