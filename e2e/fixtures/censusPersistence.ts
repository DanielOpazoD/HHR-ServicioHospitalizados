import { expect, Page } from '@playwright/test';

interface WaitForPersistedBedFieldsInput {
  page: Page;
  date: string;
  bedId: string;
  expected: Record<string, string | boolean | number | null>;
}

interface SeedPersistedBedFieldsInput {
  page: Page;
  date: string;
  bedId: string;
  fields: Record<string, string | boolean | number | null>;
}

export const waitForPersistedBedFields = async ({
  page,
  date,
  bedId,
  expected,
}: WaitForPersistedBedFieldsInput) => {
  const expectedKeys = Object.keys(expected);
  await expect
    .poll(
      async () =>
        page.evaluate(
          ({ evalDate, evalBedId, evalExpectedKeys }) => {
            const records = JSON.parse(
              window.localStorage.getItem('hanga_roa_hospital_data') || '{}'
            ) as Record<string, { beds?: Record<string, Record<string, unknown>> }>;
            const bed = records?.[evalDate]?.beds?.[evalBedId] || {};
            return Object.fromEntries(
              evalExpectedKeys.map(key => [
                key,
                (bed[key] as string | boolean | number | null) ?? null,
              ])
            );
          },
          {
            evalDate: date,
            evalBedId: bedId,
            evalExpectedKeys: expectedKeys,
          }
        ),
      {
        timeout: 20_000,
      }
    )
    .toMatchObject(expected);
};

export const seedPersistedBedFields = async ({
  page,
  date,
  bedId,
  fields,
}: SeedPersistedBedFieldsInput) => {
  await page.evaluate(
    ({ targetDate, targetBedId, targetFields }) => {
      const storageKey = 'hanga_roa_hospital_data';
      const records = JSON.parse(window.localStorage.getItem(storageKey) || '{}') as Record<
        string,
        { beds?: Record<string, Record<string, unknown>>; lastUpdated?: string }
      >;
      const currentRecord = records[targetDate] || {};
      const currentBeds = currentRecord.beds || {};
      const nextRecord = {
        ...currentRecord,
        lastUpdated: new Date().toISOString(),
        beds: {
          ...currentBeds,
          [targetBedId]: {
            ...(currentBeds[targetBedId] || {}),
            ...targetFields,
          },
        },
      };

      records[targetDate] = nextRecord;
      window.localStorage.setItem(storageKey, JSON.stringify(records));

      const runtimeWindow = window as Window & {
        __HHR_E2E_OVERRIDE__?: Record<string, unknown>;
      };
      runtimeWindow.__HHR_E2E_OVERRIDE__ = {
        ...(runtimeWindow.__HHR_E2E_OVERRIDE__ || {}),
        [targetDate]: nextRecord as unknown,
      };
    },
    {
      targetDate: date,
      targetBedId: bedId,
      targetFields: fields,
    }
  );
};
