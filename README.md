# Ahorra y Prospera — V7 TODO DE UNA

Proyecto web de educación y gestión financiera personal desarrollado con HTML, CSS y JavaScript.

## V7 incluye
- Dashboard financiero animado.
- Registro de ingresos, gastos y ahorros.
- Persistencia con localStorage.
- Balance y estadísticas dinámicas.
- Gráfica de ingresos vs. gastos.
- Presupuesto mensual con barra de progreso y alertas.
- Análisis de gastos por categorías.
- Metas de ahorro: crear y aportar dinero.
- Logros y calendario de actividad.
- Simulador educativo de inversión.
- Educación financiera con progreso de lecciones.
- Asistente de IA financiera simulado con respuestas dinámicas.
- Buscador y filtros en movimientos.
- Exportación de movimientos a CSV.
- Modo oscuro/claro.
- Configuración, reinicio de cursos y borrado de datos locales.
- Diseño responsive para computador y celular.

## Uso
Abre `index.html` en el navegador. Para que las gráficas funcionen se usa Chart.js desde CDN, por lo que se recomienda tener conexión a Internet.

Los datos personales de prueba se almacenan únicamente en el navegador mediante `localStorage`.

## Nota
Los simuladores y recomendaciones son educativos y no constituyen asesoría financiera.

## Estructura (V8)
- `frontend/index.html`: página de inicio (landing) con enlaces a registro e inicio de sesión.
- `frontend/pages/auth/`: `login.html` y `registro.html`.
- `frontend/pages/app/`: panel y módulos (dashboard, ingresos, gastos, ahorros, inversiones, educación, IA, configuración). Exigen sesión.
- `frontend/assets/css|js/`: estilos y scripts.
- `backend/src/routes/auth/auth.js`: `POST /auth/registro`, `POST /auth/login`, `GET /auth/yo`, `POST /auth/logout`, `GET /auth/monedas` (guarda en las tablas `usuarios` y `sesiones`).

## Cómo ejecutar
1. Enciende MySQL (XAMPP) con la base `ahorra_y_prospera`.
2. En `backend/`: `npm install` y `npm run dev`.
3. Abre http://localhost:5000

## Acceso con Google
1. En https://console.cloud.google.com crea un proyecto → *APIs y servicios* → *Credenciales* → *Crear credenciales* → *ID de cliente de OAuth* (tipo **Aplicación web**).
2. En *Orígenes autorizados de JavaScript* agrega `http://localhost:5000` (y la dirección pública cuando publiques el sitio).
3. Copia el ID de cliente en `backend/.env`: `GOOGLE_CLIENT_ID = xxxx.apps.googleusercontent.com` y reinicia el servidor.
Mientras esté vacío, el botón de Google no se muestra.

### Con Live Server
Abre `frontend/index.html` con *Open with Live Server* (el backend debe estar encendido en el puerto 5000: `npm run dev`).
Para Google, agrega también estos orígenes autorizados: `http://localhost:5500` y `http://127.0.0.1:5500`.

## Módulos conectados a la base de datos (V10)
Todas las tablas tienen su ruta en `backend/src/routes/` y su pantalla en `frontend/pages/app/`:
| Pantalla | Rutas | Tablas |
|---|---|---|
| Panel | `/resumen` | vistas de balance y resumen mensual |
| Ingresos / Gastos | `/ingresos`, `/gastos`, `/categorias` | `ingresos`, `gastos`, `categorias` |
| Presupuesto | `/presupuestos/:año/:mes` | `presupuestos`, `presupuesto_categorias` |
| Ahorros | `/metas`, `/cuentas` | `metas_ahorro`, `aportes_ahorro`, `cuentas_ahorro` |
| Inversiones | `/inversiones` | `inversiones`, `tipos_inversion` |
| Deudas y pagos | `/deudas`, `/pagos` | `deudas`, `pagos_deuda`, `pagos_programados` |
| Retos y logros | `/retos`, `/logros` | `retos_financieros`, `usuario_retos`, `logros`, `usuario_logros` |
| Educación | `/educacion` | `contenido_educativo`, `progreso_educativo` |
| IA / Plan financiero | `/plan`, `/recomendaciones` | `recomendaciones_ia` |
| Reportes | `/exportaciones` | `exportaciones` |
| Campana | `/notificaciones` | `notificaciones` |
| Configuración | `/perfil`, `/auth` | `usuarios`, `sesiones`, `monedas`, `roles` |

## Alertas por correo
Las alertas de presupuesto e ingresos llegan siempre a la campanita 🔔; para recibirlas también por correo (a cualquier dirección: Gmail, Yahoo, Hotmail, dominios institucionales como `@iesantaelena.edu.co` o `@elpoli.edu.co`) configura el envío en `backend/.env`.

