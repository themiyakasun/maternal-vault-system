import React, { useState, useEffect, useRef } from 'react';
import type { Patient, RiskFeatureWeight, RiskTier, ANCVisit } from '../../types/triage';
import { useAuth } from '../../context/AuthContext';
import { formatDbDate, formatDisplayDate } from '../../utils/dateUtils';
import { 
  X, 
  Camera, 
  Sparkles, 
  Scan, 
  User, 
  Calendar, 
  Activity, 
  Baby, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Stethoscope, 
  Phone, 
  MapPin, 
  Building2, 
  FileText,
  RefreshCw
} from 'lucide-react';
import { patientApi } from '../../services/patientApi';
import { validateClinicalVitals } from '../../utils/clinicalValidation';

interface RapidIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPatient: (patient: Patient) => void;
  existingPatients?: Patient[];
}

export const RapidIntakeModal: React.FC<RapidIntakeModalProps> = ({
  isOpen,
  onClose,
  onAddPatient,
  existingPatients,
}) => {
  const { currentClinic, currentUser } = useAuth();
  const [activeMode, setActiveMode] = useState<'form' | 'ocr'>('form');
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrSuccess, setOcrSuccess] = useState(false);
  const [activeSection, setActiveSection] = useState<'all' | 'demo' | 'dates' | 'vitals' | 'history' | 'plan'>('all');
  const [nicError, setNicError] = useState<string | null>(null);
  const [isCheckingNic, setIsCheckingNic] = useState(false);
  const nicCheckCache = useRef<Map<string, { exists: boolean; patient?: any; source?: string }>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  // 0. Data Recorded Date (for transcribing old/historical paper records or live visits)
  const [recordDate, setRecordDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // 1. Mother Identification & Demographics
  const [name, setName] = useState('');
  const [age, setAge] = useState('26');
  const [dob, setDob] = useState('1998-05-14');
  const [nicNo, setNicNo] = useState('');

  const validateNic = async (nic: string): Promise<boolean> => {
    const clean = nic.trim().toUpperCase();
    if (!clean) {
      setNicError(null);
      setIsCheckingNic(false);
      return true;
    }

    // 1. Instant check in local browser state - 0ms (no network delay!)
    if (existingPatients && existingPatients.length > 0) {
      const localDup = existingPatients.find(
        (p) => p.nicNo && p.nicNo.trim().toUpperCase() === clean
      );
      if (localDup) {
        setNicError(`Mother with NIC "${clean}" is already registered (${localDup.name} - ${localDup.id}).`);
        setIsCheckingNic(false);
        return false;
      }
    }

    // 2. Only query the backend database if the NIC looks complete (>= 9 characters)
    // Sri Lankan NICs are 10 chars (9 digits + V/X) or 12 digits.
    if (clean.length < 9) {
      setNicError(null);
      setIsCheckingNic(false);
      return true;
    }

    // 3. Check memory cache (0ms instant return)
    if (nicCheckCache.current.has(clean)) {
      const cached = nicCheckCache.current.get(clean)!;
      if (cached.exists && cached.patient) {
        setNicError(
          `Mother with NIC "${clean}" is already registered in ${cached.source === 'cloud' ? 'cloud database' : 'local database'} (${cached.patient.name} - ${cached.patient.id}).`
        );
        setIsCheckingNic(false);
        return false;
      } else {
        setNicError(null);
        setIsCheckingNic(false);
        return true;
      }
    }

    // 4. Cancel previous in-flight request so requests never stack up
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setIsCheckingNic(true);
      const res = await patientApi.checkNic(clean, currentClinic?.id);
      if (res) {
        nicCheckCache.current.set(clean, res);
      }
      if (res?.exists && res?.patient) {
        setNicError(
          `Mother with NIC "${clean}" is already registered in ${res.source === 'cloud' ? 'cloud database' : 'local database'} (${res.patient.name} - ${res.patient.id}).`
        );
        return false;
      }
    } catch {
      // offline check already passed locally
    } finally {
      setIsCheckingNic(false);
    }

    setNicError(null);
    return true;
  };

  // Debounced live NIC validation on keystroke or pre-fill
  useEffect(() => {
    const clean = nicNo.trim().toUpperCase();
    if (!clean) {
      setNicError(null);
      setIsCheckingNic(false);
      return;
    }
    // If under 9 chars, do local check only (0ms) without network calls
    if (clean.length < 9) {
      validateNic(nicNo);
      return;
    }
    const timer = setTimeout(() => {
      validateNic(nicNo);
    }, 350);
    return () => clearTimeout(timer);
  }, [nicNo, existingPatients]);
  const [phmRegisterNo, setPhmRegisterNo] = useState('');
  const [mohArea, setMohArea] = useState(currentClinic?.name ? `${currentClinic.name} MOH` : 'MOH Rampur');
  const [village, setVillage] = useState('Rampur North Sector 2');
  const [locality, setLocality] = useState('GN Division 14');
  const [phone, setPhone] = useState('077 123 4567');
  const [partnerName, setPartnerName] = useState('');
  const [partnerAge, setPartnerAge] = useState('29');
  const [partnerOccupation, setPartnerOccupation] = useState('Agriculture / Daily Trade');

  // 2. Obstetric Dating & Menstrual History
  const [lmp, setLmp] = useState('2024-04-12');
  const [edd, setEdd] = useState('2025-01-17');
  const [poaAtBooking, setPoaAtBooking] = useState('8w 2d');
  const [weeks, setWeeks] = useState('28');
  const [days, setDays] = useState('3');

  // 3. Baseline Physical Vitals & Anthropometry
  const [heightCm, setHeightCm] = useState('158');
  const [weightKg, setWeightKg] = useState('62.5');
  const [bloodGroup, setBloodGroup] = useState('B +ve');
  const [systolic, setSystolic] = useState('120');
  const [diastolic, setDiastolic] = useState('80');
  const [hb, setHb] = useState('11.4');
  const [fundalHeight, setFundalHeight] = useState('28');
  const [fhr, setFhr] = useState('142');
  const [urineAlbumin, setUrineAlbumin] = useState('Nil');
  const [urineSugar, setUrineSugar] = useState('Nil');
  const [vdrl, setVdrl] = useState('Non-reactive');
  const [rubella, setRubella] = useState('Immune');
  const [hiv, setHiv] = useState('Non-reactive');
  const [hbsAg, setHbsAg] = useState('Negative');
  const [fbs, setFbs] = useState('84 mg/dL');

  // 4. Past Obstetric & Medical History
  const [gravida, setGravida] = useState('2');
  const [para, setPara] = useState('1');
  const [livingChildren, setLivingChildren] = useState('1');
  const [abortions, setAbortions] = useState('0');
  const [prevLscs, setPrevLscs] = useState(false);
  const [prevPreterm, setPrevPreterm] = useState(false);
  const [prevPph, setPrevPph] = useState(false);
  const [stillbirth, setStillbirth] = useState(false);

  // Medical conditions
  const [medDiabetes, setMedDiabetes] = useState(false);
  const [medHtn, setMedHtn] = useState(false);
  const [medCardiac, setMedCardiac] = useState(false);
  const [medAsthma, setMedAsthma] = useState(false);
  const [medThyroid, setMedThyroid] = useState(false);
  const [medEpilepsy, setMedEpilepsy] = useState(false);
  const [medThalassaemia, setMedThalassaemia] = useState(false);
  const [allergies, setAllergies] = useState('None known');

  // 5. Danger Signs & Delivery Plan
  const [severeHeadache, setSevereHeadache] = useState(false);
  const [blurredVision, setBlurredVision] = useState(false);
  const [epigastricPain, setEpigastricPain] = useState(false);
  const [vaginalBleeding, setVaginalBleeding] = useState(false);
  const [reducedMovements, setReducedMovements] = useState(false);
  const [edema, setEdema] = useState(false);

  const [intendedHospital, setIntendedHospital] = useState('Base Hospital Rampur (Specialist Unit)');
  const [emergencyTransportReady, setEmergencyTransportReady] = useState(true);
  const [notes, setNotes] = useState('Intake registration completed. Baseline investigations collected.');

  // Auto-generate PHM registration number on open if blank
  useEffect(() => {
    if (!phmRegisterNo) {
      const randomNo = Math.floor(10 + Math.random() * 90);
      setPhmRegisterNo(`PHM/2026/0${randomNo}`);
    }
  }, [phmRegisterNo]);

  // Helper: Auto-calculate EDD and Gestational Age based on LMP and the specific Data Recorded Date (Naegele's rule: LMP + 280 days)
  const calculateGaAndEdd = (lmpVal: string, targetRecordDate: string) => {
    if (!lmpVal) return;

    try {
      const lmpDate = new Date(lmpVal);
      const recDate = targetRecordDate ? new Date(targetRecordDate) : new Date();

      if (!isNaN(lmpDate.getTime())) {
        // EDD = LMP + 280 days
        const eddDate = new Date(lmpDate.getTime() + 280 * 24 * 60 * 60 * 1000);
        setEdd(eddDate.toISOString().split('T')[0]);

        if (!isNaN(recDate.getTime())) {
          // Gestational Age on the date when the record was taken
          const diffMs = recDate.getTime() - lmpDate.getTime();
          const diffDays = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
          const calcWeeks = Math.floor(diffDays / 7);
          const calcDays = diffDays % 7;

          if (calcWeeks >= 0 && calcWeeks <= 44) {
            setWeeks(calcWeeks.toString());
            setDays(calcDays.toString());
            setPoaAtBooking(`${calcWeeks}w ${calcDays}d`);
            setFundalHeight(calcWeeks >= 14 ? `${calcWeeks}` : 'Palpable');
          }
        }
      }
    } catch {
      // ignore calculation error
    }
  };

  const handleLmpChange = (val: string) => {
    setLmp(val);
    calculateGaAndEdd(val, recordDate);
  };

  const handleRecordDateChange = (val: string) => {
    setRecordDate(val);
    if (lmp) {
      calculateGaAndEdd(lmp, val);
    }
  };

  // Auto-calculate BMI in real time
  const heightVal = parseFloat(heightCm) || 0;
  const weightVal = parseFloat(weightKg) || 0;
  const computedBmi = heightVal > 0 && weightVal > 0 
    ? +(weightVal / Math.pow(heightVal / 100, 2)).toFixed(1)
    : 22.4;

  const getBmiCategory = (bmi: number) => {
    if (bmi < 18.5) return { label: 'Underweight Range', color: 'text-amber-700 bg-amber-50 border-amber-300' };
    if (bmi <= 24.9) return { label: 'Normal Maternal BMI', color: 'text-emerald-700 bg-emerald-50 border-emerald-300' };
    if (bmi <= 29.9) return { label: 'Overweight Range', color: 'text-orange-700 bg-orange-50 border-orange-300' };
    return { label: 'Elevated (Obese Range)', color: 'text-red-700 bg-red-50 border-red-300' };
  };

  const bmiMeta = getBmiCategory(computedBmi);

  // Auto-calculate Trimester
  const weeksNum = parseInt(weeks, 10) || 12;
  const trimester: 1 | 2 | 3 = weeksNum > 27 ? 3 : weeksNum > 13 ? 2 : 1;

  // Real-time Risk Stratification preview
  const sysNum = parseInt(systolic, 10) || 120;
  const diaNum = parseInt(diastolic, 10) || 80;
  const isBpAlert = sysNum >= 140 || diaNum >= 90;
  const isSevereHtn = sysNum >= 150 || diaNum >= 95;
  const hbNum = parseFloat(hb) || 11.4;
  const isAnemia = hbNum < 11.0;
  const hasDangerSigns = severeHeadache || blurredVision || epigastricPain || vaginalBleeding || reducedMovements;

  let computedRiskTier: RiskTier = 'low';
  let computedRiskTitle = 'LOW RISK';
  let computedRiskSubtitle = 'Routine Antenatal Care';
  let computedPretermProb = 10;

  if (isBpAlert || prevPreterm || hasDangerSigns || medCardiac || isSevereHtn) {
    computedRiskTier = 'high';
    computedRiskTitle = 'HIGH RISK';
    if (isSevereHtn || (severeHeadache && isBpAlert)) {
      computedRiskSubtitle = 'Severe Gestational HTN • High Sensitivity';
      computedPretermProb = 68;
    } else if (hasDangerSigns) {
      computedRiskSubtitle = 'Obstetric Red Flag Symptoms Detected';
      computedPretermProb = 62;
    } else {
      computedRiskSubtitle = 'Preterm History • Blood Pressure Alert';
      computedPretermProb = 56;
    }
  } else if (isAnemia || computedBmi < 18.5 || computedBmi >= 30 || parseInt(gravida, 10) >= 4 || prevLscs || medDiabetes || medAsthma || medThyroid) {
    computedRiskTier = 'moderate';
    computedRiskTitle = 'MODERATE RISK';
    computedRiskSubtitle = isAnemia 
      ? `Gestational Anemia (Hb ${hbNum} g/dL) • IFA Support`
      : computedBmi < 18.5 
      ? 'Underweight Range • Nutrition Escalation'
      : prevLscs 
      ? 'Previous Caesarean Section Monitoring'
      : 'Specialized Antenatal Follow-up';
    computedPretermProb = 34;
  }

  // Pre-fill demo sample data
  const handlePrefillDemo = () => {
    setRecordDate('2024-04-12');
    setName('Kumari Sandamali Perera');
    setAge('26');
    setDob('1998-05-14');
    setNicNo('199864201234');
    setPhmRegisterNo('PHM/2026/042');
    setMohArea('MOH Rampur / Division 4B');
    setVillage('Rampur North Sector 2');
    setLocality('GN Division 14');
    setPhone('077 234 5678');
    setPartnerName('Sunil Shantha');
    setPartnerAge('30');
    setPartnerOccupation('Carpentry / Daily Trade');
    setLmp('2024-04-12');
    setEdd('2025-01-17');
    setPoaAtBooking('8w 2d');
    setWeeks('28');
    setDays('3');
    setHeightCm('158');
    setWeightKg('64.5');
    setBloodGroup('B +ve');
    setSystolic('124');
    setDiastolic('82');
    setHb('11.6');
    setFundalHeight('28');
    setFhr('142');
    setUrineAlbumin('Nil');
    setUrineSugar('Nil');
    setVdrl('Non-reactive');
    setRubella('Immune');
    setHiv('Non-reactive');
    setHbsAg('Negative');
    setFbs('82 mg/dL');
    setGravida('2');
    setPara('1');
    setLivingChildren('1');
    setAbortions('0');
    setPrevLscs(false);
    setPrevPreterm(false);
    setPrevPph(false);
    setStillbirth(false);
    setMedDiabetes(false);
    setMedHtn(false);
    setMedCardiac(false);
    setMedAsthma(false);
    setMedThyroid(false);
    setMedEpilepsy(false);
    setMedThalassaemia(false);
    setAllergies('None known');
    setSevereHeadache(false);
    setBlurredVision(false);
    setEpigastricPain(false);
    setVaginalBleeding(false);
    setReducedMovements(false);
    setEdema(false);
    setIntendedHospital('Base Hospital Rampur (Specialist Unit)');
    setEmergencyTransportReady(true);
    setNotes('Healthy primipara progression. Baseline blood group confirmed B +ve. Folic acid and IFA issued.');
  };

  // Simulate OCR scan
  const simulateOcrScan = () => {
    setOcrScanning(true);
    setOcrSuccess(false);

    setTimeout(() => {
      setRecordDate('2024-03-10');
      setName('Geeta Devi Samarawickrama');
      setAge('28');
      setDob('1996-08-20');
      setNicNo('199678301920');
      setPhmRegisterNo('PHM/2026/089');
      setMohArea('MOH Rampur / Sector 4B');
      setVillage('Rampur East Sector 4');
      setLocality('GN Division 08');
      setPhone('071 890 1234');
      setPartnerName('Ramesh Samarawickrama');
      setPartnerAge('32');
      setPartnerOccupation('Tea Estate Supervisor');
      setLmp('2024-03-10');
      setEdd('2024-12-15');
      setPoaAtBooking('9w 0d');
      setWeeks('32');
      setDays('1');
      setHeightCm('154');
      setWeightKg('68.0');
      setBloodGroup('O -ve');
      setSystolic('146');
      setDiastolic('94');
      setHb('10.2');
      setFundalHeight('32');
      setFhr('148');
      setUrineAlbumin('1+');
      setUrineSugar('Nil');
      setGravida('3');
      setPara('1');
      setLivingChildren('1');
      setAbortions('1');
      setPrevLscs(false);
      setPrevPreterm(true);
      setPrevPph(false);
      setStillbirth(false);
      setSevereHeadache(true);
      setBlurredVision(true);
      setEdema(true);
      setIntendedHospital('Teaching Hospital Kandy (Specialist Care)');
      setEmergencyTransportReady(true);
      setNotes('OCR Paper Card Extracted: Blood group O -ve (Rh Negative Alert). Elevated BP 146/94 and frontal headache flagged.');
      
      setOcrScanning(false);
      setOcrSuccess(true);
      setActiveMode('form');
    }, 1200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (nicError) {
      alert(`Cannot register: ${nicError}`);
      return;
    }

    if (nicNo.trim()) {
      const isValid = await validateNic(nicNo);
      if (!isValid) {
        alert(`Cannot register: Mother with NIC "${nicNo.trim().toUpperCase()}" is already registered.`);
        return;
      }
    }

    // Enforce Section 4.7.1, Table 4.4 Physiological Boundary Limits (TC-02)
    const clinicalValidation = validateClinicalVitals({
      bpSystolic: systolic,
      bpDiastolic: diastolic,
      weightKg,
      heightCm,
      hb,
      age,
      fhr,
      fundalHeight,
    });

    if (!clinicalValidation.isValid) {
      alert(`Clinical Range Violation (Table 4.4):\n${clinicalValidation.firstError}`);
      return;
    }

    const newId = `#${Math.floor(1000 + Math.random() * 9000)}`;
    const parsedWeeks = parseInt(weeks, 10) || 12;
    const parsedDays = parseInt(days, 10) || 0;
    const parsedAge = parseInt(age, 10) || 26;
    const parsedGravida = parseInt(gravida, 10) || 1;
    const parsedPara = parseInt(para, 10) || 0;
    const parsedLiving = parseInt(livingChildren, 10) || parsedPara;
    const parsedAbortions = parseInt(abortions, 10) || 0;
    const parsedHb = parseFloat(hb) || 11.4;
    const parsedHeight = parseFloat(heightCm) || 158;
    const parsedWeight = parseFloat(weightKg) || 62.5;

    const featureWeights: RiskFeatureWeight[] = [
      {
        label: `Systolic BP: ${sysNum} mmHg`,
        value: `${sysNum} mmHg`,
        weight: isBpAlert ? '+32% weight' : '+2% baseline',
        severity: isBpAlert ? 'high' : 'normal'
      },
      {
        label: `Obstetric Risk (G${parsedGravida}P${parsedPara}): ${prevPreterm ? 'Preterm History' : 'Standard'}`,
        value: prevPreterm ? 'Preterm History' : 'Standard',
        weight: prevPreterm ? '+28% weight' : '+1% baseline',
        severity: prevPreterm ? 'high' : 'normal'
      },
      {
        label: `Maternal BMI: ${computedBmi} kg/m²`,
        value: `${computedBmi}`,
        weight: computedBmi >= 30 ? '+18% weight' : computedBmi < 18.5 ? '+16% weight' : '+1% normal',
        severity: computedBmi >= 30 || computedBmi < 18.5 ? 'moderate' : 'normal'
      },
      {
        label: `Hemoglobin: ${parsedHb} g/dL`,
        value: `${parsedHb} g/dL`,
        weight: isAnemia ? '+22% weight' : '+1% baseline',
        severity: isAnemia ? 'moderate' : 'normal'
      }
    ];

    // Normalize recorded date for database storage (YYYY-MM-DD) and formatted display
    const dbRecordDate = formatDbDate(recordDate);
    const formattedBookingDate = formatDisplayDate(dbRecordDate);
    const isHistorical = dbRecordDate !== formatDbDate(new Date());

    // Initial booking visit entry
    const bookingVisit: ANCVisit = {
      visitNo: 1,
      date: dbRecordDate, // Strict ISO YYYY-MM-DD in database
      poa: `${parsedWeeks}w ${parsedDays}d`,
      weightKg: parsedWeight,
      bp: `${sysNum}/${diaNum}`,
      sfhCm: fundalHeight ? `${fundalHeight} cm` : `${parsedWeeks} cm`,
      presentation: parsedWeeks > 28 ? 'Cephalic (Vertex)' : 'N/A (Early Trim)',
      engagement: 'No',
      fhr: fhr ? `${fhr} bpm` : '140 bpm',
      fm: parsedWeeks >= 20 ? 'Active (>10/12h)' : 'Felt',
      urineAlb: urineAlbumin,
      urineSug: urineSugar,
      edema: edema ? 'Mild pedal' : 'Nil',
      examiner: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Sister Priya Sharma (PHM Lead)',
      remarks: isHistorical
        ? `Transcribed historical paper record (H 512 B) documented on ${formattedBookingDate}. Blood group ${bloodGroup} confirmed.`
        : `Initial registration & intake visit. Blood group ${bloodGroup} confirmed. Emergency plan documented for ${intendedHospital}.`,
      supplements: {
        ifaIssued: true,
        calciumIssued: true,
        vitCIssued: true,
        foodSupplement: computedBmi < 18.5
      }
    };

    const newPatient: Patient = {
      id: newId,
      name: name.trim() || 'Kumari Perera',
      age: parsedAge,
      dob: dob ? formatDbDate(dob) : undefined,
      nicNo: nicNo.trim() || undefined,
      phmRegisterNo: phmRegisterNo.trim() || `PHM/2026/${newId.replace('#', '')}`,
      mohArea: mohArea.trim() || 'MOH Rampur',
      village: village.trim() || 'Rampur North Sector 2',
      locality: locality.trim() || 'GN Division 14',
      phone: phone.trim() || undefined,
      partnerName: partnerName.trim() || undefined,
      partnerAge: parseInt(partnerAge, 10) || undefined,
      partnerOccupation: partnerOccupation.trim() || undefined,
      gravida: parsedGravida,
      para: parsedPara,
      livingChildren: parsedLiving,
      abortions: parsedAbortions,
      gestationalWeeks: parsedWeeks,
      gestationalDays: parsedDays,
      trimester,
      registrationDate: dbRecordDate,
      lmp: lmp ? formatDbDate(lmp) : undefined,
      edd: edd ? formatDbDate(edd) : undefined,
      poaAtBooking: poaAtBooking || `${parsedWeeks}w ${parsedDays}d`,
      heightCm: parsedHeight,
      weightKg: parsedWeight,
      bmi: computedBmi,
      bmiCategory: bmiMeta.label,
      bmiStatusClass: computedBmi >= 30 ? 'danger' : computedBmi >= 25 ? 'warning' : 'normal',
      bloodGroup: bloodGroup || 'O +ve',
      bpSystolic: sysNum,
      bpDiastolic: diaNum,
      isBpAlert,
      hb: parsedHb,
      isHbAlert: isAnemia,
      fundalHeight: fundalHeight ? `${fundalHeight} cm` : `${parsedWeeks} cm`,
      isFundalAlert: false,
      fhr: fhr ? `${fhr} bpm` : '140 bpm',
      isFhrAlert: false,
      riskTier: computedRiskTier,
      riskTitle: computedRiskTitle,
      riskSubtitle: computedRiskSubtitle,
      pretermProbability: computedPretermProb,
      alertHeadline: `Alert: Patient ${newId}`,
      alertDetails: computedRiskTier === 'high'
        ? 'Flagged by on-device clinical rules for elevated risk of gestational hypertension / obstetric indicators.'
        : 'Assessed on-device with stable maternal vital signs.',
      featureWeights,
      prevLscs,
      prevPreterm,
      prevPph,
      intendedHospital: intendedHospital || 'Base Hospital Rampur',
      emergencyTransportReady,
      dangerSignsPresent: [
        ...(severeHeadache ? ['Severe headache'] : []),
        ...(blurredVision ? ['Blurred vision'] : []),
        ...(epigastricPain ? ['Epigastric pain'] : []),
        ...(vaginalBleeding ? ['Vaginal bleeding/leak'] : []),
        ...(reducedMovements ? ['Reduced fetal movement'] : []),
        ...(edema ? ['Edema/swelling'] : []),
      ],
      medicalHistory: {
        diabetes: medDiabetes,
        chronicHtn: medHtn,
        cardiac: medCardiac,
        asthma: medAsthma,
        thyroid: medThyroid,
        epilepsy: medEpilepsy,
        thalassaemia: medThalassaemia,
        allergies: allergies.trim() || 'None known',
        surgeries: prevLscs ? 'Previous Caesarean Section' : 'None reported',
      },
      labResults: {
        bloodGroup: bloodGroup || 'O +ve',
        vdrl,
        rubella,
        hiv,
        hbsAg,
        fbs,
        hbBooking: parsedHb,
        urineAlbumin,
        urineSugar,
      },
      ancVisits: [bookingVisit],
      syncStatus: 'updated-local',
      syncNode: 'Local Encrypted Station (PHM-MUM-71)',
      syncProtocol: 'SQLite / AES-256-GCM Encrypted',
      assessedBy: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Sister Priya Sharma (PHM Lead)',
      assessedTime: isHistorical ? `${formattedBookingDate} (Paper Record)` : 'Just now (Encrypted)',
      assessedLocation: currentClinic?.name || 'MOH Rampur Clinic',
      tenantId: currentClinic?.id || 'clinic-ambagamuwa',
      clinicId: currentClinic?.id || 'clinic-ambagamuwa',
      notes: notes.trim() || (isHistorical ? `Historical record documented on ${formattedBookingDate}.` : 'Registration intake complete.'),
    };

    onAddPatient(newPatient);
    onClose();
  };

  if (!isOpen) return null;

  const isRhNegative = bloodGroup.includes('-ve');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border-t sm:border border-[#cbd5e1] max-w-4xl w-full overflow-hidden animate-in fade-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 max-h-[96vh] sm:max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="bg-[#006194] text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center text-white shadow-inner">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold tracking-tight">
                  Registration of Pregnant Mother
                </h3>
                <span className="text-[11px] bg-white/20 text-white px-2 py-0.5 rounded font-mono font-bold">
                  H 512 B Standard
                </span>
                {currentClinic && (
                  <span className="text-[10px] bg-[#004f7b] text-sky-100 px-2 py-0.5 rounded font-medium border border-white/20">
                    {currentClinic.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#cce5ff] mt-0.5 flex items-center gap-1.5">
                <span>{currentUser ? `Assessing Midwife: ${currentUser.name}` : 'Field Midwife Station'}</span>
                <span>•</span>
                <span>On-Device Vault Encryption</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white rounded-lg p-1.5 transition-colors hover:bg-white/10 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Action & Mode Switcher Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-4 sm:px-6 py-2 gap-2 text-xs">
          <div className="flex rounded-lg bg-slate-200/80 p-0.5 font-semibold">
            <button
              type="button"
              onClick={() => setActiveMode('form')}
              className={`px-3.5 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMode === 'form'
                  ? 'bg-white text-[#006194] shadow-xs font-bold'
                  : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Complete H 512 B Form
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('ocr')}
              className={`px-3.5 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                activeMode === 'ocr'
                  ? 'bg-white text-[#006194] shadow-xs font-bold'
                  : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-[#006194]" />
              Scan Paper MCP Card
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrefillDemo}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#006194] bg-[#e0f2fe] hover:bg-[#bae6fd] border border-[#7dd3fc] px-3 py-1.5 rounded-md transition-colors cursor-pointer"
              title="Populate sample data for demonstration"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Pre-fill Sample Data
            </button>
          </div>
        </div>

        {/* Form Content / OCR Scanner */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeMode === 'ocr' ? (
            <div className="text-center py-10 space-y-5 max-w-lg mx-auto">
              <div className="w-24 h-24 mx-auto rounded-2xl bg-[#e0f2fe] border-2 border-dashed border-[#0284c7] flex items-center justify-center text-[#0284c7] shadow-inner">
                <Camera className={`w-10 h-10 ${ocrScanning ? 'animate-bounce text-[#006194]' : ''}`} />
              </div>

              <div>
                <h4 className="text-base font-bold text-[#0f172a]">
                  OCR Camera Scanner for Mother-Child Protection Card
                </h4>
                <p className="text-xs text-[#64748b] mt-1.5 leading-relaxed">
                  Position the printed Sri Lankan H 512 B or MCP Card in front of your camera. On-device vision OCR extracts all clinical demographic numbers, vitals, LMP dates, and laboratory tests without transmitting sensitive PHI data.
                </p>
              </div>

              {ocrScanning && (
                <div className="inline-flex items-center gap-2 bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0] px-4 py-2 rounded-full text-xs font-semibold animate-pulse shadow-xs">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#16a34a]" />
                  Processing card image & recognizing handwriting...
                </div>
              )}

              {ocrSuccess && (
                <div className="inline-flex items-center gap-2 bg-[#dcfce7] text-[#14532d] border border-[#86efac] px-4 py-2 rounded-lg text-xs font-bold shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                  Card recognized successfully! All registration fields populated.
                </div>
              )}

              <div className="pt-3">
                <button
                  type="button"
                  onClick={simulateOcrScan}
                  disabled={ocrScanning}
                  className="bg-[#006194] hover:bg-[#004f7b] disabled:opacity-50 text-white px-6 py-3 rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 mx-auto cursor-pointer"
                >
                  <Scan className="w-4 h-4" />
                  {ocrScanning ? 'Scanning Card Image...' : 'Capture & Extract Card Data'}
                </button>
              </div>
            </div>
          ) : (
            <form id="maternal-intake-form" onSubmit={handleSubmit} className="space-y-6">

              {/* Section Jump Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveSection('all')}
                  className={`px-3 py-1 rounded-full font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    activeSection === 'all'
                      ? 'bg-[#006194] text-white'
                      : 'bg-slate-100 text-[#475569] hover:bg-slate-200'
                  }`}
                >
                  All Sections
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('demo')}
                  className={`px-3 py-1 rounded-full font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    activeSection === 'demo'
                      ? 'bg-[#006194] text-white'
                      : 'bg-slate-100 text-[#475569] hover:bg-slate-200'
                  }`}
                >
                  1. Identification
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('dates')}
                  className={`px-3 py-1 rounded-full font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    activeSection === 'dates'
                      ? 'bg-[#006194] text-white'
                      : 'bg-slate-100 text-[#475569] hover:bg-slate-200'
                  }`}
                >
                  2. Dating & LMP
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('vitals')}
                  className={`px-3 py-1 rounded-full font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    activeSection === 'vitals'
                      ? 'bg-[#006194] text-white'
                      : 'bg-slate-100 text-[#475569] hover:bg-slate-200'
                  }`}
                >
                  3. Baseline Vitals
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('history')}
                  className={`px-3 py-1 rounded-full font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    activeSection === 'history'
                      ? 'bg-[#006194] text-white'
                      : 'bg-slate-100 text-[#475569] hover:bg-slate-200'
                  }`}
                >
                  4. Obstetric History
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('plan')}
                  className={`px-3 py-1 rounded-full font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    activeSection === 'plan'
                      ? 'bg-[#006194] text-white'
                      : 'bg-slate-100 text-[#475569] hover:bg-slate-200'
                  }`}
                >
                  5. Red Flags & Plan
                </button>
              </div>

              {/* SECTION 1: Mother Identification & Demographics */}
              {(activeSection === 'all' || activeSection === 'demo') && (
                <div className="bg-white rounded-xl border border-[#cbd5e1] p-4 sm:p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-[#e2e8f0]">
                    <div className="w-7 h-7 rounded-md bg-[#e0f2fe] text-[#006194] flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#0f172a]">
                        Part I: Mother's Demographics & Clinic Registration
                      </h4>
                      <p className="text-[11px] text-[#64748b]">
                        Official identity, registration numbers, village division & partner details
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                    {/* 0. Data Recorded Date / Visit Date */}
                    <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-xl p-3 sm:col-span-2 md:col-span-3 space-y-1.5 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <label className="text-[11px] font-bold text-[#006194] uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-[#006194]" />
                          <span>Data Recorded Date / Registration Visit Date</span>
                          <span className="text-red-500">*</span>
                        </label>
                        {recordDate !== new Date().toISOString().split('T')[0] ? (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 self-start sm:self-auto">
                            <span>📜 Historical Paper Record Mode</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 self-start sm:self-auto">
                            <span>⚡ Today's Live Clinic Intake</span>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-0.5">
                        <input
                          type="date"
                          required
                          value={recordDate}
                          onChange={(e) => handleRecordDateChange(e.target.value)}
                          className="px-3 py-1.5 text-xs border border-[#7dd3fc] bg-white text-[#004b73] font-mono font-bold rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#006194]"
                        />
                        <button
                          type="button"
                          onClick={() => handleRecordDateChange(new Date().toISOString().split('T')[0])}
                          className="px-2.5 py-1.5 text-[11px] font-bold text-[#006194] bg-white hover:bg-slate-50 border border-[#93c5fd] rounded-lg transition-colors cursor-pointer"
                          title="Set to today's date"
                        >
                          Set to Today
                        </button>
                        <p className="text-[11px] text-[#475569] sm:ml-auto">
                          {recordDate !== new Date().toISOString().split('T')[0]
                            ? 'Gestational age & booking visit date are automatically calculated as of this historical date.'
                            : 'Change this date when transcribing an older paper card (H 512 B).'}
                        </p>
                      </div>
                    </div>

                    {/* Mother Name */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        Mother's Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Kumari Sandamali Perera"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg focus:outline-hidden focus:border-[#006194] focus:ring-1 focus:ring-[#006194] font-medium"
                      />
                    </div>

                    {/* Age & DOB */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        Age (Years) & DOB <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="number"
                          required
                          min="12"
                          max="60"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          placeholder="Age"
                          className="w-20 px-2.5 py-2 text-xs border border-[#cbd5e1] rounded-lg font-mono"
                        />
                        <input
                          type="date"
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          className="flex-1 px-2 py-2 text-xs border border-[#cbd5e1] rounded-lg font-mono text-[#475569]"
                        />
                      </div>
                    </div>

                    {/* NIC No */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider">
                          NIC / National ID No
                        </label>
                        {isCheckingNic && (
                          <span className="text-[10px] text-[#0284c7] font-medium flex items-center gap-1">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                            Checking duplicates...
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. 199864201234 or 956781234V"
                        value={nicNo}
                        onChange={(e) => {
                          setNicNo(e.target.value);
                          if (nicError) setNicError(null);
                        }}
                        onBlur={(e) => validateNic(e.target.value)}
                        className={`w-full px-3 py-2 text-xs border rounded-lg font-mono transition-colors ${
                          nicError ? 'border-[#ef4444] bg-[#fef2f2] text-[#991b1b] focus:ring-1 focus:ring-red-400' : 'border-[#cbd5e1]'
                        }`}
                      />
                      {nicError && (
                        <div className="mt-1.5 flex items-start gap-1.5 text-xs text-[#b91c1c] font-medium bg-[#fef2f2] p-2 rounded-lg border border-[#fecaca] animate-in fade-in duration-150">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#dc2626] mt-0.5" />
                          <span>{nicError}</span>
                        </div>
                      )}
                    </div>

                    {/* PHM Register No */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        PHM Register No (H 512 B)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. PHM/2026/042"
                        value={phmRegisterNo}
                        onChange={(e) => setPhmRegisterNo(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg font-mono text-[#006194] font-bold bg-[#f8fafc]"
                      />
                    </div>

                    {/* Contact Phone */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-[#64748b]" />
                        Mother Contact Number
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. 077 123 4567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg font-mono"
                      />
                    </div>

                    {/* MOH Area */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-[#64748b]" />
                        MOH Area / Division
                      </label>
                      <input
                        type="text"
                        value={mohArea}
                        onChange={(e) => setMohArea(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg"
                      />
                    </div>

                    {/* Village / Grama Niladhari */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#64748b]" />
                        Village / Zone
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rampur North Sector 2"
                        value={village}
                        onChange={(e) => setVillage(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg"
                      />
                    </div>

                    {/* Locality / GN Division */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        GN Division / Locality
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. GN Division 14"
                        value={locality}
                        onChange={(e) => setLocality(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg"
                      />
                    </div>

                    {/* Partner Name */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        Husband / Partner Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Sunil Shantha"
                        value={partnerName}
                        onChange={(e) => setPartnerName(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg"
                      />
                    </div>

                    {/* Partner Age */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        Partner Age (Years)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 30"
                        value={partnerAge}
                        onChange={(e) => setPartnerAge(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg font-mono"
                      />
                    </div>

                    {/* Partner Occupation */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        Partner Occupation
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Carpentry / Agriculture"
                        value={partnerOccupation}
                        onChange={(e) => setPartnerOccupation(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 2: Pregnancy Dating & Menstrual History */}
              {(activeSection === 'all' || activeSection === 'dates') && (
                <div className="bg-white rounded-xl border border-[#cbd5e1] p-4 sm:p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-[#e0f2fe] text-[#006194] flex items-center justify-center">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#0f172a]">
                          Part II: Obstetric Dating, LMP & EDD Calculation
                        </h4>
                        <p className="text-[11px] text-[#64748b]">
                          Last menstrual period, expected date of delivery, POA and trimester stage
                        </p>
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      trimester === 3 
                        ? 'bg-purple-100 text-purple-800 border border-purple-300' 
                        : trimester === 2 
                        ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}>
                      {trimester === 3 ? '3rd Trimester (28+ wks)' : trimester === 2 ? '2nd Trimester (14-27 wks)' : '1st Trimester (1-13 wks)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                    {/* LMP */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        LMP (Last Menstrual Period) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={lmp}
                        onChange={(e) => handleLmpChange(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg font-mono focus:border-[#006194]"
                      />
                      <span className="text-[10px] text-[#64748b] mt-0.5 block">
                        Auto-computes EDD & Gestation
                      </span>
                    </div>

                    {/* EDD */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        EDD (Expected Delivery Date) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={edd}
                        onChange={(e) => setEdd(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg font-mono text-[#006194] font-bold bg-[#f8fafc]"
                      />
                      <span className="text-[10px] text-[#006194] font-medium mt-0.5 block">
                        Naegele's Rule (+280 days)
                      </span>
                    </div>

                    {/* Gestational Age Weeks & Days */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider">
                          Gestational Age
                        </label>
                        {lmp && (
                          <button
                            type="button"
                            onClick={() => calculateGaAndEdd(lmp, recordDate)}
                            className="text-[10px] text-[#006194] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                            title="Recalculate GA as of the Data Recorded Date"
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            <span>From LMP</span>
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 relative">
                          <input
                            type="number"
                            min="1"
                            max="44"
                            value={weeks}
                            onChange={(e) => setWeeks(e.target.value)}
                            className="w-full px-2.5 py-2 text-xs border border-[#cbd5e1] rounded-lg font-mono font-bold"
                          />
                          <span className="absolute right-2.5 top-2 text-[11px] text-[#64748b] font-medium">wks</span>
                        </div>
                        <div className="w-20 relative">
                          <input
                            type="number"
                            min="0"
                            max="6"
                            value={days}
                            onChange={(e) => setDays(e.target.value)}
                            className="w-full px-2.5 py-2 text-xs border border-[#cbd5e1] rounded-lg font-mono"
                          />
                          <span className="absolute right-2 top-2 text-[11px] text-[#64748b] font-medium">days</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-[#64748b] mt-0.5 block">
                        As of record date ({recordDate})
                      </span>
                    </div>

                    {/* POA at Booking */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        POA at Registration Booking
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 8w 2d"
                        value={poaAtBooking}
                        onChange={(e) => setPoaAtBooking(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: Baseline Anthropometry, Vitals & Investigations */}
              {(activeSection === 'all' || activeSection === 'vitals') && (
                <div className="bg-white rounded-xl border border-[#cbd5e1] p-4 sm:p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-[#e0f2fe] text-[#006194] flex items-center justify-center">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#0f172a]">
                          Part III: Baseline Physical Measurements, Vitals & Labs
                        </h4>
                        <p className="text-[11px] text-[#64748b]">
                          Height, Weight, auto-calculated BMI, Blood Group, Blood Pressure, and Initial Booking Labs
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Rh Negative Alert Banner */}
                  {isRhNegative && (
                    <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2.5 text-amber-900 text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Rh Negative Isoimmunization Alert:</span> Mother is {bloodGroup}. Blood grouping & Rh status for husband should be verified; Indirect Coombs Test (ICT) required at 28 weeks.
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                    {/* Height */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        Maternal Height (cm) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="e.g. 158"
                        value={heightCm}
                        onChange={(e) => setHeightCm(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg font-mono font-medium"
                      />
                    </div>

                    {/* Weight */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        Booking Weight (kg) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 62.5"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg font-mono font-medium"
                      />
                    </div>

                    {/* BMI Auto-calculated */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        Calculated BMI (kg/m²)
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg font-mono font-bold bg-[#f8fafc] text-[#0f172a]">
                          {computedBmi} kg/m²
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 mt-1 inline-block rounded border ${bmiMeta.color}`}>
                        {bmiMeta.label}
                      </span>
                    </div>

                    {/* Blood Group */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        Blood Group & Rh (H 512 B) <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={bloodGroup}
                        onChange={(e) => setBloodGroup(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg font-bold text-[#0f172a] bg-white cursor-pointer"
                      >
                        <option value="O +ve">O +ve (O Rh+)</option>
                        <option value="A +ve">A +ve (A Rh+)</option>
                        <option value="B +ve">B +ve (B Rh+)</option>
                        <option value="AB +ve">AB +ve (AB Rh+)</option>
                        <option value="O -ve">O -ve (Rh Negative Alert)</option>
                        <option value="A -ve">A -ve (Rh Negative Alert)</option>
                        <option value="B -ve">B -ve (Rh Negative Alert)</option>
                        <option value="AB -ve">AB -ve (Rh Negative Alert)</option>
                      </select>
                    </div>

                    {/* Blood Pressure */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        Baseline BP (mmHg) <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="number"
                          placeholder="Sys"
                          value={systolic}
                          onChange={(e) => setSystolic(e.target.value)}
                          className={`w-1/2 px-2.5 py-2 text-xs border rounded-lg font-mono font-bold ${
                            sysNum >= 140 ? 'border-red-500 bg-red-50 text-red-700' : 'border-[#cbd5e1]'
                          }`}
                        />
                        <span className="text-xs text-[#64748b] font-bold">/</span>
                        <input
                          type="number"
                          placeholder="Dia"
                          value={diastolic}
                          onChange={(e) => setDiastolic(e.target.value)}
                          className={`w-1/2 px-2.5 py-2 text-xs border rounded-lg font-mono font-bold ${
                            diaNum >= 90 ? 'border-red-500 bg-red-50 text-red-700' : 'border-[#cbd5e1]'
                          }`}
                        />
                      </div>
                      {isBpAlert && (
                        <span className="text-[10px] text-red-600 font-bold mt-0.5 block">
                          {isSevereHtn ? 'Severe HTN Alert (≥150/95)' : 'Hypertension Alert (≥140/90)'}
                        </span>
                      )}
                    </div>

                    {/* Hemoglobin Hb */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        Baseline Hb (g/dL)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 11.4"
                        value={hb}
                        onChange={(e) => setHb(e.target.value)}
                        className={`w-full px-3 py-2 text-xs border rounded-lg font-mono font-bold ${
                          isAnemia ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-[#cbd5e1]'
                        }`}
                      />
                      {isAnemia && (
                        <span className="text-[10px] text-amber-700 font-bold mt-0.5 block">
                          {hbNum < 7.0 ? 'Severe Anemia (<7 g/dL)' : hbNum < 10.0 ? 'Moderate Anemia (7-9.9)' : 'Mild Anemia (<11 g/dL)'}
                        </span>
                      )}
                    </div>

                    {/* Fundal Height / SFH */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        Fundal Height (SFH cm)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 28 cm or Palpable"
                        value={fundalHeight}
                        onChange={(e) => setFundalHeight(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg font-mono"
                      />
                    </div>

                    {/* Fetal Heart Rate */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        Fetal Heart Rate (FHR bpm)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 142 bpm"
                        value={fhr}
                        onChange={(e) => setFhr(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg font-mono"
                      />
                    </div>
                  </div>

                  {/* Routine Labs Row */}
                  <div className="pt-3 border-t border-[#f1f5f9] grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    <div>
                      <label className="block text-[10.5px] font-bold text-[#475569] mb-1">
                        Urine Albumin
                      </label>
                      <select
                        value={urineAlbumin}
                        onChange={(e) => setUrineAlbumin(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white"
                      >
                        <option value="Nil">Nil</option>
                        <option value="Trace">Trace</option>
                        <option value="1+">1+ (30 mg/dL)</option>
                        <option value="2+">2+ (100 mg/dL)</option>
                        <option value="3+">3+ (300 mg/dL)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-bold text-[#475569] mb-1">
                        Urine Sugar
                      </label>
                      <select
                        value={urineSugar}
                        onChange={(e) => setUrineSugar(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white"
                      >
                        <option value="Nil">Nil</option>
                        <option value="Trace">Trace</option>
                        <option value="1+">1+</option>
                        <option value="2+">2+</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-bold text-[#475569] mb-1">
                        VDRL / Syphilis
                      </label>
                      <select
                        value={vdrl}
                        onChange={(e) => setVdrl(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white"
                      >
                        <option value="Non-reactive">Non-reactive</option>
                        <option value="Reactive">Reactive</option>
                        <option value="Pending">Pending</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-bold text-[#475569] mb-1">
                        Rubella Antibody
                      </label>
                      <select
                        value={rubella}
                        onChange={(e) => setRubella(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white"
                      >
                        <option value="Immune">Immune</option>
                        <option value="Non-immune">Non-immune</option>
                        <option value="Pending">Pending</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-bold text-[#475569] mb-1">
                        HIV 1 & 2
                      </label>
                      <select
                        value={hiv}
                        onChange={(e) => setHiv(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-[#cbd5e1] rounded-lg bg-white"
                      >
                        <option value="Non-reactive">Non-reactive</option>
                        <option value="Reactive">Reactive</option>
                        <option value="Pending">Pending</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-bold text-[#475569] mb-1">
                        FBS (Fasting Glucose)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 84 mg/dL"
                        value={fbs}
                        onChange={(e) => setFbs(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-[#cbd5e1] rounded-lg font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 4: Past Obstetric History & Medical Conditions */}
              {(activeSection === 'all' || activeSection === 'history') && (
                <div className="bg-white rounded-xl border border-[#cbd5e1] p-4 sm:p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-[#e2e8f0]">
                    <div className="w-7 h-7 rounded-md bg-[#e0f2fe] text-[#006194] flex items-center justify-center">
                      <Baby className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#0f172a]">
                        Part IV: Past Obstetric History & Pre-existing Medical Conditions
                      </h4>
                      <p className="text-[11px] text-[#64748b]">
                        Gravidity, parity, previous delivery complications, chronic illnesses, and drug allergies
                      </p>
                    </div>
                  </div>

                  {/* Gravida / Para / Living / Abortions Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        Gravida (G)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={gravida}
                        onChange={(e) => setGravida(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        Para (P)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="19"
                        value={para}
                        onChange={(e) => setPara(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        Living Children (L)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="19"
                        value={livingChildren}
                        onChange={(e) => setLivingChildren(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        Abortions / Miscarriages (A)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={abortions}
                        onChange={(e) => setAbortions(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg font-mono"
                      />
                    </div>
                  </div>

                  {/* Past Obstetric Complications Toggles */}
                  <div className="pt-3 border-t border-[#f1f5f9]">
                    <div className="text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-2">
                      Past Obstetric History Flags
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                      <label className="flex items-center gap-2 text-xs text-[#334155] bg-[#f8fafc] border border-[#e2e8f0] p-2.5 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={prevLscs}
                          onChange={(e) => setPrevLscs(e.target.checked)}
                          className="rounded text-[#006194] focus:ring-[#006194] w-4 h-4"
                        />
                        <span className="font-medium">Previous LSCS (Caesarean)</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs text-[#334155] bg-[#f8fafc] border border-[#e2e8f0] p-2.5 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={prevPreterm}
                          onChange={(e) => setPrevPreterm(e.target.checked)}
                          className="rounded text-[#006194] focus:ring-[#006194] w-4 h-4"
                        />
                        <span className="font-medium">Previous Preterm / LBW</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs text-[#334155] bg-[#f8fafc] border border-[#e2e8f0] p-2.5 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={prevPph}
                          onChange={(e) => setPrevPph(e.target.checked)}
                          className="rounded text-[#006194] focus:ring-[#006194] w-4 h-4"
                        />
                        <span className="font-medium">History of Severe PPH / PIH</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs text-[#334155] bg-[#f8fafc] border border-[#e2e8f0] p-2.5 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={stillbirth}
                          onChange={(e) => setStillbirth(e.target.checked)}
                          className="rounded text-[#006194] focus:ring-[#006194] w-4 h-4"
                        />
                        <span className="font-medium">Stillbirth / Neonatal Loss</span>
                      </label>
                    </div>
                  </div>

                  {/* Medical History Conditions */}
                  <div className="pt-3 border-t border-[#f1f5f9]">
                    <div className="text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-2">
                      Pre-existing Medical Conditions
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-[#334155] p-1.5 rounded cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={medDiabetes}
                          onChange={(e) => setMedDiabetes(e.target.checked)}
                          className="rounded text-[#006194]"
                        />
                        <span>Diabetes</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-xs text-[#334155] p-1.5 rounded cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={medHtn}
                          onChange={(e) => setMedHtn(e.target.checked)}
                          className="rounded text-[#006194]"
                        />
                        <span>Chronic HTN</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-xs text-[#334155] p-1.5 rounded cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={medCardiac}
                          onChange={(e) => setMedCardiac(e.target.checked)}
                          className="rounded text-[#006194]"
                        />
                        <span>Cardiac</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-xs text-[#334155] p-1.5 rounded cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={medAsthma}
                          onChange={(e) => setMedAsthma(e.target.checked)}
                          className="rounded text-[#006194]"
                        />
                        <span>Asthma</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-xs text-[#334155] p-1.5 rounded cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={medThyroid}
                          onChange={(e) => setMedThyroid(e.target.checked)}
                          className="rounded text-[#006194]"
                        />
                        <span>Thyroid</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-xs text-[#334155] p-1.5 rounded cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={medEpilepsy}
                          onChange={(e) => setMedEpilepsy(e.target.checked)}
                          className="rounded text-[#006194]"
                        />
                        <span>Epilepsy</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-xs text-[#334155] p-1.5 rounded cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={medThalassaemia}
                          onChange={(e) => setMedThalassaemia(e.target.checked)}
                          className="rounded text-[#006194]"
                        />
                        <span>Thalassaemia</span>
                      </label>
                    </div>
                  </div>

                  {/* Drug Allergies */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Stethoscope className="w-3.5 h-3.5 text-[#64748b]" />
                      Known Drug Allergies & Sensitivities
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. None known or Penicillin / Sulfa allergy"
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* SECTION 5: Danger Signs & Delivery Plan */}
              {(activeSection === 'all' || activeSection === 'plan') && (
                <div className="bg-white rounded-xl border border-[#cbd5e1] p-4 sm:p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-[#e2e8f0]">
                    <div className="w-7 h-7 rounded-md bg-[#e0f2fe] text-[#006194] flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#0f172a]">
                        Part V: Danger Signs (Red Flags) & Institutional Delivery Plan
                      </h4>
                      <p className="text-[11px] text-[#64748b]">
                        Active warning signs, designated hospital, 1990 Suwa Seriya ambulance readiness
                      </p>
                    </div>
                  </div>

                  {/* Red Flag Symptoms Checkboxes */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                      Active Maternal Warning Symptoms (Check if present today)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      <label className={`flex items-center gap-2 text-xs p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        severeHeadache ? 'bg-red-50 border-red-300 text-red-900 font-bold' : 'bg-[#f8fafc] border-[#e2e8f0] text-[#334155]'
                      }`}>
                        <input
                          type="checkbox"
                          checked={severeHeadache}
                          onChange={(e) => setSevereHeadache(e.target.checked)}
                          className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                        />
                        <span>Severe Frontal Headache</span>
                      </label>

                      <label className={`flex items-center gap-2 text-xs p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        blurredVision ? 'bg-red-50 border-red-300 text-red-900 font-bold' : 'bg-[#f8fafc] border-[#e2e8f0] text-[#334155]'
                      }`}>
                        <input
                          type="checkbox"
                          checked={blurredVision}
                          onChange={(e) => setBlurredVision(e.target.checked)}
                          className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                        />
                        <span>Blurred Vision / Spots</span>
                      </label>

                      <label className={`flex items-center gap-2 text-xs p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        epigastricPain ? 'bg-red-50 border-red-300 text-red-900 font-bold' : 'bg-[#f8fafc] border-[#e2e8f0] text-[#334155]'
                      }`}>
                        <input
                          type="checkbox"
                          checked={epigastricPain}
                          onChange={(e) => setEpigastricPain(e.target.checked)}
                          className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                        />
                        <span>Epigastric / RUQ Pain</span>
                      </label>

                      <label className={`flex items-center gap-2 text-xs p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        vaginalBleeding ? 'bg-red-50 border-red-300 text-red-900 font-bold' : 'bg-[#f8fafc] border-[#e2e8f0] text-[#334155]'
                      }`}>
                        <input
                          type="checkbox"
                          checked={vaginalBleeding}
                          onChange={(e) => setVaginalBleeding(e.target.checked)}
                          className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                        />
                        <span>Vaginal Bleeding / Leak</span>
                      </label>

                      <label className={`flex items-center gap-2 text-xs p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        reducedMovements ? 'bg-red-50 border-red-300 text-red-900 font-bold' : 'bg-[#f8fafc] border-[#e2e8f0] text-[#334155]'
                      }`}>
                        <input
                          type="checkbox"
                          checked={reducedMovements}
                          onChange={(e) => setReducedMovements(e.target.checked)}
                          className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                        />
                        <span>Decreased Fetal Movements</span>
                      </label>

                      <label className={`flex items-center gap-2 text-xs p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        edema ? 'bg-red-50 border-red-300 text-red-900 font-bold' : 'bg-[#f8fafc] border-[#e2e8f0] text-[#334155]'
                      }`}>
                        <input
                          type="checkbox"
                          checked={edema}
                          onChange={(e) => setEdema(e.target.checked)}
                          className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                        />
                        <span>Facial / Hand Swelling</span>
                      </label>
                    </div>
                  </div>

                  {/* Institutional Delivery Plan */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 border-t border-[#f1f5f9]">
                    <div>
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        Designated Delivery Hospital
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Base Hospital Rampur / Specialist Center"
                        value={intendedHospital}
                        onChange={(e) => setIntendedHospital(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg"
                      />
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 text-xs text-[#334155] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emergencyTransportReady}
                          onChange={(e) => setEmergencyTransportReady(e.target.checked)}
                          className="rounded text-[#006194] focus:ring-[#006194] w-4 h-4"
                        />
                        <span className="font-semibold text-[#0f172a]">
                          1990 Suwa Seriya / Emergency Transport Plan Verified
                        </span>
                      </label>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                        Midwife Remarks & Clinical Instructions
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Booking visit completed. Advised on balanced nutrition, iron-rich diet and danger signs."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* LIVE TRIAGE & RISK STRATIFICATION CARD */}
              <div className={`rounded-xl border p-4 sm:p-5 transition-all shadow-xs ${
                computedRiskTier === 'high'
                  ? 'bg-red-50/70 border-red-300 text-red-950'
                  : computedRiskTier === 'moderate'
                  ? 'bg-sky-50/70 border-sky-300 text-sky-950'
                  : 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
              }`}>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      computedRiskTier === 'high' ? 'bg-red-500 animate-ping' : computedRiskTier === 'moderate' ? 'bg-sky-500' : 'bg-emerald-500'
                    }`} />
                    <span className="text-xs font-black uppercase tracking-wider">
                      On-Device Real-Time Triage Assessment: {computedRiskTitle}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-white/80 border px-2 py-0.5 rounded-md shadow-2xs">
                      Preterm Probability: {computedPretermProb}%
                    </span>
                    <span className="text-xs font-bold bg-white/80 border px-2 py-0.5 rounded-md shadow-2xs">
                      Trimester {trimester} ({weeks}w {days}d)
                    </span>
                  </div>
                </div>

                <div className="text-xs font-medium mb-3">
                  <span className="font-bold">Pathway:</span> {computedRiskSubtitle}
                </div>

                {/* AI Weight Factors */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
                    <span className="text-[#64748b] block text-[10px]">Blood Pressure</span>
                    <span className={`font-mono font-bold ${isBpAlert ? 'text-red-700' : 'text-slate-800'}`}>
                      {sysNum}/{diaNum} mmHg {isBpAlert ? '(Alert)' : ''}
                    </span>
                  </div>

                  <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
                    <span className="text-[#64748b] block text-[10px]">Maternal BMI</span>
                    <span className={`font-mono font-bold ${computedBmi >= 30 || computedBmi < 18.5 ? 'text-amber-700' : 'text-slate-800'}`}>
                      {computedBmi} kg/m²
                    </span>
                  </div>

                  <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
                    <span className="text-[#64748b] block text-[10px]">Hemoglobin</span>
                    <span className={`font-mono font-bold ${isAnemia ? 'text-amber-700' : 'text-slate-800'}`}>
                      {hbNum} g/dL {isAnemia ? '(Anemia)' : ''}
                    </span>
                  </div>

                  <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
                    <span className="text-[#64748b] block text-[10px]">Blood Group</span>
                    <span className={`font-mono font-bold ${isRhNegative ? 'text-amber-700' : 'text-slate-800'}`}>
                      {bloodGroup} {isRhNegative ? '(Rh-)' : ''}
                    </span>
                  </div>
                </div>
              </div>

            </form>
          )}
        </div>

        {/* Modal Sticky Footer Actions */}
        <div className="p-3.5 sm:p-4 bg-[#f8fafc] border-t border-[#cbd5e1] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-[#475569] border border-[#cbd5e1] rounded-lg hover:bg-white transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrefillDemo}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#006194] bg-white border border-[#cbd5e1] rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset / Sample Data
            </button>

            <button
              type="submit"
              form="maternal-intake-form"
              disabled={Boolean(nicError) || isCheckingNic}
              className={`px-6 py-2.5 text-xs font-bold text-white rounded-lg shadow-md flex items-center gap-2 transition-all transform active:scale-95 ${
                nicError 
                  ? 'bg-red-600 opacity-60 cursor-not-allowed' 
                  : 'bg-[#006194] hover:bg-[#004f7b] cursor-pointer'
              }`}
            >
              {nicError ? (
                <AlertTriangle className="w-4 h-4 text-white" />
              ) : (
                <Sparkles className="w-4 h-4 text-sky-200" />
              )}
              <span>{nicError ? 'Duplicate NIC (Cannot Register)' : 'Register Mother (Save to Vault)'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
