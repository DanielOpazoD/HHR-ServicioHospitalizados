export interface MMRADReportSections {
  title: string | null;
  technique: string | null;
  antecedentesClinicos: string | null;
  findings: string | null;
  impression: string | null;
}

const REPORT_STOP_PATTERNS = [
  /^SALUDA ATENTAMENTE$/i,
  /^IMPRIMIR$/i,
  /^SAVE PDF$/i,
  /^VAR\s+/i,
  /^FUNCTION\s+/i,
  /^HTML2CANVAS/i,
  /^WINDOW\.OPEN/i,
  /^DOC\./i,
  /^\}$/i,
];

const normalizeWhitespace = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const findTitle = (normalized: string): string | null => {
  const firstLine = normalized
    .split('\n')
    .map(line => line.trim())
    .find(Boolean);
  if (!firstLine) return null;
  const upper = firstLine.toUpperCase();
  return upper.includes('TOMOGRAF') || upper.includes('ESCANER') ? firstLine : null;
};

const shouldStopReportSection = (line: string): boolean =>
  REPORT_STOP_PATTERNS.some(pattern => pattern.test(line));

export const parseMMRADReportSections = (html: string): MMRADReportSections | null => {
  const normalized = normalizeWhitespace(html);
  if (!normalized) return null;

  const lines = normalized
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const sections = new Map<string, string[]>();
  const sectionLabels = new Set(['TECNICA', 'ANTECEDENTES CLINICOS', 'HALLAZGOS', 'IMPRESION']);
  let currentSection: string | null = null;

  for (const line of lines) {
    const sectionKey = line.replace(/:$/, '').toUpperCase();
    if (sectionLabels.has(sectionKey)) {
      currentSection = sectionKey;
      if (!sections.has(sectionKey)) {
        sections.set(sectionKey, []);
      }
      continue;
    }

    if (currentSection) {
      if (shouldStopReportSection(line)) {
        currentSection = null;
        continue;
      }
      sections.get(currentSection)?.push(line);
    }
  }

  const title = findTitle(normalized);
  const technique = sections.get('TECNICA')?.join('\n') || null;
  const antecedentesClinicos = sections.get('ANTECEDENTES CLINICOS')?.join('\n') || null;
  const findings = sections.get('HALLAZGOS')?.join('\n') || null;
  const impression = sections.get('IMPRESION')?.join('\n') || null;

  if (!title && !findings && !impression) {
    return null;
  }

  return {
    title,
    technique,
    antecedentesClinicos,
    findings,
    impression,
  };
};

export const buildMMRADReportClipboardText = (
  report: Pick<MMRADReportSections, 'findings' | 'impression'>
): string | null => {
  const toContinuousParagraph = (value: string): string => value.replace(/\s*\n\s*/g, ' ').trim();

  const sections = [
    report.findings ? `HALLAZGOS:\n${toContinuousParagraph(report.findings)}` : null,
    report.impression ? `IMPRESION:\n${toContinuousParagraph(report.impression)}` : null,
  ].filter(Boolean);

  return sections.length > 0 ? sections.join('\n\n') : null;
};

const toPrintableBlock = (label: string, value: string | null): string =>
  value
    ? `<section style="margin-bottom:24px;"><h2 style="margin:0 0 10px;font-size:18px;font-weight:700;">${label}</h2><div style="white-space:pre-wrap;font-size:16px;line-height:1.5;">${value}</div></section>`
    : '';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const buildMMRADReportPrintHtml = (
  examName: string,
  examDate: string,
  report: MMRADReportSections
): string => {
  const safeTitle = escapeHtml(report.title || examName || 'Informe radiologico');
  const safeDate = examDate
    ? `<p style="margin:0 0 20px;color:#475569;">Fecha: ${escapeHtml(examDate)}</p>`
    : '';

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
  </head>
  <body style="font-family: Arial, Helvetica, sans-serif; color:#111827; margin:32px;">
    <main>
      <h1 style="margin:0 0 12px;font-size:28px;font-weight:800;">${safeTitle}</h1>
      ${safeDate}
      ${toPrintableBlock('TECNICA', report.technique ? escapeHtml(report.technique) : null)}
      ${toPrintableBlock(
        'ANTECEDENTES CLINICOS',
        report.antecedentesClinicos ? escapeHtml(report.antecedentesClinicos) : null
      )}
      ${toPrintableBlock('HALLAZGOS', report.findings ? escapeHtml(report.findings) : null)}
      ${toPrintableBlock('IMPRESION', report.impression ? escapeHtml(report.impression) : null)}
    </main>
  </body>
</html>`;
};
