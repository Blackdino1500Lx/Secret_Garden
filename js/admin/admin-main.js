/* ============================================================
   Estética Secret Garden — admin-main.js
   Coordinación de pestañas y arranque del panel.
   ============================================================ */

window.SG = window.SG || {};
SG.admin = SG.admin || {};

SG.admin.main = (function () {
  'use strict';

  const TAB_DEFAULT = 'citas';
  const MODULOS = ['citas', 'pedidos', 'servicios', 'productos', 'categorias', 'banners', 'horarios'];

  let tabActiva = TAB_DEFAULT;
  let yaIniciado = false;

  // ------------------------------------------------------------
  // Init de la navegación de pestañas
  // ------------------------------------------------------------
  function initTabs() {
    const nav = document.getElementById('admin-tabs');
    if (!nav) return;

    nav.addEventListener('click', function (e) {
      const btn = e.target.closest('.admin-tab');
      if (!btn) return;
      const tab = btn.dataset.tab;
      if (!tab) return;
      activarTab(tab);
    });
  }

  // ------------------------------------------------------------
  // Activar una pestaña
  // ------------------------------------------------------------
  function activarTab(tab) {
    if (MODULOS.indexOf(tab) === -1) return;
    tabActiva = tab;

    // Botones
    document.querySelectorAll('.admin-tab').forEach(function (b) {
      const activo = b.dataset.tab === tab;
      b.classList.toggle('active', activo);
      b.setAttribute('aria-selected', String(activo));
    });

    // Paneles
    document.querySelectorAll('.admin-panel').forEach(function (p) {
      p.classList.toggle('active', p.dataset.panel === tab);
    });

    // Avisar al módulo correspondiente
    llamarInitModulo(tab);
  }

  // ------------------------------------------------------------
  // Llamar al init del módulo si existe
  // ------------------------------------------------------------
  function llamarInitModulo(tab) {
    const mapa = {
      citas:      SG.admin.citas,
      pedidos:    SG.admin.pedidos,
      servicios:  SG.admin.servicios,
      productos:  SG.admin.productos,
      categorias: SG.admin.categorias,
      banners:    SG.admin.banners,
      horarios:   SG.admin.horarios
    };

    const modulo = mapa[tab];
    if (modulo && typeof modulo.init === 'function') {
      try {
        modulo.init();
      } catch (err) {
        console.error('[SG.admin.main] Error en módulo "' + tab + '":', err);
        SG.ui.toast('Error al cargar la sección ' + tab + '.', 'error');
      }
    } else {
      // Módulo aún no disponible (Fase 4B)
      const panel = document.getElementById('panel-' + tab);
      if (panel) {
        const placeholder = panel.querySelector('.panel-placeholder');
        if (placeholder) {
          placeholder.textContent = 'Módulo de ' + tab + ' en construcción.';
        }
      }
    }
  }

  // ------------------------------------------------------------
  // Iniciar todos los módulos que ya existan (por si la pestaña
  // activa al arrancar no es la primera)
  // ------------------------------------------------------------
  function iniciarModulosDisponibles() {
    MODULOS.forEach(function (tab) {
      const mapa = {
        citas:      SG.admin.citas,
        pedidos:    SG.admin.pedidos,
        servicios:  SG.admin.servicios,
        productos:  SG.admin.productos,
        categorias: SG.admin.categorias,
        banners:    SG.admin.banners,
        horarios:   SG.admin.horarios
      };
      const mod = mapa[tab];
      if (mod && typeof mod.init === 'function' && tab === tabActiva) {
        try { mod.init(); }
        catch (err) { console.error('[SG.admin.main] init falló para ' + tab + ':', err); }
      }
    });
  }

  // ------------------------------------------------------------
  // Se llama cuando el usuario ya está autenticado como admin
  // ------------------------------------------------------------
  function onLogueado() {
    if (yaIniciado) {
      // Si vuelve a loguearse, solo aseguramos la pestaña activa
      activarTab(tabActiva);
      return;
    }
    yaIniciado = true;
    activarTab(tabActiva);
  }

  // ------------------------------------------------------------
  // Arranque
  // ------------------------------------------------------------
  async function init() {
    // Año automático en footer si lo hubiera (no en admin.html, pero por consistencia)
    if (SG.ui && SG.ui.initAnio) SG.ui.initAnio();

    initTabs();

    // Auth decide si mostrar app o login
    if (SG.admin.auth && typeof SG.admin.auth.init === 'function') {
      await SG.admin.auth.init();
    }
  }

  return {
    init: init,
    activarTab: activarTab,
    onLogueado: onLogueado
  };
})();

// ------------------------------------------------------------
// Arranque global del panel
// ------------------------------------------------------------
(function () {
  'use strict';

  function arrancar() {
    SG.admin.main.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }
})();