import {
  convertPlainTextToClinicalDocumentHtml,
  normalizeClinicalDocumentContentForStorage,
  sanitizeClinicalDocumentHtml,
} from '@/features/clinical-documents/controllers/clinicalDocumentRichTextController';

export type ClinicalDocumentPlanSubsectionId = 'generales' | 'farmacologicas' | 'control_clinico';

export interface ClinicalDocumentPlanSubsection {
  id: ClinicalDocumentPlanSubsectionId;
  title: string;
}

export const CLINICAL_DOCUMENT_PLAN_SUBSECTIONS: readonly ClinicalDocumentPlanSubsection[] = [
  { id: 'generales', title: 'Indicaciones generales' },
  { id: 'farmacologicas', title: 'Indicaciones farmacológicas' },
  { id: 'control_clinico', title: 'Control clínico' },
] as const;

const PLAN_TITLE_BY_ID = Object.fromEntries(
  CLINICAL_DOCUMENT_PLAN_SUBSECTIONS.map(subsection => [subsection.id, subsection.title])
) as Record<ClinicalDocumentPlanSubsectionId, string>;

const PLAN_ID_BY_NORMALIZED_TITLE = Object.fromEntries(
  CLINICAL_DOCUMENT_PLAN_SUBSECTIONS.map(subsection => [
    normalizeTitle(subsection.title),
    subsection.id,
  ])
) as Record<string, ClinicalDocumentPlanSubsectionId>;

function normalizeTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const createEmptyPlanSubsections = (): Record<ClinicalDocumentPlanSubsectionId, string> => ({
  generales: '',
  farmacologicas: '',
  control_clinico: '',
});

const isRecognizedPlanHeading = (element: HTMLElement): ClinicalDocumentPlanSubsectionId | null => {
  const text = normalizeTitle(element.textContent || '');
  return PLAN_ID_BY_NORMALIZED_TITLE[text] || null;
};

const normalizeSubsectionContent = (value: string): string => {
  const normalized = normalizeClinicalDocumentContentForStorage(value).replace(/(<br>\s*)+$/i, '');
  return normalized === '<br>' ? '' : normalized;
};

const appendClinicalDocumentPlanIndicationLine = (
  currentContent: string,
  indicationText: string
): string => {
  const trimmedText = indicationText.trim();
  if (!trimmedText) {
    return normalizeSubsectionContent(currentContent);
  }

  const normalizedCurrent = normalizeSubsectionContent(currentContent);
  const nextLineHtml = `<div>${convertPlainTextToClinicalDocumentHtml(trimmedText)}</div>`;

  if (!normalizedCurrent) {
    return normalizeSubsectionContent(sanitizeClinicalDocumentHtml(nextLineHtml));
  }

  if (typeof document === 'undefined') {
    return sanitizeClinicalDocumentHtml(`${normalizedCurrent}${nextLineHtml}`);
  }

  const container = document.createElement('div');
  container.innerHTML = normalizedCurrent;

  const removeTrailingEmptyNodes = () => {
    while (container.lastChild) {
      const lastNode = container.lastChild;
      if (lastNode.nodeType === Node.TEXT_NODE && !(lastNode.textContent || '').trim()) {
        container.removeChild(lastNode);
        continue;
      }

      if (lastNode.nodeType === Node.ELEMENT_NODE) {
        const wrapper = document.createElement('div');
        wrapper.appendChild(lastNode.cloneNode(true));
        const normalizedLastNode = normalizeSubsectionContent(wrapper.innerHTML);
        if (!normalizedLastNode || normalizedLastNode === '<br>') {
          container.removeChild(lastNode);
          continue;
        }
      }
      break;
    }
  };

  removeTrailingEmptyNodes();

  const template = document.createElement('template');
  template.innerHTML = nextLineHtml;
  container.appendChild(template.content.cloneNode(true));

  return normalizeSubsectionContent(sanitizeClinicalDocumentHtml(container.innerHTML));
};

export const parseClinicalDocumentPlanSectionContent = (
  value: string
): Record<ClinicalDocumentPlanSubsectionId, string> => {
  const normalized = normalizeClinicalDocumentContentForStorage(value);
  const empty = createEmptyPlanSubsections();

  if (!normalized) {
    return empty;
  }

  if (typeof document === 'undefined') {
    return {
      ...empty,
      generales: normalized,
    };
  }

  const container = document.createElement('div');
  container.innerHTML = normalized;

  let currentSubsectionId: ClinicalDocumentPlanSubsectionId | null = null;
  const subsectionNodes: Record<ClinicalDocumentPlanSubsectionId, string[]> = {
    generales: [],
    farmacologicas: [],
    control_clinico: [],
  };

  Array.from(container.childNodes).forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const maybeHeading = isRecognizedPlanHeading(node as HTMLElement);
      if (maybeHeading) {
        currentSubsectionId = maybeHeading;
        return;
      }
    }

    if (!currentSubsectionId) {
      subsectionNodes.generales.push(nodeToHtml(node));
      return;
    }

    subsectionNodes[currentSubsectionId].push(nodeToHtml(node));
  });

  const parsed = Object.entries(subsectionNodes).reduce((accumulator, [subsectionId, chunks]) => {
    accumulator[subsectionId as ClinicalDocumentPlanSubsectionId] = normalizeSubsectionContent(
      chunks.join('').trim()
    );
    return accumulator;
  }, createEmptyPlanSubsections());

  return parsed;
};

const nodeToHtml = (node: ChildNode): string => {
  if (typeof document === 'undefined') {
    return '';
  }
  const wrapper = document.createElement('div');
  wrapper.appendChild(node.cloneNode(true));
  return wrapper.innerHTML;
};

const buildHeadingHtml = (title: string): string => `<div><strong>${title}</strong></div>`;

export const buildClinicalDocumentPlanSectionContent = (
  subsections: Record<ClinicalDocumentPlanSubsectionId, string>
): string => {
  const normalized = Object.fromEntries(
    Object.entries(subsections).map(([subsectionId, content]) => [
      subsectionId,
      normalizeSubsectionContent(content),
    ])
  ) as Record<ClinicalDocumentPlanSubsectionId, string>;

  const hasSomeContent = Object.values(normalized).some(content => Boolean(content.trim()));
  if (!hasSomeContent) {
    return '';
  }

  const html = CLINICAL_DOCUMENT_PLAN_SUBSECTIONS.map(subsection => {
    const content = normalized[subsection.id];
    return `${buildHeadingHtml(subsection.title)}${content || '<div><br></div>'}`;
  }).join('<div><br></div>');

  return sanitizeClinicalDocumentHtml(html);
};

export const updateClinicalDocumentPlanSubsectionContent = (
  value: string,
  subsectionId: ClinicalDocumentPlanSubsectionId,
  nextSubsectionContent: string
): string =>
  buildClinicalDocumentPlanSectionContent({
    ...parseClinicalDocumentPlanSectionContent(value),
    [subsectionId]: nextSubsectionContent,
  });

export const appendClinicalDocumentPlanSubsectionText = (
  value: string,
  subsectionId: ClinicalDocumentPlanSubsectionId,
  text: string
): string => {
  const parsed = parseClinicalDocumentPlanSectionContent(value);
  return buildClinicalDocumentPlanSectionContent({
    ...parsed,
    [subsectionId]: appendClinicalDocumentPlanIndicationLine(parsed[subsectionId], text),
  });
};

export const getClinicalDocumentPlanSubsectionTitle = (
  subsectionId: ClinicalDocumentPlanSubsectionId
): string => PLAN_TITLE_BY_ID[subsectionId];
