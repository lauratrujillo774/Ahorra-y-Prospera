import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { connection } from '../config/mysql/dbmysql.js';

const archivo = fileURLToPath(new URL('../../database/esquema.sql', import.meta.url));

// Ejecuta backend/database/esquema.sql (tablas, vistas, triggers y catálogos). Seguro de repetir: no borra datos.
export async function importarEsquema({ avisar = console.log } = {}) {
    if (!fs.existsSync(archivo)) throw new Error('No existe backend/database/esquema.sql (genéralo con npm run exportar-bd)');
    const sentencias = fs.readFileSync(archivo, 'utf8').split('\n-- ;;\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('-- Esquema'));
    avisar(`Importando ${sentencias.length} sentencias en ${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE} …`);
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
    return { total: sentencias.length, fallos };
}

// Al iniciar: si la base está vacía (no existe la tabla usuarios) crea todo el esquema automáticamente.
// Así, en un servidor nuevo no hace falta ejecutar nada a mano.
export async function asegurarEsquema() {
    const [r] = await connection.query("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' LIMIT 1");
    if (r.length) return false;
    console.log('La base de datos está vacía: creando las tablas automáticamente…');
    const { fallos, total } = await importarEsquema();
    if (fallos) throw new Error(`No se pudo crear todo el esquema (${fallos} de ${total} sentencias fallaron; revisa los mensajes ✖ de arriba)`);
    console.log('Tablas creadas correctamente.');
    return true;
}
