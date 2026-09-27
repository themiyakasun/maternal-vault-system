import type { Patient, ANCVisitInput } from '../types/triage';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const patientApi = {
  // Check health
  async checkHealth() {
    const res = await fetch(`${API_BASE}/health`, { credentials: 'include' });
    return res.json();
  },

  // Get summary stats
  async getStats() {
    const res = await fetch(`${API_BASE}/patients/stats`, { credentials: 'include' });
    return res.json();
  },

  // Get patients with query params
  async getPatients(params?: {
    search?: string;
    risk?: string;
    trimester?: string;
    sync?: string;
    condition?: string;
    tenantId?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          query.append(key, val.toString());
        }
      });
    }
    const res = await fetch(`${API_BASE}/patients?${query.toString()}`, {
      credentials: 'include',
    });
    return res.json();
  },

  // Convenience method to fetch all patients for a tenant
  async getAllPatients(tenantId?: string) {
    return this.getPatients(tenantId ? { tenantId } : undefined);
  },

  // Get single patient
  async getPatientById(id: string) {
    const encodedId = encodeURIComponent(id);
    const res = await fetch(`${API_BASE}/patients/${encodedId}`, {
      credentials: 'include',
    });
    return res.json();
  },

  // Create new patient
  async createPatient(data: Partial<Patient>) {
    const res = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Add Antenatal Clinic (ANC) visit for patient
  async addPatientClinicVisit(id: string, visitData: ANCVisitInput) {
    const encodedId = encodeURIComponent(id);
    const res = await fetch(`${API_BASE}/patients/${encodedId}/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(visitData),
    });
    return res.json();
  },

  // Update existing patient
  async updatePatient(id: string, data: Partial<Patient>) {
    const encodedId = encodeURIComponent(id);
    const res = await fetch(`${API_BASE}/patients/${encodedId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Delete patient
  async deletePatient(id: string) {
    const encodedId = encodeURIComponent(id);
    const res = await fetch(`${API_BASE}/patients/${encodedId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return res.json();
  },

  // Get synchronization status & encryption telemetry
  async getSyncStatus(tenantId?: string) {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const res = await fetch(`${API_BASE}/sync/status${query}`, {
      credentials: 'include',
    });
    return res.json();
  },

  // Pre-flight check connection to central PostgreSQL database
  async checkCentralDbConnection(tenantId?: string) {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const res = await fetch(`${API_BASE}/sync/check-connection${query}`, {
      credentials: 'include',
    });
    return res.json();
  },

  // Trigger manual push to central PostgreSQL database
  async triggerCentralDbSync(tenantId?: string) {
    const res = await fetch(`${API_BASE}/sync/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ tenantId }),
    });
    return res.json();
  },

  // Trigger manual push (alias for backward compatibility)
  async triggerSync(tenantId?: string) {
    return this.triggerCentralDbSync(tenantId);
  },

  // Get generated QR code data and mobile transfer payload
  async getPatientQRCode(id: string, mode: 'full' | 'emergency' | 'abha' | 'url' | 'gzip' | 'compressed' = 'full') {
    const encodedId = encodeURIComponent(id);
    const res = await fetch(`${API_BASE}/patients/${encodedId}/qr?mode=${mode}`, {
      credentials: 'include',
    });
    return res.json();
  },
};



