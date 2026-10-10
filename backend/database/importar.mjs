// Crea las tablas, vistas, triggers y datos de referencia en la base configurada (MYSQL_* del entorno o del .env).
// Es seguro repetirlo: no borra datos existentes.   Uso:  npm run importar-bd
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { connection } from '../src/config/mysql/dbmysql.js';

const archivo = fileURLToPath(new URL('./esquema.sql', import.meta.url));
if (!fs.existsSync(archivo)) {
    console.error('No existe backend/database/esquema.sql. Genéralo primero con: npm run exportar-bd');
    process.exit(1);
}
const sentencias = fs.readFileSync(archivo, 'utf8').split('\n-- ;;\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('-- Esquema'));

console.log(`Importando ${sentencias.length} sentencias en ${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE} …`);
const con = await connection.getConnection();
let fallos = 0;
try {
    await con.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const [i, sql] of sentencias.entries()) {
        try {
            await con.query(sql);
        } catch (error) {
            fallos++;
            console.error(`  ✖ #${i + 1} (${sql.slice(0, 60).replace(/\s+/g, ' ')}…): ${error.message}`);
        }
    }
    await con.query('SET FOREIGN_KEY_CHECKS = 1');
} finally {
    con.release();
}
const [[{ tablas }]] = await connection.query("SELECT COUNT(*) AS tablas FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'");
const [[{ triggers }]] = await connection.query('SELECT COUNT(*) AS triggers FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()');
console.log(fallos ? `Terminó con ${fallos} error(es).` : 'Importación completa sin errores.', `Ahora hay ${tablas} tablas y ${triggers} triggers.`);
process.exit(fallos ? 1 : 0);
