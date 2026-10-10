import ExcelJS from 'exceljs';

const VERDE_OSCURO = 'FF0B3D2E';
const VERDE = 'FF15803D';
const VERDE_CLARO = 'FFDCFCE7';
const GRIS = 'FFF3F7F4';
const FORMATO_DINERO = '"$"#,##0;[Red]-"$"#,##0';

function titulo(hoja, texto, columnas) {
    hoja.mergeCells(1, 1, 1, columnas);
    const c = hoja.getCell(1, 1);
    c.value = texto;
    c.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_OSCURO } };
    c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    hoja.getRow(1).height = 30;
}

function encabezado(fila) {
    fila.eachCell((c) => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        c.border = { bottom: { style: 'thin', color: { argb: VERDE_OSCURO } } };
    });
    fila.height = 22;
}

function bordes(hoja, desde, hasta, columnas) {
    for (let r = desde; r <= hasta; r++) {
        for (let c = 1; c <= columnas; c++) {
            hoja.getCell(r, c).border = {
                top: { style: 'hair', color: { argb: 'FFB5C9BD' } },
                bottom: { style: 'hair', color: { argb: 'FFB5C9BD' } },
            };
        }
    }
}

function totales(fila, desdeCol) {
    fila.eachCell((c, n) => {
        if (n < desdeCol) return;
        c.font = { bold: true };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_CLARO } };
    });
}

