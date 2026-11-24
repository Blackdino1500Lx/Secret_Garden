/* ============================================================
   Estética Secret Garden — main.js
   Arranque de la landing. Orquesta UI, catálogo, banners,
   carrito, agendado y checkout.
   ============================================================ */

window.SG = window.SG || {};

(function () {
  'use strict';

  // ---------- Cargar configuracion desde Supabase (con respaldo local) ----------
  async function cargarConfiguracion() {
    SG.configRuntime = Object.assign({}, SG.config.FALLBACK);
    if (!SG.sb) return;

    const res = await SG.sb.from('configuracion').select('*');
    if (res.error) {
      console.warn('[SG.main] No se pudo leer configuracion, uso respaldo local.');
      return;
    }
    (res.data || []).forEach(function (row) {
      SG.configRuntime[row.clave] = row.valor;
    });
  }

  // ---------- Aplicar config a los enlaces de contacto y footer ----------
  function aplicarConfiguracion() {
    const cfg = SG.configRuntime;

    document.querySelectorAll('[data-contact="whatsapp"]').forEach(function (el) {
      el.textContent = '6451-1598';
      el.setAttribute('href', 'https://wa.me/' + cfg.whatsapp);
    });
    document.querySelectorAll('[data-contact="correo"]').forEach(function (el) {
      el.textContent = cfg.correo;
      el.setAttribute('href', 'mailto:' + cfg.correo);
    });
    document.querySelectorAll('[data-contact="instagram"]').forEach(function (el) {
      el.textContent = '@' + cfg.instagram;
      el.setAttribute('href', 'https://instagram.com/' + cfg.instagram);
    });
    document.querySelectorAll('[data-contact="ubicacion"]').forEach(function (el) {
      el.textContent = cfg.ubicacion;
    });
  }

  function avisarSiFaltaConfig() {
    if (!SG.config.estaConfigurado()) {
      SG.ui.toast(
        'Falta configurar Supabase. Editá js/config.js con SUPABASE_URL y SUPABASE_ANON_KEY.',
        'warning'
      );
    } else if (!SG.sb) {
      SG.ui.toast('No se pudo inicializar la conexión con Supabase.', 'error');
    }
  }

  // ---------- Delegación a nivel de documento para las tarjetas ----------
  function initAccionesDelegadas() {
    // +/- cantidad en tarjetas de producto
    document.addEventListener('click', function (e) {
      const qtyBtn = e.target.closest('[data-qty]');
      if (!qtyBtn) return;
      const card = qtyBtn.closest('.card-product');
      if (!card) return; // solo en tarjetas, no en el drawer
      e.preventDefault();
      const control = qtyBtn.closest('[data-qty-control]');
      if (!control) return;
      const span = control.querySelector('[data-qty-value]');
      if (!span) return;
      const actual = parseInt(span.textContent, 10) || 1;
      const delta = parseInt(qtyBtn.dataset.qty, 10) || 0;
      span.textContent = String(Math.max(1, Math.min(10, actual + delta)));
    });

    // Agendar
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action="agendar"]');
      if (!btn) return;
      e.preventDefault();
      if (SG.booking && typeof SG.booking.abrir === 'function') {
        SG.booking.abrir(btn.dataset.id);
      }
    });

    // Agregar producto al carrito
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action="add-product"]');
      if (!btn) return;
      e.preventDefault();
      const card = btn.closest('.card-product');
      const cantEl = card && card.querySelector('[data-qty-value]');
      const cantidad = cantEl ? parseInt(cantEl.textContent, 10) || 1 : 1;
      if (SG.cart && typeof SG.cart.agregarProducto === 'function') {
        SG.cart.agregarProducto(btn.dataset.id, cantidad);
      }
    });
  }

  // ---------- Arranque ----------
  async function init() {
    // 1) UI inmediata
    SG.ui.initHamburger();
    SG.ui.initSmoothScroll();
    SG.ui.initScrollSpy();
    SG.ui.initAnio();

    // 2) Módulos que trabajan sobre el DOM
    SG.cart.init();
    SG.booking.init();
    SG.checkout.init();
    initAccionesDelegadas();

    // 3) Aviso de configuración
    avisarSiFaltaConfig();

    // 4) Configuración del negocio
    await cargarConfiguracion();
    aplicarConfiguracion();

    // 5) Catálogo + banners
    await Promise.all([SG.catalog.cargar(), SG.banners.init()]);

    // 6) Revalidar carrito contra el catálogo cargado
    if (SG.cart.contarItems() > 0 && SG.catalog && SG.catalog.estado) {
      const totalCat = (SG.catalog.estado.servicios || []).length +
                       (SG.catalog.estado.productos || []).length;
      if (totalCat > 0) SG.cart.revalidar();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();