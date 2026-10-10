// Motor del asesor financiero: convierte los datos del usuario en un plan
// (diagnóstico, presupuesto, deudas, fondo de emergencia, metas e inversión).
// Las reglas siguen prácticas habituales de planeación financiera personal:
// regla 50/30/20, fondo de emergencia de 3 a 6 meses, método avalancha para deudas
// y portafolio según perfil de riesgo y horizonte. Es educativo, no asesoría regulada.

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
};
const redondear = (n) => Math.round(n);
const suma = (lista, campo) => lista.reduce((t, x) => t + num(x[campo]), 0);

// Para qué se busca el plan: cambia el reparto del dinero y las recomendaciones
export const OBJETIVOS = {
    general: { etiqueta: 'Plan financiero general', meta: false, consejo: 'Un plan general equilibra deudas, fondo de emergencia, metas e inversión según tu situación.' },
    emergencia: { etiqueta: 'Crear mi fondo de emergencia', meta: false, consejo: 'Prioriza reunir 3 a 6 meses de gastos esenciales en una cuenta de fácil acceso antes de asumir riesgos.' },
    deudas: { etiqueta: 'Salir de deudas', meta: false, consejo: 'Paga el mínimo de todas y destina todo lo extra a la de mayor interés; evita nuevos créditos mientras tanto.' },
    vivienda: { etiqueta: 'Comprar vivienda', meta: true, consejo: 'Reúne la cuota inicial (suele ser 20-30% del valor) y cuida que la cuota mensual del crédito no supere 30% de tus ingresos. Mantén un buen historial crediticio.' },
    vehiculo: { etiqueta: 'Comprar vehículo', meta: true, consejo: 'Considera además seguro, impuestos y mantenimiento (pueden sumar 15-20% anual del valor). Ahorrar una cuota inicial grande reduce los intereses del crédito.' },
    viaje: { etiqueta: 'Planear un viaje', meta: true, consejo: 'Para metas de menos de 2 años usa productos de bajo riesgo y alta disponibilidad (ahorro programado o CDT corto).' },
    educacion: { etiqueta: 'Pagar estudios', meta: true, consejo: 'Invertir en educación aumenta tus ingresos futuros. Explora becas y créditos educativos de bajo costo antes de endeudarte.' },
    retiro: { etiqueta: 'Preparar mi retiro', meta: false, consejo: 'El tiempo es tu mejor aliado: aportes pequeños y constantes a pensiones voluntarias o fondos de largo plazo crecen con el interés compuesto.' },
    invertir: { etiqueta: 'Empezar a invertir', meta: false, consejo: 'Antes de invertir en productos con riesgo, ten tu fondo de emergencia y las deudas caras controladas. Empieza simple y diversifica.' },
    emprender: { etiqueta: 'Crear un negocio', meta: true, consejo: 'Separa el dinero del negocio del personal, mantén tu fondo de emergencia aparte y calcula cuántos meses de gastos necesitas para sostenerte mientras arranca.' },
    otro: { etiqueta: 'Otro objetivo', meta: true, consejo: 'Ponle monto y plazo a tu objetivo para convertirlo en una meta de ahorro medible.' },
};

// Rendimientos anuales esperados (supuestos editables, referencia Colombia)
export const PRODUCTOS = [
    { clave: 'ahorro', nombre: 'Ahorro programado / cuenta de ahorros', riesgo: 'bajo', rendimiento: 4 },
    { clave: 'cdt', nombre: 'CDT / Depósito a término', riesgo: 'bajo', rendimiento: 9.5 },
    { clave: 'fic', nombre: 'Fondo de inversión colectiva', riesgo: 'medio', rendimiento: 8.5 },
    { clave: 'pension', nombre: 'Fondo de pensiones voluntarias', riesgo: 'bajo', rendimiento: 8 },
    { clave: 'bonos', nombre: 'Bonos', riesgo: 'medio', rendimiento: 10 },
    { clave: 'acciones', nombre: 'Acciones / ETF', riesgo: 'alto', rendimiento: 12 },
];

