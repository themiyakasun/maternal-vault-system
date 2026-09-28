import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Clinic, StaffUser, LoginResponse } from '../types/auth';
import { authApi, FALLBACK_CLINICS } from '../services/authApi';

interface AuthContextType {
  currentUser: StaffUser | null;
  currentClinic: Clinic | null;
  clinics: Clinic[];
  clinicStaff: StaffUser[];
  isAuthenticated: boolean;
  isLocked: boolean;
  loginError: string | null;
  isLoading: boolean;
  login: (clinicId: string, staffId: string, password: string) => Promise<boolean>;
  unlockScreen: (password: string) => Promise<boolean>;
  lockScreen: () => void;
  logout: () => Promise<void>;
  switchClinic: (clinicId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [currentClinic, setCurrentClinic] = useState<Clinic | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>(FALLBACK_CLINICS);
  const [clinicStaff, setClinicStaff] = useState<StaffUser[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize clinics and restore session via httpCookie on boot (zero localStorage)
  useEffect(() => {
    const initAuth = async () => {
      try {
        const fetchedClinics = await authApi.getClinics();
        setClinics(fetchedClinics);

        // Check active session via backend httpOnly cookie
        const session = await authApi.getMe();

        if (session.success && session.user && session.clinic) {
          setCurrentUser(session.user);
          setCurrentClinic(session.clinic);
          setIsAuthenticated(true);
          setIsLocked(false);

          const staffList = await authApi.getStaffForClinic(session.clinic.id);
          setClinicStaff(staffList || []);
        } else {
          // Default to first clinic in list (unauthenticated state)
          const defaultClinic = fetchedClinics[0] || FALLBACK_CLINICS[0];
          setCurrentClinic(defaultClinic);
          const staffList = await authApi.getStaffForClinic(defaultClinic.id);
          setClinicStaff(staffList || []);
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error('Failed to initialize auth state:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Switch clinic station
  const switchClinic = useCallback(async (clinicId: string) => {
    const clinic = clinics.find((c) => c.id === clinicId) || FALLBACK_CLINICS.find((c) => c.id === clinicId) || null;
    if (clinic) {
      setCurrentClinic(clinic);
      try {
        const staffList = await authApi.getStaffForClinic(clinic.id);
        setClinicStaff(staffList || []);
      } catch {
        setClinicStaff([]);
      }
    }
  }, [clinics]);

  // Login handler with httpCookie response
  const login = useCallback(async (clinicId: string, staffId: string, password: string): Promise<boolean> => {
    setLoginError(null);
    setIsLoading(true);

    try {
      const res: LoginResponse = await authApi.loginWithPassword(clinicId, staffId, password);

      if (res.success && res.user && res.clinic) {
        setCurrentUser(res.user);
        setCurrentClinic(res.clinic);
        setIsAuthenticated(true);
        setIsLocked(false);
        setIsLoading(false);
        return true;
      } else {
        setLoginError(res.message || 'Login failed. Please verify your password.');
        setIsLoading(false);
        return false;
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Error authenticating user credentials.');
      setIsLoading(false);
      return false;
    }
  }, []);

  // Quick Unlock with Password
  const unlockScreen = useCallback(async (password: string): Promise<boolean> => {
    if (!currentUser || !currentClinic) return false;
    setLoginError(null);

    const res = await authApi.loginWithPassword(currentClinic.id, currentUser.id, password);
    if (res.success) {
      setIsLocked(false);
      return true;
    } else {
      setLoginError(res.message || 'Incorrect password.');
      return false;
    }
  }, [currentUser, currentClinic]);

  // Lock station screen
  const lockScreen = useCallback(() => {
    setIsLocked(true);
  }, []);

  // Full logout: clears backend httpOnly cookie and in-memory state
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore network errors
    }
    setCurrentUser(null);
    setIsAuthenticated(false);
    setIsLocked(false);
    setLoginError(null);
  }, []);

  // 15-minute Inactivity Auto-Lock Timer for field tablet security
  useEffect(() => {
    if (!isAuthenticated || isLocked) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      // Auto-lock after 15 minutes of inactivity (900,000 ms)
      timeoutId = setTimeout(() => {
        setIsLocked(true);
      }, 15 * 60 * 1000);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [isAuthenticated, isLocked]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentClinic,
        clinics,
        clinicStaff,
        isAuthenticated,
        isLocked,
        loginError,
        isLoading,
        login,
        unlockScreen,
        lockScreen,
        logout,
        switchClinic,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
