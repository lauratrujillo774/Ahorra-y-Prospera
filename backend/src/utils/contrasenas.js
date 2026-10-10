import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// Formato guardado en contrasena_hash: scrypt$<salt hex>$<hash hex>
export async function encriptar(contrasena) {
    const salt = randomBytes(16);
    const hash = await scryptAsync(contrasena, salt, 64);
    return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verificar(contrasena, guardada) {
    const [tipo, salt, hash] = String(guardada).split('$');
    if (tipo !== 'scrypt' || !salt || !hash) return false;
    const esperado = Buffer.from(hash, 'hex');
    const obtenido = await scryptAsync(contrasena, Buffer.from(salt, 'hex'), esperado.length);
    return timingSafeEqual(esperado, obtenido);
}
