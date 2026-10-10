import { connection } from '../config/mysql/dbmysql.js';
import { bonoIA } from './logros.js';

// Control del límite diario de consultas con IA por usuario (compartido por el chat y la educación)
await connection.query(`CREATE TABLE IF NOT EXISTS consultas_ia (
    id_consulta INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT UNSIGNED NOT NULL,
    proveedor VARCHAR(20) NULL,
    creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_consultas_usuario (id_usuario, creada_en),
    CONSTRAINT fk_consultas_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

export async function limiteDiario(idUsuario) {
    return Math.max(1, Number(process.env.IA_LIMITE_DIARIO) || 20) + (await bonoIA(idUsuario));
}

export async function usadasHoy(idUsuario) {
    const [[f]] = await connection.query('SELECT COUNT(*) AS n FROM consultas_ia WHERE id_usuario = ? AND DATE(creada_en) = CURDATE()', [idUsuario]);
    return f.n;
}

export async function registrarConsulta(idUsuario, proveedor) {
    await connection.query('INSERT INTO consultas_ia (id_usuario, proveedor) VALUES (?, ?)', [idUsuario, proveedor]);
}

// { puede, limite, usadas, restantes }
export async function cuota(idUsuario) {
    const [limite, usadas] = await Promise.all([limiteDiario(idUsuario), usadasHoy(idUsuario)]);
    return { puede: usadas < limite, limite, usadas, restantes: Math.max(0, limite - usadas) };
}
