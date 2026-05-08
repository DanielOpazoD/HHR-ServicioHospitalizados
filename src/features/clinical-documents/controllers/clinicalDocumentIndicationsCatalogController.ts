import { normalizeClinicalDocumentIndicationTextKey } from '@/features/clinical-documents/controllers/clinicalDocumentIndicationsController';

export interface ClinicalDocumentIndicationCatalogItem {
  id: string;
  text: string;
  source: 'custom';
  createdAt?: string;
}

export interface ClinicalDocumentIndicationCatalogTab {
  id: string;
  label: string;
  items: ClinicalDocumentIndicationCatalogItem[];
}

export interface ClinicalDocumentIndicationsCatalog {
  version: number;
  uid: string;
  email: string;
  updatedAt: string;
  activeTabId: string;
  tabs: ClinicalDocumentIndicationCatalogTab[];
  /** Compatibility view for callers that only need the active tab's indications. */
  items: ClinicalDocumentIndicationCatalogItem[];
}

export type RawClinicalDocumentIndicationsCatalog =
  | {
      version?: number;
      uid?: unknown;
      email?: unknown;
      updatedAt?: unknown;
      activeTabId?: unknown;
      tabs?: unknown[];
      items?: unknown[];
    }
  | null
  | undefined;

interface ClinicalDocumentIndicationsCatalogOwner {
  uid?: string | null;
  email?: string | null;
}

const DEFAULT_TAB_ID = 'general';
const DEFAULT_TAB_LABEL = 'General';

const normalizeText = (value: string): string => value.trim().replace(/\s+/g, ' ');

const normalizeTabLabel = (value: string): string => normalizeText(value).slice(0, 48);

export const buildClinicalDocumentIndicationCatalogItemId = (text: string): string =>
  `custom-${normalizeClinicalDocumentIndicationTextKey(text).replace(/[^a-z0-9]+/g, '-')}`;

export const buildClinicalDocumentIndicationCatalogTabId = (label: string): string => {
  const normalized = normalizeClinicalDocumentIndicationTextKey(label)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || DEFAULT_TAB_ID;
};

const resolveActiveTab = (
  tabs: ClinicalDocumentIndicationCatalogTab[],
  activeTabId: unknown
): ClinicalDocumentIndicationCatalogTab =>
  tabs.find(tab => tab.id === activeTabId) ||
  tabs[0] ||
  buildDefaultClinicalDocumentIndicationsTab();

const withActiveItems = (
  catalog: Omit<ClinicalDocumentIndicationsCatalog, 'items'> & {
    items?: ClinicalDocumentIndicationCatalogItem[];
  }
): ClinicalDocumentIndicationsCatalog => {
  const activeTab = catalog.tabs.find(tab => tab.id === catalog.activeTabId) || catalog.tabs[0];
  return {
    ...catalog,
    activeTabId: activeTab?.id || DEFAULT_TAB_ID,
    items: activeTab?.items || [],
  };
};

const getActiveTabId = (
  catalog: ClinicalDocumentIndicationsCatalog,
  tabId?: string | null
): string => String(tabId || catalog.activeTabId || catalog.tabs[0]?.id || DEFAULT_TAB_ID).trim();

const mapTabItems = (
  catalog: ClinicalDocumentIndicationsCatalog,
  tabId: string,
  mapItems: (
    items: ClinicalDocumentIndicationCatalogItem[]
  ) => ClinicalDocumentIndicationCatalogItem[]
): ClinicalDocumentIndicationsCatalog =>
  withActiveItems({
    ...catalog,
    activeTabId: tabId,
    tabs: catalog.tabs.map(tab =>
      tab.id === tabId
        ? {
            ...tab,
            items: mapItems(tab.items),
          }
        : tab
    ),
  });

