/* ============================================================
   Estética Secret Garden — admin-productos.js
   CRUD de productos con imágenes, descuento y agotado.
   ============================================================ */

window.SG = window.SG || {};
SG.admin = SG.admin || {};

SG.admin.productos = (function () {
  'use strict';

  let inicializado = false;
  let productos = [];
  let categorias = [];
  let imagenesMap = {};
  let filtroMarca = 'todas';
  let filtroCat = 'todas';
  let busqueda = '';

  let editando = null;
  let imagenesExistentes = [];
  let imagenesNuevas = [];

  function init() {
    if (inicializado) { recargar(); return; }
    inicializado = true;

    const panel = document.getElementById('panel-productos');
    if (!panel) return;
    panel.innerHTML = estructura();
    engancharEventos();
    recargar();
  }

  function estructura() {
    return '' +
      '<div class="panel-head">' +
        '<h2>Productos</h2>' +
        '<div class="panel-actions">' +
          '<button class="admin-btn admin-btn-primary" id="prod-new">+ Nuevo producto</button>' +
        '</div>' +
      '</div>' +
      '<div class="admin-filtros">' +
        '<input type="text" class="admin-filtro-select" id="prod-search" placeholder="Buscar…" style="flex:1;min-width:160px">' +
        '<select class="admin-filtro-select" id="prod-marca-filter">' +
          '<option value="todas">Todas las marcas</option>' +
          '<option value="secret_garden">Secret Garden</option>' +
          '<option value="yoshimi">Yoshimi</option>' +
        '</select>' +
        '<select class="admin-filtro-select" id="prod-cat-filter"><option value="todas">Todas las categorías</option></select>' +
      '</div>' +
      '<div id="prod-list"></div>' +

      '<div class="admin-modal" id="prod-form-modal">' +
        '<div class="admin-modal-card wide">' +
          '<div class="admin-modal-head">' +
            '<h2 id="prod-form-titulo">Nuevo producto</h2>' +
            '<button type="button" class="admin-modal-close" data-close-prod>×</button>' +
          '</div>' +
          '<div id="prod-form-body"></div>' +
          '<div class="admin-modal-actions">' +
            '<button type="button" class="admin-btn admin-btn-secondary" data-close-prod>Cancelar</button>' +
            '<button type="button" class="admin-btn admin-btn-primary" id="prod-save">Guardar</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function engancharEventos() {
    const panel = document.getElementById('panel-productos');
    if (!panel) return;

    panel.addEventListener('click', function (e) {
      if (e.target.id === 'prod-new') { abrirFormulario(null); return; }
      if (e.target.closest('[data-close-prod]')) { cerrarFormulario(); return; }
      if (e.target.id === 'prod-save') { guardar(); return; }

      const edit = e.target.closest('[data-edit-prod]');
      if (edit) { abrirFormulario(edit.dataset.editProd); return; }

      const del = e.target.closest('[data-del-prod]');
      if (del) { eliminarProducto(del.dataset.delProd); return; }

      const rmEx = e.target.closest('[data-rm-img-ex]');
      if (rmEx) {
        const idx = parseInt(rmEx.dataset.rmImgEx, 10);
        if (imagenesExistentes[idx]) {
          imagenesExistentes[idx]._eliminar = !imagenesExistentes[idx]._eliminar;
          renderGaleria();
        }
        return;
      }
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

    const search = document.getElementById('prod-search');
    if (search) search.addEventListener('input', function () { busqueda = search.value.toLowerCase(); render(); });

    const mf = document.getElementById('prod-marca-filter');
    if (mf) mf.addEventListener('change', function () { filtroMarca = mf.value; render(); });

    const cf = document.getElementById('prod-cat-filter');
    if (cf) cf.addEventListener('change', function () { filtroCat = cf.value; render(); });

    const modal = document.getElementById('prod-form-modal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) cerrarFormulario();
      });
    }
  }

  async function recargar() {
    const cont = document.getElementById('prod-list');
    if (cont) cont.innerHTML = '<div class="admin-loading">Cargando productos…</div>';
    if (!SG.sb) return;

    const [pRes, cRes, iRes] = await Promise.all([
      SG.sb.from('productos').select('*').order('marca', { ascending: true }).order('orden', { ascending: true }),
      SG.sb.from('categorias').select('*').eq('tipo', 'producto').eq('activa', true).order('orden', { ascending: true }),
      SG.sb.from('producto_imagenes').select('*').order('orden', { ascending: true })
    ]);

    if (pRes.error) {
      console.error('[admin.productos] error:', pRes.error);
      if (cont) cont.innerHTML = '<div class="admin-empty">Error al cargar productos.</div>';
      return;
    }

    productos = pRes.data || [];
    categorias = cRes.data || [];
    imagenesMap = {};
    (iRes.data || []).forEach(function (img) {
      if (!imagenesMap[img.producto_id]) imagenesMap[img.producto_id] = [];
      imagenesMap[img.producto_id].push(img);
    });

    poblarFiltroCategorias();
    render();
  }

  function poblarFiltroCategorias() {
    const sel = document.getElementById('prod-cat-filter');
    if (!sel) return;
    sel.innerHTML = '<option value="todas">Todas las categorías</option>' +
      categorias.map(function (c) {
        return '<option value="' + SG.utils.esc(c.id) + '">' + SG.utils.esc(c.nombre) + '</option>';
      }).join('');
    if (filtroCat !== 'todas') sel.value = filtroCat;
  }

  function render() {
    const cont = document.getElementById('prod-list');
    if (!cont) return;

    let lista = productos;
    if (filtroMarca !== 'todas') lista = lista.filter(function (p) { return p.marca === filtroMarca; });
    if (filtroCat !== 'todas') lista = lista.filter(function (p) { return p.categoria_id === filtroCat; });
    if (busqueda) lista = lista.filter(function (p) { return (p.nombre || '').toLowerCase().indexOf(busqueda) !== -1; });

    if (lista.length === 0) {
      cont.innerHTML = '<div class="admin-empty">No hay productos con esos filtros.</div>';
      return;
    }

    let html = '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
      '<th></th><th>Nombre</th><th>Marca</th><th>Precio</th><th>Estado</th>' +
      '<th class="col-actions">Acciones</th>' +
      '</tr></thead><tbody>';

    lista.forEach(function (p) {
      const imgs = imagenesMap[p.id] || [];
      const thumb = imgs.length > 0 ? SG.utils.imgUrl(imgs[0].path) : 'img/placeholders/placeholder.svg';
      const precioFinal = SG.utils.precioFinal(p.precio, p.descuento_tipo, p.descuento_valor, p.descuento_hasta);
      const descTxt = SG.utils.descuentoTexto(p.descuento_tipo, p.descuento_valor, p.descuento_hasta);

      let precioHtml;
      if (descTxt) precioHtml = '<s style="opacity:.55">' + SG.utils.formatCRC(p.precio) + '</s> ' + SG.utils.formatCRC(precioFinal) + ' <span class="admin-badge badge-pendiente">' + SG.utils.esc(descTxt) + '</span>';
      else precioHtml = SG.utils.formatCRC(p.precio);

      html += '<tr>' +
        '<td><img class="admin-thumb" src="' + SG.utils.esc(thumb) + '" alt="" onerror="this.src=\'img/placeholders/placeholder.svg\'"></td>' +
        '<td><strong>' + SG.utils.esc(p.nombre) + '</strong>' + (p.agotado ? ' <span class="admin-badge badge-cancelada">Agotado</span>' : '') + '</td>' +
        '<td>' + (p.marca === 'yoshimi' ? 'Yoshimi' : 'Secret Garden') + '</td>' +
        '<td>' + precioHtml + '</td>' +
        '<td><span class="admin-badge badge-' + (p.activo ? 'activo' : 'inactivo') + '">' + (p.activo ? 'Activo' : 'Inactivo') + '</span></td>' +
        '<td class="col-actions">' +
          '<button class="admin-btn admin-btn-secondary admin-btn-sm" data-edit-prod="' + SG.utils.esc(p.id) + '">Editar</button> ' +
          '<button class="admin-btn admin-btn-danger admin-btn-sm" data-del-prod="' + SG.utils.esc(p.id) + '">Eliminar</button>' +
        '</td>' +
      '</tr>';
    });

    html += '</tbody></table></div>';
    cont.innerHTML = html;
  }

  // ------------------------------------------------------------
  function abrirFormulario(id) {
    editando = id ? productos.find(function (p) { return p.id === id; }) : null;
    imagenesNuevas = [];
    imagenesExistentes = editando
      ? (imagenesMap[editando.id] || []).map(function (i) {
          return { id: i.id, path: i.path, orden: i.orden || 0, _eliminar: false };
        })
      : [];

    document.getElementById('prod-form-titulo').textContent = editando ? 'Editar producto' : 'Nuevo producto';
    renderFormulario();
    document.getElementById('prod-form-modal').classList.add('abierto');
  }

  function cerrarFormulario() {
    imagenesNuevas.forEach(function (n) { URL.revokeObjectURL(n.objectUrl); });
    imagenesNuevas = []; imagenesExistentes = []; editando = null;
    document.getElementById('prod-form-modal').classList.remove('abierto');
  }

  function renderFormulario() {
    const body = document.getElementById('prod-form-body');
    if (!body) return;
    const p = editando || {};
    const marca = p.marca || 'secret_garden';
    const catsMarca = categorias.filter(function (c) { return c.marca === marca; });

    body.innerHTML = '' +
      '<div class="admin-form-grid">' +
        '<div class="campo full">' +
          '<label for="p-nombre">Nombre</label>' +
          '<input type="text" id="p-nombre" maxlength="120" value="' + SG.utils.esc(p.nombre || '') + '">' +
        '</div>' +
        '<div class="campo">' +
          '<label for="p-marca">Marca</label>' +
          '<select id="p-marca">' +
            '<option value="secret_garden"' + (marca === 'secret_garden' ? ' selected' : '') + '>Secret Garden</option>' +
            '<option value="yoshimi"' + (marca === 'yoshimi' ? ' selected' : '') + '>Yoshimi</option>' +
          '</select>' +
        '</div>' +
        '<div class="campo">' +
          '<label for="p-cat">Categoría</label>' +
          '<select id="p-cat"><option value="">— Sin categoría —</option>' +
            catsMarca.map(function (c) {
              return '<option value="' + SG.utils.esc(c.id) + '"' + (c.id === p.categoria_id ? ' selected' : '') + '>' + SG.utils.esc(c.nombre) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="campo full">' +
          '<label for="p-desc">Descripción</label>' +
          '<textarea id="p-desc" rows="3">' + SG.utils.esc(p.descripcion || '') + '</textarea>' +
        '</div>' +
        '<div class="campo">' +
          '<label for="p-precio">Precio (₡) *</label>' +
          '<input type="number" id="p-precio" min="0" step="100" value="' + (p.precio != null ? p.precio : '') + '">' +
        '</div>' +
        '<div class="campo">' +
          '<label for="p-orden">Orden</label>' +
          '<input type="number" id="p-orden" min="0" step="1" value="' + (p.orden || 0) + '">' +
        '</div>' +
        '<div class="campo">' +
          '<label style="display:flex;align-items:center;gap:.5rem">' +
            '<input type="checkbox" id="p-activo"' + ((p.activo !== false) ? ' checked' : '') + '> Activo' +
          '</label>' +
        '</div>' +
        '<div class="campo">' +
          '<label style="display:flex;align-items:center;gap:.5rem">' +
            '<input type="checkbox" id="p-agotado"' + (p.agotado ? ' checked' : '') + '> Agotado' +
          '</label>' +
        '</div>' +
      '</div>' +

      '<h3 style="margin-top:1.5rem;color:var(--sg-verde);font-size:1rem">Descuento (opcional)</h3>' +
      '<div class="admin-form-grid">' +
        '<div class="campo">' +
          '<label for="p-desc-tipo">Tipo</label>' +
          '<select id="p-desc-tipo">' +
            '<option value="">Sin descuento</option>' +
            '<option value="porcentaje"' + (p.descuento_tipo === 'porcentaje' ? ' selected' : '') + '>Porcentaje (%)</option>' +
            '<option value="monto"' + (p.descuento_tipo === 'monto' ? ' selected' : '') + '>Monto (₡)</option>' +
          '</select>' +
        '</div>' +
        '<div class="campo"><label for="p-desc-valor">Valor</label>' +
          '<input type="number" id="p-desc-valor" min="1" step="1" value="' + (p.descuento_valor || '') + '"></div>' +
        '<div class="campo"><label for="p-desc-hasta">Vigencia hasta</label>' +
          '<input type="date" id="p-desc-hasta" value="' + SG.utils.normalizarFecha(p.descuento_hasta || '') + '"></div>' +
        '<div class="campo full">' +
          '<div id="p-precio-preview" style="padding:.65rem;background:var(--sg-rosa-claro);border-radius:6px;font-size:.9rem"></div>' +
        '</div>' +
      '</div>' +

      '<h3 style="margin-top:1.5rem;color:var(--sg-verde);font-size:1rem">Imágenes</h3>' +
      '<input type="file" id="p-imgs-input" accept="image/jpeg,image/png,image/webp" multiple>' +
      '<p class="admin-help">La primera imagen es la principal. Se comprimen a WebP (1200px máx).</p>' +
      '<div id="p-galeria" class="admin-galeria" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.6rem;margin-top:.75rem"></div>';

    document.getElementById('p-marca').addEventListener('change', function (e) {
      const cats2 = categorias.filter(function (c) { return c.marca === e.target.value; });
      document.getElementById('p-cat').innerHTML = '<option value="">— Sin categoría —</option>' +
        cats2.map(function (c) {
          return '<option value="' + SG.utils.esc(c.id) + '">' + SG.utils.esc(c.nombre) + '</option>';
        }).join('');
    });

    ['p-precio', 'p-desc-tipo', 'p-desc-valor', 'p-desc-hasta'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) { el.addEventListener('input', actualizarPreview); el.addEventListener('change', actualizarPreview); }
    });

    const input = document.getElementById('p-imgs-input');
    input.addEventListener('change', function () {
      Array.from(input.files || []).forEach(function (f) {
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
    const el = document.getElementById('p-precio-preview');
    if (!el) return;
    const precio = parseFloat(document.getElementById('p-precio').value);
    const tipo = document.getElementById('p-desc-tipo').value;
    const valor = parseFloat(document.getElementById('p-desc-valor').value) || 0;
    const hasta = document.getElementById('p-desc-hasta').value || null;
    if (isNaN(precio) || precio < 0) { el.innerHTML = '<strong>Precio final:</strong> —'; return; }
    const final = SG.utils.precioFinal(precio, tipo || null, valor, hasta);
    if (tipo && valor > 0) {
      el.innerHTML = '<strong>Precio final:</strong> <s style="opacity:.55">' + SG.utils.formatCRC(precio) + '</s> ' + SG.utils.formatCRC(final);
    } else {
      el.innerHTML = '<strong>Precio final:</strong> ' + SG.utils.formatCRC(final);
    }
  }

  function renderGaleria() {
    const cont = document.getElementById('p-galeria');
    if (!cont) return;
    const partes = [];

    imagenesExistentes.forEach(function (img, idx) {
      const url = SG.utils.imgUrl(img.path);
      const clase = img._eliminar ? ' style="opacity:.35;filter:grayscale(1)"' : '';
      partes.push(
        '<div class="admin-gal-item"' + clase + '>' +
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
    const nombre = document.getElementById('p-nombre').value.trim();
    const marca = document.getElementById('p-marca').value;
    const categoria_id = document.getElementById('p-cat').value || null;
    const descripcion = document.getElementById('p-desc').value.trim();
    const precio = parseInt(document.getElementById('p-precio').value, 10);
    const orden = parseInt(document.getElementById('p-orden').value, 10) || 0;
    const activo = document.getElementById('p-activo').checked;
    const agotado = document.getElementById('p-agotado').checked;

    const desc_tipo = document.getElementById('p-desc-tipo').value || null;
    const desc_valor = desc_tipo ? (parseInt(document.getElementById('p-desc-valor').value, 10) || null) : null;
    const desc_hasta = desc_tipo ? (document.getElementById('p-desc-hasta').value || null) : null;

    if (!nombre) { SG.ui.toast('El nombre es obligatorio.', 'warning'); return; }
    if (isNaN(precio) || precio < 0) { SG.ui.toast('El precio es obligatorio y debe ser ≥ 0.', 'warning'); return; }
    if (desc_tipo && (!desc_valor || desc_valor <= 0)) { SG.ui.toast('Valor de descuento inválido.', 'warning'); return; }

    const payload = {
      nombre, marca, categoria_id, descripcion, precio, orden, activo, agotado,
      descuento_tipo: desc_tipo, descuento_valor: desc_valor, descuento_hasta: desc_hasta
    };

    const btn = document.getElementById('prod-save');
    btn.disabled = true; btn.textContent = 'Guardando…';

    try {
      let prodId = editando ? editando.id : null;

      if (editando) {
        const res = await SG.sb.from('productos').update(payload).eq('id', editando.id);
        if (res.error) throw res.error;
      } else {
        const res = await SG.sb.from('productos').insert(payload).select().single();
        if (res.error) throw res.error;
        prodId = res.data.id;
      }

      const aBorrar = imagenesExistentes.filter(function (i) { return i._eliminar; });
      for (const img of aBorrar) {
        await SG.sb.from('producto_imagenes').delete().eq('id', img.id);
        await SG.admin.storage.borrar(img.path);
      }

      const existentesOk = imagenesExistentes.filter(function (i) { return !i._eliminar; });
      for (let i = 0; i < existentesOk.length; i++) {
        await SG.sb.from('producto_imagenes').update({ orden: i }).eq('id', existentesOk[i].id);
      }

      let ordenNueva = existentesOk.length;
      for (const n of imagenesNuevas) {
        const up = await SG.admin.storage.subir(n.file, 'productos', prodId, { maxLado: 1200 });
        await SG.sb.from('producto_imagenes').insert({
          producto_id: prodId, path: up.path, orden: ordenNueva++
        });
      }

      SG.ui.toast(editando ? 'Producto actualizado.' : 'Producto creado.', 'success');
      cerrarFormulario();
      recargar();
    } catch (err) {
      console.error('[admin.productos] guardar error:', err);
      SG.ui.toast('No se pudo guardar el producto.', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Guardar';
    }
  }

  async function eliminarProducto(id) {
    if (!confirm('¿Eliminar este producto? Si ya tiene historial de pedidos, se recomienda desactivarlo.')) return;
    const imgs = imagenesMap[id] || [];
    for (const img of imgs) await SG.admin.storage.borrar(img.path);
    const res = await SG.sb.from('productos').delete().eq('id', id);
    if (res.error) {
      SG.ui.toast('No se pudo eliminar.', 'error');
      console.error(res.error);
      return;
    }
    SG.ui.toast('Producto eliminado.', 'success');
    recargar();
  }

  return { init: init };
})();