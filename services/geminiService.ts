import { GoogleGenAI, Chat, Content } from "@google/genai";
// Fix: Use getProductsFromCache instead of getProducts
import { getProductsFromCache } from './productService';
// Fix: Use getScheduleFromCache instead of getSchedule
import { isBusinessOpen, getScheduleFromCache } from './scheduleService';
import { getReservationSettings, getReservationsFromCache } from './reservationService';
// Fix: Use getTablesFromCache instead of getTables
import { getTablesFromCache } from './tableService';
import type { TimeSlot, ChatMessage } from '../types';
import { MessageSender } from '../types';
import { getOrdersFromCache, isOrderFinished } from './orderService';
import { OrderType, ReservationStatus } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY is not set. The application will not work.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });


const generateMenuForPrompt = (): string => {
    // Fix: Use getProductsFromCache instead of getProducts
    const products = getProductsFromCache();
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
    // Fix: Use getScheduleFromCache instead of getSchedule
    const schedule = getScheduleFromCache();
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

const generateTablesForPrompt = (): string => {
    // Fix: Use getTablesFromCache instead of getTables
    const tables = getTablesFromCache();
    const reservableTables = tables.filter(t => t.allowsReservations);
    if (reservableTables.length === 0) {
        return "Actualmente no tenemos mesas que permitan reservas.";
    }
    const totalCapacity = reservableTables.reduce((sum, table) => sum + table.capacity, 0);

    const tableList = reservableTables.map(t => `- ${t.name}: para ${t.capacity} personas`).join('\n');

    return `
**Información de Mesas para Reservas**:
Disponemos de las siguientes mesas que se pueden reservar:
${tableList}

La capacidad máxima para un grupo es aproximadamente ${totalCapacity} personas. Si alguien pide una reserva para un número de personas muy superior a nuestra capacidad (ej. 30 personas), debes informarle amablemente que no podemos acomodar a un grupo tan grande y NO debes proceder a confirmar ni generar el JSON.

**Regla de Reserva CRÍTICA**: Antes de confirmar una reserva y generar el JSON, DEBES verificar mentalmente si la cantidad de comensales es razonable según la capacidad de nuestras mesas. Si un pedido es para 19 personas, es muy probable que no tengamos lugar. En ese caso, debes responder "Lo siento, no tenemos capacidad para un grupo de 19 personas. Podemos acomodar grupos más pequeños. ¿Te gustaría intentar con menos comensales?". NUNCA generes un JSON para una reserva que parezca imposible de cumplir.
`;
}

const generateAvailabilityForPrompt = (): string => {
    const reservations = getReservationsFromCache().filter(
        r => r.status === ReservationStatus.CONFIRMED || r.status === ReservationStatus.SEATED
    );
    const orders = getOrdersFromCache().filter(
        o => o.type === OrderType.DINE_IN && !isOrderFinished(o.status)
    );
    const settings = getReservationSettings();
    const allTables = getTablesFromCache().filter(t => t.allowsReservations);
    const now = new Date();

    const busySlots: {start: Date, end: Date, tables: string[], reason: string}[] = [];

    reservations.forEach(res => {
        const start = new Date(res.reservationTime);
        const end = new Date(start.getTime() + settings.duration * 60 * 1000);
        if (end > now) {
            busySlots.push({ start, end, tables: res.tableIds, reason: `Reserva (${res.customerName})` });
        }
    });

    orders.forEach(order => {
        const start = new Date(order.createdAt);
        const end = new Date(start.getTime() + settings.duration * 60 * 1000); // Approximation
        if (end > now && order.tableIds) {
             busySlots.push({ start, end, tables: order.tableIds, reason: `Pedido en mesa (${order.customer.name})` });
        }
    });
    
    if (busySlots.length === 0) {
        return `
**Disponibilidad de Mesas en TIEMPO REAL**:
Actualmente, todas las mesas que permiten reservas parecen estar disponibles. El sistema verificará la disponibilidad final al momento de generar el JSON, pero tu ayuda para guiar al cliente es crucial.

**PROCESO DE RESERVA MEJORADO**:
1.  **Recopila Información**: Ayuda al usuario a completar todos los detalles para su reserva.
2.  **Confirma con un Resumen**: Antes de finalizar, DEBES presentar un resumen completo y PREGUNTAR explícitamente si todo es correcto.
3.  **Espera Confirmación**: Espera la confirmación explícita del usuario.
4.  **Genera el JSON FINAL**: SOLO DESPUÉS de recibir la confirmación, responde con el JSON. El sistema hará una última verificación de disponibilidad. Si está ocupado, el sistema te informará para que puedas ofrecer alternativas.
`;
    }

    const formattedSlots = busySlots.map(slot => {
        const tableNames = allTables
            .filter(t => slot.tables.includes(t.id))
            .map(t => t.name)
            .join(', ');

        const formatTime = (date: Date) => date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        const formatDate = (date: Date) => {
            const today = new Date();
            const tomorrow = new Date();
            tomorrow.setDate(today.getDate() + 1);
            if (date.toDateString() === today.toDateString()) return 'Hoy';
            if (date.toDateString() === tomorrow.toDateString()) return 'Mañana';
            return date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric' });
        }
        
        return `- ${formatDate(slot.start)} de ${formatTime(slot.start)} a ${formatTime(slot.end)} (${slot.reason}) en: ${tableNames}`;
    }).join('\n');

    return `
**Disponibilidad de Mesas en TIEMPO REAL (CRÍTICO)**:
La siguiente es una lista de horarios en los que algunas o todas nuestras mesas YA ESTÁN OCUPADAS o RESERVADAS. DEBES usar esta información para guiar al usuario hacia horarios disponibles. NO ofrezcas un horario que se solape con estos para las mesas indicadas.

**Horarios y Mesas Ocupadas/Reservadas Actualmente**:
${formattedSlots}

**PROCESO DE RESERVA MEJORADO OBLIGATORIO**:
1.  **Recopila Información**: Pide la fecha, hora y cantidad de comensales.
2.  **Verifica Disponibilidad**: ANTES de proponer un resumen, revisa la lista de horarios ocupados de arriba. Si el horario solicitado por el usuario se solapa con una reserva existente, DEBES informarle y sugerir alternativas cercanas que estén libres. Ejemplo: "Un momento, déjame verificar... Parece que las 21:00 ya no está disponible. ¿Te parece bien a las 20:30 o a las 22:00?".
3.  **Confirma con un Resumen**: Una vez que encuentres un horario que PAREZCA disponible y que el usuario acepte, presenta el resumen y pide confirmación.
4.  **Genera el JSON FINAL**: SOLO DESPUÉS de la confirmación del usuario, genera el JSON. El sistema hará una última verificación de disponibilidad en tiempo real. Si para ese momento la mesa fue ocupada, el sistema te lo informará para que ofrezcas otra alternativa.
`;
}

const getSystemInstruction = (actionLock: 'order' | 'reservation' | null = null): string => {
    const isOpen = isBusinessOpen();
    const menu = generateMenuForPrompt();
    const schedule = formatScheduleForPrompt();
    const reservationSettings = getReservationSettings();
    const tablesInfo = generateTablesForPrompt();
    const availabilityInfo = generateAvailabilityForPrompt();

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
    
    const reservationRulesInstruction = `
**Reglas de Reserva CRÍTICAS**:
1.  **No se permiten reservas en el pasado**: La fecha y hora de la reserva DEBE ser en el futuro. Compara la solicitud del cliente con la fecha y hora actual: "${nowInArgentina}". Si piden una reserva para hoy a una hora que ya pasó, o para un día anterior, debes rechazarla amablemente y pedirles que elijan una fecha y hora futuras.
2.  **Antelación Mínima para Hoy**: Para reservas en el mismo día, la hora solicitada debe ser al menos **${reservationSettings.minBookingTime} minutos** después de la hora actual. Si un cliente pide una reserva para dentro de 10 minutos y la antelación mínima es de 60, debes informarle cortésmente y sugerir el próximo horario disponible (por ejemplo, "Lo siento, necesitamos al menos ${reservationSettings.minBookingTime} minutos de antelación para preparar tu mesa. ¿Te gustaría reservar a partir de las [hora futura calculada]?").
`;

    if (actionLock === 'order') {
        return `Eres "Slice", un asistente de IA para "Pizzería Los Genios".
**CONTEXTO CRÍTICO: Ya estás en medio de tomar un pedido para un cliente.**
Tu ÚNICA tarea ahora es completar este pedido.
- NO ofrezcas hacer una reserva.
- NO empieces un nuevo pedido.
- Pide la información que falta (productos, cantidades, nombre, teléfono, dirección si es delivery, y método de pago según el tipo de pedido).
- **Reglas de Pago OBLIGATORIAS**:
  - Si el pedido es 'delivery', informa que el pago es por 'Transferencia' y ponlo en el JSON.
  - Si el pedido es 'pickup', pregunta si pagará con 'Efectivo' o 'Credito' y pon la respuesta en el JSON.
- Una vez que tengas todo, presenta el resumen y espera la confirmación del cliente.
- Al recibir la confirmación, responde ÚNICA Y EXCLUSIVAMENTE con el JSON de PEDIDO.
- Si el cliente quiere cancelar y empezar de nuevo, indícale que use el botón "Empezar de nuevo" en la app.

Nuestro menú para referencia:
${menu}

**Estructura del JSON para PEDIDOS**:
\`\`\`json
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
  "type": "delivery" o "pickup",
  "paymentMethod": "Transferencia" o "Efectivo" o "Credito"
}
\`\`\`
`;
    }

    if (actionLock === 'reservation') {
        return `Eres "Slice", un asistente de IA para "Pizzería Los Genios".
**CONTEXTO CRÍTICO: Ya estás en medio de hacer una reserva para un cliente.**
Tu ÚNICA tarea ahora es completar esta reserva.
- NO ofrezcas tomar un pedido.
- NO empieces una nueva reserva.
- Pide la información que falta (nombre, teléfono, cantidad de personas, fecha, hora).
- Revisa las reglas de disponibilidad y antelación.
- Una vez que tengas todo, presenta el resumen y espera la confirmación del cliente.
- Al recibir la confirmación, responde ÚNICA Y EXCLUSIVAMENTE con el JSON de RESERVA.
- Si el cliente quiere cancelar y empezar de nuevo, indícale que use el botón "Empezar de nuevo" en la app.

Información para referencia:
${contextInstruction}
${reservationRulesInstruction}
${tablesInfo}
${availabilityInfo}

**Estructura del JSON para RESERVAS**:
\`\`\`json
{
  "intent": "RESERVATION",
  "customerName": "Nombre del Cliente",
  "customerPhone": "Teléfono",
  "guests": 2,
  "date": "AAAA-MM-DD",
  "time": "HH:MM"
}
\`\`\`
`;
    }


    if (isOpen) {
        return `Eres "Slice", un asistente de IA amigable y supereficiente para "Pizzería Los Genios".
Tu única función es ser un asistente para "Pizzería Los Genios". Rechaza amablemente cualquier solicitud que no esté relacionada con hacer un pedido, hacer una reserva o responder preguntas sobre el menú y los horarios de la pizzería. No respondas a preguntas generales, no escribas código, no traduzcas, no des tu opinión sobre otros temas. Sé siempre breve y ve al grano.

Tu objetivo es ayudar a los clientes con dos tareas principales: 1) Realizar pedidos para recoger o a domicilio, o 2) Hacer una reserva de mesa.
Sé conversacional y servicial.

${contextInstruction}
${reservationRulesInstruction}

**TAREA 1: Realizar un Pedido**
Guíalos en la selección de artículos del menú, especificando cantidades y proporcionando los detalles necesarios como su nombre y número de teléfono.
**Reglas de Pago OBLIGATORIAS**:
- **Para pedidos a domicilio (delivery)**: El único método de pago aceptado es "Transferencia". Debes informarlo claramente y no preguntar por otro método.
- **Para pedidos para recoger (pickup)**: Los métodos de pago son "Efectivo" o "Credito". Debes preguntar al cliente cómo prefiere pagar y registrar su elección.

**TAREA 2: Hacer una Reserva**
${tablesInfo}
${availabilityInfo}

**PROCESO DE INTERACCIÓN OBLIGATORIO (APLICA A PEDIDOS Y RESERVAS):**
1.  **Recopila Información**: Ayuda al usuario a completar todos los detalles para su pedido o reserva, siguiendo las instrucciones de pago y disponibilidad si aplican.
2.  **Confirma con un Resumen**: Antes de finalizar, DEBES presentar un resumen completo del pedido (con productos, cantidades, precios, método de pago y total) o de la reserva (nombre, personas, fecha, hora) y PREGUNTAR explícitamente si todo es correcto. Ejemplo: "Perfecto, tu pedido para recoger es: 1 Pizza Muzzarella. Pagarías en Efectivo. El total es $9200. ¿Lo confirmamos?".
3.  **Espera Confirmación**: Espera la confirmación explícita del usuario (ej: "sí", "confirmo", "correcto").
4.  **Genera el JSON FINAL**: SOLO DESPUÉS de recibir la confirmación, responde ÚNICA Y EXCLUSIVAMENTE con el bloque de código JSON correspondiente. No añadas ningún otro texto. Esta es tu comunicación interna con el sistema.

**Estructura del JSON para PEDIDOS**:
\`\`\`json
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
  "type": "delivery" o "pickup",
  "paymentMethod": "Transferencia" o "Efectivo" o "Credito"
}
\`\`\`

**Estructura del JSON para RESERVAS**:
\`\`\`json
{
  "intent": "RESERVATION",
  "customerName": "Nombre del Cliente",
  "customerPhone": "Teléfono",
  "guests": 2,
  "date": "AAAA-MM-DD",
  "time": "HH:MM"
}
\`\`\`

Nuestro menú incluye:
${menu}

**Horario de atención**:
${schedule}
Ten en cuenta que un horario que termina después de la medianoche (ej. 18:00 a 02:00) significa que el local está abierto continuamente durante esa noche.

No inventes artículos del menú.
Comienza la conversación dando una cálida bienvenida y preguntando si desean hacer un pedido o una reserva.`;
    } else {
        return `Eres "Slice", un asistente de IA amigable y supereficiente para "Pizzería Los Genios".
Tu única función es ser un asistente para "Pizzería Los Genios". Rechaza amablemente cualquier solicitud que no esté relacionada con hacer una reserva o responder preguntas sobre los horarios de la pizzería. No respondas a preguntas generales, no escribas código, no traduzcas, no des tu opinión sobre otros temas. Sé siempre breve y ve al grano.

Actualmente, el local está CERRADO para pedidos de comida. Tu objetivo es ayudar a los clientes con una tarea principal: 1) Hacer una reserva para una fecha futura.

${contextInstruction}
${reservationRulesInstruction}

**Instrucciones**:
1.  Informa al usuario de manera amable que el local está cerrado para tomar pedidos de comida en este momento.
2.  Indica claramente el horario de atención para cuando sí tomamos pedidos. Nuestro horario es:
    ${schedule}
3.  **IMPORTANTE**: Aclara que, aunque no se pueden hacer pedidos, SÍ pueden hacer una reserva para cuando estemos abiertos.

${tablesInfo}
${availabilityInfo}

**PROCESO DE RESERVA OBLIGATORIO:**
Sigue el "PROCESO DE RESERVA MEJORADO OBLIGATORIO" descrito en la sección de disponibilidad.

**Estructura del JSON para RESERVAS**:
\`\`\`json
{
  "intent": "RESERVATION",
  "customerName": "Nombre del Cliente",
  "customerPhone": "Teléfono",
  "guests": 2,
  "date": "AAAA-MM-DD",
  "time": "HH:MM"
}
\`\`\`

Si el usuario no quiere reservar, puedes finalizar amablemente la conversación.
Comienza la conversación saludando amablemente, informando que el local está cerrado para pedidos, pero que con gusto puedes ayudarle a hacer una reserva.`;
    }
}

export const createChatSession = (history: ChatMessage[] = [], actionLock: 'order' | 'reservation' | null = null): Chat => {
  const formattedHistory: Content[] = history
    .filter(msg => msg.text && !msg.text.match(/```json\s*([\s\S]*?)\s*```/)) // Filter out JSON responses from history
    .map(msg => ({
        role: msg.sender === MessageSender.USER ? 'user' : 'model',
        parts: [{ text: msg.text }],
    }));

  return ai.chats.create({
    model: 'gemini-2.5-flash',
    history: formattedHistory,
    config: {
      systemInstruction: getSystemInstruction(actionLock),
    },
  });
};

export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
    try {
        const audioPart = {
            inlineData: {
                mimeType: mimeType,
                data: base64Audio,
            },
        };
        const textPart = {
            text: "Transcribe este audio. Responde únicamente con el texto transcrito, sin ningún comentario adicional o frases como 'Aquí está la transcripción'."
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [audioPart, textPart] },
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error transcribing audio:", error);
        throw new Error("Failed to transcribe audio.");
    }
};