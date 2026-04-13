import { buildSyslabPdfUrl } from '@/services/laboratory/syslabService';
import type { LabResultRow, SyslabExamDetail, SyslabExamItem } from '@/types/domain/laboratory';

const CULTURE_PATTERN = /(CULTIVO CORRIENTE|ATB BACILOS|ANTIBIOGRAMA)/i;
const PCR_PANEL_PATTERN = /(PCR PANEL|PANEL RESPIRATORIO|PANEL VIRAL)/i;
const VIRAL_FINDING_PATTERN =
  /(INFLUENZA|PARAINFLUENZA|METAPNEUMOVIRUS|RHINOVIRUS|RINOVIRUS|SINCICIAL|ADENOVIRUS|SARS|COVID|CORONAVIRUS)/i;

const normalizePdfText = (text: string): string =>
  text
    .replace(/\u00a2/g, 'ó')
    .replace(/\u00b0/g, 'o')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const groupTextItemsIntoLines = (items: unknown[]): string[] => {
  const positioned = items
    .filter(
      (item): item is { str: string; transform: number[] | Float32Array } =>
        typeof item === 'object' &&
        item !== null &&
        'str' in item &&
        typeof item.str === 'string' &&
        item.str.trim().length > 0 &&
        'transform' in item &&
        (Array.isArray(item.transform) || item.transform instanceof Float32Array)
    )
    .map(item => ({
      text: item.str.trim(),
      x: item.transform[4] ?? 0,
      y: item.transform[5] ?? 0,
    }))
    .sort((a, b) => (Math.abs(b.y - a.y) > 1 ? b.y - a.y : a.x - b.x));

  const lines: Array<{ y: number; tokens: Array<{ text: string; x: number }> }> = [];

  for (const item of positioned) {
    const existing = lines.find(line => Math.abs(line.y - item.y) <= 2);
    if (existing) {
      existing.tokens.push({ text: item.text, x: item.x });
    } else {
      lines.push({ y: item.y, tokens: [{ text: item.text, x: item.x }] });
    }
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map(line =>
      line.tokens
        .sort((a, b) => a.x - b.x)
        .map(token => token.text)
        .join(' ')
        .replace(/\s*:\s*/g, ': ')
        .replace(/[ ]{2,}/g, ' ')
        .trim()
    )
    .filter(Boolean);
};

const extractPdfText = async (buffer: ArrayBuffer): Promise<string> => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.mjs',
    import.meta.url
  ).toString();

  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const lines = groupTextItemsIntoLines(
      textContent.items.filter(item => typeof item === 'object' && item !== null)
    );
    pages.push(lines.join('\n'));
  }

  return normalizePdfText(pages.join('\n\n'));
};

const parseColonPairs = (lines: string[]): Array<{ analysis: string; result: string }> => {
  const pairs: Array<{ analysis: string; result: string }> = [];
  for (const line of lines) {
    if (!line.includes(':')) continue;
    const [analysis, ...resultParts] = line.split(':');
    const normalizedAnalysis = analysis.replace(/\s+/g, ' ').trim();
    const normalizedResult = resultParts.join(':').replace(/\s+/g, ' ').trim();
    if (!normalizedAnalysis || !normalizedResult) continue;
    pairs.push({ analysis: normalizedAnalysis, result: normalizedResult });
  }
  return pairs;
};

