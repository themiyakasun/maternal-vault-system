import React, { useState, useEffect } from 'react';
import type { Patient } from '../../types/triage';
import { formatDisplayDate } from '../../utils/dateUtils';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Database, 
  Clock, 
  ShieldCheck, 
  QrCode, 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Trash2,
  FileText
} from 'lucide-react';

interface PatientRecordsTableProps {
  patients: Patient[];
  onViewEHR: (patient: Patient) => void;
  onOpenQR?: (patient: Patient) => void;
  onOpenAddVisit?: (patient: Patient) => void;
  onDeletePatient?: (patient: Patient) => void;
}

export const PatientRecordsTable: React.FC<PatientRecordsTableProps> = ({
  patients,
  onViewEHR,
  onOpenQR,
  onOpenAddVisit,
  onDeletePatient,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);

  const totalPages = Math.max(1, Math.ceil(patients.length / itemsPerPage));

  // Auto-clamp current page when patient count or itemsPerPage changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = patients.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, patients.length);

  const currentPatients = patients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Generate smart pagination page numbers
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const renderRiskBadge = (patient: Patient) => {
    if (patient.riskTier === 'high') {
      return (
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1 bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5] px-2 py-0.5 rounded text-[10.5px] font-bold">
            <AlertTriangle className="w-3 h-3 text-[#ef4444]" />
            <span>HIGH RISK</span>
          </div>
          <div className="text-[10.5px] text-[#991b1b] font-medium leading-tight">
            {patient.riskSubtitle || 'Preterm Risk 68% • Pre-eclampsia'}
          </div>
        </div>
      );
    }

    if (patient.riskTier === 'moderate') {
      return (
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1 bg-[#e0f2fe] text-[#0369a1] border border-[#93c5fd] px-2 py-0.5 rounded text-[10.5px] font-bold">
            <span>!</span>
            <span>MODERATE RISK</span>
          </div>
          <div className="text-[10.5px] text-[#0369a1] font-medium leading-tight">
            {patient.riskSubtitle || 'Gestational Anemia • IFA Issued'}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1 bg-[#d1fae5] text-[#065f46] border border-[#6ee7b7] px-2 py-0.5 rounded text-[10.5px] font-bold">
          <CheckCircle2 className="w-3 h-3 text-[#10b981]" />
          <span>LOW RISK</span>
        </div>
        <div className="text-[10.5px] text-[#047857] font-medium leading-tight">
          {patient.riskSubtitle || 'Routine Antenatal'}
        </div>
      </div>
    );
  };

  const renderSyncStatus = (patient: Patient) => {
    if (patient.syncStatus === 'synced-p2p') {
      return (
        <div className="space-y-0.5 text-xs">
          <div className="flex items-center gap-1 text-[#047857] font-bold text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a]" />
            <span>Synced via P2P</span>
          </div>
          <div className="text-[10.5px] text-[#64748b]">
            {patient.syncNode || 'Midwife Tablet 01'}
          </div>
          <div className="text-[10px] text-[#94a3b8] font-mono">
            {patient.syncProtocol || 'BLE Mesh • 4m ago'}
          </div>
        </div>
      );
    }

    if (patient.syncStatus === 'updated-local') {
      return (
        <div className="space-y-0.5 text-xs">
          <div className="flex items-center gap-1 text-[#0284c7] font-bold text-[11px]">
            <Database className="w-3.5 h-3.5 text-[#0284c7]" />
            <span>Updated Locally</span>
          </div>
          <div className="text-[10.5px] text-[#64748b]">
            {patient.syncNode || 'Clinic 4B Base Node'}
          </div>
          <div className="text-[10px] text-[#94a3b8] font-mono">
            {patient.syncProtocol || 'SQLite Engine • 12m ago'}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-0.5 text-xs">
        <div className="flex items-center gap-1 text-[#b45309] font-bold text-[11px]">
          <Clock className="w-3.5 h-3.5 text-[#f59e0b]" />
          <span>Pending Mesh Sync</span>
        </div>
        <div className="text-[10.5px] text-[#64748b]">
          {patient.syncNode || 'Queued in local buffer'}
        </div>
        <div className="text-[10px] text-[#94a3b8] font-mono">
          {patient.syncProtocol || 'Broadcast pending BLE peer'}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-xs overflow-hidden">
      {/* 1. Mobile Patient Card Feed (Visible on phones < md) */}
      <div className="md:hidden divide-y divide-[#f1f5f9]">
        {currentPatients.length === 0 ? (
          <div className="text-center py-10 px-4 text-xs text-[#64748b]">
            No patient records matched the active search and filter criteria.
          </div>
        ) : (
          currentPatients.map((patient) => (
            <div key={patient.id} className="p-3.5 space-y-3 hover:bg-[#f8fafc] transition-colors">
              {/* Card Header: Avatar, Name, ID, Blood, Risk */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${
                      patient.initialsColor || 'bg-[#e0f2fe] text-[#0284c7]'
                    }`}
                  >
                    {patient.initials || patient.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-[#0f172a] text-sm truncate">
                        {patient.name}
                      </span>
                      <span className="bg-[#eaedff] text-[#004b73] text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded">
                        {patient.id}
                      </span>
                      <span className="bg-[#fef3c7] text-[#92400e] text-[9px] font-bold px-1.5 py-0.2 rounded border border-[#fde68a]">
                        {patient.bloodGroup || 'O+'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#475569] mt-0.5 truncate">
                      {patient.age} yrs • G{patient.gravida}P{patient.para} • {patient.locality || patient.village || 'Rampur Sector 3'}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {renderRiskBadge(patient)}
                </div>
              </div>

              {/* Vitals & Gestational Chips Grid */}
              <div className="grid grid-cols-4 gap-1.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-2 text-center text-xs">
                <div>
                  <div className="text-[9.5px] font-bold uppercase text-[#64748b]">Stage</div>
                  <div className="font-bold font-mono text-[#0f172a] text-[11px] mt-0.5">
                    {patient.gestationalWeeks}w{patient.gestationalDays}d
                  </div>
                  <div className="text-[9px] text-[#0284c7] font-semibold">T{patient.trimester}</div>
                </div>

                <div>
                  <div className="text-[9.5px] font-bold uppercase text-[#64748b]">BP</div>
                  <div className={`font-bold font-mono text-[11px] mt-0.5 ${patient.isBpAlert ? 'text-[#b91c1c]' : 'text-[#0f172a]'}`}>
                    {patient.bpSystolic}/{patient.bpDiastolic}
                  </div>
                  <div className="text-[9px] text-[#64748b]">mmHg</div>
                </div>

                <div>
                  <div className="text-[9.5px] font-bold uppercase text-[#64748b]">Hb</div>
                  <div className={`font-bold font-mono text-[11px] mt-0.5 ${patient.isHbAlert ? 'text-[#b91c1c]' : 'text-[#0f172a]'}`}>
                    {patient.hb || 11.0}
                  </div>
                  <div className="text-[9px] text-[#64748b]">g/dL</div>
                </div>

                <div>
                  <div className="text-[9.5px] font-bold uppercase text-[#64748b]">Fundal</div>
                  <div className={`font-bold font-mono text-[11px] mt-0.5 ${patient.isFundalAlert ? 'text-[#b91c1c]' : 'text-[#0f172a]'}`}>
                    {patient.fundalHeight || '31 cm'}
                  </div>
                  <div className="text-[9px] text-[#64748b]">Height</div>
                </div>
              </div>

              {/* Sync & Assessment Metadata */}
              <div className="flex items-center justify-between text-[10.5px] text-[#64748b] pt-0.5">
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[#94a3b8]">ABHA: {patient.abhaId || '91-4299-8812-4411'}</span>
                </div>
                <div className="text-right truncate max-w-[160px]">
                  <span>By: {patient.assessedBy || 'Sister Priya Sharma'}</span>
                </div>
              </div>

              {/* Action Buttons (Native Mobile Touch Buttons) */}
              <div className="flex items-center gap-1.5 pt-1.5">
                <button
                  type="button"
                  onClick={() => onViewEHR(patient)}
                  className="flex-1 bg-[#006194] hover:bg-[#004f7b] active:scale-95 text-white h-9 px-3 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View EHR</span>
                </button>

                {onOpenAddVisit && (
                  <button
                    type="button"
                    onClick={() => onOpenAddVisit(patient)}
                    className="bg-[#ecfdf5] hover:bg-[#d1fae5] active:scale-95 text-[#047857] border border-[#a7f3d0] px-3 h-9 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>+ Visit</span>
                  </button>
                )}

                {onOpenQR && (
                  <button
                    type="button"
                    onClick={() => onOpenQR(patient)}
                    className="bg-[#f0f9ff] hover:bg-[#e0f2fe] active:scale-95 text-[#006194] border border-[#bae6fd] px-3 h-9 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1"
                  >
                    <QrCode className="w-3.5 h-3.5 text-[#0284c7]" />
                    <span>QR</span>
                  </button>
                )}

                {onDeletePatient && (
                  <button
                    type="button"
                    onClick={() => onDeletePatient(patient)}
                    className="bg-[#f8fafc] hover:bg-[#fee2e2] active:scale-95 text-[#94a3b8] hover:text-[#dc2626] border border-[#e2e8f0] hover:border-[#fca5a5] w-9 h-9 rounded-lg transition-all shadow-2xs cursor-pointer flex items-center justify-center shrink-0"
                    title="Safely Delete Patient Record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 2. Desktop & Tablet Table (Hidden on mobile < md) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[10.5px] font-bold text-[#64748b] uppercase tracking-wider">
              <th className="py-3.5 px-4 min-w-[220px]">Patient Identifier &amp; Demographics</th>
              <th className="py-3.5 px-3.5 min-w-[130px]">Gestational Profile</th>
              <th className="py-3.5 px-3.5 min-w-[150px]">Latest Edge Vitals</th>
              <th className="py-3.5 px-3.5 min-w-[140px]">AI Stratified Risk Level</th>
              <th className="py-3.5 px-3.5 min-w-[140px]">Sync Node &amp; Protocol</th>
              <th className="py-3.5 px-3.5 min-w-[130px]">Last Assessed By</th>
              <th className="py-3.5 px-4 text-center min-w-[260px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9] text-xs">
            {currentPatients.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-sm text-[#64748b]">
                  No patient records matched the active search and filter criteria.
                </td>
              </tr>
            ) : (
              currentPatients.map((patient) => (
                <tr
                  key={patient.id}
                  className="hover:bg-[#f0f9ff]/40 transition-colors group"
                >
                  {/* 1. Patient Identifier & Demographics */}
                  <td className="py-3.5 px-4 align-middle">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ring-1 ring-black/5 ${
                          patient.initialsColor || 'bg-[#e0f2fe] text-[#0284c7]'
                        }`}
                      >
                        {patient.initials || patient.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-[#0f172a] text-xs">
                            {patient.name}
                          </span>
                          <span className="bg-[#eaedff] text-[#004b73] text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border border-[#dae2fd]">
                            {patient.id}
                          </span>
                          <span className="bg-[#fef3c7] text-[#92400e] text-[9.5px] font-bold px-1.5 py-0.2 rounded border border-[#fde68a]">
                            {patient.bloodGroup || (patient.id === '#8842' ? 'B+' : patient.id === '#7912' ? 'O+' : patient.id === '#9043' ? 'A+' : 'O+')}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#475569] mt-0.5">
                          {patient.age} yrs • G{patient.gravida}P{patient.para} • {patient.locality || patient.village || 'Rampur Purva'}
                        </div>
                        <div className="text-[10px] font-mono text-[#64748b] mt-0.5 flex items-center gap-1.5">
                          <span>ABHA: {patient.abhaId || '91-4299-8812-4411'}</span>
                          <span>•</span>
                          <span className="text-[#006194] font-semibold">H 512 B Verified</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* 2. Gestational Profile */}
                  <td className="py-3.5 px-3.5 align-middle">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs text-[#0f172a]">
                        {patient.gestationalWeeks}w {patient.gestationalDays}d
                      </span>
                      <span className="bg-[#e0f2fe] text-[#0369a1] text-[10px] font-bold px-1.5 py-0.2 rounded border border-[#bae6fd]">
                        {patient.trimester === 1 ? '1st Trim' : patient.trimester === 2 ? '2nd Trim' : '3rd Trim'}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-[#64748b] mt-0.5 font-medium">
                      EDD: {formatDisplayDate(patient.edd || '2024-11-18')}
                    </div>
                    <div className={`text-[10.5px] mt-0.5 font-medium ${
                      patient.isFundalAlert ? 'text-[#b91c1c] font-bold' : 'text-[#64748b]'
                    }`}>
                      Fundal: {patient.fundalHeight || '31 cm'}
                    </div>
                  </td>

                  {/* 3. Latest Edge Vitals */}
                  <td className="py-3.5 px-3.5 align-middle font-mono text-xs">
                    <div className="grid grid-cols-2 gap-x-2.5 gap-y-1">
                      <div>
                        <span className="text-[10px] text-[#64748b] mr-1 font-sans font-medium">BP:</span>
                        <span className={`font-bold ${patient.isBpAlert ? 'text-[#b91c1c]' : 'text-[#0f172a]'}`}>
                          {patient.bpSystolic}/{patient.bpDiastolic}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#64748b] mr-1 font-sans font-medium">Hb:</span>
                        <span className={`font-bold ${patient.isHbAlert ? 'text-[#b91c1c]' : 'text-[#0f172a]'}`}>
                          {patient.hb || 11.0} <span className="text-[9px] font-normal text-[#64748b]">g/dL</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#64748b] mr-1 font-sans font-medium">BMI:</span>
                        <span className={`font-bold ${patient.bmiStatusClass === 'danger' ? 'text-[#b91c1c]' : 'text-[#0f172a]'}`}>
                          {patient.bmi}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#64748b] mr-1 font-sans font-medium">FHR:</span>
                        <span className={`font-bold ${patient.isFhrAlert ? 'text-[#b91c1c]' : 'text-[#16a34a]'}`}>
                          {patient.fhr || '142 bpm'}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* 4. AI Stratified Risk Level */}
                  <td className="py-3.5 px-3.5 align-middle">
                    {renderRiskBadge(patient)}
                  </td>

                  {/* 5. Sync Node & Protocol */}
                  <td className="py-3.5 px-3.5 align-middle">
                    {renderSyncStatus(patient)}
                  </td>

                  {/* 6. Last Assessed By */}
                  <td className="py-3.5 px-3.5 align-middle">
                    <div className="text-xs font-bold text-[#0f172a] leading-tight">
                      {patient.assessedBy || 'Priya Sharma, PHM'}
                    </div>
                    <div className="text-[10.5px] text-[#64748b] mt-0.5">
                      {patient.assessedTime || 'Yesterday at 14:15'}
                    </div>
                    <div className="text-[10px] text-[#94a3b8] mt-0.5">
                      {patient.assessedLocation || 'Sub-center Rampur'}
                    </div>
                  </td>

                  {/* 7. Actions */}
                  <td className="py-3.5 px-4 align-middle text-center whitespace-nowrap">
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onViewEHR(patient)}
                        className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-[#006194] hover:bg-[#004f7b] active:scale-95 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                        title="View Full Maternal Electronic Health Record"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View EHR</span>
                      </button>

                      {onOpenAddVisit && (
                        <button
                          type="button"
                          onClick={() => onOpenAddVisit(patient)}
                          className="inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-lg bg-[#ecfdf5] hover:bg-[#d1fae5] active:scale-95 text-[#047857] border border-[#a7f3d0] font-bold text-xs shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                          title="Record Antenatal Clinic Visit"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>+ Visit</span>
                        </button>
                      )}

                      {onOpenQR && (
                        <button
                          type="button"
                          onClick={() => onOpenQR(patient)}
                          className="inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-lg bg-[#f0f9ff] hover:bg-[#e0f2fe] active:scale-95 text-[#006194] border border-[#bae6fd] font-bold text-xs shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                          title="Generate Mobile Transfer QR Code"
                        >
                          <QrCode className="w-3.5 h-3.5 text-[#0284c7]" />
                          <span>QR Pass</span>
                        </button>
                      )}

                      {onDeletePatient && (
                        <button
                          type="button"
                          onClick={() => onDeletePatient(patient)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#94a3b8] hover:text-[#dc2626] bg-[#f8fafc] hover:bg-[#fee2e2] active:scale-95 border border-[#e2e8f0] hover:border-[#fca5a5] shadow-2xs transition-all cursor-pointer shrink-0"
                          title="Safely Delete Maternal Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table & Feed Footer */}
      <div className="bg-[#f8fafc] px-3 sm:px-4 py-3 border-t border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#64748b]">
        <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
          <span>
            {patients.length === 0 ? (
              'Showing 0 records'
            ) : (
              <>
                Showing <strong>{startIndex} - {endIndex}</strong> of {patients.length} records
              </>
            )}
          </span>
          <span className="hidden sm:inline text-[#cbd5e1]">•</span>
          <span className="text-[#047857] font-semibold flex items-center gap-1 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#047857]" />
            Encrypted on Tablet
          </span>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-1.5 flex-wrap">
          {/* Page size selector */}
          <div className="flex items-center gap-1 text-xs text-[#64748b] mr-1">
            <span>Per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-[#cbd5e1] text-[#0f172a] rounded px-1.5 py-1 text-xs font-semibold focus:outline-hidden focus:border-[#006194] cursor-pointer"
            >
              <option value={8}>8</option>
              <option value={16}>16</option>
              <option value={24}>24</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            {/* Previous Page Button */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-[#cbd5e1] rounded-lg bg-white text-[#334155] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f8fafc] cursor-pointer transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Dynamic Page Numbers */}
            <div className="flex items-center gap-1">
              {getPageNumbers().map((item, idx) => {
                if (item === '...') {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-1 text-[#94a3b8] font-bold text-xs">
                      ...
                    </span>
                  );
                }
                const pageNum = Number(item);
                const isCurrent = pageNum === currentPage;
                return (
                  <button
                    key={`page-${pageNum}`}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-[#006194] text-white font-bold shadow-2xs'
                        : 'bg-white hover:bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1] font-medium'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            {/* Next Page Button */}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-[#cbd5e1] rounded-lg bg-white text-[#334155] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f8fafc] cursor-pointer transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
