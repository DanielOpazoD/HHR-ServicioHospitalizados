/**
 * UserMenu - User profile dropdown component
 * Extracted from Navbar.tsx for better maintainability.
 */

import React from 'react';
import { LogOut } from 'lucide-react';
import { UserRole } from '@/hooks/useAuthState';
import { getRoleDisplayLabel } from '@/shared/access/operationalAccessPolicy';
import { useDropdownMenu } from '@/hooks/useDropdownMenu';

interface UserMenuProps {
  userEmail: string;
  role: UserRole;
  isFirebaseConnected?: boolean;
  onLogout: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  userEmail,
  role,
  isFirebaseConnected = false,
  onLogout,
}) => {
  const { isOpen, menuRef, toggle, close } = useDropdownMenu();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={toggle}
        className="relative w-9 h-9 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white font-bold text-sm uppercase shadow-glass transition-transform active:scale-90"
        title={userEmail}
      >
        {userEmail.charAt(0)}
        <span
          className={`absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border border-medical-900 ${isFirebaseConnected ? 'bg-emerald-400' : 'bg-rose-400'}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-52 bg-white text-slate-800 rounded-lg shadow-lg border border-slate-200 z-50 overflow-hidden text-sm">
          <div className="p-3 border-b border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Usuario
            </p>
            <p className="mt-1 font-semibold break-words text-slate-800 text-sm leading-snug">
              {userEmail}
            </p>
            <p className="mt-1.5 text-xs text-slate-600">
              Rol: <span className="font-semibold text-slate-800">{getRoleDisplayLabel(role)}</span>
            </p>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              <span
                className={`h-2 w-2 rounded-full ${isFirebaseConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}
              />
              {isFirebaseConnected ? 'Conectado' : 'Sin conexión'}
            </div>
          </div>
          <div className="p-2">
            <button
              onClick={() => {
                onLogout();
                close();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] font-semibold text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
