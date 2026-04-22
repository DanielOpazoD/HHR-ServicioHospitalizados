import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { describe, it } from 'vitest';

import type { FirestoreRulesHarness } from './firestoreRulesTestHarness';

export function registerFirestoreRulesDomainGroups({
  unauth,
  authed,
  admin,
  nurse,
  doctor,
  specialist,
  specialistWithoutClaim,
  doctorWithoutClaim,
  editor,
  NOW_MS,
  setupDoc,
}: FirestoreRulesHarness): void {
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

    it('Specialists resolved via config/roles can create and update draft clinical documents', async () => {
      await assertSucceeds(
        specialistWithoutClaim().doc(clinicalDocumentPath).set(clinicalDocumentPayload)
      );
      await assertSucceeds(
        specialistWithoutClaim()
          .doc(clinicalDocumentPath)
          .update({
            title: 'Epicrisis especialista dinámica',
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

    it('Specialists cannot modify a clinical document once it is signed', async () => {
      await setupDoc(admin(), clinicalDocumentPath, {
        ...clinicalDocumentPayload,
        status: 'signed',
      });

      await assertFails(
        specialist()
          .doc(clinicalDocumentPath)
          .update({
            title: 'Intento de cambio posterior a firma',
            currentVersion: 3,
            'audit.updatedAt': new Date(NOW_MS + 2).toISOString(),
          })
      );
    });

    it('Regular authenticated users cannot create clinical documents', async () => {
      await assertFails(authed().doc(clinicalDocumentPath).set(clinicalDocumentPayload));
    });

    it('Nurses and editors cannot create clinical documents', async () => {
      await assertFails(nurse().doc(clinicalDocumentPath).set(clinicalDocumentPayload));
      await assertFails(editor().doc(clinicalDocumentPath).set(clinicalDocumentPayload));
    });

    it('Doctors resolved via config/roles can create clinical documents', async () => {
      await setupDoc(admin(), 'config/roles', {
        'daniel.opazo@hospitalhangaroa.cl': 'admin',
        'doctor.allowed@example.com': 'doctor_urgency',
      });

      await assertSucceeds(
        doctorWithoutClaim().doc(clinicalDocumentPath).set(clinicalDocumentPayload)
      );
    });

    it('Doctors resolved via config/roles can update an existing draft clinical document', async () => {
      await setupDoc(admin(), 'config/roles', {
        'daniel.opazo@hospitalhangaroa.cl': 'admin',
        'doctor.allowed@example.com': 'doctor_urgency',
      });
      await setupDoc(admin(), clinicalDocumentPath, clinicalDocumentPayload);

      await assertSucceeds(
        doctorWithoutClaim()
          .doc(clinicalDocumentPath)
          .update({
            title: 'Epicrisis médica actualizada',
            currentVersion: 2,
            'audit.updatedAt': new Date(NOW_MS + 1).toISOString(),
          })
      );
    });

    it('Nurses and editors cannot update clinical documents', async () => {
      await setupDoc(admin(), clinicalDocumentPath, clinicalDocumentPayload);
      await assertFails(
        nurse()
          .doc(clinicalDocumentPath)
          .update({
            title: 'Cambio enfermería no permitido',
            currentVersion: 2,
            'audit.updatedAt': new Date(NOW_MS + 1).toISOString(),
          })
      );
      await assertFails(
        editor()
          .doc(clinicalDocumentPath)
          .update({
            title: 'Cambio editor no permitido',
            currentVersion: 2,
            'audit.updatedAt': new Date(NOW_MS + 1).toISOString(),
          })
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
}
