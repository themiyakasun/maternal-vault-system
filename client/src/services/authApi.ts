import type { Clinic, StaffUser, LoginResponse } from '../types/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Fallback clinics array (empty by default; populated from backend/cloud DB)
export const FALLBACK_CLINICS: Clinic[] = [];

export const FALLBACK_STAFF: Record<string, (StaffUser & { defaultPassword?: string; defaultPin?: string })[]> = {};

export const authApi = {
  /**
   * Fetch all clinics from backend
   */
  async getClinics(): Promise<Clinic[]> {
    try {
      const res = await fetch(`${API_BASE}/auth/clinics`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data;
        }
      }
    } catch {
      // Backend offline
    }

    return [];
  },

  /**
   * Fetch staff members for selected clinic
   */
  async getStaffForClinic(clinicId: string): Promise<StaffUser[]> {
    try {
      const res = await fetch(`${API_BASE}/auth/clinics/${encodeURIComponent(clinicId)}/staff`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data;
        }
      }
    } catch {
      // Backend offline - use in-memory fallback
    }

    const staffList = FALLBACK_STAFF[clinicId] || [];
    return staffList.map(({ defaultPassword, defaultPin, ...safeUser }) => safeUser);
  },

  /**
   * Authenticate staff with high-security password
   * Sets httpOnly session cookie in the browser
   */
  async loginWithPassword(clinicId: string, staffId: string, password: string): Promise<LoginResponse> {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ clinicId, staffId, password }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          return json;
        }
      } else {
        const errJson = await res.json().catch(() => null);
        if (errJson && errJson.message) {
          return { success: false, message: errJson.message };
        }
      }
    } catch {
      // Backend offline - Execute local standalone in-memory verifier
    }

    // Local standalone offline verifier fallback (in-memory)
    const clinic = FALLBACK_CLINICS.find((c) => c.id === clinicId);
    const staffList = FALLBACK_STAFF[clinicId] || [];
    const staff = staffList.find((s) => s.id === staffId);

    if (!clinic || !staff) {
      return { success: false, message: 'User or clinic not found.' };
    }

    const trimmedInput = password.trim();
    const isMatched = 
      (staff.defaultPassword && staff.defaultPassword === trimmedInput) ||
      (staff.defaultPin && staff.defaultPin === trimmedInput);

    if (!isMatched) {
      return { success: false, message: 'Incorrect password. Please try again.' };
    }

    const { defaultPassword, defaultPin, ...safeUser } = staff;
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    return {
      success: true,
      message: `Welcome back, ${staff.name}`,
      expiresAt,
      user: safeUser,
      clinic,
    };
  },

  /**
   * Validate current session via httpOnly cookie on backend
   */
  async getMe(): Promise<{ success: boolean; user?: StaffUser; clinic?: Clinic; expiresAt?: string; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => null);
      return { success: false, message: err?.message || 'Session expired or not found.' };
    } catch {
      return { success: false, message: 'Network offline.' };
    }
  },

  /**
   * Log out and clear httpOnly cookie
   */
  async logout(): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Ignore network errors
    }
    return { success: true, message: 'Logged out.' };
  },

  /**
   * Dynamically register a new midwife or staff user
   */
  async createStaff(data: {
    id?: string;
    name: string;
    title: string;
    role: string;
    clinicId: string;
    password: string;
    avatarUrl?: string;
    assignedBeats?: string[];
  }) {
    try {
      const res = await fetch(`${API_BASE}/auth/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      return res.json();
    } catch {
      return { success: false, message: 'Could not connect to server to register staff.' };
    }
  },

  /**
   * Backward-compatible alias
   */
  async loginWithPin(clinicId: string, staffId: string, pin: string): Promise<LoginResponse> {
    return this.loginWithPassword(clinicId, staffId, pin);
  },
};

