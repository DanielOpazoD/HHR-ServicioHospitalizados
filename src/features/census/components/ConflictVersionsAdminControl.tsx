import React from 'react';
import { ClinicalConflictCenterControl } from '@/components/clinical-conflicts/ClinicalConflictCenterControl';
import type { DailyRecordConflictRecoveryPort } from '@/application/ports/dailyRecordConflictRecoveryPort';

interface ConflictVersionsAdminControlProps {
  date?: string;
  /** Injectable for tests/stories; defaults to the real port. */
  port?: DailyRecordConflictRecoveryPort;
}

/**
 * Subtle, admin-only census affordance to recover a daily-record version after a conflict/merge.
 * Renders nothing for non-admins. See docs/ADR_CONFLICT_VERSION_RECOVERY.md.
 */
export const ConflictVersionsAdminControl: React.FC<ConflictVersionsAdminControlProps> = ({
  date,
  port,
}) => (
  <ClinicalConflictCenterControl
    date={date}
    scope="census"
    port={port}
    buttonTestId="conflict-versions-button"
    className="self-center"
  />
);
