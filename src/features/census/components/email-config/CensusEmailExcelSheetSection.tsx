import React from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { ModalSection } from '@/components/shared/BaseModal';
import type { CensusEmailExcelSheetConfig } from '@/hooks/controllers/censusExcelSheetController';

interface CensusEmailExcelSheetSectionProps {
  config: CensusEmailExcelSheetConfig;
  onConfigChange: (nextConfig: CensusEmailExcelSheetConfig) => void;
}

export const CensusEmailExcelSheetSection: React.FC<CensusEmailExcelSheetSectionProps> = ({
  config,
  onConfigChange,
}) => {
  const updateConfig = <K extends keyof CensusEmailExcelSheetConfig>(
    key: K,
    value: CensusEmailExcelSheetConfig[K]
  ) => {
    onConfigChange({
      ...config,
      [key]: value,
    });
  };

  return (
    <ModalSection
      title="Configuración de Excel"
      icon={<FileSpreadsheet size={16} className="text-emerald-600" />}
      variant="success"
    >
      <div className="space-y-3">
        <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 cursor-pointer hover:border-emerald-300 transition-colors">
          <input
            type="checkbox"
            checked={config.includeEndOfDay2359Sheet}
            onChange={event => updateConfig('includeEndOfDay2359Sheet', event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-xs text-slate-700">
            Incluir hoja del día actual con corte a las <span className="font-semibold">23:59</span>
            .
          </span>
        </label>

        <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 cursor-pointer hover:border-blue-300 transition-colors">
          <input
            type="checkbox"
            checked={config.includeCurrentTimeSheet}
            onChange={event => updateConfig('includeCurrentTimeSheet', event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs text-slate-700">
            Incluir hoja adicional del día actual con la{' '}
            <span className="font-semibold">hora actual</span>.
          </span>
        </label>

        <p className="text-[11px] text-slate-500">
          Si activas ambas opciones, se enviarán dos hojas del mismo día con cortes horarios
          distintos.
        </p>
      </div>
    </ModalSection>
  );
};
