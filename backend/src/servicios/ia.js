// Capa única para hablar con una IA. Soporta proveedores con capa GRATUITA (Gemini y Groq) y Claude (de pago).
// Se usa el primero que tenga clave en el .env; con IA_PROVIDER=gemini|groq|anthropic puedes elegir cuál va primero.

// Google retira modelos con frecuencia: se prueban en orden y se usa el primero disponible para tu cuenta
const MODELOS_GEMINI = [process.env.GEMINI_MODEL, 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash'].filter(Boolean);

export function proveedoresDisponibles() {
    const lista = [];
    if (process.env.GEMINI_API_KEY) lista.push('gemini');
    if (process.env.GROQ_API_KEY) lista.push('groq');
    if (process.env.ANTHROPIC_API_KEY) lista.push('anthropic');
    const forzado = (process.env.IA_PROVIDER || '').toLowerCase();
    return forzado && lista.includes(forzado) ? [forzado, ...lista.filter((p) => p !== forzado)] : lista;
}

export const iaDisponible = () => proveedoresDisponibles().length > 0;

export const NOMBRES = { gemini: 'Gemini (Google)', groq: 'Llama (Groq)', anthropic: 'Claude' };

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Un error pasajero del servidor (500/502/503) se reintenta una vez antes de rendirse
async function pedir(url, opciones, intento = 1) {
    const respuesta = await fetch(url, { ...opciones, signal: AbortSignal.timeout(25000) });
    const json = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
        if (intento < 2 && [500, 502, 503].includes(respuesta.status)) {
            await esperar(700);
            return pedir(url, opciones, intento + 1);
        }
        const error = new Error(json.error?.message || `HTTP ${respuesta.status}`);
        error.estado = respuesta.status;
        throw error;
    }
    return json;
}

async function conGemini({ sistema, mensajes, maxTokens }) {
    let ultimo;
    for (const modelo of [...new Set(MODELOS_GEMINI)]) {
        try {
            const json = await pedir(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: sistema }] },
                    contents: mensajes.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
                    generationConfig: { maxOutputTokens: maxTokens + 1024, temperature: 0.4 }, // margen para el "pensamiento" interno del modelo
                }),
            });
            const texto = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
            if (!texto) throw new Error(json.promptFeedback?.blockReason ? `Bloqueado: ${json.promptFeedback.blockReason}` : 'Respuesta vacía');
            return texto;
        } catch (error) {
            ultimo = error;
            // Modelo inexistente (404/400) o saturado (429/503): se prueba el siguiente; otros errores (clave inválida, etc.) se propagan
            if (![400, 404, 429, 503].includes(error.estado)) throw error;
        }
    }
    throw ultimo;
}

async function conGroq({ sistema, mensajes, maxTokens }) {
    const json = await pedir('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
            model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
            max_tokens: maxTokens,
            temperature: 0.4,
            messages: [{ role: 'system', content: sistema }, ...mensajes],
        }),
    });
    const texto = json.choices?.[0]?.message?.content?.trim();
    if (!texto) throw new Error('Respuesta vacía');
    return texto;
}

async function conAnthropic({ sistema, mensajes, maxTokens }) {
    const json = await pedir('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: maxTokens, system: sistema, messages: mensajes }),
    });
    const texto = json.content?.map((b) => b.text || '').join('').trim();
    if (!texto) throw new Error('Respuesta vacía');
    return texto;
}

const FUNCIONES = { gemini: conGemini, groq: conGroq, anthropic: conAnthropic };

// mensajes: [{ role: 'user' | 'assistant', content }] (debe empezar y terminar con 'user')
export async function generarTexto({ sistema, mensajes, maxTokens = 700 }) {
    const errores = [];
    for (const proveedor of proveedoresDisponibles()) {
        try {
            return { texto: await FUNCIONES[proveedor]({ sistema, mensajes, maxTokens }), proveedor };
        } catch (error) {
            console.error(`[ia] ${proveedor} falló: ${error.message}`);
            errores.push(`${proveedor}: ${error.message}`);
        }
    }
    throw new Error(errores.length ? errores.join(' | ') : 'No hay ninguna IA configurada');
}

// Prueba un proveedor concreto (lo usa npm run probar-config)
export async function generarCon(proveedor, args) {
    return FUNCIONES[proveedor](args);
}
