import React from 'react';
import { AuditSection, AuditLogEntry } from '@/types/audit';
import { ExportKeysPanel } from './ExportKeysPanel';
import { AuditTimeline } from './AuditTimeline';
import { ConsolidationManager } from './ConsolidationManager';
import { CensusAccessManager } from '@/features/admin/components/CensusAccessManager';

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

  if (activeSection === 'ACCESS_CONTROL' && canSeeSensitivePanels) {
    return <CensusAccessManager />;
  }

  return null;
};
