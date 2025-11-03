
import { GoogleGenAI } from "@google/genai";
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { getProductsFromCache as getProducts } from '../../services/productService';
import { isBusinessOpen, getScheduleFromCache as getSchedule } from '../../services/scheduleService';
import { getReservationSettings } from '../../services/reservationService';
import type { TimeSlot, ChatMessage, MessageSender } from '../../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });


const generateMenuForPrompt = (): string => {
    const products = getProducts();
    const groupedMenu = products.reduce((acc, product) => {
        const { category, name, price, description } = product;
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push({
            producto: name,
            precio: price,
            ...(description && { ingredientes: description })
        });
        return acc;
    }, {} as Record<string, {producto: string, precio: string, ingredientes?: string}[]>);

    return JSON.stringify(groupedMenu, null, 2);
};

const formatScheduleForPrompt = (): string => {
    const schedule = getSchedule();
    const days = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    return days.map((day, index) => {
        const daySchedule = schedule[dayKeys[index]];
        const dayName = day.charAt(0).toUpperCase() + day.slice(1);
        if (daySchedule.isOpen && daySchedule.slots.length > 0) {
            const slotsStr = daySchedule.slots.map((slot: TimeSlot) => `de ${slot.open} a ${slot.close}`).join(' y ');
            return `${dayName}: ${slotsStr}`;
        }
        return `${dayName}: Cerrado`;
    }).join('\n');
};


const getSystemInstruction = (): string => {
    const isOpen = isBusinessOpen();
    const menu = generateMenuForPrompt();
    const schedule = formatScheduleForPrompt();
    const reservationSettings = getReservationSettings();

    // Get current date and time in Argentina
    const nowInArgentina = new Date().toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    
    const contextInstruction = `**Contexto Actual**: La fecha y hora actual en Argentina es ${nowInArgentina}. Utiliza esta información para interpretar cualquier solicitud relativa al tiempo como "hoy", "mañana", "a las 10", etc.`;

    const reservationInstructions = `
**TAREA 2: Hacer una Reserva**
Guíalos para obtener la información necesaria: nombre, número de teléfono, cantidad de comensales, fecha y hora deseadas.
Informa al cliente que la duración de la reserva es de ${reservationSettings.duration} minutos.
**Estructura del JSON para RESERVAS**:
{
  "intent": "RESERVATION",
  "customerName": "Nombre del Cliente",
  "customerPhone": "Teléfono",
  "guests": 2,
  "date": "AAAA-MM-DD",
  "time": "HH:MM"
}`;

    if (isOpen) {
        return `Eres "Slice", un asistente de IA amigable y eficiente para "Pizzería Los Genios".
Tu objetivo es ayudar a los clientes con dos tareas principales: 1) Realizar pedidos para recoger o a domicilio, o 2) Hacer una reserva de mesa.
Sé conversacional y servicial.

${contextInstruction}

**TAREA 1: Realizar un Pedido**
Guíalos en la selección de artículos del menú, especificando cantidades y proporcionando los detalles necesarios como su nombre, número de teléfono y dirección para la entrega.
Confirma siempre el pedido final con un resumen antes de "realizarlo".

**IMPORTANTE**: Cuando el usuario confirme la acción (pedido o reserva) y tengas todos los detalles necesarios, DEBES finalizar la conversación respondiendo ÚNICAMENTE con un bloque de código JSON. Este bloque debe estar delimitado por \`\`\`json y \`\`\`. No incluyas ningún otro texto o saludo fuera de este bloque de código JSON.

**Estructura del JSON para PEDIDOS**:
{
  "intent": "ORDER",
  "customer": {
    "name": "Nombre del Cliente",
    "phone": "Número de Teléfono",
    "address": "Dirección de Entrega (o "N/A" para recoger)"
  },
  "items": [
    {
      "name": "Nombre del Producto",
      "quantity": 1,
      "price": 9200
    }
  ],
  "total": 9200,
  "type": "delivery" o "pickup"
}

${reservationInstructions}

Nuestro menú incluye:
${menu}

**Horario de atención**:
${schedule}
Ten en cuenta que un horario que termina después de la medianoche (ej. 18:00 a 02:00) significa que el local está abierto continuamente durante esa noche.

No inventes artículos del menú. Si un usuario hace una pregunta no relacionada, amablemente desvía la conversación.
Comienza la conversación dando una cálida bienvenida y preguntando si desean hacer un pedido o una reserva.`;
    } else {
        return `Eres "Slice", un asistente de IA amigable y eficiente para "Pizzería Los Genios".
Actualmente, el local está CERRADO para pedidos de comida. Tu objetivo es ayudar a los clientes con dos posibles tareas: 1) Hacer una reserva para una fecha futura, o 2) Capturar su información de contacto para futuras promociones.

${contextInstruction}

**Instrucciones**:
1.  Informa al usuario de manera amable que el local está cerrado para tomar pedidos de comida en este momento.
2.  Indica claramente el horario de atención para cuando sí tomamos pedidos. Nuestro horario es:
    ${schedule}
3.  **IMPORTANTE**: Aclara que, aunque no se pueden hacer pedidos, SÍ pueden hacer una reserva para cuando estemos abiertos.

${reservationInstructions}

**IMPORTANTE**: Si el usuario confirma una reserva y tienes todos los detalles, DEBES finalizar respondiendo ÚNICAMENTE con el bloque de código JSON de RESERVA. No incluyas ningún otro texto o saludo fuera de este bloque.

Si el usuario no quiere reservar, invítalo a dejar su email o número de WhatsApp para que podamos enviarle nuestras promociones, novedades y avisarle cuando abramos.
Si el usuario proporciona su contacto, agradécele y finaliza la conversación.

Comienza la conversación saludando amablemente, informando que el local está cerrado para pedidos, pero que con gusto puedes ayudarle a hacer una reserva o a tomar sus datos para novedades.`;
    }
};


const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { messages } = JSON.parse(event.body || '{}') as { messages: ChatMessage[] };

    // The first message is the initial greeting from the bot, let's create it here.
    if (!messages || messages.length === 0) {
        const initialMessage = isBusinessOpen() 
            ? '¡Bienvenido a Pizzería Los Genios! Soy Slice, tu asistente virtual. ¿Te gustaría hacer un pedido o una reserva?'
            : '¡Hola! Bienvenido a Pizzería Los Genios. Actualmente estamos cerrados para pedidos, pero puedo ayudarte a hacer una reserva para cuando abramos. ¿Te gustaría?';
      
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: initialMessage }),
        };
    }
    
    const contents = messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: getSystemInstruction(),
      },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: response.text }),
    };

  } catch (error) {
    console.error('Error in Gemini serverless function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process chat message.' }),
    };
  }
};

export { handler };