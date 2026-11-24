/* ============================================================
   Estética Secret Garden — admin-servicios.js
   CRUD de servicios con imágenes, descuento y precio final.
   ============================================================ */

window.SG = window.SG || {};
SG.admin = SG.admin || {};

SG.admin.servicios = (function () {
  'use strict';

  let inicializado = false;
  let servicios = [];
  let categorias = [];
  let imagenesMap = {};   // { servicio_id: [{id, path, orden}] }
  let filtroMarca = 'todas';
  let filtroCat = 'todas';
  let busqueda = '';

  let editando = null;
  let imagenesExistentes = [];   // [{id, path, orden, _eliminar}]
  let imagenesNuevas = [];       // [{file, objectUrl}]

  function init() {
    if (inicializado) { recargar(); return; }
    inicializado = true;

    const panel = document.getElementById('panel-servicios');
    if (!panel) return;
    panel.innerHTML = estructura();
    engancharEventos();
    recargar();
  }

  function estructura() {
    return '' +
      '<div class="panel-head">' +
        '<h2>Servicios</h2>' +
        '<div class="panel-actions">' +
          '<button class="admin-btn admin-btn-primary" id="serv-new">+ Nuevo servicio</button>' +
        '</div>' +
      '</div>' +
      '<div class="admin-filtros">' +
        '<input type="text" class="admin-filtro-select" id="serv-search" placeholder="Buscar…" style="flex:1;min-width:160px">' +
        '<select class="admin-filtro-select" id="serv-marca-filter">' +
          '<option value="todas">Todas las marcas</option>' +
          '<option value="secret_garden">Secret Garden</option>' +
          '<option value="yoshimi">Yoshimi</option>' +
        '</select>' +
        '<select class="admin-filtro-select" id="serv-cat-filter"><option value="todas">Todas las categorías</option></select>' +
      '</div>' +
      '<div id="serv-list"></div>' +

      '<div class="admin-modal" id="serv-form-modal">' +
        '<div class="admin-modal-card wide">' +
          '<div class="admin-modal-head">' +
            '<h2 id="serv-form-titulo">Nuevo servicio</h2>' +
            '<button type="button" class="admin-modal-close" data-close-serv>×</button>' +
          '</div>' +
          '<div id="serv-form-body"></div>' +
          '<div class="admin-modal-actions">' +
            '<button type="button" class="admin-btn admin-btn-secondary" data-close-serv>Cancelar</button>' +
            '<button type="button" class="admin-btn admin-btn-primary" id="serv-save">Guardar</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function engancharEventos() {
    const panel = document.getElementById('panel-servicios');
    if (!panel) return;

    panel.addEventListener('click', function (e) {
      if (e.target.id === 'serv-new') { abrirFormulario(null); return; }
      if (e.target.closest('[data-close-serv]')) { cerrarFormulario(); return; }
      if (e.target.id === 'serv-save') { guardar(); return; }

      const edit = e.target.closest('[data-edit-serv]');
      if (edit) { abrirFormulario(edit.dataset.editServ); return; }

      const del = e.target.closest('[data-del-serv]');
      if (del) { eliminarServicio(del.dataset.delServ); return; }

      // Quitar imagen existente (marcar para eliminar)
      const rmEx = e.target.closest('[data-rm-img-ex]');
      if (rmEx) {
        const idx = parseInt(rmEx.dataset.rmImgEx, 10);
        if (imagenesExistentes[idx]) {
          imagenesExistentes[idx]._eliminar = !imagenesExistentes[idx]._eliminar;
          renderGaleria();
        }
        return;
      }

      // Quitar imagen nueva (quitar del array)
      const rmNv = e.target.closest('[data-rm-img-new]');
      if (rmNv) {
        const idx = parseInt(rmNv.dataset.rmImgNew, 10);
        if (imagenesNuevas[idx]) {
          URL.revokeObjectURL(imagenesNuevas[idx].objectUrl);
          imagenesNuevas.splice(idx, 1);
          renderGaleria();
        }
        return;
      }

      // Reordenar imagen existente
      const upEx = e.target.closest('[data-move-up-ex]');
      const dnEx = e.target.closest('[data-move-dn-ex]');
      if (upEx || dnEx) {
        const idx = parseInt((upEx || dnEx).dataset[upEx ? 'moveUpEx' : 'moveDnEx'], 10);
        const delta = upEx ? -1 : 1;
        const target = idx + delta;
        if (target >= 0 && target < imagenesExistentes.length) {
          const tmp = imagenesExistentes[idx];
          imagenesExistentes[idx] = imagenesExistentes[target];
          imagenesExistentes[target] = tmp;
          renderGaleria();
        }
        return;
      }
    });

    const search = document.getElementById('serv-search');
    if (search) search.addEventListener('input', function () { busqueda = search.value.toLowerCase(); render(); });

    const mf = document.getElementById('serv-marca-filter');
    if (mf) mf.addEventListener('change', function () { filtroMarca = mf.value; render(); });

    const cf = document.getElementById('serv-cat-filter');
    if (cf) cf.addEventListener('change', function () { filtroCat = cf.value; render(); });

    const modal = document.getElementById('serv-form-modal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) cerrarFormulario();
      });
    }
  }

  async function recargar() {
    const cont = document.getElementById('serv-list');
    if (cont) cont.innerHTML = '<div class="admin-loading">Cargando servicios…</div>';
    if (!SG.sb) return;

    const [sRes, cRes, iRes] = await Promise.all([
      SG.sb.from('servicios').select('*').order('marca', { ascending: true }).order('orden', { ascending: true }),
      SG.sb.from('categorias').select('*').eq('tipo', 'servicio').eq('activa', true).order('orden', { ascending: true }),
      SG.sb.from('servicio_imagenes').select('*').order('orden', { ascending: true })
    ]);

    if (sRes.error || cRes.error) {
      console.error('[admin.servicios] error:', sRes.error, cRes.error);
      if (cont) cont.innerHTML = '<div class="admin-empty">Error al cargar servicios.</div>';
      return;
    }

    servicios = sRes.data || [];
    categorias = cRes.data || [];
    imagenesMap = {};
    (iRes.data || []).forEach(function (img) {
      if (!imagenesMap[img.servicio_id]) imagenesMap[img.servicio_id] = [];
      imagenesMap[img.servicio_id].push(img);
    });

    poblarFiltroCategorias();
    render();
  }

  function poblarFiltroCategorias() {
    const sel = document.getElementById('serv-cat-filter');
    if (!sel) return;
    const cats = categorias;
    sel.innerHTML = '<option value="todas">Todas las categorías</option>' +
      cats.map(function (c) {
        return '<option value="' + SG.utils.esc(c.id) + '">' + SG.utils.esc(c.nombre) + '</option>';
      }).join('');
    if (filtroCat !== 'todas') sel.value = filtroCat;
  }

  function render() {
    const cont = document.getElementById('serv-list');
    if (!cont) return;

    let lista = servicios;
    if (filtroMarca !== 'todas') lista = lista.filter(function (s) { return s.marca === filtroMarca; });
    if (filtroCat !== 'todas') lista = lista.filter(function (s) { return s.categoria_id === filtroCat; });
    if (busqueda) lista = lista.filter(function (s) { return (s.nombre || '').toLowerCase().indexOf(busqueda) !== -1; });

    if (lista.length === 0) {
      cont.innerHTML = '<div class="admin-empty">No hay servicios con esos filtros.</div>';
      return;
    }

    let html = '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
      '<th></th><th>Nombre</th><th>Marca</th><th>Categoría</th><th>Precio</th><th>Duración</th>' +
      '<th>Estado</th><th class="col-actions">Acciones</th>' +
      '</tr></thead><tbody>';

    lista.forEach(function (s) {
      const imgs = imagenesMap[s.id] || [];
      const thumb = imgs.length > 0 ? SG.utils.imgUrl(imgs[0].path) : 'img/placeholders/placeholder.svg';
      const cat = categorias.find(function (c) { return c.id === s.categoria_id; });
      const precioFinal = SG.utils.precioFinal(s.precio, s.descuento_tipo, s.descuento_valor, s.descuento_hasta);
      const descTxt = SG.utils.descuentoTexto(s.descuento_tipo, s.descuento_valor, s.descuento_hasta);

      let precioHtml;
      if (s.precio == null) precioHtml = '<em>Por definir</em>';
      else if (descTxt) precioHtml = '<s style="opacity:.55">' + SG.utils.formatCRC(s.precio) + '</s> ' + SG.utils.formatCRC(precioFinal) + ' <span class="admin-badge badge-pendiente">' + SG.utils.esc(descTxt) + '</span>';
      else precioHtml = SG.utils.formatCRC(s.precio);

      html += '<tr>' +
        '<td><img class="admin-thumb" src="' + SG.utils.esc(thumb) + '" alt="" onerror="this.src=\'img/placeholders/placeholder.svg\'"></td>' +
        '<td><strong>' + SG.utils.esc(s.nombre) + '</strong></td>' +
        '<td>' + (s.marca === 'yoshimi' ? 'Yoshimi' : 'Secret Garden') + '</td>' +
        '<td>' + SG.utils.esc(cat ? cat.nombre : '—') + '</td>' +
        '<td>' + precioHtml + '</td>' +
        '<td>' + s.duracion_min + ' min</td>' +
        '<td><span class="admin-badge badge-' + (s.activo ? 'activo' : 'inactivo') + '">' +
          (s.activo ? 'Activo' : 'Inactivo') + '</span></td>' +
        '<td class="col-actions">' +
          '<button class="admin-btn admin-btn-secondary admin-btn-sm" data-edit-serv="' + SG.utils.esc(s.id) + '">Editar</button> ' +
          '<button class="admin-btn admin-btn-danger admin-btn-sm" data-del-serv="' + SG.utils.esc(s.id) + '">Eliminar</button>' +
        '</td>' +
      '</tr>';
    });

    html += '</tbody></table></div>';
    cont.innerHTML = html;
  }

  // ------------------------------------------------------------
  function abrirFormulario(id) {
    editando = id ? servicios.find(function (s) { return s.id === id; }) : null;
    imagenesNuevas = [];
    imagenesExistentes = editando
      ? (imagenesMap[editando.id] || []).map(function (i) {
          return { id: i.id, path: i.path, orden: i.orden || 0, _eliminar: false };
        })
      : [];

    document.getElementById('serv-form-titulo').textContent = editando ? 'Editar servicio' : 'Nuevo servicio';
    renderFormulario();
    document.getElementById('serv-form-modal').classList.add('abierto');
  }

  function cerrarFormulario() {
    imagenesNuevas.forEach(function (n) { URL.revokeObjectURL(n.objectUrl); });
    imagenesNuevas = [];
    imagenesExistentes = [];
    editando = null;
    document.getElementById('serv-form-modal').classList.remove('abierto');
  }

  function renderFormulario() {
    const body = document.getElementById('serv-form-body');
    if (!body) return;

    const s = editando || {};
    const marca = s.marca || 'secret_garden';
    const catsMarca = categorias.filter(function (c) { return c.marca === marca; });

    body.innerHTML = '' +
      '<div class="admin-form-grid">' +
        '<div class="campo full">' +
          '<label for="s-nombre">Nombre</label>' +
          '<input type="text" id="s-nombre" maxlength="100" value="' + SG.utils.esc(s.nombre || '') + '">' +
        '</div>' +
        '<div class="campo">' +
          '<label for="s-marca">Marca</label>' +
          '<select id="s-marca">' +
            '<option value="secret_garden"' + (marca === 'secret_garden' ? ' selected' : '') + '>Secret Garden</option>' +
            '<option value="yoshimi"' + (marca === 'yoshimi' ? ' selected' : '') + '>Yoshimi</option>' +
          '</select>' +
        '</div>' +
        '<div class="campo">' +
          '<label for="s-cat">Categoría</label>' +
          '<select id="s-cat"><option value="">— Sin categoría —</option>' +
            catsMarca.map(function (c) {
              return '<option value="' + SG.utils.esc(c.id) + '"' + (c.id === s.categoria_id ? ' selected' : '') + '>' +
                SG.utils.esc(c.nombre) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="campo full">' +
          '<label for="s-desc">Descripción</label>' +
          '<textarea id="s-desc" rows="3">' + SG.utils.esc(s.descripcion || '') + '</textarea>' +
        '</div>' +
        '<div class="campo">' +
          '<label for="s-precio">Precio (₡)</label>' +
          '<input type="number" id="s-precio" min="0" step="100" value="' + (s.precio != null ? s.precio : '') + '" placeholder="Vacío = por definir">' +
        '</div>' +
        '<div class="campo">' +
          '<label for="s-duracion">Duración (min)</label>' +
          '<input type="number" id="s-duracion" min="5" step="5" value="' + (s.duracion_min || 60) + '">' +
        '</div>' +
        '<div class="campo">' +
          '<label for="s-orden">Orden</label>' +
          '<input type="number" id="s-orden" min="0" step="1" value="' + (s.orden || 0) + '">' +
        '</div>' +
        '<div class="campo">' +
          '<label style="display:flex;align-items:center;gap:.5rem">' +
            '<input type="checkbox" id="s-activo"' + ((s.activo !== false) ? ' checked' : '') + '> Activo' +
          '</label>' +
        '</div>' +
      '</div>' +

      '<h3 style="margin-top:1.5rem;color:var(--sg-verde);font-size:1rem">Descuento (opcional)</h3>' +
      '<div class="admin-form-grid">' +
        '<div class="campo">' +
          '<label for="s-desc-tipo">Tipo</label>' +
          '<select id="s-desc-tipo">' +
            '<option value="">Sin descuento</option>' +
            '<option value="porcentaje"' + (s.descuento_tipo === 'porcentaje' ? ' selected' : '') + '>Porcentaje (%)</option>' +
            '<option value="monto"' + (s.descuento_tipo === 'monto' ? ' selected' : '') + '>Monto (₡)</option>' +
          '</select>' +
        '</div>' +
        '<div class="campo">' +
          '<label for="s-desc-valor">Valor</label>' +
          '<input type="number" id="s-desc-valor" min="1" step="1" value="' + (s.descuento_valor || '') + '">' +
        '</div>' +
        '<div class="campo">' +
          '<label for="s-desc-hasta">Vigencia hasta</label>' +
          '<input type="date" id="s-desc-hasta" value="' + SG.utils.normalizarFecha(s.descuento_hasta || '') + '">' +
        '</div>' +
        '<div class="campo full">' +
          '<div id="s-precio-preview" style="padding:.65rem;background:var(--sg-rosa-claro);border-radius:6px;font-size:.9rem"></div>' +
        '</div>' +
      '</div>' +

      '<h3 style="margin-top:1.5rem;color:var(--sg-verde);font-size:1rem">Imágenes</h3>' +
      '<input type="file" id="s-imgs-input" accept="image/jpeg,image/png,image/webp" multiple>' +
      '<p class="admin-help">La primera imagen es la principal. Se comprimen a WebP (1200px máx).</p>' +
      '<div id="s-galeria" class="admin-galeria" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.6rem;margin-top:.75rem"></div>';

    // Enlazar eventos internos
    const marcaSel = document.getElementById('s-marca');
    marcaSel.addEventListener('change', function () {
      const cats2 = categorias.filter(function (c) { return c.marca === marcaSel.value; });
      const catSel = document.getElementById('s-cat');
      catSel.innerHTML = '<option value="">— Sin categoría —</option>' +
        cats2.map(function (c) {
          return '<option value="' + SG.utils.esc(c.id) + '">' + SG.utils.esc(c.nombre) + '</option>';
        }).join('');
    });

    ['s-precio', 's-desc-tipo', 's-desc-valor', 's-desc-hasta'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', actualizarPreview);
      if (el) el.addEventListener('change', actualizarPreview);
    });

    const input = document.getElementById('s-imgs-input');
    input.addEventListener('change', function () {
      const files = Array.from(input.files || []);
      files.forEach(function (f) {
        if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return;
        imagenesNuevas.push({ file: f, objectUrl: URL.createObjectURL(f) });
      });
      input.value = '';
      renderGaleria();
    });

    renderGaleria();
    actualizarPreview();
  }

  function actualizarPreview() {
    const p = document.getElementById('s-precio-preview');
    if (!p) return;
    const precio = parseFloat(document.getElementById('s-precio').value);
    const tipo = document.getElementById('s-desc-tipo').value;
    const valor = parseFloat(document.getElementById('s-desc-valor').value) || 0;
    const hasta = document.getElementById('s-desc-hasta').value || null;

    if (isNaN(precio) || precio < 0) {
      p.innerHTML = '<strong>Precio final:</strong> — (precio por definir)';
      return;
    }
    const final = SG.utils.precioFinal(precio, tipo || null, valor, hasta);
    if (tipo && valor > 0) {
      p.innerHTML = '<strong>Precio final:</strong> <s style="opacity:.55">' + SG.utils.formatCRC(precio) +
        '</s> ' + SG.utils.formatCRC(final);
    } else {
      p.innerHTML = '<strong>Precio final:</strong> ' + SG.utils.formatCRC(final);
    }
  }

  function renderGaleria() {
    const cont = document.getElementById('s-galeria');
    if (!cont) return;

    const partes = [];

    imagenesExistentes.forEach(function (img, idx) {
      const url = SG.utils.imgUrl(img.path);
      const claseExtra = img._eliminar ? ' style="opacity:.35;filter:grayscale(1)"' : '';
      partes.push(
        '<div class="admin-gal-item"' + claseExtra + '>' +
          '<img src="' + SG.utils.esc(url) + '" alt="" onerror="this.src=\'img/placeholders/placeholder.svg\'">' +
          '<div class="admin-gal-actions">' +
            (idx > 0 ? '<button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-move-up-ex="' + idx + '">↑</button>' : '') +
            (idx < imagenesExistentes.length - 1 ? '<button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-move-dn-ex="' + idx + '">↓</button>' : '') +
            '<button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-rm-img-ex="' + idx + '">' + (img._eliminar ? '↺' : '×') + '</button>' +
          '</div>' +
        '</div>'
      );
    });

    imagenesNuevas.forEach(function (n, idx) {
      partes.push(
        '<div class="admin-gal-item nueva">' +
          '<img src="' + SG.utils.esc(n.objectUrl) + '" alt="">' +
          '<div class="admin-gal-actions">' +
            '<button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-rm-img-new="' + idx + '">×</button>' +
          '</div>' +
          '<small style="position:absolute;bottom:-18px;left:0;right:0;text-align:center;font-size:.65rem;color:var(--sg-verde)">nueva</small>' +
        '</div>'
      );
    });

    cont.innerHTML = partes.join('') || '<p class="admin-help">Sin imágenes aún.</p>';
  }

  // ------------------------------------------------------------
  async function guardar() {
    const nombre = document.getElementById('s-nombre').value.trim();
    const marca = document.getElementById('s-marca').value;
    const categoria_id = document.getElementById('s-cat').value || null;
    const descripcion = document.getElementById('s-desc').value.trim();
    const precioRaw = document.getElementById('s-precio').value;
    const precio = precioRaw === '' ? null : parseInt(precioRaw, 10);
    const duracion_min = parseInt(document.getElementById('s-duracion').value, 10) || 60;
    const orden = parseInt(document.getElementById('s-orden').value, 10) || 0;
    const activo = document.getElementById('s-activo').checked;

    const desc_tipo = document.getElementById('s-desc-tipo').value || null;
    const desc_valor = desc_tipo ? (parseInt(document.getElementById('s-desc-valor').value, 10) || null) : null;
    const desc_hasta = desc_tipo ? (document.getElementById('s-desc-hasta').value || null) : null;

    if (!nombre) { SG.ui.toast('El nombre es obligatorio.', 'warning'); return; }
    if (precio !== null && precio < 0) { SG.ui.toast('El precio no puede ser negativo.', 'warning'); return; }
    if (desc_tipo && (!desc_valor || desc_valor <= 0)) { SG.ui.toast('El valor del descuento debe ser mayor a 0.', 'warning'); return; }

    const payload = {
      nombre: nombre,
      marca: marca,
      categoria_id: categoria_id,
      descripcion: descripcion,
      precio: precio,
      duracion_min: duracion_min,
      descuento_tipo: desc_tipo,
      descuento_valor: desc_valor,
      descuento_hasta: desc_hasta,
      orden: orden,
      activo: activo
    };

    const btn = document.getElementById('serv-save');
    btn.disabled = true; btn.textContent = 'Guardando…';

    try {
      let servId = editando ? editando.id : null;

      // 1) Insertar o actualizar servicio
      if (editando) {
        const res = await SG.sb.from('servicios').update(payload).eq('id', editando.id);
        if (res.error) throw res.error;
      } else {
        const res = await SG.sb.from('servicios').insert(payload).select().single();
        if (res.error) throw res.error;
        servId = res.data.id;
      }

      // 2) Borrar imágenes marcadas
      const aBorrar = imagenesExistentes.filter(function (i) { return i._eliminar; });
      for (const img of aBorrar) {
        await SG.sb.from('servicio_imagenes').delete().eq('id', img.id);
        await SG.admin.storage.borrar(img.path);
      }

      // 3) Reordenar existentes no borradas
      const existentesOk = imagenesExistentes.filter(function (i) { return !i._eliminar; });
      for (let i = 0; i < existentesOk.length; i++) {
        await SG.sb.from('servicio_imagenes').update({ orden: i }).eq('id', existentesOk[i].id);
      }

      // 4) Subir imágenes nuevas
      let ordenNueva = existentesOk.length;
      for (const n of imagenesNuevas) {
        const up = await SG.admin.storage.subir(n.file, 'servicios', servId, { maxLado: 1200 });
        const ins = await SG.sb.from('servicio_imagenes').insert({
          servicio_id: servId,
          path: up.path,
          orden: ordenNueva++
        });
        if (ins.error) console.error('[admin.servicios] insert imagen:', ins.error);
      }

      SG.ui.toast(editando ? 'Servicio actualizado.' : 'Servicio creado.', 'success');
      cerrarFormulario();
      recargar();
    } catch (err) {
      console.error('[admin.servicios] guardar error:', err);
      SG.ui.toast('No se pudo guardar el servicio.', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Guardar';
    }
  }

  async function eliminarServicio(id) {
    if (!confirm('¿Eliminar este servicio? Si ya tiene citas, se recomienda "desactivar" en lugar de eliminar.')) return;

    const imgs = imagenesMap[id] || [];
    // Borrar imágenes del storage
    for (const img of imgs) {
      await SG.admin.storage.borrar(img.path);
    }
    // Borrar servicio (cascade en imagenes)
    const res = await SG.sb.from('servicios').delete().eq('id', id);
    if (res.error) {
      SG.ui.toast('No se pudo eliminar (puede tener historial de pedidos).', 'error');
      console.error(res.error);
      return;
    }
    SG.ui.toast('Servicio eliminado.', 'success');
    recargar();
  }

  return { init: init };
})();