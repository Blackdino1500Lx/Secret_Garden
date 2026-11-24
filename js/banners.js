/* ============================================================
   Estética Secret Garden — banners.js
   Hero por defecto + banners administrables (single y carrusel).
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
  function defaultsUbicacion(location) {
    if (location === 'hero_yoshimi') {
      return {
        titulo: 'Yoshimi Nails',
        subtitulo: 'Manicura y pedicura, cuidado y belleza.',
        cta1: { texto: 'Ver servicios', url: '#yoshimi-servicios' },
        cta2: { texto: 'Ver productos', url: '#yoshimi-productos' }
      };
    }
    return {
      titulo: 'Un espacio para florecer',
      subtitulo: 'Estética facial y corporal en Alajuelita, San José.',
      cta1: { texto: 'Agendar cita', url: '#servicios' },
      cta2: { texto: 'Ver productos', url: '#productos' }
    };
  }

  // ---------- Render de un slide individual ----------
  function slideHtml(banner, location, index, total, esPrimero) {
    const def = defaultsUbicacion(location);
    const titulo = banner.titulo || def.titulo;
    const subtitulo = banner.subtitulo || def.subtitulo;
    const cta1 = {
      texto: banner.cta_texto || def.cta1.texto,
      url: SG.utils.safeUrl(banner.cta_url) || def.cta1.url
    };
    const cta2 = {
      texto: banner.cta2_texto || def.cta2.texto,
      url: SG.utils.safeUrl(banner.cta2_url) || def.cta2.url
    };

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
            (cta1.texto && cta1.url ? '<a class="btn btn-primary" href="' + SG.utils.esc(cta1.url) + '">' + SG.utils.esc(cta1.texto) + '</a>' : '') +
            (cta2.texto && cta2.url ? '<a class="btn btn-secondary" href="' + SG.utils.esc(cta2.url) + '">' + SG.utils.esc(cta2.texto) + '</a>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ---------- Render de un hero completo ----------
  function renderHero(heroEl, banners, location) {
    if (!banners || banners.length === 0) return;

    if (banners.length === 1) {
      heroEl.innerHTML = slideHtml(banners[0], location, 0, 1, true);
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

    // Touch swipe
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

    // Pausa si la pestaña no está visible
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) detenerAutoplay();
      else iniciarAutoplay();
    });

    iniciarAutoplay();

    carruselesActivos.push({ detener: detenerAutoplay });
  }

  // ---------- Init: recorre todos los [data-banner-location] ----------
  async function init() {
    const heroes = Array.from(document.querySelectorAll('[data-banner-location]'));
    if (heroes.length === 0) return;

    for (const heroEl of heroes) {
      const location = heroEl.dataset.bannerLocation;
      if (!location) continue;
      const banners = await cargarBanners(location);
      if (banners && banners.length > 0) {
        renderHero(heroEl, banners, location);
      }
      // Si no hay banners, se deja el hero por defecto que ya está en el HTML.
    }
  }

  return {
    init: init,
    cargarBanners: cargarBanners
  };
})();