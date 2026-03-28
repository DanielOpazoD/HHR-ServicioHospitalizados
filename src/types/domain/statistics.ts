/**
 * Census occupancy summary used by census-facing read models and views.
 */
export interface Statistics {
  occupiedBeds: number; // Adult beds occupied by patients (Census)
  occupiedCribs: number; // Nested Cribs ONLY (Internal counter)
  clinicalCribsCount: number; // Main (Cuna Mode) + Nested Cribs (For Resource Display)
  companionCribs: number; // Cribs used by healthy RN (associated to mother)
  totalCribsUsed: number; // Total physical cribs (Occupied by Patient + Companion)
  totalHospitalized: number; // occupiedBeds + occupiedCribs
  blockedBeds: number;
  serviceCapacity: number; // 18 - blocked
  availableCapacity: number;
}
