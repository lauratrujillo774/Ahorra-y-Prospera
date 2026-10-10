# Integración con n8n — qué se implementó y dónde está

n8n es una herramienta de automatización. La app se conecta con ella en **dos direcciones**:

1. **Salida:** la app *avisa* a n8n cuando pasa algo (webhook).
2. **Entrada:** n8n *le habla* a la app para registrar datos o consultar información (API protegida con clave).

Todo es opcional: si las variables de `backend/.env` están vacías, la integración queda apagada y la app funciona igual.

---

## 1. Configuración (`backend/.env`)

| Variable | Para qué sirve |
|---|---|
| `N8N_WEBHOOK_URL` | URL del nodo *Webhook* de tu flujo en n8n. Si está vacía, no se envía nada. |
| `N8N_SECRET` | Frase secreta con la que se firma cada aviso (HMAC-SHA256) para que n8n compruebe que viene de esta app. |
| `N8N_API_KEY` | Clave (mínimo 16 caracteres) que n8n debe mandar en la cabecera `x-api-key` para usar los endpoints de entrada. |

---

## 2. Salida: la app avisa a n8n

### 2.1 El motor de envío
| Qué | Archivo |
|---|---|
| Función `emitirEvento(evento, datos)`: envía el POST firmado en segundo plano, con tiempo límite de 5 s y sin romper la app si n8n falla | `backend/src/servicios/n8n.js` |

Cada aviso es un POST JSON `{ evento, app, fecha, datos }` con las cabeceras `x-ap-evento` (nombre del evento) y `x-ap-firma` (HMAC-SHA256 del cuerpo).

### 2.2 Eventos y dónde se disparan

| # | Evento | Cuándo ocurre | Archivo |
|---|---|---|---|
| 1 | `usuario_registrado` | Alguien crea su cuenta con correo | `backend/src/routes/auth/auth.js` (en `POST /auth/registro`) |
| 2 | `usuario_registrado` | Alguien se registra por primera vez con Google | `backend/src/routes/auth/auth.js` (en `POST /auth/google`) |
| 3 | `alerta` | Se genera una alerta de la campanita/correo: "te queda poco de tus ingresos", "gastaste todos tus ingresos", presupuesto total, límite de una categoría, pago que vence en 2 días o menos | `backend/src/servicios/alertas.js` (función `alertar`) |
| 4 | `presupuesto_generado` | Se guarda un presupuesto hecho con IA | `backend/src/servicios/alertas.js` (función `notificarPresupuestoGenerado`) |
| 5 | `logro` | El usuario gana una insignia | `backend/src/servicios/logros.js` (función `otorgarLogro`) |
| 6 | `pago_realizado` | Se marca un pago programado como pagado | `backend/src/routes/presupuesto/pagos.js` |
| 7 | `ingreso_registrado` | Se registra un ingreso | `backend/src/utils/movimientosRouter.js` |
| 8 | `gasto_registrado` | Se registra un gasto (trae `grande: true` si supera el 20 % de los ingresos del mes) | `backend/src/utils/movimientosRouter.js` |
| 9 | `meta_cumplida` | Un aporte completa una meta de ahorro | `backend/src/routes/ahorro/metas.js` y, cuando el aporte viene de n8n, `backend/src/routes/integraciones/n8n.js` |
| 10 | `deuda_pagada` | Una deuda queda pagada por completo | `backend/src/routes/deudas/deudas.js` |
| 11 | `reto_completado` | Un reto financiero llega al 100 % | `backend/src/servicios/retos.js` |
| 12 | `recompensa_reclamada` | El usuario reclama una recompensa (Bronce, Plata, Oro) | `backend/src/routes/cuenta/logros.js` |
| 13 | `ganancia_inversion` | Se registra una ganancia de una inversión | `backend/src/routes/ahorro/inversiones.js` |
| 14 | `plan_generado` | Se genera un plan financiero con IA | `backend/src/routes/plan/plan.js` |
| 15 | `reporte_generado` | Se descarga un reporte en Excel | `backend/src/routes/cuenta/exportaciones.js` (ruta `POST /exportaciones`) |
| 16 | `reporte_generado` | Se descarga un reporte en PDF | `backend/src/routes/cuenta/exportaciones.js` (ruta `POST /exportaciones/pdf`) |

