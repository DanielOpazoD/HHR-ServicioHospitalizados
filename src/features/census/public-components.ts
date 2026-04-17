// Heavy-component public entrypoint for the census feature.
//
// Kept SEPARATE from public.ts so that external static importers of the
// light controllers/types do not pull CensusView and its large transitive
// graph into their chunks. External consumers of these components MUST
// load this module via a dynamic import() so the build can split it away
// from the app-authenticated-shell budget.
//
// Do not add controllers/types/hooks here. Do not re-export from here in
// public.ts.

export { CensusView } from './components/CensusView';
export { CensusEmailConfigModal } from './components/CensusEmailConfigModal';
export { GlobalPatientSearchModal } from './components/global-search/GlobalPatientSearchModal';
