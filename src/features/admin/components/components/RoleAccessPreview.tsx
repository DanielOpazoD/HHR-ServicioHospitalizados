import React from 'react';
import { ShieldCheck, Eye, PencilLine, FileText } from 'lucide-react';
import { resolveRoleAccess } from '@/shared/access/roleAccessMatrix';

interface RoleAccessPreviewProps {
  role: string;
}

export const RoleAccessPreview: React.FC<RoleAccessPreviewProps> = ({ role }) => {
  const access = resolveRoleAccess(role);

  return (
    <div className="bg-slate-950 text-white rounded-[1.75rem] p-5 shadow-xl">
      <div className="flex items-center gap-2.5 mb-4">
        <ShieldCheck size={18} className="text-cyan-300" />
        <h3 className="text-sm font-black uppercase tracking-[0.18em] text-cyan-100">
          Vista previa del rol
        </h3>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-black mb-1">
            Perfil
          </p>
          <p className="text-sm font-bold text-white">{access.label}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
            <div className="flex items-center gap-2 text-cyan-200 mb-2">
              <Eye size={14} />
              <span className="text-[10px] font-black uppercase tracking-[0.16em]">Módulos</span>
            </div>
            <p className="text-xs font-semibold text-slate-100 leading-snug">
              {access.modules.length > 0 ? access.modules.join(', ') : 'Sin módulos visibles'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
            <div className="flex items-center gap-2 text-emerald-200 mb-2">
              <PencilLine size={14} />
              <span className="text-[10px] font-black uppercase tracking-[0.16em]">Edición</span>
            </div>
            <p className="text-xs font-semibold text-slate-100 leading-snug">
              {access.canEdit.length > 0 ? access.canEdit.join(', ') : 'Solo lectura'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
            <div className="flex items-center gap-2 text-violet-200 mb-2">
              <FileText size={14} />
              <span className="text-[10px] font-black uppercase tracking-[0.16em]">
                Docs clínicos
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-100 leading-snug">
              {access.canEditClinicalDocumentDrafts
                ? 'Puede editar borradores'
                : access.canReadClinicalDocuments
                  ? 'Lectura solamente'
                  : 'Sin acceso'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-3 text-[11px] font-semibold text-cyan-50 leading-snug">
          Login general: {access.generalLoginAllowed ? 'habilitado' : 'no aplica'}.
          {access.specialistRestrictedMedicalAccess
            ? ' Este perfil usa handoff médico restringido por día actual.'
            : ' Este perfil usa el flujo estándar según su policy.'}
        </div>
      </div>
    </div>
  );
};
