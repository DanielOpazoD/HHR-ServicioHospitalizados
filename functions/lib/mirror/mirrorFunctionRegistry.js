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
  {
    exportName: 'mirrorClinicalDocuments',
    collection: 'clinicalDocuments',
    logLabel: 'clinical document',
  },
];

module.exports = {
  MIRROR_WRITE_COLLECTIONS,
};