export const parseMicrobiologyFindingsFromPdfText = (text: string): LabResultRow[] => {
  const normalized = normalizePdfText(text);
  const lines = normalized
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const headings = [
    { key: 'culture', pattern: /^CULTIVO CORRIENTE\b/i },
    { key: 'atb', pattern: /^ATB BACILOS GRAM\b/i },
    { key: 'antibiogram', pattern: /^ANTIBIOGRAMA EXTENDIDO\b/i },
    { key: 'pcr', pattern: /^PCR PANEL RESPIRATORIO\b/i },
  ] as const;
  const sectionLines: Record<(typeof headings)[number]['key'], string[]> = {
    culture: [],
    atb: [],
    antibiogram: [],
    pcr: [],
  };
  let activeSection: (typeof headings)[number]['key'] | null = null;

  for (const line of lines) {
    const matchedHeading = headings.find(heading => heading.pattern.test(line));
    if (matchedHeading) {
      activeSection = matchedHeading.key;
      continue;
    }

    if (
      /^(Director Tecnico|Resultado Via WEB|HOSPITAL DE HANGA ROA|Laboratorio Clínico|Nombre :|Rut\/Fic:|Fecha y Hora|Fecha de impresión|E X A M E N E S)/i.test(
        line
      )
    ) {
      activeSection = null;
      continue;
    }

    if (activeSection) {
      sectionLines[activeSection].push(line);
    }
  }

  const findings: LabResultRow[] = [];

  for (const entry of parseColonPairs(sectionLines.culture)) {
    if (/^cultivo$/i.test(entry.analysis)) {
      findings.push({
        section: 'MICROBIOLOGIA',
        analysis: 'Cultivo',
        result: entry.result,
        unit: '',
        refValue: '',
        qualitative: true,
      });
    }
  }

  for (const entry of [
    ...parseColonPairs(sectionLines.atb),
    ...parseColonPairs(sectionLines.antibiogram),
  ]) {
    findings.push({
      section: 'MICROBIOLOGIA',
      analysis: entry.analysis,
      result: entry.result,
      unit: '',
      refValue: '',
      qualitative: true,
    });
  }

  for (const entry of parseColonPairs(sectionLines.pcr)) {
    findings.push({
      section: 'MICROBIOLOGIA',
      analysis: entry.analysis,
      result: entry.result,
      unit: '',
      refValue: '',
      qualitative: true,
    });
  }

  return findings;
};

const shouldFetchMicrobiologyPdfFallback = (
  exam: SyslabExamItem,
  detail: SyslabExamDetail
): boolean => {
  const examNames = exam.exams.join(' ');
  if (!exam.link) return false;

  const needsCultureFallback =
    CULTURE_PATTERN.test(examNames) &&
    !detail.findings.some(finding =>
      /(CULTIVO|SUSCEPTIBLE|SUCEPTIBLE|RESISTENTE|AMIKACINA|CEFTAZIDIMA|IMIPENEM|ERTAPENEM|PIPERACILINA|CEFEPIME)/i.test(
        `${finding.analysis} ${finding.result}`
      )
    );

  const needsPcrFallback =
    PCR_PANEL_PATTERN.test(examNames) &&
    !detail.findings.some(finding =>
      VIRAL_FINDING_PATTERN.test(`${finding.analysis} ${finding.result}`)
    );

  return needsCultureFallback || needsPcrFallback;
};

const dedupeFindings = (findings: LabResultRow[]): LabResultRow[] => {
  const seen = new Set<string>();
  return findings.filter(finding => {
    const key = `${finding.section}::${finding.analysis}::${finding.result}`.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const enrichMicrobiologyDetailsFromPdf = async (
  details: SyslabExamDetail[],
  examList: SyslabExamItem[]
): Promise<SyslabExamDetail[]> => {
  const detailMap = new Map(details.map(detail => [detail.url, detail]));
  const enriched = await Promise.all(
    details.map(async detail => {
      const exam = examList.find(candidate => candidate.link === detail.url);
      if (!exam || !shouldFetchMicrobiologyPdfFallback(exam, detail)) {
        return detail;
      }

      try {
        const response = await fetch(buildSyslabPdfUrl(exam.link!));
        if (!response.ok) return detail;
        const buffer = await response.arrayBuffer();
        const text = await extractPdfText(buffer);
        const fallbackFindings = parseMicrobiologyFindingsFromPdfText(text);
        if (fallbackFindings.length === 0) return detail;

        return {
          ...detail,
          findings: dedupeFindings([...detail.findings, ...fallbackFindings]),
        };
      } catch {
        return detailMap.get(detail.url) || detail;
      }
    })
  );

  return enriched;
};
