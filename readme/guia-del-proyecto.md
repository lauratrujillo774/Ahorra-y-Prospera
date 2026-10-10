# Guía del proyecto "Ahorra y Prospera"

Qué hace cada archivo, cómo está armada la aplicación y cómo se implementaron los correos, la inteligencia artificial y otras partes clave.

---

## 1. Visión general

Es una aplicación web de finanzas personales:

- **Frontend** (`frontend/`): páginas HTML + CSS + JavaScript puro, sin frameworks. Se abre con Live Server o la sirve el propio backend.
- **Backend** (`backend/`): servidor **Node.js + Express** que expone una API y guarda todo en **MySQL** (base `ahorra_y_prospera`).
- **Comunicación:** el navegador llama a la API con `fetch`, enviando un token de sesión en la cabecera `Authorization: Bearer <token>`.

```
Navegador (frontend)  ──fetch──►  Express (backend)  ──SQL──►  MySQL
        ▲                              │
        │                              ├──► Correo (Gmail por SMTP)
        └──── pantallas HTML ◄─────    ├──► IA (Gemini / Groq / Claude)
                                       └──► n8n (webhooks)
```

**Cómo arranca el backend:** `app.js` carga el `.env`, se conecta a MySQL, ejecuta las migraciones, levanta el servidor y programa la revisión horaria de notificaciones. El servidor registra solo todas las rutas que encuentre en `src/routes/<carpeta>/<archivo>.js`: cada archivo se publica bajo `/<nombre-del-archivo>` (por ejemplo `routes/finanzas/gastos.js` → `/gastos`).

---

## 2. Backend — archivo por archivo

### Raíz de `backend/`
| Archivo | Qué hace |
|---|---|
| `app.js` | Punto de entrada. Conecta a MySQL, corre las migraciones, inicia el servidor Express y arranca el revisor horario de notificaciones. |
| `.env` | Configuración secreta (base de datos, claves de Google, de IA, de correo SMTP, de n8n). **No se debe compartir ni subir a internet.** |
| `package.json` | Lista de dependencias (express, mysql2, cors, express-fileupload, nodemailer, exceljs, pdfkit, dotenv) y de comandos (`npm start`, `npm run dev`, `npm run probar-config`). Ojo: también trae los comandos `exportar-bd`, `importar-bd` y `subir-archivos`, que apuntan a una carpeta `database/` que **no existe** en el proyecto, así que no funcionan. |
| `package-lock.json`, `pnpm-lock.yaml` | Versiones exactas de las dependencias instaladas. Hay uno de npm y otro de pnpm porque se mezclaron gestores; conviene usar solo uno (yo usé npm). |
| `scripts/probar-config.mjs` | Herramienta de diagnóstico (`npm run probar-config`): prueba de verdad cada IA configurada y manda un correo de prueba para confirmar que el `.env` está bien. |
| `uploads/` | Carpeta donde se guardan las fotos de perfil subidas (el servidor las sirve en `/uploads/...`). |

### `src/config/`
| Archivo | Qué hace |
|---|---|
| `env.js` | Carga el `.env` y fija la zona horaria de Colombia (`America/Bogota`). |
| `mysql/dbmysql.js` | Crea el *pool* de conexiones MySQL (reutiliza conexiones), devuelve los DECIMAL como número y las fechas como texto `AAAA-MM-DD`, ajusta la hora de la sesión y expone `dbConnectMysql()` que prueba la conexión al arrancar. |

### `src/server/`
| Archivo | Qué hace |
|---|---|
| `express.server.js` | Clase `Server`: configura Express (CORS, JSON, subida de archivos de hasta 5 MB), sirve `/uploads` y la carpeta `frontend/` como sitio web, carga las rutas y maneja errores de JSON inválido. |

### `src/middleware/`
| Archivo | Qué hace |
|---|---|
| `sesion.js` | `requiereSesion`: lee el token de la cabecera, busca la sesión abierta en la tabla `sesiones`, comprueba que el usuario esté activo y deja el usuario en `req.usuario`. Si no es válido responde 401. Lo usan todas las rutas privadas. |

### `src/utils/` (funciones de apoyo)
| Archivo | Qué hace |
|---|---|
| `contrasenas.js` | Cifra y verifica contraseñas con **scrypt** y sal aleatoria (nunca se guarda la contraseña en texto plano). |
| `validar.js` | Validaciones pequeñas compartidas: fechas, números, textos recortados, respuestas de error 400/500. |
| `fotos.js` | Define la carpeta `uploads/` y responde 404 si una foto no existe. |
| `movimientosRouter.js` | Fábrica que crea las rutas de **ingresos** y **gastos** (listar por mes, crear, editar, borrar), porque son casi idénticas. Al guardar revisa logros y alertas y avisa a n8n. |

