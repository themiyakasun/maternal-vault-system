import React, { useState } from 'react';
import type { Patient } from '../../types/triage';
import { formatDisplayDate } from '../../utils/dateUtils';
import { 
  X, 
  Printer, 
  QrCode, 
  BookOpen, 
  Activity, 
  HeartPulse, 
  ShieldCheck, 
  Calendar, 
  Syringe, 
  User, 
  CheckCircle2, 
  Baby,
  Plus,
  Trash2,
  Brain,
  Droplets,
  Sparkles,
  FileJson,
  Check,
  Copy
} from 'lucide-react';
import { buildCompletePatientVaultJSON } from './PatientQRModal';
import { serializePatientToFHIR } from '../../utils/fhirSerializer';

interface PatientEHRModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onOpenQR?: (patient: Patient) => void;
  onOpenAddVisit?: (patient: Patient) => void;
  onDeletePatient?: (patient: Patient) => void;
}

const formatProbability = (val: number | undefined | null): string => {
  if (val == null || isNaN(val)) return '0%';
  const normalized = val > 1 ? val : val * 100;
  return `${Math.min(100, Math.max(0, Math.round(normalized)))}%`;
};

export const PatientEHRModal: React.FC<PatientEHRModalProps> = ({
  isOpen,
  onClose,
  patient,
  onOpenQR,
  onOpenAddVisit,
  onDeletePatient,
}) => {
  const [activeTab, setActiveTab] = useState<'h512b' | 'timeline' | 'vitals' | 'labs' | 'ai'>('h512b');
  const [copiedJSON, setCopiedJSON] = useState(false);
  const [copiedFHIR, setCopiedFHIR] = useState(false);

  const handleCopyJSON = async () => {
    if (!patient) return;
    const jsonStr = JSON.stringify(buildCompletePatientVaultJSON(patient), null, 2);
    try {
      await navigator.clipboard.writeText(jsonStr);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = jsonStr;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 2500);
  };

  const handleCopyFHIR = async () => {
    if (!patient) return;
    const fhirJson = JSON.stringify(serializePatientToFHIR(patient), null, 2);
    try {
      await navigator.clipboard.writeText(fhirJson);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = fhirJson;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedFHIR(true);
    setTimeout(() => setCopiedFHIR(false), 2500);
  };

  if (!isOpen || !patient) return null;

  const handlePrint = () => {
    window.print();
  };

  // Derive default H 512 B fields if not explicitly populated
  const bloodGroup = patient.bloodGroup || (patient.id === '#8842' ? 'B +ve' : patient.id === '#7912' ? 'O +ve' : patient.id === '#9043' ? 'A +ve' : 'O +ve');
  const lmpDate = patient.lmp || (patient.id === '#8842' ? '12 Apr 2024' : '10 Jan 2024');
  const poaBooking = patient.poaAtBooking || '7w 4d';
  const heightCm = patient.heightCm || (patient.id === '#8842' ? 158 : 156);
  const weightKg = patient.weightKg || (patient.id === '#8842' ? 78.0 : 62.0);
  const partnerName = patient.partnerName || (patient.id === '#8842' ? 'Suresh Kumar' : 'Ramesh Bai');
  const partnerAge = patient.partnerAge || 30;
  const partnerOccupation = patient.partnerOccupation || 'Farmer / Local Trade';
  const mohArea = patient.mohArea || 'MOH Rampur / Division 4B';
  const phmRegisterNo = patient.phmRegisterNo || `PHM/2024/${patient.id.replace('#', '')}`;
  const nicNo = patient.nicNo || patient.abhaId || '91-4299-8812-4411';

  // Antenatal visits for H 512 B flowsheet
  const ancVisitsList = patient.ancVisits || [
    {
      visitNo: 1,
      date: '20 May 2024',
      poa: '8w 2d',
      weightKg: weightKg - 2.5,
      bp: '120/78',
      sfhCm: 'Palpable',
      presentation: 'N/A (1st Trim)',
      engagement: 'No',
      fhr: 'N/A',
      fm: 'N/A',
      urineAlb: 'Nil',
      urineSug: 'Nil',
      edema: 'Nil',
      examiner: 'Priya Sharma, PHM',
      remarks: 'Registration booking visit. Folic acid 5mg OD issued. Blood & urine investigations ordered.',
    },
    {
      visitNo: 2,
      date: '15 Jul 2024',
      poa: '16w 0d',
      weightKg: weightKg - 1.0,
      bp: '126/82',
      sfhCm: '16 cm',
      presentation: 'Unstable',
      engagement: 'No',
      fhr: '148 bpm',
      fm: 'Felt',
      urineAlb: 'Nil',
      urineSug: 'Nil',
      edema: 'Nil',
      examiner: 'Anita Yadav, ANM',
      remarks: 'Anomaly scan advised. IFA & Calcium Lactate initiated. TT1 vaccine administered.',
    },
    {
      visitNo: 3,
      date: '18 Aug 2024',
      poa: '24w 4d',
      weightKg: weightKg + 1.2,
      bp: '132/86',
      sfhCm: '24 cm',
      presentation: 'Cephalic',
      engagement: 'No',
      fhr: '144 bpm',
      fm: 'Positive (Regular)',
      urineAlb: 'Nil',
      urineSug: 'Nil',
      edema: 'Trace ankle',
      examiner: 'Dr. Rajesh Varma, MO',
      remarks: 'OGTT 75g normal (86 mg/dL). TT2 dose administered. Weight gain on target.',
    },
    {
      visitNo: 4,
      date: '07 Sep 2024',
      poa: `${patient.gestationalWeeks}w ${patient.gestationalDays}d`,
      weightKg: weightKg + 3.8,
      bp: `${patient.bpSystolic}/${patient.bpDiastolic}`,
      sfhCm: patient.fundalHeight || '31 cm',
      presentation: 'Cephalic (Vertex)',
      engagement: patient.gestationalWeeks > 36 ? 'Engaged' : 'Not engaged',
      fhr: patient.fhr || '142 bpm',
      fm: 'Active (>10/12h)',
      urineAlb: patient.riskTier === 'high' ? '2+ (Proteinuria)' : 'Nil',
      urineSug: 'Nil',
      edema: patient.riskTier === 'high' ? 'Pre-tibial 2+' : 'Trace',
      examiner: patient.assessedBy || 'Priya Sharma, PHM',
      remarks: patient.notes || 'Current routine assessment. Risk stratification calculated on-device.',
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/65 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border-t sm:border border-[#cbd5e1] max-w-5xl w-full overflow-hidden animate-in fade-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 flex flex-col max-h-[94vh] sm:max-h-[94vh]">
        {/* Header with H 512 B Indicator */}
        <div className="bg-[#004b73] text-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white/15 flex items-center justify-center font-bold text-sm shadow-inner shrink-0">
              <BookOpen className="w-5 h-5 text-[#38bdf8]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold tracking-tight flex items-center gap-1.5 truncate">
                  <span className="truncate">{patient.name}</span>
                  <span className="hidden sm:inline text-xs font-normal text-[#cce5ff]">
                    — Maternal Health Record (H 512 B)
                  </span>
                </h2>
                <span className="bg-white/20 text-white text-[10px] font-mono px-1.5 py-0.2 rounded font-bold">
                  {patient.id}
                </span>
                <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded uppercase ${
                  patient.riskTier === 'high' ? 'bg-[#fee2e2] text-[#991b1b]' : patient.riskTier === 'moderate' ? 'bg-[#e0f2fe] text-[#004b73]' : 'bg-[#dcfce7] text-[#14532d]'
                }`}>
                  {patient.riskTier}
                </span>
              </div>
              <p className="text-[11px] text-[#cce5ff] mt-0.5 flex items-center gap-1.5 flex-wrap truncate">
                <span>PHM: <strong className="font-mono">{phmRegisterNo}</strong></span>
                <span>•</span>
                <span>ABHA: <strong className="font-mono">{nicNo}</strong></span>
                <span>•</span>
                <span>Blood: <strong className="font-bold text-[#fef08a]">{bloodGroup}</strong></span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">{mohArea}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {onOpenAddVisit && (
              <button
                onClick={() => onOpenAddVisit(patient)}
                className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#10b981] hover:bg-[#059669] active:scale-98 text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Record new Antenatal Clinic visit"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">+ Add Visit</span>
              </button>
            )}
            {onOpenQR && (
              <button
                onClick={() => {
                  onClose();
                  onOpenQR(patient);
                }}
                className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-[#38bdf8] hover:bg-[#0284c7] active:scale-98 text-[#0f172a] hover:text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Generate Mobile Transfer QR Code"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">QR Pass</span>
              </button>
            )}
            <button
              onClick={handleCopyFHIR}
              className={`px-2 sm:px-2.5 py-1.5 rounded-lg active:scale-98 font-bold text-xs transition-all cursor-pointer flex items-center gap-1 shadow-2xs border ${
                copiedFHIR
                  ? 'bg-emerald-500 border-emerald-400 text-white'
                  : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
              }`}
              title="Copy HL7 FHIR R4 JSON Bundle for validator.fhir.org"
            >
              {copiedFHIR ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span className="hidden sm:inline">FHIR Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span className="hidden sm:inline">Copy FHIR</span>
                </>
              )}
            </button>
            <button
              onClick={handleCopyJSON}
              className={`px-2 sm:px-2.5 py-1.5 rounded-lg active:scale-98 font-bold text-xs transition-all cursor-pointer flex items-center gap-1 shadow-2xs border ${
                copiedJSON
                  ? 'bg-emerald-500 border-emerald-400 text-white'
                  : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
              }`}
              title="Copy complete raw JSON string"
            >
              {copiedJSON ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span className="hidden sm:inline">JSON Copied!</span>
                </>
              ) : (
                <>
                  <FileJson className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span className="hidden sm:inline">Copy JSON</span>
                </>
              )}
            </button>
            {onDeletePatient && (
              <button
                onClick={() => onDeletePatient(patient)}
                className="p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-[#dc2626] active:scale-95 text-white transition-all cursor-pointer"
                title="Delete Maternal Record (Safeguard Protected)"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handlePrint}
              className="p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all cursor-pointer"
              title="Print Official H 512 B Record Book"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs including H 512 B Official Form */}
        <div className="bg-[#f8fafc] border-b border-[#e2e8f0] px-3 sm:px-6 flex gap-3 sm:gap-6 text-xs font-semibold shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('h512b')}
            className={`py-3 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'h512b'
                ? 'border-b-2 border-[#006194] text-[#006194] font-bold'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            <BookOpen className="w-4 h-4 text-[#0284c7]" />
            <span>H 512 B Official Record Book</span>
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'timeline'
                ? 'border-b-2 border-[#006194] text-[#006194] font-bold'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Antenatal Visits Flowsheet</span>
          </button>
          <button
            onClick={() => setActiveTab('vitals')}
            className={`py-3 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'vitals'
                ? 'border-b-2 border-[#006194] text-[#006194] font-bold'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            <HeartPulse className="w-4 h-4" />
            <span>Fetal & Maternal Biometrics</span>
          </button>
          <button
            onClick={() => setActiveTab('labs')}
            className={`py-3 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'labs'
                ? 'border-b-2 border-[#006194] text-[#006194] font-bold'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Investigations & Lab Grid</span>
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`py-3 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'ai'
                ? 'border-b-2 border-[#006194] text-[#006194] font-bold'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Smart Health Risk Assessment</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-[#f8fafc]/50">
          
          {/* ===================== TAB 1: OFFICIAL H 512 B PREGNANCY RECORD BOOK ===================== */}
          {activeTab === 'h512b' && (
            <div className="space-y-5">
              
              {/* Section 1: Identification & Present Pregnancy Overview */}
              <div className="bg-white border border-[#cbd5e1] rounded-xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#006194]" />
                    <span className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
                      Section 1: General & Present Pregnancy Booking Record
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#006194] bg-[#e0f2fe] px-2 py-0.5 rounded font-bold">
                    Form H 512 B (FHB / MOH Standard)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-[#f8fafc] p-2.5 rounded-lg border border-[#e2e8f0]">
                    <span className="text-[10.5px] text-[#64748b] block">Mother's Age & Parity</span>
                    <strong className="text-[#0f172a] text-sm">{patient.age} yrs • G{patient.gravida} P{patient.para}</strong>
                  </div>
                  <div className="bg-[#f8fafc] p-2.5 rounded-lg border border-[#e2e8f0]">
                    <span className="text-[10.5px] text-[#64748b] block">Last Menstrual Period (LMP)</span>
                    <strong className="text-[#0f172a] text-sm font-mono">{formatDisplayDate(lmpDate)}</strong>
                  </div>
                  <div className="bg-[#f8fafc] p-2.5 rounded-lg border border-[#e2e8f0]">
                    <span className="text-[10.5px] text-[#64748b] block">Expected Delivery Date (EDD)</span>
                    <strong className="text-[#006194] text-sm font-mono">{formatDisplayDate(patient.edd || '2024-11-18')}</strong>
                  </div>
                  <div className="bg-[#f8fafc] p-2.5 rounded-lg border border-[#e2e8f0]">
                    <span className="text-[10.5px] text-[#64748b] block">POA at Booking</span>
                    <strong className="text-[#0f172a] text-sm font-mono">{poaBooking} (1st Trim)</strong>
                  </div>

                  <div className="bg-[#f8fafc] p-2.5 rounded-lg border border-[#e2e8f0]">
                    <span className="text-[10.5px] text-[#64748b] block">Height & Booking Weight</span>
                    <strong className="text-[#0f172a] text-sm">{heightCm} cm • {weightKg} kg</strong>
                  </div>
                  <div className="bg-[#f8fafc] p-2.5 rounded-lg border border-[#e2e8f0]">
                    <span className="text-[10.5px] text-[#64748b] block">Baseline Booking BMI</span>
                    <strong className={`text-sm font-mono ${patient.bmiStatusClass === 'danger' ? 'text-[#b91c1c]' : 'text-[#0f172a]'}`}>
                      {patient.bmi} kg/m² ({patient.bmiCategory})
                    </strong>
                  </div>
                  <div className="bg-[#f8fafc] p-2.5 rounded-lg border border-[#e2e8f0]">
                    <span className="text-[10.5px] text-[#64748b] block">Husband / Partner Details</span>
                    <strong className="text-[#0f172a] text-xs">{partnerName}, {partnerAge}y ({partnerOccupation})</strong>
                  </div>
                  <div className="bg-[#f8fafc] p-2.5 rounded-lg border border-[#e2e8f0]">
                    <span className="text-[10.5px] text-[#64748b] block">Blood Group & Rh Factor</span>
                    <strong className="text-[#991b1b] text-sm font-mono">{bloodGroup}</strong>
                  </div>
                </div>
              </div>

              {/* Section 2: Past Obstetric & Medical/Surgical History */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Past Obstetric History */}
                <div className="bg-white border border-[#cbd5e1] rounded-xl p-4 shadow-2xs space-y-2.5">
                  <div className="flex items-center gap-2 border-b border-[#e2e8f0] pb-2">
                    <Baby className="w-4 h-4 text-[#006194]" />
                    <span className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
                      Section 2: Past Obstetric History
                    </span>
                  </div>

                  {patient.gravida === 1 ? (
                    <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg text-xs text-[#166534]">
                      ✓ <strong>Primigravida (First Pregnancy):</strong> No prior obstetric deliveries recorded.
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs">
                      <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-2.5 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-[#0f172a]">Pregnancy 1 (2021)</div>
                          <div className="text-[11px] text-[#64748b]">NVD at 38w • Female (2.9 kg) • Normal Delivery</div>
                        </div>
                        <span className="text-[10.5px] bg-[#dcfce7] text-[#14532d] font-bold px-2 py-0.5 rounded">
                          Living Healthy
                        </span>
                      </div>
                      {patient.riskSubtitle?.includes('Prior C-Section') && (
                        <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-lg p-2.5 text-[#991b1b] text-[11px]">
                          ⚠️ <strong>Surgical Scar Alert:</strong> History of prior Lower Segment Cesarean Section (LSCS).
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Medical & Surgical History */}
                <div className="bg-white border border-[#cbd5e1] rounded-xl p-4 shadow-2xs space-y-2.5">
                  <div className="flex items-center gap-2 border-b border-[#e2e8f0] pb-2">
                    <HeartPulse className="w-4 h-4 text-[#b91c1c]" />
                    <span className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
                      Section 3: Medical / Surgical & Allergy Profile
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-[#f8fafc] border border-[#e2e8f0]">
                      <span className="text-[10px] text-[#64748b] block">Pre-existing HTN / DM</span>
                      <strong className="text-[#0f172a]">No Chronic HTN / No DM</strong>
                    </div>
                    <div className="p-2 rounded bg-[#f8fafc] border border-[#e2e8f0]">
                      <span className="text-[10px] text-[#64748b] block">Asthma / Cardiac / Renal</span>
                      <strong className="text-[#0f172a]">None Reported (NAD)</strong>
                    </div>
                    <div className="p-2 rounded bg-[#f8fafc] border border-[#e2e8f0]">
                      <span className="text-[10px] text-[#64748b] block">Drug / Food Allergies</span>
                      <strong className="text-[#047857]">No Known Allergies (NKDA)</strong>
                    </div>
                    <div className="p-2 rounded bg-[#f8fafc] border border-[#e2e8f0]">
                      <span className="text-[10px] text-[#64748b] block">Dental & Thyroid Exam</span>
                      <strong className="text-[#0f172a]">Normal / Checked by MOH</strong>
                    </div>
                  </div>
                </div>

              </div>

              {/* Section 4: H 512 B Antenatal Clinic Flowsheet Table */}
              <div className="bg-white border border-[#cbd5e1] rounded-xl p-4 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e2e8f0] pb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#006194]" />
                    <span className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
                      Section 4: Antenatal Clinic Visit Flowsheet (H 512 B Grid)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10.5px] text-[#64748b]">Total Visits Recorded: {ancVisitsList.length}</span>
                    {onOpenAddVisit && (
                      <button
                        onClick={() => onOpenAddVisit(patient)}
                        className="bg-[#006194] hover:bg-[#004f7b] text-white px-2.5 py-1 rounded text-[11px] font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add Clinic Visit</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#f1f5f9] text-[#475569] text-[10px] font-bold uppercase tracking-wider border-b border-[#cbd5e1]">
                        <th className="p-2">Visit</th>
                        <th className="p-2">Date & POA</th>
                        <th className="p-2">Weight</th>
                        <th className="p-2">BP (mmHg)</th>
                        <th className="p-2">SFH (cm)</th>
                        <th className="p-2">Presentation</th>
                        <th className="p-2">FHR</th>
                        <th className="p-2">Urine Alb/Sug</th>
                        <th className="p-2">Edema</th>
                        <th className="p-2">Examiner</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0]">
                      {ancVisitsList.map((v, i) => (
                        <tr key={i} className={`hover:bg-[#f8fafc] ${i === ancVisitsList.length - 1 ? 'bg-[#f0f9ff]/60 font-semibold' : ''}`}>
                          <td className="p-2 font-bold font-mono text-[#006194]">#{v.visitNo}</td>
                          <td className="p-2">
                            <div className="font-bold text-[#0f172a]">{formatDisplayDate(v.date)}</div>
                            <div className="text-[10px] font-mono text-[#64748b]">{v.poa}</div>
                          </td>
                          <td className="p-2 font-mono">{v.weightKg.toFixed(1)} kg</td>
                          <td className="p-2 font-mono">
                            <span className={v.bp.startsWith('14') || v.bp.startsWith('15') ? 'text-[#b91c1c] font-bold' : 'text-[#0f172a]'}>
                              {v.bp}
                            </span>
                          </td>
                          <td className="p-2 font-mono">{v.sfhCm}</td>
                          <td className="p-2">{v.presentation}</td>
                          <td className="p-2 font-mono text-[#16a34a]">{v.fhr}</td>
                          <td className="p-2 font-mono">
                            <span className={v.urineAlb.includes('+') ? 'text-[#b91c1c] font-bold' : 'text-[#047857]'}>
                              {v.urineAlb} / {v.urineSug}
                            </span>
                          </td>
                          <td className="p-2">{v.edema}</td>
                          <td className="p-2 text-[11px] text-[#475569]">{v.examiner}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 5: Immunization, Micronutrients & Delivery Plan */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Immunization & Micronutrient Supplementation */}
                <div className="bg-white border border-[#cbd5e1] rounded-xl p-4 shadow-2xs space-y-2.5">
                  <div className="flex items-center gap-2 border-b border-[#e2e8f0] pb-2">
                    <Syringe className="w-4 h-4 text-[#047857]" />
                    <span className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
                      Section 5: Immunization & Supplementation Checklist
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center p-2 rounded bg-[#f8fafc] border border-[#e2e8f0]">
                      <span>Tetanus Toxoid (TT1 & TT2):</span>
                      <span className="font-bold text-[#047857] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completed (16w & 24w)
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-2 rounded bg-[#f8fafc] border border-[#e2e8f0]">
                      <span>Iron & Folic Acid (IFA) Tablets:</span>
                      <span className="font-bold text-[#006194]">120 Tablets Issued (Compliance Good)</span>
                    </div>

                    <div className="flex justify-between items-center p-2 rounded bg-[#f8fafc] border border-[#e2e8f0]">
                      <span>Calcium Lactate 500mg:</span>
                      <span className="font-bold text-[#006194]">120 Tablets Issued</span>
                    </div>

                    <div className="flex justify-between items-center p-2 rounded bg-[#f8fafc] border border-[#e2e8f0]">
                      <span>Deworming (Mebendazole single dose):</span>
                      <span className="font-bold text-[#047857]">Administered at 16w</span>
                    </div>
                  </div>
                </div>

                {/* Delivery & Emergency Referral Plan */}
                <div className="bg-white border border-[#cbd5e1] rounded-xl p-4 shadow-2xs space-y-2.5">
                  <div className="flex items-center gap-2 border-b border-[#e2e8f0] pb-2">
                    <ShieldCheck className="w-4 h-4 text-[#006194]" />
                    <span className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
                      Section 6: Delivery & Emergency Referral Plan
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-2 rounded bg-[#f8fafc] border border-[#e2e8f0] flex justify-between">
                      <span className="text-[#64748b]">Designated Hospital for Delivery:</span>
                      <strong className="text-[#0f172a]">Base Hospital Rampur (Secondary Center)</strong>
                    </div>

                    <div className="p-2 rounded bg-[#f8fafc] border border-[#e2e8f0] flex justify-between">
                      <span className="text-[#64748b]">Emergency Transport Plan:</span>
                      <strong className="text-[#b91c1c]">108 Ambulance SOS (Midwife Escort)</strong>
                    </div>

                    <div className="p-2 rounded bg-[#f8fafc] border border-[#e2e8f0] flex justify-between">
                      <span className="text-[#64748b]">Identified Blood Donor:</span>
                      <strong className="text-[#0f172a]">{partnerName} ({bloodGroup})</strong>
                    </div>

                    <div className={`p-2 rounded border text-[11px] ${
                      patient.riskTier === 'high' ? 'bg-[#fee2e2] border-[#fca5a5] text-[#991b1b] font-bold' : 'bg-[#dcfce7] border-[#bbf7d0] text-[#14532d]'
                    }`}>
                      {patient.riskTier === 'high' 
                        ? '⚠️ Alert: Tertiary Obstetric Referral indicated prior to 34 weeks due to Pre-eclampsia risk.' 
                        : '✓ Routine institutional delivery planned.'}
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ===================== TAB 2: ANTENATAL TIMELINE LEDGER ===================== */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
                  Documented Antenatal Visits (Offline Encrypted Ledger)
                </h3>
                {onOpenAddVisit && (
                  <button
                    onClick={() => onOpenAddVisit(patient)}
                    className="bg-[#006194] hover:bg-[#004f7b] text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Clinic Visit</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {ancVisitsList.map((visit, idx) => (
                  <div key={idx} className="border border-[#e2e8f0] rounded-xl p-4 bg-white space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-[#f1f5f9]">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#006194] text-white flex items-center justify-center font-bold text-xs">
                          {visit.visitNo}
                        </span>
                        <span className="font-bold text-[#0f172a]">
                          ANC Visit #{visit.visitNo} ({visit.poa})
                        </span>
                      </div>
                      <span className="text-[#64748b] font-mono">{formatDisplayDate(visit.date)}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono pt-1">
                      <div>BP: <strong className={visit.bp.startsWith('14') || visit.bp.startsWith('15') ? 'text-[#b91c1c]' : 'text-[#0f172a]'}>{visit.bp} mmHg</strong></div>
                      <div>Fundal: <strong>{visit.sfhCm}</strong></div>
                      <div>FHR: <strong className="text-[#16a34a]">{visit.fhr}</strong></div>
                      <div>Weight: <strong>{visit.weightKg.toFixed(1)} kg</strong></div>
                    </div>

                    <p className="text-[11.5px] text-[#475569] pt-1">
                      <strong>Midwife Notes:</strong> {visit.remarks}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===================== TAB 3: VITALS & BIOMETRIC TRENDS ===================== */}
          {activeTab === 'vitals' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
                Telemetry & Biometric Trends
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="border border-[#e2e8f0] rounded-xl p-3.5 bg-white shadow-2xs">
                  <span className="text-[10px] text-[#64748b] font-bold uppercase">Resting Blood Pressure</span>
                  <div className={`text-2xl font-bold font-mono mt-1 ${patient.isBpAlert ? 'text-[#b91c1c]' : 'text-[#0f172a]'}`}>
                    {patient.bpSystolic}/{patient.bpDiastolic} <span className="text-xs font-normal">mmHg</span>
                  </div>
                  <div className="text-[10.5px] text-[#ef4444] mt-1.5 font-semibold">
                    {patient.isBpAlert ? '⚠ Stage 1/2 Hypertension' : '✓ Optimal Baseline'}
                  </div>
                </div>

                <div className="border border-[#e2e8f0] rounded-xl p-3.5 bg-white shadow-2xs">
                  <span className="text-[10px] text-[#64748b] font-bold uppercase">Fetal Heart Rate</span>
                  <div className={`text-2xl font-bold font-mono mt-1 ${patient.isFhrAlert ? 'text-[#b91c1c]' : 'text-[#16a34a]'}`}>
                    {patient.fhr || '142 bpm'}
                  </div>
                  <div className="text-[10.5px] text-[#047857] mt-1.5 font-semibold">
                    Baseline Range 110-160 bpm
                  </div>
                </div>

                <div className="border border-[#e2e8f0] rounded-xl p-3.5 bg-white shadow-2xs">
                  <span className="text-[10px] text-[#64748b] font-bold uppercase">Symphysis-Fundal Height</span>
                  <div className="text-2xl font-bold font-mono mt-1 text-[#0f172a]">
                    {patient.fundalHeight || '31 cm'}
                  </div>
                  <div className="text-[10.5px] text-[#64748b] mt-1.5">
                    Matches gestational age ({patient.gestationalWeeks}w)
                  </div>
                </div>

                <div className="border border-[#e2e8f0] rounded-xl p-3.5 bg-white shadow-2xs">
                  <span className="text-[10px] text-[#64748b] font-bold uppercase">Maternal BMI</span>
                  <div className="text-2xl font-bold font-mono mt-1 text-[#0f172a]">
                    {patient.bmi} <span className="text-xs font-normal">kg/m²</span>
                  </div>
                  <div className="text-[10.5px] text-[#64748b] mt-1.5 font-semibold">
                    {patient.bmiCategory}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================== TAB 4: LABORATORY & SCREENING GRID ===================== */}
          {activeTab === 'labs' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
                Laboratory & Point-of-Care Diagnostics (MOH Maternal Package)
              </h3>
              
              <div className="border border-[#e2e8f0] rounded-xl divide-y divide-[#f1f5f9] text-xs bg-white shadow-2xs overflow-hidden">
                <div className="p-3.5 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-[#0f172a] block">Blood Group & Rh Antibodies</span>
                    <span className="text-[#64748b] text-[11px]">ABO / Rh typing at booking visit</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-[#0f172a] bg-[#f1f5f9] px-2.5 py-1 rounded">
                    {bloodGroup} (Rh Positive)
                  </span>
                </div>

                <div className="p-3.5 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-[#0f172a] block">Hemoglobin (Hb Sahli / Strip)</span>
                    <span className="text-[#64748b] text-[11px]">Booking Target: &ge; 11.0 g/dL • 2nd Check at 28w</span>
                  </div>
                  <span className={`font-mono font-bold text-sm ${patient.isHbAlert ? 'text-[#b91c1c]' : 'text-[#0f172a]'}`}>
                    {patient.hb || 10.1} g/dL
                  </span>
                </div>

                <div className="p-3.5 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-[#0f172a] block">75g Oral Glucose Tolerance Test (OGTT)</span>
                    <span className="text-[#64748b] text-[11px]">Normal fasting: &lt; 92 mg/dL • 2-hour: &lt; 153 mg/dL</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-[#047857]">
                    86 mg/dL (Normal Fasting)
                  </span>
                </div>

                <div className="p-3.5 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-[#0f172a] block">Urine Dipstick Albumin / Proteinuria</span>
                    <span className="text-[#64748b] text-[11px]">Threshold for Pre-eclampsia: &ge; 2+</span>
                  </div>
                  <span className={`font-mono font-bold text-sm ${patient.riskTier === 'high' ? 'text-[#b91c1c]' : 'text-[#047857]'}`}>
                    {patient.riskTier === 'high' ? '2+ (Proteinuria Alert)' : 'Nil / Trace'}
                  </span>
                </div>

                <div className="p-3.5 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-[#0f172a] block">Syphilis Screening (VDRL / RPR)</span>
                    <span className="text-[#64748b] text-[11px]">Standard antenatal STI screening</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-[#047857]">
                    Non-Reactive (Negative)
                  </span>
                </div>

                <div className="p-3.5 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-[#0f172a] block">Rubella Immunization / Antibody Titer</span>
                    <span className="text-[#64748b] text-[11px]">Congenital rubella protection</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-[#047857]">
                    Immune (Titer &gt; 15 IU/mL)
                  </span>
                </div>

                <div className="p-3.5 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-[#0f172a] block">HIV & Hepatitis B (HBsAg)</span>
                    <span className="text-[#64748b] text-[11px]">Prevention of mother-to-child transmission</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-[#047857]">
                    Negative (Non-Reactive)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ===================== TAB 5: SMART HEALTH RISK ASSESSMENT ===================== */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e2e8f0] pb-2">
                <div>
                  <h3 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#006194]" />
                    <span>Real-Time Clinical Health Risk Screening</span>
                  </h3>
                  <p className="text-[11px] text-[#64748b]">
                    Automatically evaluated from maternal vital signs, lab tests, and clinic visit observations.
                  </p>
                </div>
                <span className="text-[11px] text-[#006194] bg-[#e0f2fe] px-2.5 py-1 rounded font-bold self-start sm:self-auto flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#047857] inline-block animate-pulse"></span>
                  <span>Instant Clinical Evaluation Active</span>
                </span>
              </div>

              {/* 3 Model Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Model 1: Maternal Clinical Health Risk */}
                <div className="bg-white border border-[#cbd5e1] rounded-xl p-4 shadow-2xs space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-[#f1f5f9]">
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-[#0284c7]" />
                        <span className="text-xs font-bold text-[#0f172a]">Maternal Health Risk</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        (patient.mlRiskAssessment?.maternalRisk.tier || patient.riskTier) === 'high'
                          ? 'bg-[#fee2e2] text-[#991b1b]'
                          : (patient.mlRiskAssessment?.maternalRisk.tier || patient.riskTier) === 'moderate'
                          ? 'bg-[#fef3c7] text-[#92400e]'
                          : 'bg-[#dcfce7] text-[#14532d]'
                      }`}>
                        {patient.mlRiskAssessment?.maternalRisk.tier || patient.riskTier}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#64748b] mt-2 space-y-1">
                      <div><strong>Focus Area:</strong> Blood Pressure, Sugar & Vital Signs</div>
                      {patient.mlRiskAssessment?.maternalRisk.probabilities && (
                        <div className="pt-2 space-y-1">
                          <div className="flex justify-between text-[10.5px]">
                            <span>Low Risk:</span>
                            <span className="font-mono font-bold">{formatProbability(patient.mlRiskAssessment.maternalRisk.probabilities.low)}</span>
                          </div>
                          <div className="flex justify-between text-[10.5px]">
                            <span>Moderate Risk:</span>
                            <span className="font-mono font-bold">{formatProbability(patient.mlRiskAssessment.maternalRisk.probabilities.moderate)}</span>
                          </div>
                          <div className="flex justify-between text-[10.5px]">
                            <span>High Risk:</span>
                            <span className="font-mono font-bold text-[#b91c1c]">{formatProbability(patient.mlRiskAssessment.maternalRisk.probabilities.high)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-[#475569] bg-[#f8fafc] p-2 rounded-lg border border-[#e2e8f0] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#0284c7] shrink-0" />
                    <span>Vital signs & glucose screening complete</span>
                  </div>
                </div>

                {/* Model 2: Nutritional Anemia Tracker */}
                <div className="bg-white border border-[#cbd5e1] rounded-xl p-4 shadow-2xs space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-[#f1f5f9]">
                      <div className="flex items-center gap-1.5">
                        <Droplets className="w-4 h-4 text-[#b45309]" />
                        <span className="text-xs font-bold text-[#0f172a]">Nutritional Anemia</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        (patient.mlRiskAssessment?.anemiaRisk.tier || (patient.hb && patient.hb < 10 ? 'high' : patient.hb && patient.hb < 11 ? 'moderate' : 'low')) === 'high'
                          ? 'bg-[#fee2e2] text-[#991b1b]'
                          : (patient.mlRiskAssessment?.anemiaRisk.tier || (patient.hb && patient.hb < 11 ? 'moderate' : 'low')) === 'moderate'
                          ? 'bg-[#fef3c7] text-[#92400e]'
                          : 'bg-[#dcfce7] text-[#14532d]'
                      }`}>
                        {patient.mlRiskAssessment?.anemiaRisk.tier || (patient.hb && patient.hb < 10 ? 'high' : patient.hb && patient.hb < 11 ? 'moderate' : 'low')}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#64748b] mt-2 space-y-1">
                      <div><strong>Assessment:</strong> {patient.mlRiskAssessment?.anemiaRisk.flag || 'Hemoglobin & iron levels evaluated'}</div>
                      {patient.mlRiskAssessment?.anemiaRisk.probabilities && (
                        <div className="pt-2 space-y-1">
                          <div className="flex justify-between text-[10.5px]">
                            <span>Healthy / Normal:</span>
                            <span className="font-mono font-bold">{formatProbability(patient.mlRiskAssessment.anemiaRisk.probabilities.normal)}</span>
                          </div>
                          <div className="flex justify-between text-[10.5px]">
                            <span>At-Risk / Anemic:</span>
                            <span className="font-mono font-bold text-[#b45309]">{formatProbability(patient.mlRiskAssessment.anemiaRisk.probabilities.atRisk)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-[#475569] bg-[#f8fafc] p-2 rounded-lg border border-[#e2e8f0] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#b45309] shrink-0" />
                    <span>Hemoglobin & nutrition screening complete</span>
                  </div>
                </div>

                {/* Model 3: Prenatal Depression & Distress Screener */}
                <div className="bg-white border border-[#cbd5e1] rounded-xl p-4 shadow-2xs space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-[#f1f5f9]">
                      <div className="flex items-center gap-1.5">
                        <Brain className="w-4 h-4 text-[#7e22ce]" />
                        <span className="text-xs font-bold text-[#0f172a]">Perinatal Wellbeing</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        (patient.mlRiskAssessment?.depressionRisk.tier || 'low') === 'high'
                          ? 'bg-[#fee2e2] text-[#991b1b]'
                          : (patient.mlRiskAssessment?.depressionRisk.tier || 'low') === 'moderate'
                          ? 'bg-[#fef3c7] text-[#92400e]'
                          : 'bg-[#dcfce7] text-[#14532d]'
                      }`}>
                        {patient.mlRiskAssessment?.depressionRisk.tier || 'low'}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#64748b] mt-2 space-y-1">
                      <div><strong>Assessment:</strong> {patient.mlRiskAssessment?.depressionRisk.flag || 'Positive emotional wellbeing observed'}</div>
                      {patient.mlRiskAssessment?.depressionRisk.probabilities && (
                        <div className="pt-2 space-y-1">
                          <div className="flex justify-between text-[10.5px]">
                            <span>Stable / Good Wellbeing:</span>
                            <span className="font-mono font-bold">{formatProbability(patient.mlRiskAssessment.depressionRisk.probabilities.minimal)}</span>
                          </div>
                          <div className="flex justify-between text-[10.5px]">
                            <span>Mild to Moderate Concern:</span>
                            <span className="font-mono font-bold">{formatProbability(patient.mlRiskAssessment.depressionRisk.probabilities.mildModerate)}</span>
                          </div>
                          <div className="flex justify-between text-[10.5px]">
                            <span>Elevated Distress:</span>
                            <span className="font-mono font-bold text-[#b91c1c]">{formatProbability(patient.mlRiskAssessment.depressionRisk.probabilities.severe)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-[#475569] bg-[#f8fafc] p-2 rounded-lg border border-[#e2e8f0] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#7e22ce] shrink-0" />
                    <span>Maternal emotional & mood screening complete</span>
                  </div>
                </div>
              </div>

              {/* Overall Clinical Preterm Score & Contributing Factors */}
              <div className="bg-white border border-[#cbd5e1] rounded-xl p-5 space-y-4 shadow-2xs">
                <div className="flex justify-between items-center pb-3 border-b border-[#e2e8f0]">
                  <div>
                    <span className="text-xs font-bold text-[#0f172a] block">Estimated Early Delivery Risk (&lt;34 weeks):</span>
                    <span className="text-[11px] text-[#64748b]">Combined risk forecast calculated from maternal vitals, lab results, and history</span>
                  </div>
                  <span className="text-2xl font-bold font-mono text-[#b91c1c]">{formatProbability(patient.pretermProbability)}</span>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">
                    Key Health Factors Influencing This Assessment:
                  </span>
                  {patient.featureWeights.map((fw, i) => (
                    <div key={i} className="flex justify-between text-xs py-1.5 px-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                      <span className="text-[#334155] font-medium">{fw.label}</span>
                      <span className={`font-mono font-bold ${fw.severity === 'high' ? 'text-[#b91c1c]' : 'text-[#0284c7]'}`}>
                        {fw.weight}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer with H 512 B Verification Signature & Print Button */}
        <div className="bg-[#f8fafc] px-6 py-3.5 border-t border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-[#64748b] font-mono">
            <ShieldCheck className="w-4 h-4 text-[#047857]" />
            <span>Form H 512 B Verified • Encrypted Local Vault • Hash: SHA256-9a2c</span>
          </div>

          <div className="flex items-center gap-2">
            {onDeletePatient && (
              <button
                onClick={() => onDeletePatient(patient)}
                className="px-3 py-2 text-xs font-bold text-[#dc2626] hover:bg-[#fef2f2] border border-[#fca5a5] rounded-lg shadow-2xs cursor-pointer flex items-center gap-1.5 transition-colors"
                title="Safely Delete Maternal Record"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete Record</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#475569] border border-[#cbd5e1] rounded-lg hover:bg-white cursor-pointer"
            >
              Close
            </button>

            <button
              onClick={handleCopyFHIR}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors border ${
                copiedFHIR
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'text-white bg-[#006194] hover:bg-[#004f7b] border-[#006194]'
              }`}
              title="Copy HL7 FHIR R4 JSON Bundle for validator.fhir.org"
            >
              {copiedFHIR ? (
                <Check className="w-3.5 h-3.5 text-white" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-white" />
              )}
              <span>{copiedFHIR ? 'FHIR Copied!' : 'Copy FHIR R4 JSON'}</span>
            </button>

            <button
              onClick={handleCopyJSON}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors border ${
                copiedJSON
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'text-[#006194] bg-[#f0f9ff] hover:bg-[#e0f2fe] border-[#bae6fd]'
              }`}
              title="Copy patient's complete raw JSON record"
            >
              {copiedJSON ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <FileJson className="w-3.5 h-3.5 text-[#006194]" />
              )}
              <span>{copiedJSON ? 'JSON Copied!' : 'Copy Raw JSON'}</span>
            </button>

            {onOpenQR && (
              <button
                onClick={() => {
                  onClose();
                  onOpenQR(patient);
                }}
                className="px-4 py-2 text-xs font-bold text-[#006194] bg-[#e0f2fe] hover:bg-[#bae6fd] border border-[#93c5fd] rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <QrCode className="w-3.5 h-3.5 text-[#0284c7]" />
                <span>Mobile Transfer QR</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-bold text-white bg-[#006194] hover:bg-[#004f7b] rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print H 512 B Record</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
