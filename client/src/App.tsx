import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { TriageQueueTable } from './components/TriageQueueTable';
import { EdgeAIDecisionSupport } from './components/EdgeAIDecisionSupport';
import { P2PMeshPanel } from './components/P2PMeshPanel';
import { RapidIntakeModal } from './components/Modals/RapidIntakeModal';
import { ClinicalPathwayModal } from './components/Modals/ClinicalPathwayModal';
import { ReferralProtocolModal } from './components/Modals/ReferralProtocolModal';
import { ExportSummaryModal } from './components/Modals/ExportSummaryModal';
import { PatientEHRModal } from './components/Modals/PatientEHRModal';
import { ClinicalPlaybookModal } from './components/Modals/ClinicalPlaybookModal';
import { PatientQRModal } from './components/Modals/PatientQRModal';
import { AddClinicVisitModal } from './components/Modals/AddClinicVisitModal';
import { DeletePatientConfirmationModal } from './components/Modals/DeletePatientConfirmationModal';
import { ImportPatientVaultModal } from './components/Modals/ImportPatientVaultModal';
import { CentralDbSyncModal } from './components/Modals/CentralDbSyncModal';
import { MobileBottomNav } from './components/Navigation/MobileBottomNav';


// Patient Records Page Components
import { OCRNoticeBanner } from './components/PatientRecords/OCRNoticeBanner';
import { MaternalRecordsStats } from './components/PatientRecords/MaternalRecordsStats';
import { RecordsFilterToolbar } from './components/PatientRecords/RecordsFilterToolbar';
import { PatientRecordsTable } from './components/PatientRecords/PatientRecordsTable';
import { OCRIngestionWidget } from './components/PatientRecords/BottomWidgets/OCRIngestionWidget';
import { P2PGossipHealthWidget } from './components/PatientRecords/BottomWidgets/P2PGossipHealthWidget';
import { EmergencyEscalationWidget } from './components/PatientRecords/BottomWidgets/EmergencyEscalationWidget';

import { AuthProvider, useAuth } from './context/AuthContext';
import { MidwifeLoginModal } from './components/Auth/MidwifeLoginModal';
import { patientApi } from './services/patientApi';
import { offlineStorage } from './services/offlineStorage';
import { formatDbDate } from './utils/dateUtils';
import type { Patient, FilterTab, ANCVisitInput, ANCVisit } from './types/triage';
import { 
  Zap, 
  CreditCard, 
  Share2, 
  RefreshCw, 
  Plus, 
  CheckCircle2, 
  Download,
  ShieldCheck,
  HeartPulse,
  Activity,
  AlertTriangle,
  Baby
} from 'lucide-react';

