import { generarTexto, iaDisponible, NOMBRES } from './ia.js';

// Asesor financiero y de inversiones: usa una IA (Gemini/Groq gratis, o Claude) y, si no hay o falla, un asesor básico.

const SISTEMA = `Eres el asesor financiero de la app "Ahorra y Prospera" (Colombia y Latinoamérica). Tu prioridad es dar orientación SEGURA, PRUDENTE y CONFIABLE sobre finanzas personales e inversiones.

Reglas obligatorias:
1. Responde en español, tono cercano y claro, sin jerga innecesaria. Máximo 200 palabras; usa viñetas cortas.
2. Enseña conceptos (qué es, riesgo, plazo, costos, cuándo conviene y cuándo no) con ejemplos numéricos simples.
3. NUNCA prometas ni insinúes rentabilidades garantizadas. Menciona siempre el riesgo de perder dinero cuando hables de inversión.
4. NO recomiendes comprar o vender un activo, empresa, criptomoneda o fondo específico. Explica criterios para elegir, no órdenes.
5. Orden sano de prioridades que debes recordar: (a) fondo de emergencia de 3 a 6 meses, (b) pagar deudas caras (tarjetas, créditos de consumo), (c) invertir solo dinero que no se necesita a corto plazo y diversificar.
6. Advierte contra estafas (ganancias altas y garantizadas, pirámides, presión para decidir ya, entidades no vigiladas) y recuerda verificar que la entidad esté vigilada por la Superintendencia Financiera de Colombia (superfinanciera.gov.co).
7. Si no estás seguro de un dato (tasas, impuestos, normas vigentes), dilo y sugiere confirmarlo con fuentes oficiales o un asesor certificado; no inventes cifras.
8. Usa los datos del usuario que se te entregan solo si son relevantes; no los repitas innecesariamente.
9. Ante temas legales, tributarios o de salud mental por deudas graves, recomienda buscar un profesional.
10. Si la pregunta no es de finanzas personales o inversiones, redirige amablemente al tema.
Cierra con una frase corta recordando que es orientación educativa solo cuando des una recomendación de acción.`;

const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO');

export function resumenContexto(inversiones, ganancias, finanzas) {
    const partes = [];
    if (finanzas) {
        partes.push(`Mes actual: ingresos ${fmt(finanzas.ingresos)}, gastos ${fmt(finanzas.gastos)}, deudas pendientes ${fmt(finanzas.deudas)}, ahorrado en metas ${fmt(finanzas.ahorro)}.`);
    }
    if (!inversiones.length) partes.push('El usuario aún no registra inversiones.');
    else {
        const lineas = inversiones.map((i) => `- ${i.nombre} (${i.tipo}, riesgo ${i.nivel_riesgo}): invertido ${fmt(i.monto_invertido)}, valor actual ${fmt(i.valor_actual ?? i.monto_invertido)}, rendimiento ${i.rendimiento_pct}%`);
        partes.push(`Inversiones del usuario:\n${lineas.join('\n')}\nGanancias cobradas en total: ${fmt(ganancias)}.`);
    }
    return partes.join('\n');
}

async function conIA(mensaje, historial, contexto) {
    const mensajes = [];
    for (const h of historial.slice(-10)) {
        if (!['user', 'assistant'].includes(h.rol) || !String(h.texto || '').trim()) continue;
        if (mensajes.length && mensajes[mensajes.length - 1].role === h.rol) continue;
        if (!mensajes.length && h.rol !== 'user') continue;
        mensajes.push({ role: h.rol, content: String(h.texto).slice(0, 1500) });
    }
    if (mensajes.length && mensajes[mensajes.length - 1].role === 'user') mensajes.pop();
    mensajes.push({ role: 'user', content: mensaje });
    return generarTexto({ sistema: `${SISTEMA}\n\nContexto del usuario:\n${contexto}`, mensajes, maxTokens: 700 });
}

