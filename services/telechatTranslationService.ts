import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY: string = (import.meta as any).env.VITE_GEMINI_API_KEY || '';

const LANGUAGE_NAMES: Record<string, string> = {
  es: 'Spanish',
  fr: 'French',
  zh: 'Chinese',
  de: 'German',
  hi: 'Hindi',
};

export const translateTelechatMessage = async (text: string, targetLanguageCode: string): Promise<string> => {
  if (!GEMINI_API_KEY || targetLanguageCode === 'en') return text;

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const targetLanguage = LANGUAGE_NAMES[targetLanguageCode] || targetLanguageCode;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Translate the following chat message to ${targetLanguage}.
Maintain the tone, medical context if any, and brevity.
Do not add explanations.

Message: "${text}"

Output only the translated text.`,
    });

    return response.text?.trim() || text;
  } catch (error) {
    console.error('[Telechat] Translation failed', error);
    return text;
  }
};
