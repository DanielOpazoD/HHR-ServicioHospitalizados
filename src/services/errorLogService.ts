import { getErrorLogs } from '@/services/storage/indexeddb/indexedDbErrorLogService';

export const fetchErrorLogs = async (limit = 50) => getErrorLogs(limit);
