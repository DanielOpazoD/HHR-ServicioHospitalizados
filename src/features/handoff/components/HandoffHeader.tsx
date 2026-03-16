import React from 'react';
import { MessageSquare, Stethoscope } from 'lucide-react';
import type { MedicalHandoffScope } from '@/types/medicalHandoff';
import { HandoffShiftSwitcher } from './HandoffShiftSwitcher';
import { MedicalShareActions } from './MedicalShareActions';

interface HandoffHeaderProps {
  isMedical: boolean;
  selectedShift: 'day' | 'night';
  setSelectedShift: (shift: 'day' | 'night') => void;
  readOnly: boolean;
  showMedicalShareActions?: boolean;
  medicalSignature?: {
    doctorName: string;
    signedAt: string;
  } | null;
  medicalHandoffSentAt?: string | null;
  onSendWhatsApp: () => void;
  onShareLink: (scope: MedicalHandoffScope) => void;
  extraAction?: React.ReactNode;
}

export const HandoffHeader: React.FC<HandoffHeaderProps> = ({
  isMedical,
  selectedShift,
  setSelectedShift,
  readOnly,
  showMedicalShareActions = true,
  medicalSignature,
  onSendWhatsApp,
  onShareLink,
  extraAction,
}) => {
  const title = isMedical ? 'Entrega de Turno' : 'Entrega de Turno Enfermería';
  const Icon = isMedical ? Stethoscope : MessageSquare;
  const headerColor = isMedical ? 'text-sky-600' : 'text-medical-600';

  return (
    <header className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-3 print:hidden">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <Icon size={24} className={headerColor} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {!isMedical && (
          <HandoffShiftSwitcher selectedShift={selectedShift} setSelectedShift={setSelectedShift} />
        )}
      </div>

      {extraAction && (
        <div className="flex items-center gap-2">
          {extraAction}
          <div className="w-px h-6 bg-slate-200 mx-2 hidden md:block" />
        </div>
      )}

      {isMedical && !readOnly && showMedicalShareActions && (
        <MedicalShareActions
          medicalSignature={medicalSignature}
          onSendWhatsApp={onSendWhatsApp}
          onShareLink={onShareLink}
        />
      )}
    </header>
  );
};
