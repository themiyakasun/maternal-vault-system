import React from 'react';
import { Stethoscope, BookOpen } from 'lucide-react';

interface EmergencyEscalationWidgetProps {
  onOpenPlaybook: () => void;
}

export const EmergencyEscalationWidget: React.FC<EmergencyEscalationWidgetProps> = ({
  onOpenPlaybook,
}) => {
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg p-4 shadow-xs flex flex-col justify-between space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
            Clinical Protocols
          </span>
          <Stethoscope className="w-4 h-4 text-[#006194]" />
        </div>

        <h3 className="text-sm font-bold text-[#0f172a] mt-1.5">
          Emergency Escalation Pathway
        </h3>
        <p className="text-[11px] text-[#64748b] mt-0.5 leading-snug">
          Directives for severe gestational hypertension (SBP ≥ 160 or DBP ≥ 110 mmHg) and acute fetal distress protocols.
        </p>

        {/* Pathway Steps */}
        <div className="mt-3 space-y-2 text-xs">
          {/* Tier 1 Box */}
          <div className="p-2.5 rounded border border-[#fca5a5] bg-[#fee2e2]/60 space-y-0.5">
            <div className="flex items-center gap-1.5 text-[#991b1b] font-bold text-xs">
              <span className="text-[12px] text-[#ef4444]">✱</span>
              <span>Tier 1: Immediate Ambulance Dispatch</span>
            </div>
            <p className="text-[10.5px] text-[#991b1b] pl-3.5 leading-snug">
              Prepare IV Magnesium Sulphate Loading Dose (14g IV over 15m)
            </p>
          </div>

          {/* Tier 2 Box */}
          <div className="p-2.5 rounded border border-[#bae6fd] bg-[#f0f9ff] space-y-0.5">
            <div className="flex items-center gap-1.5 text-[#0369a1] font-bold text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0284c7] ml-0.5" />
              <span>Tier 2: Same-day District Hospital Referral</span>
            </div>
            <p className="text-[10.5px] text-[#0369a1] pl-3.5 leading-snug">
              Fetal growth lag or moderate pre-eclampsia
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={onOpenPlaybook}
        className="w-full flex items-center justify-center gap-2 bg-[#f0f9ff] hover:bg-[#e0f2fe] active:scale-98 text-[#006194] border border-[#bae6fd] py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
      >
        <BookOpen className="w-3.5 h-3.5" />
        <span>Open Full Clinical Playbook</span>
      </button>
    </div>
  );
};
