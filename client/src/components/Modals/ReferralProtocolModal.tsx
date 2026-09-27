import React, { useState } from 'react';
import type { Patient } from '../../types/triage';
import { X, AlertOctagon, Truck, CheckCircle } from 'lucide-react';

interface ReferralProtocolModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
}

export const ReferralProtocolModal: React.FC<ReferralProtocolModalProps> = ({
  isOpen,
  onClose,
  patient,
}) => {
  const [ivGiven, setIvGiven] = useState(false);
  const [imLeftGiven, setImLeftGiven] = useState(false);
  const [imRightGiven, setImRightGiven] = useState(false);
  const [foleyInserted, setFoleyInserted] = useState(false);
  const [ambulanceContacted, setAmbulanceContacted] = useState(false);
  const [referralSent, setReferralSent] = useState(false);

  if (!isOpen || !patient) return null;

  const handleDispatch = () => {
    setReferralSent(true);
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border-t sm:border border-[#cbd5e1] max-w-2xl w-full overflow-hidden animate-in fade-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="bg-[#b91c1c] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-white/15 flex items-center justify-center">
              <AlertOctagon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                Emergency Magnesium Sulfate (MgSO₄) & Tertiary Referral
              </h3>
              <p className="text-[11px] text-[#ffdad6]">
                Patient: {patient.name} ({patient.id}) • BP: {patient.bpSystolic}/{patient.bpDiastolic} mmHg
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

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* MgSO4 Dosage Card */}
          <div className="bg-[#fee2e2]/60 border border-[#fca5a5] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#991b1b] uppercase tracking-wider">
                1. Pritchard Loading Dose Protocol
              </span>
              <span className="text-[10px] font-mono bg-[#fee2e2] text-[#991b1b] px-2 py-0.5 rounded font-bold">
                Target: 14g Total Initial Dose
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <label className={`flex items-start gap-2.5 p-2.5 rounded border transition-all cursor-pointer ${
                ivGiven ? 'bg-[#dcfce7] border-[#86efac]' : 'bg-white border-[#fca5a5]'
              }`}>
                <input
                  type="checkbox"
                  checked={ivGiven}
                  onChange={(e) => setIvGiven(e.target.checked)}
                  className="mt-0.5 rounded text-[#16a34a] focus:ring-[#16a34a]"
                />
                <div>
                  <div className="font-bold text-[#0f172a]">4g IV Loading</div>
                  <div className="text-[11px] text-[#64748b]">20% solution slow IV push over 10-15 min</div>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-2.5 rounded border transition-all cursor-pointer ${
                imLeftGiven ? 'bg-[#dcfce7] border-[#86efac]' : 'bg-white border-[#fca5a5]'
              }`}>
                <input
                  type="checkbox"
                  checked={imLeftGiven}
                  onChange={(e) => setImLeftGiven(e.target.checked)}
                  className="mt-0.5 rounded text-[#16a34a] focus:ring-[#16a34a]"
                />
                <div>
                  <div className="font-bold text-[#0f172a]">5g IM (Left Buttock)</div>
                  <div className="text-[11px] text-[#64748b]">50% deep IM with 1ml 2% Lignocaine</div>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-2.5 rounded border transition-all cursor-pointer ${
                imRightGiven ? 'bg-[#dcfce7] border-[#86efac]' : 'bg-white border-[#fca5a5]'
              }`}>
                <input
                  type="checkbox"
                  checked={imRightGiven}
                  onChange={(e) => setImRightGiven(e.target.checked)}
                  className="mt-0.5 rounded text-[#16a34a] focus:ring-[#16a34a]"
                />
                <div>
                  <div className="font-bold text-[#0f172a]">5g IM (Right Buttock)</div>
                  <div className="text-[11px] text-[#64748b]">50% deep IM with 1ml 2% Lignocaine</div>
                </div>
              </label>
            </div>
          </div>

          {/* Safety Checklist */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
              2. Mandatory Toxicity Safety Verification
            </h4>
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 p-2 bg-[#f8fafc] border border-[#e2e8f0] rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={foleyInserted}
                  onChange={(e) => setFoleyInserted(e.target.checked)}
                  className="rounded text-[#006194]"
                />
                <span>Indwelling Foley Catheter inserted • Hourly urine output documented (&gt; 30 ml/hr)</span>
              </label>
              <label className="flex items-center gap-2 p-2 bg-[#f8fafc] border border-[#e2e8f0] rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={ambulanceContacted}
                  onChange={(e) => setAmbulanceContacted(e.target.checked)}
                  className="rounded text-[#006194]"
                />
                <span>Ambulance Unit 04 / 108 Emergency Medical Service alerted & mesh dispatched</span>
              </label>
            </div>
          </div>

          {/* Destination Facility */}
          <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-lg p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <Truck className="w-5 h-5 text-[#0284c7]" />
              <div>
                <span className="font-bold text-[#0369a1] block">Referral Destination: District Civil Hospital (DCH)</span>
                <span className="text-[#64748b] text-[11px]">Equipped with Level III NICU & 24/7 Obstetrician on-call</span>
              </div>
            </div>
            <span className="bg-[#0284c7] text-white text-[10px] font-bold px-2 py-1 rounded">
              ETA: 22 Mins
            </span>
          </div>

          {referralSent && (
            <div className="p-3 bg-[#dcfce7] border border-[#86efac] rounded-lg text-xs font-bold text-[#14532d] flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#16a34a]" />
              Referral slip transmitted via P2P Mesh to District Hospital and Ambulance Unit 04!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#f8fafc] px-6 py-3.5 border-t border-[#e2e8f0] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#475569] hover:text-[#0f172a] border border-[#cbd5e1] hover:border-[#94a3b8] rounded-lg bg-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleDispatch}
            disabled={referralSent}
            className="px-5 py-2 text-xs font-bold text-white bg-[#b91c1c] hover:bg-[#991b1b] active:scale-98 rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Truck className="w-4 h-4" />
            <span>Confirm Protocol & Broadcast Referral</span>
          </button>
        </div>
      </div>
    </div>
  );
};
