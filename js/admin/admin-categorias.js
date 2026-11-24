/* ============================================================
   Estética Secret Garden — admin-categorias.js
   CRUD simple de categorías de servicios y productos.
   ============================================================ */

window.SG = window.SG || {};
SG.admin = SG.admin || {};

SG.admin.categorias = (function () {
  'use strict';

  let inicializado = false;
  let categorias = [];
  let editando = null;    // null = nuevo; objeto = editando
  let filtroMarca = 'todas';
  let filtroTipo = 'todos';

  function init() {
    if (inicializado) { recargar(); return; }
    inicializado = true;

    const panel = document.getElementById('panel-categorias');
    if (!panel) return;
    panel.innerHTML = estructura();
    engancharEventos();
    recargar();
  }

  function estructura() {
    return '' +
      '<div class="panel-head">' +
        '<h2>Categorías</h2>' +
        '<div class="panel-actions">' +
          '<button class="admin-btn admin-btn-primary" id="cat-new">+ Nueva categoría</button>' +
        '</div>' +
      '</div>' +

      '<div class="admin-filtros">' +
        '<select class="admin-filtro-select" id="cat-marca-filter">' +
          '<option value="todas">Todas las marcas</option>' +
          '<option value="secret_garden">Secret Garden</option>' +
          '<option value="yoshimi">Yoshimi</option>' +
        '</select>' +
        '<select class="admin-filtro-select" id="cat-tipo-filter">' +
          '<option value="todos">Todos los tipos</option>' +
          '<option value="servicio">Servicio</option>' +
          '<option value="producto">Producto</option>' +
        '</select>' +
      '</div>' +

      '<div id="cat-list"></div>' +

      '<div class="admin-modal" id="cat-form-modal">' +
        '<div class="admin-modal-card">' +
          '<div class="admin-modal-head">' +
            '<h2 id="cat-form-titulo">Nueva categoría</h2>' +
            '<button type="button" class="admin-modal-close" data-close-cat>×</button>' +
          '</div>' +
          '<div class="admin-form-grid">' +
            '<div class="campo">' +
              '<label for="cat-nombre">Nombre</label>' +
              '<input type="text" id="cat-nombre" maxlength="80">' +
            '</div>' +
            '<div class="campo">' +
              '<label for="cat-marca">Marca</label>' +
              '<select id="cat-marca">' +
                '<option value="secret_garden">Secret Garden</option>' +
                '<option value="yoshimi">Yoshimi</option>' +
              '</select>' +
            '</div>' +
            '<div class="campo">' +
              '<label for="cat-tipo">Tipo</label>' +
              '<select id="cat-tipo">' +
                '<option value="servicio">Servicio</option>' +
                '<option value="producto">Producto</option>' +
              '</select>' +
            '</div>' +
            '<div class="campo">' +
              '<label for="cat-orden">Orden</label>' +
              '<input type="number" id="cat-orden" min="0" step="1" value="0">' +
            '</div>' +
            '<div class="campo full">' +
              '<label style="display:flex;align-items:center;gap:.5rem">' +
                '<input type="checkbox" id="cat-activa" checked> Activa' +
              '</label>' +
            '</div>' +
          '</div>' +
          '<div class="admin-modal-actions">' +
            '<button type="button" class="admin-btn admin-btn-secondary" data-close-cat>Cancelar</button>' +
            '<button type="button" class="admin-btn admin-btn-primary" id="cat-save">Guardar</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function engancharEventos() {
    const panel = document.getElementById('panel-categorias');
    if (!panel) return;

    panel.addEventListener('click', function (e) {
      if (e.target.id === 'cat-new') { abrirFormulario(null); return; }
      if (e.target.closest('[data-close-cat]')) { cerrarFormulario(); return; }
      if (e.target.id === 'cat-save') { guardar(); return; }

      const editar = e.target.closest('[data-edit-cat]');
      if (editar) { abrirFormulario(editar.dataset.editCat); return; }

      const eliminar = e.target.closest('[data-del-cat]');
      if (eliminar) { eliminarCategoria(eliminar.dataset.delCat); return; }
    });

    const mf = document.getElementById('cat-marca-filter');
    if (mf) mf.addEventListener('change', function () { filtroMarca = mf.value; render(); });

    const tf = document.getElementById('cat-tipo-filter');
    if (tf) tf.addEventListener('change', function () { filtroTipo = tf.value; render(); });

    const modal = document.getElementById('cat-form-modal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) cerrarFormulario();
      });
    }
  }

  async function recargar() {
    const cont = document.getElementById('cat-list');
    if (cont) cont.innerHTML = '<div class="admin-loading">Cargando categorías…</div>';

    if (!SG.sb) return;
    const res = await SG.sb.from('categorias').select('*')
      .order('marca', { ascending: true })
      .order('tipo', { ascending: true })
      .order('orden', { ascending: true });

    if (res.error) {
      console.error('[admin.categorias] error:', res.error);
      if (cont) cont.innerHTML = '<div class="admin-empty">Error al cargar.</div>';
      return;
    }
    categorias = res.data || [];
    render();
  }

  function render() {
    const cont = document.getElementById('cat-list');
    if (!cont) return;

    let lista = categorias;
    if (filtroMarca !== 'todas') lista = lista.filter(function (c) { return c.marca === filtroMarca; });
    if (filtroTipo !== 'todos') lista = lista.filter(function (c) { return c.tipo === filtroTipo; });

    if (lista.length === 0) {
      cont.innerHTML = '<div class="admin-empty">No hay categorías que mostrar.</div>';
      return;
    }

    let html = '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
      '<th>Nombre</th><th>Marca</th><th>Tipo</th><th>Orden</th><th>Estado</th>' +
      '<th class="col-actions">Acciones</th>' +
      '</tr></thead><tbody>';

    lista.forEach(function (c) {
      html += '<tr>' +
        '<td>' + SG.utils.esc(c.nombre) + '</td>' +
        '<td>' + (c.marca === 'yoshimi' ? 'Yoshimi' : 'Secret Garden') + '</td>' +
        '<td>' + (c.tipo === 'servicio' ? 'Servicio' : 'Producto') + '</td>' +
        '<td>' + c.orden + '</td>' +
        '<td><span class="admin-badge badge-' + (c.activa ? 'activo' : 'inactivo') + '">' +
          (c.activa ? 'Activa' : 'Inactiva') + '</span></td>' +
        '<td class="col-actions">' +
          '<button class="admin-btn admin-btn-secondary admin-btn-sm" data-edit-cat="' + SG.utils.esc(c.id) + '">Editar</button> ' +
          '<button class="admin-btn admin-btn-danger admin-btn-sm" data-del-cat="' + SG.utils.esc(c.id) + '">Eliminar</button>' +
        '</td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
    cont.innerHTML = html;
  }

  // ------------------------------------------------------------
  function abrirFormulario(id) {
    editando = id ? categorias.find(function (c) { return c.id === id; }) : null;

    document.getElementById('cat-form-titulo').textContent = editando ? 'Editar categoría' : 'Nueva categoría';
    document.getElementById('cat-nombre').value = editando ? editando.nombre : '';
    document.getElementById('cat-marca').value = editando ? editando.marca : 'secret_garden';
    document.getElementById('cat-tipo').value = editando ? editando.tipo : 'servicio';
    document.getElementById('cat-orden').value = editando ? editando.orden : 0;
    document.getElementById('cat-activa').checked = editando ? editando.activa : true;

    document.getElementById('cat-form-modal').classList.add('abierto');
  }

  function cerrarFormulario() {
    document.getElementById('cat-form-modal').classList.remove('abierto');
    editando = null;
  }

  async function guardar() {
    const nombre = document.getElementById('cat-nombre').value.trim();
    const marca = document.getElementById('cat-marca').value;
    const tipo = document.getElementById('cat-tipo').value;
    const orden = parseInt(document.getElementById('cat-orden').value, 10) || 0;
    const activa = document.getElementById('cat-activa').checked;

    if (!nombre) { SG.ui.toast('El nombre es obligatorio.', 'warning'); return; }

    const payload = { nombre: nombre, marca: marca, tipo: tipo, orden: orden, activa: activa };
    const btn = document.getElementById('cat-save');
    btn.disabled = true; btn.textContent = 'Guardando…';

    const res = editando
      ? await SG.sb.from('categorias').update(payload).eq('id', editando.id)
      : await SG.sb.from('categorias').insert(payload);

    btn.disabled = false; btn.textContent = 'Guardar';

    if (res.error) {
      SG.ui.toast('No se pudo guardar.', 'error');
      console.error(res.error);
      return;
    }
    SG.ui.toast(editando ? 'Categoría actualizada.' : 'Categoría creada.', 'success');
    cerrarFormulario();
    recargar();
  }

  async function eliminarCategoria(id) {
    if (!confirm('¿Eliminar esta categoría? Los servicios/productos que la usen quedarán sin categoría.')) return;
    const res = await SG.sb.from('categorias').delete().eq('id', id);
    if (res.error) {
      SG.ui.toast('No se pudo eliminar.', 'error');
      console.error(res.error);
      return;
    }
    SG.ui.toast('Categoría eliminada.', 'success');
    recargar();
  }

  return { init: init };
})();