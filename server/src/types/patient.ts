export type RiskTier = 'high' | 'moderate' | 'low';

export interface RiskFeatureWeight {
  label: string;
  value: string;
  weight: string;
  severity: 'high' | 'moderate' | 'normal';
}

export interface ANCVisit {
  visitNo: number;
  date: string;
  poa: string;
  weightKg: number;
  bp: string;
  sfhCm: string;
  presentation: string;
  engagement: string;
  fhr: string;
  fm: string;
  urineAlb: string;
  urineSug: string;
  edema: string;
  examiner: string;
  remarks: string;
  supplements?: {
    ifaIssued?: boolean;
    calciumIssued?: boolean;
    vitCIssued?: boolean;
    foodSupplement?: boolean;
  };
}

export interface ANCVisitInput {
  date?: string;
  poa?: string;
  gestationalWeeks?: number;
  gestationalDays?: number;
  weightKg: number;
  bpSystolic: number;
  bpDiastolic: number;
  bp?: string;
  sfhCm: string;
  presentation?: string;
  engagement?: string;
  fhr?: string;
  fm?: string;
  urineAlb?: string;
  urineSug?: string;
  edema?: string;
  examiner?: string;
  remarks?: string;
  ifaIssued?: boolean;
  calciumIssued?: boolean;
  vitCIssued?: boolean;
  foodSupplement?: boolean;
}

export interface MLRiskAssessment {
  overallRiskTier: RiskTier;
  riskTitle: string;
  riskSubtitle: string;
  pretermProbability: number;
  isBpAlert: boolean;
  featureWeights: RiskFeatureWeight[];
  maternalRisk: {
    tier: RiskTier;
    predictionClass: number;
    score: number;
    probabilities: {
      low: number;
      moderate: number;
      high: number;
    };
    model: string;
  };
  anemiaRisk: {
    tier: RiskTier;
    predictionClass: number;
    score: number;
    flag: string;
    probabilities: {
      normal: number;
      atRisk: number;
    };
    model: string;
  };
  depressionRisk: {
    tier: RiskTier;
    predictionClass: number;
    score: number;
    flag: string;
    probabilities: {
      minimal: number;
      mildModerate: number;
      severe: number;
    };
    model: string;
  };
  evaluatedAt: string;
}

export interface Patient {
  id: string;
  name: string;
  initials?: string;
  initialsColor?: string;
  age: number;
  gravida: number;
  para: number;
  gestationalWeeks: number;
  gestationalDays: number;
  trimester: 1 | 2 | 3;
  bpSystolic: number;
  bpDiastolic: number;
  isBpAlert: boolean;
  bmi: number;
  bmiCategory: string;
  bmiStatusClass?: 'danger' | 'warning' | 'normal' | 'muted';
  riskTier: RiskTier;
  riskTitle: string;
  riskSubtitle?: string;
  pretermProbability: number;
  alertHeadline?: string;
  alertDetails?: string;
  featureWeights: RiskFeatureWeight[];
  mlRiskAssessment?: MLRiskAssessment;
  notes?: string;
  village?: string;
  tenantId?: string; // Multi-tenant clinic identifier e.g. 'clinic-4b-rampur'
  clinicId?: string;
  
  // Extended Registry Fields
  abhaId?: string;
  locality?: string;
  edd?: string;
  fundalHeight?: string;
  isFundalAlert?: boolean;
  hb?: number;
  isHbAlert?: boolean;
  fhr?: string;
  isFhrAlert?: boolean;
  syncStatus?: 'synced-p2p' | 'updated-local' | 'pending-mesh';
  syncNode?: string;
  syncProtocol?: string;
  assessedBy?: string;
  assessedTime?: string;
  assessedLocation?: string;
  specificCondition?: string;

