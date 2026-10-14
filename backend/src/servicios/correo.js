import nodemailer from 'nodemailer';

// Envío de correos a cualquier dirección (Gmail, Yahoo, Hotmail, dominios institucionales como @iesantaelena.edu.co...).
// Formas, en este orden de preferencia (se configuran en backend/.env):
//   0) Google Apps Script con tu Gmail (gratis, funciona en Render): APPS_SCRIPT_URL + APPS_SCRIPT_CLAVE.
//   1) API de Brevo por HTTPS: BREVO_API_KEY + BREVO_FROM (funciona en Render gratis, que bloquea SMTP).
//   2) SMTP: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
// Si ninguna está configurada, no se envía nada y la app sigue funcionando (las alertas llegan igual a la campanita).
let transporte = null;

const usaAppsScript = () => Boolean(process.env.APPS_SCRIPT_URL && process.env.APPS_SCRIPT_CLAVE);
const usaBrevo = () => Boolean(process.env.BREVO_API_KEY && process.env.BREVO_FROM);
const usaSmtp = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export function correoConfigurado() {
    return usaAppsScript() || usaBrevo() || usaSmtp();
}

// Gmail gratis por HTTPS mediante un Google Apps Script propio (ver backend/scripts/enviar-correo.gs)
async function enviarPorAppsScript({ para, asunto, html, texto }) {
    const respuesta = await fetch(process.env.APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'content-type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ clave: process.env.APPS_SCRIPT_CLAVE, para, asunto, html, texto }),
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
    });
    const resultado = await respuesta.json().catch(() => null);
    if (!respuesta.ok || !resultado?.ok) throw new Error(`Apps Script: ${resultado?.error || respuesta.status}`);
}

// "Nombre <correo@dominio>" o solo "correo@dominio" → { name, email }
function separarRemitente(texto) {
    const m = String(texto).match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
    return m ? { name: m[1].replace(/^"|"$/g, '') || 'Ahorra y Prospera', email: m[2] } : { name: 'Ahorra y Prospera', email: String(texto).trim() };
}

async function enviarPorBrevo({ para, asunto, html, texto }) {
    const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: separarRemitente(process.env.BREVO_FROM), to: [{ email: para }], subject: asunto, htmlContent: html, textContent: texto }),
        signal: AbortSignal.timeout(15000),
    });
    if (!respuesta.ok) {
        const detalle = await respuesta.text().catch(() => '');
        throw new Error(`Brevo respondió ${respuesta.status}: ${detalle.slice(0, 200)}`);
    }
}

function obtenerTransporte() {
    if (!transporte) {
        const puerto = Number(process.env.SMTP_PORT) || 587;
        transporte = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: puerto,
            secure: puerto === 465,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
    }
    return transporte;
}

const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function plantillaAlerta({ nombre, titulo, mensaje, nivel = 'aviso', filas = [], boton = 'Ver mi presupuesto' }) {
    const color = nivel === 'critico' ? '#b91c1c' : '#15803d';
    const url = process.env.APP_URL || 'http://localhost:5000';
    return `<!DOCTYPE html><html lang="es"><body style="margin:0;background:#f4faf5;font-family:Segoe UI,Arial,sans-serif;color:#10231a">
  <div style="max-width:560px;margin:24px auto;background:#fff;border:1px solid #d7e7dc;border-radius:16px;overflow:hidden">
    <div style="background:#0b3d2e;color:#fff;padding:18px 24px;font-size:18px;font-weight:700">Ahorra y Prospera</div>
    <div style="padding:24px">
      <p style="margin:0 0 6px;color:#4b6358">Hola, ${escapar(nombre)}</p>
      <h2 style="margin:0 0 12px;font-size:20px;color:${color}">${escapar(titulo)}</h2>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.5">${escapar(mensaje)}</p>
      ${filas.length ? `<table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:14px">${filas.map((f) => `<tr><td style="padding:8px 0;border-bottom:1px solid #d7e7dc">${escapar(f.nombre)}</td><td style="padding:8px 0;border-bottom:1px solid #d7e7dc;text-align:right;font-weight:700">${escapar(f.valor)}</td></tr>`).join('')}</table>` : ''}
      <a href="${escapar(url)}/pages/app/presupuesto.html" style="display:inline-block;background:#15803d;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700">${escapar(boton)}</a>
      <p style="margin:24px 0 0;font-size:12px;color:#4b6358">Recibes este aviso porque activaste alertas en tu presupuesto. Los consejos son orientación educativa.</p>
    </div></div></body></html>`;
}

// Devuelve true si el correo salió; nunca lanza error (un fallo de correo no debe romper la app)
export async function enviarCorreo({ para, asunto, html, texto }) {
    if (!correoConfigurado()) {
        console.log(`[correo] Correo sin configurar: no se envió "${asunto}" a ${para}`);
        return false;
    }
    try {
        if (usaAppsScript()) {
            await enviarPorAppsScript({ para, asunto, html, texto });
        } else if (usaBrevo()) {
            await enviarPorBrevo({ para, asunto, html, texto });
        } else {
            await obtenerTransporte().sendMail({
                from: process.env.SMTP_FROM || `Ahorra y Prospera <${process.env.SMTP_USER}>`,
                to: para,
                subject: asunto,
                html,
                text: texto,
            });
        }
        return true;
    } catch (error) {
        console.error('[correo] No se pudo enviar:', error.message);
        return false;
    }
}
