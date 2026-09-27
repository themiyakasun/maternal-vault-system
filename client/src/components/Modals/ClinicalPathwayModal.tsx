import React from 'react';
import type { Patient } from '../../types/triage';
import { X, ShieldCheck, ArrowRight } from 'lucide-react';

interface ClinicalPathwayModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onProceedToReferral: () => void;
}

export const ClinicalPathwayModal: React.FC<ClinicalPathwayModalProps> = ({
  isOpen,
  onClose,
  patient,
  onProceedToReferral,
}) => {
  if (!isOpen || !patient) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border-t sm:border border-[#cbd5e1] max-w-2xl w-full overflow-hidden animate-in fade-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="bg-[#006194] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-white/15 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                Clinical Pathway: {patient.name} ({patient.id})
              </h3>
              <p className="text-[11px] text-[#cce5ff]">
                Evidence-Based Protocol • Preterm & Pre-eclampsia Guidelines
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white rounded-md p-1 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Patient Overview Strip */}
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-3 grid grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-[#64748b] text-[11px] block">Gestational Age</span>
              <span className="font-mono font-bold text-[#0f172a]">{patient.gestationalWeeks}w {patient.gestationalDays}d</span>
            </div>
            <div>
              <span className="text-[#64748b] text-[11px] block">Blood Pressure</span>
              <span className={`font-mono font-bold ${patient.isBpAlert ? 'text-[#b91c1c]' : 'text-[#0f172a]'}`}>
                {patient.bpSystolic}/{patient.bpDiastolic} mmHg
              </span>
            </div>
            <div>
              <span className="text-[#64748b] text-[11px] block">Maternal BMI</span>
              <span className="font-mono font-bold text-[#0f172a]">{patient.bmi} kg/m²</span>
            </div>
            <div>
              <span className="text-[#64748b] text-[11px] block">Preterm Prob.</span>
              <span className="font-mono font-bold text-[#b91c1c]">{patient.pretermProbability}%</span>
            </div>
          </div>

          {/* Clinical Steps */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
              Recommended Midwife Actions (Step-by-Step)
            </h4>

            <div className="border border-[#e2e8f0] rounded-lg divide-y divide-[#f1f5f9] text-xs">
              <div className="p-3 flex items-start gap-3 bg-white">
                <div className="w-5 h-5 rounded-full bg-[#006194] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <div className="font-bold text-[#0f172a]">Immediate Rest & Lateral Decubitus Vitals Re-assessment</div>
                  <p className="text-[#64748b] mt-0.5">
                    Position patient in left lateral position for 15 minutes. Recheck manual blood pressure with appropriately sized adult cuff.
                  </p>
                </div>
              </div>

              <div className="p-3 flex items-start gap-3 bg-white">
                <div className="w-5 h-5 rounded-full bg-[#006194] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <div className="font-bold text-[#0f172a]">Dipstick Proteinuria & Danger Sign Triage</div>
                  <p className="text-[#64748b] mt-0.5">
                    Assess for patellar hyperreflexia/clonus, epigastric pain, visual scotoma, and confirm protein grade (≥ 2+ warrants immediate prophylactic stabilization).
                  </p>
                </div>
              </div>

              <div className="p-3 flex items-start gap-3 bg-white">
                <div className="w-5 h-5 rounded-full bg-[#006194] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <div className="font-bold text-[#0f172a]">Fetal Heart Rate & Uterine Activity Auscultation</div>
                  <p className="text-[#64748b] mt-0.5">
                    Continuous Doppler auscultation for baseline FHR (110–160 bpm) and evaluate contraction frequency for preterm labor onset.
                  </p>
                </div>
              </div>

              <div className="p-3 flex items-start gap-3 bg-[#fff7ed]">
                <div className="w-5 h-5 rounded-full bg-[#f97316] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  4
                </div>
                <div>
                  <div className="font-bold text-[#9a3412]">Antenatal Corticosteroids & Antihypertensive Threshold</div>
                  <p className="text-[#9a3412] mt-0.5">
                    For gestation &lt; 34w with imminent preterm delivery: Administer Dexamethasone 6mg IM (1st dose) and oral Nifedipine 10mg if BP &gt; 150/100 mmHg.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#f8fafc] px-6 py-3.5 border-t border-[#e2e8f0] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#475569] hover:text-[#0f172a] border border-[#cbd5e1] hover:border-[#94a3b8] rounded-lg bg-white transition-colors cursor-pointer"
          >
            Close Pathway
          </button>
          <button
            onClick={() => {
              onClose();
              onProceedToReferral();
            }}
            className="px-4 py-2 text-xs font-bold text-white bg-[#b91c1c] hover:bg-[#991b1b] active:scale-98 rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>Proceed to MgSO₄ Referral Protocol</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
