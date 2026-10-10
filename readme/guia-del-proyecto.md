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
| `package.json` | Lista de dependencias (express, mysql2, cors, express-fileupload, nodemailer, exceljs, pdfkit, dotenv) y de comandos (`npm start`, `npm run dev`, `npm run probar-config`). También trae `exportar-bd` e `importar-bd`, que usan los archivos de `backend/database/` (ver sección 9). |
| `package-lock.json`, `pnpm-lock.yaml` | Versiones exactas de las dependencias instaladas. Hay uno de npm y otro de pnpm porque se mezclaron gestores; conviene usar solo uno (yo usé npm). |
| `scripts/probar-config.mjs` | Herramienta de diagnóstico (`npm run probar-config`): prueba de verdad cada IA configurada y manda un correo de prueba para confirmar que el `.env` está bien. |
| `.env.example` | Plantilla del `.env` con todos los nombres de variables y sin valores (ese sí se puede subir a GitHub). |
| `database/exportar.mjs`, `importar.mjs`, `esquema.sql` | Exportan e importan la estructura de la base y sus catálogos (se usan para el despliegue; ver sección 9). |
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
| `render.yaml` | Configuración de despliegue en Render (sección 9). |
| `.gitignore` | Lista de archivos que Git no sube (`.env`, `node_modules`, fotos). |
| `readme/n8n.md` | Detalle de la integración con n8n. |
| `readme/guia-del-proyecto.md` | Este documento. |
| `README.md` | Resumen del proyecto, cómo ejecutarlo y configuraciones (Google, correo, IA, n8n). |
| `.vscode/settings.json` | Fija el puerto de Live Server en 5501. |

## 8. Cómo ejecutar el proyecto
1. Enciende MySQL (XAMPP) con la base `ahorra_y_prospera`.
2. En `backend/`: `npm install` y luego `npm run dev` (o `npm start`).
3. Abre `http://localhost:5000` (o `frontend/index.html` con Live Server; el backend debe estar encendido).
4. Diagnóstico de configuración: `npm run probar-config`.

---

## 9. Despliegue en internet (paso a paso)

**Resumen:** el backend de Node sirve también las páginas, así que se despliega **una sola aplicación** (en Render) y una **base de datos MySQL** aparte (en Aiven). Quedan en una sola dirección, por ejemplo `https://ahorra-y-prospera.onrender.com`.

> Yo no puedo crear las cuentas ni iniciar sesión por ti en Render, Aiven ni Google, así que **no pude hacer el despliegue final**. Dejé el código listo y probado en modo producción con una base de datos vacía; los pasos de abajo son los que tienes que hacer tú.

### 9.1 Qué se preparó en el código
| Archivo | Para qué |
|---|---|
| `backend/database/exportar.mjs` (`npm run exportar-bd`) | Genera `esquema.sql` desde tu base local: tablas, vistas, triggers y datos de referencia (monedas, categorías, logros, retos, tipos de inversión, lecciones). **No incluye usuarios ni datos personales.** |
| `backend/database/esquema.sql` | El resultado: 30 tablas, 7 vistas, 4 triggers y los catálogos. |
| `backend/database/importar.mjs` (`npm run importar-bd`) | Crea todo eso en la base que esté configurada en `MYSQL_*`. Se puede repetir sin borrar datos. |
| `render.yaml` | Configuración lista para Render (Blueprint): carpeta `backend`, `npm install`, `node app.js`, chequeo de salud en `/salud`. |
| `backend/.env.example` | Plantilla con todos los nombres de variables (sin valores). |
| `.gitignore` | Evita subir `node_modules`, `.env` (tus claves) y las fotos subidas. |
| `backend/src/server/express.server.js` | Se añadió `trust proxy` para que funcione detrás del proxy de Render. |

Lo que se verificó: importar el esquema en una base vacía (sin errores y repetible), que los triggers funcionen (aportes y deudas), que el servidor arranque con `NODE_ENV=production`, sirva las páginas, permita registrarse y **no sirva** `.env` ni `package.json`.

### 9.2 Paso 1 — Subir el código a GitHub
Ya está en https://github.com/lauratrujillo774/Ahorra-y-Prospera. Para subir cambios nuevos:
```
git add .
git commit -m "describe el cambio"
git push
```

### 9.3 Paso 2 — Crear la base de datos en la nube (Aiven)
1. Crea una cuenta en https://aiven.io y un servicio **MySQL** con el plan **Free**.
2. Cuando esté en estado *Running*, copia de la pestaña *Overview*: **Host**, **Port**, **User** (normalmente `avnadmin`), **Password** y **Database name** (normalmente `defaultdb`).
3. Aiven exige conexión segura (SSL); la app ya lo soporta con `MYSQL_SSL=true`.

