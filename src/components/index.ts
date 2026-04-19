/**
 * Components Index
 * Centralized exports for all UI components
 *
 * Usage: import { Navbar, DateStrip, PatientRow } from './components';
 */

// ============================================================
// ERROR HANDLING (shared/)
// ============================================================
export { GlobalErrorBoundary } from './shared/GlobalErrorBoundary';
export { SectionErrorBoundary } from './shared/SectionErrorBoundary';
export { SyncWatcher } from './shared/SyncWatcher';
export { BaseModal, ModalSection } from './shared/BaseModal';
export type { BaseModalProps, ModalSectionProps } from './shared/BaseModal';

// ============================================================
// LAYOUT COMPONENTS (layout/)
// ============================================================
export { Navbar } from './layout/Navbar';
export { DateStrip } from './layout/DateStrip';
export { SummaryCard } from './layout/SummaryCard';
export { default as StorageStatusBadge } from './layout/StorageStatusBadge';
export { BookmarkBar } from './bookmarks/BookmarkBar';
export type { ModuleType } from '@/constants/navigationConfig';

// ============================================================
export { TestAgent } from './debug/TestAgent';

// ============================================================
// DEVICE SELECTOR
// ============================================================
export { DeviceSelector } from './DeviceSelector';

// ============================================================
// MODALS
// ============================================================
export { MoveCopyModal } from './modals/actions/MoveCopyModal';
export { DischargeModal } from './modals/actions/DischargeModal';
export { TransferModal } from './modals/actions/TransferModal';
export { BedManagerModal } from './modals/BedManagerModal';
export { DemographicsModal } from './modals/DemographicsModal';
export { NurseManagerModal } from './modals/NurseManagerModal';
export { TensManagerModal } from './modals/TensManagerModal';

// ============================================================
// UI PRIMITIVES
// ============================================================
export { DebouncedInput } from './ui/DebouncedInput';
export { SyncStatusIndicator } from './ui/SyncStatusIndicator';