### `src/routes/` — la API (una carpeta por tema)

**`auth/`**
| Archivo | Qué hace |
|---|---|
| `auth.js` | Registro, inicio de sesión, cierre de sesión, `GET /auth/yo` (quién soy), lista de monedas y **acceso con Google** (verifica el token de Google y crea o abre la cuenta). Bloquea la cuenta tras 5 contraseñas incorrectas. Cada sesión se guarda en la tabla `sesiones`. |

**`finanzas/`**
| Archivo | Qué hace |
|---|---|
| `ingresos.js`, `gastos.js` | Una línea cada uno: usan `movimientosRouter.js`. |
| `categorias.js` | Categorías del sistema y las propias del usuario (listar, crear, borrar). |

**`presupuesto/`**
| Archivo | Qué hace |
|---|---|
| `presupuestos.js` | Presupuesto por mes: total, límites por categoría (no pueden sumar más que el total), historial "presupuesto general", sugerencia con historial de 3 meses y **sugerencia con IA según tus ingresos**. Hereda automáticamente el presupuesto del mes anterior. |
| `pagos.js` | Pagos programados (cuotas, facturas). Al marcarlos como pagados crea el gasto, abona a la deuda si corresponde y reprograma el siguiente si es recurrente. |

**`ahorro/`**
| Archivo | Qué hace |
|---|---|
| `metas.js` | Metas de ahorro y sus aportes (un *trigger* de MySQL suma el aporte y marca la meta cumplida). |
| `cuentas.js` | Cuentas de ahorro (banco, billetera, efectivo). |
| `inversiones.js` | Inversiones, tipos de inversión y **ganancias** (cada ganancia crea un ingreso en el mes de su fecha). Crea sola la tabla `rendimientos_inversion`. |
| `chat.js` | Chat con el asesor financiero con IA y control del límite diario de consultas. |

**`deudas/`** — `deudas.js`: registrar deudas y sus pagos (un *trigger* actualiza el saldo y el estado).

**`plan/`** — `plan.js`: trae tus datos guardados, genera el **plan financiero** (con su objetivo) y descarga el Excel del plan. Guarda las recomendaciones en la base de datos.

**`cuenta/`**
| Archivo | Qué hace |
|---|---|
| `resumen.js` | Todo lo que necesita el panel de Gestión Financiera en una sola llamada (mes, serie de 6 meses, patrimonio, puntos…). |
| `notificaciones.js` | Campanita: listar, marcar como leídas, eliminar. Al listar, revisa los recordatorios pendientes. |
| `retos.js`, `logros.js` | Retos financieros (progreso automático), logros, puntos, niveles y recompensas. |
| `educacion.js` | Lecciones, progreso, educación personalizada, lección generada por IA y actividades (quiz). |
| `recomendaciones.js` | Lista las recomendaciones guardadas por el plan financiero. |
| `perfil.js` | Datos del usuario, foto de perfil, **cambio de moneda con conversión de todos los valores**, cambio de contraseña y sesiones abiertas. |
| `exportaciones.js` | Reportes por secciones en **Excel** (ExcelJS) y en **PDF**; guarda el historial de exportaciones. |

**`integraciones/`** — `n8n.js`: endpoints para que n8n le escriba a la app (ver `readme/n8n.md`).

**`api/`** — `salud.js`: `GET /salud` comprueba que el servidor y la base de datos responden.

**`index.js`** — cargador automático de rutas (explicado arriba).

