/* ============================================================
   Estética Secret Garden — admin-storage.js
   Compresión y subida de imágenes a Supabase Storage.
   ============================================================ */

window.SG = window.SG || {};
SG.admin = SG.admin || {};

SG.admin.storage = (function () {
  'use strict';

  const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_BYTES_ORIGINAL = 15 * 1024 * 1024; // 15 MB
  const MAX_BYTES_FINAL    = 5 * 1024 * 1024;  // 5 MB (límite del bucket)

  // ------------------------------------------------------------
  // Comprimir con canvas y convertir a WebP.
  // Devuelve un Blob listo para subir.
  // ------------------------------------------------------------
  function comprimir(file, maxLado, calidad) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('Archivo vacío.'));
      if (TIPOS_PERMITIDOS.indexOf(file.type) === -1) {
        return reject(new Error('Solo se permiten imágenes JPG, PNG o WebP.'));
      }
      if (file.size > MAX_BYTES_ORIGINAL) {
        return reject(new Error('La imagen original pesa más de 15 MB.'));
      }

      const max = maxLado || 1200;
      const q = typeof calidad === 'number' ? calidad : 0.82;

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = function () {
        URL.revokeObjectURL(objectUrl);

        let { width, height } = img;
        const ladoMayor = Math.max(width, height);
        if (ladoMayor > max) {
          const factor = max / ladoMayor;
          width = Math.round(width * factor);
          height = Math.round(height * factor);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(function (blob) {
          if (!blob) return reject(new Error('No se pudo comprimir la imagen.'));
          if (blob.size > MAX_BYTES_FINAL) {
            return reject(new Error('La imagen comprimida sigue pesando más de 5 MB. Reducí la resolución.'));
          }
          resolve(blob);
        }, 'image/webp', q);
      };

      img.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('No se pudo leer la imagen.'));
      };

      img.src = objectUrl;
    });
  }

  // ------------------------------------------------------------
  // Generar nombre único para el archivo
  // ------------------------------------------------------------
  function generarNombre() {
    const uuid = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : (Date.now().toString(36) + Math.random().toString(36).slice(2));
    return uuid + '.webp';
  }

  // ------------------------------------------------------------
  // Subir al bucket.
  // carpeta: 'servicios' | 'productos' | 'banners'
  // entidadId: uuid del servicio/producto/banner (carpeta)
  // Devuelve { path, url }
  // ------------------------------------------------------------
  async function subir(file, carpeta, entidadId, opts) {
    if (!SG.sb) throw new Error('Supabase no está configurado.');
    if (!file) throw new Error('No hay archivo para subir.');
    if (!carpeta || !entidadId) throw new Error('Faltan carpeta o entidadId.');

    const maxLado = (opts && opts.maxLado) || 1200;
    const calidad = (opts && opts.calidad) || 0.82;

    const blob = await comprimir(file, maxLado, calidad);
    const nombre = generarNombre();
    const path = carpeta + '/' + entidadId + '/' + nombre;

    const up = await SG.sb.storage
      .from(SG.config.BUCKET)
      .upload(path, blob, { contentType: 'image/webp', upsert: false });

    if (up.error) {
      console.error('[SG.storage] Error al subir:', up.error);
      throw new Error('No se pudo subir la imagen: ' + (up.error.message || ''));
    }

    return { path: path, url: urlPublica(path) };
  }

  // ------------------------------------------------------------
  // Borrar archivo del bucket
  // ------------------------------------------------------------
  async function borrar(path) {
    if (!SG.sb || !path) return;
    const res = await SG.sb.storage.from(SG.config.BUCKET).remove([path]);
    if (res.error) {
      console.warn('[SG.storage] No se pudo borrar ' + path + ':', res.error);
    }
  }

  // ------------------------------------------------------------
  // URL pública a partir del path
  // ------------------------------------------------------------
  function urlPublica(path) {
    if (!path) return 'img/placeholders/placeholder.svg';
    return SG.config.SUPABASE_URL +
      '/storage/v1/object/public/' + SG.config.BUCKET + '/' +
      encodeURI(path);
  }

  return {
    comprimir: comprimir,
    subir: subir,
    borrar: borrar,
    urlPublica: urlPublica
  };
})();