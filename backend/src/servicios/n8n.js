import { createHmac } from 'node:crypto';

// Integración con n8n (automatización de flujos): la app AVISA a n8n de lo que pasa (webhook de salida).
// Se activa poniendo N8N_WEBHOOK_URL en backend/.env; si está vacío no hace nada.
// Cada aviso va firmado con HMAC-SHA256 (cabecera x-ap-firma) usando N8N_SECRET, para que n8n verifique que viene de esta app.

export const n8nActivo = () => Boolean(process.env.N8N_WEBHOOK_URL);

// Dispara un evento hacia n8n. Nunca lanza error ni retrasa la respuesta de la app.
// evento: 'usuario_registrado' | 'alerta' | 'logro' | 'pago_realizado' | 'presupuesto_generado' ...
export function emitirEvento(evento, datos = {}) {
    if (!n8nActivo()) return;
    const cuerpo = JSON.stringify({ evento, app: 'ahorra-y-prospera', fecha: new Date().toISOString(), datos });
    const cabeceras = { 'content-type': 'application/json', 'x-ap-evento': evento };
    if (process.env.N8N_SECRET) cabeceras['x-ap-firma'] = createHmac('sha256', process.env.N8N_SECRET).update(cuerpo).digest('hex');
    fetch(process.env.N8N_WEBHOOK_URL, { method: 'POST', headers: cabeceras, body: cuerpo, signal: AbortSignal.timeout(5000) })
        .then((r) => { if (!r.ok) console.error(`[n8n] ${evento}: n8n respondió ${r.status}`); })
        .catch((e) => console.error(`[n8n] ${evento}: no se pudo avisar (${e.message})`));
}
