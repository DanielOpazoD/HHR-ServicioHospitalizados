import React from 'react';
import type { PatientData } from '@/features/census/contracts/censusPatientContracts';
import type { IeehData } from '@/types/domain/movements';
import type { DischargeFormData } from '@/services/pdf/ieehPdfService';
import { useIEEHForm } from '@/features/census/hooks/useIEEHForm';
import {
  BinaryTextSection,
  CondicionEgresoSection,
  DiagnosticoPrincipalSection,
  IEEHDialogFooter,
  IEEHDialogHeader,
  MedicoTratanteSection,
} from './IEEHFormDialogSections';

interface IEEHFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientData;
  baseDischargeData: DischargeFormData;
  savedIeehData?: IeehData;
  onSaveData?: (data: IeehData) => void;
}

export const IEEHFormDialog: React.FC<IEEHFormDialogProps> = props => {
  const {
    state: {
      diagnostico,
      cie10Code,
      cie10Display,
      searchResults,
      isSearching,
      isAISearching,
      showResults,
      condicionEgreso,
      tieneIntervencion,
      intervencionDescrip,
      tieneProcedimiento,
      procedimientoDescrip,
      tratanteAp1,
      tratanteAp2,
      tratanteNombre,
      tratanteRut,
      isGenerating,
      error,
    },
    actions: {
      setCondicionEgreso,
      setTieneIntervencion,
      setIntervencionDescrip,
      setTieneProcedimiento,
      setProcedimientoDescrip,
      setTratanteAp1,
      setTratanteAp2,
      setTratanteNombre,
      setTratanteRut,
      setShowResults,
      handleDiagnosticoChange,
      handleAISearch,
      selectCIE10,
      handleGenerate,
    },
  } = useIEEHForm(props);

  const { isOpen, onClose, patient } = props;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        <IEEHDialogHeader patientName={patient.patientName || 'Paciente'} onClose={onClose} />

        <div className="px-6 py-4 space-y-5">
          <DiagnosticoPrincipalSection
            diagnostico={diagnostico}
            cie10Code={cie10Code}
            cie10Display={cie10Display}
            searchResults={searchResults}
            isSearching={isSearching}
            isAISearching={isAISearching}
            showResults={showResults}
            setShowResults={setShowResults}
            handleDiagnosticoChange={handleDiagnosticoChange}
            handleAISearch={handleAISearch}
            selectCIE10={selectCIE10}
          />

          <CondicionEgresoSection
            condicionEgreso={condicionEgreso}
            setCondicionEgreso={setCondicionEgreso}
          />

          <BinaryTextSection
            legendLabel="Intervención Quirúrgica"
            name="intervencion"
            enabled={tieneIntervencion === true}
            placeholder="Descripción de la intervención quirúrgica..."
            value={intervencionDescrip}
            onEnable={() => setTieneIntervencion(true)}
            onDisable={() => {
              setTieneIntervencion(false);
              setIntervencionDescrip('');
            }}
            onChange={setIntervencionDescrip}
          />

          <BinaryTextSection
            legendLabel="Procedimiento"
            name="procedimiento"
            enabled={tieneProcedimiento === true}
            placeholder="Descripción del procedimiento..."
            value={procedimientoDescrip}
            onEnable={() => setTieneProcedimiento(true)}
            onDisable={() => {
              setTieneProcedimiento(false);
              setProcedimientoDescrip('');
            }}
            onChange={setProcedimientoDescrip}
          />

          <MedicoTratanteSection
            tratanteNombre={tratanteNombre}
            tratanteAp1={tratanteAp1}
            tratanteAp2={tratanteAp2}
            tratanteRut={tratanteRut}
            setTratanteNombre={setTratanteNombre}
            setTratanteAp1={setTratanteAp1}
            setTratanteAp2={setTratanteAp2}
            setTratanteRut={setTratanteRut}
          />

          {/* Error */}
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <IEEHDialogFooter
          isGenerating={isGenerating}
          onClose={onClose}
          onGenerate={handleGenerate}
        />
      </div>
    </div>
  );
};