En total son **14 tipos de evento** distintos (los números 1-2 y 15-16 comparten nombre).

---

## 3. Entrada: n8n le habla a la app

Todos los endpoints están en **`backend/src/routes/integraciones/n8n.js`**. El cargador automático de rutas (`backend/src/routes/index.js`) los publica bajo `/n8n`.

**Seguridad:** todos exigen la cabecera `x-api-key` igual a `N8N_API_KEY` (se compara con `timingSafeEqual`). Sin la variable configurada responden `503`; con clave incorrecta, `401`.

| Endpoint | Para qué sirve |
|---|---|
| `GET /n8n/estado` | Comprobar que la conexión funciona |
| `POST /n8n/notificar` `{ correo, titulo, mensaje }` | Crear una notificación en la campanita de un usuario |
| `GET /n8n/resumen-semanal?dias=7` | Ingresos, gastos, balance y deudas de cada usuario activo (para correos/mensajes semanales) |
| `POST /n8n/ingreso` `{ correo, monto, descripcion?, categoria?, fecha? }` | Registrar un ingreso desde otra app (Telegram, WhatsApp, Sheets…). Da logros y dispara alertas |
| `POST /n8n/gasto` `{ correo, monto, descripcion?, categoria?, fecha? }` | Registrar un gasto desde otra app. La categoría se busca por nombre sin importar mayúsculas ni tildes; si no existe usa "Otros gastos" |
| `POST /n8n/aporte-meta` `{ correo, meta, monto }` | Aportar a una meta de ahorro activa (basta una parte del nombre) |
| `GET /n8n/usuario?correo=…` | Foto rápida del mes de un usuario (ingresos, gastos, presupuesto, próximos pagos, metas) para un bot |
| `GET /n8n/pagos-proximos?dias=3` | Pagos programados de todos los usuarios que vencen pronto (recordatorios por otro canal) |
| `GET /n8n/usuarios-en-riesgo` | Usuarios que ya gastaron el 80 % o más de sus ingresos del mes |

---

## 4. Flujos de ejemplo para importar en n8n

Carpeta **`docs/n8n/`** (en n8n: *Workflows → Import from file*).

| Archivo | Qué hace |
|---|---|
| `flujo-ahorra-y-prospera.json` | Recibe los eventos de la app, manda un correo de bienvenida con Gmail a los usuarios nuevos y deja un eco en la campanita |
| `flujo-telegram-registrar-gastos.json` | Escribes `gasto 25000 almuerzo` o `ingreso 1500000 salario` en Telegram y se registra en la app; `resumen` te responde cómo vas este mes |
| `flujo-resumen-semanal-y-recordatorios.json` | Cada lunes a las 8:00 envía por correo el resumen de la semana de cada usuario; cada día a las 9:00 recuerda en la campanita los pagos que vencen en 2 días |

En cada flujo hay que cambiar `PON_AQUI_TU_N8N_API_KEY` por tu clave y conectar tus credenciales (Gmail, Telegram). En el de Telegram también va tu correo de la app.

---

## 5. Cómo activarlo

1. En n8n crea un flujo con un nodo **Webhook** (método POST) y copia su URL en `N8N_WEBHOOK_URL`.
2. Escribe una frase larga en `N8N_SECRET`.
3. Para los endpoints de entrada, pon una clave de al menos 16 caracteres en `N8N_API_KEY`.
4. Reinicia el servidor (`rs` en la terminal de nodemon).
5. Prueba con `GET /n8n/estado` y la cabecera `x-api-key`.

## 6. Qué se probó y qué no

- **Probado:** el envío de cada evento con firma válida y los endpoints de entrada (clave correcta e incorrecta, validaciones, registro de movimientos, aportes, consultas), usando un servidor n8n simulado.
- **No probado:** con una instalación real de n8n ni con las credenciales de Gmail o Telegram. Los tres flujos JSON se validaron como archivos correctos (nodos y conexiones), pero hay que importarlos y ajustarlos en tu n8n.

## 7. Aviso de privacidad y seguridad

- Los eventos incluyen datos como nombre y correo del usuario y solo salen hacia la URL que tú configures: usa tu propio n8n.
- Los endpoints de entrada permiten registrar movimientos de cualquier usuario si se conoce su correo y la `N8N_API_KEY`: usa una clave larga, no la compartas y no expongas el servidor a internet sin HTTPS.
