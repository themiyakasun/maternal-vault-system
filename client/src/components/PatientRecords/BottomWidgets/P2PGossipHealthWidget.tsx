import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const P2PGossipHealthWidget: React.FC = () => {
  const peerList = [
    { name: "Sister Sunita's Tablet", sync: 'Sync: 4m ago', status: 'green' },
    { name: "Sister Anjali's Tablet", sync: 'Sync: 22m ago', status: 'green' },
    { name: 'Ambulance Unit AMB-04', sync: 'Sync: 48m ago', status: 'blue' },
  ];

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg p-4 shadow-xs flex flex-col justify-between space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
            Clinic Tablet Connections
          </span>
          <span className="bg-[#f0fdf4] text-[#166534] text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#bbf7d0]">
            3 Active Devices
          </span>
        </div>

        <h3 className="text-sm font-bold text-[#0f172a] mt-1.5">
          Direct Tablet Sync
        </h3>
        <p className="text-[11px] text-[#64748b] mt-0.5 leading-snug">
          Syncs maternal records directly between nearby midwife tablets without requiring internet.
        </p>

        {/* Peer Nodes Table */}
        <div className="mt-3 border border-[#f1f5f9] rounded-lg divide-y divide-[#f8fafc] text-xs">
          {peerList.map((peer, idx) => (
            <div key={idx} className="p-2 flex items-center justify-between hover:bg-[#faf8ff]">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    peer.status === 'green' ? 'bg-[#16a34a]' : 'bg-[#0284c7]'
                  }`}
                />
                <span className="font-bold text-[#0f172a] text-xs">{peer.name}</span>
              </div>
              <span className="text-[11px] font-medium text-[#64748b]">{peer.sync}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer info */}
      <div className="pt-2 border-t border-[#f1f5f9] flex items-center justify-between text-[10.5px]">
        <span className="text-[#64748b]">
          Auto-Save: <strong className="text-[#334155]">Active on tablet</strong>
        </span>
        <span className="text-[#047857] font-bold flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-[#047857]" />
          Safe & Encrypted
        </span>
      </div>
    </div>
  );
};
