export const resolveConflictVersionsEmptyMessage = (date?: string): string =>
  `Para ${date || 'este día'} no hay snapshots recuperables de versiones en conflicto. ` +
  'Si observabilidad registró un conflicto automático, los snapshots pudieron no guardarse, ' +
  'haber expirado o no estar disponibles para el usuario actual.';