### 9.4 Paso 3 — Crear las tablas en esa base
En PowerShell, dentro de la carpeta `backend` del proyecto (cambia los valores por los de Aiven):
```
$env:MYSQL_HOST="tu-host.aivencloud.com"
$env:MYSQL_PORT="12345"
$env:MYSQL_USER="avnadmin"
$env:MYSQL_PASSWORD="tu-contraseña"
$env:MYSQL_DATABASE="defaultdb"
$env:MYSQL_SSL="true"
npm run importar-bd
```
Debe terminar con "Importación completa sin errores. Ahora hay 30 tablas y 4 triggers." Después **cierra esa ventana de PowerShell** para que esas variables (con tu contraseña) no queden guardadas.
- Si falla al crear los **triggers**, es que la base gestionada no te deja crearlos; en ese caso los aportes a metas y los pagos de deudas no actualizarían saldos y habría que mover esa lógica al código (avísame y lo hago).

### 9.5 Paso 4 — Publicar la aplicación en Render
1. Crea una cuenta en https://render.com e inicia sesión con tu GitHub.
2. **New + → Blueprint**, elige el repositorio `Ahorra-y-Prospera` y confirma (Render lee `render.yaml`). *(Alternativa manual: New + → Web Service → mismo repositorio, Root Directory `backend`, Build Command `npm install`, Start Command `node app.js`, plan Free.)*
3. Render pedirá los valores de las variables. Pon:

| Variable | Valor |
|---|---|
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | Los de Aiven (paso 2) |
| `MYSQL_SSL` | `true` |
| `APP_URL` | La dirección que te dé Render, p. ej. `https://ahorra-y-prospera.onrender.com` (si aún no la sabes, déjala y edítala después del primer despliegue) |
| `GOOGLE_CLIENT_ID` | El mismo que usas en local |
| `GEMINI_API_KEY` | Tu clave de Gemini (de preferencia una nueva; la anterior apareció en el chat) |
| `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Tu Gmail, la contraseña de aplicación y el remitente |
| `PORT` | **No la pongas**: Render la asigna sola |

4. Pulsa **Apply / Create** y espera a que el estado diga *Live* (unos minutos). Abre la dirección que te muestra.
5. Comprueba `https://TU-DIRECCION/salud`: debe responder `{"servidor":"ok","baseDeDatos":"ok"}`.

### 9.6 Paso 5 — Que funcione el acceso con Google
En https://console.cloud.google.com/apis/credentials abre tu ID de cliente de OAuth y en **Orígenes autorizados de JavaScript** agrega la dirección de Render (`https://TU-DIRECCION`, sin barra al final). Guarda y espera unos minutos.

### 9.7 Paso 6 — Probar
Regístrate, crea un gasto, abre Presupuesto y prueba el chat con la IA y el botón de Google. Si algo falla, mira **Logs** en el panel de Render.

### 9.8 Límites del plan gratuito (importante)
- **Se duerme:** Render suspende la app tras unos 15 minutos sin visitas; la primera visita después tarda cerca de un minuto. Mientras duerme **no corre la revisión horaria de alertas** (campanita y correos). Para alertas confiables hace falta un plan de pago o un servicio externo que la "despierte" (por ejemplo, n8n llamando a `/salud` cada 10 minutos).
- **Fotos de perfil:** el disco gratuito de Render es temporal; las fotos subidas se pierden al redesplegar o reiniciar. Para que duren hace falta un disco persistente (de pago) o guardarlas en la base de datos o en un servicio de archivos (puedo implementarlo).
- **Correos:** Render puede bloquear la salida SMTP en el plan gratuito, y entonces las alertas llegarían solo a la campanita. La solución es usar un servicio de envío por API (Brevo, Resend…) o un plan de pago; hoy el código usa solo SMTP.
- **Aiven gratuito:** revisa sus límites vigentes (almacenamiento y posible apagado por inactividad).
- Los límites y precios de Render y Aiven cambian; confírmalos en sus páginas antes de depender de ellos.

### 9.9 Seguridad antes de publicar
- Nunca subas el `.env` (ya está en `.gitignore`). Las claves van solo en el panel de Render.
- Usa una clave nueva de Gemini y cambia cualquier clave que haya aparecido en una conversación.
- Usa contraseñas largas en Aiven y en `N8N_API_KEY` si activas n8n.
- Render sirve la app con HTTPS automáticamente.

