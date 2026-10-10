// Página de inicio: menú móvil y botones según haya sesión o no
(() => {
  const boton = document.getElementById('menuBoton');
  const menu = document.getElementById('menu');
  if (boton && menu) {
    boton.addEventListener('click', () => {
      const abierto = menu.classList.toggle('abierto');
      boton.setAttribute('aria-expanded', abierto);
    });
    menu.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') { menu.classList.remove('abierto'); boton.setAttribute('aria-expanded', 'false'); }
    });
  }

  const hayToken = !!(window.APSesion && window.APSesion.token());
  document.querySelectorAll('[data-sin-sesion]').forEach((el) => { el.hidden = hayToken; });
  document.querySelectorAll('[data-con-sesion]').forEach((el) => { el.hidden = !hayToken; });
})();
