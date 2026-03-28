export enum BedType {
  UTI = 'UTI',
  UCI = 'UCI',
  MEDIA = 'MEDIA',
}

export interface BedDefinition {
  id: string;
  name: string;
  type: BedType;
  isCuna: boolean;
  isExtra?: boolean;
}
