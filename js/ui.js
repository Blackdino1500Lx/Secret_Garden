/* ============================================================
   Estética Secret Garden — ui.js
   Menú hamburguesa, scroll suave, scroll-spy, toasts, modales.
   ============================================================ */

window.SG = window.SG || {};

SG.ui = (function () {
  'use strict';

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

    // Cierra al hacer clic en un enlace
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('abierto');
        btn.classList.remove('abierto');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ---------- Scroll suave (fallback si el navegador no lo soporta) ----------
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      const destino = document.querySelector(id);
      if (!destino) return;
      e.preventDefault();
      const headerAlto = document.getElementById('site-header')?.offsetHeight || 0;
      const y = destino.getBoundingClientRect().top + window.scrollY - headerAlto - 12;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  }

  // ---------- Scroll-spy: resalta el enlace activo ----------
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

    function calcularActivo() {
      const headerAlto = getHeaderAlto();
      const triggerY = headerAlto + 100;
      let nuevaActiva = secciones[0].id;

      // Si estamos al final del documento, marcar la última sección
      const scrollMax = document.documentElement.scrollHeight - window.innerHeight;
      if (window.scrollY >= scrollMax - 4) {
        nuevaActiva = secciones[secciones.length - 1].id;
      } else {
        // Recorrer en orden del DOM: la última sección cuyo top
        // esté por encima del trigger es la activa
        for (let i = 0; i < secciones.length; i++) {
          const rect = secciones[i].getBoundingClientRect();
          if (rect.top <= triggerY) {
            nuevaActiva = secciones[i].id;
          } else {
            break;
          }
        }
      }

      if (nuevaActiva === activoId) return;
      activoId = nuevaActiva;

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

    // Throttle con requestAnimationFrame
    let pendiente = false;
    function onScrollOrResize() {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(function () {
        calcularActivo();
        pendiente = false;
      });
    }

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);

    // Recalcular cuando cargan las imágenes (cambia el layout)
    document.querySelectorAll('img').forEach(function (img) {
      if (!img.complete) {
        img.addEventListener('load', calcularActivo, { once: true });
      }
    });

    // Recalcular cuando alguna sección cambia de tamaño (catálogo dinámico)
    if (typeof ResizeObserver !== 'undefined') {
      try {
        const ro = new ResizeObserver(function () { calcularActivo(); });
        secciones.forEach(function (s) { ro.observe(s); });
      } catch (_) { /* ignorar */ }
    }

    // También cuando termina de cargar el catálogo por JS
    document.addEventListener('sg:catalog-loaded', calcularActivo);

    // Cálculo inicial
    calcularActivo();
  }

  // ---------- Año dinámico en el footer ----------
  function initAnio() {
    const span = document.getElementById('anio');
    if (span) span.textContent = new Date().getFullYear();
  }

  // ---------- Modal helpers ----------
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