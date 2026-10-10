// Validaciones pequeñas compartidas por las rutas
export const hoy = () => new Date().toISOString().slice(0, 10);

export const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(Date.parse(v));

export const numero = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
};

export const texto = (v, max = 255) => {
    const t = String(v ?? '').trim();
    return t ? t.slice(0, max) : null;
};

// Responde con un error 400 y devuelve true si la condición falla
export function rechazar(res, condicion, mensaje) {
    if (condicion) {
        res.status(400).json({ message: mensaje });
        return true;
    }
    return false;
}

export function errorServidor(res, contexto, error, mensaje = 'Error del servidor') {
    console.error(`${contexto}:`, error.message);
    res.status(500).json({ message: mensaje });
}
