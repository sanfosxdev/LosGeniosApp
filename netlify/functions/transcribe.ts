import { GoogleGenAI } from "@google/genai";
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { audio, mimeType } = JSON.parse(event.body || '{}');

    if (!audio || !mimeType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing audio data or mimeType.' }),
      };
    }

    const audioPart = {
      inlineData: {
        mimeType: mimeType,
        data: audio,
      },
    };
    const textPart = {
      text: "Transcribe este audio. Responde únicamente con el texto transcrito, sin ningún comentario adicional o frases como 'Aquí está la transcripción'."
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [audioPart, textPart] },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: response.text }),
    };
  } catch (error) {
    console.error('Error in transcribe serverless function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to transcribe audio.' }),
    };
  }
};

export { handler };
