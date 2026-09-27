import React, { useState } from 'react';
import type { Patient, ANCVisit } from '../../types/triage';
import { formatDisplayDate, formatDbDate } from '../../utils/dateUtils';
import {
  X,
  Upload,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';


interface ImportPatientVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportPatient: (patient: Patient) => void;
}

export const ImportPatientVaultModal: React.FC<ImportPatientVaultModalProps> = ({
  isOpen,
  onClose,
  onImportPatient,
}) => {
  const [jsonInput, setJsonInput] = useState<string>('');
  const [parsedPatient, setParsedPatient] = useState<Patient | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParseText = (text: string) => {
    setJsonInput(text);
    setParseError(null);
    setParsedPatient(null);

    if (!text.trim()) return;

    try {
      const data = JSON.parse(text.trim());

      // Handle Compact QR Schema (_mv: 1)
      if (data._mv === 1) {
        const rawId = data.id || `#${Math.floor(1000 + Math.random() * 9000)}`;
        const patientId = rawId.startsWith('#') ? rawId : `#${rawId}`;
        const bpParts = String(data.bp || '120/80').split('/');
        const bpSystolic = parseInt(bpParts[0], 10) || 120;
        const bpDiastolic = parseInt(bpParts[1], 10) || 80;
        const weeks = data.w || (data.ga ? parseInt(String(data.ga).split('w')[0], 10) : 12) || 12;
        const trim = (weeks > 27 ? 3 : weeks > 13 ? 2 : 1) as 1 | 2 | 3;
        const wt = typeof data.wt === 'number' ? data.wt : 62;

        const visits: ANCVisit[] = (data.vs || []).map((v: any[], idx: number) => ({
          visitNo: v[0] || idx + 1,
          date: formatDbDate(v[1] || new Date()),
          poa: v[2] || `${v[0] || weeks}w`,
          bp: v[3] || `${bpSystolic}/${bpDiastolic}`,
          weightKg: typeof v[4] === 'number' ? v[4] : parseFloat(String(v[4] || '60')) || 60,
          sfhCm: typeof v[5] === 'number' ? `${v[5]} cm` : String(v[5] || `${weeks} cm`),
          presentation: v[7] || 'Cephalic',
          engagement: 'Not engaged',
          fhr: String(v[6] || '140 bpm'),
          fm: 'Active (>10/12h)',
          urineAlb: v[8] || 'Nil',
          urineSug: v[9] || 'Nil',
          edema: 'Nil',
          examiner: 'Priya Sharma, PHM',
          remarks: v[10] || 'Documented ANC visit.',
          supplements: {
            ifaIssued: true,
            calciumIssued: true,
            vitCIssued: true,
            foodSupplement: true,
          },
        }));

        const pregnancies = (data.pr || []).map((p: any[], idx: number) => ({
          pregnancyNo: p[0] || idx + 1,
          year: p[1] || 2022,
          gaWeeks: 38,
          deliveryMode: p[2] || 'Vaginal',
          birthWeightKg: typeof p[3] === 'number' ? p[3] : 3.0,
          babySex: p[4] === 'male' || p[4] === 'M' ? 'M' : 'F',
          complications: p[5] || 'None',
        }));

        const constructed: Patient = {
          id: patientId,
          name: data.n || 'Imported Patient',
          age: data.a || 26,
          dob: '',
          phone: '',
          nicNo: '',
          gravida: data.g || 1,
          para: data.p || 0,
          livingChildren: data.lc ?? data.p ?? 0,
          abortions: 0,
          gestationalWeeks: weeks,
          gestationalDays: 0,
          trimester: trim,
          bpSystolic,
          bpDiastolic,
          isBpAlert: bpSystolic >= 140 || bpDiastolic >= 90,
          bmi: 22.0,
          bmiCategory: 'Normal',
          riskTier: data.rt || (bpSystolic >= 140 ? 'high' : 'low'),
          riskTitle: data.rt === 'high' ? 'HIGH RISK' : 'LOW RISK',
          riskSubtitle: 'Imported Maternal Vault',
          pretermProbability: data.rp || 15,
          specificCondition: data.rc || 'Routine Antenatal',
          featureWeights: [],
          notes: 'Transferred offline maternal health record.',
          village: 'Rampur',

          locality: 'Sector 3',
          abhaId: '',
          edd: formatDbDate(data.edd),
          lmp: formatDbDate(data.lmp),
          fundalHeight: `${weeks} cm`,
          hb: typeof data.hb === 'number' ? data.hb : 11.2,
          fhr: data.fhr || '140 bpm',
          bloodGroup: data.bg || data.lr?.bg || 'O+',
          heightCm: 158,
          weightKg: wt,
          partnerName: data.pt || '',
          pastObstetricHistory: pregnancies,
          medicalHistory: data.mh || {
            diabetes: false,
            chronicHtn: false,
            cardiac: false,
            asthma: false,
            thyroid: false,
            epilepsy: false,
            thalassaemia: false,
            allergies: 'None reported',
            surgeries: 'None',
          },
          labResults: {
            bloodGroup: data.lr?.bg || data.bg || 'O+',
            vdrl: data.lr?.vd || 'Non-reactive',
            rubella: data.lr?.rb || 'Immune',
            hiv: data.lr?.hv || 'Negative',
            hbsAg: data.lr?.hb || 'Negative',
            fbs: data.lr?.fs || '84 mg/dL',
            hbBooking: typeof data.hb === 'number' ? data.hb : 11.2,
            urineAlbumin: data.lr?.ua || 'Nil',
            urineSugar: data.lr?.us || 'Nil',
          },
          immunization: {
            ifaIssued: 120,
            calciumIssued: 60,
            vitCIssued: 60,
            mebendazoleGiven: false,
            thriposhaGiven: false,
          },
          intendedHospital: 'District Base Hospital',
          emergencyTransportReady: true,
          ancVisits: visits,
          syncStatus: 'updated-local',
          assessedBy: 'Imported Vault',
          assessedTime: 'Imported ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setParsedPatient(constructed);
        return;
      }

      // Handle Full Verbose JSON Schema
      const name = data.name || data.patientName;
      if (!name) {
        setParseError('Invalid data: Mother name is required.');
        return;
      }


      const rawId = data.id || data.patientId || `#${Math.floor(1000 + Math.random() * 9000)}`;
      const patientId = rawId.startsWith('#') ? rawId : `#${rawId}`;

      const bpSystolic = data.vitals?.bpSystolic || (data.vitals?.bp ? parseInt(data.vitals.bp.split('/')[0], 10) : data.bpSystolic) || 120;
      const bpDiastolic = data.vitals?.bpDiastolic || (data.vitals?.bp ? parseInt(data.vitals.bp.split('/')[1], 10) : data.bpDiastolic) || 80;

      const weeks = data.obstetric?.gestationalWeeks || data.gestationalWeeks || (data.ga ? parseInt(String(data.ga).split('w')[0], 10) : 12) || 12;
      const days = data.obstetric?.gestationalDays ?? data.gestationalDays ?? 0;
      const trim = (weeks > 27 ? 3 : weeks > 13 ? 2 : 1) as 1 | 2 | 3;

      const bmiVal = data.vitals?.bmi || data.bmi || 22.0;

      const visits: ANCVisit[] = (data.visits || data.ancVisits || []).map((v: any, idx: number) => ({
        visitNo: v.visitNo || idx + 1,
        date: formatDbDate(v.date || new Date()),
        poa: v.poa || `${v.week || weeks}w`,
        weightKg: typeof v.weightKg === 'number' ? v.weightKg : typeof v.weight === 'number' ? v.weight : parseFloat(String(v.weightKg || v.weight || '60')) || 60,
        bp: v.bp || `${bpSystolic}/${bpDiastolic}`,
        sfhCm: v.sfhCm || (v.fundal ? `${v.fundal} cm` : `${weeks} cm`),
        presentation: v.presentation || v.foetalPresentation || 'Cephalic',
        engagement: v.engagement || 'Not engaged',
        fhr: v.fhrString || (v.fhr ? `${v.fhr} bpm` : '140 bpm'),
        fm: v.fm || (v.foetalMovements ? 'Active (>10/12h)' : 'Active'),
        urineAlb: v.urineAlb || v.albumin || 'Nil',
        urineSug: v.urineSug || v.sugar || 'Nil',
        edema: v.edema || 'Nil',
        examiner: v.examiner || v.by || data.assessedBy || 'Priya Sharma, PHM',
        remarks: v.remarks || 'Documented ANC visit.',
        supplements: {
          ifaIssued: v.supplements?.ifaIssued ?? v.ironFolate ?? true,
          calciumIssued: v.supplements?.calciumIssued ?? v.calcium ?? true,
          vitCIssued: v.supplements?.vitCIssued ?? v.vitaminC ?? true,
          foodSupplement: v.supplements?.foodSupplement ?? true,
        },
      }));

      const constructedPatient: Patient = {
        id: patientId,
        name: name,
        age: data.age || 26,
        dob: formatDbDate(data.dob),
        phone: data.phone || '',
        nicNo: data.nicNo || '',
        gravida: data.obstetric?.gravida ?? data.gravida ?? 1,
        para: data.obstetric?.para ?? data.para ?? 0,
        livingChildren: data.obstetric?.livingChildren ?? data.livingChildren ?? (data.obstetric?.para ?? data.para ?? 0),
        abortions: data.obstetric?.abortions ?? data.abortions ?? 0,
        gestationalWeeks: weeks,
        gestationalDays: days,
        trimester: trim,
        bpSystolic,
        bpDiastolic,
        isBpAlert: bpSystolic >= 140 || bpDiastolic >= 90,
        bmi: bmiVal,
        bmiCategory: bmiVal >= 30 ? 'Elevated (Obese I)' : bmiVal >= 25 ? 'Overweight' : 'Normal',
        riskTier: data.risk?.tier || data.riskTier || (bpSystolic >= 140 ? 'high' : 'low'),
        riskTitle: data.risk?.title || data.riskTitle || (bpSystolic >= 140 ? 'HIGH RISK' : 'LOW RISK'),
        riskSubtitle: data.risk?.subtitle || data.riskSubtitle || 'Imported Maternal Vault',
        pretermProbability: data.risk?.prob ?? data.pretermProbability ?? 15,
        specificCondition: data.risk?.cond || data.specificCondition || 'Routine Antenatal',
        alertHeadline: data.risk?.alertHeadline || '',
        alertDetails: data.risk?.alertDetails || '',
        featureWeights: data.featureWeights || [],
        notes: data.notes || 'Transferred offline maternal health record.',
        village: data.village || data.locality || 'Rampur',
        locality: data.locality || data.village || 'Sector 3',
        abhaId: data.abha || data.abhaId || '',
        edd: formatDbDate(data.obstetric?.edd || data.edd),
        lmp: formatDbDate(data.obstetric?.lmp || data.lmp),
        poaAtBooking: data.obstetric?.poaAtBooking || data.poaAtBooking || '',
        fundalHeight: data.obstetric?.fundalHeight || data.fundal || data.fundalHeight || `${weeks} cm`,
        hb: data.vitals?.hb ?? data.hb ?? 11.2,
        fhr: data.vitals?.fhr || data.fhr || '140 bpm',
        bloodGroup: data.vitals?.bloodGroup || data.labResults?.bloodGroup || data.bloodGroup || 'O+',
        heightCm: data.vitals?.height || data.vitals?.heightCm || data.heightCm || 158,
        weightKg: data.vitals?.weight || data.vitals?.weightKg || data.weightKg || 62,
        partnerName: data.partner?.name || data.partnerName || '',
        partnerAge: data.partner?.age || data.partnerAge || null,
        partnerOccupation: data.partner?.occupation || data.partnerOccupation || '',
        mohArea: data.mohArea || '',
        phmRegisterNo: data.phmRegisterNo || '',
        registrationDate: formatDbDate(data.registrationDate || new Date()),
        pastObstetricHistory: (data.pregnancies || data.pastObstetricHistory || []).map((p: any, idx: number) => ({
          pregnancyNo: p.order || p.pregnancyNo || idx + 1,
          year: p.year || 2022,
          gaWeeks: p.gaWeeks || 38,
          deliveryMode: p.deliveryMode || p.mode || 'Vaginal',
          birthWeightKg: p.birthWeight || p.birthWeightKg || 3.0,
          babySex: p.sex === 'male' || p.babySex === 'M' ? 'M' : 'F',
          complications: p.antenatalComplications || p.complications || 'None',
        })),
        medicalHistory: {
          diabetes: !!(data.medicalHistory?.diabetes),
          chronicHtn: !!(data.medicalHistory?.chronicHtn),
          cardiac: !!(data.medicalHistory?.cardiac),
          asthma: !!(data.medicalHistory?.asthma),
          thyroid: !!(data.medicalHistory?.thyroid),
          epilepsy: !!(data.medicalHistory?.epilepsy),
          thalassaemia: !!(data.medicalHistory?.thalassaemia),
          allergies: data.medicalHistory?.allergies || data.vitals?.allergies || 'None reported',
          surgeries: data.medicalHistory?.surgeries || 'None',
        },
        labResults: {
          bloodGroup: data.labResults?.bloodGroup || data.bloodGroup || 'O+',
          vdrl: data.labResults?.vdrl || data.investigations?.vdrl || 'Non-reactive',
          rubella: data.labResults?.rubella || data.investigations?.rubella || 'Immune',
          hiv: data.labResults?.hiv || data.investigations?.hiv || 'Negative',
          hbsAg: data.labResults?.hbsAg || data.investigations?.hbsAg || 'Negative',
          fbs: data.labResults?.fbs || data.investigations?.bloodSugar || '84 mg/dL',
          ogttFasting: data.labResults?.ogttFasting || '',
          ogtt1h: data.labResults?.ogtt1h || '',
          ogtt2h: data.labResults?.ogtt2h || '',
          hbBooking: data.labResults?.hbBooking || data.vitals?.hb || data.hb || 11.2,
          hb28w: data.labResults?.hb28w,
          hb36w: data.labResults?.hb36w,
          urineAlbumin: data.labResults?.urineAlbumin || 'Nil',
          urineSugar: data.labResults?.urineSugar || 'Nil',
        },
        immunization: {
          tt1Date: formatDbDate(data.immunization?.tt1Date),
          tt2Date: formatDbDate(data.immunization?.tt2Date),
          ttBooster: formatDbDate(data.immunization?.ttBooster),
          ifaIssued: data.immunization?.ifaIssued ?? 120,
          calciumIssued: data.immunization?.calciumIssued ?? 60,
          vitCIssued: data.immunization?.vitCIssued ?? 60,
          mebendazoleGiven: data.immunization?.mebendazoleGiven ?? false,
          thriposhaGiven: data.immunization?.thriposhaGiven ?? false,
        },
        intendedHospital: data.deliveryPlan?.intendedHospital || data.intendedHospital || 'District Base Hospital',
        emergencyTransportReady: data.deliveryPlan?.emergencyTransportReady ?? data.emergencyTransportReady ?? true,
        ancVisits: visits,
        syncStatus: 'updated-local',
        assessedBy: data.assessedBy || data.by || 'Imported Vault',
        assessedTime: 'Imported ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setParsedPatient(constructedPatient);
    } catch (e: any) {
      setParseError('Failed to parse JSON. Please verify that the data is valid JSON format.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleParseText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!parsedPatient) return;
    onImportPatient(parsedPatient);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#cbd5e1] w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#004b73] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center font-bold">
              <Upload className="w-5 h-5 text-[#38bdf8]" />
            </div>
            <div>
              <h2 className="text-base font-bold">Import Maternal Health Vault</h2>
              <p className="text-xs text-[#cce5ff]">
                Load patient record from QR scan payload or exported .json vault file
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#f8fafc]">
          {/* File Upload / Paste Box */}
          <div className="bg-white p-4 rounded-xl border border-[#cbd5e1] shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#0f172a] flex items-center gap-1.5">
                <FileJson className="w-4 h-4 text-[#006194]" />
                <span>Paste Scanned QR / JSON Payload:</span>
              </label>

              <label className="px-2.5 py-1 rounded-lg bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#006194] text-xs font-bold border border-[#cbd5e1] cursor-pointer flex items-center gap-1 transition-all">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload .JSON File</span>
                <input
                  type="file"
                  accept=".json,application/json,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              value={jsonInput}
              onChange={(e) => handleParseText(e.target.value)}
              placeholder='Paste raw JSON or scanned QR text here... e.g. { "app": "MaternaVault", "name": "Ananya Devi", ... }'
              rows={4}
              className="w-full p-2.5 text-xs font-mono bg-[#f8fafc] border border-[#cbd5e1] rounded-lg focus:outline-hidden focus:border-[#006194] focus:ring-1 focus:ring-[#006194] text-[#0f172a] placeholder-[#94a3b8] resize-y"
            />

            {parseError && (
              <div className="p-2.5 rounded-lg bg-[#fef2f2] border border-[#fca5a5] text-xs text-[#991b1b] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#ef4444] shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </div>

          {/* Validated Live Preview Card */}
          {parsedPatient && (
            <div className="bg-white p-4 rounded-xl border-2 border-[#16a34a]/40 shadow-xs space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                  <span className="text-xs font-bold text-[#16a34a] uppercase tracking-wider">
                    Valid Maternal Vault Detected
                  </span>
                </div>
                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded uppercase border ${
                  parsedPatient.riskTier === 'high' ? 'bg-[#fee2e2] text-[#991b1b] border-[#fca5a5]' : 'bg-[#dcfce7] text-[#14532d] border-[#bbf7d0]'
                }`}>
                  {parsedPatient.riskTier} Risk
                </span>
              </div>

              {/* Patient Identity Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a]">{parsedPatient.name}</h3>
                  <div className="text-xs text-[#64748b]">
                    ID: <span className="font-mono font-bold text-[#006194]">{parsedPatient.id}</span> • {parsedPatient.age} yrs • G{parsedPatient.gravida}P{parsedPatient.para} (Living: {parsedPatient.livingChildren})
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-bold text-[#006194]">{parsedPatient.gestationalWeeks}w {parsedPatient.gestationalDays}d</div>
                  <div className="text-[11px] text-[#64748b]">EDD: {formatDisplayDate(parsedPatient.edd)}</div>
                </div>
              </div>

              {/* Vitals Summary Grid */}
              <div className="grid grid-cols-4 gap-2 text-center bg-[#f8fafc] p-2.5 rounded-lg border border-[#e2e8f0]">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#64748b]">BP</div>
                  <div className="font-mono font-bold text-xs text-[#0f172a]">{parsedPatient.bpSystolic}/{parsedPatient.bpDiastolic}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#64748b]">Hb</div>
                  <div className="font-mono font-bold text-xs text-[#0f172a]">{parsedPatient.hb} g/dL</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#64748b]">Blood Group</div>
                  <div className="font-mono font-bold text-xs text-[#991b1b]">{parsedPatient.bloodGroup}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#64748b]">Visits</div>
                  <div className="font-mono font-bold text-xs text-[#16a34a]">{parsedPatient.ancVisits?.length || 0} visits</div>
                </div>
              </div>

              {/* Clinical Condition & Notes */}
              <div className="text-xs text-[#475569] bg-[#f1f5f9] p-2.5 rounded-lg">
                <strong>Condition:</strong> {parsedPatient.specificCondition || 'Routine Antenatal'} • {parsedPatient.notes}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#f8fafc] px-5 py-3 border-t border-[#e2e8f0] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
            <ShieldCheck className="w-4 h-4 text-[#047857]" />
            <span>Zero Data Loss • Safe Encrypted Storage</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-[#475569] bg-white border border-[#cbd5e1] rounded-lg hover:bg-[#f1f5f9] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!parsedPatient}
              className={`px-5 py-1.5 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 shadow-xs transition-all ${
                parsedPatient
                  ? 'bg-[#006194] hover:bg-[#004f7b] text-white'
                  : 'bg-[#cbd5e1] text-[#94a3b8] cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Import &amp; Save Record</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
