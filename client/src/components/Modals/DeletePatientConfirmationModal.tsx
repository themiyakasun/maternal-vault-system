import React, { useState, useEffect } from 'react';
import type { Patient } from '../../types/triage';
import { 
  AlertTriangle, 
  Trash2, 
  X, 
  ShieldAlert, 
  Calendar, 
  User, 
  Loader2,
  FileText
} from 'lucide-react';

interface DeletePatientConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onConfirmDelete: (patientId: string) => Promise<void> | void;
}

export const DeletePatientConfirmationModal: React.FC<DeletePatientConfirmationModalProps> = ({
  isOpen,
  onClose,
  patient,
  onConfirmDelete,
}) => {
  const [confirmedCheckbox, setConfirmedCheckbox] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset confirmation state whenever modal opens or patient changes
  useEffect(() => {
    if (isOpen) {
      setConfirmedCheckbox(false);
      setIsDeleting(false);
    }
  }, [isOpen, patient?.id]);

  if (!isOpen || !patient) return null;

  const visitsCount = patient.ancVisits?.length || 0;
  const phmReg = patient.phmRegisterNo || `PHM/2024/${patient.id.replace('#', '')}`;

  const handleDelete = async () => {
    if (!confirmedCheckbox || isDeleting) return;
    try {
      setIsDeleting(true);
      await onConfirmDelete(patient.id);
    } catch (err) {
      console.error('Error during patient deletion:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-slate-900/70 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border-t sm:border border-[#fca5a5] max-w-lg w-full overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
      >
        {/* Header */}
        <div className="bg-[#b91c1c] text-white px-4 sm:px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold text-white shadow-inner">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 id="delete-modal-title" className="text-sm sm:text-base font-bold tracking-tight">
                Safe Record Deletion Safeguard
              </h2>
              <p className="text-[11px] text-[#fecaca]">
                Public Health Midwife Protocol • Irreversible Action
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer disabled:opacity-50"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 text-xs text-[#334155]">
          {/* Warning Banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#fef2f2] border border-[#fca5a5] text-[#991b1b]">
            <AlertTriangle className="w-4 h-4 text-[#dc2626] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-xs block">
                Are you sure you want to delete this maternal record?
              </span>
              <p className="text-[11px] text-[#7f1d1d] leading-relaxed">
                This action will permanently purge the mother's antenatal profile, recorded clinical visits, and biometric trends from both the offline tablet vault and local encrypted database.
              </p>
            </div>
          </div>

          {/* Record Identity Summary Card */}
          <div className="border border-[#e2e8f0] rounded-xl p-3.5 bg-[#f8fafc] space-y-2.5">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#006194]" />
                <span className="font-bold text-[#0f172a] text-sm">{patient.name}</span>
                <span className="bg-[#eaedff] text-[#004b73] font-mono text-[10px] font-bold px-1.5 py-0.2 rounded">
                  {patient.id}
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                patient.riskTier === 'high'
                  ? 'bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]'
                  : patient.riskTier === 'moderate'
                  ? 'bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]'
                  : 'bg-[#d1fae5] text-[#065f46] border border-[#a7f3d0]'
              }`}>
                {patient.riskTier} Risk
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-[#64748b] block">Demographics:</span>
                <span className="font-semibold text-[#0f172a]">
                  {patient.age} yrs • G{patient.gravida}P{patient.para} • {patient.bloodGroup || 'O+'}
                </span>
              </div>
              <div>
                <span className="text-[#64748b] block">Gestational Age:</span>
                <span className="font-semibold text-[#0f172a]">
                  {patient.gestationalWeeks}w {patient.gestationalDays}d (Trimester {patient.trimester})
                </span>
              </div>
              <div>
                <span className="text-[#64748b] block">PHM Register No:</span>
                <span className="font-mono font-semibold text-[#0f172a]">{phmReg}</span>
              </div>
              <div>
                <span className="text-[#64748b] block">Recorded ANC Visits:</span>
                <span className="font-semibold text-[#b91c1c] flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#b91c1c]" />
                  {visitsCount} visit{visitsCount !== 1 ? 's' : ''} in flowsheet
                </span>
              </div>
            </div>

            {patient.notes && (
              <div className="pt-2 border-t border-[#e2e8f0] text-[10.5px] text-[#475569] flex items-start gap-1">
                <FileText className="w-3 h-3 text-[#64748b] shrink-0 mt-0.5" />
                <span className="italic truncate max-w-full">
                  "{patient.notes}"
                </span>
              </div>
            )}
          </div>

          {/* Mandatory Confirmation Checkbox */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[#cbd5e1] hover:border-[#94a3b8] bg-white cursor-pointer transition-colors select-none">
            <input
              type="checkbox"
              checked={confirmedCheckbox}
              onChange={(e) => setConfirmedCheckbox(e.target.checked)}
              disabled={isDeleting}
              className="mt-0.5 w-4 h-4 rounded text-[#dc2626] border-slate-300 focus:ring-[#dc2626] cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-bold text-[#0f172a] block">
                I confirm deletion of this maternal record
              </span>
              <span className="text-[11px] text-[#64748b] leading-tight block mt-0.5">
                I understand this record cannot be recovered once removed from the local clinic register.
              </span>
            </div>
          </label>
        </div>

        {/* Footer / Action Buttons */}
        <div className="bg-[#f8fafc] px-4 sm:px-5 py-3 border-t border-[#e2e8f0] flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-[#475569] hover:text-[#0f172a] border border-[#cbd5e1] hover:border-[#94a3b8] rounded-lg bg-white transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!confirmedCheckbox || isDeleting}
            className="px-4 py-2 text-xs font-bold text-white bg-[#dc2626] hover:bg-[#b91c1c] active:scale-98 rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting Record...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm & Delete Record</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
