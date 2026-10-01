import type { Patient, ANCVisitInput } from '../types/triage';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

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

  // Check duplicate NIC against local and cloud databases
  async checkNic(nic: string, clinicId?: string, excludeId?: string) {
    const params = new URLSearchParams({ nic });
    if (clinicId) params.append('clinicId', clinicId);
    if (excludeId) params.append('excludeId', excludeId);
    const res = await fetch(`${API_BASE}/patients/check-nic?${params.toString()}`, {
      credentials: 'include',
    });
    return res.json();
  },

  // Create new patient
  async createPatient(data: Partial<Patient>, tenantId?: string) {
    const tid = tenantId || data.tenantId || data.clinicId || '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (tid) headers['x-tenant-id'] = tid;

    const res = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Add Antenatal Clinic (ANC) visit for patient
  async addPatientClinicVisit(id: string, visitData: ANCVisitInput, tenantId?: string) {
    const encodedId = encodeURIComponent(id);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (tenantId) headers['x-tenant-id'] = tenantId;

    const res = await fetch(`${API_BASE}/patients/${encodedId}/visits`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(visitData),
    });
    return res.json();
  },

  // Update existing patient
  async updatePatient(id: string, data: Partial<Patient>, tenantId?: string) {
    const encodedId = encodeURIComponent(id);
    const tid = tenantId || data.tenantId || data.clinicId || '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (tid) headers['x-tenant-id'] = tid;

    const res = await fetch(`${API_BASE}/patients/${encodedId}`, {
      method: 'PUT',
      headers,
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Delete patient
  async deletePatient(id: string, tenantId?: string) {
    const encodedId = encodeURIComponent(id);
    const headers: Record<string, string> = {};
    if (tenantId) headers['x-tenant-id'] = tenantId;
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';

    const res = await fetch(`${API_BASE}/patients/${encodedId}${query}`, {
      method: 'DELETE',
      headers,
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

  // Trigger manual push to central PostgreSQL database (Section 4.6.3 Step 3)
  async triggerCentralDbSync(tenantId?: string) {
    const syncKey = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': syncKey,
    };
    if (tenantId) {
      headers['X-Station-Key'] = tenantId;
      headers['x-tenant-id'] = tenantId;
    }

    const res = await fetch(`${API_BASE}/sync/trigger`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ tenantId, uuid: syncKey, timestamp: new Date().toISOString() }),
    });
    return res.json();
  },

  // Dispatch batched offline mutations to server queue (Section 4.6.3 Step 3: HTTPS POST /sync/queue)
  async dispatchSyncQueue(payload: { uuid: string; mutations: any[]; clinicId?: string }) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': payload.uuid,
    };
    if (payload.clinicId) {
      headers['X-Station-Key'] = payload.clinicId;
      headers['x-tenant-id'] = payload.clinicId;
    }

    const res = await fetch(`${API_BASE}/sync/queue`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(payload),
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



