/**
 * UserMenu - User profile dropdown component
 * Extracted from Navbar.tsx for better maintainability.
 */

import React from 'react';
import { LogOut } from 'lucide-react';
import { UserRole } from '@/hooks/useAuthState';
import type { AuthContextType } from '@/context/AuthContext';
import { getRoleDisplayLabel } from '@/shared/access/operationalAccessPolicy';
import { useDropdownMenu } from '@/hooks/useDropdownMenu';

interface UserMenuProps {
  userEmail: string;
  role: UserRole;
  isFirebaseConnected?: boolean;
  remoteSyncStatus?: AuthContextType['remoteSyncStatus'];
  onLogout: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  userEmail,
  role,
  isFirebaseConnected = false,
  remoteSyncStatus,
  onLogout,
}) => {
  const { isOpen, menuRef, toggle, close } = useDropdownMenu();
  const roleLabel = getRoleDisplayLabel(role);
  const connectionLabel =
    remoteSyncStatus === 'local_only'
      ? 'Local'
      : remoteSyncStatus === 'bootstrapping'
        ? 'Conectando'
        : isFirebaseConnected
          ? 'Online'
          : 'Offline';
  const isRemoteReady = remoteSyncStatus ? remoteSyncStatus === 'ready' : isFirebaseConnected;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={toggle}
        className="relative w-9 h-9 rounded-full bg-white/[0.08] backdrop-blur-sm border border-white/[0.12] flex items-center justify-center text-white/90 font-bold text-sm uppercase shadow-glass transition-transform active:scale-90"
        title={userEmail}
        aria-label={`Usuario ${userEmail}. Rol ${roleLabel}. Firebase ${connectionLabel}`}
        data-testid="authenticated-user-menu-button"
      >
        {userEmail.charAt(0)}
        <span
          className={`absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border border-[#0a1628] ${isRemoteReady ? 'bg-emerald-400' : 'bg-rose-400'}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-200/80 ring-1 ring-black/[0.04] z-50 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-100">
            <p className="text-[10px] font-medium text-slate-400 truncate">{userEmail}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[10px] font-semibold text-slate-600">{roleLabel}</span>
              <span className="flex items-center gap-1 text-[9px] font-medium text-slate-400">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isRemoteReady ? 'bg-emerald-500' : 'bg-rose-500'}`}
                />
                {connectionLabel}
              </span>
            </div>
          </div>
          <div className="p-1">
            <button
              onClick={() => {
                onLogout();
                close();
              }}
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={12} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
