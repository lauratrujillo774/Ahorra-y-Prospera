import { connection } from '../config/mysql/dbmysql.js';
import { generarTexto, iaDisponible } from './ia.js';

const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO');

// ---------- Situación financiera del usuario ----------
export async function analizarSituacion(id) {
    const [[m]] = await connection.query(
        `SELECT COALESCE((SELECT SUM(monto) FROM ingresos WHERE id_usuario = ? AND YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE())), 0) AS ingresos,
                COALESCE((SELECT SUM(monto) FROM gastos WHERE id_usuario = ? AND YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE())), 0) AS gastos,
                COALESCE((SELECT SUM(g.monto) FROM gastos g JOIN categorias c ON c.id_categoria = g.id_categoria WHERE g.id_usuario = ? AND c.nombre = 'Compras impulsivas'
                          AND YEAR(g.fecha) = YEAR(CURDATE()) AND MONTH(g.fecha) = MONTH(CURDATE())), 0) AS impulsivos,
                COALESCE((SELECT SUM(saldo_pendiente) FROM deudas WHERE id_usuario = ? AND estado <> 'pagada'), 0) AS deudas,
                COALESCE((SELECT MAX(tasa_interes_anual) FROM deudas WHERE id_usuario = ? AND estado <> 'pagada'), 0) AS tasaMax,
                COALESCE((SELECT SUM(monto_actual) FROM metas_ahorro WHERE id_usuario = ? AND estado <> 'cancelada'), 0) +
                COALESCE((SELECT SUM(saldo) FROM cuentas_ahorro WHERE id_usuario = ?), 0) AS ahorro,
                (SELECT COUNT(*) FROM inversiones WHERE id_usuario = ? AND estado = 'activa') AS inversiones,
                (SELECT COUNT(*) FROM presupuestos WHERE id_usuario = ? AND anio = YEAR(CURDATE()) AND mes = MONTH(CURDATE())) AS presupuesto,
                (SELECT COUNT(*) FROM metas_ahorro WHERE id_usuario = ? AND estado = 'activa') AS metas`,
        [id, id, id, id, id, id, id, id, id, id]
    );
    const mensual = m.gastos || 1;
    const mesesFondo = m.gastos > 0 ? m.ahorro / m.gastos : (m.ahorro > 0 ? 6 : 0);
    const ratioGasto = m.ingresos > 0 ? m.gastos / m.ingresos : null;
    return { ...m, mesesFondo: Math.round(mesesFondo * 10) / 10, ratioGasto, mensual };
}

// Qué temas le convienen según su situación, con la razón en lenguaje claro
export function temasRecomendados(s) {
    const t = [];
    if (s.deudas > 0) t.push({ tema: 'deudas', razon: `Tienes deudas por ${fmt(s.deudas)}${s.tasaMax >= 18 ? ` y una cobra ${s.tasaMax}% E.A.` : ''}: aprender a pagarlas rápido te ahorra intereses.` });
    if (s.ingresos > 0 && s.mesesFondo < 3) t.push({ tema: 'ahorro', razon: `Tu ahorro cubre ${s.mesesFondo} meses de gastos; lo ideal son 3 a 6. Estas lecciones te ayudan a armar tu fondo de emergencia.` });
    if (!s.presupuesto) t.push({ tema: 'presupuesto', razon: 'Aún no tienes presupuesto este mes: ordenar tus gastos es el primer paso.' });
    if (s.ratioGasto !== null && s.ratioGasto >= 0.8) t.push({ tema: 'presupuesto', razon: `Ya gastaste el ${Math.round(s.ratioGasto * 100)}% de tus ingresos este mes: conviene distinguir necesidades de deseos.` });
    if (s.impulsivos > 0) t.push({ tema: 'presupuesto', razon: `Registraste ${fmt(s.impulsivos)} en compras impulsivas este mes.` });
    if (!s.inversiones && s.mesesFondo >= 3 && s.deudas === 0) t.push({ tema: 'inversiones', razon: 'Ya tienes colchón y no tienes deudas: es buen momento para aprender a invertir.' });
    if (s.inversiones > 0) t.push({ tema: 'inversiones', razon: 'Ya tienes inversiones: profundiza en riesgo y diversificación.' });
    if (!t.length) t.push({ tema: 'general', razon: 'Vas bien. Sigue aprendiendo para mantener el rumbo.' });
    const vistos = new Set();
    return t.filter((x) => (vistos.has(x.tema + x.razon) ? false : vistos.add(x.tema + x.razon)));
}

