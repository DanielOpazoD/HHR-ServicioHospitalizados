interface ResolveSubRowDemographicsButtonVisibilityParams {
  readOnly: boolean;
  specialistAccess?: boolean;
}

export const shouldShowSubRowDemographicsButton = ({
  readOnly,
  specialistAccess = false,
}: ResolveSubRowDemographicsButtonVisibilityParams): boolean => !readOnly && !specialistAccess;
