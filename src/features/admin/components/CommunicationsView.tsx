import React, { useState } from 'react';
import { BellRing, MessageSquare } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import { AccessRestricted } from './components/AccessRestricted';
import { ReminderAdminView } from '@/features/reminders/components/admin/ReminderAdminView';
import { WhatsAppIntegrationView } from '@/features/whatsapp/components/WhatsAppIntegrationView';

type CommunicationsTab = 'REMINDERS' | 'WHATSAPP';

// Communications view — admin-only page grouping staff-facing communications:
//   - "Avisos al personal" (Reminders)   ← was REMINDERS menu item
//   - "WhatsApp"           (integration) ← was WHATSAPP menu item
// REMINDERS and WHATSAPP module slots remain accessible via direct URL as fallback.
export const CommunicationsView: React.FC = () => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<CommunicationsTab>('REMINDERS');

  if (role !== 'admin') {
    return <AccessRestricted />;
  }

  const tabs: Array<{
    id: CommunicationsTab;
    label: string;
    icon: typeof BellRing;
    color: string;
  }> = [
    { id: 'REMINDERS', label: 'Avisos al personal', icon: BellRing, color: 'text-amber-400' },
    { id: 'WHATSAPP', label: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-400' },
  ];

  return (
    <div className="animate-fade-in font-sans pb-16">
      <div className="bg-white border-b border-slate-200 px-6 py-3 shadow-sm sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 pr-4 border-r border-slate-200">
            <MessageSquare size={16} className="text-slate-500" />
            <h1 className="text-sm font-bold text-slate-800">Comunicación</h1>
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
        {activeTab === 'REMINDERS' && <ReminderAdminView />}
        {activeTab === 'WHATSAPP' && <WhatsAppIntegrationView />}
      </div>
    </div>
  );
};
