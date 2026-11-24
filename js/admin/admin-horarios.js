/* ============================================================
   Estética Secret Garden — admin-horarios.js
   Horario semanal y días bloqueados.
   ============================================================ */

window.SG = window.SG || {};
SG.admin = SG.admin || {};

SG.admin.horarios = (function () {
  'use strict';

  let inicializado = false;
  let horarios = [];
  let bloqueados = [];

  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // ------------------------------------------------------------
  function init() {
    if (inicializado) { recargar(); return; }
    inicializado = true;

    const panel = document.getElementById('panel-horarios');
    if (!panel) return;
    panel.innerHTML = estructura();
    engancharEventos();
    recargar();
  }

  function estructura() {
    return '' +
      '<div class="panel-head"><h2>Horario y bloqueos</h2></div>' +

      '<div class="admin-card">' +
        '<h3>Horario semanal</h3>' +
        '<p class="admin-help">Estos horarios aplican para todas las citas. Si un día no atendés, desactivalo.</p>' +
        '<div id="horarios-rows"></div>' +
        '<div style="margin-top:1rem;display:flex;align-items:center;gap:.75rem">' +
          '<button class="admin-btn admin-btn-primary" id="save-horarios">Guardar cambios</button>' +
          '<span id="save-horarios-msg" style="color:#1e7a4d;font-size:.9rem"></span>' +
        '</div>' +
      '</div>' +

      '<div class="admin-card">' +
        '<h3>Días bloqueados</h3>' +
        '<p class="admin-help">Días puntuales sin atención (feriados, vacaciones, etc.).</p>' +
        '<div id="bloqueados-lista"></div>' +
        '<div style="margin-top:1rem;display:flex;gap:.5rem;flex-wrap:wrap;align-items:flex-end">' +
          '<div class="campo" style="margin:0;flex:0 0 auto">' +
            '<label for="blq-fecha">Fecha</label>' +
            '<input type="date" id="blq-fecha">' +
          '</div>' +
          '<div class="campo" style="margin:0;flex:1;min-width:180px">' +
            '<label for="blq-motivo">Motivo (opcional)</label>' +
            '<input type="text" id="blq-motivo" maxlength="120">' +
          '</div>' +
          '<button class="admin-btn admin-btn-primary" id="add-bloqueo">Agregar</button>' +
        '</div>' +
      '</div>';
  }

  function engancharEventos() {
    const panel = document.getElementById('panel-horarios');
    if (!panel) return;

    panel.addEventListener('click', function (e) {
      if (e.target.id === 'save-horarios') { guardarHorarios(); return; }
      if (e.target.id === 'add-bloqueo') { agregarBloqueo(); return; }
      const del = e.target.closest('[data-del-bloqueo]');
      if (del) { eliminarBloqueo(del.dataset.delBloqueo); }
    });
  }

  // ------------------------------------------------------------
  async function recargar() {
    if (!SG.sb) return;
    const [hRes, bRes] = await Promise.all([
      SG.sb.from('horarios').select('*').order('dia_semana', { ascending: true }),
      SG.sb.from('dias_bloqueados').select('*').order('fecha', { ascending: true })
    ]);

    if (hRes.error) console.error('[admin.horarios] error horarios:', hRes.error);
    if (bRes.error) console.error('[admin.horarios] error bloqueados:', bRes.error);

    horarios = hRes.data || [];
    bloqueados = bRes.data || [];

    renderHorarios();
    renderBloqueados();
  }

  function renderHorarios() {
    const cont = document.getElementById('horarios-rows');
    if (!cont) return;

    let html = '';
    for (let dow = 0; dow < 7; dow++) {
      const h = horarios.find(function (x) { return Number(x.dia_semana) === dow; }) ||
        { dia_semana: dow, activo: false, hora_inicio: '09:00', hora_fin: '17:00' };
      const ini = String(h.hora_inicio || '09:00').slice(0, 5);
      const fin = String(h.hora_fin || '17:00').slice(0, 5);

      html += '<div class="admin-horario-row">' +
        '<label style="display:flex;align-items:center;gap:.5rem;flex:0 0 140px">' +
          '<input type="checkbox" data-dow="' + dow + '" data-field="activo"' + (h.activo ? ' checked' : '') + '>' +
          '<strong>' + DIAS[dow] + '</strong>' +
        '</label>' +
        '<input type="time" data-dow="' + dow + '" data-field="hora_inicio" value="' + ini + '"' +
          (h.activo ? '' : ' disabled') + ' class="admin-filtro-select" style="padding:.4rem .5rem">' +
        '<span style="color:var(--sg-gris)">a</span>' +
        '<input type="time" data-dow="' + dow + '" data-field="hora_fin" value="' + fin + '"' +
          (h.activo ? '' : ' disabled') + ' class="admin-filtro-select" style="padding:.4rem .5rem">' +
      '</div>';
    }
    cont.innerHTML = html;

    cont.querySelectorAll('input[type="checkbox"][data-dow]').forEach(function (chk) {
      chk.addEventListener('change', function () {
        const dow = chk.dataset.dow;
        const horas = cont.querySelectorAll('input[type="time"][data-dow="' + dow + '"]');
        horas.forEach(function (h) { h.disabled = !chk.checked; });
      });
    });
  }

  async function guardarHorarios() {
    const btn = document.getElementById('save-horarios');
    const msg = document.getElementById('save-horarios-msg');
    if (!SG.sb) return;

    btn.disabled = true;
    btn.textContent = 'Guardando…';
    if (msg) msg.textContent = '';

    const cambios = [];
    for (let dow = 0; dow < 7; dow++) {
      const activo = document.querySelector('input[data-dow="' + dow + '"][data-field="activo"]').checked;
      const ini = document.querySelector('input[data-dow="' + dow + '"][data-field="hora_inicio"]').value;
      const fin = document.querySelector('input[data-dow="' + dow + '"][data-field="hora_fin"]').value;
      cambios.push({ dia_semana: dow, activo: activo, hora_inicio: ini + ':00', hora_fin: fin + ':00' });
    }

    let error = null;
    for (const row of cambios) {
      const res = await SG.sb.from('horarios').upsert(row, { onConflict: 'dia_semana' });
      if (res.error) { error = res.error; break; }
    }

    btn.disabled = false;
    btn.textContent = 'Guardar cambios';

    if (error) {
      SG.ui.toast('No se pudieron guardar los horarios.', 'error');
      console.error(error);
      return;
    }
    if (msg) {
      msg.textContent = '✓ Guardado';
      setTimeout(function () { msg.textContent = ''; }, 2500);
    }
    SG.ui.toast('Horarios actualizados.', 'success');
    recargar();
  }

  // ------------------------------------------------------------
  function renderBloqueados() {
    const cont = document.getElementById('bloqueados-lista');
    if (!cont) return;

    if (bloqueados.length === 0) {
      cont.innerHTML = '<div class="admin-empty">No hay días bloqueados.</div>';
      return;
    }

    cont.innerHTML = bloqueados.map(function (b) {
      return '<div class="admin-horario-row" style="justify-content:space-between">' +
        '<div>' +
          '<strong>' + SG.utils.esc(SG.utils.fmtFecha(b.fecha)) + '</strong>' +
          (b.motivo ? ' <span style="color:var(--sg-gris)">· ' + SG.utils.esc(b.motivo) + '</span>' : '') +
        '</div>' +
        '<button class="admin-btn admin-btn-danger admin-btn-sm" data-del-bloqueo="' + SG.utils.esc(b.id) + '">Quitar</button>' +
      '</div>';
    }).join('');
  }

  async function agregarBloqueo() {
    const fecha = document.getElementById('blq-fecha').value;
    const motivo = document.getElementById('blq-motivo').value.trim();
    if (!fecha) { SG.ui.toast('Elegí una fecha.', 'warning'); return; }
    if (!SG.sb) return;

    const res = await SG.sb.from('dias_bloqueados').insert({ fecha: fecha, motivo: motivo || null });
    if (res.error) {
      if (res.error.code === '23505') {
        SG.ui.toast('Ese día ya está bloqueado.', 'warning');
      } else {
        SG.ui.toast('No se pudo bloquear el día.', 'error');
        console.error(res.error);
      }
      return;
    }

    document.getElementById('blq-fecha').value = '';
    document.getElementById('blq-motivo').value = '';
    SG.ui.toast('Día bloqueado.', 'success');
    recargar();
  }

  async function eliminarBloqueo(id) {
    if (!confirm('¿Desbloquear este día?')) return;
    if (!SG.sb) return;
    const res = await SG.sb.from('dias_bloqueados').delete().eq('id', id);
    if (res.error) {
      SG.ui.toast('No se pudo desbloquear.', 'error');
      console.error(res.error);
      return;
    }
    SG.ui.toast('Día desbloqueado.', 'success');
    recargar();
  }

  return { init: init };
})();