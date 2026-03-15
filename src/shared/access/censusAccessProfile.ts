export type CensusAccessProfile = 'default' | 'specialist';

export const isSpecialistCensusAccessProfile = (accessProfile: CensusAccessProfile): boolean =>
  accessProfile === 'specialist';
