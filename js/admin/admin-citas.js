/* ============================================================
   Estética Secret Garden — admin-citas.js
   Lista, calendario mes y semana de citas + acciones de estado.
   ============================================================ */

window.SG = window.SG || {};
SG.admin = SG.admin || {};

SG.admin.citas = (function () {
  'use strict';

  let inicializado = false;
  let rangoActual = 'hoy';           // 'hoy' | 'semana' | 'proximas' | 'pendientes'
  let vistaActual = 'lista';          // 'lista' | 'mes' | 'semana'
  let filtroMarca = 'todas';
  let citasCache = [];                // pedido_items con datos de pedido
  let mesCal = null;                  // { year, month }
  let semanaCal = null;               // Date del lunes

  const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  // ------------------------------------------------------------
  function init() {
    if (inicializado) { recargar(); return; }
    inicializado = true;

    const panel = document.getElementById('panel-citas');
    if (!panel) return;
    panel.innerHTML = estructura();
    engancharEventos();

    const hoy = new Date();
    mesCal = { year: hoy.getFullYear(), month: hoy.getMonth() };
    semanaCal = lunesDe(hoy);

    recargar();
  }

  function estructura() {
    return '' +
      '<div class="panel-head">' +
        '<h2>Citas</h2>' +
        '<div class="panel-actions">' +
          '<div class="admin-filtros" style="margin:0">' +
            '<button class="admin-filtro-btn active" data-rango="hoy">Hoy</button>' +
            '<button class="admin-filtro-btn" data-rango="semana">Esta semana</button>' +
            '<button class="admin-filtro-btn" data-rango="proximas">Próximas (3 meses)</button>' +
            '<button class="admin-filtro-btn" data-rango="pendientes">Pendientes</button>' +
          '</div>' +
          '<select class="admin-filtro-select" id="citas-marca">' +
            '<option value="todas">Todas las marcas</option>' +
            '<option value="secret_garden">Secret Garden</option>' +
            '<option value="yoshimi">Yoshimi</option>' +
          '</select>' +
        '</div>' +
      '</div>' +

      '<div class="admin-filtros" style="margin-bottom:1rem">' +
        '<button class="admin-filtro-btn active" data-vista="lista">☰ Lista</button>' +
        '<button class="admin-filtro-btn" data-vista="mes">📅 Mes</button>' +
        '<button class="admin-filtro-btn" data-vista="semana">🗓 Semana</button>' +
      '</div>' +

      '<div class="admin-stats" id="citas-stats">' +
        '<div class="admin-stat"><strong id="stat-total">—</strong><small>En el período</small></div>' +
        '<div class="admin-stat"><strong id="stat-hoy">—</strong><small>Hoy</small></div>' +
        '<div class="admin-stat"><strong id="stat-pendientes">—</strong><small>Pendientes por confirmar</small></div>' +
      '</div>' +

      '<div id="citas-lista-view"></div>' +
      '<div id="citas-mes-view" style="display:none"></div>' +
      '<div id="citas-semana-view" style="display:none"></div>' +

      '<div class="admin-modal" id="citas-day-modal">' +
        '<div class="admin-modal-card">' +
          '<div class="admin-modal-head">' +
            '<h2 id="citas-day-titulo">Citas del día</h2>' +
            '<button type="button" class="admin-modal-close" data-close-day>×</button>' +
          '</div>' +
          '<div id="citas-day-content"></div>' +
        '</div>' +
      '</div>';
  }

  // ------------------------------------------------------------
  function engancharEventos() {
    const panel = document.getElementById('panel-citas');
    if (!panel) return;

    panel.addEventListener('click', function (e) {
      const rBtn = e.target.closest('[data-rango]');
      if (rBtn) {
        panel.querySelectorAll('[data-rango]').forEach(function (b) { b.classList.remove('active'); });
        rBtn.classList.add('active');
        rangoActual = rBtn.dataset.rango;
        recargar();
        return;
      }

      const vBtn = e.target.closest('[data-vista]');
      if (vBtn) {
        panel.querySelectorAll('[data-vista]').forEach(function (b) { b.classList.remove('active'); });
        vBtn.classList.add('active');
        vistaActual = vBtn.dataset.vista;
        alternarVistas();
        renderTodo();
        return;
      }

      const accBtn = e.target.closest('[data-cita-accion]');
      if (accBtn) {
        e.preventDefault();
        const accion = accBtn.dataset.citaAccion;
        const citaId = accBtn.dataset.citaId;
        ejecutarAccion(accion, citaId);
        return;
      }

      if (e.target.closest('[data-close-day]')) {
        document.getElementById('citas-day-modal').classList.remove('abierto');
        return;
      }

      const chip = e.target.closest('[data-day-open]');
      if (chip) {
        abrirDiaModal(chip.dataset.dayOpen);
        return;
      }

      // Navegación del calendario
      if (e.target.closest('[data-mes-prev]')) { cambiarMes(-1); return; }
      if (e.target.closest('[data-mes-next]')) { cambiarMes(1); return; }
      if (e.target.closest('[data-sem-prev]')) { cambiarSemana(-1); return; }
      if (e.target.closest('[data-sem-next]')) { cambiarSemana(1); return; }
    });

    const marcaSel = document.getElementById('citas-marca');
    if (marcaSel) {
      marcaSel.addEventListener('change', function () {
        filtroMarca = marcaSel.value;
        renderTodo();
      });
    }
  }

  function alternarVistas() {
    const lista = document.getElementById('citas-lista-view');
    const mes = document.getElementById('citas-mes-view');
    const sem = document.getElementById('citas-semana-view');
    if (!lista || !mes || !sem) return;
    lista.style.display = vistaActual === 'lista' ? '' : 'none';
    mes.style.display = vistaActual === 'mes' ? '' : 'none';
    sem.style.display = vistaActual === 'semana' ? '' : 'none';
  }

  // ------------------------------------------------------------
  // Carga
  // ------------------------------------------------------------
  async function recargar() {
    const lista = document.getElementById('citas-lista-view');
    if (lista) lista.innerHTML = '<div class="admin-loading">Cargando citas…</div>';

    if (!SG.sb) {
      if (lista) lista.innerHTML = '<div class="admin-empty">Supabase no está configurado.</div>';
      return;
    }

    const hoy = fechaISO(new Date());
    let desde = hoy;
    let hasta = hoy;

    if (rangoActual === 'semana') {
      const l = lunesDe(new Date());
      const d = new Date(l); d.setDate(d.getDate() + 6);
      desde = fechaISO(l);
      hasta = fechaISO(d);
    } else if (rangoActual === 'proximas') {
      const hastaDate = new Date(); hastaDate.setDate(hastaDate.getDate() + 90);
      hasta = fechaISO(hastaDate);
    } else if (rangoActual === 'pendientes') {
      hasta = fechaISO(addDias(new Date(), 90));
    }

    let q = SG.sb
      .from('pedido_items')
      .select('*, pedidos (codigo, nombre, telefono, metodo_pago, estado)')
      .eq('tipo', 'servicio')
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true });

    if (rangoActual !== 'pendientes') {
      q = q.gte('fecha', desde).lte('fecha', hasta);
    }
    if (rangoActual === 'pendientes') {
      q = q.eq('estado_cita', 'pendiente');
    }
    if (filtroMarca !== 'todas') {
      q = q.eq('marca', filtroMarca);
    }

    const res = await q;
    if (res.error) {
      console.error('[admin.citas] query error:', res.error);
      if (lista) lista.innerHTML = '<div class="admin-empty">No se pudieron cargar las citas.</div>';
      SG.ui.toast('No se pudieron cargar las citas.', 'error');
      return;
    }

    citasCache = res.data || [];
    actualizarStats();
    renderTodo();
  }

  function actualizarStats() {
    const hoy = fechaISO(new Date());
    const total = citasCache.length;
    const hoyCount = citasCache.filter(function (c) { return c.fecha === hoy; }).length;
    const pendientes = citasCache.filter(function (c) { return c.estado_cita === 'pendiente'; }).length;
    const el = document.getElementById('stat-total');
    if (el) el.textContent = total;
    const el2 = document.getElementById('stat-hoy');
    if (el2) el2.textContent = hoyCount;
    const el3 = document.getElementById('stat-pendientes');
    if (el3) el3.textContent = pendientes;
  }

  function renderTodo() {
    if (vistaActual === 'lista') renderLista();
    else if (vistaActual === 'mes') renderMes();
    else renderSemana();
  }

  // ------------------------------------------------------------
  // Vista lista
  // ------------------------------------------------------------
  function renderLista() {
    const cont = document.getElementById('citas-lista-view');
    if (!cont) return;

    if (citasCache.length === 0) {
      cont.innerHTML = '<div class="admin-empty">No hay citas en este rango.</div>';
      return;
    }

    let html = '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
      '<th>Cliente</th><th>Servicio</th><th>Fecha</th><th>Hora</th><th>Pedido</th>' +
      '<th>Estado</th><th class="col-actions">Acciones</th>' +
      '</tr></thead><tbody>';

    citasCache.forEach(function (c) {
      const nombre = (c.pedidos && c.pedidos.nombre) || '—';
      const tel = (c.pedidos && c.pedidos.telefono) || '';
      const codigo = (c.pedidos && c.pedidos.codigo) || '—';
      const fecha = SG.utils.fmtFecha(c.fecha);
      const horaIni = SG.utils.fmtHora12(c.hora);
      const horaFin = calcularHoraFin(c.hora, c.duracion_min);
      const estado = c.estado_cita || 'pendiente';

      html += '<tr>' +
        '<td>' + SG.utils.esc(nombre) + '</td>' +
        '<td>' + SG.utils.esc(c.nombre) + '<br><small style="color:var(--sg-gris)">' +
          (c.marca === 'yoshimi' ? 'Yoshimi' : 'Secret Garden') + '</small></td>' +
        '<td>' + SG.utils.esc(fecha) + '</td>' +
        '<td>' + SG.utils.esc(horaIni) + ' – ' + SG.utils.esc(horaFin) + '</td>' +
        '<td>' + SG.utils.esc(codigo) + '</td>' +
        '<td><span class="admin-badge badge-' + estado + '">' + SG.utils.esc(capitalizar(estado)) + '</span></td>' +
        '<td class="col-actions">' + renderAcciones(c, tel) + '</td>' +
      '</tr>';
    });

    html += '</tbody></table></div>';
    cont.innerHTML = html;
  }

  function renderAcciones(c, tel) {
    const estado = c.estado_cita || 'pendiente';
    const partes = [];

    if (estado === 'pendiente') {
      partes.push('<button class="admin-btn admin-btn-success admin-btn-sm" data-cita-accion="confirmar" data-cita-id="' + SG.utils.esc(c.id) + '">Confirmar</button>');
    }
    if (estado === 'pendiente' || estado === 'confirmada') {
      partes.push('<button class="admin-btn admin-btn-danger admin-btn-sm" data-cita-accion="cancelar" data-cita-id="' + SG.utils.esc(c.id) + '">Cancelar</button>');
    }
    if (estado === 'confirmada' || estado === 'pendiente') {
      partes.push('<button class="admin-btn admin-btn-secondary admin-btn-sm" data-cita-accion="completar" data-cita-id="' + SG.utils.esc(c.id) + '">Completar</button>');
    }
    if (tel) {
      const msg = 'Hola ' + ((c.pedidos && c.pedidos.nombre) || '') + ', te escribo de Estética Secret Garden sobre tu cita de ' + c.nombre + ' el ' + SG.utils.fmtFecha(c.fecha) + ' a las ' + SG.utils.fmtHora12(c.hora) + '.';
      partes.push('<a class="admin-btn admin-btn-secondary admin-btn-sm" target="_blank" rel="noopener" href="https://wa.me/506' + SG.utils.esc(tel) + '?text=' + encodeURIComponent(msg) + '">WhatsApp</a>');
    }
    partes.push('<button class="admin-btn admin-btn-danger admin-btn-sm" data-cita-accion="eliminar" data-cita-id="' + SG.utils.esc(c.id) + '">Eliminar</button>');

    return partes.join(' ');
  }

  // ------------------------------------------------------------
  // Vista mes
  // ------------------------------------------------------------
  function renderMes() {
    const cont = document.getElementById('citas-mes-view');
    if (!cont) return;

    const { year, month } = mesCal;
    const primero = new Date(year, month, 1);
    const ultimo = new Date(year, month + 1, 0);
    const startDow = primero.getDay();
    const hoy = fechaISO(new Date());
    const titulo = primero.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' });

    let html = '<div class="admin-card"><div class="cal-admin-head">' +
      '<button class="admin-btn admin-btn-secondary admin-btn-sm" data-mes-prev>‹</button>' +
      '<strong style="text-transform:capitalize">' + SG.utils.esc(titulo) + '</strong>' +
      '<button class="admin-btn admin-btn-secondary admin-btn-sm" data-mes-next>›</button>' +
      '</div><div class="cal-admin-grid">';

    DIAS_CORTOS.forEach(function (d) {
      html += '<div class="cal-admin-dow">' + d + '</div>';
    });
    for (let i = 0; i < startDow; i++) html += '<div class="cal-admin-cell empty"></div>';

    for (let dia = 1; dia <= ultimo.getDate(); dia++) {
      const iso = year + '-' + pad2(month + 1) + '-' + pad2(dia);
      const delDia = citasCache.filter(function (c) { return c.fecha === iso; });
      const clases = 'cal-admin-cell' + (iso === hoy ? ' hoy' : '') + (delDia.length > 0 ? ' tiene' : '');
      html += '<div class="' + clases + '">' +
        '<button class="cal-admin-num" data-day-open="' + iso + '">' + dia + '</button>';
      delDia.slice(0, 3).forEach(function (c) {
        html += '<span class="cal-admin-chip">' + SG.utils.fmtHora12(c.hora) + ' · ' + SG.utils.esc((c.pedidos && c.pedidos.nombre) || c.nombre) + '</span>';
      });
      if (delDia.length > 3) {
        html += '<span class="cal-admin-chip mas">+' + (delDia.length - 3) + ' más</span>';
      }
      html += '</div>';
    }

    html += '</div></div>';
    cont.innerHTML = html;
  }

  // ------------------------------------------------------------
  // Vista semana
  // ------------------------------------------------------------
  function renderSemana() {
    const cont = document.getElementById('citas-semana-view');
    if (!cont) return;

    const l = lunesDe(semanaCal);
    const dias = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(l); d.setDate(l.getDate() + i);
      dias.push(d);
    }
    const hoy = fechaISO(new Date());
    const fin = dias[6];
    const titulo = 'Semana del ' + l.getDate() + ' de ' + l.toLocaleDateString('es-CR', { month: 'long' }) +
                   ' al ' + fin.getDate() + ' de ' + fin.toLocaleDateString('es-CR', { month: 'long' });

    let html = '<div class="admin-card"><div class="cal-admin-head">' +
      '<button class="admin-btn admin-btn-secondary admin-btn-sm" data-sem-prev>‹</button>' +
      '<strong style="text-transform:capitalize">' + SG.utils.esc(titulo) + '</strong>' +
      '<button class="admin-btn admin-btn-secondary admin-btn-sm" data-sem-next>›</button>' +
      '</div><div class="cal-admin-sem-grid">';

    dias.forEach(function (d) {
      const iso = fechaISO(d);
      const delDia = citasCache.filter(function (c) { return c.fecha === iso; });
      const esHoy = iso === hoy;
      html += '<div class="cal-admin-sem-col">' +
        '<div class="cal-admin-sem-head' + (esHoy ? ' hoy' : '') + '">' +
          '<small>' + DIAS_CORTOS[d.getDay()] + '</small>' +
          '<strong>' + d.getDate() + '</strong>' +
        '</div>';
      if (delDia.length === 0) {
        html += '<p class="cal-admin-sem-empty">—</p>';
      } else {
        delDia.forEach(function (c) {
          html += '<div class="cal-admin-sem-cita" data-day-open="' + iso + '">' +
            '<strong>' + SG.utils.fmtHora12(c.hora) + '</strong>' +
            '<span>' + SG.utils.esc((c.pedidos && c.pedidos.nombre) || c.nombre) + '</span>' +
          '</div>';
        });
      }
      html += '</div>';
    });

    html += '</div></div>';
    cont.innerHTML = html;
  }

  // ------------------------------------------------------------
  // Modal de día
  // ------------------------------------------------------------
  function abrirDiaModal(iso) {
    const cont = document.getElementById('citas-day-content');
    const titulo = document.getElementById('citas-day-titulo');
    const modal = document.getElementById('citas-day-modal');
    if (!cont || !titulo || !modal) return;

    const fecha = new Date(iso + 'T12:00:00');
    titulo.textContent = DIAS_LARGOS[fecha.getDay()] + ' ' + fecha.getDate() + ' de ' + fecha.toLocaleDateString('es-CR', { month: 'long' });

    const delDia = citasCache.filter(function (c) { return c.fecha === iso; });

    if (delDia.length === 0) {
      cont.innerHTML = '<div class="admin-empty">Sin citas ese día.</div>';
    } else {
      cont.innerHTML = delDia.map(function (c) {
        return '<div class="admin-card" style="margin-bottom:.75rem">' +
          '<p style="margin:0 0 .25rem"><strong>' + SG.utils.esc(c.nombre) + '</strong> · ' +
          SG.utils.fmtHora12(c.hora) + ' – ' + calcularHoraFin(c.hora, c.duracion_min) + '</p>' +
          '<p style="margin:0 0 .25rem;color:var(--sg-gris);font-size:.9rem">' +
            SG.utils.esc((c.pedidos && c.pedidos.nombre) || '—') + ' · ' +
            SG.utils.esc((c.pedidos && c.pedidos.telefono) || '') +
          '</p>' +
          '<span class="admin-badge badge-' + (c.estado_cita || 'pendiente') + '">' +
            SG.utils.esc(capitalizar(c.estado_cita || 'pendiente')) +
          '</span>' +
        '</div>';
      }).join('');
    }

    modal.classList.add('abierto');
  }

  // ------------------------------------------------------------
  // Acciones
  // ------------------------------------------------------------
  async function ejecutarAccion(accion, citaId) {
    if (!citaId || !SG.sb) return;

    if (accion === 'eliminar') {
      if (!confirm('¿Eliminar esta cita? No se puede deshacer.')) return;
      const res = await SG.sb.from('pedido_items').delete().eq('id', citaId);
      if (res.error) {
        SG.ui.toast('No se pudo eliminar la cita.', 'error');
        console.error(res.error);
        return;
      }
      SG.ui.toast('Cita eliminada.', 'success');
      recargar();
      return;
    }

    const mapa = {
      confirmar: 'confirmada',
      cancelar:  'cancelada',
      completar: 'completada'
    };
    const nuevo = mapa[accion];
    if (!nuevo) return;

    const res = await SG.sb.from('pedido_items').update({ estado_cita: nuevo }).eq('id', citaId);
    if (res.error) {
      SG.ui.toast('No se pudo actualizar la cita.', 'error');
      console.error(res.error);
      return;
    }
    SG.ui.toast('Cita ' + nuevo + '.', 'success');
    recargar();
  }

  // ------------------------------------------------------------
  // Navegación del calendario
  // ------------------------------------------------------------
  function cambiarMes(delta) {
    mesCal.month += delta;
    if (mesCal.month < 0) { mesCal.month = 11; mesCal.year--; }
    if (mesCal.month > 11) { mesCal.month = 0; mesCal.year++; }
    renderMes();
  }
  function cambiarSemana(delta) {
    const d = new Date(semanaCal);
    d.setDate(d.getDate() + delta * 7);
    semanaCal = d;
    renderSemana();
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  function pad2(n) { return String(n).padStart(2, '0'); }
  function fechaISO(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function addDias(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function lunesDe(d) {
    const x = new Date(d);
    const dow = x.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function capitalizar(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  function calcularHoraFin(hora, durMin) {
    if (!hora) return '';
    const partes = String(hora).slice(0, 5).split(':').map(Number);
    let totalMin = partes[0] * 60 + partes[1] + (durMin || 60);
    totalMin = totalMin % (24 * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return SG.utils.fmtHora12(pad2(h) + ':' + pad2(m));
  }

  return { init: init };
})();