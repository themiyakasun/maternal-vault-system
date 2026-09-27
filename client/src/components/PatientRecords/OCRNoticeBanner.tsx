import React from 'react';
import { Camera } from 'lucide-react';

interface OCRNoticeBannerProps {
  onInitiateScan: () => void;
}

export const OCRNoticeBanner: React.FC<OCRNoticeBannerProps> = ({ onInitiateScan }) => {
  return (
    <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
      <div className="flex items-start sm:items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#006194] text-white flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 shadow-xs">
          <Camera className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-[#0f172a] tracking-tight">
              📷 Fast Paper Card Scanner
            </span>
            <span className="bg-[#dcfce7] text-[#15803d] text-[10px] font-bold px-2 py-0.5 rounded border border-[#bbf7d0]">
              Instant Auto-Fill
            </span>
          </div>
          <p className="text-[11.5px] text-[#334155] mt-0.5 leading-snug">
            Save time! Take a photo of the mother's paper pregnancy booklet (H 512 B or MCP Card) to fill her info automatically.
          </p>
        </div>
      </div>

      <button
        onClick={onInitiateScan}
        className="shrink-0 flex items-center gap-2 bg-[#006194] hover:bg-[#004f7b] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
      >
        <Camera className="w-3.5 h-3.5" />
        <span>Scan Mother's Card</span>
      </button>
    </div>
  );
};
