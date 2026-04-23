import { BEDS } from '@/constants/beds';
import { formatDateToCL } from '@/utils/clinicalUtils';
import type { UseUIStateReturn } from '@/hooks/useUIState';
import type { AppContentRuntime } from '@/components/layout/app-content/useAppContentRuntime';
import type { MedicalIndicationsPatientOption } from '@/shared/contracts/medicalIndications';

const calculateDaysOfStay = (admissionDate?: string): string => {
  if (!admissionDate) return '';
  const parsed = new Date(formatDateToCL(admissionDate).split('-').reverse().join('-'));
  if (Number.isNaN(parsed.getTime())) return '';
  const now = new Date();
  const days = Math.ceil((now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24));
  return String(Math.max(days, 1));
};

export const buildMedicalIndicationsPatientOptions = (
  record: AppContentRuntime['record']
): MedicalIndicationsPatientOption[] => {
  const bedsById = new Map(BEDS.map(bed => [bed.id, bed]));

  return Object.entries(record?.beds || {})
    .filter(([, patient]) => Boolean(patient.patientName?.trim()))
    .map(([bedId, patient]) => ({
      bedId,
      label: `${bedsById.get(bedId)?.name || bedId} · ${patient.patientName}`,
      patientName: patient.patientName || '',
      rut: patient.rut || '',
      diagnosis: patient.cie10Description || patient.pathology || '',
      age: patient.age || '',
      birthDate: formatDateToCL(patient.birthDate || ''),
      allergies: '',
      admissionDate: formatDateToCL(patient.admissionDate || ''),
      daysOfStay: calculateDaysOfStay(patient.admissionDate),
      treatingDoctor: '',
    }));
};

export const canUseCensusDateStripActions = (
  currentModule: UseUIStateReturn['currentModule'],
  canUseCensusExports: boolean
) => currentModule === 'CENSUS' && canUseCensusExports;

export const resolveDateStripCensusActions = ({
  canUseCensusActions,
  censusEmail,
  exportManager,
  handleExportExcel,
}: {
  canUseCensusActions: boolean;
  censusEmail: AppContentRuntime['censusEmail'];
  exportManager: AppContentRuntime['exportManager'];
  handleExportExcel: AppContentRuntime['handleExportExcel'];
}) => ({
  onExportExcel: canUseCensusActions ? handleExportExcel : undefined,
  onConfigureEmail: canUseCensusActions ? () => censusEmail.setShowEmailConfig(true) : undefined,
  onSendEmail: canUseCensusActions
    ? async () => {
        await exportManager.handleBackupExcel();
        await censusEmail.sendEmail();
      }
    : undefined,
  onBackupExcel: canUseCensusActions ? exportManager.handleBackupExcel : undefined,
});

export const resolveBookmarkToggleAction = ({
  canShowBookmarkToggle,
  showBookmarksBar,
  setShowBookmarksBar,
}: {
  canShowBookmarkToggle: boolean;
  showBookmarksBar: boolean;
  setShowBookmarksBar: UseUIStateReturn['setShowBookmarksBar'];
}) => (canShowBookmarkToggle ? () => setShowBookmarksBar(!showBookmarksBar) : undefined);