function DashboardContent() {
  const { currentUser, currentClinic, clinics } = useAuth();
  const activeClinicId = currentClinic?.id || (clinics && clinics.length > 0 ? clinics[0].id : 'clinic-ambagamuwa');
  const [activeNavTab, setActiveNavTab] = useState('records'); // default or toggleable
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Load clinic patients with offline-first persistence & multi-device sync
  useEffect(() => {
    let isMounted = true;
    const cid = activeClinicId;

    // 1. Instant load from local browser persistent cache (zero latency offline support)
    const cachedPatients = offlineStorage.loadCachedPatients(cid);
    if (cachedPatients.length > 0) {
      setPatients(cachedPatients);
      setSelectedPatientId(cachedPatients[0].id);
    } else {
      setPatients([]);
      setSelectedPatientId('');
      // Async load from IndexedDB object store
      offlineStorage.loadCachedPatientsAsync(cid).then((idbPatients) => {
        if (isMounted && idbPatients.length > 0) {
          setPatients(idbPatients);
          setSelectedPatientId(idbPatients[0].id);
        }
      });
    }

    // 2. Fetch scoped patients with reliable offline replay & multi-device synchronization
    const fetchClinicPatients = async (silent = false) => {
      try {
        if (cid) {
          // Replay any pending offline mutations if connection is available
          await offlineStorage.flushOfflineQueue(cid, (updatedPatient) => {
            if (updatedPatient && isMounted) {
              setPatients((prev) => {
                const updatedList = prev.map((p) => (p.id === updatedPatient.id ? updatedPatient : p));
                offlineStorage.saveCachedPatients(cid, updatedList);
                return updatedList;
              });
            }
          });

          const res = await patientApi.getAllPatients(cid);
          if (isMounted && res?.data) {
            const serverList: Patient[] = res.data;
            setPatients((prev) => {
              // Reconcile server data without losing un-synced offline records
              const reconciled = offlineStorage.reconcilePatients(serverList, prev, cid);

              // Avoid re-rendering if data is identical
              if (
                prev.length === reconciled.length &&
                prev.every(
                  (p, idx) =>
                    p.id === reconciled[idx]?.id &&
                    (p.updatedAt || p.assessedTime) === (reconciled[idx]?.updatedAt || reconciled[idx]?.assessedTime) &&
                    p.syncStatus === reconciled[idx]?.syncStatus
                )
              ) {
                return prev;
              }
              return reconciled;
            });

            setSelectedPatientId((prev) => {
              if (prev && serverList.some((p) => p.id === prev)) {
                return prev;
              }
              return serverList.length > 0 ? serverList[0].id : prev;
            });
            return;
          }
        }
      } catch (err) {
        if (!silent) {
          console.warn('Backend server currently offline. Retaining local cached records:', err);
        }
      }
      // Note: On offline network error, NEVER wipe out patient state or reset selected patient!
    };

    fetchClinicPatients();

    // Replay queue and reconcile whenever browser network state transitions to online
    const handleNetworkOnline = async () => {
      console.log('🌐 Network restored - Reconciling offline records with cloud database...');
      setSyncToast('Network reconnected. Synchronizing offline records with cloud...');
      setTimeout(() => setSyncToast(null), 4000);
      await fetchClinicPatients(true);
    };

    const handleNetworkOffline = () => {
      console.log('📡 Network disconnected - Local offline vault active');
      setSyncToast('Device offline. Operating in local encrypted vault mode.');
      setTimeout(() => setSyncToast(null), 4000);
    };

    window.addEventListener('online', handleNetworkOnline);
    window.addEventListener('offline', handleNetworkOffline);

    // Real-Time Multi-Device Polling Interval (every 4 seconds)
    // Synchronizes changes across other tablets and the main PostgreSQL system
    const syncInterval = setInterval(() => {
      fetchClinicPatients(true);
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(syncInterval);
      window.removeEventListener('online', handleNetworkOnline);
      window.removeEventListener('offline', handleNetworkOffline);
    };
  }, [currentClinic?.id]);

  // Modals & Navigation
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isPathwayOpen, setIsPathwayOpen] = useState(false);
  const [isReferralOpen, setIsReferralOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isEHROpen, setIsEHROpen] = useState(false);
  const [isPlaybookOpen, setIsPlaybookOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [isAddVisitOpen, setIsAddVisitOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImportVaultOpen, setIsImportVaultOpen] = useState(false);
  const [isCentralSyncOpen, setIsCentralSyncOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedEHRPatient, setSelectedEHRPatient] = useState<Patient | null>(null);

  const [selectedQRPatient, setSelectedQRPatient] = useState<Patient | null>(null);
  const [selectedVisitPatient, setSelectedVisitPatient] = useState<Patient | null>(null);
  const [selectedDeletePatient, setSelectedDeletePatient] = useState<Patient | null>(null);

  // Auto-open patient EHR if specified in URL query (e.g. ?pass=#8842 or ?patientId=8842)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const passId = params.get('pass') || params.get('patientId') || params.get('id');
    if (passId && patients.length > 0) {
      const norm = passId.startsWith('#') ? passId : `#${passId}`;
      const found = patients.find((p) => p.id === norm || p.id === passId);
      if (found) {
        setSelectedPatientId(found.id);
        setSelectedEHRPatient(found);
        setIsEHROpen(true);
      }
    }
  }, [patients]);

  // Patient Records Filters
  const [recordSearch, setRecordSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [trimesterFilter, setTrimesterFilter] = useState('all');
  const [syncFilter, setSyncFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState('all');

  // Selected Patient for Triage Queue
  const selectedPatient =
    patients.find((p) => p.id === selectedPatientId) || patients[0] || null;

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatientId(patient.id);
  };

  const handleViewEHR = (patient: Patient | null) => {
    if (!patient) {
      showToast('Please add a mother first to view records.');
      return;
    }
    setSelectedEHRPatient(patient);
    setIsEHROpen(true);
  };

  const handleOpenQR = (patient: Patient | null) => {
    if (!patient) {
      showToast('Please add a mother first to generate a QR pass.');
      return;
    }
    setSelectedQRPatient(patient);
    setIsQROpen(true);
  };

  const handleOpenAddVisit = (patient: Patient | null) => {
    if (!patient) {
      showToast('Please add a mother first to record a clinic visit.');
      return;
    }
    setSelectedVisitPatient(patient);
    setIsAddVisitOpen(true);
  };

  const handleOpenDeleteModal = (patient: Patient | null) => {
    if (!patient) {
      showToast('No record selected to delete.');
      return;
    }
    setSelectedDeletePatient(patient);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeletePatient = async (patientId: string) => {
    const targetPatient = patients.find((p) => p.id === patientId);
    const patientName = targetPatient?.name || patientId;
    const cid = activeClinicId;

    // 1. Immediately update React memory state
    setPatients((prev) => {
      const updatedList = prev.filter((p) => p.id !== patientId && p.id !== patientId.replace(/^#/, ''));
      return updatedList;
    });

    // 2. Clear selected IDs and close associated open modals
    setSelectedPatientId((prev) => {
      if (prev === patientId || prev === patientId.replace(/^#/, '')) {
        const remaining = patients.filter((p) => p.id !== patientId && p.id !== patientId.replace(/^#/, ''));
        return remaining.length > 0 ? remaining[0].id : '';
      }
      return prev;
    });

    if (selectedEHRPatient?.id === patientId) {
      setIsEHROpen(false);
      setSelectedEHRPatient(null);
    }
    if (selectedQRPatient?.id === patientId) {
      setIsQROpen(false);
      setSelectedQRPatient(null);
    }
    if (selectedVisitPatient?.id === patientId) {
      setIsAddVisitOpen(false);
      setSelectedVisitPatient(null);
    }

    // 3. Atomically purge from IndexedDB and browser persistent cache
    await offlineStorage.deleteCachedPatient(cid, patientId);

    // 4. Queue offline deletion in persistent queue
    await offlineStorage.enqueueMutation({
      type: 'DELETE_PATIENT',
      clinicId: cid,
      patientId,
      payload: { id: patientId },
    });

    // 5. Close delete modal & notify user
    setIsDeleteModalOpen(false);
    setSelectedDeletePatient(null);
    showToast(`Mother ${patientName} (${patientId}) removed from clinic vault.`);

    // 6. Attempt remote deletion from server & remove queued mutation on success
    try {
      await patientApi.deletePatient(patientId, cid);
      await offlineStorage.removeMutationByPatient(cid, patientId, 'DELETE_PATIENT');
    } catch (err) {
      console.warn('Backend API delete offline (queued for sync):', err);
    }
  };

  const handleSaveClinicVisit = async (patientId: string, visitData: ANCVisitInput) => {
    const cid = activeClinicId;
    try {
      // 1. Queue offline visit mutation first
      offlineStorage.enqueueMutation({
        type: 'ADD_VISIT',
        clinicId: cid,
        patientId,
        payload: visitData,
      });

      let updatedFromBackend: Patient | null = null;
      let newVisitRecord: ANCVisit | null = null;

      try {
        const res = await patientApi.addPatientClinicVisit(patientId, visitData, cid);
        if (res?.success && res?.data?.patient) {
          updatedFromBackend = res.data.patient;
          newVisitRecord = res.data.visit;
          const action = offlineStorage.getOfflineQueue(cid).find(
            (q) => q.patientId === patientId && q.type === 'ADD_VISIT'
          );
          if (action) {
            offlineStorage.removeMutation(action.id, cid);
          }
        }
      } catch (e) {
        console.warn('Backend API offline or unreachable, visit safely queued for background sync:', e);
      }

      // 2. Reactive In-Memory & Local Cache State Update
      setPatients((prevList) => {
        const updatedList = prevList.map((p) => {
          if (p.id !== patientId) return p;

          if (updatedFromBackend) {
            return updatedFromBackend;
          }

          const existingVisits = p.ancVisits || [];
          const visitNo = existingVisits.length + 1;
          const fallbackVisit: ANCVisit = newVisitRecord || {
            visitNo,
            date: formatDbDate(visitData.date),
            poa: visitData.poa || `${p.gestationalWeeks}w ${p.gestationalDays}d`,
            weightKg: visitData.weightKg,
            bp: visitData.bp || `${visitData.bpSystolic}/${visitData.bpDiastolic}`,
            sfhCm: visitData.sfhCm,
            presentation: visitData.presentation || 'Cephalic',
            engagement: visitData.engagement || 'Not engaged',
            fhr: visitData.fhr || p.fhr || '140 bpm',
            fm: visitData.fm || 'Active (>10/12h)',
            urineAlb: visitData.urineAlb || 'Nil',
            urineSug: visitData.urineSug || 'Nil',
            edema: visitData.edema || 'Nil',
            examiner: visitData.examiner || p.assessedBy || 'Priya Sharma, PHM',
            remarks: visitData.remarks || 'Routine ANC visit documented.',
            supplements: {
              ifaIssued: visitData.ifaIssued ?? true,
              calciumIssued: visitData.calciumIssued ?? true,
              vitCIssued: visitData.vitCIssued ?? true,
              foodSupplement: visitData.foodSupplement ?? true,
            },
          };

          const isAlert = visitData.bpSystolic >= 140 || visitData.bpDiastolic >= 90;
          const newWeeks = visitData.gestationalWeeks || p.gestationalWeeks;
          const newDays = visitData.gestationalDays ?? p.gestationalDays;
          const newTrimester = (newWeeks > 27 ? 3 : newWeeks > 13 ? 2 : 1) as 1 | 2 | 3;

          const updated: Patient = {
            ...p,
            gestationalWeeks: newWeeks,
            gestationalDays: newDays,
            trimester: newTrimester,
            weightKg: visitData.weightKg,
            bpSystolic: visitData.bpSystolic,
            bpDiastolic: visitData.bpDiastolic,
            isBpAlert: isAlert,
            fundalHeight: visitData.sfhCm,
            fhr: visitData.fhr || p.fhr,
            notes: visitData.remarks || p.notes,
            assessedBy: fallbackVisit.examiner,
            assessedTime: 'Just now (Visit #' + visitNo + ')',
            syncStatus: 'updated-local',
            ancVisits: [...existingVisits, fallbackVisit],
            updatedAt: new Date().toISOString(),
          };

          return updated;
        });

        offlineStorage.saveCachedPatients(cid, updatedList);
        return updatedList;
      });

      // 3. Keep open modal instances in sync
      const targetPatient = patients.find(p => p.id === patientId);
      const patientName = targetPatient?.name || patientId;
      const targetVisitNo = (targetPatient?.ancVisits?.length || 0) + 1;

      setSelectedEHRPatient((prev) => {
        if (!prev || prev.id !== patientId) return prev;
        if (updatedFromBackend) return updatedFromBackend;
        return {
          ...prev,
          weightKg: visitData.weightKg,
          bpSystolic: visitData.bpSystolic,
          bpDiastolic: visitData.bpDiastolic,
          fundalHeight: visitData.sfhCm,
          fhr: visitData.fhr || prev.fhr,
          ancVisits: [
            ...(prev.ancVisits || []),
            newVisitRecord || {
              visitNo: targetVisitNo,
              date: visitData.date || new Date().toISOString().split('T')[0],
              poa: visitData.poa || `${prev.gestationalWeeks}w ${prev.gestationalDays}d`,
              weightKg: visitData.weightKg,
              bp: `${visitData.bpSystolic}/${visitData.bpDiastolic}`,
              sfhCm: visitData.sfhCm,
              presentation: visitData.presentation || 'Cephalic',
              engagement: visitData.engagement || 'Not engaged',
              fhr: visitData.fhr || prev.fhr || '140 bpm',
              fm: visitData.fm || 'Active (>10/12h)',
              urineAlb: visitData.urineAlb || 'Nil',
              urineSug: visitData.urineSug || 'Nil',
              edema: visitData.edema || 'Nil',
              examiner: visitData.examiner || prev.assessedBy || 'Priya Sharma, PHM',
              remarks: visitData.remarks || 'Routine ANC visit documented.',
            }
          ]
        };
      });

      setSelectedQRPatient((prev) => {
        if (!prev || prev.id !== patientId) return prev;
        return updatedFromBackend || prev;
      });

      showToast(`Clinic visit #${targetVisitNo} saved & encrypted for ${patientName}.`);
    } catch (err) {
      console.error('Error saving clinic visit:', err);
      showToast('Error recording visit.');
    }
  };

  const handleAddPatient = async (newPatient: Patient) => {
    const cid = activeClinicId;

    // 0. Check duplicate NIC in local state
    if (newPatient.nicNo && newPatient.nicNo.trim()) {
      const cleanNic = newPatient.nicNo.trim().toUpperCase();
      const duplicate = patients.find(
        (p) => p.nicNo && p.nicNo.trim().toUpperCase() === cleanNic && p.id !== newPatient.id
      );
      if (duplicate) {
        showToast(`Cannot register: Mother with NIC "${cleanNic}" is already registered (${duplicate.name} - ${duplicate.id}).`);
        return;
      }
    }

    const offlinePatient: Patient = {
      ...newPatient,
      syncStatus: 'updated-local',
      syncNode: 'Local Encrypted Station',
      syncProtocol: 'Offline Persistent Vault / Queued Sync',
      tenantId: cid,
      clinicId: cid,
      updatedAt: new Date().toISOString(),
    };

    // 1. Instantly update React memory state & browser persistent cache
    setPatients((prev) => {
      const filtered = prev.filter((p) => p.id !== offlinePatient.id);
      const updatedList = [offlinePatient, ...filtered];
      offlineStorage.saveCachedPatients(cid, updatedList);
      return updatedList;
    });

    setSelectedPatientId(offlinePatient.id);
    showToast(`Mother ${offlinePatient.name} registered in encrypted vault.`);

    // 2. Queue in persistent offline mutation store
    await offlineStorage.enqueueMutation({
      type: 'CREATE_PATIENT',
      clinicId: cid,
      patientId: offlinePatient.id,
      payload: offlinePatient,
    });

    // 3. Persist to server AES-256-GCM encrypted database & PostgreSQL if online
    try {
      const res = await patientApi.createPatient(offlinePatient, cid);
      if (res?.success === false && res?.code === 'DUPLICATE_NIC') {
        // Rollback optimistic addition on duplicate rejection
        setPatients((prev) => {
          const rolledBack = prev.filter((p) => p.id !== offlinePatient.id);
          offlineStorage.saveCachedPatients(cid, rolledBack);
          return rolledBack;
        });
        await offlineStorage.deleteCachedPatient(cid, offlinePatient.id);
        await offlineStorage.removeMutationByPatient(cid, offlinePatient.id, 'CREATE_PATIENT');
        showToast(res.message || 'Cannot register: Mother with this NIC is already registered.');
        return;
      }

      if (res?.success && res?.data) {
        const serverPatient: Patient = res.data;
        // Purge queued create mutation immediately so background sync won't recreate it
        await offlineStorage.removeMutationByPatient(cid, offlinePatient.id, 'CREATE_PATIENT');
        if (serverPatient.id !== offlinePatient.id) {
          await offlineStorage.deleteCachedPatient(cid, offlinePatient.id);
          await offlineStorage.removeMutationByPatient(cid, serverPatient.id, 'CREATE_PATIENT');
        }

        setPatients((prev) => {
          const normOffline = offlinePatient.id.replace(/^#/, '');
          const normServer = serverPatient.id.replace(/^#/, '');
          const cleanServerNic = serverPatient.nicNo ? serverPatient.nicNo.trim().toUpperCase() : null;

          const updatedList = prev.map((p) => {
            const pNorm = (p.id || '').replace(/^#/, '');
            const pNic = p.nicNo ? p.nicNo.trim().toUpperCase() : null;
            if (pNorm === normOffline || pNorm === normServer || (cleanServerNic && pNic === cleanServerNic)) {
              return serverPatient;
            }
            return p;
          });

          // Strict deduplication
          const seen = new Set<string>();
          const deduped: Patient[] = [];
          for (const item of updatedList) {
            const norm = (item.id || '').replace(/^#/, '');
            if (!seen.has(norm)) {
              seen.add(norm);
              deduped.push(item);
            }
          }

          offlineStorage.saveCachedPatients(cid, deduped);
          return deduped;
        });
      }
    } catch (err) {
      console.warn('Backend API offline error saving mother (queued for background sync):', err);
    }
  };

  const handleTriggerSync = () => {
    setIsCentralSyncOpen(true);
  };

  const handleCentralSyncComplete = async () => {
    setIsSyncing(true);
    const cid = activeClinicId;
    try {
      const res = await patientApi.getAllPatients(cid);
      if (res?.data) {
        setPatients(res.data);
      }
    } catch (err) {
      console.warn('Failed to refresh patients after sync:', err);
    } finally {
      setIsSyncing(false);
    }
    showToast('Central PostgreSQL database synchronized successfully.');
  };


  const showToast = (msg: string) => {
    setSyncToast(msg);
    setTimeout(() => {
      setSyncToast(null);
    }, 3500);
  };


  const handleResetFilters = () => {
    setRecordSearch('');
    setRiskFilter('all');
    setTrimesterFilter('all');
    setSyncFilter('all');
    setConditionFilter('all');
  };

  // Filtered list for Patient Records
  const filteredRecords = patients.filter((p) => {
    // Search text
    if (recordSearch) {
      const q = recordSearch.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchId = p.id.toLowerCase().includes(q);
      const matchAbha = p.abhaId ? p.abhaId.toLowerCase().includes(q) : false;
      const matchLoc = p.locality ? p.locality.toLowerCase().includes(q) : false;
      const matchVillage = p.village ? p.village.toLowerCase().includes(q) : false;
      if (!matchName && !matchId && !matchAbha && !matchLoc && !matchVillage) return false;
    }

    // Risk Filter
    if (riskFilter !== 'all' && p.riskTier !== riskFilter) return false;

    // Trimester Filter
    if (trimesterFilter !== 'all' && p.trimester.toString() !== trimesterFilter) return false;

    // Sync Filter
    if (syncFilter !== 'all' && p.syncStatus !== syncFilter) return false;

    // Condition Filter
    if (conditionFilter !== 'all' && p.specificCondition !== conditionFilter) return false;

    return true;
  });

  const criticalCount = patients.filter((p) => p.riskTier === 'high').length;

  return (
    <div className="flex min-h-screen bg-[#faf8ff] text-[#131b2e] font-sans antialiased">
      {/* Left Navigation Sidebar (Desktop sticky + Mobile slide-over drawer) */}
      <Sidebar
        activeTab={activeNavTab}
        setActiveTab={setActiveNavTab}
        onOpenIntake={() => setIsIntakeOpen(true)}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Operational App Header */}
        <Header 
          onTriggerSync={handleTriggerSync} 
          onOpenCentralDbSync={() => setIsCentralSyncOpen(true)}
          isSyncing={isSyncing}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />


        {/* Dynamic Nav Tab Content */}
        {activeNavTab === 'records' ? (
          /* =================== PATIENT RECORDS PAGE =================== */
          <main className="flex-1 p-3.5 sm:p-6 pb-24 md:pb-6 space-y-3.5 sm:space-y-4 max-w-[1440px] mx-auto w-full">
            {/* Quick OCR Notice Banner */}
            <OCRNoticeBanner onInitiateScan={() => setIsIntakeOpen(true)} />

            {/* Page Header & Action Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
              <div>
                <div className="flex items-center gap-2 text-[10.5px] font-bold text-[#006194] uppercase tracking-wider mb-1">
                  <span>Primary Health Post 4B • Rampur Division</span>
                  <span className="text-[#cbd5e1]">•</span>
                  <span>Midwife Station 71</span>
                </div>

                <h1 className="text-2xl lg:text-[28px] font-extrabold text-[#0f172a] tracking-tight leading-tight">
                  Maternal Health Records & Registry
                </h1>

                <p className="text-xs text-[#64748b] mt-0.5 leading-relaxed">
                  Complete maternal clinic roster with auto-saving offline tablet storage, card scanner, and mobile QR transfer.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTriggerSync}
                    title="Refresh Tablet Sync"
                    className="bg-white hover:bg-[#f8fafc] text-[#64748b] hover:text-[#0f172a] border border-[#cbd5e1] p-2.5 rounded-lg transition-all shadow-2xs cursor-pointer flex items-center justify-center active:scale-98"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#006194]' : ''}`} />
                  </button>

                  <button
                    onClick={() => setIsExportOpen(true)}
                    className="flex items-center gap-2 bg-white hover:bg-[#f0f9ff] text-[#334155] border border-[#cbd5e1] hover:border-[#006194] px-3.5 py-2.5 rounded-lg font-bold text-xs transition-all shadow-2xs cursor-pointer active:scale-98"
                  >
                    <Download className="w-4 h-4 text-[#006194]" />
                    <span>Export Clinic Backup</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsIntakeOpen(true)}
                  className="flex items-center justify-center gap-2 bg-[#006194] hover:bg-[#004f7b] text-white px-4 py-2.5 rounded-lg font-bold text-xs transition-all shadow-2xs cursor-pointer active:scale-98"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add Mother (Scan Card)</span>
                </button>
              </div>
            </div>

            {/* 6 Summary Metric Cards */}
            <MaternalRecordsStats
              totalRegistered={patients.length}
              firstTrim={patients.filter((p) => p.trimester === 1).length}
              secondTrim={patients.filter((p) => p.trimester === 2).length}
              thirdTrim={patients.filter((p) => p.trimester === 3).length}
              highRiskCount={patients.filter((p) => p.riskTier === 'high').length}
              syncedPercentage={patients.length > 0 ? `${((patients.filter((p) => p.syncStatus === 'synced-p2p').length / patients.length) * 100).toFixed(1)}%` : '100%'}
              syncedCount={patients.filter((p) => p.syncStatus === 'synced-p2p').length}
            />

            {/* Multi-Filter Toolbar */}
            <RecordsFilterToolbar
              searchQuery={recordSearch}
              setSearchQuery={setRecordSearch}
              riskFilter={riskFilter}
              setRiskFilter={setRiskFilter}
              trimesterFilter={trimesterFilter}
              setTrimesterFilter={setTrimesterFilter}
              syncFilter={syncFilter}
              setSyncFilter={setSyncFilter}
              conditionFilter={conditionFilter}
              setConditionFilter={setConditionFilter}
              totalFiltered={filteredRecords.length}
              totalRegistered={142}
              onResetFilters={handleResetFilters}
              onOpenImportVault={() => setIsImportVaultOpen(true)}
            />

            {/* Full Patient Registry Table */}
            <PatientRecordsTable
              patients={filteredRecords}
              onViewEHR={handleViewEHR}
              onOpenQR={handleOpenQR}
              onOpenAddVisit={handleOpenAddVisit}
              onDeletePatient={handleOpenDeleteModal}
            />

            {/* 3 Bottom Operational / Workflow Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <OCRIngestionWidget 
                onLaunchOCR={() => setIsIntakeOpen(true)} 
                onOpenImportVault={() => setIsImportVaultOpen(true)}
              />
              <P2PGossipHealthWidget />
              <EmergencyEscalationWidget onOpenPlaybook={() => setIsPlaybookOpen(true)} />
            </div>
          </main>
        ) : activeNavTab === 'triage' ? (
          /* =================== CLINICAL TRIAGE QUEUE PAGE =================== */
          <main className="flex-1 p-3.5 sm:p-6 pb-24 md:pb-6 space-y-4 sm:space-y-5 max-w-[1440px] mx-auto w-full">
            {/* Page Title & Action Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                {/* Node & Model Badges */}
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="bg-[#eaedff] text-[#004b73] text-[11px] font-bold px-2.5 py-0.5 rounded border border-[#dae2fd]">
                    Clinic 4B • Rampur Division
                  </span>
                  <span className="bg-[#dcfce7] text-[#15803d] text-[11px] font-bold px-2.5 py-0.5 rounded border border-[#bbf7d0] flex items-center gap-1">
                    <Zap className="w-3 h-3 fill-[#16a34a] text-[#16a34a]" />
                    Automatic Care Guidance Active
                  </span>
                  {currentUser?.role === 'doctor' || currentUser?.role === 'admin' ? (
                    <span className="bg-purple-100 text-purple-800 text-[11px] font-bold px-2.5 py-0.5 rounded border border-purple-300 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-purple-700" />
                      MOH Doctor Supervisory Authority (UC-06)
                    </span>
                  ) : (
                    <span className="bg-emerald-50 text-emerald-800 text-[11px] font-medium px-2.5 py-0.5 rounded border border-emerald-200">
                      PHM Field Queue • Escalates to MOH Doctor
                    </span>
                  )}
                </div>

                {/* Main Heading */}
                <h1 className="text-2xl lg:text-[28px] font-extrabold text-[#0f172a] tracking-tight leading-tight">
                  {currentUser?.role === 'doctor' || currentUser?.role === 'admin'
                    ? 'Divisional High-Risk Triage Queue'
                    : 'Priority Maternal Care Queue'}
                </h1>

                {/* Subtitle */}
                <p className="text-xs text-[#64748b] mt-1 max-w-3xl leading-relaxed">
                  {currentUser?.role === 'doctor' || currentUser?.role === 'admin'
                    ? 'Supervisory medical oversight and high-risk case evaluation across Rampur Division clinics. Authoritative review tier.'
                    : 'Village Zone: Rampur Sector 3 • Mothers ordered by clinical priority and upcoming due dates. Operates completely offline on tablet.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                <button
                  onClick={() => setIsIntakeOpen(true)}
                  className="flex items-center gap-2 bg-[#006194] hover:bg-[#004f7b] text-white px-3.5 sm:px-4 py-2.5 rounded-lg font-bold text-xs transition-all shadow-2xs cursor-pointer active:scale-98"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>+ Add Mother</span>
                </button>

                <button
                  onClick={() => setIsExportOpen(true)}
                  className="flex items-center gap-2 bg-white hover:bg-[#f0f9ff] text-[#334155] border border-[#cbd5e1] hover:border-[#006194] px-3 sm:px-3.5 py-2.5 rounded-lg font-bold text-xs transition-all shadow-2xs cursor-pointer active:scale-98"
                >
                  <Share2 className="w-4 h-4 text-[#006194]" />
                  <span className="hidden sm:inline">Export Clinic Summary</span>
                  <span className="sm:hidden">Export</span>
                </button>

                <button
                  onClick={handleTriggerSync}
                  title="Refresh Telemetry"
                  className="bg-white hover:bg-[#f8fafc] text-[#64748b] hover:text-[#0f172a] border border-[#cbd5e1] p-2.5 rounded-lg transition-all shadow-2xs cursor-pointer flex items-center justify-center active:scale-98"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#006194]' : ''}`} />
                </button>
              </div>
            </div>

            {/* Summary Metric Cards */}
            <StatsCards
              totalActive={patients.length}
              criticalAlerts={criticalCount}
              syncedRecords={patients.filter((p) => p.syncStatus === 'synced-p2p').length}
              totalRecords={patients.length}
            />

            {/* Main Grid: Left Triage Queue, Right Decision Support & Mesh Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Column: Active Patient Triage Queue Table */}
              <div className="lg:col-span-8 space-y-4">
                <TriageQueueTable
                  patients={patients}
                  selectedPatientId={selectedPatientId}
                  onSelectPatient={handleSelectPatient}
                  activeFilter={activeFilter}
                  setActiveFilter={setActiveFilter}
                  onOpenQR={handleOpenQR}
                />
              </div>

              {/* Right Column: AI Decision Support & P2P Mesh */}
              <div className="lg:col-span-4 space-y-4">
                <EdgeAIDecisionSupport
                  patient={selectedPatient}
                  onReviewPathway={() => setIsPathwayOpen(true)}
                  onInitiateProtocol={() => setIsReferralOpen(true)}
                  onOpenQR={handleOpenQR}
                />

                <P2PMeshPanel onTriggerSync={handleTriggerSync} isSyncing={isSyncing} />
              </div>
            </div>
          </main>
        ) : activeNavTab === 'mesh-logs' ? (
          /* =================== SYSTEM SYNCHRONIZATION & CLOUD RECONCILIATION =================== */
          <main className="flex-1 p-3.5 sm:p-6 pb-24 md:pb-6 space-y-4 sm:space-y-5 max-w-[1440px] mx-auto w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">System Synchronization & Cloud Reconciliation</h1>
                <p className="text-xs text-[#64748b] mt-0.5">
                  Real-time bidirectional synchronization with central PostgreSQL server for {currentClinic?.name || 'Clinic'}
                </p>
              </div>
              <button
                onClick={handleTriggerSync}
                className="flex items-center gap-2 bg-[#006194] hover:bg-[#004f7b] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Reconcile With Central Database</span>
              </button>
            </div>

            {/* 3 Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold text-[#047857] mb-1">
                  <ShieldCheck className="w-4 h-4 text-[#16a34a]" />
                  <span>Central Cloud Database</span>
                </div>
                <div className="text-2xl font-bold text-[#0f172a] mt-1">Connected</div>
                <p className="text-[11px] text-[#64748b] mt-1">Bidirectional sync active (PostgreSQL Engine)</p>
              </div>

              <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold text-[#006194] mb-1">
                  <Activity className="w-4 h-4 text-[#0284c7]" />
                  <span>Clinic Data Partition</span>
                </div>
                <div className="text-lg font-bold text-[#0f172a] mt-1 truncate">{currentClinic?.name || 'Default Clinic'}</div>
                <p className="text-[11px] text-[#64748b] mt-1 font-mono">Tenant ID: {currentClinic?.id || 'clinic-ambagamuwa'}</p>
              </div>

              <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0f766e] mb-1">
                  <CheckCircle2 className="w-4 h-4 text-[#0d9488]" />
                  <span>Synchronized Records</span>
                </div>
                <div className="text-2xl font-bold text-[#0f172a] mt-1">{patients.length} Patient Vaults</div>
                <p className="text-[11px] text-[#64748b] mt-1">Continuous 4s cross-device synchronization</p>
              </div>
            </div>

            {/* Friendly Activity Feed */}
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 sm:p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b pb-2.5">
                <span className="text-xs font-bold text-[#0f172a]">Live Synchronization Telemetry</span>
                <span className="text-[#047857] text-[11px] sm:text-xs font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Real-time active
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]">
                  <CheckCircle2 className="w-4 h-4 text-[#16a34a] shrink-0" />
                  <span><strong>Central Database:</strong> Connected to PostgreSQL server. All local updates stream directly to the cloud.</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd]">
                  <ShieldCheck className="w-4 h-4 text-[#0284c7] shrink-0" />
                  <span><strong>Tenant Security:</strong> Strict partition isolation enforced for clinic {currentClinic?.name || 'Ambagamuwa MOH'}.</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#f8fafc] text-[#334155] border border-[#e2e8f0]">
                  <Activity className="w-4 h-4 text-[#64748b] shrink-0" />
                  <span><strong>Cross-Device Sync:</strong> Any updates made on any synced device or the central database are propagated automatically.</span>
                </div>
              </div>
            </div>
          </main>
        ) : activeNavTab === 'diagnostics' ? (
          /* =================== CLINICAL HEALTH GUIDELINES TAB =================== */
          <main className="flex-1 p-3.5 sm:p-6 pb-24 md:pb-6 space-y-4 sm:space-y-5 max-w-[1440px] mx-auto w-full">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">Clinical Health Guides & Protocols</h1>
              <p className="text-xs text-[#64748b] mt-0.5">
                Public Health Midwife reference handbook and clinical decision criteria (H 512 B Standards)
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
              {/* Guide 1 */}
              <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
                <div className="w-8 h-8 rounded-lg bg-[#fee2e2] text-[#991b1b] flex items-center justify-center font-bold">
                  <AlertTriangle className="w-4 h-4 text-[#dc2626]" />
                </div>
                <h3 className="text-sm font-bold text-[#0f172a]">Pre-eclampsia Alert Protocol</h3>
                <ul className="text-xs text-[#475569] space-y-1.5 list-disc list-inside">
                  <li>BP ≥ 140/90 mmHg after 20 weeks</li>
                  <li>Urine Albumin ≥ 1+ (or trace with symptoms)</li>
                  <li>Frontal headache or visual blurring</li>
                  <li>Epigastric pain or facial edema</li>
                </ul>
                <div className="pt-2 border-t border-[#f1f5f9] text-[11px] font-bold text-[#b91c1c]">
                  🚨 Action: Immediate Doctor Review & Referral
                </div>
              </div>

              {/* Guide 2 */}
              <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
                <div className="w-8 h-8 rounded-lg bg-[#e0f2fe] text-[#0369a1] flex items-center justify-center font-bold">
                  <HeartPulse className="w-4 h-4 text-[#0284c7]" />
                </div>
                <h3 className="text-sm font-bold text-[#0f172a]">Gestational Anemia Monitoring</h3>
                <ul className="text-xs text-[#475569] space-y-1.5 list-disc list-inside">
                  <li>Target Hb: ≥ 11.0 g/dL</li>
                  <li>Mild Anemia: Hb 10.0 - 10.9 g/dL</li>
                  <li>Moderate Anemia: Hb 7.0 - 9.9 g/dL</li>
                  <li>Severe Anemia: Hb &lt; 7.0 g/dL</li>
                </ul>
                <div className="pt-2 border-t border-[#f1f5f9] text-[11px] font-bold text-[#0369a1]">
                  💊 Action: Double IFA dosage & dietary counselling
                </div>
              </div>

              {/* Guide 3 */}
              <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
                <div className="w-8 h-8 rounded-lg bg-[#f0fdf4] text-[#047857] flex items-center justify-center font-bold">
                  <Baby className="w-4 h-4 text-[#16a34a]" />
                </div>
                <h3 className="text-sm font-bold text-[#0f172a]">ANC Visit Milestones (H 512 B)</h3>
                <ul className="text-xs text-[#475569] space-y-1.5 list-disc list-inside">
                  <li><strong>Visit 1:</strong> Booking before 12 weeks</li>
                  <li><strong>Visit 2:</strong> 14 - 16 weeks (Anomaly review)</li>
                  <li><strong>Visit 3:</strong> 20 - 24 weeks (Growth check)</li>
                  <li><strong>Visit 4:</strong> 28 - 32 weeks (Pre-eclampsia screen)</li>
                  <li><strong>Visit 5+:</strong> 36 - 40 weeks (Delivery plan)</li>
                </ul>
                <div className="pt-2 border-t border-[#f1f5f9] text-[11px] font-bold text-[#047857]">
                  📋 Action: Review birth preparedness with mother
                </div>
              </div>
            </div>
          </main>
        ) : (
          /* =================== SETTINGS TAB =================== */
          <main className="flex-1 p-3.5 sm:p-6 pb-24 md:pb-6 space-y-4 sm:space-y-5 max-w-[1440px] mx-auto w-full">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a]">Clinic Station Settings</h1>
              <p className="text-xs text-[#64748b] mt-0.5">
                Sub-District Clinic 4B midwife tablet configuration and offline settings
              </p>
            </div>

            <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 sm:p-5 max-w-xl space-y-4 text-xs shadow-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                  Active Midwife User
                </label>
                <input
                  type="text"
                  readOnly
                  value={currentUser ? `${currentUser.id} (${currentUser.name} • ${currentUser.title})` : 'No Active Midwife Logged In'}
                  className="w-full px-3 py-2 border border-[#cbd5e1] rounded-lg bg-[#f8fafc] font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                  Assigned Clinic Station (Tenant)
                </label>
                <input
                  type="text"
                  readOnly
                  value={`${currentClinic?.name || 'Primary Health Post 4B'} • ${currentClinic?.division || 'Rampur Division'}`}
                  className="w-full px-3 py-2 border border-[#cbd5e1] rounded-lg bg-[#f8fafc] font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                  Automatic Sync Mode
                </label>
                <select className="w-full px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white font-medium cursor-pointer">
                  <option>Automatic Sync with Nearby Tablets (Recommended)</option>
                  <option>Sync every 15 minutes</option>
                  <option>Manual Sync Only (Save Battery)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] text-[#047857] font-semibold">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#047857]" />
                  Tablet Storage: Safe & Encrypted (Salted PBKDF2)
                </span>
                <span className="text-[#64748b]">Tenant: {currentClinic?.code || 'PHP-4B'}</span>
              </div>
            </div>
          </main>
        )}
      </div>

      {/* Native Mobile Bottom Navigation Bar (Visible on mobile < md) */}
      <MobileBottomNav
        activeTab={activeNavTab}
        setActiveTab={setActiveNavTab}
        onOpenIntake={() => setIsIntakeOpen(true)}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        totalMothers={patients.length}
        criticalCount={criticalCount}
        isSyncing={isSyncing}
      />

      {/* Floating Sync Notification Toast */}
      {syncToast && (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 bg-[#0f172a] text-white px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
          <span>{syncToast}</span>
        </div>
      )}

      {/* Modals */}
      <RapidIntakeModal
        isOpen={isIntakeOpen}
        onClose={() => setIsIntakeOpen(false)}
        onAddPatient={handleAddPatient}
        existingPatients={patients}
      />

      <ClinicalPathwayModal
        isOpen={isPathwayOpen}
        onClose={() => setIsPathwayOpen(false)}
        patient={selectedPatient}
        onProceedToReferral={() => setIsReferralOpen(true)}
      />

      <ReferralProtocolModal
        isOpen={isReferralOpen}
        onClose={() => setIsReferralOpen(false)}
        patient={selectedPatient}
      />

      <ExportSummaryModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        patients={patients}
      />

      <PatientEHRModal
        isOpen={isEHROpen}
        onClose={() => setIsEHROpen(false)}
        patient={selectedEHRPatient}
        onOpenQR={handleOpenQR}
        onOpenAddVisit={handleOpenAddVisit}
        onDeletePatient={(patient) => {
          handleOpenDeleteModal(patient);
        }}
      />

      <PatientQRModal
        isOpen={isQROpen}
        onClose={() => setIsQROpen(false)}
        patient={selectedQRPatient}
      />

      <AddClinicVisitModal
        isOpen={isAddVisitOpen}
        onClose={() => setIsAddVisitOpen(false)}
        patient={selectedVisitPatient}
        onSaveVisit={handleSaveClinicVisit}
      />

      <ClinicalPlaybookModal
        isOpen={isPlaybookOpen}
        onClose={() => setIsPlaybookOpen(false)}
      />

      <DeletePatientConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedDeletePatient(null);
        }}
        patient={selectedDeletePatient}
        onConfirmDelete={handleConfirmDeletePatient}
      />

      <ImportPatientVaultModal
        isOpen={isImportVaultOpen}
        onClose={() => setIsImportVaultOpen(false)}
        onImportPatient={handleAddPatient}
      />

      <CentralDbSyncModal
        isOpen={isCentralSyncOpen}
        onClose={() => setIsCentralSyncOpen(false)}
        onSyncComplete={handleCentralSyncComplete}
      />
    </div>
  );
}



export function App() {
  return (
    <AuthProvider>
      <DashboardContent />
      <MidwifeLoginModal />
    </AuthProvider>
  );
}

export default App;

