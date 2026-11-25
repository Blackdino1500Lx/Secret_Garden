/* ============================================================
   Estética Secret Garden — banners.js
   Hero por defecto + banners administrables (single y carrusel).
   Cuando hay banners activos, el hero-default se elimina por
   completo (JS + CSS defensivo).
   ============================================================ */

window.SG = window.SG || {};

SG.banners = (function () {
  'use strict';

  const AUTOPLAY_MS = 6000;
  const carruselesActivos = [];

  // ---------- Consulta banners activos y vigentes por ubicación ----------
  async function cargarBanners(ubicacion) {
    if (!SG.sb) return null;
    const hoy = SG.utils.hoyISO();
    const res = await SG.sb
      .from('banners')
      .select('*')
      .eq('ubicacion', ubicacion)
      .eq('activo', true)
      .order('orden', { ascending: true });

    if (res.error) {
      console.warn('[SG.banners] Error al cargar banners (' + ubicacion + '):', res.error);
      return null;
    }

    return (res.data || []).filter(function (b) {
      if (b.visible_desde && SG.utils.normalizarFecha(b.visible_desde) > hoy) return false;
      if (b.visible_hasta && SG.utils.normalizarFecha(b.visible_hasta) < hoy) return false;
      return true;
    });
  }

  // ---------- Textos por defecto según ubicación ----------
  // (Estos SOLO se usan en el título/subtítulo si están vacíos, NO en los botones)
  function defaultsUbicacion(location) {
    if (location === 'hero_yoshimi') {
      return {
        titulo: 'Yoshimi Nails',
        subtitulo: 'Manicura y pedicura, cuidado y belleza.'
      };
    }
    return {
      titulo: 'Un espacio para florecer',
      subtitulo: 'Estética facial y corporal en Alajuelita, San José.'
    };
  }

  // ---------- Render de un slide individual ----------
  function slideHtml(banner, location, index, total, esPrimero) {
    const def = defaultsUbicacion(location);

    // Si el título/subtítulo están vacíos, usamos el default (para que no quede vacío)
    const titulo = (banner.titulo && banner.titulo.trim()) ? banner.titulo : def.titulo;
    const subtitulo = (banner.subtitulo && banner.subtitulo.trim()) ? banner.subtitulo : def.subtitulo;

    // Los BOTONES solo se muestran si el admin los escribió explícitamente.
    // Al no usar "def.cta1.texto", si está vacío se convierte en null y no se dibuja.
    const cta1Texto = (banner.cta_texto && banner.cta_texto.trim()) ? banner.cta_texto : null;
    const cta1Url = SG.utils.safeUrl(banner.cta_url);

    const cta2Texto = (banner.cta2_texto && banner.cta2_texto.trim()) ? banner.cta2_texto : null;
    const cta2Url = SG.utils.safeUrl(banner.cta2_url);

    const desktop = SG.utils.imgUrl(banner.imagen_path);
    const mobile = banner.imagen_movil_path ? SG.utils.imgUrl(banner.imagen_movil_path) : null;
    const overlay = Math.max(0, Math.min(60, parseInt(banner.overlay_opacidad || 25, 10)));

    let picture;
    if (mobile) {
      picture =
        '<picture>' +
          '<source media="(max-width: 700px)" srcset="' + SG.utils.esc(mobile) + '" />' +
          '<img src="' + SG.utils.esc(desktop) + '" alt="' + SG.utils.esc(titulo) + '" ' +
               (esPrimero ? 'fetchpriority="high"' : 'loading="lazy"') +
               ' onerror="this.style.display=\'none\'" />' +
        '</picture>';
    } else {
      picture =
        '<img src="' + SG.utils.esc(desktop) + '" alt="' + SG.utils.esc(titulo) + '" ' +
             (esPrimero ? 'fetchpriority="high"' : 'loading="lazy"') +
             ' onerror="this.style.display=\'none\'" />';
    }

    const claseSlide = total > 1
      ? 'banner-slide' + (esPrimero ? ' activo' : '')
      : 'banner-slide activo';

    return '' +
      '<div class="' + claseSlide + '" data-slide-index="' + index + '">' +
        picture +
        '<div class="banner-overlay" style="background: rgba(0,0,0,' + (overlay / 100) + ')"></div>' +
        '<div class="banner-content">' +
          '<h1>' + SG.utils.esc(titulo) + '</h1>' +
          (subtitulo ? '<p>' + SG.utils.esc(subtitulo) + '</p>' : '') +
          '<div class="hero-actions">' +
            (cta1Texto && cta1Url
              ? '<a class="btn btn-primary" href="' + SG.utils.esc(cta1Url) + '">' + SG.utils.esc(cta1Texto) + '</a>'
              : '') +
            (cta2Texto && cta2Url
              ? '<a class="btn btn-secondary" href="' + SG.utils.esc(cta2Url) + '">' + SG.utils.esc(cta2Texto) + '</a>'
              : '') +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ---------- Render de un hero completo ----------
  function renderHero(heroEl, banners, location) {
    if (!banners || banners.length === 0) return;

    // DEFENSA 1: marcar el hero como "tiene banner"
    heroEl.classList.add('tiene-banner');

    // DEFENSA 2: eliminar explícitamente cualquier .hero-default
    heroEl.querySelectorAll('.hero-default').forEach(function (el) {
      el.remove();
    });

    // DEFENSA 3: limpiar cualquier carrusel previo antes de volver a pintar
    heroEl.querySelectorAll('[data-carousel]').forEach(function (el) {
      el.remove();
    });

    if (banners.length === 1) {
      heroEl.innerHTML = slideHtml(banners[0], location, 0, 1, true);
      console.log('[SG.banners] 1 banner renderizado en', location);
      return;
    }

    // Varios → carrusel
    const slides = banners.map(function (b, i) {
      return slideHtml(b, location, i, banners.length, i === 0);
    }).join('');

    const dots = banners.map(function (_, i) {
      return '<button class="banner-dot' + (i === 0 ? ' activo' : '') + '" data-dot-index="' + i + '" aria-label="Ir al banner ' + (i + 1) + '"></button>';
    }).join('');

    heroEl.innerHTML =
      '<div class="banner-carousel" data-carousel>' +
        slides +
        '<button class="banner-arrow prev" data-arrow="-1" aria-label="Anterior">‹</button>' +
        '<button class="banner-arrow next" data-arrow="1" aria-label="Siguiente">›</button>' +
        '<div class="banner-dots">' + dots + '</div>' +
      '</div>';

    iniciarCarrusel(heroEl);
    console.log('[SG.banners] carrusel con', banners.length, 'banners renderizado en', location);
  }

  // ---------- Comportamiento del carrusel ----------
  function iniciarCarrusel(heroEl) {
    const car = heroEl.querySelector('[data-carousel]');
    if (!car) return;
    const slides = Array.from(car.querySelectorAll('.banner-slide'));
    const dots = Array.from(car.querySelectorAll('.banner-dot'));
    if (slides.length < 2) return;

    let actual = 0;
    let autoplayId = null;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function ir(indice) {
      actual = (indice + slides.length) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle('activo', i === actual); });
      dots.forEach(function (d, i) { d.classList.toggle('activo', i === actual); });
    }

    function avanzar() { ir(actual + 1); }

    function iniciarAutoplay() {
      if (reduceMotion) return;
      detenerAutoplay();
      autoplayId = setInterval(avanzar, AUTOPLAY_MS);
    }

    function detenerAutoplay() {
      if (autoplayId) { clearInterval(autoplayId); autoplayId = null; }
    }

    car.addEventListener('click', function (e) {
      const arrow = e.target.closest('[data-arrow]');
      if (arrow) { ir(actual + parseInt(arrow.dataset.arrow, 10)); iniciarAutoplay(); return; }
      const dot = e.target.closest('[data-dot-index]');
      if (dot) { ir(parseInt(dot.dataset.dotIndex, 10)); iniciarAutoplay(); }
    });

    car.addEventListener('mouseenter', detenerAutoplay);
    car.addEventListener('mouseleave', iniciarAutoplay);

    let touchInicio = null;
    car.addEventListener('touchstart', function (e) {
      touchInicio = e.touches[0].clientX;
    }, { passive: true });
    car.addEventListener('touchend', function (e) {
      if (touchInicio == null) return;
      const delta = e.changedTouches[0].clientX - touchInicio;
      if (Math.abs(delta) > 40) ir(actual + (delta < 0 ? 1 : -1));
      touchInicio = null;
      iniciarAutoplay();
    }, { passive: true });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) detenerAutoplay();
      else iniciarAutoplay();
    });

    iniciarAutoplay();
    carruselesActivos.push({ detener: detenerAutoplay });
  }

  // ---------- Init ----------
  async function init() {
    const heroes = Array.from(document.querySelectorAll('[data-banner-location]'));
    if (heroes.length === 0) return;

    for (const heroEl of heroes) {
      const location = heroEl.dataset.bannerLocation;
      if (!location) continue;

      const banners = await cargarBanners(location);
      console.log('[SG.banners]', location, '→', (banners || []).length, 'banner(s) activos');

      if (banners && banners.length > 0) {
        renderHero(heroEl, banners, location);
      }
    }
  }

  return {
    init: init,
    cargarBanners: cargarBanners
  };
})();