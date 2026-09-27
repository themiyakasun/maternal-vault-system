import React from 'react';
import { X, BookOpen, AlertOctagon, ShieldCheck, HeartPulse } from 'lucide-react';

interface ClinicalPlaybookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClinicalPlaybookModal: React.FC<ClinicalPlaybookModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-[#cbd5e1] max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-[#006194] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-white/15 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                National Maternal Health Clinical Playbook
              </h3>
              <p className="text-[11px] text-[#cce5ff]">
                Offline Directives for Emergency Obstetric & Neonatal Care (EmONC)
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
        <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed">
          <div className="p-3 bg-[#fee2e2]/60 border border-[#fca5a5] rounded-lg space-y-1">
            <h4 className="font-bold text-[#991b1b] flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4 text-[#ef4444]" />
              Emergency Directive 1: Severe Pre-Eclampsia / Imminent Eclampsia
            </h4>
            <p className="text-[#991b1b]">
              Any pregnant mother beyond 20 weeks with SBP &ge; 160 or DBP &ge; 110 mmHg, OR persistent severe headache, visual disturbance, or epigastric pain must receive loading dose Magnesium Sulfate (14g) before transport.
            </p>
          </div>

          <div className="p-3 bg-[#f0f9ff] border border-[#bae6fd] rounded-lg space-y-1">
            <h4 className="font-bold text-[#0369a1] flex items-center gap-1.5">
              <HeartPulse className="w-4 h-4 text-[#0284c7]" />
              Emergency Directive 2: Fetal Distress & Bradycardia Protocol
            </h4>
            <p className="text-[#0369a1]">
              If Fetal Heart Rate is &lt; 110 bpm or persistent decelerations noted: position mother in left lateral decubitus, start high-flow oxygen (6-8 L/min), administer IV normal saline 500ml rapid bolus, and coordinate immediate ambulance extraction.
            </p>
          </div>

          <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg space-y-1">
            <h4 className="font-bold text-[#14532d] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#16a34a]" />
              Standard Directive 3: Severe Gestational Anemia (Hb &lt; 7.0 g/dL)
            </h4>
            <p className="text-[#14532d]">
              Refer urgently to District Hospital for packed red cell transfusion. For moderate anemia (Hb 7.0 - 9.9 g/dL), initiate supervised oral double-dose IFA or injectable Iron Sucrose as per MoHFW guidelines.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#f8fafc] px-6 py-3 border-t border-[#e2e8f0] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-white bg-[#006194] hover:bg-[#004f7b] active:scale-98 rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            Close Playbook
          </button>
        </div>
      </div>
    </div>
  );
};