const SISTEMA_EDU = `Eres un profesor de educación financiera para personas en Colombia y Latinoamérica. Español claro, cercano y práctico; sin jerga.
Reglas: no prometas rentabilidades, no recomiendes activos concretos, prioriza fondo de emergencia, deudas caras y luego inversión prudente; usa solo los datos del usuario que se te dan; no inventes cifras ni normas. Es contenido educativo.`;

// ---------- Lección personalizada ----------
function leccionBasica(s, tema) {
    const partes = [];
    const t = tema || temasRecomendados(s)[0].tema;
    if (t === 'deudas' || s.deudas > 0) {
        partes.push(`Hoy debes ${fmt(s.deudas)}${s.tasaMax ? ` y la deuda más cara cobra ${s.tasaMax}% E.A.` : ''}.`, 'Estrategia avalancha: paga el mínimo de todas y todo lo extra a la deuda de mayor interés. Cada peso que abonas "rinde" lo que esa deuda cobra, sin riesgo.', 'Paso de hoy: elige un monto fijo extra al mes y programa el pago el mismo día que recibes tu ingreso.');
    } else if (t === 'ahorro' || s.mesesFondo < 3) {
        partes.push(`Tu ahorro cubre ${s.mesesFondo} meses de gastos${s.mensual > 1 ? ` (gastas cerca de ${fmt(s.mensual)} al mes)` : ''}.`, `Meta sana: 3 a 6 meses${s.mensual > 1 ? `, es decir entre ${fmt(s.mensual * 3)} y ${fmt(s.mensual * 6)}` : ''}.`, 'Paso de hoy: crea una meta "Fondo de emergencia" y aporta aunque sea el 5% de tu próximo ingreso.');
    } else if (t === 'inversiones') {
        partes.push('Ya tienes una base sólida para pensar en invertir.', 'Empieza con productos simples (ahorro programado, CDT, fondos de inversión colectiva), entiende su riesgo y plazo, y diversifica.', 'Paso de hoy: usa el simulador de Inversiones para ver cuánto crece un aporte mensual pequeño.');
    } else {
        partes.push('Lo más poderoso en finanzas personales es la constancia.', 'Registra tus movimientos, revisa tu presupuesto cada semana y ahorra primero, gasta después.', 'Paso de hoy: revisa en qué categoría gastaste más este mes y ponle un límite.');
    }
    return partes.join('\n\n');
}

export async function generarLeccion(s, tema, usarIA) {
    const contexto = `Ingresos del mes ${fmt(s.ingresos)}; gastos ${fmt(s.gastos)}; deudas ${fmt(s.deudas)} (tasa máx ${s.tasaMax}% E.A.); ahorro total ${fmt(s.ahorro)} (${s.mesesFondo} meses de gastos); inversiones activas ${s.inversiones}; tiene presupuesto: ${s.presupuesto ? 'sí' : 'no'}.`;
    const titulo = tema ? `Lección sobre ${tema}` : 'Tu lección personalizada';
    if (usarIA && iaDisponible()) {
        try {
            const { texto, proveedor } = await generarTexto({
                sistema: SISTEMA_EDU,
                mensajes: [{ role: 'user', content: `Crea una mini-lección (máx. 220 palabras) para esta persona${tema ? ` sobre el tema "${tema}"` : ' sobre lo más importante para su situación'}. Estructura: 1) por qué esto le importa HOY con sus números, 2) el concepto explicado con un ejemplo, 3) un paso concreto para esta semana. Datos: ${contexto}` }],
                maxTokens: 650,
            });
            return { titulo, texto, modo: 'ia', proveedor };
        } catch (error) {
            console.error('[educacion] La IA no pudo generar la lección:', error.message);
        }
    }
    return { titulo, texto: leccionBasica(s, tema), modo: 'basico' };
}

