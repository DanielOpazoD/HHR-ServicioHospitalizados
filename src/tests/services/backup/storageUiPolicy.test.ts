import { describe, expect, it } from 'vitest';
import { getStorageListNotice, getStorageLookupNotice } from '@/services/backup/storageUiPolicy';

describe('storageUiPolicy', () => {
  it('returns restricted lookup warning', () => {
    expect(getStorageLookupNotice({ exists: false, status: 'restricted' }, 'censo')).toEqual({
      channel: 'info',
      title: 'Respaldo no verificable',
      message: 'No se pudo confirmar el respaldo de censo por permisos de Storage.',
    });
  });

  it('returns timeout lookup warning', () => {
    expect(getStorageLookupNotice({ exists: false, status: 'timeout' }, 'PDF')).toEqual({
      channel: 'warning',
      title: 'Verificacion incompleta',
      message: 'La verificacion del respaldo de PDF excedio el tiempo esperado.',
    });
  });

  it('returns list warning for timeout first', () => {
    expect(
      getStorageListNotice({
        skippedNotFound: 0,
        skippedRestricted: 2,
        skippedUnknown: 1,
        skippedUnparsed: 1,
        timedOut: true,
      })
    ).toEqual({
      channel: 'warning',
      title: 'Carga parcial de respaldos',
      message: 'La consulta a Storage tardó demasiado. La lista puede estar incompleta.',
    });
  });

  it('returns list info for degraded metadata', () => {
    expect(
      getStorageListNotice({
        skippedNotFound: 0,
        skippedRestricted: 0,
        skippedUnknown: 1,
        skippedUnparsed: 1,
        timedOut: false,
      })
    ).toEqual({
      channel: 'info',
      title: 'Carga parcial de respaldos',
      message: '2 archivo(s) fueron omitidos por datos o metadata incompatibles.',
    });
  });
});
