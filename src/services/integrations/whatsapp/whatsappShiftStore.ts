import { collection, doc, limit, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import type { WeeklyShift } from '@/types';

const TURNO_KEYWORDS = ['turno pabellon', 'turno pabellón', 'envío turno', 'envio turno'];

const parseShiftDates = (messageText: string): { startDate: string; endDate: string } | null => {
  const dateMatch = messageText.match(
    /del\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+hasta\s+el\s+(\d{1,2}\/\d{1,2}\/\d{4})/i
  );

  if (!dateMatch) {
    return null;
  }

  const [, start, end] = dateMatch;
  const [startDay, startMonth, startYear] = start.split('/');
  const [endDay, endMonth, endYear] = end.split('/');

  return {
    startDate: `${startYear}-${startMonth.padStart(2, '0')}-${startDay.padStart(2, '0')}`,
    endDate: `${endYear}-${endMonth.padStart(2, '0')}-${endDay.padStart(2, '0')}`,
  };
};

export function subscribeToCurrentShift(callback: (shift: WeeklyShift | null) => void): () => void {
  const shiftsRef = collection(db, 'shifts', 'weekly', 'data');
  const shiftsQuery = query(shiftsRef, orderBy('parsedAt', 'desc'), limit(1));

  return onSnapshot(shiftsQuery, snapshot => {
    if (snapshot.empty) {
      callback(null);
      return;
    }

    callback(snapshot.docs[0].data() as WeeklyShift);
  });
}

export async function saveManualShift(
  messageText: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const lowerMessage = messageText.toLowerCase();
    const hasShiftKeyword = TURNO_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
    if (!hasShiftKeyword) {
      console.warn('⚠️ No se encontró palabra clave de turno');
      return { success: false, error: 'El mensaje no parece ser un turno de pabellón' };
    }

    const parsedDates = parseShiftDates(messageText);
    if (!parsedDates) {
      console.warn('⚠️ No se encontraron fechas');
      return {
        success: false,
        error:
          'No se encontraron fechas en el mensaje (formato: del DD/MM/YYYY hasta el DD/MM/YYYY)',
      };
    }

    const shift: WeeklyShift = {
      ...parsedDates,
      source: 'manual' as const,
      parsedAt: new Date().toISOString(),
      staff: [],
      originalMessage: messageText,
    };

    const shiftsRef = collection(db, 'shifts', 'weekly', 'data');
    await setDoc(doc(shiftsRef, shift.startDate), shift);
    return { success: true };
  } catch (error: unknown) {
    console.error('Error saving manual shift:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al guardar el turno',
    };
  }
}
