import React from 'react';
import type { Patient } from '../types/triage';
import { getPatientEffectiveRisk, toMLRiskAssessment } from '../utils/aiRiskCalculator';
import { 
  AlertCircle, 
  ShieldCheck, 
  HeartPulse,
  CheckCircle,
  QrCode,
  ArrowRight,
  Activity,
  Sparkles,
  Brain,
  Droplets
} from 'lucide-react';

interface EdgeAIDecisionSupportProps {
  patient: Patient | null;
  onReviewPathway: () => void;
  onInitiateProtocol: () => void;
  onOpenQR?: (patient: Patient) => void;
}

export const EdgeAIDecisionSupport: React.FC<EdgeAIDecisionSupportProps> = ({
  patient,
  onReviewPathway,
  onInitiateProtocol,
  onOpenQR,
}) => {
  if (!patient) {
    return (
      <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-xl p-5 shadow-xs text-center text-xs text-[#64748b]">
        Select a mother from the list to view clinical risk evaluation and guidance.
      </div>
    );
  }

  const eff = getPatientEffectiveRisk(patient);
  const isHighRisk = eff.riskTier === 'high';
  const isModerateRisk = eff.riskTier === 'moderate';
  const probability = eff.pretermProbability;
  const ml = patient.mlRiskAssessment || toMLRiskAssessment(eff, patient);

  return (
    <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-xl p-4 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#e0f2fe] text-[#0284c7] flex items-center justify-center">
            <HeartPulse className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0f172a] tracking-tight">
              Clinical Care Guidance
            </h3>
            <p className="text-[10.5px] text-[#64748b]">For {patient.name} ({patient.id})</p>
          </div>
        </div>
        <div className={`px-2 py-0.5 rounded text-[10.5px] font-bold uppercase ${
          isHighRisk 
            ? 'bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]' 
            : isModerateRisk 
            ? 'bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]' 
            : 'bg-[#dcfce7] text-[#14532d] border border-[#bbf7d0]'
        }`}>
          {isHighRisk ? 'Priority Alert' : isModerateRisk ? 'Monitor' : 'Routine'}
        </div>
      </div>

      {/* Alert Banner */}
      <div
        className={`p-3.5 rounded-xl border flex gap-3 items-start ${
          isHighRisk
            ? 'bg-[#fee2e2]/70 border-[#fca5a5]'
            : isModerateRisk
            ? 'bg-[#fef3c7]/70 border-[#fcd34d]'
            : 'bg-[#d1fae5]/70 border-[#6ee7b7]'
        }`}
      >
        <div className="shrink-0 mt-0.5">
          {isHighRisk ? (
            <div className="w-5 h-5 rounded-full bg-[#ef4444] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              !
            </div>
          ) : isModerateRisk ? (
            <AlertCircle className="w-5 h-5 text-[#b45309]" />
          ) : (
            <CheckCircle className="w-5 h-5 text-[#047857]" />
          )}
        </div>
        <div>
          <div
            className={`text-xs font-bold leading-tight ${
              isHighRisk
                ? 'text-[#991b1b]'
                : isModerateRisk
                ? 'text-[#92400e]'
                : 'text-[#065f46]'
            }`}
          >
            {patient.alertHeadline || (isHighRisk ? 'High Risk Attention Flag' : 'Routine Prenatal Status')}
          </div>
          <div
            className={`text-[11.5px] font-medium mt-1 leading-snug ${
              isHighRisk
                ? 'text-[#991b1b]'
                : isModerateRisk
                ? 'text-[#b45309]'
                : 'text-[#047857]'
            }`}
          >
            {patient.alertDetails || (isHighRisk 
              ? 'Blood pressure or clinical indicators require close monitoring and possible hospital referral.'
              : 'Mother and baby vitals are stable. Continue routine iron-folate supplements.')}
          </div>
        </div>
      </div>

      {/* 3 Models Clinical Risk Breakdown */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#0f172a] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#0284c7]" />
            <span>Automated Health Risk Screening</span>
          </span>
          <span className="text-[10px] font-mono text-[#006194] bg-[#e0f2fe] px-1.5 py-0.5 rounded font-semibold">
            Instant Clinic Check
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {/* Model 1: Maternal Clinical Risk */}
          <div className="p-2.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#e0f2fe] text-[#0284c7] flex items-center justify-center shrink-0">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#0f172a] leading-tight">
                  Maternal Clinical Health Risk
                </div>
                <div className="text-[10px] text-[#64748b]">
                  Vital signs, blood pressure & glucose screening
                </div>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold uppercase ${
              (ml?.maternalRisk.tier || patient.riskTier) === 'high'
                ? 'bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]'
                : (ml?.maternalRisk.tier || patient.riskTier) === 'moderate'
                ? 'bg-[#fef3c7] text-[#92400e] border border-[#fcd34d]'
                : 'bg-[#dcfce7] text-[#14532d] border border-[#bbf7d0]'
            }`}>
              {ml?.maternalRisk.tier || patient.riskTier}
            </span>
          </div>

          {/* Model 2: Nutritional Anemia Tracker */}
          <div className="p-2.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#fef3c7] text-[#b45309] flex items-center justify-center shrink-0">
                <Droplets className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#0f172a] leading-tight">
                  Nutritional Anemia Tracker
                </div>
                <div className="text-[10px] text-[#64748b]">
                  {ml?.anemiaRisk.flag || (patient.hb && patient.hb < 11 ? 'Elevated Anemia Alert' : 'Normal Hemoglobin Target')}
                </div>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold uppercase ${
              (ml?.anemiaRisk.tier || (patient.hb && patient.hb < 10 ? 'high' : patient.hb && patient.hb < 11 ? 'moderate' : 'low')) === 'high'
                ? 'bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]'
                : (ml?.anemiaRisk.tier || (patient.hb && patient.hb < 11 ? 'moderate' : 'low')) === 'moderate'
                ? 'bg-[#fef3c7] text-[#92400e] border border-[#fcd34d]'
                : 'bg-[#dcfce7] text-[#14532d] border border-[#bbf7d0]'
            }`}>
              {ml?.anemiaRisk.tier || (patient.hb && patient.hb < 10 ? 'high' : patient.hb && patient.hb < 11 ? 'moderate' : 'low')}
            </span>
          </div>

          {/* Model 3: Prenatal Depression & Distress Screener */}
          <div className="p-2.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#f3e8ff] text-[#7e22ce] flex items-center justify-center shrink-0">
                <Brain className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#0f172a] leading-tight">
                  Perinatal Distress Screener
                </div>
                <div className="text-[10px] text-[#64748b]">
                  {ml?.depressionRisk.flag || 'Psychosocial & wellbeing check'}
                </div>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold uppercase ${
              (ml?.depressionRisk.tier || 'low') === 'high'
                ? 'bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]'
                : (ml?.depressionRisk.tier || 'low') === 'moderate'
                ? 'bg-[#fef3c7] text-[#92400e] border border-[#fcd34d]'
                : 'bg-[#dcfce7] text-[#14532d] border border-[#bbf7d0]'
            }`}>
              {ml?.depressionRisk.tier || 'low'}
            </span>
          </div>
        </div>
      </div>

      {/* Risk Gauge */}
      <div className="space-y-2 pt-1 bg-[#f8fafc] p-3 rounded-xl border border-[#e2e8f0]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#0f172a] uppercase tracking-wider">
            Early Delivery Risk Score
          </span>
          <span
            className={`text-2xl font-black font-mono tracking-tight ${
              isHighRisk
                ? 'text-[#b91c1c]'
                : isModerateRisk
                ? 'text-[#b45309]'
                : 'text-[#047857]'
            }`}
          >
            {probability}<span className="text-base font-bold">%</span>
          </span>
        </div>

        {/* Progress Bar with Gradient */}
        <div className="relative pt-1 pb-1">
          <div className="w-full h-2.5 rounded-full overflow-hidden bg-[#e2e8f0] relative">
            <div className="w-full h-full risk-gauge-gradient" />
            <div
              className="absolute right-0 top-0 bottom-0 bg-[#e2e8f0]"
              style={{ width: `${Math.max(0, 100 - probability)}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-[#64748b] mt-1.5 font-medium">
            <span>Low Risk (0%)</span>
            <span className="text-[#b91c1c] font-bold">Alert Level (&gt;40%)</span>
            <span>High Risk (100%)</span>
          </div>
        </div>
      </div>

      {/* Key Diagnostic Features */}
      <div className="space-y-2 pt-1">
        <div className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">
          Key Health Factors for this Mother:
        </div>

        <div className="space-y-1.5">
          {patient.featureWeights.map((fw, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]"
            >
              <span className="text-[#1e293b] font-medium text-[11.5px]">
                {fw.label}
              </span>
              <span
                className={`font-semibold text-[11px] px-1.5 py-0.5 rounded ${
                  fw.severity === 'high'
                    ? 'bg-[#fee2e2] text-[#991b1b]'
                    : fw.severity === 'moderate'
                    ? 'bg-[#fef3c7] text-[#92400e]'
                    : 'bg-[#dcfce7] text-[#14532d]'
                }`}
              >
                {fw.severity === 'high' ? 'High Concern' : fw.severity === 'moderate' ? 'Moderate' : 'Normal'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-1 border-t border-[#f1f5f9]">
        <button
          onClick={onReviewPathway}
          className="w-full flex items-center justify-center gap-2 bg-[#006194] hover:bg-[#004f7b] text-white py-2.5 px-4 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>View Recommended Care Plan</span>
        </button>

        {onOpenQR && (
          <button
            onClick={() => onOpenQR(patient)}
            className="w-full flex items-center justify-center gap-2 bg-[#f0f9ff] hover:bg-[#e0f2fe] text-[#006194] border border-[#bae6fd] py-2.5 px-4 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-[#0284c7]" />
            <span>Transfer Pass to Mother's Phone (QR)</span>
          </button>
        )}

        {isHighRisk && (
          <button
            onClick={onInitiateProtocol}
            className="w-full flex items-center justify-center gap-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white py-2.5 px-4 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <span>🚨 Emergency Protocol & Hospital Transfer</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
