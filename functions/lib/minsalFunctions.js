const functions = require('firebase-functions/v1');
const { calculateMinsalStatistics } = require('./minsal/minsalStatsCalculator');
const {
  assertAuthenticatedClinicalRequest,
  loadMinsalRecords,
  parseMinsalRangeRequest,
} = require('./minsal/minsalRequestPolicy');

const createMinsalFunctions = ({ admin, hospitalCapacity, hasCallableClinicalAccess }) => ({
  calculateMinsalStats: functions.https.onCall(async (data, context) => {
    await assertAuthenticatedClinicalRequest(context, hasCallableClinicalAccess);
    const { hospitalId, startDate, endDate } = parseMinsalRangeRequest(data);

    try {
      const filteredRecords = await loadMinsalRecords(admin, hospitalId, startDate, endDate);
      return calculateMinsalStatistics({
        records: filteredRecords,
        hospitalCapacity,
        startDate,
        endDate,
      });
    } catch (error) {
      console.error('Error calculating statistics:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Error calculating statistics: ${error.message}`
      );
    }
  }),
});

module.exports = {
  createMinsalFunctions,
};
