import React from 'react';
import { Target, Type, Undo2 } from 'lucide-react';
import { DocumentOption, DocumentTypeOption } from './types';
import { CustomMark } from '@/services/pdf/imagingRequestPdfService';

interface ImagingSidebarProps {
  documents: DocumentTypeOption[];
  selectedDoc: DocumentOption;
  setSelectedDoc: (doc: DocumentOption) => void;
  requestingPhysician: string;
  setRequestingPhysician: (val: string) => void;
  toolMode: 'cross' | 'text';
  setToolMode: (mode: 'cross' | 'text') => void;
  marks: CustomMark[];
  handleUndoMark: () => void;
}

export const ImagingSidebar: React.FC<ImagingSidebarProps> = ({
  documents,
  selectedDoc,
  setSelectedDoc,
  requestingPhysician,
  setRequestingPhysician,
  toolMode,
  setToolMode,
  marks,
  handleUndoMark,
}) => {
  return (
    <div className="w-80 flex-shrink-0 bg-white border border-slate-200 rounded-xl p-4 flex flex-col h-full overflow-y-auto">
      {/* Physician Input */}
      <div className="mb-4">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1 mb-2 block">
          Médico Solicitante
        </label>
        <input
          type="text"
          placeholder="Nombre y Apellido"
          value={requestingPhysician}
          onChange={e => setRequestingPhysician(e.target.value)}
          className="w-full text-sm p-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
        />
      </div>

      <div className="h-px bg-slate-100 my-2"></div>

      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 mb-2 mt-2">
        Documentos Disponibles
      </h3>

      <div className="flex flex-col gap-2 mb-4">
        {documents.map(doc => {
          const Icon = doc.icon;
          const isSelected = selectedDoc === doc.id;

          return (
            <button
              key={doc.id}
              onClick={() => !doc.disabled && setSelectedDoc(doc.id)}
              disabled={doc.disabled}
              className={`
                                w-full text-left p-3 rounded-lg border flex items-start gap-3 transition-all duration-200
                                ${
                                  doc.disabled
                                    ? 'opacity-50 cursor-not-allowed border-transparent bg-slate-50'
                                    : isSelected
                                      ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                                      : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                                }
                            `}
            >
              <div
                className={`p-2 rounded-lg mt-0.5 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}
              >
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`font-semibold text-sm ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}
                >
                  {doc.title}
                </p>
                <p
                  className={`text-xs mt-0.5 ${isSelected ? 'text-blue-700/80' : 'text-slate-500'}`}
                >
                  {doc.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-auto pt-4 border-t border-slate-100">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 flex flex-col gap-2">
          <h4 className="flex items-center gap-2 text-sm font-bold text-blue-900">
            <Target size={16} /> Marcado Interactivo
          </h4>
          <p className="text-xs text-blue-800 leading-relaxed">
            Haz clic en el formulario a la derecha para agregar cruces (
            <span className="font-bold">X</span>) o texto libre. Éstas se imprimirán en el documento
            final.
          </p>

          <div className="flex gap-2 mt-1 mb-1">
            <button
              onClick={() => setToolMode('cross')}
              className={`flex-1 py-1.5 px-2 rounded flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${toolMode === 'cross' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              <Target size={12} /> Cruz (X)
            </button>
            <button
              onClick={() => setToolMode('text')}
              className={`flex-1 py-1.5 px-2 rounded flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${toolMode === 'text' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              <Type size={12} /> Texto
            </button>
          </div>
          {marks.length > 0 && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs font-medium text-blue-700">{marks.length} marcas</span>
              <button
                onClick={handleUndoMark}
                className="text-xs bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors font-medium shadow-sm"
              >
                <Undo2 size={12} /> Deshacer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