// ---------- Actividades (quiz) ----------
const BANCO = {
    ahorro: [
        { pregunta: '¿Cuál es la regla de oro del ahorro?', opciones: ['Ahorrar lo que sobre a fin de mes', 'Pagarte primero a ti: separar el ahorro apenas recibes el ingreso', 'Ahorrar solo cuando hay un imprevisto', 'Guardar el dinero en efectivo en casa'], correcta: 1, explicacion: 'Si esperas a "lo que sobre", casi nunca sobra. Separa primero y gasta el resto.' },
        { pregunta: '¿Cuánto debería cubrir un fondo de emergencia?', opciones: ['1 semana de gastos', '3 a 6 meses de gastos esenciales', 'Un año de salario', 'Solo el próximo arriendo'], correcta: 1, explicacion: 'De 3 a 6 meses de gastos esenciales (6 si tu ingreso es variable o tienes dependientes).' },
        { pregunta: '¿Dónde conviene guardar el fondo de emergencia?', opciones: ['En acciones', 'En criptomonedas', 'En una cuenta o producto de fácil acceso y bajo riesgo', 'En un CDT a 5 años'], correcta: 2, explicacion: 'Debe estar disponible rápido y sin riesgo de perder valor.' },
        { pregunta: '¿Qué hace que una meta de ahorro sea más fácil de cumplir?', opciones: ['Que sea vaga', 'Que tenga monto, plazo y aportes automáticos', 'Que no la anotes', 'Que dependa de la suerte'], correcta: 1, explicacion: 'Una meta concreta (cuánto y para cuándo) con aportes automáticos se cumple mucho más.' },
    ],
    presupuesto: [
        { pregunta: 'En la regla 50/30/20, ¿a qué se destina el 20%?', opciones: ['Ocio', 'Ahorro y pago de deudas', 'Arriendo', 'Regalos'], correcta: 1, explicacion: '50% necesidades, 30% deseos y 20% ahorro e inversión (y deudas extra).' },
        { pregunta: '¿Cuál de estos es una NECESIDAD?', opciones: ['Streaming de películas', 'Ropa de moda nueva', 'Transporte al trabajo', 'Salidas a comer'], correcta: 2, explicacion: 'Necesidad es lo que no puedes dejar de pagar sin consecuencias serias.' },
        { pregunta: '¿Qué son los "gastos hormiga"?', opciones: ['Gastos grandes y raros', 'Compras pequeñas y frecuentes que suman mucho', 'Impuestos', 'Pagos de deudas'], correcta: 1, explicacion: 'Cafés, domicilios y antojos pequeños parecen poco, pero al mes suman bastante.' },
        { pregunta: '¿Cada cuánto conviene revisar tu presupuesto?', opciones: ['Una vez al año', 'Nunca', 'Cada semana o al menos cada mes', 'Solo si hay problemas'], correcta: 2, explicacion: 'Revisarlo seguido te permite corregir a tiempo antes de pasarte.' },
    ],
    inversiones: [
        { pregunta: '¿Qué relación suele haber entre rentabilidad y riesgo?', opciones: ['A mayor rentabilidad esperada, mayor riesgo', 'No hay relación', 'A mayor riesgo, siempre mayor ganancia', 'Lo seguro rinde más'], correcta: 0, explicacion: 'Mayor rentabilidad esperada suele implicar más riesgo, pero el riesgo NO garantiza ganancia.' },
        { pregunta: '¿Qué significa diversificar?', opciones: ['Poner todo en una sola inversión buena', 'Repartir el dinero en distintos productos y plazos', 'Cambiar de banco', 'Invertir solo en dólares'], correcta: 1, explicacion: 'Repartir reduce el impacto de que una inversión salga mal.' },
        { pregunta: '¿Qué debes tener ANTES de invertir en productos con riesgo?', opciones: ['Un préstamo', 'Fondo de emergencia y deudas caras controladas', 'Un dato de amigos', 'Nada'], correcta: 1, explicacion: 'Primero colchón y deudas caras; luego, invertir lo que no necesitas a corto plazo.' },
        { pregunta: 'Te prometen "ganancias del 30% mensual garantizadas". Lo más probable es que sea...', opciones: ['Una gran oportunidad', 'Una posible estafa', 'Un CDT', 'Un fondo de pensiones'], correcta: 1, explicacion: 'Ganancias altas y garantizadas son la señal clásica de pirámides y estafas.' },
    ],
    deudas: [
        { pregunta: 'En el método avalancha, ¿qué deuda se paga primero?', opciones: ['La más pequeña', 'La de mayor tasa de interés', 'La más antigua', 'La que menos molesta'], correcta: 1, explicacion: 'Pagar primero la de mayor interés minimiza el costo total.' },
        { pregunta: 'Pagar solo el mínimo de la tarjeta de crédito suele...', opciones: ['Ser la mejor opción', 'Alargar la deuda y aumentar mucho los intereses', 'Bajar la tasa', 'Mejorar tu historial de inmediato'], correcta: 1, explicacion: 'El pago mínimo casi solo cubre intereses y la deuda dura años.' },
        { pregunta: '¿Qué porcentaje de tus ingresos no deberían superar tus cuotas de deuda?', opciones: ['10%', 'Entre 30% y 35%', '70%', '100%'], correcta: 1, explicacion: 'Por encima de 30-35% el endeudamiento se vuelve riesgoso.' },
        { pregunta: 'Si no puedes pagar una cuota, lo más sensato es...', opciones: ['Esconderte', 'Contactar al acreedor para renegociar plazos o tasas', 'Pedir otro crédito para pagar', 'Ignorarlo'], correcta: 1, explicacion: 'Renegociar a tiempo suele ser posible y evita mora y reportes negativos.' },
    ],
    general: [
        { pregunta: '¿Qué es la inflación?', opciones: ['La subida general de precios que reduce lo que compra tu dinero', 'Un impuesto', 'Un tipo de crédito', 'La ganancia de un CDT'], correcta: 0, explicacion: 'Con inflación, el mismo dinero compra menos con el tiempo.' },
        { pregunta: '¿Qué es el interés compuesto?', opciones: ['Interés sobre el capital inicial solamente', 'Interés que se calcula también sobre los intereses ya ganados', 'Una comisión', 'Un seguro'], correcta: 1, explicacion: 'Ganar intereses sobre intereses hace que el dinero crezca cada vez más rápido.' },
        { pregunta: '¿Cuál es un buen primer paso para ordenar tus finanzas?', opciones: ['Comprar a cuotas', 'Registrar tus ingresos y gastos', 'Invertir en cripto', 'Pedir un préstamo'], correcta: 1, explicacion: 'No se puede mejorar lo que no se mide.' },
        { pregunta: '¿Qué entidad vigila a los bancos y productos financieros en Colombia?', opciones: ['La DIAN', 'La Superintendencia Financiera', 'El Ministerio de Cultura', 'Ninguna'], correcta: 1, explicacion: 'Verifica siempre que la entidad esté vigilada por la Superintendencia Financiera.' },
    ],
};

