import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DailyBackupCalendarView } from '@/features/backup/components/components/DailyBackupCalendarView';
import type { BaseStoredFile } from '@/types/backupArtifacts';

vi.mock('@/utils/dateUtils', () => ({
  formatDateDDMMYYYY: (isoDate?: string) => {
    if (!isoDate) return '-';
    const [year, month, day] = isoDate.split('-');
    return `${day}-${month}-${year}`;
  },
  generateDateRange: () => ['2026-03-01', '2026-03-02'],
}));

vi.mock('lucide-react', () => ({
  Download: () => <span>Download</span>,
  Trash2: () => <span>Trash</span>,
  Calendar: () => <span>Calendar</span>,
  Eye: () => <span>Eye</span>,
  FileText: () => <span>File</span>,
}));

const file: BaseStoredFile = {
  name: '01-03-2026 - CUDYR.xlsx',
  fullPath: 'cudyr-backup/2026/03/01-03-2026 - CUDYR.xlsx',
  downloadUrl: 'https://example.com/cudyr.xlsx',
  date: '2026-03-01',
  createdAt: '2026-03-01T08:00:00.000Z',
  size: 1200,
};

describe('DailyBackupCalendarView', () => {
  it('labels the second column as backup, not generic file', () => {
    render(
      <DailyBackupCalendarView
        files={[file]}
        year={2026}
        monthName="Marzo"
        onDownload={vi.fn()}
        onView={vi.fn()}
        onDelete={vi.fn()}
        canDelete={false}
        formatSize={() => '1 KB'}
      />
    );

    expect(screen.getByText('Respaldo')).toBeInTheDocument();
    expect(screen.queryByText('Archivo')).not.toBeInTheDocument();
  });
});