// ---------- Asesor básico (sin API) ----------
const TEMAS = [
    { re: /\b(hola|buenas|buenos dias|buenas tardes|hey)\b/, r: () => '¡Hola! 👋 Soy tu asesor de inversiones. Puedo explicarte qué es un CDT, un fondo de inversión, las acciones, cómo diversificar, cuánto invertir o cómo funciona el interés compuesto. ¿Qué quieres aprender?' },
    { re: /(empiez|empez|comienz|comenz|inici|primer).*(invert)|como invert|por donde/, r: () => 'Para empezar a invertir con buen pie:\n1. **Fondo de emergencia**: 3 a 6 meses de gastos en una cuenta de fácil acceso.\n2. **Paga deudas caras** (tarjetas, créditos de consumo): ninguna inversión segura rinde más que sus intereses.\n3. **Define tu objetivo y plazo**: menos de 3 años → productos de bajo riesgo.\n4. **Empieza simple**: ahorro programado, CDT o un fondo de inversión colectiva.\n5. **Aporta cada mes**, aunque sea poco: la constancia pesa más que el monto.\n\nRecuerda: es orientación educativa.' },
    { re: /\bcdt\b|deposito a termino/, r: () => '**CDT (Certificado de Depósito a Término)**: prestas tu dinero a un banco por un plazo fijo (ej. 6 o 12 meses) y te paga una tasa pactada.\n• Riesgo: bajo (está respaldado por la entidad y por Fogafín hasta cierto monto).\n• Liquidez: baja; no puedes sacarlo antes sin penalidad.\n• Ideal para: metas a plazo conocido y perfil conservador.\n• Tip: compara la **tasa efectiva anual (E.A.)** entre bancos.' },
    { re: /fondo.*(inversion|colectiv)|\bfic\b|fiducia/, r: () => '**Fondo de inversión colectiva (FIC)**: junta el dinero de muchas personas y un gestor lo invierte en un portafolio.\n• Riesgo: bajo a medio según el fondo (renta fija, mixto, variable).\n• Liquidez: suele ser alta.\n• Ventaja: diversificación desde montos pequeños.\n• Revisa: la **comisión de administración**, la rentabilidad histórica neta y el perfil de riesgo del fondo.' },
    { re: /accion|bolsa|etf|acciones/, r: () => '**Acciones / ETF**: compras una parte de empresas (o de una canasta de ellas).\n• Riesgo: alto; el valor sube y baja, incluso a la baja por años.\n• Plazo recomendado: 5 años o más.\n• Ventaja: mayor potencial de crecimiento a largo plazo y dividendos.\n• Reglas: diversifica, invierte solo dinero que no necesitas pronto y no decidas por impulso ni por "dato caliente".' },
    { re: /bono|renta fija|tes\b|titulos/, r: () => '**Bonos**: son préstamos que haces a una empresa o al gobierno; te pagan intereses (cupones) y devuelven el capital al vencimiento.\n• Riesgo: medio (depende de quién emite y del plazo).\n• Si las tasas de interés suben, el precio del bono puede bajar.\n• Sirven para dar estabilidad y flujo de ingresos a un portafolio.' },
    { re: /pension|jubil|retiro|cesantia/, r: () => '**Pensiones voluntarias**: ahorro de largo plazo para el retiro, con posibles beneficios tributarios.\n• Riesgo: bajo a medio según el portafolio elegido.\n• Liquidez: limitada (conviene dejarlo años).\n• Ideal para: construir tu retiro sin depender solo de la pensión obligatoria.\n• Mientras más joven empiezas, más trabaja el interés compuesto.' },
    { re: /ahorro programado|cuenta de ahorro/, r: () => '**Ahorro programado**: aportes periódicos automáticos a un producto de ahorro.\n• Riesgo: bajo. Rentabilidad: modesta, suele ir cerca de la inflación.\n• Ideal para: tu fondo de emergencia y metas a corto plazo (menos de 2 años).\n• Tip: programa el aporte el mismo día que recibes tu ingreso.' },
    { re: /riesgo|perfil|conservador|agresivo|moderado/, r: () => 'Tu **perfil de riesgo** depende de tu plazo, tus ingresos y cuánta caída soportarías sin entrar en pánico:\n• **Conservador**: prioriza no perder (ahorro, CDT, renta fija).\n• **Moderado**: mezcla renta fija con algo de fondos o acciones (≈20%).\n• **Agresivo**: mayor parte en renta variable, para plazos largos (10+ años).\n\nUna pregunta útil: "si mi inversión cae 20%, ¿mantengo la calma o vendo?". Puedes calcular tu plan en la sección **Plan Financiero IA**.' },
    { re: /diversific|todos los huevos|portafolio/, r: () => '**Diversificar** es repartir tu dinero en distintos productos, sectores y plazos para que un mal resultado no te hunda.\nEjemplo moderado orientativo: 30% ahorro/CDT, 30% renta fija o fondos, 20% pensiones, 20% renta variable.\nNo existe un reparto perfecto: depende de tu objetivo, plazo y tolerancia al riesgo.' },
    { re: /interes compuesto|compuesto|cuanto.*crec|rendimiento.*años|proyecci/, r: () => 'El **interés compuesto** es ganar intereses sobre los intereses. Ejemplo: $200.000 al mes durante 10 años al 9% E.A. se convierten en cerca de $38 millones, aunque solo aportaste $24 millones.\nUsa el **simulador** de esta página: elige el tipo de inversión, ajusta monto, aporte, tasa y años, y mira cómo crece. Mientras antes empieces, más trabaja el tiempo a tu favor.' },
    { re: /emergencia|imprevisto|colchon/, r: () => 'El **fondo de emergencia** va antes de invertir: 3 a 6 meses de tus gastos esenciales (6 si tu ingreso es variable o tienes dependientes). Guárdalo en una cuenta de ahorro o producto de alta liquidez. Solo cuando lo tengas, destina dinero a inversiones con riesgo.' },
    { re: /cuanto.*(invertir|ahorrar)|que porcentaje|porcentaje/, r: () => 'Una guía común es la regla **50/30/20**: 50% necesidades, 30% deseos y 20% ahorro e inversión. Si recién empiezas, arranca con 5-10% y sube poco a poco. Lo importante es la constancia. Tu **Plan Financiero IA** calcula cuánto puedes invertir según tus ingresos, gastos y deudas.' },
    { re: /deuda|tarjeta|credito|prestamo/, r: () => 'Regla práctica: si una deuda cobra más de lo que podrías ganar invirtiendo con seguridad (tarjetas suelen cobrar 25-35% E.A.), **paga primero la deuda**. Cada peso que abonas a una deuda al 30% "rinde" 30% libre de riesgo. Mantén al menos un fondo de emergencia básico y luego invierte.' },
    { re: /inflaci/, r: () => 'La **inflación** hace que tu dinero compre menos con el tiempo. Una inversión solo te hace crecer de verdad si su rendimiento **supera la inflación** (rendimiento real = rendimiento − inflación). Por eso guardar dinero "debajo del colchón" a largo plazo pierde valor.' },
    { re: /estafa|piramide|fraude|criptomoneda|cripto|forex|garantizad/, r: () => '⚠️ Señales de estafa: promesas de ganancias **altas y garantizadas**, presión para decidir ya, pedir que reclutes a otros, entidades que no están vigiladas por la Superintendencia Financiera. Verifica siempre que la entidad esté autorizada. Las criptomonedas son de **riesgo muy alto**: si participas, que sea solo con dinero que puedas perder.' },
    { re: /ganancia|rendimiento.*(registr|mes|ingreso)|dividendo|interes.*(cobr|pag)/, r: () => 'En esta página puedes registrar las **ganancias** que te paga cada inversión (intereses, dividendos, cupones) con el botón "Ganancias". Cada ganancia se suma automáticamente a tus **Ingresos del mes** en la categoría "Rendimientos", así tu balance queda al día.' },
    { re: /simulador|simular/, r: () => 'El **simulador** está en esta página: elige el tipo de inversión (se ajusta una tasa de referencia), cambia el monto inicial, el aporte mensual, la tasa y los años. Te muestra cuánto aportarías, el valor proyectado y los intereses ganados año a año.' },
];

