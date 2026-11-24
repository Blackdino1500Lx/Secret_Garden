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
    const secciones = ['inicio', 'servicios', 'productos', 'nosotros', 'yoshimi', 'contacto'];
    const enlaces = Array.from(document.querySelectorAll('#main-nav a'));

    function actualizar() {
      const headerAlto = document.getElementById('site-header')?.offsetHeight || 0;
      const scrollY = window.scrollY + headerAlto + 60;
      let activo = 'inicio';
      for (const id of secciones) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.offsetTop <= scrollY) activo = id;
      }
      enlaces.forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('href') === '#' + activo);
      });
    }

    let pendiente = false;
    window.addEventListener('scroll', function () {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(function () {
        actualizar();
        pendiente = false;
      });
    }, { passive: true });

    actualizar();
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