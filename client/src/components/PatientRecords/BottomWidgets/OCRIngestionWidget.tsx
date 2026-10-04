import React from 'react';
import { QrCode, Upload, ShieldCheck, UserPlus } from 'lucide-react';

interface OCRIngestionWidgetProps {
  onLaunchOCR?: () => void;
  onOpenImportVault?: () => void;
}

export const OCRIngestionWidget: React.FC<OCRIngestionWidgetProps> = ({ onLaunchOCR, onOpenImportVault }) => {
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg p-4 shadow-xs flex flex-col justify-between space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#006194]" />
            Digital Vault &amp; QR Ingestion
          </span>
          <span className="bg-[#dcfce7] text-[#15803d] text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#bbf7d0]">
            Offline Ready
          </span>
        </div>

        <h3 className="text-sm font-bold text-[#0f172a] mt-1.5">
          FHIR Health Vault &amp; QR Ingestion
        </h3>
        <p className="text-[11px] text-[#64748b] mt-0.5 leading-snug">
          Import encrypted Mother-Child digital QR passes or offline FHIR JSON vaults directly into this clinic's local registry.
        </p>

        {/* Visual Badge Card */}
        <div className="relative mt-3 rounded-lg border border-[#bae6fd] bg-gradient-to-br from-[#f0f9ff] to-[#e0f2fe] h-28 flex flex-col items-center justify-center p-3 text-center">
          <div className="w-10 h-10 rounded-xl bg-[#006194] text-white flex items-center justify-center shadow-xs mb-1.5">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <span className="text-xs font-bold text-[#0f172a]">
            ECDSA P-256 Signed FHIR Pass
          </span>
          <span className="text-[10px] text-[#006194] font-medium">
            Cross-Clinic P2P Interoperability
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {onOpenImportVault && (
          <button
            onClick={onOpenImportVault}
            className="flex items-center justify-center gap-1.5 bg-[#006194] hover:bg-[#004f7b] active:scale-98 text-white py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
            title="Import QR Pass or JSON Vault file"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import QR / Vault</span>
          </button>
        )}

        {onLaunchOCR && (
          <button
            onClick={onLaunchOCR}
            className="flex items-center justify-center gap-1.5 bg-[#f0f9ff] hover:bg-[#e0f2fe] active:scale-98 text-[#006194] border border-[#bae6fd] py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
            title="Open Mother Registration Form"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register Mother</span>
          </button>
        )}
      </div>
    </div>
  );
};