### 9.10 Actualizar la app después
Cada `git push` a `main` hace que Render vuelva a desplegar solo. Si cambias la estructura de la base de datos, vuelve a ejecutar `npm run exportar-bd` en local y `npm run importar-bd` contra la base de Aiven (el importador solo crea lo que falta; para cambios en tablas ya existentes habría que hacer un `ALTER TABLE` manual).


### 9.11 Explicación detallada para principiantes

#### Qué significa "desplegar"
Ahora mismo tu aplicación **solo existe en tu computador**: XAMPP hace de servidor de base de datos, Node (`npm run dev`) hace de servidor de la aplicación y tu navegador es quien la usa. Si apagas el computador, nadie más puede entrar.

Desplegar es **prestar computadores en internet que estén encendidos las 24 horas** y poner tu aplicación en ellos. Necesitamos dos:

| Pieza | En tu computador | En internet | Qué hace |
|---|---|---|---|
| Base de datos | MySQL de XAMPP | **Aiven** | Guarda usuarios, gastos, metas, etc. |
| Aplicación | `npm run dev` (Node) | **Render** | Atiende las páginas y la API |
| Navegador | El tuyo | El de cada visitante | Muestra las páginas |

Se necesitan **dos servicios** porque Render (plan gratuito) no incluye una base MySQL; por eso la base va en Aiven.

#### Qué es el GitHub y por qué importa
Render **no copia archivos desde tu computador**: los descarga de GitHub. Por eso subimos el código a https://github.com/lauratrujillo774/Ahorra-y-Prospera. Cada vez que hagas `git push`, Render descarga la versión nueva y vuelve a publicar.

#### Qué son las "variables de entorno" y por qué el `.env` no se sube
El archivo `backend/.env` contiene tus **secretos** (contraseña de la base, clave de Gemini, contraseña de Gmail). Si estuviera en GitHub, cualquiera podría usarlos. Por eso el `.gitignore` lo deja fuera. En internet esos mismos valores se escriben **en el panel de Render** (sección *Environment*), donde quedan guardados en privado. La aplicación los lee igual que lee el `.env`.

#### Paso 1 — La base de datos en Aiven (≈10 minutos)
1. Entra a https://aiven.io y crea una cuenta (puedes usar Google).
2. Pulsa para crear un servicio nuevo y elige **MySQL**.
3. Elige el plan **Free** (gratuito) y una región cualquiera (la más cercana a Colombia suele ser la de EE. UU. este). Ponle un nombre, por ejemplo `ahorra-mysql`.
4. Espera unos minutos hasta que el estado diga **Running**.
5. En la página del servicio verás la información de conexión. Anota estos cinco datos (los necesitarás dos veces):
   - **Host**: algo como `ahorra-mysql-tuusuario.aivencloud.com`
   - **Port**: un número, por ejemplo `12345`
   - **User**: normalmente `avnadmin`
   - **Password**: una cadena larga (hay un botón para mostrarla)
   - **Database name**: normalmente `defaultdb`
6. Revisa que el acceso no esté restringido por direcciones IP (por defecto permite todas). Si no, la app en Render no podrá conectar.

#### Paso 2 — Crear las tablas en esa base (≈2 minutos)
La base de Aiven nace **vacía**: no tiene tus tablas. El archivo `backend/database/esquema.sql` las describe todas, y el comando `npm run importar-bd` las crea. Lo haces **desde tu computador**, apuntando a Aiven:

1. Abre PowerShell y entra a la carpeta del proyecto: `cd "C:\Users\Asus\Downloads\ahorra y prospera.. version oficial\ahorra y prospera.. version oficial\backend"`
2. Escribe estos comandos, uno por uno, cambiando lo que está entre comillas por los datos de Aiven:
   ```
   $env:MYSQL_HOST="el-host-de-aiven"
   $env:MYSQL_PORT="el-puerto"
   $env:MYSQL_USER="avnadmin"
   $env:MYSQL_PASSWORD="la-contraseña"
   $env:MYSQL_DATABASE="defaultdb"
   $env:MYSQL_SSL="true"
   npm run importar-bd
   ```
   Cada línea `$env:...` solo vale para **esa ventana** de PowerShell y no toca tu `.env`; así el comando usa Aiven y no tu base local.
3. Debe imprimir: `Importación completa sin errores. Ahora hay 30 tablas y 4 triggers.` Si imprime líneas con ✖, copia el mensaje.
4. **Cierra la ventana de PowerShell** al terminar, para que la contraseña no quede en memoria de esa sesión.

**Importante:** esto crea la *estructura* y los catálogos, pero **no copia tus usuarios ni tus gastos de prueba**. En internet empezarás con cero usuarios y te registrarás de nuevo.

