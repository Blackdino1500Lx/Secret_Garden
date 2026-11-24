/* ============================================================
   Estética Secret Garden — checkout.js
   Formulario, RPC crear_pedido, mensaje de WhatsApp y éxito.
   ============================================================ */

window.SG = window.SG || {};

SG.checkout = (function () {
  'use strict';

  // ------------------------------------------------------------
  function setError(campoId, invalido) {
    const el = document.getElementById(campoId);
    if (!el) return;
    const wrap = el.closest('.campo');
    if (wrap) wrap.classList.toggle('invalido', invalido);
  }

  function validar() {
    const nombre = (document.getElementById('co-nombre')?.value || '').trim();
    const telefonoRaw = (document.getElementById('co-telefono')?.value || '').replace(/\D/g, '');
    let telefono = telefonoRaw;
    if (telefono.startsWith('506') && telefono.length > 8) telefono = telefono.slice(3);

    const metodoSel = document.querySelector('input[name="co-metodo"]:checked');
    const metodo = metodoSel ? metodoSel.value : 'sinpe';
    const notas = (document.getElementById('co-notas')?.value || '').trim();

    let ok = true;
    if (nombre.length < 2 || nombre.length > 80) { setError('co-nombre', true); ok = false; }
    else setError('co-nombre', false);

    if (telefono.length !== 8) { setError('co-telefono', true); ok = false; }
    else setError('co-telefono', false);

    if (metodo !== 'sinpe' && metodo !== 'efectivo') ok = false;

    return { ok: ok, nombre: nombre, telefono: telefono, metodo: metodo, notas: notas };
  }

  function buildItemsPayload() {
    return SG.cart.getItems().map(function (it) {
      if (it.tipo === 'servicio') {
        return { tipo: 'servicio', id: it.id, fecha: it.fecha, hora: it.hora };
      }
      return { tipo: 'producto', id: it.id, cantidad: it.cantidad };
    });
  }

  // ------------------------------------------------------------
  async function confirmar() {
    const btn = document.getElementById('cart-checkout');
    if (!btn) return;
    if (btn.disabled) return;

    const v = validar();
    if (!v.ok) {
      SG.ui.toast('Revisá los campos marcados.', 'error');
      return;
    }

    const items = SG.cart.getItems();
    if (items.length === 0) return;
    if (items.some(function (it) { return it._invalido; })) {
      SG.ui.toast('Quitá los ítems no disponibles antes de confirmar.', 'error');
      return;
    }

    if (!SG.sb) {
      SG.ui.toast('Sin conexión. Recargá la página e intentá de nuevo.', 'error');
      return;
    }

    btn.disabled = true;
    const textoOriginal = btn.textContent;
    btn.textContent = 'Enviando…';

    const payload = {
      p_nombre: v.nombre,
      p_telefono: v.telefono,
      p_metodo_pago: v.metodo,
      p_notas: v.notas,
      p_items: buildItemsPayload()
    };

    const res = await SG.sb.rpc('crear_pedido', payload);

    btn.textContent = textoOriginal;
    btn.disabled = false;

    if (res.error) {
      console.error('[SG.checkout] RPC error:', res.error);
      SG.ui.toast('No se pudo crear el pedido. Intentá de nuevo.', 'error');
      return;
    }

    const data = res.data;
    if (!data || !data.ok) {
      const msg = data && data.mensaje ? data.mensaje : 'No se pudo crear el pedido.';
      SG.ui.toast(msg, 'error');

      // Si el error apunta a un ítem específico, resaltarlo
      if (data && typeof data.item_indice === 'number') {
        const items = SG.cart.getItems();
        const it = items[data.item_indice];
        if (it && data.codigo_error === 'horario_ocupado') {
          SG.ui.toast('Cambiá la fecha/hora de: ' + it.nombre, 'warning');
        }
      }
      return;
    }

    mostrarExito(data, v);
  }

  // ------------------------------------------------------------
  function mostrarExito(data, v) {
    const mensaje = construirMensaje(data, v);
    const cfg = SG.configRuntime || SG.config.FALLBACK || {};
    const waNum = cfg.whatsapp || '50664511598';
    const urlWa = 'https://wa.me/' + waNum + '?text=' + encodeURIComponent(mensaje);

    // Guardar datos para el modal de éxito antes de vaciar
    const sinpe = cfg.sinpe_numero || '6451-1598';
    const codigo = data.codigo || '';
    const total = data.total || 0;

    SG.cart.cerrarDrawer();
    SG.cart.vaciar();

    const codeEl = document.getElementById('success-code');
    if (codeEl) codeEl.textContent = codigo;

    const infoEl = document.getElementById('success-info');
    if (infoEl) {
      infoEl.innerHTML =
        '<p>Total: <strong>' + SG.utils.esc(SG.utils.formatCRC(total)) + '</strong></p>' +
        '<p>SINPE Móvil: <strong>' + SG.utils.esc(sinpe) + '</strong></p>';
    }

    const linkEl = document.getElementById('success-wa-link');
    if (linkEl) linkEl.href = urlWa;

    SG.ui.abrirModal('success-modal');

    // Redirección en la misma pestaña (permitido después de un click del usuario)
    setTimeout(function () {
      window.location.href = urlWa;
    }, 900);
  }

  // ------------------------------------------------------------
  function construirMensaje(data, v) {
    const lineas = [];
    lineas.push('Buen día, soy ' + v.nombre + '. Hice el pedido ' + data.codigo + ' en la página de Estética Secret Garden.');
    lineas.push('');

    const citas = (data.items || []).filter(function (i) { return i.tipo === 'servicio'; });
    const prods = (data.items || []).filter(function (i) { return i.tipo === 'producto'; });

    if (citas.length > 0) {
      lineas.push('📅 Citas:');
      citas.forEach(function (c) {
        const dia = SG.utils.diaSemanaLargo(c.fecha);
        const fecha = SG.utils.fmtFecha(c.fecha);
        const hora = SG.utils.fmtHora12(c.hora);
        const precioTxt = c.precio_unitario == null
          ? 'precio por confirmar'
          : SG.utils.formatCRC(c.precio_unitario);
        lineas.push('• ' + c.nombre + ' (' + marcaLabel(c.marca) + ') — ' + dia + ', ' + fecha + ' a las ' + hora + ' — ' + precioTxt);
      });
      lineas.push('');
    }

    if (prods.length > 0) {
      lineas.push('🛍️ Productos:');
      prods.forEach(function (p) {
        const subtotal = (p.subtotal != null)
          ? p.subtotal
          : (p.precio_unitario || 0) * (p.cantidad || 1);
        lineas.push('• ' + p.nombre + ' x' + (p.cantidad || 1) + ' — ' + SG.utils.formatCRC(subtotal));
      });
      lineas.push('');
    }

    lineas.push('Total: ' + SG.utils.formatCRC(data.total || 0));
    lineas.push('Método de pago: ' + (v.metodo === 'sinpe' ? 'SINPE Móvil' : 'Efectivo'));
    if (v.metodo === 'sinpe') {
      lineas.push('¿A qué número confirmo el pago por SINPE?');
    } else {
      lineas.push('Voy a pagar en efectivo.');
    }

    const porConfirmar = (data.items || []).filter(function (i) {
      return i.tipo === 'servicio' && i.precio_unitario == null;
    });
    if (porConfirmar.length > 0) {
      lineas.push('Servicios con precio por confirmar: ' + porConfirmar.map(function (i) { return i.nombre; }).join(', ') + '.');
    }

    if (v.notas) lineas.push('Notas: ' + v.notas);

    return lineas.join('\n');
  }

  function marcaLabel(m) {
    return m === 'yoshimi' ? 'Yoshimi' : 'Secret Garden';
  }

  function init() {
    const btn = document.getElementById('cart-checkout');
    if (btn) btn.addEventListener('click', confirmar);

    const close = document.getElementById('success-close');
    if (close) close.addEventListener('click', function () { SG.ui.cerrarModal('success-modal'); });

    const modal = document.getElementById('success-modal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) SG.ui.cerrarModal('success-modal');
      });
    }
  }

  return { init: init, confirmar: confirmar };
})();