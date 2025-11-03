import { GoogleGenAI } from "@google/genai";
import type { Handler } from "@netlify/functions";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { history, systemInstruction } = JSON.parse(event.body || '{}');

    if (!history) {
        // Handle initial message request from client
        if (event.body === '{}' || !JSON.parse(event.body).history) {
             const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [],
                config: {
                    systemInstruction: systemInstruction,
                },
            });
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: response.text }),
            };
        }
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing history in request body.' }),
      };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: history,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: response.text }),
    };

  } catch (error) {
    console.error('Error in Gemini serverless function:', error);
    const message = error instanceof Error ? error.message : 'Failed to process chat message.';
    return {
      statusCode: 500,
      body: JSON.stringify({ error: message }),
    };
  }
};

export { handler };
