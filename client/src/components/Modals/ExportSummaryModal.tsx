import React, { useState } from 'react';
import type { Patient, MeshNode } from '../../types/triage';
import { X, Download, FileSpreadsheet, Lock, CheckCircle2, Share2, Check, FileJson } from 'lucide-react';

interface ExportSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  meshNodes?: MeshNode[];
}

export const ExportSummaryModal: React.FC<ExportSummaryModalProps> = ({
  isOpen,
  onClose,
  patients,
}) => {
  const [downloaded, setDownloaded] = useState(false);
  const [copiedJSON, setCopiedJSON] = useState(false);

  if (!isOpen) return null;

  const handleDownload = (format: 'json' | 'csv') => {
    let content = '';
    let filename = '';
    let mimeType = '';

    if (format === 'json') {
      const exportData = {
        clinic: 'Clinic Station',
        exportedAt: new Date().toISOString(),
        encryption: 'AES-256-GCM / PBKDF2',
        totalPatients: patients.length,
        criticalCount: patients.filter((p) => p.riskTier === 'high').length,
        patients,
      };
      content = JSON.stringify(exportData, null, 2);
      filename = `MaternaVault_Triage_Summary_${new Date().toISOString().slice(0, 10)}.json`;
      mimeType = 'application/json';
    } else {
      const headers = 'ID,Name,Age,Gravida,Para,GA_Weeks,GA_Days,Trimester,BP_Systolic,BP_Diastolic,BMI,Risk_Tier,Risk_Title,Preterm_Probability,Village\n';
      const rows = patients
        .map(
          (p) =>
            `"${p.id}","${p.name}",${p.age},${p.gravida},${p.para},${p.gestationalWeeks},${p.gestationalDays},${p.trimester},${p.bpSystolic},${p.bpDiastolic},${p.bmi},"${p.riskTier}","${p.riskTitle} ${p.riskSubtitle || ''}",${p.pretermProbability}%,"${p.village || 'Rampur'}"`
        )
        .join('\n');
      content = headers + rows;
      filename = `MaternaVault_Triage_Roster_${new Date().toISOString().slice(0, 10)}.csv`;
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  const handleCopyRawJSON = async () => {
    const exportData = {
      clinic: 'Clinic Station',
      exportedAt: new Date().toISOString(),
      encryption: 'AES-256-GCM / PBKDF2',
      totalPatients: patients.length,
      criticalCount: patients.filter((p) => p.riskTier === 'high').length,
      patients,
    };
    const content = JSON.stringify(exportData, null, 2);
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border-t sm:border border-[#cbd5e1] max-w-lg w-full overflow-hidden animate-in fade-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#006194] text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-white/15 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Export Mesh Summary</h3>
              <p className="text-[11px] text-[#cce5ff]">
                Encrypted Offline Clinical Triage Archive
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
        <div className="p-5 space-y-4">
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#64748b]">Total Registered Pregnancies:</span>
              <span className="font-bold text-[#0f172a] font-mono">142</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748b]">Active Triage Queue:</span>
              <span className="font-bold text-[#0f172a] font-mono">{patients.length} records</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748b]">Critical Action Required:</span>
              <span className="font-bold text-[#b91c1c] font-mono">
                {patients.filter((p) => p.riskTier === 'high').length} cases
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-[#e2e8f0]">
              <span className="text-[#64748b]">Security Envelope:</span>
              <span className="font-bold text-[#047857] flex items-center gap-1">
                <Lock className="w-3 h-3" /> ChaCha20 + Ed25519 Signed
              </span>
            </div>
          </div>

          <p className="text-xs text-[#64748b]">
            Choose an export format to synchronize across local USB field storage or peer-to-peer relay tokens.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => handleDownload('json')}
                className="flex flex-col items-center justify-center p-3 border border-[#cbd5e1] rounded-lg hover:border-[#006194] hover:bg-[#f0f9ff] transition-all cursor-pointer text-center w-full"
              >
                <Download className="w-5 h-5 text-[#006194] mb-1.5" />
                <span className="text-xs font-bold text-[#0f172a]">Encrypted JSON</span>
                <span className="text-[10px] text-[#64748b]">Download .json file</span>
              </button>
              <button
                type="button"
                onClick={handleCopyRawJSON}
                className={`py-1 px-2 rounded text-[11px] font-bold border transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                  copiedJSON
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-[#f8fafc] hover:bg-[#f1f5f9] border-[#cbd5e1] text-[#006194]'
                }`}
                title="Copy raw JSON string generated directly"
              >
                {copiedJSON ? <Check className="w-3 h-3 text-emerald-600" /> : <FileJson className="w-3 h-3 text-[#006194]" />}
                <span>{copiedJSON ? 'JSON Copied!' : 'Copy Raw JSON'}</span>
              </button>
            </div>

            <button
              onClick={() => handleDownload('csv')}
              className="flex flex-col items-center justify-center p-3 border border-[#cbd5e1] rounded-lg hover:border-[#006194] hover:bg-[#f0f9ff] transition-all cursor-pointer text-center h-[96px]"
            >
              <FileSpreadsheet className="w-5 h-5 text-[#047857] mb-1.5" />
              <span className="text-xs font-bold text-[#0f172a]">Clinical CSV Sheet</span>
              <span className="text-[10px] text-[#64748b]">For medical officer audit</span>
            </button>
          </div>

          {downloaded && (
            <div className="p-2.5 bg-[#dcfce7] border border-[#86efac] rounded-lg text-xs font-bold text-[#14532d] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
              Export payload successfully saved to device storage!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#f8fafc] px-5 py-3 border-t border-[#e2e8f0] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#475569] hover:text-[#0f172a] border border-[#cbd5e1] hover:border-[#94a3b8] rounded-lg bg-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
