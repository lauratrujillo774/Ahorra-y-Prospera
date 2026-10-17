// Chat con el asesor financiero y de inversiones (se usa en IA Financiera e Inversiones)
(() => {
  if (!document.getElementById('chatForm')) return;
  const { api } = window.APSesion;
  const { esc, $ } = window.UI;

  const historial = [];
  const caja = $('#chatMensajes');
  const SUGERENCIAS = [
    '¿Cómo empiezo a invertir?', '¿Qué es un CDT?', '¿Cómo armo mi fondo de emergencia?',
    '¿Pago deudas o invierto?', '¿Cómo diversifico mi dinero?', '¿Cómo detecto una estafa financiera?',
  ];

  const formato = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  function burbuja(rol, texto) {
    const d = document.createElement('div');
    d.className = `burbuja ${rol}`;
    d.innerHTML = rol === 'ia' ? formato(texto) : esc(texto);
    caja.appendChild(d);
    caja.scrollTop = caja.scrollHeight;
    return d;
  }

  function estado({ ia, restantes, limite, proveedorNombre, limiteAlcanzado }) {
    const modo = $('#chatModo');
    if (limiteAlcanzado) modo.textContent = `Llegaste al límite de ${limite} consultas con IA de hoy. Sigo respondiendo en modo básico; mañana se renuevan.`;
    else if (ia) modo.textContent = `Asesor con inteligencia artificial${proveedorNombre ? ` (${proveedorNombre})` : ''} · te quedan ${restantes} de ${limite} consultas gratis hoy.`;
    else modo.textContent = 'Asesor básico: responde los temas más comunes. Conecta una IA gratuita (Gemini o Groq) en backend/.env para respuestas sobre cualquier tema.';
  }

  burbuja('ia', '¡Hola! Soy tu asesor financiero. Te explico con palabras sencillas cómo ahorrar, salir de deudas e invertir con prudencia: CDT, fondos, bonos, acciones, riesgo y más. ¿Qué quieres aprender hoy?');
  $('#chatSugerencias').innerHTML = SUGERENCIAS.map((s) => `<button type="button" class="chip-sug">${esc(s)}</button>`).join('');

  async function preguntar(texto) {
    const mensaje = texto.trim();
    if (!mensaje) return;
    burbuja('yo', mensaje);
    $('#chatEntrada').value = '';
    $('#chatEnviar').disabled = true;
    const espera = burbuja('ia', 'Escribiendo…');
    espera.classList.add('espera');
    try {
      const r = await api('/chat/inversiones', { method: 'POST', cuerpo: { mensaje, historial: historial.slice(-10) } });
      espera.classList.remove('espera');
      espera.innerHTML = formato(r.respuesta);
      historial.push({ rol: 'user', texto: mensaje }, { rol: 'assistant', texto: r.respuesta });
      estado({ ia: r.modo === 'ia' || r.limiteAlcanzado, restantes: r.restantes, limite: r.limite, proveedorNombre: r.proveedorNombre, limiteAlcanzado: r.limiteAlcanzado });
    } catch (e) {
      espera.classList.remove('espera');
      espera.textContent = e.message;
    } finally {
      $('#chatEnviar').disabled = false;
      caja.scrollTop = caja.scrollHeight;
    }
  }

  window.APChat = { preguntar };
  $('#chatForm').addEventListener('submit', (e) => { e.preventDefault(); preguntar($('#chatEntrada').value); });
  $('#chatSugerencias').addEventListener('click', (e) => { const b = e.target.closest('.chip-sug'); if (b) preguntar(b.textContent); });
  api('/chat/estado').then((s) => estado({ ia: s.ia, restantes: s.restantes, limite: s.limite, limiteAlcanzado: s.ia && s.restantes === 0 })).catch(() => {});
})();
