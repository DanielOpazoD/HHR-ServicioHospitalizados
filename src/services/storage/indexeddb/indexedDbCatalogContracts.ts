export interface CatalogRecord<T = unknown> {
  id: string;
  list: T[];
  lastUpdated: string;
}
