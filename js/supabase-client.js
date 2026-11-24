/* ============================================================
   Estética Secret Garden — supabase-client.js
   Crea el cliente y lo expone como SG.sb (o null si falla).
   ============================================================ */

window.SG = window.SG || {};

(function () {
  'use strict';

  SG.sb = null;

  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.error('[SG] No se cargó supabase-js. Revisa el <script> CDN.');
    return;
  }

  if (!SG.config.estaConfigurado()) {
    console.warn(
      '[SG] Falta configurar SUPABASE_URL y/o SUPABASE_ANON_KEY en js/config.js. ' +
      'La landing se mostrará pero el catálogo no cargará.'
    );
    return;
  }

  try {
    SG.sb = supabase.createClient(
      SG.config.SUPABASE_URL,
      SG.config.SUPABASE_ANON_KEY,
      { db: { schema: SG.config.SCHEMA } }
    );
  } catch (err) {
    console.error('[SG] No se pudo crear el cliente de Supabase:', err);
    SG.sb = null;
  }
})();