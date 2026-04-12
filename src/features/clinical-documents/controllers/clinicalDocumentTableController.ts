/**
 * clinicalDocumentTableController
 *
 * Pure logic for building HTML table markup to insert into
 * the clinical document rich-text editor.
 *
 * Tables are generated with inline styles so they survive
 * the paste sanitiser and render consistently in print.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TableInsertionConfig {
  /** Number of columns (1–10). */
  cols: number;
  /** Number of rows including header (2–20). */
  rows: number;
  /** Whether the first row is styled as a header. */
  hasHeader: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TABLE_MIN_COLS = 1;
export const TABLE_MAX_COLS = 10;
export const TABLE_MIN_ROWS = 2;
export const TABLE_MAX_ROWS = 20;

const CELL_STYLE = 'border:1px solid #cbd5e1;padding:4px 8px;vertical-align:top;font-size:12px';
const HEADER_CELL_STYLE =
  'border:1px solid #94a3b8;padding:4px 8px;background:#f1f5f9;font-weight:600;font-size:12px';
const TABLE_STYLE = 'border-collapse:collapse;width:100%;margin:8px 0;table-layout:auto';

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Builds an HTML `<table>` string ready to be inserted via `insertHTML`.
 *
 * @param config - Column/row counts and header flag.
 * @returns Complete `<table>` HTML string.
 */
export const buildClinicalDocumentTableHtml = (config: TableInsertionConfig): string => {
  const { cols, rows, hasHeader } = config;

  const clampedCols = Math.max(TABLE_MIN_COLS, Math.min(TABLE_MAX_COLS, cols));
  const clampedRows = Math.max(TABLE_MIN_ROWS, Math.min(TABLE_MAX_ROWS, rows));

  const lines: string[] = [`<table style="${TABLE_STYLE}">`];

  for (let r = 0; r < clampedRows; r++) {
    const isHeaderRow = hasHeader && r === 0;
    lines.push('  <tr>');
    for (let c = 0; c < clampedCols; c++) {
      const tag = isHeaderRow ? 'th' : 'td';
      const style = isHeaderRow ? HEADER_CELL_STYLE : CELL_STYLE;
      const placeholder = isHeaderRow ? `Col ${c + 1}` : '<br>';
      lines.push(`    <${tag} style="${style}">${placeholder}</${tag}>`);
    }
    lines.push('  </tr>');
  }

  lines.push('</table><p><br></p>');
  return lines.join('\n');
};

/**
 * Validates a table insertion config, returning an error message or null.
 */
export const validateTableConfig = (config: TableInsertionConfig): string | null => {
  if (config.cols < TABLE_MIN_COLS || config.cols > TABLE_MAX_COLS) {
    return `Columnas debe estar entre ${TABLE_MIN_COLS} y ${TABLE_MAX_COLS}`;
  }
  if (config.rows < TABLE_MIN_ROWS || config.rows > TABLE_MAX_ROWS) {
    return `Filas debe estar entre ${TABLE_MIN_ROWS} y ${TABLE_MAX_ROWS}`;
  }
  return null;
};
