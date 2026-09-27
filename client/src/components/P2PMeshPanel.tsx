import React from 'react';
import type { MeshNode } from '../types/triage';
import { Tablet, ShieldCheck, Wifi } from 'lucide-react';

interface P2PMeshPanelProps {
  nodes: MeshNode[];
}

export const P2PMeshPanel: React.FC<P2PMeshPanelProps> = ({ nodes }) => {
  return (
    <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-4 shadow-xs space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#f1f5f9]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#f0fdf4] text-[#047857] flex items-center justify-center">
            <Tablet className="w-3.5 h-3.5 text-[#047857]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0f172a] tracking-tight">
              Connected Clinic Tablets
            </h3>
            <p className="text-[10px] text-[#64748b]">Syncs records directly without internet</p>
          </div>
        </div>
        <div className="text-[10.5px] font-semibold text-[#047857] bg-[#dcfce7] px-2 py-0.5 rounded-full flex items-center gap-1">
          <Wifi className="w-3 h-3 text-[#16a34a]" />
          <span>Active</span>
        </div>
      </div>

      {/* Nodes list */}
      <div className="space-y-2.5">
        {nodes.map((node) => (
          <div
            key={node.id}
            className="flex items-center justify-between text-xs py-1"
          >
            <div className="flex items-center gap-2.5">
              {/* Dot */}
              <div className="relative flex h-2.5 w-2.5 items-center justify-center">
                {node.isPulsing && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    node.dotColor === 'green'
                      ? 'bg-[#16a34a]'
                      : node.dotColor === 'blue'
                      ? 'bg-[#0284c7]'
                      : 'bg-[#f59e0b]'
                  }`}
                />
              </div>

              <div>
                <div className="text-xs font-bold text-[#0f172a] leading-tight">
                  {node.name}
                </div>
                <div className="text-[10.5px] text-[#64748b] mt-0.5">
                  {node.channelInfo}
                </div>
              </div>
            </div>

            {/* Sync Timestamp */}
            <div className="text-right">
              <span
                className={`text-[11px] font-semibold ${
                  node.dotColor === 'green'
                    ? 'text-[#047857]'
                    : node.dotColor === 'blue'
                    ? 'text-[#0284c7]'
                    : 'text-[#b45309]'
                }`}
              >
                {node.syncTime}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer info */}
      <div className="pt-2.5 border-t border-[#f1f5f9] flex items-center justify-between text-[10.5px]">
        <span className="text-[#64748b]">
          Auto-Sync: <span className="font-semibold text-[#334155]">Tablets within 50m</span>
        </span>
        <span className="font-bold text-[#047857] flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-[#047857]" />
          Safe & Encrypted
        </span>
      </div>
    </div>
  );
};
