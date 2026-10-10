import { connection } from '../config/mysql/dbmysql.js';

// Cambios pequeños a la base de datos que la app necesita. Se ejecutan al iniciar y son seguros de repetir.

const TIPOS_INVERSION = [
    ['Cuenta de ahorros de alto rendimiento', 'Cuenta que paga más intereses que una de ahorros tradicional, con disponibilidad inmediata', 'bajo'],
    ['Fondo de cesantías', 'Ahorro obligatorio del trabajador que puede administrarse en fondos de bajo o mayor riesgo', 'bajo'],
    ['ETF / fondos cotizados', 'Canasta de acciones o bonos que se compra como una sola acción en bolsa', 'medio'],
    ['TES (títulos del Tesoro)', 'Deuda emitida por el gobierno nacional, con tasa fija o atada a la inflación', 'bajo'],
    ['Finca raíz / inmuebles', 'Comprar vivienda, locales o lotes para arrendar o valorizar', 'medio'],
    ['Fondos inmobiliarios (REIT)', 'Participar en inmuebles con poco dinero a través de un fondo', 'medio'],
    ['Divisas (dólar, euro)', 'Guardar o comprar moneda extranjera para protegerte o especular con el tipo de cambio', 'medio'],
    ['Oro y metales preciosos', 'Activo de refugio que suele conservar valor en épocas de crisis', 'medio'],
    ['Criptomonedas', 'Activos digitales muy volátiles y poco regulados', 'alto'],
    ['Préstamos entre personas (P2P)', 'Prestar dinero a personas o negocios a través de plataformas, a cambio de intereses', 'alto'],
    ['Negocio propio / emprendimiento', 'Crear o invertir en un negocio con potencial de crecimiento y riesgo de pérdida total', 'alto'],
    ['Seguros con ahorro / rentas', 'Seguros que combinan protección y ahorro, o que pagan una renta periódica', 'bajo'],
    ['Derivados (futuros y opciones)', 'Contratos apalancados sobre el precio futuro de un activo; solo para expertos', 'alto'],
    ['Educación y capacitación', 'Invertir en tus propias habilidades para aumentar tus ingresos futuros', 'medio'],
    ['Materias primas (commodities)', 'Petróleo, café, granos y otros productos básicos negociados en mercados', 'alto'],
    ['Coleccionables (arte, vehículos clásicos)', 'Bienes escasos cuyo valor depende de la demanda; poca liquidez', 'alto'],
];

export async function migrar() {
    try {
        // Tipos de reporte nuevos (presupuesto, pagos, cuentas, retos, educación, recomendaciones)
        await connection.query(`ALTER TABLE exportaciones MODIFY tipo_reporte
            ENUM('ingresos','gastos','balance','ahorro','inversiones','deudas','completo','presupuesto','pagos','cuentas','retos','educacion','recomendaciones') NOT NULL DEFAULT 'completo'`);

        // Catálogo ampliado de tipos de inversión
        for (const [nombre, descripcion, riesgo] of TIPOS_INVERSION) {
            await connection.query('INSERT IGNORE INTO tipos_inversion (nombre, descripcion, nivel_riesgo) VALUES (?, ?, ?)', [nombre, descripcion, riesgo]);
        }

        // Recompensas que el usuario reclama con sus puntos
        await connection.query(`CREATE TABLE IF NOT EXISTS recompensas_usuario (
            id_usuario INT UNSIGNED NOT NULL,
            nivel VARCHAR(20) NOT NULL,
            reclamada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id_usuario, nivel),
            CONSTRAINT fk_recompensa_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    } catch (error) {
        console.error('Error en las migraciones:', error.message);
    }
}
