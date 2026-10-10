import nodemailer from 'nodemailer';

// Envío de correos con SMTP. Se configura en backend/.env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM).
// Si no está configurado, no se envía nada y la app sigue funcionando (las alertas llegan igual a la campanita).
let transporte = null;

export function correoConfigurado() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
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
        console.log(`[correo] SMTP sin configurar: no se envió "${asunto}" a ${para}`);
        return false;
    }
    try {
        await obtenerTransporte().sendMail({
            from: process.env.SMTP_FROM || `Ahorra y Prospera <${process.env.SMTP_USER}>`,
            to: para,
            subject: asunto,
            html,
            text: texto,
        });
        return true;
    } catch (error) {
        console.error('[correo] No se pudo enviar:', error.message);
        return false;
    }
}
