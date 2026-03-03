import React, { useState } from 'react';
import { useAuditData } from '@/hooks/useAuditData';
import { AuditHeader } from './components/audit/AuditHeader';
import { AuditStatsDashboard } from './components/audit/AuditStatsDashboard';
import { AuditFilters } from './components/audit/AuditFilters';
import { AuditTable } from './components/audit/AuditTable';
import { AccessRestricted } from './components/AccessRestricted';
import { AuditSectionTabs } from './components/audit/AuditSectionTabs';
import { AuditDynamicPanels } from './components/audit/AuditDynamicPanels';
import { isAdministratorEmail } from '@/constants/identities';
import { auth } from '@/firebaseConfig';
import { useAuditExport } from './hooks/useAuditExport';
import { useAuditConsolidation } from './hooks/useAuditConsolidation';
import { AUDIT_CLINICAL_SECTIONS, AUDIT_SYSTEM_SECTIONS } from '@/services/admin/auditViewConfig';
import { isAuditTableSection } from '@/services/admin/auditMetrics';
import {
  canAccessAuditSensitivePanels,
  canAccessAuditView,
  canExportAuditData,
} from '@/services/admin/auditAccessPolicy';
import { useAuth } from '@/context/AuthContext';

export const AuditView: React.FC = () => {
  const { role } = useAuth();

  if (!canAccessAuditView(role)) {
    return <AccessRestricted />;
  }

  // Use extracted hook for all audit data management
  const {
    logs,
    filteredLogs,
    paginatedLogs,
    stats,
    loading,
    filters,
    setSearchTerm,
    setFilterAction,
    setStartDate,
    setEndDate,
    setActiveSection,
    setCompactView,
    setGroupedView,
    expandedRows,
    toggleRow,
    fetchLogs,
    sections,
    currentPage,
    totalPages,
    setCurrentPage,
    ITEMS_PER_PAGE,
  } = useAuditData();

  const { searchTerm, filterAction, startDate, endDate, activeSection, compactView, groupedView } =
    filters;

  // Export and dialog state
  const [, setShowComplianceInfo] = useState(false);

  // Admin check
  const userEmail = auth.currentUser?.email;
  const isAdmin = isAdministratorEmail(userEmail);
  const canSeeSensitivePanels = canAccessAuditSensitivePanels(role);
  const canExport = canExportAuditData(role);

  // Export hook
  const { isExporting, handleExcelExport, handlePdfExport } = useAuditExport({
    filteredLogs,
    stats,
    startDate,
    endDate,
  });

  const { isConsolidating: consolidating, handleConsolidate } = useAuditConsolidation({
    onConsolidated: fetchLogs,
  });

  return (
    <div className="space-y-6 animate-fade-in pb-24 font-sans max-w-[1400px] mx-auto">
      {/* Header */}
      <AuditHeader
        onShowCompliance={() => setShowComplianceInfo(true)}
        onExport={canExport ? handleExcelExport : () => {}}
        onRefresh={fetchLogs}
        onConsolidate={canSeeSensitivePanels ? handleConsolidate : undefined}
        isExporting={isExporting}
        isLoading={loading}
        isConsolidating={consolidating}
        hasLogs={canExport && filteredLogs.length > 0}
        isAdmin={isAdmin && canSeeSensitivePanels}
      />

      {/* Dashboards */}
      <AuditStatsDashboard stats={stats} logs={logs} />

      {/* Navigation Tabs - Categorized */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <AuditSectionTabs
          sections={AUDIT_CLINICAL_SECTIONS}
          sectionConfig={sections}
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          variant="clinical"
        />
        <AuditSectionTabs
          sections={AUDIT_SYSTEM_SECTIONS.filter(
            key => canSeeSensitivePanels || key === 'SESSIONS'
          )}
          sectionConfig={sections}
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          variant="system"
        />
      </div>

      {/* Filters */}
      <AuditFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterAction={filterAction}
        onFilterActionChange={setFilterAction}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
      />

      <AuditDynamicPanels
        activeSection={activeSection}
        logs={logs}
        canSeeSensitivePanels={canSeeSensitivePanels}
      />

      {/* Main Data Table */}
      {isAuditTableSection(activeSection) && (
        <AuditTable
          filteredLogs={filteredLogs}
          paginatedLogs={paginatedLogs}
          loading={loading}
          compactView={compactView}
          setCompactView={setCompactView}
          groupedView={groupedView}
          setGroupedView={setGroupedView}
          expandedRows={expandedRows}
          toggleRow={toggleRow}
          onPdfExport={handlePdfExport}
          onExcelExport={handleExcelExport}
          isExporting={isExporting}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      )}
    </div>
  );
};
