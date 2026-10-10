// Comprueba la configuración del .env: IA (Gemini, Groq o Claude) y correo (SMTP). Uso: npm run probar-config [correo-destino]
import '../src/config/env.js';
import { correoConfigurado, enviarCorreo, plantillaAlerta } from '../src/servicios/correo.js';
import { generarCon, NOMBRES, proveedoresDisponibles } from '../src/servicios/ia.js';

const ok = (t) => console.log(`  ✅ ${t}`);
const mal = (t) => console.log(`  ❌ ${t}`);
const info = (t) => console.log(`     ${t}`);

console.log('\n── IA (chat de consejos y resumen del plan) ──');
const proveedores = proveedoresDisponibles();
if (!proveedores.length) {
    mal('Ninguna IA configurada (GEMINI_API_KEY, GROQ_API_KEY y ANTHROPIC_API_KEY están vacías).');
    info('El chat funciona en modo básico. Opción GRATIS recomendada: GEMINI_API_KEY (https://aistudio.google.com/apikey).');
} else {
    info(`Orden de uso: ${proveedores.map((x) => NOMBRES[x]).join(' → ')}`);
}
for (const proveedor of proveedores) {
    try {
        const texto = await generarCon(proveedor, {
            sistema: 'Responde en español, muy breve.',
            mensajes: [{ role: 'user', content: 'Responde solo la palabra: listo' }],
            maxTokens: 40,
        });
        ok(`${NOMBRES[proveedor]} respondió: "${texto.slice(0, 40)}"`);
    } catch (e) {
        mal(`${NOMBRES[proveedor]} falló: ${e.message}`);
        if (e.estado === 401 || e.estado === 403) info('La clave no es válida o no tiene permiso: genera una nueva y cópiala completa, sin comillas ni espacios.');
        if (e.estado === 429) info('Superaste la cuota gratuita por ahora: espera un rato o configura una segunda IA como respaldo.');
        if (e.estado === 400 || e.estado === 404) info('Modelo no disponible para tu cuenta: puedes fijar otro con GEMINI_MODEL o GROQ_MODEL en el .env.');
    }
}

console.log('\n── Correo para alertas (SMTP) ──');
const faltan = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter((k) => !process.env[k]);
if (faltan.length) {
    mal(`Faltan en backend/.env: ${faltan.join(', ')}`);
    info('Sin esto las alertas llegan solo a la campanita.');
} else if (!correoConfigurado()) {
    mal('La configuración de correo está incompleta.');
} else {
    const destino = process.argv[2] || process.env.SMTP_USER;
    ok(`Datos de correo presentes (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}, usuario ${process.env.SMTP_USER}).`);
    info(`Enviando un correo de prueba a ${destino}…`);
    const salio = await enviarCorreo({
        para: destino,
        asunto: 'Prueba de alertas · Ahorra y Prospera',
        html: plantillaAlerta({ nombre: 'tú', titulo: '¡Tu correo está bien configurado!', mensaje: 'Así te llegarán los avisos de tu presupuesto y de tus ingresos.', boton: 'Abrir mi presupuesto' }),
        texto: '¡Tu correo está bien configurado! Así te llegarán los avisos de tu presupuesto.',
    });
    if (salio) ok('Correo enviado. Revisa tu bandeja de entrada (y la carpeta de spam).');
    else {
        mal('No se pudo enviar. Revisa el mensaje de error que aparece arriba.');
        info('Con Gmail: usa una "contraseña de aplicación" (16 letras, sin espacios), no tu contraseña normal; SMTP_HOST = smtp.gmail.com y SMTP_PORT = 587.');
    }
}
console.log('');
process.exit(0);