function respuestaBasica(mensaje, contexto) {
    const texto = mensaje.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const tema = TEMAS.find((t) => t.re.test(texto));
    if (tema) return tema.r();
    return `Puedo ayudarte con estos temas de inversión:\n• Cómo empezar a invertir\n• CDT, fondos de inversión, bonos, acciones y pensiones voluntarias\n• Riesgo y perfil de inversionista\n• Diversificar y cuánto invertir\n• Interés compuesto y el simulador\n• Cómo registrar tus ganancias\n\nPregúntame, por ejemplo: "¿qué es un CDT?" o "¿cómo empiezo a invertir?".\n\n(${contexto.startsWith('El usuario aún no') ? 'Aún no tienes inversiones registradas.' : 'Veo que ya tienes inversiones registradas; puedo ayudarte a entenderlas.'})`;
}

// usarIA = false fuerza el asesor básico (por ejemplo, cuando se acabó el límite diario)
export async function responderInversiones({ mensaje, historial = [], contexto, usarIA = true }) {
    if (usarIA && iaDisponible()) {
        try {
            const { texto, proveedor } = await conIA(mensaje, historial, contexto);
            return { respuesta: texto, modo: 'ia', proveedor, proveedorNombre: NOMBRES[proveedor] };
        } catch (error) {
            console.error('[asesor] La IA no respondió, uso el asesor básico:', error.message);
        }
    }
    return { respuesta: respuestaBasica(mensaje, contexto), modo: 'basico' };
}
