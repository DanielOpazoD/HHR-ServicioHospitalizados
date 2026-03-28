/**
 * useAuditData Hook
 *
 * Extracted from AuditView.tsx to manage audit log state, filtering, grouping, and pagination.
 * This improves separation of concerns and testability.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AuditAction,
  AuditLogEntry,
  GroupedAuditLogEntry,
  AuditSection,
  WorkerFilterParams,
  AuditStats,
} from '@/types/audit';
import { useAuditWorker } from './useAuditWorker';
import { AUDIT_ACTION_LABELS, CRITICAL_ACTIONS } from '@/services/admin/auditConstants';
import { executeFetchAuditLogs } from '@/application/audit/fetchAuditLogsUseCase';
import {
  buildDefaultAuditStats,
  resolveAuditLogsFallback,
  shouldResetAuditPagination,
} from '@/hooks/controllers/auditDataPolicyController';
import {
  AUDIT_ITEMS_PER_PAGE,
  AUDIT_SECTIONS,
  type AuditSectionConfig,
} from '@/services/admin/auditViewConfig';
import { auditDataLogger } from '@/hooks/hookLoggers';

export { AUDIT_SECTIONS } from '@/services/admin/auditViewConfig';

export type SectionConfig = AuditSectionConfig;

export interface AuditFiltersState {
  searchTerm: string;
  filterAction: AuditAction | 'ALL';
  startDate: string;
  endDate: string;
  activeSection: AuditSection;
  compactView: boolean;
  groupedView: boolean;
}

export interface UseAuditDataReturn {
  // Data
  logs: AuditLogEntry[];
  filteredLogs: AuditLogEntry[];
  displayLogs: (AuditLogEntry | GroupedAuditLogEntry)[];
  paginatedLogs: (AuditLogEntry | GroupedAuditLogEntry)[];
  stats: AuditStats;

  // Loading state
  loading: boolean;
  isProcessing: boolean;

  // Filters
  filters: AuditFiltersState;
  setSearchTerm: (value: string) => void;
  setFilterAction: (value: AuditAction | 'ALL') => void;
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
  setActiveSection: (value: AuditSection) => void;
  setCompactView: (value: boolean) => void;
  setGroupedView: (value: boolean) => void;

  // Pagination
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;

  // Row expansion
  expandedRows: Set<string>;
  toggleRow: (id: string) => void;
  showMetadata: Set<string>;
  toggleMetadata: (id: string) => void;

  // Actions
  fetchLogs: () => Promise<void>;

  // Constants
  sections: Record<AuditSection, SectionConfig>;
  ITEMS_PER_PAGE: number;
}

export function useAuditData(): UseAuditDataReturn {
  const ITEMS_PER_PAGE = AUDIT_ITEMS_PER_PAGE;

  // Core data state
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<AuditAction | 'ALL'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeSection, setActiveSection] = useState<AuditSection>('ALL');
  const [compactView, setCompactView] = useState(false);
  const [groupedView, setGroupedView] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Row expansion state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showMetadata, setShowMetadata] = useState<Set<string>>(new Set());

  // Audit Worker integration
  const { results, isProcessing, processData } = useAuditWorker();

  // Fetch logs from service
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await executeFetchAuditLogs({ limit: 1000 });
      setLogs(resolveAuditLogsFallback(result.data));
      if (result.status === 'failed') {
        auditDataLogger.error('Failed to fetch audit logs', result.issues[0]?.message);
      }
    } catch (error) {
      auditDataLogger.error('Failed to fetch audit logs', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Process data whenever logs or filters change
  useEffect(() => {
    const sectionActions: Record<string, string[] | undefined> = {};
    Object.entries(AUDIT_SECTIONS).forEach(([key, config]) => {
      sectionActions[key] = config.actions;
    });

    const params: WorkerFilterParams = {
      searchTerm,
      filterAction,
      startDate,
      endDate,
      activeSection,
      sectionActions,
      groupedView,
    };

    processData(logs, params, AUDIT_ACTION_LABELS, CRITICAL_ACTIONS);
  }, [logs, searchTerm, filterAction, activeSection, startDate, endDate, groupedView, processData]);

  // Row toggle handlers
  const toggleRow = useCallback((id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  const toggleMetadata = useCallback((id: string) => {
    setShowMetadata(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  const { filteredLogs, displayLogs, stats: workerStats } = results;

  // Pagination
  const totalPages = Math.ceil(displayLogs.length / ITEMS_PER_PAGE);

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return displayLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [displayLogs, currentPage, ITEMS_PER_PAGE]);

  // Reset page when filters change
  useEffect(() => {
    if (
      shouldResetAuditPagination({
        searchTerm,
        filterAction,
        activeSection,
        startDate,
        endDate,
        groupedView,
      })
    ) {
      setCurrentPage(1);
    }
  }, [searchTerm, filterAction, activeSection, startDate, endDate, groupedView]);

  // Use stats from worker
  const stats = (workerStats || buildDefaultAuditStats()) as AuditStats;

  // Compose filters state object
  const filters: AuditFiltersState = {
    searchTerm,
    filterAction,
    startDate,
    endDate,
    activeSection,
    compactView,
    groupedView,
  };

  return {
    // Data
    logs,
    filteredLogs,
    displayLogs,
    paginatedLogs,
    stats,

    // Loading
    loading,
    isProcessing,

    // Filters
    filters,
    setSearchTerm,
    setFilterAction,
    setStartDate,
    setEndDate,
    setActiveSection,
    setCompactView,
    setGroupedView,

    // Pagination
    currentPage,
    totalPages,
    setCurrentPage,

    // Row expansion
    expandedRows,
    toggleRow,
    showMetadata,
    toggleMetadata,

    // Actions
    fetchLogs,

    // Constants
    sections: AUDIT_SECTIONS,
    ITEMS_PER_PAGE,
  };
}
