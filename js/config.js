/* ============================================================
   Estética Secret Garden — config.js
   Credenciales públicas de Supabase y valores de respaldo.
   ⚠️ Reemplaza SUPABASE_URL y SUPABASE_ANON_KEY con los de
   TU proyecto de Secret Garden. Nunca pongas la service_role.
   ============================================================ */

window.SG = window.SG || {};

SG.config = {
  // ⚠️ REEMPLAZAR — estos son valores de referencia
  SUPABASE_URL:      'https://db.edevcr.com',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg5MjM4MzczLCJleHAiOjE5NDY5MTgzNzN9.eOhfkhTwKTlGgk72VM1RzFc44e8wMMdRVGjtbw0_eA8',

  SCHEMA: 'secret_garden',
  BUCKET: 'secret-garden-media',

  // Respaldo de configuracion si la consulta falla
  FALLBACK: {
    whatsapp:     '50664511598',
    sinpe_numero: '6451-1598',
    correo:       'esteticasecretgarden@gmail.com',
    instagram:    'est.secretgarden',
    ubicacion:    'Alajuelita, San José',
    frase:        'Un espacio para florecer'
  }
};

// Aviso si el usuario olvidó cambiar los valores por defecto
SG.config.estaConfigurado = function () {
  const url = SG.config.SUPABASE_URL || '';
  const key = SG.config.SUPABASE_ANON_KEY || '';
  return url.startsWith('http') && key.length > 40;
};