const barajar = (a) => [...a].sort(() => Math.random() - 0.5);
const esValida = (p) => p && typeof p.pregunta === 'string' && Array.isArray(p.opciones) && p.opciones.length === 4 && p.opciones.every((o) => typeof o === 'string')
    && Number.isInteger(p.correcta) && p.correcta >= 0 && p.correcta <= 3;

export async function generarQuiz(tema, s, usarIA) {
    const clave = BANCO[tema] ? tema : 'general';
    if (usarIA && iaDisponible()) {
        try {
            const { texto, proveedor } = await generarTexto({
                sistema: `${SISTEMA_EDU}\nResponde ÚNICAMENTE con JSON válido, sin texto adicional ni bloques de código.`,
                mensajes: [{ role: 'user', content: `Crea un quiz de 3 preguntas de opción múltiple sobre "${clave}" para una persona con esta situación: deudas ${fmt(s.deudas)}, ahorro ${s.mesesFondo} meses de gastos, ${s.inversiones} inversiones. Formato exacto: {"preguntas":[{"pregunta":"...","opciones":["a","b","c","d"],"correcta":0,"explicacion":"..."}]} (correcta es el índice 0 a 3 de la opción correcta; explicación breve).` }],
                maxTokens: 900,
            });
            const json = JSON.parse(texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1));
            const preguntas = (json.preguntas || []).filter(esValida).slice(0, 3);
            if (preguntas.length === 3) return { preguntas, modo: 'ia', proveedor, tema: clave };
        } catch (error) {
            console.error('[educacion] La IA no pudo generar el quiz:', error.message);
        }
    }
    return { preguntas: barajar(BANCO[clave]).slice(0, 3), modo: 'basico', tema: clave };
}

export const TEMAS_QUIZ = Object.keys(BANCO);
