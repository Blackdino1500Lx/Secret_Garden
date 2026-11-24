/* ============================================================
   Estética Secret Garden — utils.js
   Utilidades compartidas: formato, fechas, escape, precios.
   ============================================================ */

window.SG = window.SG || {};

SG.utils = (function () {
  'use strict';

  // ---------- esc: escapa texto para insertarlo con innerHTML ----------
  function esc(valor) {
    return String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------- formatCRC: número -> "₡22.300" ----------
  function formatCRC(n) {
    if (n == null || isNaN(n)) return '';
    const entero = Math.round(Number(n));
    const s = String(Math.abs(entero)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (entero < 0 ? '-' : '') + '₡' + s;
  }

  // ---------- hoyISO: 'YYYY-MM-DD' (zona local del navegador) ----------
  function hoyISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  }

  // ---------- normalizarFecha: fuerza 'YYYY-MM-DD' ----------
  function normalizarFecha(valor) {
    if (!valor) return '';
    return String(valor).slice(0, 10);
  }

  // ---------- fmtFecha: '2026-12-02' -> '02/12/2026' ----------
  function fmtFecha(iso) {
    const f = normalizarFecha(iso);
    if (!f) return '';
    const [y, m, d] = f.split('-');
    return d + '/' + m + '/' + y;
  }

  // ---------- diaSemanaLargo: '2026-12-02' -> 'miércoles' ----------
  function diaSemanaLargo(iso) {
    const f = normalizarFecha(iso);
    if (!f) return '';
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const d = new Date(f + 'T12:00:00');
    return dias[d.getDay()];
  }

  // ---------- fmtHora12: '09:00' -> '9:00am', '12:00' -> '12md' ----------
  function fmtHora12(hora) {
    if (!hora) return '';
    const partes = String(hora).slice(0, 5).split(':');
    const h = parseInt(partes[0], 10);
    const m = parseInt(partes[1], 10) || 0;
    const h12 = h % 12 || 12;
    if (m === 0 && (h === 0 || h === 12)) return '12md';
    const sufijo = h < 12 ? 'am' : 'pm';
    return h12 + ':' + String(m).padStart(2, '0') + sufijo;
  }

  // ---------- precioFinal: misma regla que la función SQL ----------
  function precioFinal(precio, tipo, valor, hasta) {
    if (precio == null) return null;
    if (!tipo || !valor || valor <= 0) return precio;
    if (hasta && normalizarFecha(hasta) < hoyISO()) return precio;
    if (tipo === 'porcentaje') {
      return Math.round(precio * (1 - valor / 100));
    }
    if (tipo === 'monto') {
      return Math.max(precio - valor, 0);
    }
    return precio;
  }

  // ---------- descuentoTexto: devuelve "-15%" o "-₡2.000" o null ----------
  function descuentoTexto(tipo, valor, hasta) {
    if (!tipo || !valor || valor <= 0) return null;
    if (hasta && normalizarFecha(hasta) < hoyISO()) return null;
    if (tipo === 'porcentaje') return '-' + valor + '%';
    if (tipo === 'monto') return '-' + formatCRC(valor);
    return null;
  }

  // ---------- imgUrl: path del bucket -> URL pública ----------
  function imgUrl(path) {
    if (!path) return 'img/placeholders/placeholder.svg';
    return SG.config.SUPABASE_URL +
      '/storage/v1/object/public/' + SG.config.BUCKET + '/' +
      encodeURI(path);
  }

  // ---------- slug: para id/atributos ----------
  function slug(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ---------- safeUrl: solo permite #, https:// o wa.me ----------
  function safeUrl(url) {
    if (!url) return null;
    const u = String(url).trim();
    if (u.startsWith('#')) return u;
    if (u.startsWith('https://wa.me/')) return u;
    if (u.startsWith('https://')) return u;
    return null;
  }

  return {
    esc: esc,
    formatCRC: formatCRC,
    hoyISO: hoyISO,
    normalizarFecha: normalizarFecha,
    fmtFecha: fmtFecha,
    diaSemanaLargo: diaSemanaLargo,
    fmtHora12: fmtHora12,
    precioFinal: precioFinal,
    descuentoTexto: descuentoTexto,
    imgUrl: imgUrl,
    slug: slug,
    safeUrl: safeUrl
  };
})();