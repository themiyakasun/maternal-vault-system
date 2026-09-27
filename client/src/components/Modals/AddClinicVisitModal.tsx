import React, { useState, useEffect } from 'react';
import type { Patient, ANCVisitInput } from '../../types/triage';
import { useAuth } from '../../context/AuthContext';
import { formatDbDate } from '../../utils/dateUtils';
import { 
  X, 
  Calendar, 
  Activity, 
  HeartPulse, 
  Baby, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Pill, 
  UserCheck, 
  Stethoscope
} from 'lucide-react';

interface AddClinicVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onSaveVisit: (patientId: string, visitData: ANCVisitInput) => Promise<void> | void;
}

export const AddClinicVisitModal: React.FC<AddClinicVisitModalProps> = ({
  isOpen,
  onClose,
  patient,
  onSaveVisit,
}) => {
  const { currentUser } = useAuth();
  // Current visit sequencing
  const visitNo = (patient?.ancVisits?.length || 0) + 1;
  const prevVisit = patient?.ancVisits && patient.ancVisits.length > 0 
    ? patient.ancVisits[patient.ancVisits.length - 1] 
    : null;

  // Form State
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [gestationalWeeks, setGestationalWeeks] = useState<number>(patient?.gestationalWeeks || 32);
  const [gestationalDays, setGestationalDays] = useState<number>(patient?.gestationalDays || 0);
  const [weightKg, setWeightKg] = useState<string>(patient?.weightKg ? patient.weightKg.toString() : '64.0');
  const [bpSystolic, setBpSystolic] = useState<string>(patient?.bpSystolic ? patient.bpSystolic.toString() : '120');
  const [bpDiastolic, setBpDiastolic] = useState<string>(patient?.bpDiastolic ? patient.bpDiastolic.toString() : '80');
  const [sfhCm, setSfhCm] = useState<string>(patient?.fundalHeight ? patient.fundalHeight.replace(/\D/g, '') : `${patient?.gestationalWeeks || 32}`);
  const [presentation, setPresentation] = useState<string>('Cephalic (Vertex)');
  const [engagement, setEngagement] = useState<string>(patient && patient.gestationalWeeks > 36 ? 'Engaged' : 'Not engaged');
  const [fhr, setFhr] = useState<string>(patient?.fhr ? patient.fhr.replace(/\D/g, '') || '140' : '140');
  const [fm, setFm] = useState<string>('Active (>10/12h)');
  const [urineAlb, setUrineAlb] = useState<string>('Nil');
  const [urineSug, setUrineSug] = useState<string>('Nil');
  const [edema, setEdema] = useState<string>('Nil');
  const defaultExaminerName = currentUser ? `${currentUser.name} (${currentUser.role})` : (patient?.assessedBy || 'Sister Priya Sharma (PHM Lead)');
  const [examiner, setExaminer] = useState<string>(defaultExaminerName);
  const [remarks, setRemarks] = useState<string>('');

  // Supplements
  const [ifaIssued, setIfaIssued] = useState<boolean>(true);
  const [calciumIssued, setCalciumIssued] = useState<boolean>(true);
  const [vitCIssued, setVitCIssued] = useState<boolean>(true);
  const [foodSupplement, setFoodSupplement] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Synchronize initial values when selected patient changes
  useEffect(() => {
    if (patient) {
      setDate(new Date().toISOString().split('T')[0]);
      setGestationalWeeks(patient.gestationalWeeks || 32);
      setGestationalDays(patient.gestationalDays || 0);
      setWeightKg(patient.weightKg ? patient.weightKg.toString() : '64.0');
      setBpSystolic(patient.bpSystolic ? patient.bpSystolic.toString() : '120');
      setBpDiastolic(patient.bpDiastolic ? patient.bpDiastolic.toString() : '80');
      setSfhCm(patient.fundalHeight ? patient.fundalHeight.replace(/\D/g, '') || `${patient.gestationalWeeks}` : `${patient.gestationalWeeks || 32}`);
      setExaminer(currentUser ? `${currentUser.name} (${currentUser.role})` : (patient.assessedBy || 'Sister Priya Sharma (PHM Lead)'));
      setRemarks(patient.riskTier === 'high' ? 'High risk review visit. Advised on danger symptoms and rest.' : 'Routine antenatal progression. Advised on balanced nutrition.');
    }
  }, [patient, currentUser]);

  if (!isOpen || !patient) return null;

  // Real-time clinical calculations
  const sysNum = parseInt(bpSystolic, 10) || 0;
  const diaNum = parseInt(bpDiastolic, 10) || 0;
  const isHTN = sysNum >= 140 || diaNum >= 90;
  const isSevereHTN = sysNum >= 150 || diaNum >= 95;
  const mapValue = sysNum && diaNum ? Math.round((diaNum * 2 + sysNum) / 3) : 0;

  const currentWeightNum = parseFloat(weightKg) || 0;
  const prevWeightNum = prevVisit ? prevVisit.weightKg : patient.weightKg || currentWeightNum;
  const weightDelta = +(currentWeightNum - prevWeightNum).toFixed(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const weight = parseFloat(weightKg);
    const systolic = parseInt(bpSystolic, 10);
    const diastolic = parseInt(bpDiastolic, 10);

    if (isNaN(weight) || weight <= 30 || weight > 200) {
      setErrorMsg('Please enter a valid maternal weight in kg (30 - 200 kg).');
      return;
    }

    if (isNaN(systolic) || isNaN(diastolic) || systolic <= 60 || diastolic <= 40) {
      setErrorMsg('Please enter a valid blood pressure reading (e.g. 120 / 80).');
      return;
    }

    const poaString = `${gestationalWeeks}w ${gestationalDays}d`;
    const sfhFormatted = sfhCm.trim().endsWith('cm') ? sfhCm.trim() : `${sfhCm.trim()} cm`;
    const fhrFormatted = fhr.trim().endsWith('bpm') ? fhr.trim() : `${fhr.trim()} bpm`;

    const visitPayload: ANCVisitInput = {
      date: formatDbDate(date),
      poa: poaString,
      gestationalWeeks,
      gestationalDays,
      weightKg: weight,
      bpSystolic: systolic,
      bpDiastolic: diastolic,
      bp: `${systolic}/${diastolic}`,
      sfhCm: sfhFormatted,
      presentation,
      engagement,
      fhr: fhrFormatted,
      fm,
      urineAlb,
      urineSug,
      edema,
      examiner: examiner.trim() || 'Priya Sharma, PHM',
      remarks: remarks.trim() || 'Routine antenatal clinic visit recorded.',
      ifaIssued,
      calciumIssued,
      vitCIssued,
      foodSupplement,
    };

    try {
      setIsSubmitting(true);
      await onSaveVisit(patient.id, visitPayload);
      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      console.error('Error saving ANC visit:', err);
      setErrorMsg(err?.message || 'Failed to save clinic visit. Please retry.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/65 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border-t sm:border border-[#cbd5e1] max-w-3xl w-full overflow-hidden animate-in fade-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 flex flex-col max-h-[94vh] sm:max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-[#004b73] text-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center font-bold text-sm shadow-inner text-[#38bdf8]">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                  <span>Document Clinic Visit</span>
                  <span className="bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40 text-xs px-2 py-0.5 rounded font-mono font-bold">
                    Visit #{visitNo}
                  </span>
                </h2>
                <span className="bg-white/20 text-white text-[11px] font-mono px-2 py-0.5 rounded font-bold">
                  {patient.id}
                </span>
              </div>
              <p className="text-xs text-[#cce5ff] mt-0.5 flex items-center gap-2">
                <span>{patient.name}</span>
                <span>•</span>
                <span>Age {patient.age}</span>
                <span>•</span>
                <span>G{patient.gravida} P{patient.para}</span>
                <span>•</span>
                <span>ABHA: {patient.abhaId || '91-4299-8812-4411'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          
          {errorMsg && (
            <div className="bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5] p-3 rounded-lg flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-[#ef4444] shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1-Tap Fast Fill Helper Bar for Midwives */}
          <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div>
              <div className="text-xs font-bold text-[#1e40af] flex items-center gap-1.5">
                <span>✨ Midwife Fast Fill</span>
              </div>
              <p className="text-[11px] text-[#3b82f6] mt-0.5">
                1-tap presets to instantly fill standard normal vitals and routine tests
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setBpSystolic('120');
                setBpDiastolic('80');
                setFhr('140');
                setSfhCm(`${gestationalWeeks}`);
                setPresentation('Cephalic (Vertex)');
                setEngagement(gestationalWeeks > 36 ? 'Engaged' : 'Not engaged');
                setFm('Active (>10/12h)');
                setUrineAlb('Nil');
                setUrineSug('Nil');
                setEdema('Nil');
                setIfaIssued(true);
                setCalciumIssued(true);
                setVitCIssued(true);
                setFoodSupplement(true);
                setRemarks('Routine antenatal checkup. Fetal heartbeat regular. Advised balanced nutrition, hydration, and danger sign awareness.');
              }}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
            >
              Fill Routine Normal Visit
            </button>
          </div>

          {/* Section 1: Visit Timing & POA */}
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-[#006194] font-bold text-xs uppercase tracking-wider pb-1 border-b border-[#e2e8f0]">
              <Calendar className="w-4 h-4" />
              <span>1. Visit Timing & Gestational Age (POA)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block font-bold text-[#0f172a] mb-1">Visit Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white font-medium focus:ring-2 focus:ring-[#006194] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#0f172a] mb-1">Gestational Weeks</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="4"
                    max="44"
                    required
                    value={gestationalWeeks}
                    onChange={(e) => setGestationalWeeks(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white font-mono font-bold focus:ring-2 focus:ring-[#006194] focus:outline-none"
                  />
                  <span className="text-[#64748b] font-medium">weeks</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#0f172a] mb-1">Days</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    max="6"
                    value={gestationalDays}
                    onChange={(e) => setGestationalDays(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white font-mono font-bold focus:ring-2 focus:ring-[#006194] focus:outline-none"
                  />
                  <span className="text-[#64748b] font-medium">days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Maternal Biometrics & Hemodynamics */}
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-[#e2e8f0]">
              <div className="flex items-center gap-2 text-[#006194] font-bold text-xs uppercase tracking-wider">
                <Activity className="w-4 h-4" />
                <span>2. Maternal Biometrics & Blood Pressure</span>
              </div>
              {isHTN && (
                <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold uppercase ${
                  isSevereHTN ? 'bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]' : 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a]'
                }`}>
                  {isSevereHTN ? '⚠️ Severe High BP' : '⚠️ Elevated BP'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block font-bold text-[#0f172a] mb-1 flex items-center justify-between">
                  <span>Maternal Weight (kg)</span>
                  {prevVisit && (
                    <span className={`text-[10px] font-mono ${weightDelta >= 0 ? 'text-[#047857]' : 'text-[#b91c1c]'}`}>
                      {weightDelta >= 0 ? `+${weightDelta} kg` : `${weightDelta} kg`}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="30"
                    max="200"
                    required
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white font-mono font-bold focus:ring-2 focus:ring-[#006194] focus:outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-[#94a3b8] font-mono text-xs">kg</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#0f172a] mb-1">
                  Systolic BP (mmHg)
                </label>
                <input
                  type="number"
                  min="60"
                  max="260"
                  required
                  value={bpSystolic}
                  onChange={(e) => setBpSystolic(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg bg-white font-mono font-bold focus:outline-none ${
                    sysNum >= 140 ? 'border-[#dc2626] text-[#dc2626] bg-[#fef2f2]' : 'border-[#cbd5e1] text-[#0f172a]'
                  }`}
                />
              </div>

              <div>
                <label className="block font-bold text-[#0f172a] mb-1 flex items-center justify-between">
                  <span>Diastolic BP (mmHg)</span>
                  {mapValue > 0 && <span className="text-[10px] text-[#64748b] font-mono">MAP: {mapValue}</span>}
                </label>
                <input
                  type="number"
                  min="40"
                  max="160"
                  required
                  value={bpDiastolic}
                  onChange={(e) => setBpDiastolic(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg bg-white font-mono font-bold focus:outline-none ${
                    diaNum >= 90 ? 'border-[#dc2626] text-[#dc2626] bg-[#fef2f2]' : 'border-[#cbd5e1] text-[#0f172a]'
                  }`}
                />
              </div>
            </div>

            {/* Quick BP Chips */}
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              <span className="text-[10.5px] text-[#64748b] font-medium mr-1">Quick BP:</span>
              {[
                { sys: '110', dia: '70', label: '110/70 Normal' },
                { sys: '120', dia: '80', label: '120/80 Normal' },
                { sys: '130', dia: '85', label: '130/85 Borderline' },
                { sys: '140', dia: '90', label: '140/90 High' },
                { sys: '150', dia: '95', label: '150/95 Severe' },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    setBpSystolic(chip.sys);
                    setBpDiastolic(chip.dia);
                  }}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-mono font-semibold border transition-colors cursor-pointer ${
                    bpSystolic === chip.sys && bpDiastolic === chip.dia
                      ? 'bg-[#006194] text-white border-[#006194]'
                      : 'bg-white hover:bg-[#f1f5f9] text-[#334155] border-[#cbd5e1]'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Obstetric & Fetal Assessment */}
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-[#006194] font-bold text-xs uppercase tracking-wider pb-1 border-b border-[#e2e8f0]">
              <Baby className="w-4 h-4 text-[#006194]" />
              <span>3. Obstetric & Fetal Assessment</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              <div>
                <label className="block font-bold text-[#0f172a] mb-1">
                  SFH / Fundal (cm)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={sfhCm}
                    onChange={(e) => setSfhCm(e.target.value)}
                    placeholder="e.g. 32 or Palpable"
                    className="w-full px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white font-mono font-bold focus:ring-2 focus:ring-[#006194] focus:outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-[#94a3b8] font-mono text-xs">cm</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#0f172a] mb-1">
                  Fetal Heart Rate (FHR)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={fhr}
                    onChange={(e) => setFhr(e.target.value)}
                    placeholder="e.g. 140"
                    className="w-full px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white font-mono font-bold text-[#16a34a] focus:ring-2 focus:ring-[#006194] focus:outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-[#94a3b8] font-mono text-xs">bpm</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {['136', '140', '144', '150'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFhr(f)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
                        fhr.replace(/\D/g, '') === f
                          ? 'bg-[#16a34a] text-white border-[#16a34a]'
                          : 'bg-white hover:bg-[#f1f5f9] text-[#334155] border-[#cbd5e1]'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#0f172a] mb-1">
                  Presentation & Lie
                </label>
                <select
                  value={presentation}
                  onChange={(e) => setPresentation(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white font-medium focus:ring-2 focus:ring-[#006194] focus:outline-none"
                >
                  <option value="Cephalic (Vertex)">Cephalic (Vertex)</option>
                  <option value="Breech">Breech</option>
                  <option value="Transverse">Transverse Lie</option>
                  <option value="Oblique">Oblique</option>
                  <option value="Unstable">Unstable / Variable</option>
                  <option value="N/A (1st Trimester)">N/A (1st Trimester)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#0f172a] mb-1">
                  Engagement & Movements
                </label>
                <select
                  value={engagement}
                  onChange={(e) => setEngagement(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white font-medium focus:ring-2 focus:ring-[#006194] focus:outline-none"
                >
                  <option value="Not engaged">Not engaged (Free)</option>
                  <option value="Engaged">Engaged</option>
                  <option value="Fixing">Fixing / 3/5th</option>
                  <option value="N/A">N/A (&lt;34w)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-bold text-[#0f172a] mb-1">Fetal Movements (FM)</label>
                <select
                  value={fm}
                  onChange={(e) => setFm(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white font-medium focus:ring-2 focus:ring-[#006194] focus:outline-none"
                >
                  <option value="Active (>10/12h)">Active (&gt;10 in 12 hours) - Normal</option>
                  <option value="Felt / Regular">Felt / Regular</option>
                  <option value="Reduced (<10/12h)">Reduced (&lt;10/12h) - ⚠️ Alert</option>
                  <option value="Not felt">Not felt - 🚨 Immediate US Scan</option>
                  <option value="N/A (1st Trim)">N/A (&lt;18 weeks)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#0f172a] mb-1">Maternal Peripheral Edema</label>
                <select
                  value={edema}
                  onChange={(e) => setEdema(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white font-medium focus:ring-2 focus:ring-[#006194] focus:outline-none"
                >
                  <option value="Nil">Nil (No swelling)</option>
                  <option value="Trace ankle">Trace ankle edema</option>
                  <option value="Pre-tibial 1+">Pre-tibial 1+ (Pitting)</option>
                  <option value="Pre-tibial 2+">Pre-tibial 2+ (Elevated risk)</option>
                  <option value="Generalized / Facial">Generalized / Facial & Hands (🚨 High Risk)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Urinalysis Dipstick */}
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-[#006194] font-bold text-xs uppercase tracking-wider pb-1 border-b border-[#e2e8f0]">
              <HeartPulse className="w-4 h-4" />
              <span>4. Urinalysis Dipstick (H 512 B Standards)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-bold text-[#0f172a] mb-1 flex items-center justify-between">
                  <span>Urine Albumin (Proteinuria)</span>
                  {urineAlb !== 'Nil' && urineAlb !== 'Trace' && (
                    <span className="text-[#b91c1c] font-bold text-[10px]">⚠️ Pre-eclampsia marker</span>
                  )}
                </label>
                <select
                  value={urineAlb}
                  onChange={(e) => setUrineAlb(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg bg-white font-medium focus:ring-2 focus:ring-[#006194] focus:outline-none ${
                    urineAlb.includes('+') ? 'border-[#dc2626] text-[#dc2626] bg-[#fef2f2]' : 'border-[#cbd5e1]'
                  }`}
                >
                  <option value="Nil">Nil (Negative)</option>
                  <option value="Trace">Trace</option>
                  <option value="1+">1+ (30 mg/dL)</option>
                  <option value="2+">2+ (100 mg/dL) - Significant</option>
                  <option value="3+">3+ (300 mg/dL) - Severe</option>
                  <option value="4+">4+ (&gt;1000 mg/dL)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#0f172a] mb-1">Urine Sugar (Glycosuria)</label>
                <select
                  value={urineSug}
                  onChange={(e) => setUrineSug(e.target.value)}
                  className="w-full px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white font-medium focus:ring-2 focus:ring-[#006194] focus:outline-none"
                >
                  <option value="Nil">Nil (Negative)</option>
                  <option value="Trace">Trace</option>
                  <option value="1+">1+ (0.25 g/dL)</option>
                  <option value="2+">2+ (0.5 g/dL)</option>
                  <option value="3+">3+ (&gt;1.0 g/dL)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 5: Micronutrients & Routine Supplements Checklist */}
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-[#006194] font-bold text-xs uppercase tracking-wider pb-1 border-b border-[#e2e8f0]">
              <Pill className="w-4 h-4 text-[#047857]" />
              <span>5. Micronutrient Stock & Supplements Issued</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-[#e2e8f0] hover:border-[#006194] cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={ifaIssued}
                  onChange={(e) => setIfaIssued(e.target.checked)}
                  className="w-4 h-4 text-[#006194] rounded focus:ring-[#006194]"
                />
                <span className="font-bold text-[#0f172a]">IFA (Iron-Folic)</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-[#e2e8f0] hover:border-[#006194] cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={calciumIssued}
                  onChange={(e) => setCalciumIssued(e.target.checked)}
                  className="w-4 h-4 text-[#006194] rounded focus:ring-[#006194]"
                />
                <span className="font-bold text-[#0f172a]">Calcium Lactate</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-[#e2e8f0] hover:border-[#006194] cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={vitCIssued}
                  onChange={(e) => setVitCIssued(e.target.checked)}
                  className="w-4 h-4 text-[#006194] rounded focus:ring-[#006194]"
                />
                <span className="font-bold text-[#0f172a]">Vitamin C</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-[#e2e8f0] hover:border-[#006194] cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={foodSupplement}
                  onChange={(e) => setFoodSupplement(e.target.checked)}
                  className="w-4 h-4 text-[#006194] rounded focus:ring-[#006194]"
                />
                <span className="font-bold text-[#0f172a]">Food Supp. / Thriposha</span>
              </label>
            </div>
          </div>

          {/* Section 6: Examiner & Midwife Clinical Remarks */}
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-[#006194] font-bold text-xs uppercase tracking-wider pb-1 border-b border-[#e2e8f0]">
              <UserCheck className="w-4 h-4" />
              <span>6. Examiner & Clinical Management Remarks</span>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block font-bold text-[#0f172a] mb-1">Examiner Name & Designation</label>
                <input
                  type="text"
                  required
                  value={examiner}
                  onChange={(e) => setExaminer(e.target.value)}
                  placeholder="e.g. Priya Sharma, PHM"
                  className="w-full px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white font-medium focus:ring-2 focus:ring-[#006194] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-[#0f172a] mb-1">Clinical Remarks, Instructions & Treatment Plan</label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Document clinical observations, warning signs counselling, medications prescribed, or referrals..."
                  className="w-full px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white focus:ring-2 focus:ring-[#006194] focus:outline-none text-xs"
                />
              </div>
            </div>
          </div>

          {/* Footer Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#e2e8f0]">
            <div className="flex items-center gap-2 text-[11px] text-[#047857] font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#047857]" />
              <span>Auto-saved & encrypted on tablet • Works 100% offline</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none px-4 py-2 border border-[#cbd5e1] rounded-lg font-bold text-[#475569] hover:bg-[#f1f5f9] transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#006194] hover:bg-[#004f7b] text-white px-5 py-2 rounded-lg font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing Record...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save & Sign Clinic Visit</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
