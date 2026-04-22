import React from 'react';
import { AuditSection } from '@/types/auditActionTypes';
import { AuditLogEntry } from '@/types/auditLogTypes';
import { ExportKeysPanel } from './ExportKeysPanel';
import { AuditTimeline } from './AuditTimeline';
import { ConsolidationManager } from './ConsolidationManager';

interface AuditDynamicPanelsProps {
  activeSection: AuditSection;
  logs: AuditLogEntry[];
  canSeeSensitivePanels: boolean;
}

export const AuditDynamicPanels: React.FC<AuditDynamicPanelsProps> = ({
  activeSection,
  logs,
  canSeeSensitivePanels,
}) => {
  if (activeSection === 'EXPORT_KEYS' && canSeeSensitivePanels) {
    return <ExportKeysPanel />;
  }

  if (activeSection === 'TIMELINE') {
    return <AuditTimeline logs={logs} />;
  }

  if (activeSection === 'MAINTENANCE' && canSeeSensitivePanels) {
    return (
      <div className="space-y-6">
        <ConsolidationManager />
      </div>
    );
  }

  return null;
};
