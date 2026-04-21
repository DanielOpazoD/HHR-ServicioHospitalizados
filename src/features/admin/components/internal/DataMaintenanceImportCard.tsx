import React from 'react';
import { Upload } from 'lucide-react';

interface DataMaintenanceImportCardProps {
  onOpenImport: () => void;
}

export const DataMaintenanceImportCard: React.FC<DataMaintenanceImportCardProps> = ({
  onOpenImport,
}) => (
  <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
      <Upload className="text-indigo-600" size={20} />
    </div>
    <h3 className="mb-1 text-base font-bold text-slate-800">Importar Respaldo Mensual</h3>
    <p className="mb-6 text-[11px] leading-relaxed text-slate-500">
      Carga un archivo de respaldo generado anteriormente para restaurar los datos de un mes
      específico.
    </p>

    <div className="mt-auto">
      <button
        onClick={onOpenImport}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 font-bold text-white shadow-lg shadow-slate-200 transition-all hover:scale-[1.02] hover:bg-slate-800 active:scale-95"
      >
        <Upload size={20} />
        Seleccionar Archivo
      </button>
    </div>
  </div>
);