  // H 512 B Official Pregnancy Record Book Fields
  registrationDate?: string;
  bloodGroup?: string;
  lmp?: string;
  poaAtBooking?: string;
  heightCm?: number;
  weightKg?: number;
  partnerName?: string;
  partnerAge?: number;
  partnerOccupation?: string;
  mohArea?: string;
  phmRegisterNo?: string;
  nicNo?: string;
  pastObstetricHistory?: Array<{
    pregnancyNo: number;
    year: number;
    gaWeeks: number;
    deliveryMode: string;
    birthWeightKg: number;
    babySex: 'M' | 'F';
    complications: string;
  }>;
  medicalHistory?: {
    diabetes: boolean;
    chronicHtn: boolean;
    cardiac: boolean;
    asthma: boolean;
    thyroid: boolean;
    epilepsy: boolean;
    thalassaemia: boolean;
    allergies: string;
    surgeries: string;
  };
  labResults?: {
    bloodGroup: string;
    vdrl: string;
    rubella: string;
    hiv: string;
    hbsAg: string;
    fbs: string;
    ogttFasting?: string;
    ogtt1h?: string;
    ogtt2h?: string;
    hbBooking: number;
    hb28w?: number;
    hb36w?: number;
    urineAlbumin: string;
    urineSugar: string;
  };
  immunization?: {
    tt1Date?: string;
    tt2Date?: string;
    ttBooster?: string;
    ifaIssued: number;
    calciumIssued: number;
    vitCIssued: number;
    mebendazoleGiven: boolean;
    thriposhaGiven: boolean;
  };
  ancVisits?: ANCVisit[];
  phone?: string;
  dob?: string;
  livingChildren?: number;
  abortions?: number;
  prevLscs?: boolean;
  prevPreterm?: boolean;
  prevPph?: boolean;
  intendedHospital?: string;
  emergencyTransportReady?: boolean;
  dangerSignsPresent?: string[];
  severeHeadache?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePatientInput {
  name: string;
  age: number;
  gravida: number;
  para: number;
  gestationalWeeks: number;
  gestationalDays?: number;
  bpSystolic: number;
  bpDiastolic: number;
  bmi?: number;
  village?: string;
  locality?: string;
  abhaId?: string;
  edd?: string;
  fundalHeight?: string;
  hb?: number;
  fhr?: string;
  notes?: string;
  specificCondition?: string;
  prevPreterm?: boolean;
  severeHeadache?: boolean;
  phone?: string;
  dob?: string;
  livingChildren?: number;
  abortions?: number;
  prevLscs?: boolean;
  prevPph?: boolean;
  intendedHospital?: string;
  emergencyTransportReady?: boolean;
  dangerSignsPresent?: string[];
  registrationDate?: string;
  bloodGroup?: string;
  lmp?: string;
  poaAtBooking?: string;
  heightCm?: number;
  weightKg?: number;
  partnerName?: string;
  partnerAge?: number;
  partnerOccupation?: string;
  mohArea?: string;
  phmRegisterNo?: string;
  nicNo?: string;
  pastObstetricHistory?: Patient['pastObstetricHistory'];
  medicalHistory?: Patient['medicalHistory'];
  labResults?: Patient['labResults'];
  immunization?: Patient['immunization'];
  id?: string;
  tenantId?: string;
  clinicId?: string;
  ancVisits?: ANCVisit[];
  riskTier?: RiskTier;
  riskTitle?: string;
  riskSubtitle?: string;
  pretermProbability?: number;
  featureWeights?: RiskFeatureWeight[];
  mlRiskAssessment?: MLRiskAssessment;
  assessedBy?: string;
  assessedTime?: string;
}

export interface UpdatePatientInput extends Partial<CreatePatientInput> {
  riskTier?: RiskTier;
  riskTitle?: string;
  riskSubtitle?: string;
  pretermProbability?: number;
  mlRiskAssessment?: MLRiskAssessment;
  syncStatus?: 'synced-p2p' | 'updated-local' | 'pending-mesh';
  syncNode?: string;
  assessedBy?: string;
  assessedLocation?: string;
}

export interface PatientStats {
  totalRegistered: number;
  firstTrimester: number;
  secondTrimester: number;
  thirdTrimester: number;
  highRiskCount: number;
  moderateRiskCount: number;
  lowRiskCount: number;
  p2pSyncedCount: number;
  syncedPercentage: string;
}