### `src/servicios/` (la lógica de negocio)
| Archivo | Qué hace |
|---|---|
| `migraciones.js` | Cambios pequeños a la base al iniciar (seguros de repetir): amplía el tipo de reporte, agrega 16 tipos de inversión más y crea la tabla de recompensas. |
| `notificaciones.js` | Cada hora revisa a todos los usuarios activos: hereda el presupuesto del mes, avisa de deudas vencidas y metas próximas y llama a las alertas financieras. |
| `alertas.js` | Genera las alertas (campanita **y correo**): "te queda poco de tus ingresos", presupuesto total y por categoría, pagos que vencen en 2 días o menos, presupuesto generado con IA. Cada alerta se manda una sola vez por mes/pago. |
| `correo.js` | Envío de correos (ver sección 3). |
| `presupuestoMensual.js` | Copia el presupuesto más reciente al mes nuevo si el usuario aún no creó uno. |
| `logros.js` | Entrega logros, calcula puntos, niveles (Bronce/Plata/Oro) y las consultas extra de IA que da cada recompensa. |
| `retos.js` | Calcula el progreso de cada reto con los movimientos reales del usuario y los completa o cierra solos. |
| `planFinanciero.js` | Motor de cálculo del plan: diagnóstico, regla 50/30/20, método avalancha para deudas, fondo de emergencia, metas, portafolio de inversión por perfil y proyecciones. **Es matemática pura, no usa IA.** |
| `planExcel.js` | Arma el libro de Excel del plan (7 hojas, con fórmulas). |
| `reportePdf.js` | Arma el reporte en PDF con PDFKit (encabezado, resumen del mes y una tabla por sección). |
| `ia.js` | Capa única para hablar con la IA (ver sección 4). |
| `cuotaIA.js` | Límite diario de consultas con IA por usuario (tabla `consultas_ia`). |
| `asesorInversiones.js` | El asesor del chat: instrucciones de seguridad, datos del usuario y un asesor básico de respaldo. |
| `asesorIA.js` | Redacta con IA el resumen ejecutivo que aparece en el plan financiero. |
| `educacionIA.js` | Educación personalizada: analiza la situación del usuario, genera la lección y los quizzes (con IA o con un banco de preguntas). |
| `contenidoEducativo.js` | Texto de las 8 lecciones que vienen de fábrica en la base de datos. |
| `n8n.js` | Envía eventos a n8n (ver `readme/n8n.md`). |

---

## 3. Cómo se implementó el envío de correos

**Tecnología:** librería **Nodemailer** con **SMTP** (en esta instalación, Gmail). Todo está en `backend/src/servicios/correo.js`.

