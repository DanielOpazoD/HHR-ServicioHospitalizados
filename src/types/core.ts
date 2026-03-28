/**
 * @deprecated Compatibility facade only.
 *
 * New source code must import from the owning domain module:
 * `@/types/domain/base`, `@/types/domain/clinical`, `@/types/domain/patient`,
 * `@/types/domain/movements`, or `@/types/domain/dailyRecord`.
 *
 * This file remains as a transitional re-export and is protected by
 * `check:core-type-facade-boundaries`.
 */

export * from './domain/base';
export * from './domain/clinical';
export * from './domain/patient';
export * from './domain/movements';
export * from './domain/dailyRecord';
export * from './domain/professionals';
export * from './domain/statistics';
