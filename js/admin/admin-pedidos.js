/* ============================================================
   Estética Secret Garden — admin-pedidos.js
   Lista de pedidos, detalle expandible y cambio de estado.
   ============================================================ */

window.SG = window.SG || {};
SG.admin = SG.admin || {};

SG.admin.pedidos = (function () {
  'use strict';

  let inicializado = false;
  let filtroEstado = 'todos';
  let pedidosCache = [];
  let itemsCache = {};      // { pedido_id: [items] }
  let expandidos = {};      // { pedido_id: true }

  // ------------------------------------------------------------
  function init() {
    if (inicializado) { recargar(); return; }
    inicializado = true;

    const panel = document.getElementById('panel-pedidos');
    if (!panel) return;
    panel.innerHTML = estructura();
    engancharEventos();
    recargar();
  }

  function estructura() {
    return '' +
      '<div class="panel-head">' +
        '<h2>Pedidos</h2>' +
        '<div class="panel-actions">' +
          '<select class="admin-filtro-select" id="pedidos-filtro">' +
            '<option value="todos">Todos los estados</option>' +
            '<option value="pendiente">Pendientes</option>' +
            '<option value="confirmado">Confirmados</option>' +
            '<option value="completado">Completados</option>' +
            '<option value="cancelado">Cancelados</option>' +
          '</select>' +
        '</div>' +
      '</div>' +
      '<div id="pedidos-lista"></div>';
  }

  function engancharEventos() {
    const panel = document.getElementById('panel-pedidos');
    if (!panel) return;

    const sel = document.getElementById('pedidos-filtro');
    if (sel) {
      sel.addEventListener('change', function () {
        filtroEstado = sel.value;
        render();
      });
    }

    panel.addEventListener('click', function (e) {
      const toggle = e.target.closest('[data-toggle-pedido]');
      if (toggle) {
        const id = toggle.dataset.togglePedido;
        expandidos[id] = !expandidos[id];
        render();
        return;
      }
      const del = e.target.closest('[data-del-pedido]');
      if (del) {
        eliminarPedido(del.dataset.delPedido);
        return;
      }
    });

    panel.addEventListener('change', function (e) {
      const sel = e.target.closest('[data-pedido-estado]');
      if (!sel) return;
      const id = sel.dataset.pedidoEstado;
      cambiarEstado(id, sel.value);
    });
  }

  // ------------------------------------------------------------
  // Detecta si el error de PostgREST es de sesión / JWT vencido
  // ------------------------------------------------------------
  function esErrorDeSesion(error) {
    if (!error) return false;
    const code = String(error.code || '');
    const msg = String(error.message || '').toLowerCase();
    return code === 'PGRST301'
      || code === '401'
      || msg.indexOf('jwt') !== -1
      || msg.indexOf('not authorized') !== -1
      || msg.indexOf('unauthorized') !== -1
      || msg.indexOf('token') !== -1;
  }

  // ------------------------------------------------------------
  // Carga de pedidos + ítems
  // ------------------------------------------------------------
  async function recargar() {
    const cont = document.getElementById('pedidos-lista');
    if (cont) cont.innerHTML = '<div class="admin-loading">Cargando pedidos…</div>';

    if (!SG.sb) {
      if (cont) cont.innerHTML = '<div class="admin-empty">Supabase no está configurado.</div>';
      return;
    }

    // Verificación de sesión antes de tocar la tabla
    try {
      const ok = await SG.admin.auth.ensureSession();
      if (!ok) {
        if (cont) cont.innerHTML =
          '<div class="admin-empty">Tu sesión expiró. Cerrá sesión y volvé a entrar.</div>';
        return;
      }
    } catch (err) {
      console.error('[admin.pedidos] ensureSession falló:', err);
      if (cont) cont.innerHTML = '<div class="admin-empty">No se pudo verificar la sesión.</div>';
      return;
    }

    // 1) Pedidos
    const pRes = await SG.sb
      .from('pedidos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (pRes.error) {
      console.error('[admin.pedidos] error pedidos:', pRes.error);

      if (esErrorDeSesion(pRes.error)) {
        if (cont) cont.innerHTML =
          '<div class="admin-empty">Sesión expirada. Cerrá sesión y volvé a entrar.</div>';
        return;
      }

      if (cont) {
        cont.innerHTML = '<div class="admin-empty">No se pudieron cargar los pedidos.<br>' +
          '<small style="color:var(--sg-gris)">' +
          SG.utils.esc(pRes.error.message || pRes.error.code || 'Error desconocido') +
          '</small></div>';
      }
      return;
    }

    pedidosCache = pRes.data || [];
    itemsCache = {};

    // 2) Ítems de esos pedidos (si hay)
    if (pedidosCache.length > 0) {
      const ids = pedidosCache.map(function (p) { return p.id; });
      const iRes = await SG.sb.from('pedido_items').select('*').in('pedido_id', ids);
      if (iRes.error) {
        console.warn('[admin.pedidos] error ítems:', iRes.error);
      } else {
        (iRes.data || []).forEach(function (it) {
          if (!itemsCache[it.pedido_id]) itemsCache[it.pedido_id] = [];
          itemsCache[it.pedido_id].push(it);
        });
      }
    }

    render();
  }

  // ------------------------------------------------------------
  // Render de la lista
  // ------------------------------------------------------------
  function render() {
    const cont = document.getElementById('pedidos-lista');
    if (!cont) return;

    let lista = pedidosCache;
    if (filtroEstado !== 'todos') {
      lista = lista.filter(function (p) { return p.estado === filtroEstado; });
    }

    if (lista.length === 0) {
      const esVacioTotal = pedidosCache.length === 0;
      const msg = esVacioTotal
        ? 'Aún no hay pedidos. Cuando un cliente confirme uno, va a aparecer aquí.'
        : 'No hay pedidos con el filtro «' + capitalizar(filtroEstado) + '».';
      cont.innerHTML = '<div class="admin-empty">' + SG.utils.esc(msg) + '</div>';
      return;
    }

    let html = '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
      '<th>Código</th><th>Cliente</th><th>Teléfono</th><th>Pago</th><th>Total</th>' +
      '<th>Estado</th><th>Fecha</th><th class="col-actions"></th>' +
      '</tr></thead><tbody>';

    lista.forEach(function (p) {
      const abierto = !!expandidos[p.id];
      html += '<tr>' +
        '<td><strong>' + SG.utils.esc(p.codigo) + '</strong></td>' +
        '<td>' + SG.utils.esc(p.nombre) + '</td>' +
        '<td><a href="https://wa.me/506' + SG.utils.esc(p.telefono) + '" target="_blank" rel="noopener">' + SG.utils.esc(p.telefono) + '</a></td>' +
        '<td>' + (p.metodo_pago === 'sinpe' ? 'SINPE' : 'Efectivo') + '</td>' +
        '<td>' + SG.utils.formatCRC(p.total) + '</td>' +
        '<td>' +
          '<select data-pedido-estado="' + SG.utils.esc(p.id) + '" class="admin-filtro-select" style="font-size:.78rem;padding:.25rem .5rem">' +
            opcion('pendiente', p.estado) +
            opcion('confirmado', p.estado) +
            opcion('completado', p.estado) +
            opcion('cancelado', p.estado) +
          '</select>' +
        '</td>' +
        '<td>' + SG.utils.esc(fmtFechaHora(p.created_at)) + '</td>' +
        '<td class="col-actions">' +
          '<button class="admin-btn admin-btn-secondary admin-btn-sm" data-toggle-pedido="' + SG.utils.esc(p.id) + '">' + (abierto ? 'Ocultar' : 'Ver') + '</button> ' +
          '<button class="admin-btn admin-btn-danger admin-btn-sm" data-del-pedido="' + SG.utils.esc(p.id) + '">Eliminar</button>' +
        '</td>' +
      '</tr>';

      if (abierto) {
        html += '<tr><td colspan="8" style="background:#fdfaf3;padding:1rem">' +
          renderDetalle(p, itemsCache[p.id] || []) +
        '</td></tr>';
      }
    });

    html += '</tbody></table></div>';
    cont.innerHTML = html;
  }

  function opcion(valor, actual) {
    return '<option value="' + valor + '"' + (valor === actual ? ' selected' : '') + '>' +
      capitalizar(valor) + '</option>';
  }

  function renderDetalle(p, items) {
    if (items.length === 0) return '<em>Sin ítems registrados.</em>';

    let html = '<div style="display:grid;gap:.5rem">';
    items.forEach(function (it) {
      if (it.tipo === 'servicio') {
        html += '<div class="admin-card" style="margin:0;padding:.75rem">' +
          '<strong>📅 ' + SG.utils.esc(it.nombre) + '</strong> ' +
          '<span style="color:var(--sg-gris);font-size:.85rem">(' +
          (it.marca === 'yoshimi' ? 'Yoshimi' : 'Secret Garden') + ')</span><br>' +
          '<small>' + SG.utils.esc(SG.utils.diaSemanaLargo(it.fecha) + ' ' + SG.utils.fmtFecha(it.fecha)) +
          ' a las ' + SG.utils.fmtHora12(it.hora) + ' · ' + it.duracion_min + ' min · ' +
          'Estado: <strong>' + SG.utils.esc(it.estado_cita || 'pendiente') + '</strong></small>' +
          '<br><small>' +
          (it.precio_unitario == null ? '<em>Precio por confirmar</em>' : SG.utils.formatCRC(it.precio_unitario)) +
          '</small>' +
        '</div>';
      } else {
        html += '<div class="admin-card" style="margin:0;padding:.75rem">' +
          '<strong>🛍️ ' + SG.utils.esc(it.nombre) + ' × ' + it.cantidad + '</strong> ' +
          '<span style="color:var(--sg-gris);font-size:.85rem">(' +
          (it.marca === 'yoshimi' ? 'Yoshimi' : 'Secret Garden') + ')</span><br>' +
          '<small>' + SG.utils.formatCRC((it.precio_unitario || 0) * it.cantidad) + '</small>' +
        '</div>';
      }
    });
    if (p.notas) {
      html += '<div><strong>Notas:</strong> ' + SG.utils.esc(p.notas) + '</div>';
    }
    html += '</div>';
    return html;
  }

  // ------------------------------------------------------------
  // Cambiar estado de un pedido
  // ------------------------------------------------------------
  async function cambiarEstado(id, estado) {
    if (!SG.sb) return;
    const res = await SG.sb.from('pedidos').update({ estado: estado }).eq('id', id);
    if (res.error) {
      SG.ui.toast('No se pudo actualizar el estado.', 'error');
      console.error(res.error);
      return;
    }
    SG.ui.toast('Estado actualizado.', 'success');
    const p = pedidosCache.find(function (x) { return x.id === id; });
    if (p) p.estado = estado;
  }

  // ------------------------------------------------------------
  // Eliminar un pedido
  // ------------------------------------------------------------
  async function eliminarPedido(id) {
    if (!confirm('¿Eliminar este pedido? Se eliminarán también sus ítems.')) return;

    const res = await SG.sb.from('pedidos').delete().eq('id', id);
    if (res.error) {
      SG.ui.toast('No se pudo eliminar.', 'error');
      console.error(res.error);
      return;
    }

    SG.ui.toast('Pedido eliminado.', 'success');
    delete expandidos[id];
    delete itemsCache[id];
    recargar();
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  function fmtFechaHora(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts).slice(0, 16);
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() +
           ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function pad2(n) { return String(n).padStart(2, '0'); }
  function capitalizar(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  return { init: init };
})();