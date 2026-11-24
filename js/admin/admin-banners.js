/* ============================================================
   Estética Secret Garden — admin-banners.js
   CRUD de banners del hero con preview y programación.
   ============================================================ */

window.SG = window.SG || {};
SG.admin = SG.admin || {};

SG.admin.banners = (function () {
  'use strict';

  let inicializado = false;
  let banners = [];
  let editando = null;
  let imgDesktopFile = null;      // File nueva (o null para conservar)
  let imgMobileFile = null;
  let imgDesktopPreviewUrl = null;
  let imgMobilePreviewUrl = null;

  function init() {
    if (inicializado) { recargar(); return; }
    inicializado = true;

    const panel = document.getElementById('panel-banners');
    if (!panel) return;
    panel.innerHTML = estructura();
    engancharEventos();
    recargar();
  }

  function estructura() {
    return '' +
      '<div class="panel-head">' +
        '<h2>Banners del hero</h2>' +
        '<div class="panel-actions">' +
          '<button class="admin-btn admin-btn-primary" id="banner-new">+ Nuevo banner</button>' +
        '</div>' +
      '</div>' +
      '<div class="admin-card">' +
        '<p class="admin-help">Si no hay banners activos, la página muestra el hero por defecto con los botones normales.</p>' +
      '</div>' +
      '<div id="banner-list"></div>' +

      '<div class="admin-modal" id="banner-form-modal">' +
        '<div class="admin-modal-card wide">' +
          '<div class="admin-modal-head">' +
            '<h2 id="banner-form-titulo">Nuevo banner</h2>' +
            '<button type="button" class="admin-modal-close" data-close-banner>×</button>' +
          '</div>' +
          '<div id="banner-form-body"></div>' +
          '<div class="admin-modal-actions">' +
            '<button type="button" class="admin-btn admin-btn-secondary" data-close-banner>Cancelar</button>' +
            '<button type="button" class="admin-btn admin-btn-primary" id="banner-save">Guardar</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function engancharEventos() {
    const panel = document.getElementById('panel-banners');
    if (!panel) return;

    panel.addEventListener('click', function (e) {
      if (e.target.id === 'banner-new') { abrirFormulario(null); return; }
      if (e.target.closest('[data-close-banner]')) { cerrarFormulario(); return; }
      if (e.target.id === 'banner-save') { guardar(); return; }

      const edit = e.target.closest('[data-edit-banner]');
      if (edit) { abrirFormulario(edit.dataset.editBanner); return; }

      const del = e.target.closest('[data-del-banner]');
      if (del) { eliminarBanner(del.dataset.delBanner); return; }

      const toggle = e.target.closest('[data-toggle-banner]');
      if (toggle) { toggleActivo(toggle.dataset.toggleBanner); return; }
    });

    const modal = document.getElementById('banner-form-modal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) cerrarFormulario();
      });
    }
  }

  async function recargar() {
    const cont = document.getElementById('banner-list');
    if (cont) cont.innerHTML = '<div class="admin-loading">Cargando banners…</div>';
    if (!SG.sb) return;

    const res = await SG.sb.from('banners').select('*')
      .order('ubicacion', { ascending: true })
      .order('orden', { ascending: true });

    if (res.error) {
      console.error('[admin.banners] error:', res.error);
      if (cont) cont.innerHTML = '<div class="admin-empty">Error al cargar banners.</div>';
      return;
    }
    banners = res.data || [];
    render();
  }

  function estadoBanner(b) {
    if (!b.activo) return { clase: 'inactivo', texto: 'Inactivo' };
    const hoy = SG.utils.hoyISO();
    if (b.visible_desde && SG.utils.normalizarFecha(b.visible_desde) > hoy) return { clase: 'programado', texto: 'Programado' };
    if (b.visible_hasta && SG.utils.normalizarFecha(b.visible_hasta) < hoy) return { clase: 'vencido', texto: 'Vencido' };
    return { clase: 'activo', texto: 'Activo' };
  }

  function render() {
    const cont = document.getElementById('banner-list');
    if (!cont) return;

    if (banners.length === 0) {
      cont.innerHTML = '<div class="admin-empty">No hay banners creados. La página muestra el hero por defecto.</div>';
      return;
    }

    const grupos = {
      hero_secret_garden: banners.filter(function (b) { return b.ubicacion === 'hero_secret_garden'; }),
      hero_yoshimi:       banners.filter(function (b) { return b.ubicacion === 'hero_yoshimi'; })
    };

    let html = '';
    Object.keys(grupos).forEach(function (ub) {
      const titulo = ub === 'hero_yoshimi' ? 'Yoshimi' : 'Portada Secret Garden';
      html += '<div class="admin-card"><h3>' + titulo + '</h3>';
      if (grupos[ub].length === 0) {
        html += '<p class="admin-help">Sin banners en esta ubicación.</p>';
      } else {
        html += '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
          '<th></th><th>Título</th><th>Orden</th><th>Estado</th><th>Vigencia</th><th class="col-actions">Acciones</th>' +
          '</tr></thead><tbody>';
        grupos[ub].forEach(function (b) {
          const estado = estadoBanner(b);
          const imgUrl = SG.utils.imgUrl(b.imagen_path);
          const vigencia = (b.visible_desde ? SG.utils.fmtFecha(b.visible_desde) : '—') +
                          ' → ' + (b.visible_hasta ? SG.utils.fmtFecha(b.visible_hasta) : '—');
          html += '<tr>' +
            '<td><img class="admin-thumb" style="width:80px;height:44px;border-radius:4px" src="' + SG.utils.esc(imgUrl) + '" alt="" onerror="this.src=\'img/placeholders/placeholder.svg\'"></td>' +
            '<td>' + SG.utils.esc(b.titulo || '(sin título)') + '</td>' +
            '<td>' + b.orden + '</td>' +
            '<td><span class="admin-badge badge-' + estado.clase + '">' + estado.texto + '</span></td>' +
            '<td><small>' + SG.utils.esc(vigencia) + '</small></td>' +
            '<td class="col-actions">' +
              '<button class="admin-btn admin-btn-secondary admin-btn-sm" data-toggle-banner="' + SG.utils.esc(b.id) + '">' + (b.activo ? 'Desactivar' : 'Activar') + '</button> ' +
              '<button class="admin-btn admin-btn-secondary admin-btn-sm" data-edit-banner="' + SG.utils.esc(b.id) + '">Editar</button> ' +
              '<button class="admin-btn admin-btn-danger admin-btn-sm" data-del-banner="' + SG.utils.esc(b.id) + '">Eliminar</button>' +
            '</td>' +
          '</tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '</div>';
    });
    cont.innerHTML = html;
  }

  // ------------------------------------------------------------
  function abrirFormulario(id) {
    editando = id ? banners.find(function (b) { return b.id === id; }) : null;
    imgDesktopFile = null;
    imgMobileFile = null;
    imgDesktopPreviewUrl = null;
    imgMobilePreviewUrl = null;

    document.getElementById('banner-form-titulo').textContent = editando ? 'Editar banner' : 'Nuevo banner';
    renderFormulario();
    document.getElementById('banner-form-modal').classList.add('abierto');
  }

  function cerrarFormulario() {
    if (imgDesktopPreviewUrl) URL.revokeObjectURL(imgDesktopPreviewUrl);
    if (imgMobilePreviewUrl) URL.revokeObjectURL(imgMobilePreviewUrl);
    imgDesktopFile = null; imgMobileFile = null;
    imgDesktopPreviewUrl = null; imgMobilePreviewUrl = null;
    editando = null;
    document.getElementById('banner-form-modal').classList.remove('abierto');
  }

  function renderFormulario() {
    const body = document.getElementById('banner-form-body');
    if (!body) return;
    const b = editando || {};

    const urlsRapidas = [
      { label: '— Sin destino —', value: '' },
      { label: 'Servicios', value: '#servicios' },
      { label: 'Productos', value: '#productos' },
      { label: 'Yoshimi', value: '#yoshimi' },
      { label: 'Contacto', value: '#contacto' },
      { label: 'WhatsApp', value: 'https://wa.me/50664511598' }
    ];

    function opcionesUrls(actual) {
      return urlsRapidas.map(function (u) {
        return '<option value="' + SG.utils.esc(u.value) + '"' + (u.value === (actual || '') ? ' selected' : '') + '>' + SG.utils.esc(u.label) + '</option>';
      }).join('');
    }

    body.innerHTML = '' +
      '<div class="admin-form-grid">' +
        '<div class="campo">' +
          '<label for="b-ubicacion">Ubicación</label>' +
          '<select id="b-ubicacion">' +
            '<option value="hero_secret_garden"' + (b.ubicacion === 'hero_secret_garden' ? ' selected' : '') + '>Portada Secret Garden</option>' +
            '<option value="hero_yoshimi"' + (b.ubicacion === 'hero_yoshimi' ? ' selected' : '') + '>Yoshimi</option>' +
          '</select>' +
        '</div>' +
        '<div class="campo">' +
          '<label for="b-orden">Orden</label>' +
          '<input type="number" id="b-orden" min="0" step="1" value="' + (b.orden || 0) + '">' +
        '</div>' +
        '<div class="campo">' +
          '<label style="display:flex;align-items:center;gap:.5rem">' +
            '<input type="checkbox" id="b-activo"' + ((b.activo !== false) ? ' checked' : '') + '> Activo' +
          '</label>' +
        '</div>' +
        '<div class="campo"><label for="b-desde">Visible desde</label>' +
          '<input type="date" id="b-desde" value="' + SG.utils.normalizarFecha(b.visible_desde || '') + '"></div>' +
        '<div class="campo"><label for="b-hasta">Visible hasta</label>' +
          '<input type="date" id="b-hasta" value="' + SG.utils.normalizarFecha(b.visible_hasta || '') + '"></div>' +
        '<div class="campo full"><label for="b-titulo">Título</label>' +
          '<input type="text" id="b-titulo" maxlength="120" value="' + SG.utils.esc(b.titulo || '') + '"></div>' +
        '<div class="campo full"><label for="b-sub">Subtítulo</label>' +
          '<textarea id="b-sub" rows="2" maxlength="200">' + SG.utils.esc(b.subtitulo || '') + '</textarea></div>' +
        '<div class="campo"><label for="b-cta1-txt">Botón 1 — Texto</label>' +
          '<input type="text" id="b-cta1-txt" maxlength="40" value="' + SG.utils.esc(b.cta_texto || '') + '"></div>' +
        '<div class="campo"><label for="b-cta1-url">Botón 1 — Destino</label>' +
          '<select id="b-cta1-url" class="admin-filtro-select" style="width:100%">' + opcionesUrls(b.cta_url) + '</select>' +
          '<input type="text" id="b-cta1-custom" placeholder="…o URL personalizada (# o https://)" value="' + SG.utils.esc(b.cta_url || '') + '" style="margin-top:.3rem"></div>' +
        '<div class="campo"><label for="b-cta2-txt">Botón 2 — Texto</label>' +
          '<input type="text" id="b-cta2-txt" maxlength="40" value="' + SG.utils.esc(b.cta2_texto || '') + '"></div>' +
        '<div class="campo"><label for="b-cta2-url">Botón 2 — Destino</label>' +
          '<select id="b-cta2-url" class="admin-filtro-select" style="width:100%">' + opcionesUrls(b.cta2_url) + '</select>' +
          '<input type="text" id="b-cta2-custom" placeholder="…o URL personalizada" value="' + SG.utils.esc(b.cta2_url || '') + '" style="margin-top:.3rem"></div>' +
        '<div class="campo full"><label for="b-overlay">Opacidad overlay (0–60)</label>' +
          '<input type="range" id="b-overlay" min="0" max="60" value="' + (b.overlay_opacidad != null ? b.overlay_opacidad : 25) + '">' +
          '<small id="b-overlay-val">' + (b.overlay_opacidad != null ? b.overlay_opacidad : 25) + '%</small></div>' +
      '</div>' +

      '<h3 style="margin-top:1.5rem;color:var(--sg-verde);font-size:1rem">Imágenes</h3>' +
      '<div class="admin-form-grid">' +
        '<div class="campo">' +
          '<label>Imagen escritorio (1920×800 recomendado)</label>' +
          '<input type="file" id="b-img-desktop" accept="image/jpeg,image/png,image/webp">' +
          '<div id="b-prev-desktop" class="admin-banner-preview" style="margin-top:.5rem;min-height:120px;background:#eee;border-radius:6px;overflow:hidden;position:relative"></div>' +
        '</div>' +
        '<div class="campo">' +
          '<label>Imagen móvil (opcional, 900×1100)</label>' +
          '<input type="file" id="b-img-mobile" accept="image/jpeg,image/png,image/webp">' +
          '<div id="b-prev-mobile" class="admin-banner-preview" style="margin-top:.5rem;min-height:120px;background:#eee;border-radius:6px;overflow:hidden;position:relative"></div>' +
        '</div>' +
      '</div>';

    // Overlay slider
    const slider = document.getElementById('b-overlay');
    const sliderVal = document.getElementById('b-overlay-val');
    slider.addEventListener('input', function () {
      sliderVal.textContent = slider.value + '%';
      actualizarPreviews();
    });

    // Imagen desktop
    document.getElementById('b-img-desktop').addEventListener('change', function (e) {
      if (imgDesktopPreviewUrl) URL.revokeObjectURL(imgDesktopPreviewUrl);
      const f = e.target.files[0];
      if (!f) return;
      imgDesktopFile = f;
      imgDesktopPreviewUrl = URL.createObjectURL(f);
      actualizarPreviews();
    });

    document.getElementById('b-img-mobile').addEventListener('change', function (e) {
      if (imgMobilePreviewUrl) URL.revokeObjectURL(imgMobilePreviewUrl);
      const f = e.target.files[0];
      if (!f) return;
      imgMobileFile = f;
      imgMobilePreviewUrl = URL.createObjectURL(f);
      actualizarPreviews();
    });

    // Sync selects rápidos con inputs personalizados
    ['b-cta1-url', 'b-cta1-custom'].forEach(function (id, i) {
      const a = document.getElementById('b-cta1-url');
      const b = document.getElementById('b-cta1-custom');
      if (!a || !b) return;
      a.addEventListener('change', function () { if (a.value) b.value = a.value; });
      b.addEventListener('input', function () { /* libre */ });
    });
    ['b-cta2-url', 'b-cta2-custom'].forEach(function () {
      const a = document.getElementById('b-cta2-url');
      const b = document.getElementById('b-cta2-custom');
      if (!a || !b) return;
      a.addEventListener('change', function () { if (a.value) b.value = a.value; });
    });

    actualizarPreviews();
  }

  function actualizarPreviews() {
    const pD = document.getElementById('b-prev-desktop');
    const pM = document.getElementById('b-prev-mobile');
    const slider = document.getElementById('b-overlay');
    const op = slider ? parseInt(slider.value, 10) / 100 : 0.25;

    function urlActual(imgFile, urlPreview, editField) {
      if (urlPreview) return urlPreview;
      if (editando && editando[editField]) return SG.utils.imgUrl(editando[editField]);
      return null;
    }

    const urlD = urlActual(imgDesktopFile, imgDesktopPreviewUrl, 'imagen_path');
    const urlM = urlActual(imgMobileFile, imgMobilePreviewUrl, 'imagen_movil_path');

    if (pD) {
      pD.innerHTML = urlD
        ? '<img src="' + SG.utils.esc(urlD) + '" alt="" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">' +
          '<div style="position:absolute;inset:0;background:rgba(0,0,0,' + op + ')"></div>'
        : '<p class="admin-help" style="padding:1rem;margin:0">Sin imagen</p>';
    }
    if (pM) {
      pM.innerHTML = urlM
        ? '<img src="' + SG.utils.esc(urlM) + '" alt="" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">' +
          '<div style="position:absolute;inset:0;background:rgba(0,0,0,' + op + ')"></div>'
        : '<p class="admin-help" style="padding:1rem;margin:0">Sin imagen móvil (se usa la de escritorio)</p>';
    }
  }

  // ------------------------------------------------------------
  async function guardar() {
    const ubicacion = document.getElementById('b-ubicacion').value;
    const orden = parseInt(document.getElementById('b-orden').value, 10) || 0;
    const activo = document.getElementById('b-activo').checked;
    const visible_desde = document.getElementById('b-desde').value || null;
    const visible_hasta = document.getElementById('b-hasta').value || null;
    const titulo = document.getElementById('b-titulo').value.trim() || null;
    const subtitulo = document.getElementById('b-sub').value.trim() || null;
    const cta_texto = document.getElementById('b-cta1-txt').value.trim() || null;
    const cta_url = (document.getElementById('b-cta1-custom').value || document.getElementById('b-cta1-url').value || '').trim() || null;
    const cta2_texto = document.getElementById('b-cta2-txt').value.trim() || null;
    const cta2_url = (document.getElementById('b-cta2-custom').value || document.getElementById('b-cta2-url').value || '').trim() || null;
    const overlay_opacidad = parseInt(document.getElementById('b-overlay').value, 10);

    // Validar URLs seguras
    if (cta_url && !SG.utils.safeUrl(cta_url)) { SG.ui.toast('URL del botón 1 inválida.', 'warning'); return; }
    if (cta2_url && !SG.utils.safeUrl(cta2_url)) { SG.ui.toast('URL del botón 2 inválida.', 'warning'); return; }

    const btn = document.getElementById('banner-save');
    btn.disabled = true; btn.textContent = 'Guardando…';

    try {
      let bannerId = editando ? editando.id : null;
      let imagenPath = editando ? editando.imagen_path : null;
      let imagenMovilPath = editando ? editando.imagen_movil_path : null;

      // Si es nuevo, necesitamos insertar primero para tener id
      if (!editando) {
        if (!imgDesktopFile) { SG.ui.toast('La imagen de escritorio es obligatoria.', 'warning'); btn.disabled = false; btn.textContent = 'Guardar'; return; }
        const ins = await SG.sb.from('banners').insert({
          ubicacion: ubicacion,
          imagen_path: 'pending',
          overlay_opacidad: overlay_opacidad,
          orden: orden,
          activo: false
        }).select().single();
        if (ins.error) throw ins.error;
        bannerId = ins.data.id;
      }

      // Subir imágenes
      if (imgDesktopFile) {
        const up = await SG.admin.storage.subir(imgDesktopFile, 'banners', bannerId, { maxLado: 1920 });
        imagenPath = up.path;
      }
      if (imgMobileFile) {
        const up = await SG.admin.storage.subir(imgMobileFile, 'banners', bannerId, { maxLado: 1920 });
        imagenMovilPath = up.path;
      }

      const payload = {
        ubicacion, imagen_path: imagenPath, imagen_movil_path: imagenMovilPath,
        titulo, subtitulo,
        cta_texto, cta_url,
        cta2_texto, cta2_url,
        overlay_opacidad, orden, activo, visible_desde, visible_hasta
      };

      const upd = await SG.sb.from('banners').update(payload).eq('id', bannerId);
      if (upd.error) throw upd.error;

      SG.ui.toast(editando ? 'Banner actualizado.' : 'Banner creado.', 'success');
      cerrarFormulario();
      recargar();
    } catch (err) {
      console.error('[admin.banners] guardar error:', err);
      SG.ui.toast('No se pudo guardar el banner.', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Guardar';
    }
  }

  async function toggleActivo(id) {
    const b = banners.find(function (x) { return x.id === id; });
    if (!b) return;
    const res = await SG.sb.from('banners').update({ activo: !b.activo }).eq('id', id);
    if (res.error) { SG.ui.toast('No se pudo actualizar.', 'error'); return; }
    SG.ui.toast(!b.activo ? 'Banner activado.' : 'Banner desactivado.', 'success');
    recargar();
  }

  async function eliminarBanner(id) {
    if (!confirm('¿Eliminar este banner? Se borrará también la imagen del storage.')) return;
    const b = banners.find(function (x) { return x.id === id; });
    if (b) {
      if (b.imagen_path) await SG.admin.storage.borrar(b.imagen_path);
      if (b.imagen_movil_path) await SG.admin.storage.borrar(b.imagen_movil_path);
    }
    const res = await SG.sb.from('banners').delete().eq('id', id);
    if (res.error) { SG.ui.toast('No se pudo eliminar.', 'error'); console.error(res.error); return; }
    SG.ui.toast('Banner eliminado.', 'success');
    recargar();
  }

  return { init: init };
})();