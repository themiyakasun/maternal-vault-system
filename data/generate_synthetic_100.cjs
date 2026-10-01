const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Target file
const OUTPUT_FILE = path.resolve(__dirname, 'synthetic_cohort_100.json');

const firstNames = [
  'Nimali', 'Chamari', 'Fatima', 'Sanduni', 'Anoma', 'Thilini', 'Menaka', 'Kanthi', 'Ruwani', 'Dilrukshi',
  'Sunethra', 'Malini', 'Rupika', 'Nilmini', 'Geetha', 'Priyani', 'Upeksha', 'Hasini', 'Madhavi', 'Kumari',
  'Jayanthi', 'Shalika', 'Dharshani', 'Hiruni', 'Anusha', 'Lalitha', 'Pushpa', 'Chathurika', 'Sudarshani', 'Manel',
  'Rohini', 'Shiroma', 'Gayathri', 'Nirosha', 'Subhashini', 'Vajira', 'Surangi', 'Inoka', 'Ayesha', 'Zainab',
  'Mariyam', 'Bavani', 'Kavitha', 'Priya', 'Meena', 'Lakshmi', 'Saroja', 'Nandani', 'Kamala', 'Soma'
];

const lastNames = [
  'Jayawardena', 'Silva', 'Rizwan', 'Weerasinghe', 'Gunasekara', 'Kaluarachchi', 'Wickramasinghe', 'Subasinghe',
  'Senanayake', 'Rajapakse', 'Perera', 'Fernando', 'Bandara', 'Dissanayake', 'Alwis', 'Herath', 'Karunaratne',
  'Ranasinghe', 'Wijesinghe', 'Abeysekera', 'Ratnayake', 'Samaraweera', 'Tennakoon', 'Liyanage', 'Pathirana',
  'Menike', 'Hettiarachchi', 'Premaratne', 'Somaratne', 'Kulathunga', 'Ismail', 'Farook', 'Thambiah', 'Pillai', 'Rajaratnam'
];

const villages = [
  'Rampur North Sector 2', 'Rampur South Sector 1', 'Rampur East Sector 4', 'Rampur West Sector 3',
  'Ambagamuwa Central', 'Kotagala Upper Division', 'Maskeliya Estate Division 2', 'Nawalapitiya Rural Beat',
  'Ginigathena Field Sector', 'Hatton South Ward 3'
];

const clinics = ['clinic-4b-rampur', 'clinic-ambagamuwa'];
const mohAreas = ['MOH Rampur', 'MOH Ambagamuwa'];
const bloodGroups = ['O +ve', 'A +ve', 'B +ve', 'AB +ve', 'O -ve', 'A -ve', 'B -ve'];

