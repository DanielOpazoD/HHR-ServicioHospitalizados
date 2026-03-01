import { DailyRecord } from '@/types';
import { aiRequestManager } from '../ai/aiRequestManager';
import { generateGeminiHtmlContent } from '@/services/integrations/geminiClient';
import { buildShiftReportPrompt } from '@/services/integrations/geminiPromptBuilder';

export const generateShiftReport = async (record: DailyRecord): Promise<string | undefined> => {
  const prompt = buildShiftReportPrompt(record);

  try {
    return await aiRequestManager.enqueue(`shift-report-${record.date}`, async () => {
      return generateGeminiHtmlContent(prompt);
    });
  } catch (error) {
    console.error('Error generating AI report:', error);
    return '<p>No se pudo generar el reporte de IA. Verifique la conexión o la clave API.</p>';
  }
};