**Opción recomendada (gratis, funciona también en Render): Google Apps Script con tu Gmail.**
1. Entra a script.google.com → *Nuevo proyecto* y pega el contenido de `backend/scripts/enviar-correo.gs`.
2. Cambia `CLAVE` por una frase larga y secreta.
3. *Implementar → Nueva implementación → Aplicación web* → Ejecutar como: **Yo** → Acceso: **Cualquier persona** → Implementar (acepta los permisos de Gmail).
4. Copia la URL que termina en `/exec` y ponla en `backend/.env` (y en Render):
```
APPS_SCRIPT_URL = https://script.google.com/macros/s/XXXX/exec
APPS_SCRIPT_CLAVE = <la misma clave del script>
APP_URL = http://localhost:5000
```
Prueba con `npm run probar-config alguien@iesantaelena.edu.co`. Gmail permite unos 100 correos al día con cuenta gratuita en Apps Script (1500 con Workspace).

**Otras alternativas** (se usan solo si no hay `APPS_SCRIPT_URL`): Brevo por API (`BREVO_API_KEY` y `BREVO_FROM`, revisa su plan gratuito) o SMTP:
```
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 587
SMTP_USER = tucorreo@gmail.com
SMTP_PASS = <contraseña de aplicación de Google, no tu contraseña normal>
SMTP_FROM = Ahorra y Prospera <tucorreo@gmail.com>
APP_URL = http://localhost:5000
```
Con Gmail: Cuenta de Google → Seguridad → Verificación en dos pasos → *Contraseñas de aplicaciones*. Reinicia el servidor después de guardar.
Se envía un aviso por tipo y por mes (no se repiten): "te queda poco de tus ingresos" (80% gastado), "gastaste todos tus ingresos", presupuesto total y límites por categoría al llegar a tu % de aviso y al superarlos.

