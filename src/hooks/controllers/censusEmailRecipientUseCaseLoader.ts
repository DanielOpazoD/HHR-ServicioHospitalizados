let censusRecipientListUseCasesPromise: Promise<
  typeof import('@/application/census-email/censusRecipientListUseCases')
> | null = null;

const loadCensusRecipientListUseCases = async () => {
  censusRecipientListUseCasesPromise ??=
    import('@/application/census-email/censusRecipientListUseCases');
  return censusRecipientListUseCasesPromise;
};

export type CensusRecipientListUseCasesModule = Awaited<
  ReturnType<typeof loadCensusRecipientListUseCases>
>;

export type RecipientUseCaseResult<T> = {
  status: string;
  data?: T;
  issues?: Array<{ message?: string; userSafeMessage?: string }>;
  userSafeMessage?: string;
};

export const withRecipientListUseCases = async <TResult>(
  run: (useCases: CensusRecipientListUseCasesModule) => Promise<TResult>
): Promise<TResult> => {
  const useCases = await loadCensusRecipientListUseCases();
  return run(useCases);
};
