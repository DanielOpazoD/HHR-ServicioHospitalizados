/**
 * Transfer Management View
 * Main view for managing patient transfer requests
 */

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TransferTable } from './components/TransferTable';
import { TransferFormModal } from './components/TransferFormModal';
import { StatusChangeModal } from './components/StatusChangeModal';
import { ConfirmTransferModal } from './components/ConfirmTransferModal';
import { CancelTransferModal } from './components/CancelTransferModal';
import { useTransferManagementViewRuntime } from '../hooks/useTransferManagementViewRuntime';
import {
  buildTransferQuestionnairePatientData,
  buildTransferTableBindings,
} from './controllers/transferManagementViewController';

const TransferQuestionnaireModal = React.lazy(() =>
  import('./components/TransferQuestionnaireModal').then(module => ({
    default: module.TransferQuestionnaireModal,
  }))
);

const TransferDocumentPackageModal = React.lazy(() =>
  import('./components/TransferDocumentPackageModal').then(module => ({
    default: module.TransferDocumentPackageModal,
  }))
);

export const TransferManagementView: React.FC = () => {
  const {
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    showFinalizedTransfers,
    setShowFinalizedTransfers,
    monthLabels,
    transferManagement,
    viewStates,
    periodModel,
    selectedHospital,
  } = useTransferManagementViewRuntime();
  const {
    isLoading,
    error,
    setTransferStatus,
    updateTransfer,
    undoTransfer,
    archiveTransfer,
    deleteHistoryEntry,
    deleteTransfer,
    getHospitalizedPatients,
  } = transferManagement;
  const { modals, selectedTransfer, isGenerating, generatedDocs, patientDataForDocs, handlers } =
    viewStates;
  const { availableYears, filteredActiveCount, activeTransfers, finalizedTransfers } = periodModel;
  const tableActions = {
    setTransferStatus,
    updateTransfer,
    undoTransfer,
    archiveTransfer,
    deleteHistoryEntry,
    deleteTransfer,
  };
  const activeTableBindings = buildTransferTableBindings({
    transfers: activeTransfers,
    handlers,
    actions: tableActions,
  });
  const finalizedTableBindings = buildTransferTableBindings({
    transfers: finalizedTransfers,
    mode: 'finalized',
    handlers,
    actions: tableActions,
  });

  return (
    <div className="p-4 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Traslados</h1>
          <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full shadow-sm">
            {filteredActiveCount} activos
          </span>
        </div>
        <button
          onClick={handlers.handleNewRequest}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 text-sm font-bold shadow-lg shadow-blue-100 active:scale-95"
        >
          <span className="text-lg">+</span>
          Nueva Solicitud
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center gap-3 animate-in slide-in-from-top-2">
          <span className="font-bold">⚠️ Error:</span> {error}
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {availableYears.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                selectedYear === year
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-6 gap-1.5 md:grid-cols-12">
          {monthLabels.map((label, index) => {
            const monthValue = index + 1;
            return (
              <button
                key={label}
                onClick={() => setSelectedMonth(monthValue)}
                className={`rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all ${
                  selectedMonth === monthValue
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-visible">
        {isLoading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400 font-medium tracking-tight">Cargando solicitudes...</p>
          </div>
        ) : (
          <TransferTable {...activeTableBindings} />
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowFinalizedTransfers(prev => !prev)}
          className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-slate-50"
        >
          <div>
            <h2 className="text-lg font-bold text-slate-800">Gestión de Traslados Finalizados</h2>
            <p className="text-sm text-slate-500">
              Traslados efectivos y cancelados justificados del mes seleccionado
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {finalizedTransfers.length} finalizados
            </span>
            {showFinalizedTransfers ? (
              <ChevronDown size={18} className="text-slate-500" />
            ) : (
              <ChevronRight size={18} className="text-slate-500" />
            )}
          </div>
        </button>

        {showFinalizedTransfers && (
          <div className="border-t border-slate-100">
            {isLoading ? (
              <div className="text-center py-10 text-slate-400">
                Cargando traslados finalizados...
              </div>
            ) : (
              <TransferTable {...finalizedTableBindings} />
            )}
          </div>
        )}
      </div>

      {/* Modals Orchestration */}
      {modals.form && (
        <TransferFormModal
          transfer={selectedTransfer}
          patients={getHospitalizedPatients()}
          onClose={handlers.handleCloseFormModal}
          onSave={handlers.handleSave}
        />
      )}

      {modals.status && selectedTransfer && (
        <StatusChangeModal
          transfer={selectedTransfer}
          onClose={handlers.handleCloseStatusModal}
          onConfirm={handlers.handleConfirmStatusChange}
        />
      )}

      {modals.transfer && selectedTransfer && (
        <ConfirmTransferModal
          transfer={selectedTransfer}
          onClose={handlers.handleCloseTransferModal}
          onConfirm={handlers.handleConfirmTransfer}
        />
      )}

      {modals.cancel && selectedTransfer && (
        <CancelTransferModal
          transfer={selectedTransfer}
          onClose={handlers.handleCloseCancelModal}
          onConfirm={handlers.handleConfirmCancel}
        />
      )}

      {modals.questionnaire && selectedTransfer && (
        <React.Suspense fallback={null}>
          <TransferQuestionnaireModal
            isOpen={modals.questionnaire}
            hospital={selectedHospital!}
            patientData={buildTransferQuestionnairePatientData(selectedTransfer)}
            onClose={handlers.handleCloseQuestionnaire}
            initialResponses={selectedTransfer.questionnaireResponses}
            onComplete={handlers.handleQuestionnaireComplete}
          />
        </React.Suspense>
      )}

      {modals.package && selectedTransfer && patientDataForDocs && (
        <React.Suspense fallback={null}>
          <TransferDocumentPackageModal
            isOpen={modals.package}
            hospital={selectedHospital!}
            patientData={patientDataForDocs}
            documents={generatedDocs}
            onClose={handlers.handleClosePackageModal}
          />
        </React.Suspense>
      )}

      {/* Processing Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white px-10 py-8 rounded-[2rem] shadow-2xl flex flex-col items-center gap-5 border border-white">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <p className="font-black text-slate-800 text-lg tracking-tight">
                Preparando documentos
              </p>
              <p className="text-sm text-slate-400 font-medium">Esto puede tomar unos segundos</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferManagementView;
