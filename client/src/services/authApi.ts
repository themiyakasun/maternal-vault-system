import type { Clinic, StaffUser, LoginResponse } from '../types/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Fallback seed directory for 100% pure client-side offline standalone execution
export const FALLBACK_CLINICS: Clinic[] = [
  {
    id: 'clinic-4b-rampur',
    code: 'PHP-4B',
    name: 'Primary Health Post 4B',
    division: 'Rampur Division',
    district: 'Rampur District',
    mohArea: 'MOH Rampur Central',
    activeMothersCount: 142,
  },
  {
    id: 'clinic-02-kandy',
    code: 'SC-KND-02',
    name: 'Sub-Center Kandy Rural',
    division: 'Kandy Division',
    district: 'Kandy District',
    mohArea: 'MOH Kandy North',
    activeMothersCount: 86,
  },
];

export const FALLBACK_STAFF: Record<string, (StaffUser & { defaultPassword: string; defaultPin?: string })[]> = {
  'clinic-4b-rampur': [
    {
      id: 'PHM-PRIYA-71',
      name: 'Sister Priya Sharma',
      title: 'Public Health Midwife (Lead)',
      role: 'phm_lead',
      clinicId: 'clinic-4b-rampur',
      clinicName: 'Primary Health Post 4B',
      avatarUrl: 'https://images.unsplash.com/photo-1594824813501-4835002b1f3c?w=120&auto=format&fit=crop&q=80',
      initials: 'PS',
      isActive: true,
      assignedBeats: ['Rampur Sector 1', 'Rampur Sector 2', 'Rampur Sector 3'],
      defaultPassword: 'Priya@Materna2026!',
      defaultPin: '1234',
    },
    {
      id: 'PHM-SUNITA-02',
      name: 'Sister Sunita Bai',
      title: 'Public Health Midwife',
      role: 'phm',
      clinicId: 'clinic-4b-rampur',
      clinicName: 'Primary Health Post 4B',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
      initials: 'SB',
      isActive: true,
      assignedBeats: ['Rampur Sector 4', 'Rampur Sector 5'],
      defaultPassword: 'Sunita@Care2026!',
      defaultPin: '5678',
    },
    {
      id: 'DOC-RAJIV-01',
      name: 'Dr. Rajiv Sen',
      title: 'MOH Medical Officer',
      role: 'doctor',
      clinicId: 'clinic-4b-rampur',
      clinicName: 'Primary Health Post 4B',
      avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120&auto=format&fit=crop&q=80',
      initials: 'RS',
      isActive: true,
      defaultPassword: 'DrRajiv@MOH2026!',
      defaultPin: '9900',
    },
  ],
  'clinic-02-kandy': [
    {
      id: 'PHM-ANJALI-14',
      name: 'Sister Anjali Perera',
      title: 'Public Health Midwife (Lead)',
      role: 'phm_lead',
      clinicId: 'clinic-02-kandy',
      clinicName: 'Sub-Center Kandy Rural',
      avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=120&auto=format&fit=crop&q=80',
      initials: 'AP',
      isActive: true,
      assignedBeats: ['Kandy Sector 1', 'Kandy Sector 2'],
      defaultPassword: 'Anjali@Kandy2026!',
      defaultPin: '2468',
    },
  ],
};

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
      // Backend offline - use in-memory fallback
    }

    return FALLBACK_CLINICS;
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

