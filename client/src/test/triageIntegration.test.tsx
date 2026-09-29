import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TriageQueueTable } from '../components/TriageQueueTable';
import { PatientQRModal, buildCompletePatientVaultJSON } from '../components/Modals/PatientQRModal';
import type { Patient } from '../types/triage';

const mockPatients: Patient[] = [
  {
    id: '#1001',
    name: 'Anula Kumari',
    initials: 'AK',
    initialsColor: 'bg-rose-100 text-rose-700',
    age: 28,
    gravida: 2,
    para: 1,
    gestationalWeeks: 32,
    gestationalDays: 2,
    trimester: 3,
    bpSystolic: 142,
    bpDiastolic: 92,
    isBpAlert: true,
    bmi: 27.4,
    bmiCategory: 'Overweight',
    bmiStatusClass: 'warning',
    riskTier: 'high',
    riskTitle: 'HIGH RISK',
    riskSubtitle: 'Gestational HTN',
    pretermProbability: 62,
    alertHeadline: 'High Risk Alert',
    alertDetails: 'Elevated BP',
    featureWeights: [],
    village: 'Rampur North',
    locality: 'Sector 2',
    tenantId: 'clinic-4b-rampur',
    clinicId: 'clinic-4b-rampur',
    abhaId: '91-9988-7766-5544',
    edd: '2026-10-15',
    hb: 10.1,
    isHbAlert: false,
    fhr: '144 bpm',
    isFhrAlert: false,
    syncStatus: 'synced-p2p',
    assessedBy: 'Priya Sharma, PHM',
  },
  {
    id: '#1002',
    name: 'Sunethra Perera',
    initials: 'SP',
    initialsColor: 'bg-emerald-100 text-emerald-700',
    age: 24,
    gravida: 1,
    para: 0,
    gestationalWeeks: 18,
    gestationalDays: 0,
    trimester: 2,
    bpSystolic: 114,
    bpDiastolic: 72,
    isBpAlert: false,
    bmi: 21.8,
    bmiCategory: 'Normal',
    bmiStatusClass: 'normal',
    riskTier: 'low',
    riskTitle: 'LOW RISK',
    riskSubtitle: 'Routine Antenatal',
    pretermProbability: 6,
    alertHeadline: 'Routine',
    alertDetails: 'Normal pregnancy',
    featureWeights: [],
    village: 'Rampur South',
    locality: 'Sector 4',
    tenantId: 'clinic-4b-rampur',
    clinicId: 'clinic-4b-rampur',
    abhaId: '91-1122-3344-5566',
    edd: '2026-12-10',
    hb: 12.2,
    isHbAlert: false,
    fhr: '138 bpm',
    isFhrAlert: false,
    syncStatus: 'updated-local',
    assessedBy: 'Priya Sharma, PHM',
  },
];

describe('Frontend Integration - Clinical Triage Queue', () => {
  const onSelectPatientMock = vi.fn();
  const setActiveFilterMock = vi.fn();
  const onOpenQrMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders patient records and displays clinical risk badges correctly', () => {
    render(
      <TriageQueueTable
        patients={mockPatients}
        selectedPatientId=''
        onSelectPatient={onSelectPatientMock}
        activeFilter='all'
        setActiveFilter={setActiveFilterMock}
        onOpenQR={onOpenQrMock}
      />,
    );

    // Verify both mothers render
    expect(screen.getAllByText('Anula Kumari').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sunethra Perera').length).toBeGreaterThan(0);

    // Verify high-risk BP alert is visually flagged
    expect(screen.getAllByText('142/92').length).toBeGreaterThan(0);
  });

  it('triggers patient selection when clicking a row', () => {
    render(
      <TriageQueueTable
        patients={mockPatients}
        selectedPatientId=''
        onSelectPatient={onSelectPatientMock}
        activeFilter='all'
        setActiveFilter={setActiveFilterMock}
        onOpenQR={onOpenQrMock}
      />,
    );

    const anulaElement = screen.getAllByText('Anula Kumari')[0];
    fireEvent.click(anulaElement);
    expect(onSelectPatientMock).toHaveBeenCalledWith(mockPatients[0]);
  });

  it('opens Emergency QR Pass when QR action button is clicked', () => {
    render(
      <TriageQueueTable
        patients={mockPatients}
        selectedPatientId=''
        onSelectPatient={onSelectPatientMock}
        activeFilter='all'
        setActiveFilter={setActiveFilterMock}
        onOpenQR={onOpenQrMock}
      />,
    );

    const qrButtons = screen.getAllByTitle(/Generate Mobile Transfer QR Code/i);
    expect(qrButtons.length).toBeGreaterThan(0);
    fireEvent.click(qrButtons[0]);
    expect(onOpenQrMock).toHaveBeenCalledWith(mockPatients[0]);
  });

  it('changes active filter when clicking filter tabs', () => {
    render(
      <TriageQueueTable
        patients={mockPatients}
        selectedPatientId=''
        onSelectPatient={onSelectPatientMock}
        activeFilter='all'
        setActiveFilter={setActiveFilterMock}
        onOpenQR={onOpenQrMock}
      />,
    );

    const highFilterButton = screen.getByRole('button', { name: /High \(/i });
    fireEvent.click(highFilterButton);
    expect(setActiveFilterMock).toHaveBeenCalledWith('high');
  });

  describe('Raw JSON String Generation & Copying', () => {
    it('generates complete raw JSON data structure for patient vault', () => {
      const json = buildCompletePatientVaultJSON(mockPatients[0]);
      expect(json).toBeDefined();
      expect(json.id).toBe('#1001');
      expect(json.name).toBe('Anula Kumari');
      expect(json.app).toBe('MaternaVault');
      expect(json.gestationalWeeks).toBe(32);
    });

    it('renders Copy Raw JSON button and allows copying JSON in PatientQRModal', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(
        <PatientQRModal
          isOpen={true}
          onClose={vi.fn()}
          patient={mockPatients[0]}
        />
      );

      const copyButtons = screen.getAllByRole('button', { name: /Copy Raw JSON/i });
      expect(copyButtons.length).toBeGreaterThan(0);

      fireEvent.click(copyButtons[0]);
      expect(writeTextMock).toHaveBeenCalled();
      const copiedString = writeTextMock.mock.calls[0][0];
      expect(copiedString).toContain('"name": "Anula Kumari"');
      expect(copiedString).toContain('"app": "MaternaVault"');
    });
  });
});
