/* @flake-safe: Safe usage of Date for setup only */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { setLogLevel } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

type FirestoreLike = ReturnType<
  ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore']
>;

const runRulesTests =
  process.env.RUN_FIRESTORE_RULES_TESTS === '1' ||
  process.env.FIRESTORE_EMULATOR_HOST !== undefined;

const describeRules = runRulesTests ? describe : describe.skip;
const NOW_MS = Date.now();
const THREE_DAYS_MS = 3 * 86400000;
const CURRENT_RECORD_DATE = new Date(NOW_MS).toISOString().slice(0, 10);
const PREVIOUS_RECORD_DATE = new Date(NOW_MS - 86400000).toISOString().slice(0, 10);

// Run 'npx firebase emulators:start --only firestore' and set RUN_FIRESTORE_RULES_TESTS=1
describeRules('Firestore Security Rules', () => {
  let testEnv: RulesTestEnvironment;

  // Users
  const unauth = () => testEnv.unauthenticatedContext().firestore();
  const authed = () =>
    testEnv
      .authenticatedContext('user_basic', { email: 'user@example.com', role: 'viewer' })
      .firestore();
  const admin = () =>
    testEnv
      .authenticatedContext('user_admin', {
        email: 'daniel.opazo@hospitalhangaroa.cl',
        role: 'admin',
      })
      .firestore();
  const nurse = () =>
    testEnv
      .authenticatedContext('user_nurse', {
        email: 'hospitalizados@hospitalhangaroa.cl',
        role: 'nurse_hospital',
      })
      .firestore();
  const doctor = () =>
    testEnv
      .authenticatedContext('user_doctor', { email: 'doctor@example.com', role: 'doctor_urgency' })
      .firestore();
  const specialist = () =>
    testEnv
      .authenticatedContext('user_specialist', {
        email: 'specialist@example.com',
        role: 'doctor_specialist',
      })
      .firestore();
  const specialistWithoutClaim = () =>
    testEnv
      .authenticatedContext('user_specialist_dynamic', {
        email: 'specialist.dynamic@example.com',
      })
      .firestore();
  const doctorWithoutClaim = () =>
    testEnv
      .authenticatedContext('user_doctor_allowed_only', { email: 'doctor.allowed@example.com' })
      .firestore();
  const editor = () =>
    testEnv
      .authenticatedContext('user_editor', { email: 'editor@example.com', role: 'editor' })
      .firestore();
  const unauthorizedAuthed = () =>
    testEnv.authenticatedContext('user_outsider', { email: 'outsider@example.com' }).firestore();

  beforeAll(async () => {
    setLogLevel('silent');

    // Read rules from project root
    const rulesPath = path.resolve(__dirname, '../../../firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    try {
      testEnv = await initializeTestEnvironment({
        projectId: 'demo-hhr-rules-test',
        firestore: {
          rules,
          host: '127.0.0.1',
          port: 8080,
        },
      });
    } catch (e) {
      console.error(
        "Failed to init emulator. Is it running? run 'firebase emulators:start --only firestore'"
      );
      throw e;
    }
  });

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  beforeEach(async () => {
    if (testEnv) await testEnv.clearFirestore();
    await setupDoc(admin(), 'config/roles', {
      'user@example.com': 'viewer',
      'hospitalizados@hospitalhangaroa.cl': 'nurse_hospital',
      'doctor@example.com': 'doctor_urgency',
      'specialist@example.com': 'doctor_specialist',
      'specialist.dynamic@example.com': 'doctor_specialist',
      'editor@example.com': 'editor',
    });
  });

  describe('Audit Logs Collection', () => {
    const auditCollection = (db: FirestoreLike) => db.collection('hospitals/H1/auditLogs');

    it('Unauthenticated users cannot read audit logs', async () => {
      await assertFails(auditCollection(unauth()).get());
    });

    it('Admins can read audit logs', async () => {
      await assertSucceeds(auditCollection(admin()).get());
    });

    it('Any authenticated user can create an audit log', async () => {
      await assertSucceeds(
        auditCollection(authed()).add({ action: 'TEST_ACTION', timestamp: 123456 })
      );
    });

    it('Regular users CANNOT delete audit logs', async () => {
      const db = authed();
      await setupDoc(admin(), 'hospitals/H1/auditLogs/log1', { action: 'TEST' });
      await assertFails(db.doc('hospitals/H1/auditLogs/log1').delete());
    });

    it('Admins CAN delete audit logs (for Consolidation)', async () => {
      const db = admin();
      await setupDoc(db, 'hospitals/H1/auditLogs/log1', { action: 'TEST' });
      await assertSucceeds(db.doc('hospitals/H1/auditLogs/log1').delete());
    });
  });

  describe('Daily Records Collection', () => {
    const recordPath = `hospitals/H1/dailyRecords/${CURRENT_RECORD_DATE}`;
    const historyPath = `hospitals/H1/dailyRecords/${CURRENT_RECORD_DATE}/history/h-1`;

    it('Authenticated users can read daily records', async () => {
      await setupDoc(admin(), recordPath, { date: CURRENT_RECORD_DATE });
      await assertSucceeds(authed().doc(recordPath).get());
    });

    it('Authenticated users without role cannot read daily records', async () => {
      await setupDoc(admin(), recordPath, { date: CURRENT_RECORD_DATE });
      await assertFails(unauthorizedAuthed().doc(recordPath).get());
    });

    it('Unauthenticated users cannot read daily records', async () => {
      await assertFails(unauth().doc(recordPath).get());
    });

    it('Nurses can update records within the editing window', async () => {
      const db = nurse();
      const now = NOW_MS;
      await setupDoc(admin(), recordPath, { date: CURRENT_RECORD_DATE, dateTimestamp: now });

      await assertSucceeds(db.doc(recordPath).update({ nursesDayShift: ['Nurse1'] }));
    });

    it('Nurses cannot update records outside the editing window', async () => {
      const db = nurse();
      const old = NOW_MS - THREE_DAYS_MS;
      await setupDoc(admin(), recordPath, { date: CURRENT_RECORD_DATE, dateTimestamp: old });

      await assertFails(db.doc(recordPath).update({ nursesDayShift: ['Nurse1'] }));
    });

    it('Doctors can update only medical signature fields', async () => {
      await setupDoc(admin(), recordPath, { date: CURRENT_RECORD_DATE, dateTimestamp: NOW_MS });

      await assertSucceeds(
        doctor().doc(recordPath).update({
          medicalSignature: 'signed',
          lastUpdated: NOW_MS,
          medicalHandoffDoctor: 'Dr. X',
          medicalHandoffSentAt: NOW_MS,
        })
      );
    });

    it('Doctors cannot update non-medical fields', async () => {
      await setupDoc(admin(), recordPath, { date: CURRENT_RECORD_DATE, dateTimestamp: NOW_MS });

      await assertFails(
        doctor()
          .doc(recordPath)
          .update({
            nursesDayShift: ['Nurse1'],
          })
      );
    });

    it('Specialists can update only medical handoff and clinical event fields for one bed', async () => {
      await setupDoc(admin(), recordPath, {
        date: CURRENT_RECORD_DATE,
        dateTimestamp: NOW_MS,
        beds: {
          R1: {
            patientName: 'Paciente Test',
            rut: '1-9',
            pathology: 'Neumonia',
            specialty: 'Med Interna',
            medicalHandoffNote: '',
            medicalHandoffEntries: [],
            clinicalEvents: [],
          },
        },
      });

      await assertSucceeds(
        specialist()
          .doc(recordPath)
          .update({
            'beds.R1.medicalHandoffNote': 'Evolución especialista',
            'beds.R1.medicalHandoffEntries': [
              {
                id: 'primary-entry',
                specialty: 'Med Interna',
                note: 'Evolución especialista',
              },
            ],
            'beds.R1.medicalHandoffAudit': {
              lastSpecialistUpdateAt: new Date(NOW_MS).toISOString(),
              lastSpecialistUpdateBy: {
                uid: 'user_specialist',
                email: 'specialist@example.com',
                displayName: 'Especialista',
                role: 'doctor_specialist',
              },
              currentStatus: 'updated_by_specialist',
            },
            'beds.R1.clinicalEvents': [
              {
                id: 'event-1',
                name: 'Evento clínico',
                date: CURRENT_RECORD_DATE,
                note: 'Control diario',
                createdAt: new Date(NOW_MS).toISOString(),
              },
            ],
            lastUpdated: NOW_MS,
          })
      );
    });

    it('Specialists resolved via config/roles can persist medical handoff changes', async () => {
      await setupDoc(admin(), 'config/roles', {
        'specialist.dynamic@example.com': 'doctor_specialist',
      });
      await setupDoc(admin(), recordPath, {
        date: CURRENT_RECORD_DATE,
        dateTimestamp: NOW_MS,
        beds: {
          R1: {
            patientName: 'Paciente Test',
            rut: '1-9',
            pathology: 'Neumonia',
            specialty: 'Med Interna',
            medicalHandoffNote: '',
            medicalHandoffEntries: [],
            clinicalEvents: [],
          },
        },
      });

      await assertSucceeds(
        specialistWithoutClaim()
          .doc(recordPath)
          .update({
            'beds.R1.medicalHandoffNote': 'Persistencia por rol dinámico',
            'beds.R1.medicalHandoffEntries': [
              {
                id: 'primary-entry',
                specialty: 'Med Interna',
                note: 'Persistencia por rol dinámico',
              },
            ],
            'beds.R1.medicalHandoffAudit': {
              lastSpecialistUpdateAt: new Date(NOW_MS).toISOString(),
              lastSpecialistUpdateBy: {
                uid: 'user_specialist_dynamic',
                email: 'specialist.dynamic@example.com',
                displayName: 'Especialista dinámico',
                role: 'doctor_specialist',
              },
              currentStatus: 'updated_by_specialist',
            },
            lastUpdated: NOW_MS,
          })
      );
    });

    it('Specialists cannot update general census fields outside the allowed handoff scope', async () => {
      await setupDoc(admin(), recordPath, {
        date: CURRENT_RECORD_DATE,
        dateTimestamp: NOW_MS,
        beds: {
          R1: {
            patientName: 'Paciente Test',
            rut: '1-9',
            pathology: 'Neumonia',
            specialty: 'Med Interna',
            status: 'Estable',
            medicalHandoffNote: '',
            medicalHandoffEntries: [],
            clinicalEvents: [],
          },
        },
      });

      await assertFails(
        specialist().doc(recordPath).update({
          'beds.R1.status': 'Grave',
          lastUpdated: NOW_MS,
        })
      );
    });

    it('Specialists cannot update two beds at once', async () => {
      await setupDoc(admin(), recordPath, {
        date: CURRENT_RECORD_DATE,
        dateTimestamp: NOW_MS,
        beds: {
          R1: {
            patientName: 'Paciente Uno',
            rut: '1-9',
            pathology: 'Neumonia',
            specialty: 'Med Interna',
            medicalHandoffNote: '',
            medicalHandoffEntries: [],
            clinicalEvents: [],
          },
          R2: {
            patientName: 'Paciente Dos',
            rut: '2-7',
            pathology: 'Fractura',
            specialty: 'Cirugía',
            medicalHandoffNote: '',
            medicalHandoffEntries: [],
            clinicalEvents: [],
          },
        },
      });

      await assertFails(
        specialist().doc(recordPath).update({
          'beds.R1.medicalHandoffNote': 'Cambio 1',
          'beds.R2.medicalHandoffNote': 'Cambio 2',
          lastUpdated: NOW_MS,
        })
      );
    });

    it('Specialists cannot update previous-day handoff records', async () => {
      const previousRecordPath = `hospitals/H1/dailyRecords/${PREVIOUS_RECORD_DATE}`;
      await setupDoc(admin(), previousRecordPath, {
        date: PREVIOUS_RECORD_DATE,
        dateTimestamp: NOW_MS - 86400000,
        beds: {
          R1: {
            patientName: 'Paciente Prev',
            rut: '3-5',
            pathology: 'Control',
            specialty: 'Med Interna',
            medicalHandoffNote: '',
            medicalHandoffEntries: [],
            clinicalEvents: [],
          },
        },
      });

      await assertFails(
        specialist().doc(previousRecordPath).update({
          'beds.R1.medicalHandoffNote': 'Intento sobre día previo',
          lastUpdated: NOW_MS,
        })
      );
    });

    it('Specialists can repair missing dateTimestamp while persisting today handoff changes', async () => {
      await setupDoc(admin(), recordPath, {
        date: CURRENT_RECORD_DATE,
        beds: {
          R1: {
            patientName: 'Paciente Legacy',
            rut: '4-4',
            pathology: 'Control',
            specialty: 'Med Interna',
            medicalHandoffNote: '',
            medicalHandoffEntries: [],
            clinicalEvents: [],
          },
        },
      });

      await assertSucceeds(
        specialist()
          .doc(recordPath)
          .update({
            'beds.R1.medicalHandoffNote': 'Actualización sobre registro legacy',
            'beds.R1.medicalHandoffEntries': [
              {
                id: 'primary-entry',
                specialty: 'Med Interna',
                note: 'Actualización sobre registro legacy',
              },
            ],
            'beds.R1.medicalHandoffAudit': {
              lastSpecialistUpdateAt: new Date(NOW_MS).toISOString(),
              lastSpecialistUpdateBy: {
                uid: 'user_specialist',
                email: 'specialist@example.com',
                displayName: 'Especialista',
                role: 'doctor_specialist',
              },
              currentStatus: 'updated_by_specialist',
            },
            dateTimestamp: NOW_MS,
            lastUpdated: NOW_MS,
          })
      );
    });

    it('Admins can delete daily records', async () => {
      await setupDoc(admin(), recordPath, { date: CURRENT_RECORD_DATE });
      await assertSucceeds(admin().doc(recordPath).delete());
    });

    it('Nurses CANNOT delete daily records', async () => {
      const now = NOW_MS;
      await setupDoc(admin(), recordPath, { date: CURRENT_RECORD_DATE, dateTimestamp: now });
      await assertFails(nurse().doc(recordPath).delete());
    });

    it('Nurses can create history snapshots under daily records', async () => {
      const now = NOW_MS;
      await setupDoc(admin(), recordPath, { date: CURRENT_RECORD_DATE, dateTimestamp: now });

      await assertSucceeds(
        nurse().doc(historyPath).set({
          snapshotTimestamp: now,
          source: 'auto-save',
        })
      );
    });

    it('Doctors cannot create history snapshots under daily records', async () => {
      const now = NOW_MS;
      await setupDoc(admin(), recordPath, { date: CURRENT_RECORD_DATE, dateTimestamp: now });

      await assertFails(
        doctor().doc(historyPath).set({
          snapshotTimestamp: now,
          source: 'manual',
        })
      );
    });

    it('Only admins can update or delete history snapshots', async () => {
      const now = NOW_MS;
      await setupDoc(admin(), recordPath, { date: CURRENT_RECORD_DATE, dateTimestamp: now });
      await setupDoc(admin(), historyPath, {
        snapshotTimestamp: now,
        source: 'seed',
      });

      await assertFails(nurse().doc(historyPath).update({ source: 'nurse-edit' }));
      await assertFails(nurse().doc(historyPath).delete());
      await assertSucceeds(admin().doc(historyPath).update({ source: 'admin-edit' }));
      await assertSucceeds(admin().doc(historyPath).delete());
    });
  });

  describe('Reminders Collection', () => {
    const reminderPath = 'hospitals/H1/reminders/rem-1';
    const receiptPath = `${reminderPath}/readReceipts/user_nurse__2026-01-01__day`;

    beforeEach(async () => {
      await setupDoc(admin(), reminderPath, {
        title: 'Aviso de prueba',
        message: 'Mensaje',
        type: 'info',
        targetRoles: ['nurse_hospital'],
        targetShifts: ['day'],
        startDate: CURRENT_RECORD_DATE,
        endDate: CURRENT_RECORD_DATE,
        priority: 2,
        isActive: true,
        createdBy: 'admin',
        createdByName: 'Admin',
        createdAt: new Date(NOW_MS).toISOString(),
        updatedAt: new Date(NOW_MS).toISOString(),
      });
    });

    it('allows clinical users with role access to read reminders', async () => {
      await assertSucceeds(nurse().doc(reminderPath).get());
      await assertSucceeds(doctor().doc(reminderPath).get());
    });

    it('blocks unauthorized users from reading reminders', async () => {
      await assertFails(unauthorizedAuthed().doc(reminderPath).get());
    });

    it('allows admins to create reminders', async () => {
      await assertSucceeds(
        admin()
          .doc('hospitals/H1/reminders/rem-2')
          .set({
            title: 'Nuevo aviso',
            message: 'Texto',
            type: 'warning',
            targetRoles: ['nurse_hospital'],
            targetShifts: ['day'],
            startDate: CURRENT_RECORD_DATE,
            endDate: CURRENT_RECORD_DATE,
            priority: 3,
            isActive: true,
            createdBy: 'admin',
            createdByName: 'Admin',
            createdAt: new Date(NOW_MS).toISOString(),
            updatedAt: new Date(NOW_MS).toISOString(),
          })
      );
    });

    it('blocks non-admin users from creating reminders', async () => {
      await assertFails(
        nurse()
          .doc('hospitals/H1/reminders/rem-3')
          .set({
            title: 'Sin permiso',
            message: 'Texto',
            type: 'warning',
            targetRoles: ['nurse_hospital'],
            targetShifts: ['day'],
            startDate: CURRENT_RECORD_DATE,
            endDate: CURRENT_RECORD_DATE,
            priority: 1,
            isActive: true,
            createdBy: 'nurse',
            createdByName: 'Nurse',
            createdAt: new Date(NOW_MS).toISOString(),
            updatedAt: new Date(NOW_MS).toISOString(),
          })
      );
    });

    it('allows users to create their own read receipt only', async () => {
      await assertSucceeds(
        nurse()
          .doc(receiptPath)
          .set({
            userId: 'user_nurse',
            userName: 'Nurse',
            readAt: new Date(NOW_MS).toISOString(),
            shift: 'day',
            dateKey: CURRENT_RECORD_DATE,
          })
      );
    });

    it('blocks users from creating read receipts for another uid', async () => {
      await assertFails(
        nurse()
          .doc(`${reminderPath}/readReceipts/other-user`)
          .set({
            userId: 'other-user',
            userName: 'Nurse',
            readAt: new Date(NOW_MS).toISOString(),
            shift: 'day',
            dateKey: CURRENT_RECORD_DATE,
          })
      );
    });

    it('allows users to read their own receipt but blocks other users', async () => {
      await setupDoc(admin(), receiptPath, {
        userId: 'user_nurse',
        userName: 'Nurse',
        readAt: new Date(NOW_MS).toISOString(),
        shift: 'day',
        dateKey: CURRENT_RECORD_DATE,
      });

      await assertSucceeds(nurse().doc(receiptPath).get());
      await assertFails(doctor().doc(receiptPath).get());
    });

    it('allows only admins to read aggregated receipts for any user', async () => {
      await setupDoc(admin(), receiptPath, {
        userId: 'user_nurse',
        userName: 'Nurse',
        readAt: new Date(NOW_MS).toISOString(),
        shift: 'day',
        dateKey: CURRENT_RECORD_DATE,
      });

      await assertSucceeds(admin().doc(receiptPath).get());
    });
  });

  describe('Settings Collection', () => {
    const settingsPath = 'hospitals/H1/settings/tableConfig';

    it('Admins can write settings', async () => {
      await assertSucceeds(admin().doc(settingsPath).set({ foo: 'bar' }));
    });

    it('Regular users CANNOT write settings', async () => {
      await assertFails(authed().doc(settingsPath).set({ foo: 'bar' }));
    });

    it('Nurses can write settings', async () => {
      await assertSucceeds(nurse().doc(settingsPath).set({ foo: 'bar' }));
    });

    it('Unauthenticated users cannot read settings', async () => {
      await assertFails(unauth().doc(settingsPath).get());
    });
  });

  describe('Clinical Documents Collection', () => {
    const clinicalDocumentPath = 'hospitals/H1/clinicalDocuments/doc-1';
    const clinicalDocumentPayload = {
      id: 'doc-1',
      documentType: 'epicrisis',
      templateId: 'epicrisis',
      title: 'Epicrisis médica',
      episodeKey: '157894824__2026-03-04',
      patientRut: '15.789.482-4',
      status: 'draft',
      currentVersion: 1,
      audit: {
        createdAt: new Date(NOW_MS).toISOString(),
        updatedAt: new Date(NOW_MS).toISOString(),
      },
    };

    it('Doctors can create clinical documents', async () => {
      await assertSucceeds(doctor().doc(clinicalDocumentPath).set(clinicalDocumentPayload));
    });

    it('Specialists can create and update draft clinical documents', async () => {
      await assertSucceeds(specialist().doc(clinicalDocumentPath).set(clinicalDocumentPayload));
      await assertSucceeds(
        specialist()
          .doc(clinicalDocumentPath)
          .update({
            title: 'Epicrisis especialista',
            currentVersion: 2,
            'audit.updatedAt': new Date(NOW_MS + 1).toISOString(),
          })
      );
    });

    it('Specialists cannot sign clinical documents through Firestore writes', async () => {
      await setupDoc(admin(), clinicalDocumentPath, clinicalDocumentPayload);

      await assertFails(
        specialist()
          .doc(clinicalDocumentPath)
          .update({
            status: 'signed',
            'audit.signedAt': new Date(NOW_MS + 1).toISOString(),
          })
      );
    });

    it('Regular authenticated users cannot create clinical documents', async () => {
      await assertFails(authed().doc(clinicalDocumentPath).set(clinicalDocumentPayload));
    });

    it('Doctors resolved via config/roles can create clinical documents', async () => {
      await setupDoc(admin(), 'config/roles', {
        'doctor.allowed@example.com': 'doctor_urgency',
      });

      await assertSucceeds(
        doctorWithoutClaim().doc(clinicalDocumentPath).set(clinicalDocumentPayload)
      );
    });

    it('Delete is allowed for clinical editor roles and denied for viewer', async () => {
      await setupDoc(admin(), clinicalDocumentPath, clinicalDocumentPayload);
      await assertSucceeds(doctor().doc(clinicalDocumentPath).delete());

      await setupDoc(admin(), clinicalDocumentPath, clinicalDocumentPayload);
      await assertSucceeds(nurse().doc(clinicalDocumentPath).delete());

      await setupDoc(admin(), clinicalDocumentPath, clinicalDocumentPayload);
      await assertSucceeds(editor().doc(clinicalDocumentPath).delete());

      await setupDoc(admin(), clinicalDocumentPath, clinicalDocumentPayload);
      await assertFails(authed().doc(clinicalDocumentPath).delete());
    });
  });

  describe('Export Passwords', () => {
    const exportPath = 'hospitals/H1/exportPasswords/2025-01-01';

    it('Authenticated users can read export passwords', async () => {
      await setupDoc(admin(), exportPath, { password: 'secret' });
      await assertSucceeds(authed().doc(exportPath).get());
    });

    it('Unauthenticated users cannot read export passwords', async () => {
      await assertFails(unauth().doc(exportPath).get());
    });

    it('Admins can write export passwords', async () => {
      await assertSucceeds(admin().doc(exportPath).set({ password: 'secret' }));
    });

    it('Non-admins cannot write export passwords', async () => {
      await assertFails(authed().doc(exportPath).set({ password: 'secret' }));
    });
  });

  describe('Global Email Recipient Lists', () => {
    const emailListPath = 'emailRecipientLists/census-default';

    it('Admins can read and write global email recipient lists', async () => {
      await assertSucceeds(
        admin()
          .doc(emailListPath)
          .set({
            name: 'Lista global',
            recipients: ['uno@hospital.cl'],
            scope: 'global',
          })
      );
      await assertSucceeds(admin().doc(emailListPath).get());
    });

    it('Nurses can read and write global email recipient lists', async () => {
      await assertSucceeds(
        nurse()
          .doc(emailListPath)
          .set({
            name: 'Lista global',
            recipients: ['uno@hospital.cl'],
            scope: 'global',
          })
      );
      await assertSucceeds(nurse().doc(emailListPath).get());
    });

    it('Editors can write global email recipient lists', async () => {
      await assertSucceeds(
        editor()
          .doc(emailListPath)
          .set({
            name: 'Lista global',
            recipients: ['uno@hospital.cl'],
            scope: 'global',
          })
      );
    });

    it('Regular users cannot write global email recipient lists', async () => {
      await assertFails(
        authed()
          .doc(emailListPath)
          .set({
            name: 'Lista global',
            recipients: ['uno@hospital.cl'],
            scope: 'global',
          })
      );
    });

    it('Unauthenticated users cannot read global email recipient lists', async () => {
      await assertFails(unauth().doc(emailListPath).get());
    });
  });

  describe('Transfer Requests', () => {
    const transferPath = 'hospitals/H1/transferRequests/TR-1';

    it('Nurses can create transfer requests', async () => {
      await assertSucceeds(nurse().doc(transferPath).set({ status: 'pending' }));
    });

    it('Non-nurse users cannot create transfer requests', async () => {
      await assertFails(authed().doc(transferPath).set({ status: 'pending' }));
    });
  });

  describe('Backup Files', () => {
    const backupPath = 'hospitals/H1/backupFiles/file1';

    it('Only editors can create backup files', async () => {
      await assertFails(authed().doc(backupPath).set({ name: 'file.pdf' }));
      await assertSucceeds(nurse().doc(backupPath).set({ name: 'file.pdf' }));
    });

    it('Unauthenticated users cannot read backup files', async () => {
      await assertFails(unauth().doc(backupPath).get());
    });

    it('Admins can update backup files', async () => {
      await setupDoc(admin(), backupPath, { name: 'file.pdf' });
      await assertSucceeds(admin().doc(backupPath).update({ name: 'file-v2.pdf' }));
    });

    it('Non-admins cannot update backup files', async () => {
      await setupDoc(admin(), backupPath, { name: 'file.pdf' });
      await assertFails(authed().doc(backupPath).update({ name: 'file-v2.pdf' }));
    });
  });

  describe('Allowed Users (legacy retired)', () => {
    it('Users cannot read legacy authorization docs', async () => {
      await assertFails(authed().doc('allowedUsers/user_basic').get());
    });

    it('Admins also cannot access legacy authorization docs directly', async () => {
      await assertFails(admin().doc('allowedUsers/user_other').get());
    });
  });

  describe('User Settings', () => {
    it('Users can read/write their own settings', async () => {
      await assertSucceeds(authed().doc('userSettings/user_basic').set({ theme: 'light' }));
      await assertSucceeds(authed().doc('userSettings/user_basic').get());
    });

    it('Users cannot write settings for other users', async () => {
      await assertFails(authed().doc('userSettings/user_other').set({ theme: 'dark' }));
    });
  });

  describe('System Health', () => {
    const validSystemHealthPayload = {
      uid: 'user_basic',
      email: 'user@example.com',
      displayName: 'User Basic',
      lastSeen: '2026-02-20T00:00:00.000Z',
      isOnline: true,
      isOutdated: false,
      pendingMutations: 0,
      pendingSyncTasks: 0,
      failedSyncTasks: 0,
      conflictSyncTasks: 0,
      retryingSyncTasks: 0,
      oldestPendingAgeMs: 0,
      localErrorCount: 0,
      appVersion: 'v1',
      platform: 'MacIntel',
      userAgent: 'Vitest',
    };

    it('Users can write their own system health record', async () => {
      await assertSucceeds(
        authed().doc('stats/system_health/users/user_basic').set(validSystemHealthPayload)
      );
    });

    it('Users cannot write system health for other users', async () => {
      await assertFails(
        authed().doc('stats/system_health/users/user_other').set(validSystemHealthPayload)
      );
    });

    it('Users cannot forge uid field in own system health record', async () => {
      await assertFails(
        authed()
          .doc('stats/system_health/users/user_basic')
          .set({
            ...validSystemHealthPayload,
            uid: 'someone_else',
          })
      );
    });

    it('Users cannot write non-whitelisted fields in system health payload', async () => {
      await assertFails(
        authed()
          .doc('stats/system_health/users/user_basic')
          .set({
            ...validSystemHealthPayload,
            injected: true,
          })
      );
    });
  });

  describe('Census Access Invitations', () => {
    const invitationPath = 'census-access-invitations/inv-1';

    it('Unauthenticated users cannot read invitations', async () => {
      await setupDoc(admin(), invitationPath, {
        email: 'invited@example.com',
        status: 'pending',
      });
      await assertFails(unauth().doc(invitationPath).get());
    });

    it('Authenticated user can claim own pending invitation', async () => {
      const invitedUser = () =>
        testEnv.authenticatedContext('user_invited', { email: 'invited@example.com' }).firestore();

      await setupDoc(admin(), invitationPath, {
        email: 'invited@example.com',
        status: 'pending',
        createdAt: NOW_MS,
        createdBy: 'admin',
        expiresAt: NOW_MS + 86_400_000,
      });

      await assertSucceeds(
        invitedUser()
          .doc(invitationPath)
          .update({
            status: 'used',
            usedBy: 'user_invited',
            usedAt: NOW_MS + 1000,
          })
      );
    });
  });

  describe('Census Access Users', () => {
    const accessUserPath = 'census-access-users/user_basic';

    it('Regular users cannot self-create census access user documents', async () => {
      await assertFails(
        authed().doc(accessUserPath).set({
          id: 'user_basic',
          email: 'user@example.com',
          role: 'viewer',
          isActive: true,
        })
      );
    });

    it('Editors/admins can create census access user documents', async () => {
      await assertSucceeds(
        admin().doc(accessUserPath).set({
          id: 'user_basic',
          email: 'user@example.com',
          role: 'viewer',
          isActive: true,
        })
      );
    });
  });

  describe('Census Access Logs', () => {
    const logPath = 'census-access-logs/log-1';

    it('Allows creating log only when userId/email match current caller', async () => {
      await assertSucceeds(
        authed().doc(logPath).set({
          userId: 'user_basic',
          email: 'user@example.com',
          action: 'list_files',
          timestamp: NOW_MS,
        })
      );
    });

    it('Rejects forged logs for other users', async () => {
      await assertFails(
        authed().doc(logPath).set({
          userId: 'user_other',
          email: 'user@example.com',
          action: 'list_files',
          timestamp: NOW_MS,
        })
      );
    });
  });

  describe('Bookmarks', () => {
    const bookmarkPath = 'hospitals/H1/bookmarks/shift';

    it('Unauthenticated users cannot read bookmarks', async () => {
      await setupDoc(admin(), bookmarkPath, { alignment: 'left' });
      await assertFails(unauth().doc(bookmarkPath).get());
    });

    it('Unauthenticated users cannot write bookmarks', async () => {
      await assertFails(unauth().doc(bookmarkPath).set({ alignment: 'right' }));
    });
  });
});

// Helper to setup a document as admin
async function setupDoc(db: FirestoreLike, path: string, data: Record<string, unknown>) {
  const docRef = db.doc(path);
  await docRef.set(data);
  return docRef;
}