**Configuración (`backend/.env`):** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` y `APP_URL`. Con Gmail se usa una **contraseña de aplicación** (no la contraseña normal de la cuenta). Si faltan los datos, la app **no falla**: simplemente no envía correos y las alertas llegan igual a la campanita.

**Piezas de `correo.js`:**
1. `correoConfigurado()` — comprueba que existan host, usuario y contraseña.
2. Un transporte de Nodemailer que se crea una sola vez (puerto 465 usa conexión segura directa; 587 usa STARTTLS).
3. `plantillaAlerta()` — arma el HTML del correo (encabezado verde con el nombre de la app, título, mensaje, tabla opcional y botón "Ver mi presupuesto"). Todo el texto se **escapa** para evitar HTML malicioso.
4. `enviarCorreo()` — manda el mensaje y **nunca lanza error**: si el servidor de correo falla, solo lo registra en consola, para que un problema de correo no rompa la app.

**Cuándo se envían (desde `servicios/alertas.js`):**
- "Te queda poco de tus ingresos" (al gastar el 80 %) y "gastaste todos tus ingresos".
- Presupuesto total al llegar al porcentaje de aviso elegido y al superarlo.
- Límite de una categoría al llegar a su aviso y al superarlo.
- Pago programado que vence en 2 días o menos.
- Presupuesto generado con IA (incluye el resumen por categoría en una tabla).

**Cómo se evita el spam:** la función `alertar()` consulta primero si ya existe una notificación con el mismo título ese mes; si existe, no repite ni la notificación ni el correo. Cada alerta crea la notificación en la campanita y envía el correo en segundo plano (sin hacer esperar la respuesta de la app).

**Cuándo se evalúan:** cada vez que se registra o edita un gasto o ingreso (`movimientosRouter.js`), al guardar un presupuesto (`presupuestos.js`), al programar un pago (`pagos.js`), al consultar las notificaciones y **cada hora** automáticamente (`servicios/notificaciones.js`).

**Cómo probarlo:** `npm run probar-config` envía un correo de prueba a tu bandeja.

---

## 4. Cómo se implementó la inteligencia artificial

La app usa IA en cuatro lugares, **siempre con respaldo**: si no hay IA configurada o falla, funciona con reglas propias.

### 4.1 La capa común (`servicios/ia.js`)
- Soporta tres proveedores: **Gemini** (Google, con capa gratuita), **Groq** (Llama, gratis) y **Claude** (de pago).
- Usa el primero que tenga clave en el `.env` (`GEMINI_API_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`); `IA_PROVIDER` permite elegir cuál va primero.
- **Respaldo en cadena:** si un proveedor falla (cuota agotada, error), prueba el siguiente.
- **Modelos de Gemini:** prueba una lista (`gemini-3.5-flash`, `gemini-3.8-flash`…) y usa el primero disponible para la cuenta, porque Google retira modelos con frecuencia.
- **Reintento:** si el servidor responde un error pasajero (500/502/503) lo vuelve a intentar una vez.
- Todas las llamadas son `fetch` directos a la API de cada proveedor (sin librerías extra); la clave de Gemini va en una cabecera, no en la URL.

### 4.2 Límite diario (`servicios/cuotaIA.js`)
Cada consulta con IA se anota en la tabla `consultas_ia`. Cada usuario tiene **20 consultas al día** (cambiable con `IA_LIMITE_DIARIO`) más las que ganó con recompensas (Bronce +10, Plata +15, Oro +25). Al agotarse, el chat sigue respondiendo con el asesor básico, sin costo.

### 4.3 Dónde se usa

| Función | Archivos | Cómo funciona |
|---|---|---|
| **Chat del asesor** (pantallas IA Financiera e Inversiones) | `routes/ahorro/chat.js`, `servicios/asesorInversiones.js`, `frontend/assets/js/chat.js` | El backend arma un **mensaje de sistema con reglas de seguridad** (no prometer rentabilidades, no recomendar activos concretos, recordar fondo de emergencia y deudas antes de invertir, advertir de estafas, no inventar cifras) y le agrega los **datos del usuario** (ingresos, gastos, deudas, inversiones). Manda además los últimos mensajes de la conversación. Si no hay IA, `respuestaBasica()` contesta con textos preparados sobre CDT, fondos, bonos, acciones, riesgo, etc. |
| **Presupuesto sugerido** | `routes/presupuesto/presupuestos.js` (ruta `sugerido-ia`) | **Calculado por la propia app, sin llamar a un modelo:** toma tus ingresos, aparta tu meta de ahorro (mínimo 10 %) y reparte el resto entre las categorías con una distribución sana, ajustada a lo que realmente gastas. |
| **Plan financiero** | `servicios/planFinanciero.js` (cálculo), `servicios/asesorIA.js` (redacción) | El plan (diagnóstico, deudas, fondo, metas, inversión) lo calcula el motor de reglas. La IA solo **redacta un resumen ejecutivo** con los números ya calculados; si no hay IA, el plan se muestra igual. |
| **Educación personalizada** | `servicios/educacionIA.js`, `routes/cuenta/educacion.js`, `frontend/assets/js/educacion.js` | Analiza tu situación (deudas, meses de fondo de emergencia, presupuesto…) para recomendar lecciones. La IA escribe una **mini-lección con tus números** y genera **quizzes de 3 preguntas en JSON**, que se validan; si la IA no responde bien, se usa un banco de preguntas preparadas. |

**Importante:** la IA es una ayuda educativa, no un asesor certificado. Las pantallas lo avisan.

---

## 5. Otras partes importantes

- **Sesiones y seguridad:** contraseñas con scrypt, bloqueo tras 5 intentos fallidos, tokens aleatorios de 64 caracteres guardados en `sesiones`, consultas SQL siempre con parámetros (sin concatenar texto del usuario) y todo texto mostrado en pantalla escapado.
- **Alertas y notificaciones:** tabla `notificaciones` + la campanita del frontend (`shell.js`).
- **Logros, retos y recompensas:** tablas `logros`, `usuario_logros`, `retos_financieros`, `usuario_retos` y `recompensas_usuario`; el progreso de los retos se calcula solo en `servicios/retos.js`.
- **Moneda:** al cambiar de moneda, `routes/cuenta/perfil.js` convierte en una transacción todos los valores usando las tasas de la tabla `monedas`.
- **Reportes:** Excel con ExcelJS (`exportaciones.js`, `planExcel.js`) y PDF con PDFKit (`reportePdf.js`).
- **Base de datos:** tablas del archivo `.sql` original más tres creadas por la app (`rendimientos_inversion`, `consultas_ia`, `recompensas_usuario`); se quitó el rol de administrador y un *trigger* que duplicaba alertas.

---

## 6. Frontend — archivo por archivo

### Páginas (`frontend/`)
| Archivo | Qué es |
|---|---|
| `index.html` | Página de inicio pública (landing): explica el proyecto y lleva al registro o inicio de sesión. |
| `pages/auth/login.html`, `registro.html` | Inicio de sesión y registro, con botón de Google. |
| `pages/app/dashboard.html` | Gestión Financiera: resumen del mes con pestañas (Resumen, Actividad, Patrimonio, Progreso). |
| `pages/app/presupuesto.html` | Presupuesto del mes (manual, con IA, con historial) y presupuesto general. |
| `pages/app/ingresos-gastos.html` | Ingresos y gastos en una sola página con dos pestañas. |
| `pages/app/ahorros.html` | Metas de ahorro y cuentas de ahorro. |
| `pages/app/inversiones.html` | Mis inversiones, tipos de inversión, simulador, ganancias y asesor IA. |
| `pages/app/deudas.html` | Registrar deudas y pagos programados. |
| `pages/app/retos.html` | Retos, logros y recompensas. |
| `pages/app/educacion.html` | Educación para ti, lecciones y actividades. |
| `pages/app/ia-financiera.html` | Chat con el asesor IA. |
| `pages/app/plan-financiero.html` | Plan financiero con IA y sus recomendaciones. |
| `pages/app/reportes.html` | Reportes en Excel/PDF por secciones. |
| `pages/app/configuracion.html` | Foto, datos del perfil, moneda, contraseña y sesiones. |
| `pages/app/ingresos.html`, `gastos.html` | Redirigen a `ingresos-gastos.html` (por si alguien guardó los enlaces viejos). |

> Las páginas de `pages/app/` se generaron con un script; si se quieren cambiar, se editan directamente (o se regeneran desde la plantilla que usé durante el desarrollo, que no forma parte de la entrega).

### Scripts (`frontend/assets/js/`)
| Archivo | Qué hace |
|---|---|
| `session.js` | Cliente de la API (`api()`), guarda el token, protege las páginas privadas (si no hay sesión manda al login), pone nombre/foto en el avatar y el botón "Cerrar sesión". |
| `ui.js` | Utilidades compartidas: formato de dinero y fechas, avisos (toast), **ventanas emergentes con formulario**, confirmaciones y las **pestañas** (subsecciones). |
| `shell.js` | Estructura común: tema claro/oscuro, menú de perfil y la **campanita de notificaciones**. |
| `auth.js` | Formularios de login y registro y botón de Google. |
| `landing.js` | Menú móvil y botones de la página de inicio. |
| `dashboard.js` | Panel de Gestión Financiera (gráfica con Chart.js, puntos, patrimonio). |
| `presupuesto.js` | Presupuesto: reparto del total en categorías, sugerencias y presupuesto general. |
| `movimientos.js` | Ingresos y gastos (lista, alta, edición, borrado). |
| `ahorros.js` | Metas, aportes y cuentas. |
| `inversiones.js` | Inversiones, tipos, simulador de interés compuesto y ganancias. |
| `tipos-inversion.js` | Catálogo educativo de los 22 tipos de inversión (explicación, ventajas, riesgos). |
| `deudas.js`, `pagos.js` | Deudas y pagos programados. |
| `retos.js` | Retos, logros y recompensas. |
| `educacion.js` | Lecciones, lección con IA y quiz. |
| `chat.js` | Ventana de chat con el asesor IA. |
| `ia.js` | Lista de recomendaciones (en la pestaña del plan). |
| `plan.js` | Formulario del plan financiero, resultados y descarga de Excel. |
| `reportes.js` | Selección de secciones y descarga de Excel/PDF. |
| `configuracion.js` | Foto de perfil con recorte y vista previa, datos, moneda y contraseña. |

### Estilos e imágenes
| Archivo | Qué hace |
|---|---|
| `assets/css/site.css` | Estilos de la página de inicio, login y registro. |
| `assets/css/app.css` | Estilos base del panel (menú lateral, tarjetas, temas claro y oscuro). |
| `assets/css/plan.css` | Estilos de los componentes nuevos: pestañas, tablas, ventanas, chat, tipos de inversión, reportes, etc. |
| `assets/img/logo-icon.svg`, `logo.svg` | Logo de la app (ícono y versión horizontal). |
| `assets/img/photo-1619895862022-09114b41f16f (1).avif` | Imagen que no está enlazada desde ninguna página (no la agregué yo). |

---

## 7. Otras carpetas
| Carpeta/archivo | Qué hay |
|---|---|
| `docs/n8n/` | Tres flujos de ejemplo para importar en n8n. |
| `readme/n8n.md` | Detalle de la integración con n8n. |
| `readme/guia-del-proyecto.md` | Este documento. |
| `README.md` | Resumen del proyecto, cómo ejecutarlo y configuraciones (Google, correo, IA, n8n). |
| `.vscode/settings.json` | Fija el puerto de Live Server en 5501. |

## 8. Cómo ejecutar el proyecto
1. Enciende MySQL (XAMPP) con la base `ahorra_y_prospera`.
2. En `backend/`: `npm install` y luego `npm run dev` (o `npm start`).
3. Abre `http://localhost:5000` (o `frontend/index.html` con Live Server; el backend debe estar encendido).
4. Diagnóstico de configuración: `npm run probar-config`.
