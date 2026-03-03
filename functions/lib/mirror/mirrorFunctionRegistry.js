const MIRROR_WRITE_COLLECTIONS = [
  {
    exportName: 'mirrorAuditLogs',
    collection: 'auditLogs',
    logLabel: 'log',
  },
  {
    exportName: 'mirrorSettings',
    collection: 'settings',
    logLabel: 'setting',
  },
  {
    exportName: 'mirrorTransferRequests',
    collection: 'transferRequests',
    logLabel: 'transfer request',
  },
];

module.exports = {
  MIRROR_WRITE_COLLECTIONS,
};