const buildUniqueTabId = (tabs: ClinicalDocumentIndicationCatalogTab[], label: string): string => {
  const baseId = buildClinicalDocumentIndicationCatalogTabId(label);
  if (!tabs.some(tab => tab.id === baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (tabs.some(tab => tab.id === `${baseId}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseId}-${suffix}`;
};

export const buildDefaultClinicalDocumentIndicationsTab = (
  items: ClinicalDocumentIndicationCatalogItem[] = []
): ClinicalDocumentIndicationCatalogTab => ({
  id: DEFAULT_TAB_ID,
  label: DEFAULT_TAB_LABEL,
  items,
});

export const getDefaultClinicalDocumentIndicationsCatalog = (
  now: string = new Date().toISOString(),
  owner: ClinicalDocumentIndicationsCatalogOwner = {}
): ClinicalDocumentIndicationsCatalog => {
  const tabs = [buildDefaultClinicalDocumentIndicationsTab()];
  return {
    version: 1,
    uid: String(owner.uid || '').trim(),
    email: String(owner.email || '').trim(),
    updatedAt: now,
    activeTabId: DEFAULT_TAB_ID,
    tabs,
    items: tabs[0].items,
  };
};

const normalizeItem = (
  rawItem: unknown,
  fallbackIndex: number
): ClinicalDocumentIndicationCatalogItem | null => {
  const text =
    typeof rawItem === 'string'
      ? normalizeText(rawItem)
      : typeof rawItem === 'object' &&
          rawItem &&
          'text' in rawItem &&
          typeof rawItem.text === 'string'
        ? normalizeText(rawItem.text)
        : '';

  if (!text) {
    return null;
  }

  const objectItem =
    typeof rawItem === 'object' && rawItem
      ? (rawItem as Partial<ClinicalDocumentIndicationCatalogItem>)
      : null;
  const explicitId = typeof objectItem?.id === 'string' ? objectItem.id.trim() : '';

  return {
    id: explicitId || `${buildClinicalDocumentIndicationCatalogItemId(text)}-${fallbackIndex}`,
    text,
    source: 'custom',
    createdAt: typeof objectItem?.createdAt === 'string' ? objectItem.createdAt : undefined,
  };
};

const normalizeItems = (
  rawItems: unknown[] | undefined
): ClinicalDocumentIndicationCatalogItem[] => {
  const seen = new Set<string>();
  return Array.isArray(rawItems)
    ? rawItems.reduce<ClinicalDocumentIndicationCatalogItem[]>((accumulator, rawItem) => {
        const item = normalizeItem(rawItem, accumulator.length + 1);
        if (!item) {
          return accumulator;
        }

        const textKey = normalizeClinicalDocumentIndicationTextKey(item.text);
        if (seen.has(textKey)) {
          return accumulator;
        }

        seen.add(textKey);
        accumulator.push(item);
        return accumulator;
      }, [])
    : [];
};

const normalizeTab = (
  rawTab: unknown,
  fallbackIndex: number
): ClinicalDocumentIndicationCatalogTab | null => {
  if (!rawTab || typeof rawTab !== 'object') {
    return null;
  }

  const tabRecord = rawTab as {
    id?: unknown;
    label?: unknown;
    items?: unknown[];
  };
  const label = normalizeTabLabel(String(tabRecord.label || ''));
  if (!label) {
    return null;
  }

  const rawId = typeof tabRecord.id === 'string' ? tabRecord.id.trim() : '';
  return {
    id: rawId || `${buildClinicalDocumentIndicationCatalogTabId(label)}-${fallbackIndex}`,
    label,
    items: normalizeItems(tabRecord.items),
  };
};

const normalizeTabs = (
  rawCatalog: RawClinicalDocumentIndicationsCatalog
): ClinicalDocumentIndicationCatalogTab[] => {
  if (rawCatalog?.tabs && Array.isArray(rawCatalog.tabs)) {
    const tabs = rawCatalog.tabs
      .map((tab, index) => normalizeTab(tab, index + 1))
      .filter((tab): tab is ClinicalDocumentIndicationCatalogTab => Boolean(tab));
    return tabs.length ? tabs : [buildDefaultClinicalDocumentIndicationsTab()];
  }

  return [buildDefaultClinicalDocumentIndicationsTab(normalizeItems(rawCatalog?.items))];
};

export const normalizeClinicalDocumentIndicationsCatalog = (
  rawCatalog: RawClinicalDocumentIndicationsCatalog,
  owner: ClinicalDocumentIndicationsCatalogOwner = {}
): ClinicalDocumentIndicationsCatalog => {
  const fallback = getDefaultClinicalDocumentIndicationsCatalog(undefined, owner);
  if (!rawCatalog || typeof rawCatalog !== 'object') {
    return fallback;
  }

  const tabs = normalizeTabs(rawCatalog);
  const activeTab = resolveActiveTab(tabs, rawCatalog.activeTabId);

  return {
    version: typeof rawCatalog.version === 'number' ? rawCatalog.version : fallback.version,
    uid: String(rawCatalog.uid || owner.uid || '').trim(),
    email: String(rawCatalog.email || owner.email || '').trim(),
    updatedAt:
      typeof rawCatalog.updatedAt === 'string' && rawCatalog.updatedAt.trim()
        ? rawCatalog.updatedAt
        : fallback.updatedAt,
    activeTabId: activeTab.id,
    tabs,
    items: activeTab.items,
  };
};

export const applyClinicalDocumentIndicationsCreateTab = (
  catalog: ClinicalDocumentIndicationsCatalog,
  label: string
): ClinicalDocumentIndicationsCatalog => {
  const trimmedLabel = normalizeTabLabel(label);
  if (!trimmedLabel) {
    return catalog;
  }

  const tabId = buildUniqueTabId(catalog.tabs, trimmedLabel);
  return withActiveItems({
    ...catalog,
    activeTabId: tabId,
    tabs: [...catalog.tabs, { id: tabId, label: trimmedLabel, items: [] }],
  });
};

export const applyClinicalDocumentIndicationsRenameTab = (
  catalog: ClinicalDocumentIndicationsCatalog,
  tabId: string,
  label: string
): ClinicalDocumentIndicationsCatalog => {
  const trimmedLabel = normalizeTabLabel(label);
  if (!trimmedLabel) {
    return catalog;
  }

  return withActiveItems({
    ...catalog,
    tabs: catalog.tabs.map(tab => (tab.id === tabId ? { ...tab, label: trimmedLabel } : tab)),
  });
};

export const applyClinicalDocumentIndicationsDeleteTab = (
  catalog: ClinicalDocumentIndicationsCatalog,
  tabId: string
): ClinicalDocumentIndicationsCatalog => {
  if (catalog.tabs.length <= 1) {
    return catalog;
  }

  const nextTabs = catalog.tabs.filter(tab => tab.id !== tabId);
  const nextActiveTabId =
    catalog.activeTabId === tabId ? nextTabs[0]?.id || DEFAULT_TAB_ID : catalog.activeTabId;
  return withActiveItems({
    ...catalog,
    activeTabId: nextActiveTabId,
    tabs: nextTabs,
  });
};

export const applyClinicalDocumentIndicationsReorderTab = (
  catalog: ClinicalDocumentIndicationsCatalog,
  tabId: string,
  direction: 'left' | 'right'
): ClinicalDocumentIndicationsCatalog => {
  const currentIndex = catalog.tabs.findIndex(tab => tab.id === tabId);
  const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= catalog.tabs.length) {
    return catalog;
  }

  const nextTabs = [...catalog.tabs];
  const [tab] = nextTabs.splice(currentIndex, 1);
  nextTabs.splice(targetIndex, 0, tab);
  return withActiveItems({
    ...catalog,
    tabs: nextTabs,
  });
};

export const applyClinicalDocumentIndicationsAddItem = (
  catalog: ClinicalDocumentIndicationsCatalog,
  {
    tabId,
    text,
    now = new Date().toISOString(),
    idSuffix = Math.random().toString(36).slice(2, 8),
  }: {
    tabId?: string | null;
    text: string;
    now?: string;
    idSuffix?: string;
  }
): ClinicalDocumentIndicationsCatalog => {
  const trimmedText = normalizeText(text);
  if (!trimmedText) {
    return catalog;
  }

  const targetTabId = getActiveTabId(catalog, tabId);
  const targetTab = catalog.tabs.find(tab => tab.id === targetTabId);
  if (!targetTab) {
    return catalog;
  }

  const textKey = normalizeClinicalDocumentIndicationTextKey(trimmedText);
  if (
    targetTab.items.some(item => normalizeClinicalDocumentIndicationTextKey(item.text) === textKey)
  ) {
    return catalog;
  }

  return mapTabItems(catalog, targetTabId, items => [
    ...items,
    {
      id: `${buildClinicalDocumentIndicationCatalogItemId(trimmedText)}-${idSuffix}`,
      text: trimmedText,
      source: 'custom',
      createdAt: now,
    },
  ]);
};

export const applyClinicalDocumentIndicationsUpdateItem = (
  catalog: ClinicalDocumentIndicationsCatalog,
  {
    tabId,
    itemId,
    text,
  }: {
    tabId?: string | null;
    itemId: string;
    text: string;
  }
): ClinicalDocumentIndicationsCatalog => {
  const trimmedText = normalizeText(text);
  if (!trimmedText) {
    return catalog;
  }

  const targetTabId = getActiveTabId(catalog, tabId);
  const targetTab = catalog.tabs.find(tab => tab.id === targetTabId);
  if (!targetTab) {
    return catalog;
  }

  const textKey = normalizeClinicalDocumentIndicationTextKey(trimmedText);
  if (
    targetTab.items.some(
      item =>
        item.id !== itemId && normalizeClinicalDocumentIndicationTextKey(item.text) === textKey
    )
  ) {
    return catalog;
  }

  return mapTabItems(catalog, targetTabId, items =>
    items.map(item =>
      item.id === itemId ? { ...item, text: trimmedText, source: 'custom' } : item
    )
  );
};

export const applyClinicalDocumentIndicationsDeleteItem = (
  catalog: ClinicalDocumentIndicationsCatalog,
  {
    tabId,
    itemId,
  }: {
    tabId?: string | null;
    itemId: string;
  }
): ClinicalDocumentIndicationsCatalog =>
  mapTabItems(catalog, getActiveTabId(catalog, tabId), items =>
    items.filter(item => item.id !== itemId)
  );
