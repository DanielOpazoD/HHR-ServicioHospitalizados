import React from 'react';
import {
  BarChart3,
  LayoutGrid,
  LayoutList,
  List,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';

import { Breadcrumbs } from './BackupDriveItems';
import type { BackupType } from '@/hooks/backupFileBrowserContracts';

const BACKUP_TABS: ReadonlyArray<{ type: BackupType; label: string; icon: LucideIcon }> = [
  { type: 'handoff', label: 'Entregas', icon: MessageSquare },
  { type: 'census', label: 'Censo', icon: LayoutList },
  { type: 'cudyr', label: 'CUDYR', icon: BarChart3 },
];

interface BackupFilesToolbarProps {
  selectedBackupType: BackupType;
  path: string[];
  viewMode: 'grid' | 'list';
  setViewMode: (value: 'grid' | 'list') => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  isLoading: boolean;
  isRefetching: boolean;
  canRunMagicBackfill: boolean;
  isMagicBackfilling: boolean;
  magicLabel: string;
  onChangeBackupType: (type: BackupType) => void;
  onBreadcrumbNavigate: (index: number) => void;
  onMagicBackfill: () => void;
  onRefresh: () => void;
}

export const BackupFilesToolbar: React.FC<BackupFilesToolbarProps> = ({
  selectedBackupType,
  path,
  viewMode,
  setViewMode,
  searchQuery,
  setSearchQuery,
  isLoading,
  isRefetching,
  canRunMagicBackfill,
  isMagicBackfilling,
  magicLabel,
  onChangeBackupType,
  onBreadcrumbNavigate,
  onMagicBackfill,
  onRefresh,
}) => (
  <>
    <div className="flex gap-1 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
      {BACKUP_TABS.map(({ type, label, icon: Icon }) => (
        <button
          key={type}
          onClick={() => onChangeBackupType(type)}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200',
            selectedBackupType === type
              ? 'bg-medical-600 text-white shadow-lg shadow-medical-100'
              : 'text-slate-500 hover:bg-slate-50'
          )}
        >
          <Icon size={18} />
          {label}
        </button>
      ))}
    </div>

    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
      <Breadcrumbs path={path} onNavigate={onBreadcrumbNavigate} />

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onMagicBackfill}
          disabled={!canRunMagicBackfill || isMagicBackfilling}
          className={clsx(
            'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all',
            canRunMagicBackfill && !isMagicBackfilling
              ? 'text-violet-700 border-violet-200 bg-violet-50 hover:bg-violet-100'
              : 'text-slate-400 border-slate-200 bg-slate-50 cursor-not-allowed'
          )}
          title="Respaldo masivo de fechas faltantes del mes"
        >
          {isMagicBackfilling ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Wand2 size={14} />
          )}
          <span className="hidden lg:inline">{magicLabel}</span>
          <span className="lg:hidden">Mágico</span>
        </button>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar en esta carpeta..."
            className="pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-medical-500 w-full md:w-48 lg:w-64 font-medium"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
          />
        </div>

        <div className="flex bg-slate-50 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('grid')}
            className={clsx(
              'p-1.5 rounded-lg transition-all',
              viewMode === 'grid'
                ? 'bg-white shadow-sm text-medical-600'
                : 'text-slate-400 hover:text-slate-600'
            )}
            aria-label="Vista cuadrícula"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={clsx(
              'p-1.5 rounded-lg transition-all',
              viewMode === 'list'
                ? 'bg-white shadow-sm text-medical-600'
                : 'text-slate-400 hover:text-slate-600'
            )}
            aria-label="Vista lista"
          >
            <List size={18} />
          </button>
        </div>

        <button
          onClick={onRefresh}
          className={clsx(
            'p-2 rounded-xl border border-slate-100 transition-all active:scale-95',
            isRefetching ? 'text-medical-600 bg-medical-50' : 'text-slate-500 hover:bg-slate-50'
          )}
          title="Refrescar"
          disabled={isLoading}
        >
          <RefreshCw size={18} className={isRefetching ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  </>
);
