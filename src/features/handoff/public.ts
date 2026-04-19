// Public API for code outside the handoff feature. Internal consumers should import local modules directly.
export { HandoffView } from './components/HandoffView';
export {
  resolveMedicalHandoffScope,
  resolveScopedMedicalSignature,
} from './controllers/medicalHandoffScopeController';
