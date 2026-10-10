// Genera backend/database/esquema.sql con la estructura de la base (tablas, vistas, triggers) y los datos de referencia
// (roles, monedas, categorías, logros, retos, tipos de inversión, lecciones). NO incluye usuarios ni datos personales.
// Uso (con la base local encendida):  npm run exportar-bd
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { connection } from '../src/config/mysql/dbmysql.js';

const SEPARADOR = '\n-- ;;\n';
const salida = fileURLToPath(new URL('./esquema.sql', import.meta.url));
const sentencias = [];

// Quita lo que solo existe en tu equipo (usuario root@localhost) para que se pueda crear en cualquier servidor
const limpiar = (sql) => sql
    .replace(/DEFINER\s*=\s*`[^`]*`@`[^`]*`\s*/gi, '')
    .replace(/ALGORITHM\s*=\s*\w+\s*/gi, '')
    .replace(/SQL SECURITY DEFINER/gi, 'SQL SECURITY INVOKER');

const [objetos] = await connection.query('SELECT TABLE_NAME AS nombre, TABLE_TYPE AS tipo FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME');
const tablas = objetos.filter((o) => o.tipo === 'BASE TABLE').map((o) => o.nombre);
const vistas = objetos.filter((o) => o.tipo === 'VIEW').map((o) => o.nombre);

for (const t of tablas) {
    const [[fila]] = await connection.query(`SHOW CREATE TABLE \`${t}\``);
    // Sin el contador AUTO_INCREMENT de tu base local: en el servidor nuevo los ids empiezan en 1
    sentencias.push(fila['Create Table'].replace(/^CREATE TABLE/, 'CREATE TABLE IF NOT EXISTS').replace(/\sAUTO_INCREMENT=\d+/, ''));
}
for (const v of vistas) {
    const [[fila]] = await connection.query(`SHOW CREATE VIEW \`${v}\``);
    sentencias.push(limpiar(fila['Create View']).replace(/^CREATE\s+/, 'CREATE OR REPLACE '));
}
const [triggers] = await connection.query('SHOW TRIGGERS');
for (const tr of triggers) {
    const [[fila]] = await connection.query(`SHOW CREATE TRIGGER \`${tr.Trigger}\``);
    sentencias.push(`DROP TRIGGER IF EXISTS \`${tr.Trigger}\``);
    sentencias.push(limpiar(fila['SQL Original Statement']));
}

// Datos de referencia (los mismos para todos los usuarios)
const referencia = [
    ['roles', 'SELECT * FROM roles'],
    ['monedas', 'SELECT * FROM monedas'],
    ['categorias', 'SELECT * FROM categorias WHERE id_usuario IS NULL'],
    ['logros', 'SELECT * FROM logros'],
    ['retos_financieros', 'SELECT * FROM retos_financieros'],
    ['tipos_inversion', 'SELECT * FROM tipos_inversion'],
    ['contenido_educativo', 'SELECT * FROM contenido_educativo'],
];
for (const [tabla, consulta] of referencia) {
    if (!tablas.includes(tabla)) continue;
    const [filas] = await connection.query(consulta);
    for (const f of filas) {
        const columnas = Object.keys(f);
        sentencias.push(connection.format(`INSERT IGNORE INTO \`${tabla}\` (${columnas.map(() => '??').join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`, [...columnas, ...columnas.map((c) => (f[c] instanceof Date ? f[c] : f[c]))]));
    }
}

const cabecera = '-- Esquema de Ahorra y Prospera (generado con npm run exportar-bd). Las sentencias se separan con "-- ;;".\n-- Se importa con: npm run importar-bd';
fs.writeFileSync(salida, `${cabecera}${SEPARADOR}${sentencias.join(SEPARADOR)}\n`, 'utf8');
console.log(`Listo: ${tablas.length} tablas, ${vistas.length} vistas, ${triggers.length} triggers y datos de referencia → ${salida}`);
process.exit(0);
