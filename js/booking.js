/* ============================================================
   Estética Secret Garden — booking.js
   Modal de calendario + selección de hora + confirmación.
   ============================================================ */

window.SG = window.SG || {};

SG.booking = (function () {
  'use strict';

  let disponibilidad = null;    // {horarios, dias_bloqueados, horas_ocupadas}
  let modo = 'agregar';         // 'agregar' | 'editar'
  let servicioId = null;
  let uidEditar = null;
  let fechaSel = null;
  let horaSel = null;
  let mesActual = null;         // {year, month (0-11)}

  const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  // ------------------------------------------------------------
  async function cargarDisponibilidad() {
    if (!SG.sb) return null;
    const res = await SG.sb.rpc('obtener_disponibilidad');
    if (res.error) {
      console.error('[SG.booking] obtener_disponibilidad error:', res.error);
      return null;
    }
    disponibilidad = res.data;
    return disponibilidad;
  }

  function getHorarioDia(dow) {
    if (!disponibilidad || !Array.isArray(disponibilidad.horarios)) return null;
    return disponibilidad.horarios.find(function (h) {
      return Number(h.dia_semana) === Number(dow);
    }) || null;
  }

  function esDiaBloqueado(iso) {
    if (!disponibilidad || !Array.isArray(disponibilidad.dias_bloqueados)) return false;
    return disponibilidad.dias_bloqueados.indexOf(iso) !== -1;
  }

  function esHoraOcupada(iso, hora) {
    if (!disponibilidad || !Array.isArray(disponibilidad.horas_ocupadas)) return false;
    return disponibilidad.horas_ocupadas.some(function (h) {
      return h.fecha === iso && h.hora === hora;
    });
  }

  function esHoraEnCarrito(iso, hora) {
    if (!SG.cart) return false;
    return SG.cart.getItems().some(function (it) {
      return it.tipo === 'servicio' &&
             it.fecha === iso &&
             it.hora === hora &&
             it.uid !== uidEditar;
    });
  }

  function esDiaSeleccionable(iso) {
    const hoy = SG.utils.hoyISO();
    if (iso < hoy) return false;
    const d = new Date(iso + 'T12:00:00');
    const horario = getHorarioDia(d.getDay());
    if (!horario || !horario.activo) return false;
    if (esDiaBloqueado(iso)) return false;
    return true;
  }

  function horasDelDia(iso) {
    const d = new Date(iso + 'T12:00:00');
    const horario = getHorarioDia(d.getDay());
    if (!horario) return [];
    const partesI = String(horario.hora_inicio).slice(0, 5).split(':').map(Number);
    const partesF = String(horario.hora_fin).slice(0, 5).split(':').map(Number);
    const inicio = partesI[0] * 60 + (partesI[1] || 0);
    const fin = partesF[0] * 60 + (partesF[1] || 0);
    const result = [];
    for (let m = inicio; m < fin; m += 30) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      result.push(hh + ':' + mm);
    }
    return result;
  }

  // ------------------------------------------------------------
  function renderCalendario() {
    const cont = document.getElementById('booking-calendario');
    if (!cont || !disponibilidad) return;

    const year = mesActual.year;
    const month = mesActual.month;
    const primerDia = new Date(year, month, 1);
    const ultimoDia = new Date(year, month + 1, 0);
    const startDow = primerDia.getDay();
    const hoy = SG.utils.hoyISO();

    const titulo = primerDia.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' });

    let html = '<div class="calendario-head">' +
      '<button type="button" class="calendario-nav" data-cal-nav="-1" aria-label="Mes anterior">‹</button>' +
      '<div class="calendario-titulo">' + SG.utils.esc(titulo) + '</div>' +
      '<button type="button" class="calendario-nav" data-cal-nav="1" aria-label="Mes siguiente">›</button>' +
      '</div>';

    html += '<div class="calendario-grid">';
    DIAS_CORTOS.forEach(function (d) {
      html += '<div class="calendario-dow">' + d + '</div>';
    });
    for (let i = 0; i < startDow; i++) html += '<div></div>';

    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const iso = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
      const ok = esDiaSeleccionable(iso);
      const esHoy = iso === hoy;
      const sel = iso === fechaSel;
      let cls = 'calendario-dia';
      if (esHoy) cls += ' hoy';
      if (sel) cls += ' seleccionado';
      html += '<button type="button" class="' + cls + '" data-fecha="' + iso + '"' +
              (ok ? '' : ' disabled') + '>' + dia + '</button>';
    }
    html += '</div>';

    cont.innerHTML = html;

    cont.querySelectorAll('[data-cal-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const delta = parseInt(btn.dataset.calNav, 10);
        mesActual.month += delta;
        if (mesActual.month < 0) { mesActual.month = 11; mesActual.year--; }
        if (mesActual.month > 11) { mesActual.month = 0; mesActual.year++; }
        renderCalendario();
      });
    });

    cont.querySelectorAll('[data-fecha]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        fechaSel = btn.dataset.fecha;
        horaSel = null;
        renderCalendario();
        renderHoras();
      });
    });
  }

  function renderHoras() {
    const cont = document.getElementById('booking-horas');
    if (!cont) return;

    if (!fechaSel) {
      cont.innerHTML = '<p class="empty-state">Seleccioná un día primero.</p>';
      actualizarBotonConfirmar();
      return;
    }

    const horas = horasDelDia(fechaSel);
    if (horas.length === 0) {
      cont.innerHTML = '<p class="empty-state">No hay horas disponibles ese día.</p>';
      actualizarBotonConfirmar();
      return;
    }

    const horario = getHorarioDia(new Date(fechaSel + 'T12:00:00').getDay());
    const rango = horario
      ? SG.utils.fmtHora12(horario.hora_inicio) + ' – ' + SG.utils.fmtHora12(horario.hora_fin)
      : '';

    let html = '';
    if (rango) html += '<p class="hora-ayuda">Horario disponible: ' + SG.utils.esc(rango) + '</p>';
    html += '<div class="hora-grid">';

    horas.forEach(function (h) {
      const ocupada = esHoraOcupada(fechaSel, h);
      const enCarrito = esHoraEnCarrito(fechaSel, h);
      const habilitado = !ocupada && !enCarrito;
      const sel = h === horaSel;
      let cls = 'hora-btn';
      if (sel) cls += ' seleccionado';
      html += '<button type="button" class="' + cls + '" data-hora="' + h + '"' +
              (habilitado ? '' : ' disabled') + '>' + SG.utils.fmtHora12(h) + '</button>';
    });

    html += '</div>';
    cont.innerHTML = html;

    cont.querySelectorAll('[data-hora]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        horaSel = btn.dataset.hora;
        renderHoras();
      });
    });

    actualizarBotonConfirmar();
  }

  function actualizarBotonConfirmar() {
    const btn = document.getElementById('booking-confirm');
    if (!btn) return;
    btn.disabled = !(fechaSel && horaSel);
    btn.textContent = modo === 'editar' ? 'Actualizar cita' : 'Agregar al carrito';
  }

  // ------------------------------------------------------------
  async function abrir(sid, uidEditarParam) {
    servicioId = sid;
    uidEditar = uidEditarParam || null;
    modo = uidEditar ? 'editar' : 'agregar';

    // Si editamos, precargar fecha/hora actuales
    if (uidEditar && SG.cart) {
      const it = SG.cart.getItems().find(function (x) { return x.uid === uidEditar; });
      fechaSel = it ? it.fecha : null;
      horaSel = it ? it.hora : null;
    } else {
      fechaSel = null;
      horaSel = null;
    }

    const serv = SG.catalog && SG.catalog.getServicio(sid);
    const tituloEl = document.getElementById('booking-servicio');
    if (tituloEl && serv) {
      tituloEl.textContent = serv.nombre + ' · ' + serv.duracion_min + ' min';
    } else if (tituloEl) {
      tituloEl.textContent = '';
    }

    const modalTitulo = document.getElementById('booking-titulo');
    if (modalTitulo) {
      modalTitulo.textContent = modo === 'editar' ? 'Cambiar fecha y hora' : 'Agendar cita';
    }

    // Si es editar, conservar el mes de la fecha actual
    if (fechaSel) {
      const d = new Date(fechaSel + 'T12:00:00');
      mesActual = { year: d.getFullYear(), month: d.getMonth() };
    } else {
      const hoy = new Date();
      mesActual = { year: hoy.getFullYear(), month: hoy.getMonth() };
    }

    SG.ui.abrirModal('booking-modal');
    const cont = document.getElementById('booking-horas');
    if (cont) cont.innerHTML = '<p class="empty-state">Cargando disponibilidad…</p>';

    await cargarDisponibilidad();
    renderCalendario();
    renderHoras();
    actualizarBotonConfirmar();
  }

  function confirmar() {
    if (!fechaSel || !horaSel || !servicioId) return;

    if (modo === 'editar' && uidEditar) {
      SG.cart.actualizarItem(uidEditar, { fecha: fechaSel, hora: horaSel });
      SG.ui.toast('Cita actualizada.', 'success');
    } else {
      SG.cart.agregarServicio(servicioId, fechaSel, horaSel);
    }

    SG.ui.cerrarModal('booking-modal');
  }

  function init() {
    const close = document.getElementById('booking-close');
    const cancel = document.getElementById('booking-cancel');
    const confirmBtn = document.getElementById('booking-confirm');
    const modal = document.getElementById('booking-modal');

    if (close) close.addEventListener('click', function () { SG.ui.cerrarModal('booking-modal'); });
    if (cancel) cancel.addEventListener('click', function () { SG.ui.cerrarModal('booking-modal'); });
    if (confirmBtn) confirmBtn.addEventListener('click', confirmar);
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) SG.ui.cerrarModal('booking-modal');
      });
    }
  }

  return { init: init, abrir: abrir };
})();