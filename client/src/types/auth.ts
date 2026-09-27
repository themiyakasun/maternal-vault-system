export type UserRole = 'phm_lead' | 'phm' | 'doctor' | 'nurse' | 'admin';

export interface StaffUser {
  id: string; // e.g. 'PHM-PRIYA-71'
  name: string; // e.g. 'Sister Priya Sharma'
  title: string; // e.g. 'Public Health Midwife (Lead)'
  role: UserRole;
  clinicId: string; // e.g. 'clinic-4b-rampur'
  clinicName: string; // e.g. 'Primary Health Post 4B'
  avatarUrl?: string;
  initials: string;
  isActive: boolean;
  assignedBeats?: string[];
}

export interface Clinic {
  id: string; // e.g. 'clinic-4b-rampur'
  code: string; // e.g. 'PHP-4B'
  name: string; // e.g. 'Primary Health Post 4B'
  division: string; // e.g. 'Rampur Division'
  district: string; // e.g. 'Rampur District'
  mohArea: string; // e.g. 'MOH Rampur Central'
  activeMothersCount: number;
}

export interface LoginRequest {
  clinicId: string;
  staffId: string;
  password?: string;
  pin?: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  token?: string;
  expiresAt?: string;
  user?: StaffUser;
  clinic?: Clinic;
}

export interface OfflineSession {
  token: string;
  userId: string;
  clinicId: string;
  issuedAt: string;
  expiresAt: string;
}

