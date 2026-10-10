import { generarTexto, iaDisponible } from './ia.js';

// Resumen redactado por IA (Gemini, Groq o Claude) a partir del plan calculado.
// Es opcional: si no hay ninguna IA configurada devuelve null y el plan se muestra igual.

export async function resumenExperto(plan, nombre) {
    if (!iaDisponible()) return null;

    const { diagnostico: d, capacidad, fondo, deudas, inversion } = plan;
    const datos = {
        puntaje: d.puntaje, nivel: d.nivel, ingresos: d.ingresoTotal, gastos: d.gastosTotal, cuotasDeuda: d.cuotasDeuda,
        saldoDeudas: d.saldoDeudas, flujoLibre: d.flujoLibre, tasaAhorro: d.tasaAhorro, relacionDeuda: d.relacionDeuda,
        mesesFondo: fondo.mesesCubiertos, metaFondoMeses: fondo.mesesMeta, reparto: capacidad.reparto,
        mesesParaSalirDeDeudas: deudas.hay ? deudas.conPlan.meses : 0, perfilInversion: inversion.perfil,
        rendimientoEsperado: inversion.rendimientoEsperado, moneda: plan.moneda,
    };

    try {
        const { texto } = await generarTexto({
            sistema: 'Eres un asesor experto en finanzas personales e inversiones. Escribes en español, claro y empático, sin jerga innecesaria. Usa solo los números que te dan; no inventes cifras. No prometas rentabilidades ni recomiendes activos específicos; aclara que es orientación educativa.',
            mensajes: [{ role: 'user', content: `Redacta para ${nombre} un resumen ejecutivo de su situación y de los 3 pasos más importantes de su plan (máximo 180 palabras, en viñetas cortas). Datos calculados: ${JSON.stringify(datos)}` }],
            maxTokens: 600,
        });
        return texto;
    } catch {
        return null;
    }
}
