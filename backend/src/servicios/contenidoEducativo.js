import { connection } from '../config/mysql/dbmysql.js';

// Texto de las lecciones que vienen de fábrica en la base de datos (solo se escribe donde está vacío)
const LECCIONES = {
    '¿Qué es el ahorro y por qué importa?': `Ahorrar es separar hoy una parte de tu dinero para usarla mañana. No se trata de gastar menos por gusto, sino de darle un propósito a lo que ganas.

Por qué importa:
• Te protege de imprevistos (salud, desempleo, reparaciones) sin endeudarte.
• Te permite cumplir metas: estudio, vivienda, un viaje.
• Te da tranquilidad y libertad para decidir.

Primer paso: define una meta concreta (qué, cuánto y para cuándo) y crea una meta en la sección Ahorros.`,
    'La regla: primero se ahorra, después se gasta': `El error más común es ahorrar "lo que sobre": casi nunca sobra. La regla es pagarte primero a ti.

Cómo aplicarla:
1. El día que recibes tu ingreso, separa al menos el 10% (ideal 20%).
2. Muévelo a otra cuenta o a una meta de ahorro, fuera de tu vista.
3. Gasta el resto con tranquilidad.

Automatiza la transferencia para que no dependa de tu fuerza de voluntad. Empezar con poco es mejor que no empezar.`,
    'Cómo crear tu primer presupuesto mensual': `Un presupuesto es un plan para tu dinero, no una prohibición.

Pasos:
1. Suma todos tus ingresos del mes.
2. Anota tus gastos fijos (arriendo, servicios, cuotas) y variables (comida, transporte, ocio).
3. Usa la regla 50/30/20: 50% necesidades, 30% deseos, 20% ahorro y deudas.
4. Fija un límite por categoría y revísalo cada semana.

En Ahorra y Prospera puedes crear tu presupuesto en la sección Presupuesto y recibir alertas cuando te acerques al límite.`,
    'Necesidades vs. deseos': `Necesidad: lo que no puedes dejar de pagar sin consecuencias serias (vivienda, comida básica, salud, transporte al trabajo).
Deseo: lo que mejora tu vida pero puedes aplazar (salidas, ropa extra, suscripciones, tecnología nueva).

Antes de comprar pregúntate:
• ¿Lo necesitaba hace un mes?
• ¿Me alcanza sin usar crédito?
• ¿Esperar 48 horas cambia mi opinión?

Los "gastos hormiga" (cafés, domicilios, compras pequeñas) suman mucho: revísalos en tus gastos del mes.`,
    'Introducción a las inversiones simples': `Invertir es poner tu dinero a trabajar para que crezca con el tiempo. Productos sencillos para empezar:

• Ahorro programado: aportes periódicos, riesgo bajo.
• CDT: dejas tu dinero a plazo fijo con una tasa pactada, riesgo bajo.
• Fondos de inversión colectiva: tu dinero se junta con el de otros y lo administra un experto, riesgo medio.
• Pensiones voluntarias: ahorro de largo plazo para el retiro.

A mayor rentabilidad esperada, mayor riesgo. Empieza por lo simple y entiende cada producto antes de invertir.`,
    'Invierte solo lo que no necesitas a corto plazo': `Regla de oro: no inviertas dinero que puedas necesitar pronto.

Antes de invertir:
1. Ten tu fondo de emergencia (3 a 6 meses de gastos).
2. Paga primero las deudas caras (tarjetas, créditos de consumo).
3. Define tu horizonte: para menos de 3 años, prefiere productos de bajo riesgo.
4. Diversifica: no pongas todo en un solo lugar.

Desconfía de promesas de ganancias altas y rápidas: si suena demasiado bueno, suele ser una estafa.`,
    'Cómo salir de deudas': `Dos métodos probados:

• Avalancha: pagas el mínimo en todas y todo lo extra a la de mayor tasa de interés. Es la que menos intereses te cuesta.
• Bola de nieve: empiezas por la deuda más pequeña para ganar motivación.

Pasos:
1. Lista todas tus deudas con saldo, tasa y cuota.
2. Elige un método y destina un monto extra fijo cada mes.
3. No adquieras nuevas deudas mientras pagas.
4. Si no alcanzas, renegocia plazos o tasas con el acreedor.

Usa la sección Deudas y Pagos y el Plan Financiero IA para ver en cuántos meses quedarías libre.`,
    'Uso responsable del crédito': `El crédito es una herramienta: bien usado te ayuda, mal usado te ahoga.

Buenas prácticas:
• Que tus cuotas no superen el 30-35% de tus ingresos.
• Paga la totalidad de la tarjeta cada mes; el pago mínimo es la forma más cara de endeudarte.
• Compara la tasa efectiva anual, no solo la cuota.
• Evita usar crédito para gastos de deseo.
• Paga a tiempo: tu historial crediticio abre o cierra puertas en el futuro.`,
};

export async function sembrarContenidoEducativo() {
    try {
        for (const [titulo, texto] of Object.entries(LECCIONES)) {
            await connection.query('UPDATE contenido_educativo SET contenido = ? WHERE titulo = ? AND contenido IS NULL', [texto, titulo]);
        }
    } catch (error) {
        console.error('No se pudo cargar el contenido educativo:', error.message);
    }
}