#### Paso 3 — Publicar la aplicación en Render (≈10 minutos)
1. Entra a https://render.com y crea una cuenta con tu GitHub (autoriza que lea tus repositorios).
2. Arriba a la derecha: **New +** → **Blueprint**. Un *Blueprint* es una receta: Render lee el archivo `render.yaml` del repositorio y ya sabe qué hacer.
3. Elige el repositorio `Ahorra-y-Prospera` y continúa.
4. Render te mostrará la lista de variables que dejé sin valor. Escribe los valores (están en la tabla de la sección 9.5). Los más importantes:
   - `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`: los de Aiven.
   - `APP_URL`: aún no sabes la dirección; escribe cualquier cosa y la corriges luego.
   - `GOOGLE_CLIENT_ID`, `GEMINI_API_KEY`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: los mismos que usas en local (con una clave de Gemini nueva).
5. Pulsa el botón para crear. Render empieza a **construir** (descarga el código, instala las dependencias con `npm install`) y luego **arranca** con `node app.js`. Puedes ver el avance en la pestaña **Logs**.
6. Cuando el estado diga **Live** verás arriba una dirección como `https://ahorra-y-prospera-xxxx.onrender.com`. Esa es **la dirección pública de tu app**.
7. Ve a **Environment**, edita `APP_URL` poniendo esa dirección (sin barra al final) y guarda. Render reiniciará la app.

#### Paso 4 — Comprobar que todo conecta
1. Abre `https://TU-DIRECCION/salud`. Debe mostrar `{"servidor":"ok","baseDeDatos":"ok"}`. El `baseDeDatos: ok` significa que Render sí llegó a Aiven.
2. Abre `https://TU-DIRECCION` (la página de inicio), crea una cuenta y registra un gasto.
3. La **primera visita** puede tardar cerca de un minuto: en el plan gratuito la app se "duerme" cuando nadie la usa y debe despertar.

#### Paso 5 — El botón de Google
Google solo acepta el inicio de sesión desde las direcciones que tú autorices. En https://console.cloud.google.com/apis/credentials abre tu **ID de cliente de OAuth 2.0**, busca **Orígenes autorizados de JavaScript**, pulsa *Agregar URI* y pega `https://TU-DIRECCION` (sin barra al final). Guarda y espera unos minutos.

#### Si algo sale mal
| Qué ves | Qué significa | Qué hacer |
|---|---|---|
| El importador dice `Access denied` | Usuario o contraseña de Aiven mal copiados | Vuelve a copiarlos sin espacios; la contraseña distingue mayúsculas |
| El importador dice `ETIMEDOUT` o `ECONNREFUSED` | No alcanza el servidor de la base | Revisa host y puerto; confirma que el servicio de Aiven esté *Running* y sin restricción de IP |
| El importador dice `ER_ACCESS_DENIED` al crear triggers o algo con `SUPER` | La base gestionada limita los triggers | Avísame: hay que mover esa lógica al código |
| Render: *Build failed* | Falló la instalación | Mira **Logs**; verifica que el repositorio tenga la carpeta `backend` y su `package.json` |
| Render: se queda en *Deploying* o dice *Failed* al arrancar | La app se cae al iniciar | Casi siempre es una variable de la base mal escrita; los **Logs** muestran "No se pudo conectar a MySQL: …" |
| `/salud` dice `baseDeDatos: error` | La app no llega a Aiven | Revisa las cinco variables `MYSQL_*` y que `MYSQL_SSL` sea `true` |
| La página carga pero registrarse da error | Faltan las tablas | Repite el Paso 2 apuntando a Aiven |
| Google dice `origin_mismatch` | La dirección no está autorizada | Repite el Paso 5 |
| No llegan correos | Render puede bloquear SMTP en el plan gratuito, o la contraseña de aplicación es incorrecta | Mira los Logs (`[correo] No se pudo enviar…`); la alternativa es un servicio de correo por API |

#### Cuánto cuesta
Con los planes gratuitos de Render y Aiven, **nada**, pero con las limitaciones de la sección 9.8 (la app se duerme, las fotos no persisten, el correo puede fallar, límites de almacenamiento). Los planes y precios cambian: confírmalos en sus páginas, y verifica si piden una tarjeta para verificar la cuenta.

#### Si solo necesitas mostrarla (sin publicar)
Para una exposición o una revisión, no es obligatorio desplegar: puedes dejarla corriendo en tu computador (`npm run dev` + XAMPP) y abrirla con `http://localhost:5000`. Desplegar solo hace falta si otras personas deben entrar desde sus propios dispositivos cuando tu computador esté apagado.
