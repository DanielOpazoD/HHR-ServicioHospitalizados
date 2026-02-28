import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';

export interface MessageTemplate {
  id?: string;
  name: string;
  content: string;
  type: 'handoff' | 'shift' | 'custom';
  createdAt?: Timestamp;
}

export function getDefaultTemplates(): MessageTemplate[] {
  return [
    {
      id: 'handoff-default',
      name: 'Entrega de Turno Estandar',
      type: 'handoff',
      content: `🏥 Hospital Hanga Roa
📋 Entrega de Turno Médico

📅 Fecha: {{date}}
👨‍⚕️ Entregado por: {{signedBy}}
🕐 Firmado: {{signedAt}}

📊 Resumen:
• Hospitalizados: {{hospitalized}} pacientes
• Camas libres: {{freeBeds}}
• Nuevos ingresos: {{newAdmissions}}
• Altas: {{discharges}}

🔗 Ver entrega completa:
{{handoffUrl}}

- Enviado automáticamente por Sistema HHR`,
    },
    {
      id: 'handoff-urgent',
      name: 'Entrega Urgente',
      type: 'handoff',
      content: `🚨 ENTREGA URGENTE - Hospital Hanga Roa

📅 {{date}} - {{signedAt}}
👨‍⚕️ {{signedBy}}

⚠️ Pacientes críticos: {{criticalPatients}}
📊 Camas libres: {{freeBeds}}

🔗 Ver entrega: {{handoffUrl}}`,
    },
  ];
}

export async function getMessageTemplates(): Promise<MessageTemplate[]> {
  try {
    const docRef = doc(db, 'whatsapp', 'templates');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data().templates || [];
    }

    return getDefaultTemplates();
  } catch (_error) {
    console.error('Error getting templates:', _error);
    return getDefaultTemplates();
  }
}

export async function saveMessageTemplates(templates: MessageTemplate[]): Promise<boolean> {
  try {
    const docRef = doc(db, 'whatsapp', 'templates');
    await setDoc(docRef, { templates }, { merge: true });
    return true;
  } catch (_error) {
    console.error('Error saving templates:', _error);
    return false;
  }
}

export function formatHandoffMessage(
  template: string,
  data: {
    date: string;
    signedBy: string;
    signedAt: string;
    hospitalized: number;
    freeBeds: number;
    newAdmissions: number;
    discharges: number;
    handoffUrl: string;
    criticalPatients?: number;
  }
): string {
  return template
    .replace(/\{\{date\}\}/g, data.date)
    .replace(/\{\{signedBy\}\}/g, data.signedBy)
    .replace(/\{\{signedAt\}\}/g, data.signedAt)
    .replace(/\{\{hospitalized\}\}/g, String(data.hospitalized))
    .replace(/\{\{freeBeds\}\}/g, String(data.freeBeds))
    .replace(/\{\{newAdmissions\}\}/g, String(data.newAdmissions))
    .replace(/\{\{discharges\}\}/g, String(data.discharges))
    .replace(/\{\{handoffUrl\}\}/g, data.handoffUrl)
    .replace(/\{\{criticalPatients\}\}/g, String(data.criticalPatients || 0));
}
