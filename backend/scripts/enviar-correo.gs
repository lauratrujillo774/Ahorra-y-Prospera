// Google Apps Script que envía los correos de Ahorra y Prospera con tu Gmail (gratis, a cualquier dirección).
// Pasos: script.google.com → Nuevo proyecto → pega este código → cambia CLAVE por una frase larga y secreta →
// Implementar → Nueva implementación → tipo "Aplicación web" → Ejecutar como: Yo → Acceso: Cualquier persona → Implementar.
// Copia la URL que termina en /exec a APPS_SCRIPT_URL y la misma CLAVE a APPS_SCRIPT_CLAVE (en backend/.env y en Render).
const CLAVE = 'CAMBIA-ESTA-CLAVE';

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.clave !== CLAVE) return salida({ ok: false, error: 'clave incorrecta' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.para)) return salida({ ok: false, error: 'correo inválido' });
    GmailApp.sendEmail(d.para, d.asunto, d.texto || '', { htmlBody: d.html, name: 'Ahorra y Prospera' });
    return salida({ ok: true });
  } catch (err) {
    return salida({ ok: false, error: String(err) });
  }
}

function salida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
