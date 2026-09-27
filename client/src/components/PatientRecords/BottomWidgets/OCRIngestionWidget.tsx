import React from 'react';
import { Camera, Scan, Upload } from 'lucide-react';


interface OCRIngestionWidgetProps {
  onLaunchOCR: () => void;
  onOpenImportVault?: () => void;
}

export const OCRIngestionWidget: React.FC<OCRIngestionWidgetProps> = ({ onLaunchOCR, onOpenImportVault }) => {
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg p-4 shadow-xs flex flex-col justify-between space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
            Paper Card &amp; Vault Ingestion
          </span>
          <span className="bg-[#dcfce7] text-[#15803d] text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#bbf7d0]">
            Ready to Scan
          </span>
        </div>

        <h3 className="text-sm font-bold text-[#0f172a] mt-1.5">
          Scan Physical Cards &amp; QR Vaults
        </h3>
        <p className="text-[11px] text-[#64748b] mt-0.5 leading-snug">
          Point tablet camera at Mother-Child Protection (MCP) cards, or import digital QR passes and JSON vaults directly.
        </p>

        {/* Thumbnail with overlay */}
        <div className="relative mt-3 rounded-lg overflow-hidden border border-[#e2e8f0] bg-[#f8fafc] h-28 flex items-center justify-center">
          <img
            src="https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=600&auto=format&fit=crop&q=80"
            alt="Physical MCP Cards"
            className="w-full h-full object-cover opacity-80"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-slate-900/35 flex items-center justify-center">
            <span className="bg-[#006194]/90 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md backdrop-blur-2xs">
              <Scan className="w-3.5 h-3.5" />
              Ready to Ingest
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={onLaunchOCR}
          className="flex items-center justify-center gap-1.5 bg-[#f0f9ff] hover:bg-[#e0f2fe] active:scale-98 text-[#006194] border border-[#bae6fd] py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
          title="Scan Paper Clinic Card with Camera"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Scan Paper Card</span>
        </button>

        {onOpenImportVault && (
          <button
            onClick={onOpenImportVault}
            className="flex items-center justify-center gap-1.5 bg-[#006194] hover:bg-[#004f7b] active:scale-98 text-white py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
            title="Import QR Pass or JSON Vault file"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import QR / JSON</span>
          </button>
        )}
      </div>
    </div>
  );
};

