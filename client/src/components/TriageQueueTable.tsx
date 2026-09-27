import React, { useState } from 'react';
import type { Patient, FilterTab } from '../types/triage';
import { AlertTriangle, QrCode } from 'lucide-react';

interface TriageQueueTableProps {
  patients: Patient[];
  selectedPatientId: string;
  onSelectPatient: (patient: Patient) => void;
  activeFilter: FilterTab;
  setActiveFilter: (filter: FilterTab) => void;
  onOpenQR?: (patient: Patient) => void;
}

export const TriageQueueTable: React.FC<TriageQueueTableProps> = ({
  patients,
  selectedPatientId,
  onSelectPatient,
  activeFilter,
  setActiveFilter,
  onOpenQR,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const highCount = patients.filter((p) => p.riskTier === 'high').length;
  const modCount = patients.filter((p) => p.riskTier === 'moderate').length;
  const lowCount = patients.filter((p) => p.riskTier === 'low').length;

  // Filter patients
  const filteredPatients = patients.filter((p) => {
    if (activeFilter === 'high') return p.riskTier === 'high';
    if (activeFilter === 'moderate') return p.riskTier === 'moderate';
    if (activeFilter === 'low') return p.riskTier === 'low';
    return true;
  });

  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage) || 1;
  const startIndex = filteredPatients.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, filteredPatients.length);
  const currentPatients = filteredPatients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleTabChange = (filter: FilterTab) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const getLeftBarColor = (tier: string) => {
    switch (tier) {
      case 'high':
        return 'bg-[#ef4444]';
      case 'moderate':
        return 'bg-[#38bdf8]';
      case 'low':
        return 'bg-[#22c55e]';
      default:
        return 'bg-[#64748b]';
    }
  };

  const renderRiskBadge = (patient: Patient) => {
    if (patient.riskTier === 'high') {
      return (
        <div className="inline-block bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5] px-2.5 py-1 rounded text-[11px] font-bold tracking-tight">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
            <span>{patient.riskTitle}</span>
          </div>
          {patient.riskSubtitle && (
            <div className="text-[10px] font-semibold text-[#b91c1c] leading-none mt-0.5">
              {patient.riskSubtitle}
            </div>
          )}
        </div>
      );
    }

    if (patient.riskTier === 'moderate') {
      return (
        <div className="inline-block bg-[#e0f2fe] text-[#0369a1] border border-[#93c5fd] px-2.5 py-1 rounded text-[11px] font-bold tracking-tight">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0284c7]" />
            <span>{patient.riskTitle}</span>
          </div>
          {patient.riskSubtitle && (
            <div className="text-[10px] font-semibold text-[#0369a1] leading-none mt-0.5">
              {patient.riskSubtitle}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="inline-block bg-[#d1fae5] text-[#065f46] border border-[#6ee7b7] px-2.5 py-1 rounded text-[11px] font-bold tracking-tight">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
          <span>{patient.riskTitle}</span>
        </div>
        {patient.riskSubtitle && (
          <div className="text-[10px] font-semibold text-[#047857] leading-none mt-0.5">
            {patient.riskSubtitle}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-5 shadow-xs flex flex-col justify-between">
      {/* Header Section */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#f1f5f9]">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-[#0f172a] tracking-tight">
                Priority Maternal Care Queue
              </h2>
              <span className="bg-[#e0f2fe] text-[#004b73] text-xs font-bold px-2 py-0.5 rounded-full">
                24 mothers in queue
              </span>
            </div>
            <p className="text-xs text-[#64748b] mt-0.5">
              Ranked by clinical priority — high attention cases shown first
            </p>
          </div>

        {/* Filter Tabs Header */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-1">
          <div className="flex items-center gap-1.5 bg-[#f1f5f9] p-1.5 rounded-xl text-xs font-semibold shrink-0 border border-[#e2e8f0]">
            <button
              onClick={() => handleTabChange('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap text-xs font-bold ${
                activeFilter === 'all'
                  ? 'bg-[#006194] text-white shadow-2xs'
                  : 'text-[#475569] hover:text-[#0f172a] hover:bg-white/80'
              }`}
            >
              All ({patients.length})
            </button>
            <button
              onClick={() => handleTabChange('high')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 text-xs font-bold ${
                activeFilter === 'high'
                  ? 'bg-[#ef4444] text-white shadow-2xs'
                  : 'text-[#991b1b] hover:text-[#b91c1c] bg-[#fee2e2]/70 hover:bg-[#fee2e2]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#ef4444] inline-block ring-1 ring-white/50" />
              High ({highCount})
            </button>
            <button
              onClick={() => handleTabChange('moderate')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap text-xs font-bold ${
                activeFilter === 'moderate'
                  ? 'bg-[#0284c7] text-white shadow-2xs'
                  : 'text-[#0369a1] hover:text-[#0284c7] bg-[#e0f2fe]/70 hover:bg-[#e0f2fe]'
              }`}
            >
              Moderate ({modCount})
            </button>
            <button
              onClick={() => handleTabChange('low')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap text-xs font-bold ${
                activeFilter === 'low'
                  ? 'bg-[#10b981] text-white shadow-2xs'
                  : 'text-[#065f46] hover:text-[#047857] bg-[#d1fae5]/70 hover:bg-[#d1fae5]'
              }`}
            >
              Routine ({lowCount})
            </button>
          </div>
        </div>
        </div>

        {/* 1. Mobile Triage Patient Card List (Visible on mobile < md) */}
        <div className="md:hidden space-y-3 mt-3.5">
          {currentPatients.length === 0 ? (
            <div className="text-center py-10 text-xs text-[#64748b] bg-[#f8fafc] rounded-xl border border-[#e2e8f0]">
              No mothers found matching the selected filter.
            </div>
          ) : (
            currentPatients.map((patient) => {
              const isSelected = selectedPatientId === patient.id;

              return (
                <div
                  key={patient.id}
                  onClick={() => onSelectPatient(patient)}
                  className={`relative p-4 rounded-xl transition-all cursor-pointer border ${
                    isSelected
                      ? 'border-[#006194] bg-[#f0f9ff] shadow-sm ring-1 ring-[#006194]'
                      : 'border-[#e2e8f0] bg-white hover:border-[#cbd5e1] shadow-2xs'
                  }`}
                >
                  {/* Left Severity Indicator Bar */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${getLeftBarColor(
                      patient.riskTier
                    )}`}
                  />

                  {/* Header: Name, ID, GA, Risk */}
                  <div className="pl-2 flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-[#0f172a] leading-tight">
                        <span className="font-mono text-[#006194]">{patient.id}</span> • {patient.name}
                      </div>
                      <div className="text-[11px] text-[#64748b] mt-0.5">
                        {patient.age} yrs • G{patient.gravida}P{patient.para} • {patient.locality || patient.village || 'Rampur'}
                      </div>
                    </div>
                    <div className="shrink-0">{renderRiskBadge(patient)}</div>
                  </div>

                  {/* Vitals Grid Chips */}
                  <div className="pl-2 grid grid-cols-3 gap-2 mt-3">
                    <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-2 text-center">
                      <div className="text-[9.5px] uppercase font-bold text-[#64748b]">Stage</div>
                      <div className="font-bold font-mono text-[11.5px] text-[#0f172a] mt-0.5">
                        {patient.gestationalWeeks}w {patient.gestationalDays}d
                      </div>
                      <div className="text-[10px] font-semibold text-[#006194]">Trim {patient.trimester}</div>
                    </div>

                    <div className={`border rounded-lg p-2 text-center ${
                      patient.isBpAlert ? 'bg-[#fee2e2] border-[#fca5a5]' : 'bg-[#f8fafc] border-[#e2e8f0]'
                    }`}>
                      <div className="text-[9.5px] uppercase font-bold text-[#64748b]">BP</div>
                      <div className={`font-bold font-mono text-[11.5px] mt-0.5 ${patient.isBpAlert ? 'text-[#b91c1c]' : 'text-[#0f172a]'}`}>
                        {patient.bpSystolic}/{patient.bpDiastolic}
                      </div>
                      <div className="text-[10px] text-[#64748b]">mmHg</div>
                    </div>

                    <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-2 text-center">
                      <div className="text-[9.5px] uppercase font-bold text-[#64748b]">BMI</div>
                      <div className="font-bold font-mono text-[11.5px] text-[#0f172a] mt-0.5">
                        {patient.bmi}
                      </div>
                      <div className="text-[10px] text-[#64748b] truncate">{patient.bmiCategory || 'Normal'}</div>
                    </div>
                  </div>

                  {/* Mobile Footer Action Bar */}
                  <div className="pl-2 pt-2.5 mt-2.5 border-t border-[#f1f5f9] flex items-center justify-between text-xs">
                    <span className="text-[11px] text-[#006194] font-semibold flex items-center gap-1">
                      {isSelected ? '✓ Selected for Care Plan' : 'Tap to View AI Care Plan'}
                    </span>
                    {onOpenQR && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenQR(patient);
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold text-[#006194] bg-[#f0f9ff] hover:bg-[#e0f2fe] border border-[#bae6fd] px-3 py-1.5 rounded-lg shadow-2xs cursor-pointer transition-all active:scale-95"
                      >
                        <QrCode className="w-3.5 h-3.5 text-[#0284c7]" />
                        <span>QR Pass</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 2. Desktop Table / List Container (Hidden on mobile < md) */}
        <div className="hidden md:block mt-3.5 overflow-x-auto">
          {/* Column Header Titles */}
          <div className="grid grid-cols-12 gap-3 px-4 py-2.5 text-[10.5px] font-bold text-[#64748b] uppercase tracking-wider bg-[#f8fafc] rounded-t-xl border-x border-t border-[#e2e8f0]">
            <div className="col-span-4">Mother's Name & ID</div>
            <div className="col-span-2">Pregnancy Stage</div>
            <div className="col-span-2">Blood Pressure</div>
            <div className="col-span-2">BMI & Weight</div>
            <div className="col-span-2 text-left">Risk & Mobile Pass</div>
          </div>

          {/* Patient Rows */}
          <div className="divide-y divide-[#f1f5f9] border-x border-b border-[#e2e8f0] rounded-b-xl bg-white overflow-hidden shadow-2xs">
            {currentPatients.length === 0 ? (
              <div className="text-center py-12 text-sm text-[#64748b]">
                No mothers found matching the selected filter.
              </div>
            ) : (
              currentPatients.map((patient) => {
                const isSelected = selectedPatientId === patient.id;

                return (
                  <div
                    key={patient.id}
                    onClick={() => onSelectPatient(patient)}
                    className={`relative grid grid-cols-12 gap-3 items-center px-4 py-3.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#f0f9ff] ring-1 ring-inset ring-[#006194]'
                        : 'hover:bg-[#f8fafc]'
                    }`}
                  >
                    {/* Left Severity Indicator Bar */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1.5 ${getLeftBarColor(
                        patient.riskTier
                      )}`}
                    />

                    {/* Col 1: ID & Identity */}
                    <div className="col-span-4 pl-2">
                      <div className="text-xs font-bold text-[#0f172a] leading-tight flex items-center gap-1.5">
                        <span className="font-mono text-[#006194] bg-[#e0f2fe] px-1.5 py-0.2 rounded text-[10.5px]">
                          {patient.id}
                        </span>
                        <span>{patient.name}</span>
                      </div>
                      <div className="text-[11px] text-[#64748b] mt-1">
                        {patient.age} yrs • Gravida {patient.gravida}, Para {patient.para} • {patient.locality || patient.village || 'Rampur'}
                      </div>
                    </div>

                    {/* Col 2: GA / Term */}
                    <div className="col-span-2">
                      <div className="text-xs font-bold font-mono text-[#0f172a] leading-tight">
                        {patient.gestationalWeeks}w {patient.gestationalDays}d
                      </div>
                      <div className="text-[11px] text-[#64748b] mt-0.5">
                        Trimester {patient.trimester}
                      </div>
                    </div>

                    {/* Col 3: Latest BP */}
                    <div className="col-span-2">
                      {patient.isBpAlert ? (
                        <div className="inline-flex items-center gap-1 bg-[#fee2e2] text-[#b91c1c] border border-[#fca5a5] px-2 py-0.5 rounded-md text-xs font-bold font-mono shadow-2xs">
                          <AlertTriangle className="w-3 h-3 text-[#ef4444]" />
                          <span>{patient.bpSystolic}/{patient.bpDiastolic}</span>
                          <span className="text-[9px] font-normal text-[#991b1b]">mmHg</span>
                        </div>
                      ) : (
                        <div className="text-xs font-mono font-medium text-[#0f172a]">
                          <span className="font-bold">{patient.bpSystolic}/{patient.bpDiastolic}</span>
                          <span className="text-[10px] text-[#64748b] ml-1">mmHg</span>
                        </div>
                      )}
                    </div>

                    {/* Col 4: Maternal BMI */}
                    <div className="col-span-2">
                      <div className="text-xs font-bold font-mono text-[#0f172a]">
                        {patient.bmi} <span className="text-[10px] font-normal text-[#64748b]">kg/m²</span>
                      </div>
                      <div
                        className={`text-[11px] font-medium mt-0.5 leading-tight ${
                          patient.bmiStatusClass === 'danger'
                            ? 'text-[#b91c1c] font-semibold'
                            : patient.bmiStatusClass === 'normal'
                            ? 'text-[#047857]'
                            : 'text-[#64748b]'
                        }`}
                      >
                        {patient.bmiCategory}
                      </div>
                    </div>

                    {/* Col 5: Stratified Risk Status & QR Transfer */}
                    <div className="col-span-2 flex items-center justify-between gap-2 text-left">
                      <div>{renderRiskBadge(patient)}</div>
                      {onOpenQR && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenQR(patient);
                          }}
                          className="flex items-center gap-1 text-[11px] font-bold text-[#006194] bg-[#f0f9ff] hover:bg-[#e0f2fe] border border-[#bae6fd] px-2.5 py-1.5 rounded-lg transition-all shadow-2xs cursor-pointer shrink-0"
                          title="Generate Mobile Transfer QR Code"
                        >
                          <QrCode className="w-3.5 h-3.5 text-[#0284c7]" />
                          <span className="hidden xl:inline">QR</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="mt-4 pt-3.5 border-t border-[#f1f5f9] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-[#64748b]">
        <div>
          Showing {filteredPatients.length === 0 ? '0' : `${startIndex} - ${endIndex}`} of {filteredPatients.length} mothers • Auto-evaluated on tablet
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 border border-[#cbd5e1] rounded-lg bg-white text-[#334155] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f8fafc] font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
          >
            Previous
          </button>
          <span className="font-mono font-bold text-[#0f172a] px-1.5 text-xs">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 border border-[#cbd5e1] rounded-lg bg-white text-[#334155] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f8fafc] font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
