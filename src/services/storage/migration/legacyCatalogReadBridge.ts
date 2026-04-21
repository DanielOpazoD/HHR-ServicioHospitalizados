/**
 * Narrow bridge for legacy catalog reads.
 *
 * Use this entrypoint from repositories that still need explicit legacy catalog
 * fallback access while retirement remains in progress.
 */

export {
  getLegacyNurseCatalog,
  getLegacyTensCatalog,
} from '@/services/storage/legacyfirebase/legacyFirebaseCatalogService';
