import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Carpeta donde se guardan las fotos y documentos subidos
export const carpetaUploads = fileURLToPath(new URL('../../uploads', import.meta.url));
fs.mkdirSync(carpetaUploads, { recursive: true });

// Si el archivo no está en disco, responde 404
export function servirArchivo(req, res) {
    res.status(404).json({ message: 'Archivo no encontrado' });
}
