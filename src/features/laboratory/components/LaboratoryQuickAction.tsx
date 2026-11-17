import React from 'react';
import { FlaskConical } from 'lucide-react';
import { LabResultsViewerModal } from './LabResultsViewerModal';
import { checkSyslabConnection } from '@/services/laboratory/syslabService';
import {
  isSyslabExtensionAvailable,
  onSyslabExtensionReady,
  openInExtension,
} from '@/services/laboratory/syslabExtension';
import type { MedicalIndicationsPatientOption } from '@/shared/contracts/medicalIndications';
import { DATE_STRIP_QUICK_ACTION_BASE_CLASS } from '@/shared/ui/dateStripQuickActionStyles';

interface LaboratoryQuickActionProps {
  patients: MedicalIndicationsPatientOption[];
}

export const LaboratoryQuickAction: React.FC<LaboratoryQuickActionProps> = ({ patients }) => {
  const [isLabOpen, setIsLabOpen] = React.useState(false);
  const [connectionStatus, setConnectionStatus] = React.useState<
    'checking' | 'available' | 'unavailable'
  >('checking');
  const [connectionMessage, setConnectionMessage] = React.useState('Verificando conexión Syslab');
  const [extensionAvailable, setExtensionAvailable] = React.useState(
    () => isSyslabExtensionAvailable()
  );

  const labPatients = React.useMemo(
    () =>
      patients
        .filter(patient => patient.rut && patient.patientName)
        .map(patient => ({
          bedId: patient.bedId,
          label: patient.label,
          patientName: patient.patientName,
          rut: patient.rut,
          birthDate: patient.birthDate,
          diagnosis: patient.diagnosis,
        })),
    [patients]
  );

  // Detect extension arriving after React mount (content script race)
  React.useEffect(() => {
    return onSyslabExtensionReady(() => setExtensionAvailable(true));
  }, []);

  React.useEffect(() => {
    let active = true;

    if (labPatients.length === 0) {
      setConnectionStatus('unavailable');
      setConnectionMessage('No hay pacientes con RUT para consultar Syslab');
      return () => {
        active = false;
      };
    }

    // Extension bypasses the ngrok/proxy check entirely
    if (extensionAvailable) {
      setConnectionStatus('available');
      setConnectionMessage('Laboratorio via extensión Chrome (sin ngrok)');
      return () => {
        active = false;
      };
    }

    setConnectionStatus('checking');
    setConnectionMessage('Verificando conexión Syslab');
    void checkSyslabConnection().then(result => {
      if (!active) {
        return;
      }
      setConnectionStatus(result.available ? 'available' : 'unavailable');
      setConnectionMessage(
        result.available
          ? 'Laboratorio / Exámenes Syslab'
          : `Syslab no disponible: ${result.message}`
      );
    });

    return () => {
      active = false;
    };
  }, [labPatients.length, extensionAvailable]);

  const isDisabled = labPatients.length === 0 || connectionStatus !== 'available';

  const handleClick = () => {
    if (isDisabled) return;
    if (extensionAvailable) {
      openInExtension(
        labPatients.map(p => ({
          rut: p.rut ?? '',
          patientName: p.patientName ?? '',
          bedId: p.bedId,
          label: p.label,
        }))
      );
    } else {
      setIsLabOpen(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        data-testid="lab-quick-action"
        disabled={isDisabled}
        className={`${DATE_STRIP_QUICK_ACTION_BASE_CLASS} border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-default disabled:opacity-50`}
        title={connectionMessage}
        aria-disabled={isDisabled}
      >
        <FlaskConical size={13} />
        <span className="hidden sm:inline">Lab</span>
      </button>
      {labPatients.length > 0 && !extensionAvailable && (
        <LabResultsViewerModal
          isOpen={isLabOpen}
          onClose={() => setIsLabOpen(false)}
          patients={labPatients}
        />
      )}
    </>
  );
};