function generateRecords(count = 100) {
  const records = [];

  for (let i = 1; i <= count; i++) {
    const idNum = 1000 + i;
    const id = `#SYN-${idNum}`;
    const fname = firstNames[(i - 1) % firstNames.length];
    const lname = lastNames[(i * 3) % lastNames.length];
    const name = `${fname} ${lname}`;
    const initials = `${fname[0]}${lname[0]}`;
    
    // Deterministic distribution across risk tiers:
    // ~60% Low Risk, ~25% Moderate Risk, ~15% High Risk
    const riskType = (i % 20 === 3 || i % 20 === 7 || i % 20 === 13)
      ? 'high'
      : (i % 4 === 0 || i % 5 === 0)
      ? 'moderate'
      : 'low';

    const age = 18 + ((i * 7) % 23); // 18 to 40 years
    const gravida = 1 + ((i * 2) % 4); // 1 to 4
    const para = Math.max(0, gravida - 1 - (i % 7 === 0 ? 1 : 0));
    const living = para;
    const abortions = Math.max(0, gravida - para - 1);
    
    const weeks = 8 + ((i * 3) % 31); // 8 to 38 weeks
    const days = (i * 2) % 7;
    const trimester = weeks > 27 ? 3 : weeks > 13 ? 2 : 1;
    
    // Hemodynamic parameters conforming to Table METHODOLOGY.4
    let sbp = 110 + ((i * 5) % 25);
    let dbp = 70 + ((i * 3) % 18);
    let hb = +(10.5 + ((i % 10) * 0.3)).toFixed(1);
    let bloodSugar = 80 + ((i * 7) % 45);
    let epds = 2 + (i % 10);
    let pretermProb = 6 + (i % 15);
    let specificCondition = 'Routine Antenatal Care';
    let riskSubtitle = 'Normal Pregnancy Progression';

    if (riskType === 'high') {
      if (i % 2 === 0) {
        // Hypertensive disorder / Preeclampsia
        sbp = 145 + ((i * 3) % 25); // 145 - 170 mmHg
        dbp = 94 + ((i * 2) % 18);  // 94 - 110 mmHg
        specificCondition = 'Severe Preeclampsia / Gestational HTN';
        riskSubtitle = 'Systolic/Diastolic BP Alert • Tertiary Hospital Escalation';
        pretermProb = 55 + (i % 25);
      } else {
        // High EPDS / Severe Anemia
        epds = 14 + (i % 10); // 14 - 23 EPDS
        hb = +(7.8 + ((i % 5) * 0.4)).toFixed(1); // 7.8 - 9.4 g/dL
        specificCondition = 'Perinatal Depression & Severe Anemia';
        riskSubtitle = 'High EPDS Mental Health Score • Urgent PHM Counseling';
        pretermProb = 48 + (i % 20);
      }
    } else if (riskType === 'moderate') {
      sbp = 130 + (i % 10);
      dbp = 84 + (i % 6);
      hb = +(9.8 + ((i % 5) * 0.2)).toFixed(1);
      bloodSugar = 115 + (i % 25);
      specificCondition = 'Mild Gestational Hypertension / IFA Support';
      riskSubtitle = 'Borderline Vitals • Fortnightly Domiciliary Surveillance';
      pretermProb = 25 + (i % 15);
    }

    const heightCm = 150 + ((i * 3) % 18); // 150 - 167 cm
    const weightKg = +(50 + ((i * 7) % 32)).toFixed(1); // 50.0 - 81.0 kg
    const bmi = +(weightKg / Math.pow(heightCm / 100, 2)).toFixed(1);
    const sfh = Math.max(10, Math.min(40, weeks + ((i % 3) - 1)));
    const fhr = 136 + ((i * 4) % 24);

    const isBpAlert = sbp >= 140 || dbp >= 90;
    const isHbAlert = hb < 10.5;

    const initialsColor = riskType === 'high'
      ? 'bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]'
      : riskType === 'moderate'
      ? 'bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]'
      : 'bg-[#d1fae5] text-[#065f46] border border-[#a7f3d0]';

    const bmiCat = bmi >= 30 ? 'Obese Class I' : bmi >= 25 ? 'Overweight' : bmi < 18.5 ? 'Underweight' : 'Normal';
    const bmiClass = bmi >= 30 ? 'danger' : bmi >= 25 ? 'warning' : 'normal';

    const nicYear = 2026 - age;
    const nicNo = `${nicYear}${String(10000000 + i * 812).slice(0, 8)}`;

    const tenantId = clinics[i % clinics.length];
    const mohArea = mohAreas[i % mohAreas.length];
    const village = villages[i % villages.length];
    const phmRegisterNo = `PHM/2026/${String(i).padStart(3, '0')}`;

    // Past obstetric history
    const pastObstetricHistory = [];
    for (let p = 1; p <= para; p++) {
      pastObstetricHistory.push({
        pregnancyNo: p,
        year: 2026 - (para - p + 1) * 3,
        gaWeeks: 38 + (p % 3),
        deliveryMode: p % 3 === 0 ? 'LSCS (Caesarean)' : 'Normal Vaginal Delivery',
        birthWeightKg: +(2.9 + (p * 0.2)).toFixed(1),
        babySex: p % 2 === 0 ? 'M' : 'F',
        complications: p % 4 === 0 ? 'Mild PPH managed' : 'None'
      });
    }

    // ANC Visits (1 to 4 sequential visits)
    const visitCount = Math.max(1, Math.min(4, Math.floor(weeks / 9)));
    const ancVisits = [];
    for (let v = 1; v <= visitCount; v++) {
      const vWeek = Math.max(8, Math.round((weeks / visitCount) * v));
      const vSbp = Math.max(105, sbp - (visitCount - v) * 4);
      const vDbp = Math.max(68, dbp - (visitCount - v) * 2);
      const vWeight = +(weightKg - (visitCount - v) * 1.5).toFixed(1);
      const vSfh = Math.max(8, vWeek);

      ancVisits.push({
        visitNo: v,
        date: `2026-0${Math.min(9, v + 1)}-${String(10 + v * 3).padStart(2, '0')}`,
        poa: `${vWeek}w ${days}d`,
        weightKg: vWeight,
        bp: `${vSbp}/${vDbp}`,
        sfhCm: `${vSfh} cm`,
        presentation: 'Cephalic',
        engagement: vWeek > 36 ? 'Engaged' : 'Not engaged',
        fhr: `${fhr} bpm`,
        fm: 'Active (>10/12h)',
        urineAlb: (riskType === 'high' && v === visitCount) ? '2+' : 'Nil',
        urineSug: (bloodSugar > 125 && v === visitCount) ? '1+' : 'Nil',
        edema: (sbp >= 150 && v === visitCount) ? 'Pedal ++' : 'Nil',
        examiner: v % 2 === 0 ? 'Dr. Anura Bandara, MOH' : 'Priya Sharma, PHM',
        remarks: v === visitCount ? `Encounter #${v}: ${riskSubtitle}` : `Routine antenatal clinic encounter #${v}.`,
        supplements: {
          ifaIssued: true,
          calciumIssued: true,
          vitCIssued: true,
          foodSupplement: true
        }
      });
    }

    records.push({
      id,
      name,
      initials,
      initialsColor,
      age,
      nicNo,
      gravida,
      para,
      livingChildren: living,
      abortions,
      gestationalWeeks: weeks,
      gestationalDays: days,
      trimester,
      bpSystolic: sbp,
      bpDiastolic: dbp,
      isBpAlert,
      bmi,
      bmiCategory: bmiCat,
      bmiStatusClass: bmiClass,
      riskTier: riskType,
      riskTitle: riskType === 'high' ? 'HIGH RISK' : riskType === 'moderate' ? 'MODERATE RISK' : 'LOW RISK',
      riskSubtitle,
      pretermProbability: pretermProb,
      alertHeadline: `Alert: Maternal Encounter ${id}`,
      alertDetails: `${specificCondition}. Evaluated across multi-model risk stratification pipelines.`,
      featureWeights: [
        { label: `Systolic/Diastolic BP: ${sbp}/${dbp} mmHg`, value: `${sbp}/${dbp} mmHg`, weight: isBpAlert ? '+32% risk' : '+2% baseline', severity: isBpAlert ? 'high' : 'normal' },
        { label: `Maternal Hemoglobin: ${hb} g/dL`, value: `${hb} g/dL`, weight: isHbAlert ? '+26% weight' : '+1% normal', severity: isHbAlert ? 'moderate' : 'normal' },
        { label: `Maternal Age: ${age} Years`, value: `${age} yrs`, weight: age >= 35 ? '+18% weight' : '+0% normal', severity: age >= 35 ? 'moderate' : 'normal' }
      ],
      notes: `${specificCondition}. Form H-512 longitudinal tracking verified.`,
      village,
      locality: `GN Division ${String((i % 15) + 1).padStart(2, '0')}`,
      tenantId,
      clinicId: tenantId,
      mohArea,
      phmRegisterNo,
      registrationDate: '2026-01-10',
      bloodGroup: bloodGroups[i % bloodGroups.length],
      lmp: '2025-10-15',
      edd: '2026-07-22',
      poaAtBooking: '8w 2d',
      heightCm,
      weightKg,
      partnerName: `Partner of ${fname}`,
      partnerAge: age + 3,
      partnerOccupation: i % 3 === 0 ? 'Agriculture' : i % 3 === 1 ? 'Government Service' : 'Private Trade',
      fundalHeight: `${sfh} cm`,
      isFundalAlert: false,
      hb,
      isHbAlert,
      fhr: `${fhr} bpm`,
      isFhrAlert: false,
      intendedHospital: 'District Base Hospital',
      emergencyTransportReady: true,
      medicalHistory: {
        diabetes: bloodSugar >= 126,
        chronicHtn: sbp >= 140,
        cardiac: false,
        asthma: i % 12 === 0,
        thyroid: i % 15 === 0,
        epilepsy: false,
        thalassaemia: false
      },
      labResults: {
        bloodGroup: bloodGroups[i % bloodGroups.length],
        fbs: `${bloodSugar} mg/dL`,
        vdrl: 'Non-reactive',
        hiv: 'Negative',
        rubella: 'Immune',
        hbsAg: 'Negative',
        urineAlbumin: (riskType === 'high' && sbp >= 140) ? '2+' : 'Nil',
        urineSugar: bloodSugar >= 130 ? '1+' : 'Nil'
      },
      pastObstetricHistory,
      ancVisits,
      syncStatus: 'synced-p2p',
      syncNode: 'Central Registry',
      syncProtocol: 'HTTPS TLS 1.3 / Form H-512 Cloud Store',
      assessedBy: 'Priya Sharma, PHM',
      assessedTime: 'Verified Clinic Encounter',
      assessedLocation: mohArea,
      specificCondition,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  return records;
}

const cohort100 = generateRecords(100);
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cohort100, null, 2), 'utf8');
console.log(`Generated ${cohort100.length} synthetic records -> ${OUTPUT_FILE}`);