## Inversiones, ganancias y asesor IA
- Elige un tipo de inversión, regístrala, edítala o elimínala, y simula su crecimiento por tipo.
- Con **💰 Ganancias** registras lo que te paga cada inversión (intereses, dividendos, cupones). Cada ganancia crea sola un ingreso en el mes de su fecha, categoría "Rendimientos"; si la editas o eliminas, el ingreso cambia con ella. La tabla `rendimientos_inversion` se crea automáticamente al iniciar el servidor.
- El chat **Asesor de inversiones** usa Claude si pones `ANTHROPIC_API_KEY` en `backend/.env` (clave de https://console.anthropic.com). Sin clave responde en modo básico: temas comunes de inversión (CDT, fondos, bonos, acciones, riesgo, diversificar, interés compuesto, etc.).

## IA gratuita para consejos financieros
El chat de **IA Financiera** e **Inversiones** y el resumen del **Plan** usan la primera IA que tenga clave en `backend/.env`:
1. `GEMINI_API_KEY` — **gratis**: https://aistudio.google.com/apikey (iniciar sesión con Google → *Create API key*).
2. `GROQ_API_KEY` — **gratis** (respaldo): https://console.groq.com/keys
3. `ANTHROPIC_API_KEY` — de pago (Claude).
Si una falla o llega a su cuota, se usa la siguiente; si ninguna responde, el asesor básico (sin IA). `IA_LIMITE_DIARIO` (por defecto 20) limita las consultas con IA por usuario y por día para no agotar la cuota gratuita.
Seguridad de las respuestas: la IA recibe reglas fijas (no promete rentabilidades, no recomienda activos concretos, recuerda fondo de emergencia y deudas antes de invertir, advierte de estafas y remite a la Superintendencia Financiera).
Para comprobar la configuración: `npm run probar-config` (en `backend/`).

## Novedades (V11)
- **Subsecciones (pestañas):** Ahorros (metas / cuentas), Deudas y pagos (registrar deuda / pagos programados), Inversiones (mis inversiones / tipos / simulador / ganancias / asesor IA), Educación (para ti / lecciones / actividades), IA Financiera (asesor / recomendaciones / plan), Presupuesto (mi presupuesto / presupuesto general).
- **Ingresos y gastos** son una sola opción del menú con dos pestañas.
- **Pagos programados:** alerta en la campanita y por correo cuando faltan 2 días o menos; al marcarlos como pagados se registran en Gastos (con la categoría que elijas).
- **Retos:** el progreso se calcula solo con tus movimientos. **Recompensas:** al sumar 50 / 150 / 300 puntos puedes reclamar un nivel (Bronce, Plata, Oro) que da consultas extra diarias con el asesor IA. Los puntos se ven en Gestión Financiera.
- **Educación dinámica:** lecciones recomendadas según tu situación, lección escrita por la IA con tus números y actividades (quiz) generadas por la IA.
- **Tipos de inversión:** 22 tipos con explicación, ventajas, riesgos y botones *Invertir* y *Aprende más con la IA*.
- **Plan financiero:** eliges para qué lo quieres (general, vivienda, vehículo, deudas, retiro, invertir…); el reparto y las recomendaciones cambian.
- **Reportes:** eliges por secciones (12) qué incluir en el Excel.
- **Configuración:** foto de perfil y conversión de todos tus valores al cambiar de moneda (tasas de referencia de la tabla `monedas`).

## Integración con n8n
La app habla con [n8n](https://n8n.io) en las dos direcciones. Todo es opcional: sin configurar, no pasa nada.

**Salida (la app avisa a n8n)** — pon en `backend/.env`:
```
N8N_WEBHOOK_URL = http://localhost:5678/webhook/ahorra-y-prospera   # URL del nodo Webhook de tu flujo
N8N_SECRET = una-frase-larga-secreta                                # firma HMAC de cada aviso
```
Eventos que envía (POST JSON `{ evento, app, fecha, datos }`, cabeceras `x-ap-evento` y `x-ap-firma` = HMAC-SHA256 del cuerpo):
`usuario_registrado`, `alerta` (presupuesto, ingresos vs. gastos, pagos próximos), `presupuesto_generado`, `logro`, `pago_realizado`.

**Entrada (n8n le habla a la app)** — pon `N8N_API_KEY` (mínimo 16 caracteres) y llama con la cabecera `x-api-key`:
- `GET /n8n/estado` — comprueba la conexión.
- `POST /n8n/notificar` `{ correo, titulo, mensaje }` — crea una notificación en la campanita del usuario.
- `GET /n8n/resumen-semanal?dias=7` — ingresos, gastos, balance y deudas de cada usuario activo (para armar un correo o mensaje semanal).

Hay un flujo de ejemplo para importar en n8n (*Import from file*): `docs/n8n/flujo-ahorra-y-prospera.json` (recibe los eventos, manda un correo de bienvenida con Gmail a los usuarios nuevos y devuelve un eco a la campanita). Cambia `PON_AQUI_TU_N8N_API_KEY` por tu clave y conecta tu credencial de Gmail.

### n8n: más eventos, entradas y flujos
**Más eventos de salida:** `ingreso_registrado`, `gasto_registrado` (con `grande: true` si supera el 20% de los ingresos del mes), `meta_cumplida`, `deuda_pagada`, `reto_completado`, `recompensa_reclamada`, `ganancia_inversion`, `plan_generado`, `reporte_generado`.

**Más endpoints de entrada** (cabecera `x-api-key`):
- `POST /n8n/ingreso` y `POST /n8n/gasto` `{ correo, monto, descripcion?, categoria?, fecha? }` — registra movimientos desde Telegram, WhatsApp, Google Sheets, formularios… (la categoría se busca por nombre, sin importar mayúsculas ni tildes).
- `POST /n8n/aporte-meta` `{ correo, meta, monto }` — aporta a una meta activa (basta una parte del nombre).
- `GET /n8n/usuario?correo=…` — foto rápida del mes de un usuario (para un bot que responda "¿cómo voy?").
- `GET /n8n/pagos-proximos?dias=3` — pagos que vencen pronto de todos los usuarios (recordatorios por otro canal).
- `GET /n8n/usuarios-en-riesgo` — usuarios que ya gastaron 80% o más de sus ingresos.

**Flujos para importar** (`docs/n8n/`): `flujo-ahorra-y-prospera.json` (bienvenida), `flujo-telegram-registrar-gastos.json` (escribes "gasto 25000 almuerzo" en Telegram y se registra; "resumen" te responde cómo vas) y `flujo-resumen-semanal-y-recordatorios.json` (correo cada lunes y recordatorio diario de pagos). En todos cambia `PON_AQUI_TU_N8N_API_KEY` (y tu correo en el de Telegram) y conecta tus credenciales.

> Detalle completo de la integración con n8n (qué hay y en qué archivo): [`readme/n8n.md`](readme/n8n.md)

> Guía completa de qué hace cada archivo, cómo funcionan los correos y la IA: [`readme/guia-del-proyecto.md`](readme/guia-del-proyecto.md)

> Despliegue en internet paso a paso (Render + Aiven): sección 9 de [`readme/guia-del-proyecto.md`](readme/guia-del-proyecto.md)