const PORTAFOLIOS = {
    conservador: { ahorro: 20, cdt: 35, fic: 15, pension: 20, bonos: 10, acciones: 0 },
    moderado: { ahorro: 10, cdt: 20, fic: 25, pension: 15, bonos: 10, acciones: 20 },
    agresivo: { ahorro: 5, cdt: 10, fic: 25, pension: 10, bonos: 10, acciones: 40 },
};

// Simula el pago de deudas con el método avalancha (primero la de mayor tasa)
export function simularDeudas(deudas, extra = 0) {
    const lista = deudas
        .filter((d) => num(d.saldo) > 0)
        .map((d) => {
            const tasa = num(d.tasa);
            const tasaMensual = Math.pow(1 + tasa / 100, 1 / 12) - 1;
            const saldo = num(d.saldo);
            const minimo = num(d.cuota) || saldo * 0.03;
            return { nombre: d.acreedor || d.nombre || 'Deuda', saldo, tasa, tasaMensual, minimo, mesPagada: null };
        })
        .sort((a, b) => b.tasa - a.tasa);

    const presupuesto = lista.reduce((t, d) => t + d.minimo, 0) + num(extra);
    const cronograma = [];
    let interesTotal = 0;
    let mes = 0;

    while (lista.some((d) => d.saldo > 0.5) && mes < 600) {
        mes++;
        let interesMes = 0;
        for (const d of lista) {
            if (d.saldo <= 0.5) continue;
            const interes = d.saldo * d.tasaMensual;
            d.saldo += interes;
            interesMes += interes;
        }
        let disponible = presupuesto;
        // 1) pagos mínimos
        for (const d of lista) {
            if (d.saldo <= 0.5) continue;
            const pago = Math.min(d.minimo, d.saldo, disponible);
            d.saldo -= pago;
            disponible -= pago;
        }
        // 2) lo que sobra, a la deuda más cara
        for (const d of lista) {
            if (disponible <= 0) break;
            if (d.saldo <= 0.5) continue;
            const pago = Math.min(d.saldo, disponible);
            d.saldo -= pago;
            disponible -= pago;
        }
        for (const d of lista) {
            if (d.saldo <= 0.5 && d.mesPagada === null) d.mesPagada = mes;
        }
        interesTotal += interesMes;
        cronograma.push({
            mes,
            pago: redondear(presupuesto - disponible),
            interes: redondear(interesMes),
            saldo: redondear(lista.reduce((t, d) => t + Math.max(d.saldo, 0), 0)),
        });
    }

    return {
        meses: mes,
        interesTotal: redondear(interesTotal),
        orden: lista.map((d) => ({ nombre: d.nombre, tasa: d.tasa, mesPagada: d.mesPagada })),
        cronograma,
        presupuestoMensual: redondear(presupuesto),
        completa: !lista.some((d) => d.saldo > 0.5),
    };
}

// Valor futuro de aportes mensuales con capitalización mensual
function valorFuturo(inicial, aporteMensual, rendimientoAnual, meses) {
    const r = Math.pow(1 + rendimientoAnual / 100, 1 / 12) - 1;
    let saldo = inicial;
    for (let i = 0; i < meses; i++) saldo = saldo * (1 + r) + aporteMensual;
    return saldo;
}

