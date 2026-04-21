import React, { useState } from 'react';
import { Database, FolderArchive, Users } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import { AccessRestricted } from './internal/AccessRestricted';
import { DataMaintenanceView } from './DataMaintenanceView';
import { PatientMasterView } from './PatientMasterView';
import { BackupFilesView } from '@/features/backup/public';

type DataTab = 'MAINTENANCE' | 'BACKUPS' | 'PATIENTS';

// Data view — admin-only page grouping all hospital data administration:
//   - "Mantenimiento" (JSON import/export) ← was "Mantenimiento de Datos" menu item
//   - "Respaldos"    (Drive backups)       ← was "Archivos" utility dropdown
//   - "Pacientes"    (master index)        ← was "Base de Pacientes" menu item
// The DATA_MAINTENANCE, BACKUP_FILES and PATIENT_MASTER_INDEX module slots remain
// accessible via direct URL as fallback for deep links.
export const DataView: React.FC = () => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<DataTab>('MAINTENANCE');

  if (role !== 'admin') {
    return <AccessRestricted />;
  }

  const tabs: Array<{
    id: DataTab;
    label: string;
    icon: typeof Database;
    color: string;
  }> = [
    { id: 'MAINTENANCE', label: 'Mantenimiento', icon: Database, color: 'text-emerald-400' },
    { id: 'BACKUPS', label: 'Respaldos', icon: FolderArchive, color: 'text-amber-400' },
    { id: 'PATIENTS', label: 'Base de pacientes', icon: Users, color: 'text-sky-400' },
  ];

  return (
    <div className="animate-fade-in font-sans pb-16">
      <div className="bg-white border-b border-slate-200 px-6 py-3 shadow-sm sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 pr-4 border-r border-slate-200">
            <Database size={16} className="text-slate-500" />
            <h1 className="text-sm font-bold text-slate-800">Datos</h1>
          </div>

          <div className="flex gap-1 flex-wrap">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg font-semibold text-xs transition-all flex items-center gap-1.5',
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  <Icon size={13} className={isActive ? '' : tab.color} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'MAINTENANCE' && <DataMaintenanceView />}
        {activeTab === 'BACKUPS' && <BackupFilesView backupType="handoff" />}
        {activeTab === 'PATIENTS' && <PatientMasterView />}
      </div>
    </div>
  );
};