export async function construirExcel(plan, usuario) {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'Ahorra y Prospera';
    libro.created = new Date();
    const d = plan.diagnostico;

    // ---------------- Resumen ----------------
    const resumen = libro.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
    resumen.columns = [{ width: 38 }, { width: 22 }, { width: 50 }];
    titulo(resumen, `Plan financiero personal — ${usuario.nombres} ${usuario.apellidos}`, 3);
    resumen.getCell('A2').value = `Generado el ${new Date().toLocaleDateString('es-CO')} · Moneda: ${plan.moneda} · Perfil: ${plan.perfil.riesgo} · Objetivo: ${plan.objetivo?.etiqueta || 'Plan general'}`;
    resumen.getCell('A2').font = { italic: true, color: { argb: 'FF4B6358' } };

    resumen.addRow([]);
    encabezado(resumen.addRow(['Indicador', 'Valor', 'Cómo leerlo']));
    const filas = [
        ['Puntaje de salud financiera (0-100)', d.puntaje, `${d.nivel}`, '0'],
        ['Ingresos mensuales', d.ingresoTotal, 'Suma de todas tus fuentes', FORMATO_DINERO],
        ['Gastos mensuales (sin deudas)', d.gastosTotal, 'Necesidades + deseos', FORMATO_DINERO],
        ['Cuotas mensuales de deudas', d.cuotasDeuda, 'Pagos mínimos actuales', FORMATO_DINERO],
        ['Flujo libre mensual', { formula: 'B6-B7-B8', result: d.flujoLibre }, 'Ingresos − gastos − cuotas', FORMATO_DINERO],
        ['Tasa de ahorro', { formula: 'IF(B6=0,0,B9/B6)', result: d.tasaAhorro / 100 }, 'Meta saludable: 20% o más', '0.0%'],
        ['Relación deuda / ingreso', { formula: 'IF(B6=0,0,B8/B6)', result: d.relacionDeuda / 100 }, 'Sano: menos de 30-35%', '0.0%'],
        ['Total de deudas (saldo)', d.saldoDeudas, 'Capital pendiente', FORMATO_DINERO],
        ['Fondo de emergencia actual', plan.fondo.actual, `Meta: ${plan.fondo.mesesMeta} meses de gastos esenciales`, FORMATO_DINERO],
        ['Meses cubiertos por el fondo', plan.fondo.mesesCubiertos, 'Ideal: 3 a 6 meses', '0.0'],
    ];
    filas.forEach(([a, b, c, f]) => {
        const fila = resumen.addRow([a, b, c]);
        fila.getCell(2).numFmt = f;
        fila.getCell(2).font = { bold: true };
        fila.getCell(3).font = { color: { argb: 'FF4B6358' } };
    });
    bordes(resumen, 4, resumen.rowCount, 3);

    resumen.addRow([]);
    encabezado(resumen.addRow(['Reparto mensual sugerido', 'Monto', 'Para qué']));
    const cap = plan.capacidad;
    const reparto = [
        ['Pago extra de deudas', cap.reparto.deuda, 'Reduce intereses y libera tu flujo'],
        ['Fondo de emergencia', cap.reparto.fondo, 'Protección ante imprevistos'],
        ['Metas de ahorro', cap.reparto.metas, 'Viajes, estudio, vivienda, etc.'],
        ['Inversión', cap.reparto.inversion, 'Crecimiento de largo plazo'],
    ];
    const iniReparto = resumen.rowCount + 1;
    reparto.forEach(([a, b, c]) => {
        const f = resumen.addRow([a, b, c]);
        f.getCell(2).numFmt = FORMATO_DINERO;
    });
    const finReparto = resumen.rowCount;
    const tot = resumen.addRow(['Total asignado', { formula: `SUM(B${iniReparto}:B${finReparto})`, result: cap.total }, 'Tu capacidad mensual de ahorro']);
    tot.getCell(2).numFmt = FORMATO_DINERO;
    totales(tot, 1);
    bordes(resumen, iniReparto, finReparto + 1, 3);

    resumen.addRow([]);
    encabezado(resumen.addRow(['Recomendaciones del asesor', 'Prioridad', 'Detalle']));
    plan.recomendaciones.forEach((r) => {
        const f = resumen.addRow([r.titulo, r.prioridad.toUpperCase(), r.mensaje]);
        f.getCell(3).alignment = { wrapText: true, vertical: 'top' };
        f.getCell(1).alignment = { wrapText: true, vertical: 'top' };
        f.getCell(2).alignment = { horizontal: 'center', vertical: 'top' };
        f.height = Math.max(32, Math.ceil(r.mensaje.length / 55) * 15);
    });

    // ---------------- Presupuesto ----------------
    const pres = libro.addWorksheet('Presupuesto', { views: [{ showGridLines: false, state: 'frozen', ySplit: 3 }] });
    pres.columns = [{ width: 30 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 14 }];
    titulo(pres, 'Presupuesto mensual: actual vs. recomendado', 6);
    pres.addRow([]);
    encabezado(pres.addRow(['Categoría', 'Tipo', 'Gasto actual', 'Recomendado', 'Diferencia', '% del ingreso']));
    const iniP = pres.rowCount + 1;
    plan.presupuesto.forEach((p, i) => {
        const r = iniP + i;
        const f = pres.addRow([p.categoria, p.tipo === 'deseo' ? 'Deseo' : 'Necesidad', p.actual, p.recomendado,
            { formula: `D${r}-C${r}`, result: p.recomendado - p.actual },
            { formula: `IF(Resumen!$B$6=0,0,D${r}/Resumen!$B$6)`, result: d.ingresoTotal ? p.recomendado / d.ingresoTotal : 0 }]);
        f.getCell(3).numFmt = FORMATO_DINERO;
        f.getCell(4).numFmt = FORMATO_DINERO;
        f.getCell(5).numFmt = FORMATO_DINERO;
        f.getCell(6).numFmt = '0.0%';
    });
    const finP = pres.rowCount;
    if (plan.presupuesto.length) {
        const t = pres.addRow(['TOTAL', '', { formula: `SUM(C${iniP}:C${finP})` }, { formula: `SUM(D${iniP}:D${finP})` }, { formula: `SUM(E${iniP}:E${finP})` }, '']);
        [3, 4, 5].forEach((n) => { t.getCell(n).numFmt = FORMATO_DINERO; });
        totales(t, 1);
    }
    bordes(pres, iniP, pres.rowCount, 6);

    pres.addRow([]);
    encabezado(pres.addRow(['Regla 50 / 30 / 20', 'Ideal', 'Actual', 'Diferencia', '% actual', '']));
    const iniR = pres.rowCount + 1;
    [['Necesidades + cuotas (50%)', plan.regla503020.necesidades], ['Deseos (30%)', plan.regla503020.deseos], ['Ahorro (20%)', plan.regla503020.ahorro]]
        .forEach(([nombre, v], i) => {
            const r = iniR + i;
            const f = pres.addRow([nombre, v.ideal, v.actual, { formula: `C${r}-B${r}` }, { formula: `IF(Resumen!$B$6=0,0,C${r}/Resumen!$B$6)` }, '']);
            [2, 3, 4].forEach((n) => { f.getCell(n).numFmt = FORMATO_DINERO; });
            f.getCell(5).numFmt = '0.0%';
        });
    bordes(pres, iniR, pres.rowCount, 5);

    // ---------------- Deudas ----------------
    const deu = libro.addWorksheet('Deudas', { views: [{ showGridLines: false }] });
    deu.columns = [{ width: 28 }, { width: 18 }, { width: 14 }, { width: 18 }, { width: 22 }];
    titulo(deu, 'Plan de pago de deudas (método avalancha)', 5);
    deu.addRow([]);
    encabezado(deu.addRow(['Acreedor', 'Saldo', 'Tasa E.A.', 'Cuota mensual', 'Mes en que se paga']));
    const iniD = deu.rowCount + 1;
    plan.entrada.deudas.forEach((x) => {
        const orden = plan.deudas.conPlan.orden.find((o) => o.nombre === x.acreedor);
        const f = deu.addRow([x.acreedor, x.saldo, x.tasa / 100, x.cuota, orden?.mesPagada ?? '—']);
        f.getCell(2).numFmt = FORMATO_DINERO;
        f.getCell(3).numFmt = '0.0%';
        f.getCell(4).numFmt = FORMATO_DINERO;
    });
    if (plan.entrada.deudas.length) {
        const t = deu.addRow(['TOTAL', { formula: `SUM(B${iniD}:B${deu.rowCount})` }, '', { formula: `SUM(D${iniD}:D${deu.rowCount})` }, '']);
        t.getCell(2).numFmt = FORMATO_DINERO;
        t.getCell(4).numFmt = FORMATO_DINERO;
        totales(t, 1);
        bordes(deu, iniD, deu.rowCount, 5);
        deu.addRow([]);
        const dp = plan.deudas;
        [
            ['Pago extra mensual sugerido', dp.extraMensual, FORMATO_DINERO],
            ['Meses para liberarte (con plan)', dp.conPlan.meses, '0'],
            ['Meses pagando solo mínimos', dp.soloMinimos.meses, '0'],
            ['Intereses totales con plan', dp.conPlan.interesTotal, FORMATO_DINERO],
            ['Intereses pagando solo mínimos', dp.soloMinimos.interesTotal, FORMATO_DINERO],
            ['Intereses que te ahorras', dp.ahorroIntereses, FORMATO_DINERO],
        ].forEach(([a, b, f]) => {
            const fila = deu.addRow([a, b]);
            fila.getCell(2).numFmt = f;
            fila.getCell(2).font = { bold: true };
        });
        deu.addRow([]);
        encabezado(deu.addRow(['Mes', 'Pago total', 'Intereses del mes', 'Saldo restante', '']));
        const iniC = deu.rowCount + 1;
        dp.conPlan.cronograma.slice(0, 120).forEach((c) => {
            const f = deu.addRow([c.mes, c.pago, c.interes, c.saldo]);
            [2, 3, 4].forEach((n) => { f.getCell(n).numFmt = FORMATO_DINERO; });
        });
        bordes(deu, iniC, deu.rowCount, 4);
    } else {
        deu.addRow(['No registraste deudas. ¡Excelente!']);
    }

    // ---------------- Fondo y metas ----------------
    const met = libro.addWorksheet('Fondo y metas', { views: [{ showGridLines: false }] });
    met.columns = [{ width: 32 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 18 }];
    titulo(met, 'Fondo de emergencia y metas de ahorro', 8);
    met.addRow([]);
    encabezado(met.addRow(['Fondo de emergencia', 'Valor', '', '', '', '', '', '']));
    const fo = plan.fondo;
    [['Meta (meses de gastos esenciales)', fo.mesesMeta, '0'], ['Meta en dinero', fo.meta, FORMATO_DINERO], ['Ahorro actual', fo.actual, FORMATO_DINERO],
        ['Falta por reunir', { formula: `MAX(0,B${met.rowCount + 2}-B${met.rowCount + 3})`, result: fo.falta }, FORMATO_DINERO],
        ['Aporte mensual sugerido', fo.aporteMensual, FORMATO_DINERO],
        ['Meses para completarlo', fo.mesesParaCompletar ?? '—', '0']].forEach(([a, b, f]) => {
        const fila = met.addRow([a, b]);
        fila.getCell(2).numFmt = f;
    });
    met.addRow([]);
    encabezado(met.addRow(['Meta', 'Objetivo', 'Ahorrado', 'Falta', 'Plazo (meses)', 'Cuota requerida', 'Cuota asignada', 'Estado']));
    const iniM = met.rowCount + 1;
    plan.metas.forEach((m, i) => {
        const r = iniM + i;
        const f = met.addRow([m.nombre, m.objetivo, m.actual, { formula: `MAX(0,B${r}-C${r})`, result: m.faltan }, m.plazoMeses,
            { formula: `IF(E${r}=0,0,D${r}/E${r})`, result: m.cuotaRequerida }, m.cuotaAsignada, m.estado]);
        [2, 3, 4, 6, 7].forEach((n) => { f.getCell(n).numFmt = FORMATO_DINERO; });
    });
    if (plan.metas.length) bordes(met, iniM, met.rowCount, 8);

    // ---------------- Inversión ----------------
    const inv = libro.addWorksheet('Inversión', { views: [{ showGridLines: false }] });
    inv.columns = [{ width: 40 }, { width: 12 }, { width: 14 }, { width: 18 }, { width: 18 }];
    titulo(inv, `Portafolio sugerido — perfil ${plan.inversion.perfil}`, 5);
    inv.addRow([]);
    inv.addRow(['Aporte mensual a inversión', plan.inversion.aporteMensual]).getCell(2).numFmt = FORMATO_DINERO;
    inv.addRow(['Horizonte (años)', plan.inversion.horizonte]);
    inv.addRow([]);
    encabezado(inv.addRow(['Producto', 'Riesgo', '% del aporte', 'Aporte mensual', 'Rendimiento E.A. (supuesto)']));
    const iniI = inv.rowCount + 1;
    plan.inversion.distribucion.forEach((p, i) => {
        const r = iniI + i;
        const f = inv.addRow([p.producto, p.riesgo, p.porcentaje / 100, { formula: `$B$3*C${r}`, result: p.aporte }, p.rendimiento / 100]);
        f.getCell(3).numFmt = '0%';
        f.getCell(4).numFmt = FORMATO_DINERO;
        f.getCell(5).numFmt = '0.0%';
        f.getCell(5).font = { color: { argb: 'FF1D4ED8' } }; // supuesto editable
    });
    const finI = inv.rowCount;
    const ti = inv.addRow(['TOTAL / rendimiento ponderado', '', { formula: `SUM(C${iniI}:C${finI})` }, { formula: `SUM(D${iniI}:D${finI})` },
        { formula: `SUMPRODUCT(C${iniI}:C${finI},E${iniI}:E${finI})`, result: plan.inversion.rendimientoEsperado / 100 }]);
    ti.getCell(3).numFmt = '0%';
    ti.getCell(4).numFmt = FORMATO_DINERO;
    ti.getCell(5).numFmt = '0.00%';
    totales(ti, 1);
    bordes(inv, iniI, inv.rowCount, 5);
    const filaRend = inv.rowCount;

    inv.addRow([]);
    encabezado(inv.addRow(['Proyección del aporte', 'Años', 'Aportado', 'Valor proyectado', 'Si lo guardas sin invertir']));
    const iniPr = inv.rowCount + 1;
    plan.inversion.proyeccion.forEach((p, i) => {
        const r = iniPr + i;
        const f = inv.addRow(['', p.anios,
            { formula: `$B$3*B${r}*12`, result: p.aportado },
            { formula: `IF($E$${filaRend}=0,C${r},$B$3*((1+$E$${filaRend})^(B${r})-1)/((1+$E$${filaRend})^(1/12)-1))`, result: p.valor },
            { formula: `C${r}`, result: p.enColchon }]);
        [3, 4, 5].forEach((n) => { f.getCell(n).numFmt = FORMATO_DINERO; });
    });
    bordes(inv, iniPr, inv.rowCount, 5);
    inv.addRow([]);
    const nota = inv.addRow(['Los rendimientos son supuestos de referencia (azul): puedes cambiarlos y las fórmulas se recalculan. No son una promesa de rentabilidad.']);
    nota.getCell(1).font = { italic: true, color: { argb: 'FF4B6358' } };

    // ---------------- Proyección 12 meses ----------------
    const pro = libro.addWorksheet('Proyección 12 meses', { views: [{ showGridLines: false, state: 'frozen', ySplit: 3 }] });
    pro.columns = [{ width: 10 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 22 }];
    titulo(pro, 'Cómo evolucionará tu dinero en los próximos 12 meses', 6);
    pro.addRow([]);
    encabezado(pro.addRow(['Mes', 'Fondo emergencia', 'Metas', 'Inversión', 'Deuda pendiente', 'Patrimonio estimado']));
    const iniQ = pro.rowCount + 1;
    plan.proyeccion12.forEach((p, i) => {
        const r = iniQ + i;
        const f = pro.addRow([p.mes, p.fondo, p.metas, p.inversion, p.deuda, { formula: `B${r}+C${r}+D${r}-E${r}`, result: p.patrimonio }]);
        [2, 3, 4, 5, 6].forEach((n) => { f.getCell(n).numFmt = FORMATO_DINERO; });
    });
    bordes(pro, iniQ, pro.rowCount, 6);

    // ---------------- Datos ----------------
    const datos = libro.addWorksheet('Tus datos', { views: [{ showGridLines: false }] });
    datos.columns = [{ width: 34 }, { width: 18 }, { width: 18 }];
    titulo(datos, 'Datos con los que se calculó tu plan', 3);
    datos.addRow([]);
    encabezado(datos.addRow(['Ingresos', 'Monto mensual', '']));
    plan.entrada.ingresos.forEach((x) => { datos.addRow([x.fuente, x.monto]).getCell(2).numFmt = FORMATO_DINERO; });
    datos.addRow([]);
    encabezado(datos.addRow(['Gastos', 'Monto mensual', 'Tipo']));
    plan.entrada.gastos.forEach((x) => {
        const f = datos.addRow([x.categoria, x.monto, x.tipo === 'deseo' ? 'Deseo' : 'Necesidad']);
        f.getCell(2).numFmt = FORMATO_DINERO;
    });
    datos.addRow([]);
    datos.addRow(['Edad', plan.perfil.edad]);
    datos.addRow(['Dependientes', plan.perfil.dependientes]);
    datos.addRow(['Horizonte de inversión (años)', plan.perfil.horizonte]);
    datos.addRow([]);
    const aviso = datos.addRow(['Este documento es educativo y no constituye asesoría financiera, legal ni tributaria regulada.']);
    aviso.getCell(1).font = { italic: true, color: { argb: 'FF4B6358' } };

    libro.eachSheet((h) => {
        h.eachRow((row) => row.eachCell((c) => {
            if (!c.font?.name) c.font = { ...(c.font || {}), name: 'Calibri' };
        }));
        h.properties.tabColor = { argb: VERDE };
    });
    return libro.xlsx.writeBuffer();
}
