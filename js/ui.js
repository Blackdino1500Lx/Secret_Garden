/* ============================================================
   Estética Secret Garden — ui.js
   Menú hamburguesa, scroll suave, scroll-spy, toasts, modales.
   ============================================================ */

window.SG = window.SG || {};

SG.ui = (function () {
  'use strict';

  // ---------- Estado compartido entre scroll-suave y scroll-spy ----------
  let _marcarActivoFn = null;    // setter inyectado por initScrollSpy
  let _pausado = false;          // true mientras dura el scroll programático
  let _pausaTimer = null;

  function pausarScrollSpy() {
    _pausado = true;
    clearTimeout(_pausaTimer);
    _pausaTimer = setTimeout(function () {
      _pausado = false;
      if (_marcarActivoFn) _marcarActivoFn(null); // recalcula según posición real
    }, 900);
  }

  function reanudarScrollSpy() {
    clearTimeout(_pausaTimer);
    _pausado = false;
    if (_marcarActivoFn) _marcarActivoFn(null);
  }

  // ---------- Toasts ----------
  function toast(mensaje, tipo) {
    const cont = document.getElementById('toast-container');
    if (!cont) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (tipo || 'info');
    el.textContent = mensaje;
    cont.appendChild(el);

    const duracion = tipo === 'error' ? 6000 : 4000;
    setTimeout(function () {
      el.classList.add('fade-out');
      setTimeout(function () { el.remove(); }, 300);
    }, duracion);
  }

  // ---------- Menú hamburguesa ----------
  function initHamburger() {
    const btn = document.getElementById('hamburger');
    const nav = document.getElementById('main-nav');
    if (!btn || !nav) return;

    btn.addEventListener('click', function () {
      const abierto = nav.classList.toggle('abierto');
      btn.classList.toggle('abierto', abierto);
      btn.setAttribute('aria-expanded', String(abierto));
    });

    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('abierto');
        btn.classList.remove('abierto');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ---------- Scroll suave ----------
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      const destino = document.querySelector(id);
      if (!destino) return;
      e.preventDefault();

      // 1) Marcar el destino como activo INMEDIATAMENTE
      if (_marcarActivoFn) _marcarActivoFn(id.slice(1));

      // 2) Pausar el scroll-spy mientras el navegador anima el scroll
      pausarScrollSpy();

      // 3) Hacer el scroll suave
      const headerAlto = document.getElementById('site-header')?.offsetHeight || 0;
      const y = destino.getBoundingClientRect().top + window.scrollY - headerAlto - 12;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });

    // Si el navegador soporta 'scrollend', reanudar en cuanto termine
    if ('onscrollend' in window) {
      window.addEventListener('scrollend', function () {
        if (_pausado) reanudarScrollSpy();
      }, { passive: true });
    }
  }

  // ---------- Scroll-spy ----------
  function initScrollSpy() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    const enlaces = Array.from(nav.querySelectorAll('a[href^="#"]'));
    if (enlaces.length === 0) return;

    // Secciones en el ORDEN REAL del DOM (no hardcodeado)
    const secciones = Array.from(document.querySelectorAll('main > section[id], main > div[id]'))
      .filter(function (el) {
        return enlaces.some(function (a) {
          return a.getAttribute('href') === '#' + el.id;
        });
      });

    if (secciones.length === 0) return;

    let activoId = null;

    function getHeaderAlto() {
      const h = document.getElementById('site-header');
      return h ? h.offsetHeight : 0;
    }

    // Marca como activo un id específico (o recalcula si id = null)
    function marcarActivo(id) {
      let nuevoId = id;

      if (!nuevoId) {
        // Recalcular según posición
        const headerAlto = getHeaderAlto();
        const triggerY = headerAlto + 100;
        nuevoId = secciones[0].id;

        const scrollMax = document.documentElement.scrollHeight - window.innerHeight;
        if (window.scrollY >= scrollMax - 4) {
          nuevoId = secciones[secciones.length - 1].id;
        } else {
          for (let i = 0; i < secciones.length; i++) {
            const rect = secciones[i].getBoundingClientRect();
            if (rect.top <= triggerY) {
              nuevoId = secciones[i].id;
            } else {
              break;
            }
          }
        }
      }

      if (nuevoId === activoId) return;
      activoId = nuevoId;

      enlaces.forEach(function (a) {
        const esActivo = a.getAttribute('href') === '#' + activoId;
        a.classList.toggle('active', esActivo);
        if (esActivo) {
          a.setAttribute('aria-current', 'page');
        } else {
          a.removeAttribute('aria-current');
        }
      });
    }

    // Inyectar el setter para que initSmoothScroll pueda marcar directo
    _marcarActivoFn = marcarActivo;

    // Throttle con requestAnimationFrame
    let pendiente = false;
    function onScrollOrResize() {
      if (_pausado) return;                 // ignorar mientras scroll programático
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(function () {
        marcarActivo(null);
        pendiente = false;
      });
    }

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);

    // Recalcular cuando cargan las imágenes
    document.querySelectorAll('img').forEach(function (img) {
      if (!img.complete) {
        img.addEventListener('load', function () {
          if (!_pausado) marcarActivo(null);
        }, { once: true });
      }
    });

    // Recalcular cuando alguna sección cambia de tamaño (catálogo dinámico)
    if (typeof ResizeObserver !== 'undefined') {
      try {
        const ro = new ResizeObserver(function () {
          if (!_pausado) marcarActivo(null);
        });
        secciones.forEach(function (s) { ro.observe(s); });
      } catch (_) { /* ignorar */ }
    }

    // Recalcular cuando termina de cargar el catálogo
    document.addEventListener('sg:catalog-loaded', function () {
      if (!_pausado) marcarActivo(null);
    });

    // Cálculo inicial
    marcarActivo(null);
  }

  // ---------- Año dinámico ----------
  function initAnio() {
    const span = document.getElementById('anio');
    if (span) span.textContent = new Date().getFullYear();
  }

  // ---------- Modales ----------
  function abrirModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('abierto');
    m.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function cerrarModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('abierto');
    m.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  return {
    toast: toast,
    initHamburger: initHamburger,
    initSmoothScroll: initSmoothScroll,
    initScrollSpy: initScrollSpy,
    initAnio: initAnio,
    abrirModal: abrirModal,
    cerrarModal: cerrarModal
  };
})();