export function generarPlan(entrada) {
    const ingresos = (entrada.ingresos || []).map((i) => ({ fuente: String(i.fuente || 'Ingreso'), monto: num(i.monto) }));
    const gastos = (entrada.gastos || []).map((g) => ({
        categoria: String(g.categoria || 'Gasto'),
        monto: num(g.monto),
        tipo: g.tipo === 'deseo' ? 'deseo' : 'necesidad',
    }));
    const deudas = (entrada.deudas || []).map((d) => ({
        acreedor: String(d.acreedor || 'Deuda'),
        saldo: num(d.saldo),
        tasa: num(d.tasa),
        cuota: num(d.cuota),
    }));
    const metas = (entrada.metas || []).map((m) => ({
        nombre: String(m.nombre || 'Meta'),
        objetivo: num(m.objetivo),
        actual: num(m.actual),
        meses: Math.max(1, Math.round(num(m.meses)) || 12),
    }));
    const perfil = {
        edad: Math.round(num(entrada.perfil?.edad)) || 30,
        riesgo: ['conservador', 'moderado', 'agresivo'].includes(entrada.perfil?.riesgo) ? entrada.perfil.riesgo : 'moderado',
        horizonte: Math.min(30, Math.max(1, Math.round(num(entrada.perfil?.horizonte)) || 5)),
        dependientes: Math.round(num(entrada.perfil?.dependientes)),
        ingresoEstable: entrada.perfil?.ingresoEstable !== false,
    };
    const tipoObjetivo = OBJETIVOS[entrada.objetivo?.tipo] ? entrada.objetivo.tipo : 'general';
    const objetivo = {
        tipo: tipoObjetivo,
        etiqueta: OBJETIVOS[tipoObjetivo].etiqueta,
        nombre: String(entrada.objetivo?.nombre || OBJETIVOS[tipoObjetivo].etiqueta).slice(0, 80),
        monto: num(entrada.objetivo?.monto),
        meses: Math.max(1, Math.round(num(entrada.objetivo?.meses)) || 12),
        esMeta: OBJETIVOS[tipoObjetivo].meta && num(entrada.objetivo?.monto) > 0,
    };
    if (objetivo.esMeta && !metas.some((m) => m.nombre === objetivo.nombre)) {
        metas.unshift({ nombre: objetivo.nombre, objetivo: objetivo.monto, actual: 0, meses: objetivo.meses });
    }
    const ahorroActual = num(entrada.ahorroActual);
    const moneda = String(entrada.moneda || 'COP').slice(0, 3);

    // ---------- Diagnóstico ----------
    const ingresoTotal = suma(ingresos, 'monto');
    const necesidades = gastos.filter((g) => g.tipo === 'necesidad').reduce((t, g) => t + g.monto, 0);
    const deseos = gastos.filter((g) => g.tipo === 'deseo').reduce((t, g) => t + g.monto, 0);
    const gastosTotal = necesidades + deseos;
    const cuotasDeuda = suma(deudas, 'cuota');
    const saldoDeudas = suma(deudas, 'saldo');
    const flujoLibre = ingresoTotal - gastosTotal - cuotasDeuda;
    const tasaAhorro = ingresoTotal ? (flujoLibre / ingresoTotal) * 100 : 0;
    const relDeuda = ingresoTotal ? (cuotasDeuda / ingresoTotal) * 100 : 0;
    const pctDeseos = ingresoTotal ? (deseos / ingresoTotal) * 100 : 0;
    const pctNecesidades = ingresoTotal ? ((necesidades + cuotasDeuda) / ingresoTotal) * 100 : 0;
    const gastoEsencial = necesidades + cuotasDeuda;
    const mesesFondoMeta = perfil.dependientes > 0 || !perfil.ingresoEstable ? 6 : 4;
    const metaFondo = gastoEsencial * mesesFondoMeta;
    const mesesFondo = gastoEsencial ? ahorroActual / gastoEsencial : 0;
    const deudaCara = deudas.some((d) => d.saldo > 0 && d.tasa >= 18);

    let puntaje = 100;
    if (flujoLibre < 0) puntaje -= 20;
    if (tasaAhorro < 10) puntaje -= Math.min(25, (10 - tasaAhorro) * 2);
    if (relDeuda > 36) puntaje -= 25;
    else if (relDeuda > 20) puntaje -= 12;
    if (mesesFondo < 3) puntaje -= Math.min(18, (3 - mesesFondo) * 6);
    if (pctDeseos > 30) puntaje -= Math.min(15, (pctDeseos - 30) * 0.75);
    if (deudaCara) puntaje -= 6;
    puntaje = Math.max(0, Math.min(100, Math.round(puntaje)));
    const nivel = puntaje >= 80 ? 'Excelente' : puntaje >= 60 ? 'Buena' : puntaje >= 40 ? 'En riesgo moderado' : 'Crítica';

    // ---------- Capacidad de ahorro y reparto ----------
    const ahorroIdeal = ingresoTotal * 0.2;
    const recorteSugerido = Math.max(0, Math.min(deseos * 0.5, ahorroIdeal - flujoLibre));
    const capacidad = Math.max(0, flujoLibre + recorteSugerido);

    const pesos = deudaCara
        ? { deuda: 45, fondo: 25, metas: 15, inversion: 15 }
        : saldoDeudas > 0
            ? { deuda: 25, fondo: 30, metas: 20, inversion: 25 }
            : { deuda: 0, fondo: 40, metas: 25, inversion: 35 };
    if (saldoDeudas <= 0) pesos.deuda = 0;
    if (ahorroActual >= metaFondo) pesos.fondo = 0;
    else if (mesesFondo < 1) pesos.fondo += 20;
    if (!metas.some((m) => m.objetivo > m.actual)) pesos.metas = 0;
    if (mesesFondo < 3 && ahorroActual < metaFondo) pesos.inversion = Math.round(pesos.inversion / 2);
    // El objetivo elegido cambia el énfasis del reparto
    if (objetivo.tipo === 'emergencia' && ahorroActual < metaFondo) { pesos.fondo += 30; pesos.inversion = Math.round(pesos.inversion / 2); }
    if (objetivo.tipo === 'deudas' && saldoDeudas > 0) { pesos.deuda += 25; pesos.inversion = Math.round(pesos.inversion / 2); }
    if (objetivo.esMeta) pesos.metas = (pesos.metas || 0) + 30;
    if (['retiro', 'invertir'].includes(objetivo.tipo)) pesos.inversion += 25;
    const totalPesos = pesos.deuda + pesos.fondo + pesos.metas + pesos.inversion;
    const reparto = {};
    for (const k of Object.keys(pesos)) {
        reparto[k] = totalPesos ? redondear((capacidad * pesos[k]) / totalPesos) : 0;
    }
    if (!totalPesos) reparto.inversion = redondear(capacidad);

    // ---------- Presupuesto recomendado ----------
    const factorDeseos = deseos > 0 ? Math.max(0, (deseos - recorteSugerido) / deseos) : 1;
    const presupuesto = gastos.map((g) => ({
        categoria: g.categoria,
        tipo: g.tipo,
        actual: redondear(g.monto),
        recomendado: redondear(g.tipo === 'deseo' ? g.monto * factorDeseos : g.monto),
    }));
    const regla = {
        necesidades: { ideal: redondear(ingresoTotal * 0.5), actual: redondear(necesidades + cuotasDeuda) },
        deseos: { ideal: redondear(ingresoTotal * 0.3), actual: redondear(deseos) },
        ahorro: { ideal: redondear(ingresoTotal * 0.2), actual: redondear(Math.max(flujoLibre, 0)) },
    };

    // ---------- Deudas ----------
    const conPlan = simularDeudas(deudas, reparto.deuda);
    const soloMinimos = simularDeudas(deudas, 0);
    const deudasPlan = {
        hay: saldoDeudas > 0,
        extraMensual: reparto.deuda,
        conPlan,
        soloMinimos,
        ahorroIntereses: Math.max(0, soloMinimos.interesTotal - conPlan.interesTotal),
        mesesAhorrados: Math.max(0, soloMinimos.meses - conPlan.meses),
    };

    // ---------- Fondo de emergencia ----------
    const faltaFondo = Math.max(0, metaFondo - ahorroActual);
    const fondo = {
        mesesMeta: mesesFondoMeta,
        meta: redondear(metaFondo),
        actual: redondear(ahorroActual),
        falta: redondear(faltaFondo),
        mesesCubiertos: Math.round(mesesFondo * 10) / 10,
        aporteMensual: reparto.fondo,
        mesesParaCompletar: reparto.fondo > 0 ? Math.ceil(faltaFondo / reparto.fondo) : faltaFondo > 0 ? null : 0,
    };

    // ---------- Metas ----------
    const faltanMetas = metas.map((m) => Math.max(0, m.objetivo - m.actual) / m.meses);
    const sumaCuotasMetas = faltanMetas.reduce((t, c) => t + c, 0);
    const planMetas = metas.map((m, i) => {
        const faltan = Math.max(0, m.objetivo - m.actual);
        const requerida = faltanMetas[i];
        const asignada = sumaCuotasMetas ? (reparto.metas * requerida) / sumaCuotasMetas : 0;
        const alcanzable = faltan === 0 || asignada >= requerida - 1;
        return {
            nombre: m.nombre,
            objetivo: redondear(m.objetivo),
            actual: redondear(m.actual),
            faltan: redondear(faltan),
            plazoMeses: m.meses,
            cuotaRequerida: redondear(requerida),
            cuotaAsignada: redondear(asignada),
            estado: faltan === 0 ? 'Cumplida' : alcanzable ? 'Alcanzable' : 'Ampliar plazo',
            mesesReales: faltan === 0 ? 0 : asignada > 0 ? Math.ceil(faltan / asignada) : null,
        };
    });

    // ---------- Inversión ----------
    const mezcla = { ...PORTAFOLIOS[perfil.riesgo] };
    if (perfil.horizonte < 3) {
        mezcla.cdt += mezcla.acciones;
        mezcla.acciones = 0;
    }
    const aporteInversion = reparto.inversion;
    const inversion = {
        perfil: perfil.riesgo,
        horizonte: perfil.horizonte,
        aporteMensual: aporteInversion,
        distribucion: PRODUCTOS.map((p) => ({
            clave: p.clave,
            producto: p.nombre,
            riesgo: p.riesgo,
            porcentaje: mezcla[p.clave],
            aporte: redondear((aporteInversion * mezcla[p.clave]) / 100),
            rendimiento: p.rendimiento,
        })),
    };
    inversion.rendimientoEsperado = Math.round(
        (PRODUCTOS.reduce((t, p) => t + p.rendimiento * mezcla[p.clave], 0) / 100) * 100
    ) / 100;
    inversion.proyeccion = [];
    for (const anios of [1, 3, 5, 10, perfil.horizonte]) {
        if (inversion.proyeccion.some((p) => p.anios === anios)) continue;
        const meses = anios * 12;
        inversion.proyeccion.push({
            anios,
            aportado: redondear(aporteInversion * meses),
            valor: redondear(valorFuturo(0, aporteInversion, inversion.rendimientoEsperado, meses)),
            enColchon: redondear(aporteInversion * meses),
        });
    }
    inversion.proyeccion.sort((a, b) => a.anios - b.anios);

    // ---------- Proyección a 12 meses ----------
    const proyeccion12 = [];
    let fondoAcum = ahorroActual;
    let metasAcum = suma(metas, 'actual');
    let invAcum = 0;
    for (let m = 1; m <= 12; m++) {
        fondoAcum += Math.min(reparto.fondo, Math.max(0, metaFondo - fondoAcum));
        metasAcum += reparto.metas;
        invAcum = valorFuturo(0, aporteInversion, inversion.rendimientoEsperado, m);
        const fila = deudasPlan.conPlan.cronograma[m - 1];
        const saldoDeuda = deudasPlan.hay ? (fila ? fila.saldo : 0) : 0;
        proyeccion12.push({
            mes: m,
            fondo: redondear(fondoAcum),
            metas: redondear(metasAcum),
            inversion: redondear(invAcum),
            deuda: saldoDeuda,
            patrimonio: redondear(fondoAcum + metasAcum + invAcum - saldoDeuda),
        });
    }

    // ---------- Recomendaciones del asesor ----------
    const fmt = (n) => '$' + redondear(n).toLocaleString('es-CO');
    const recomendaciones = [];
    const agregar = (tipo, prioridad, titulo, mensaje) => recomendaciones.push({ tipo, prioridad, titulo, mensaje });

    {
        const m = objetivo.esMeta ? planMetas.find((x) => x.nombre === objetivo.nombre) : null;
        const detalle = m
            ? ` Para "${objetivo.nombre}" (${fmt(objetivo.monto)} en ${objetivo.meses} meses) el plan destina ${fmt(m.cuotaAsignada)} al mes: ${m.estado === 'Alcanzable' ? 'lo logras a tiempo' : `lo lograrías en unos ${m.mesesReales ?? '—'} meses; amplía el plazo o aumenta tus ingresos`}.`
            : '';
        agregar(objetivo.tipo === 'deudas' ? 'deuda' : objetivo.tipo === 'invertir' || objetivo.tipo === 'retiro' ? 'inversion' : 'general', 'alta', `Tu objetivo: ${objetivo.etiqueta}`, OBJETIVOS[objetivo.tipo].consejo + detalle);
    }
    if (flujoLibre < 0) {
        agregar('gasto', 'alta', 'Estás gastando más de lo que ganas',
            `Tu déficit mensual es de ${fmt(-flujoLibre)}. Antes de ahorrar o invertir hay que cerrar esa brecha: recorta primero los gastos de deseo (${fmt(deseos)} al mes) y revisa las suscripciones y compras impulsivas.`);
    }
    if (mesesFondo < 1) {
        agregar('ahorro', 'alta', 'Construye primero un colchón de emergencia',
            `Hoy tus ahorros cubren ${mesesFondo.toFixed(1)} meses de gastos esenciales. Empieza por reunir 1 mes (${fmt(gastoEsencial)}) y luego sube a ${mesesFondoMeta} meses (${fmt(metaFondo)}). Guárdalo en una cuenta de ahorros de fácil acceso.`);
    } else if (mesesFondo < mesesFondoMeta) {
        agregar('ahorro', 'media', 'Completa tu fondo de emergencia',
            `Tienes ${mesesFondo.toFixed(1)} de ${mesesFondoMeta} meses cubiertos. Te faltan ${fmt(faltaFondo)}; con ${fmt(reparto.fondo)} al mes lo completas en ${fondo.mesesParaCompletar ?? '—'} meses.`);
    }
    if (deudaCara) {
        const peor = [...deudas].sort((a, b) => b.tasa - a.tasa)[0];
        agregar('deuda', 'alta', 'Ataca primero la deuda más cara',
            `${peor.acreedor} cobra ${peor.tasa}% E.A.: ninguna inversión segura rinde eso. Paga los mínimos de todas y destina ${fmt(reparto.deuda)} extra al mes a esa. Terminarías de pagar todo en ${conPlan.meses} meses y te ahorrarías ${fmt(deudasPlan.ahorroIntereses)} en intereses frente a pagar solo mínimos.`);
    } else if (saldoDeudas > 0) {
        agregar('deuda', 'media', 'Plan para salir de deudas',
            `Debes ${fmt(saldoDeudas)} y pagas ${fmt(cuotasDeuda)} al mes. Con ${fmt(reparto.deuda)} extra mensuales liquidas todo en ${conPlan.meses} meses.`);
    }
    if (relDeuda > 36) {
        agregar('deuda', 'alta', 'Endeudamiento por encima del límite sano',
            `Tus cuotas son el ${relDeuda.toFixed(0)}% de tus ingresos; lo recomendable es no pasar del 30-35%. Evita nuevos créditos y evalúa consolidar o renegociar plazos y tasas.`);
    } else if (relDeuda > 20) {
        agregar('deuda', 'media', 'Vigila tu nivel de endeudamiento',
            `Tus cuotas son el ${relDeuda.toFixed(0)}% de tus ingresos. Está en zona de atención: evita endeudarte más mientras bajas el saldo.`);
    }
    if (pctDeseos > 30) {
        agregar('presupuesto', 'media', 'Tus gastos de deseo superan el 30%',
            `Gastas el ${pctDeseos.toFixed(0)}% de tus ingresos en deseos (ideal 30%). Reducirlos en ${fmt(recorteSugerido)} libera dinero para tus metas sin tocar lo esencial.`);
    }
    if (pctNecesidades > 50) {
        agregar('presupuesto', 'media', 'Las necesidades pesan más del 50%',
            `Vivienda, servicios, alimentación y cuotas suman el ${pctNecesidades.toFixed(0)}% de tus ingresos. Busca bajar costos fijos (renegociar servicios, planes de datos, seguros) o aumentar ingresos.`);
    }
    if (capacidad > 0 && aporteInversion > 0 && mesesFondo >= 3) {
        agregar('inversion', 'media', `Empieza a invertir con perfil ${perfil.riesgo}`,
            `Con ${fmt(aporteInversion)} al mes y una rentabilidad esperada de ${inversion.rendimientoEsperado}% E.A., en ${perfil.horizonte} años podrías acumular ${fmt(inversion.proyeccion[inversion.proyeccion.length - 1].valor)} (aportando ${fmt(aporteInversion * perfil.horizonte * 12)}).`);
    } else if (capacidad > 0 && mesesFondo < 3) {
        agregar('inversion', 'baja', 'Invertir viene después del colchón',
            'Antes de invertir en productos con riesgo, asegura al menos 3 meses de gastos en tu fondo de emergencia. La inversión que se asigna ahora va a productos de bajo riesgo y fácil liquidez.');
    }
    if (planMetas.some((m) => m.estado === 'Ampliar plazo')) {
        const m = planMetas.find((x) => x.estado === 'Ampliar plazo');
        agregar('ahorro', 'media', `Ajusta el plazo de "${m.nombre}"`,
            `Necesitas ${fmt(m.cuotaRequerida)} al mes y el plan asigna ${fmt(m.cuotaAsignada)}. Con ese ritmo la lograrías en ${m.mesesReales ?? '—'} meses; amplía el plazo o aumenta tus ingresos.`);
    }
    if (puntaje >= 80) {
        agregar('general', 'baja', 'Vas muy bien: mantén la constancia',
            'Automatiza tus aportes el mismo día que recibes tu ingreso y revisa tu plan cada trimestre.');
    }
    agregar('general', 'baja', 'Haz seguimiento mensual',
        'Registra tus movimientos en Ahorra y Prospera y vuelve a generar este plan cada mes: los números cambian y el plan debe ajustarse.');

    return {
        generadoEn: new Date().toISOString(),
        moneda,
        perfil,
        objetivo,
        diagnostico: {
            puntaje,
            nivel,
            ingresoTotal: redondear(ingresoTotal),
            gastosTotal: redondear(gastosTotal),
            necesidades: redondear(necesidades),
            deseos: redondear(deseos),
            cuotasDeuda: redondear(cuotasDeuda),
            saldoDeudas: redondear(saldoDeudas),
            flujoLibre: redondear(flujoLibre),
            tasaAhorro: Math.round(tasaAhorro * 10) / 10,
            relacionDeuda: Math.round(relDeuda * 10) / 10,
            pctDeseos: Math.round(pctDeseos * 10) / 10,
            pctNecesidades: Math.round(pctNecesidades * 10) / 10,
        },
        capacidad: { disponible: redondear(flujoLibre), recorteSugerido: redondear(recorteSugerido), total: redondear(capacidad), reparto },
        regla503020: regla,
        presupuesto,
        deudas: deudasPlan,
        fondo,
        metas: planMetas,
        inversion,
        proyeccion12,
        recomendaciones,
        entrada: { ingresos, gastos, deudas, metas, ahorroActual },
    };
}
