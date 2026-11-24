/* ============================================================
   Estética Secret Garden — cart.js
   Estado del carrito, localStorage, drawer y render de ítems.
   ============================================================ */

window.SG = window.SG || {};

SG.cart = (function () {
  'use strict';

  const STORAGE_KEY = 'sg_cart_v1';
  const MAX_CANTIDAD = 10;

  let items = [];                 // [{uid, tipo, id, marca, nombre, precio_unitario, descuento_texto, cantidad, fecha?, hora?, duracion_min?, _invalido?}]
  let metodoPago = 'sinpe';       // 'sinpe' | 'efectivo'
  let cliente = { nombre: '', telefono: '', notas: '' };

  // ------------------------------------------------------------
  // Persistencia
  // ------------------------------------------------------------
  function cargarDeStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.items)) items = data.items;
      if (data.cliente && typeof data.cliente === 'object') {
        cliente = {
          nombre: String(data.cliente.nombre || ''),
          telefono: String(data.cliente.telefono || ''),
          notas: String(data.cliente.notas || '')
        };
      }
      if (data.metodoPago === 'sinpe' || data.metodoPago === 'efectivo') {
        metodoPago = data.metodoPago;
      }
    } catch (err) {
      console.warn('[SG.cart] No se pudo cargar el carrito:', err);
      items = [];
    }
  }

  function guardarEnStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        items: items, cliente: cliente, metodoPago: metodoPago
      }));
    } catch (err) {
      console.warn('[SG.cart] No se pudo guardar el carrito:', err);
    }
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  function generarUid() {
    return 'it_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function contarItems() {
    return items.reduce(function (acc, it) { return acc + (it.cantidad || 1); }, 0);
  }

  function total() {
    return items.reduce(function (acc, it) {
      if (it.precio_unitario == null) return acc;
      return acc + it.precio_unitario * (it.cantidad || 1);
    }, 0);
  }

  function tienePreciosPorConfirmar() {
    return items.some(function (it) {
      return it.tipo === 'servicio' && it.precio_unitario == null;
    });
  }

  function marcaLabel(m) {
    return m === 'yoshimi' ? 'Yoshimi' : 'Secret Garden';
  }

  function firstImage(it) {
    if (!SG.catalog || !SG.catalog.estado) return 'img/placeholders/placeholder.svg';
    const mapa = it.tipo === 'servicio'
      ? SG.catalog.estado.imagenesServicios
      : SG.catalog.estado.imagenesProductos;
    const arr = mapa && mapa[it.id];
    if (arr && arr.length > 0) return SG.utils.imgUrl(arr[0].path);
    return 'img/placeholders/placeholder.svg';
  }

  // ------------------------------------------------------------
  // Mutaciones del carrito
  // ------------------------------------------------------------
  function agregarProducto(productoId, cantidad) {
    const prod = SG.catalog && SG.catalog.getProducto(productoId);
    if (!prod) {
      SG.ui.toast('Ese producto ya no está disponible.', 'error');
      return;
    }
    if (prod.agotado) {
      SG.ui.toast('Ese producto está agotado.', 'error');
      return;
    }
    const cant = Math.max(1, Math.min(MAX_CANTIDAD, parseInt(cantidad, 10) || 1));

    const existente = items.find(function (it) {
      return it.tipo === 'producto' && it.id === productoId;
    });

    if (existente) {
      existente.cantidad = Math.min(MAX_CANTIDAD, existente.cantidad + cant);
    } else {
      const precioFinal = SG.utils.precioFinal(
        prod.precio, prod.descuento_tipo, prod.descuento_valor, prod.descuento_hasta
      );
      const descTxt = SG.utils.descuentoTexto(
        prod.descuento_tipo, prod.descuento_valor, prod.descuento_hasta
      );
      items.push({
        uid: generarUid(),
        tipo: 'producto',
        id: prod.id,
        marca: prod.marca,
        nombre: prod.nombre,
        precio_unitario: precioFinal,
        descuento_texto: descTxt,
        cantidad: cant
      });
    }
    guardarEnStorage();
    render();
    actualizarBadge();
    SG.ui.toast('Producto agregado al carrito.', 'success');
  }

  function agregarServicio(servicioId, fecha, hora) {
    const serv = SG.catalog && SG.catalog.getServicio(servicioId);
    if (!serv) {
      SG.ui.toast('Ese servicio ya no está disponible.', 'error');
      return;
    }
    const precioFinal = SG.utils.precioFinal(
      serv.precio, serv.descuento_tipo, serv.descuento_valor, serv.descuento_hasta
    );
    const descTxt = SG.utils.descuentoTexto(
      serv.descuento_tipo, serv.descuento_valor, serv.descuento_hasta
    );
    items.push({
      uid: generarUid(),
      tipo: 'servicio',
      id: serv.id,
      marca: serv.marca,
      nombre: serv.nombre,
      precio_unitario: precioFinal,
      descuento_texto: descTxt,
      cantidad: 1,
      fecha: fecha,
      hora: hora,
      duracion_min: serv.duracion_min
    });
    guardarEnStorage();
    render();
    actualizarBadge();
    SG.ui.toast('Cita agregada al carrito.', 'success');
  }

  function actualizarItem(uid, cambios) {
    const it = items.find(function (i) { return i.uid === uid; });
    if (!it) return;
    Object.assign(it, cambios);
    guardarEnStorage();
    render();
  }

  function cambiarCantidad(uid, delta) {
    const it = items.find(function (i) { return i.uid === uid; });
    if (!it || it.tipo !== 'producto') return;
    const nueva = Math.max(1, Math.min(MAX_CANTIDAD, (it.cantidad || 1) + delta));
    it.cantidad = nueva;
    guardarEnStorage();
    render();
  }

  function quitarItem(uid) {
    items = items.filter(function (i) { return i.uid !== uid; });
    guardarEnStorage();
    render();
    actualizarBadge();
  }

  function vaciar() {
    items = [];
    cliente = { nombre: '', telefono: '', notas: '' };
    metodoPago = 'sinpe';
    guardarEnStorage();
    limpiarForm();
    render();
    actualizarBadge();
  }

  // ------------------------------------------------------------
  // Revalidación contra catálogo
  // ------------------------------------------------------------
  function revalidar() {
    if (!SG.catalog || typeof SG.catalog.getServicio !== 'function') return;
    if (!SG.catalog.estado) return;
    const totalCat = (SG.catalog.estado.servicios || []).length +
                     (SG.catalog.estado.productos || []).length;
    if (totalCat === 0) return;

    let cambios = 0;
    let invalidos = 0;

    items.forEach(function (it) {
      delete it._invalido;

      if (it.tipo === 'producto') {
        const p = SG.catalog.getProducto(it.id);
        if (!p || p.agotado) { it._invalido = true; invalidos++; cambios++; return; }
        const nuevoPrecio = SG.utils.precioFinal(
          p.precio, p.descuento_tipo, p.descuento_valor, p.descuento_hasta
        );
        if (nuevoPrecio !== it.precio_unitario) {
          it.precio_unitario = nuevoPrecio;
          cambios++;
        }
      } else {
        const s = SG.catalog.getServicio(it.id);
        if (!s) { it._invalido = true; invalidos++; cambios++; }
      }
    });

    if (cambios > 0) {
      guardarEnStorage();
      render();
      if (invalidos > 0) {
        SG.ui.toast('Algunos ítems del carrito ya no están disponibles.', 'warning');
      } else {
        SG.ui.toast('Se actualizaron precios en tu carrito.', 'info');
      }
    }
  }

  // ------------------------------------------------------------
  // Render del drawer
  // ------------------------------------------------------------
  function render() {
    const wrap = document.getElementById('cart-items-wrap');
    const formWrap = document.getElementById('cart-form-wrap');
    const totalEl = document.getElementById('cart-total');
    const btn = document.getElementById('cart-checkout');
    if (!wrap) return;

    if (items.length === 0) {
      wrap.innerHTML = '<p class="empty-state">Tu carrito está vacío.</p>';
      if (formWrap) formWrap.hidden = true;
      if (totalEl) totalEl.textContent = '₡0';
      if (btn) btn.disabled = true;
      return;
    }

    const servicios = items.filter(function (i) { return i.tipo === 'servicio'; });
    const productos = items.filter(function (i) { return i.tipo === 'producto'; });

    let html = '';

    if (items.some(function (i) { return i._invalido; })) {
      html += '<div class="cart-alerta">Hay ítems no disponibles en tu carrito. Quitalos para continuar.</div>';
    }

    if (servicios.length > 0) {
      html += '<section class="cart-group"><h3>Servicios (citas)</h3>';
      html += servicios.map(renderItemServicio).join('');
      html += '</section>';
    }

    if (productos.length > 0) {
      html += '<section class="cart-group"><h3>Productos</h3>';
      html += productos.map(renderItemProducto).join('');
      html += '</section>';
    }

    wrap.innerHTML = html;

    if (formWrap) formWrap.hidden = false;
    if (totalEl) {
      let txt = SG.utils.formatCRC(total());
      if (tienePreciosPorConfirmar()) txt += ' + servicios por confirmar';
      totalEl.textContent = txt;
    }
    if (btn) {
      const invalidos = items.some(function (i) { return i._invalido; });
      btn.disabled = invalidos;
    }
  }

  function renderItemServicio(it) {
    const img = firstImage(it);
    const fecha = it.fecha ? SG.utils.fmtFecha(it.fecha) : '';
    const dia = it.fecha ? SG.utils.diaSemanaLargo(it.fecha) : '';
    const hora = it.hora ? SG.utils.fmtHora12(it.hora) : '';
    const precio = it.precio_unitario == null
      ? '<span class="price-por-definir">Precio por definir</span>'
      : SG.utils.formatCRC(it.precio_unitario);

    return '' +
      '<article class="cart-item' + (it._invalido ? ' cart-item-invalido' : '') + '">' +
        '<div class="cart-item-media"><img src="' + SG.utils.esc(img) + '" alt="" loading="lazy" onerror="this.src=\'img/placeholders/placeholder.svg\'"></div>' +
        '<div class="cart-item-info">' +
          '<span class="cart-item-marca">' + SG.utils.esc(marcaLabel(it.marca)) + '</span>' +
          '<p class="cart-item-nombre">' + SG.utils.esc(it.nombre) + '</p>' +
          '<span class="cart-item-meta">' + SG.utils.esc(dia + ' ' + fecha + ' · ' + hora + ' · ' + (it.duracion_min || 60) + ' min') + '</span>' +
          '<span class="cart-item-precio">' + precio + '</span>' +
        '</div>' +
        '<div class="cart-item-acciones">' +
          '<button type="button" data-cart-edit="' + SG.utils.esc(it.uid) + '" data-servicio-id="' + SG.utils.esc(it.id) + '">Cambiar</button>' +
          '<button type="button" data-cart-remove="' + SG.utils.esc(it.uid) + '" class="btn-remove">Quitar</button>' +
        '</div>' +
      '</article>';
  }

  function renderItemProducto(it) {
    const img = firstImage(it);
    const precio = it.precio_unitario == null
      ? '<span class="price-por-definir">Precio por definir</span>'
      : SG.utils.formatCRC(it.precio_unitario * (it.cantidad || 1));

    return '' +
      '<article class="cart-item' + (it._invalido ? ' cart-item-invalido' : '') + '">' +
        '<div class="cart-item-media"><img src="' + SG.utils.esc(img) + '" alt="" loading="lazy" onerror="this.src=\'img/placeholders/placeholder.svg\'"></div>' +
        '<div class="cart-item-info">' +
          '<span class="cart-item-marca">' + SG.utils.esc(marcaLabel(it.marca)) + '</span>' +
          '<p class="cart-item-nombre">' + SG.utils.esc(it.nombre) + '</p>' +
          '<div class="qty-control">' +
            '<button type="button" data-cart-qty="-1" data-uid="' + SG.utils.esc(it.uid) + '" aria-label="Quitar uno">−</button>' +
            '<span>' + (it.cantidad || 1) + '</span>' +
            '<button type="button" data-cart-qty="1" data-uid="' + SG.utils.esc(it.uid) + '" aria-label="Agregar uno">+</button>' +
          '</div>' +
          '<span class="cart-item-precio">' + precio + '</span>' +
        '</div>' +
        '<div class="cart-item-acciones">' +
          '<button type="button" data-cart-remove="' + SG.utils.esc(it.uid) + '" class="btn-remove">Quitar</button>' +
        '</div>' +
      '</article>';
  }

  function actualizarBadge() {
    const badge = document.getElementById('cart-count');
    if (!badge) return;
    const n = contarItems();
    badge.textContent = String(n);
    badge.classList.toggle('visible', n > 0);
  }

  // ------------------------------------------------------------
  // Drawer abrir / cerrar
  // ------------------------------------------------------------
  function abrirDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (!drawer) return;
    drawer.classList.add('abierto');
    drawer.setAttribute('aria-hidden', 'false');
    if (overlay) {
      overlay.hidden = false;
      requestAnimationFrame(function () { overlay.classList.add('visible'); });
    }
    document.body.style.overflow = 'hidden';
  }

  function cerrarDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (!drawer) return;
    drawer.classList.remove('abierto');
    drawer.setAttribute('aria-hidden', 'true');
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(function () { overlay.hidden = true; }, 250);
    }
    document.body.style.overflow = '';
  }

  // ------------------------------------------------------------
  // Formulario (persistencia mientras el usuario escribe)
  // ------------------------------------------------------------
  function restaurarForm() {
    const n = document.getElementById('co-nombre');
    const t = document.getElementById('co-telefono');
    const no = document.getElementById('co-notas');
    if (n) n.value = cliente.nombre;
    if (t) t.value = cliente.telefono;
    if (no) no.value = cliente.notas;
    const r = document.querySelector('input[name="co-metodo"][value="' + metodoPago + '"]');
    if (r) r.checked = true;
  }

  function limpiarForm() {
    const n = document.getElementById('co-nombre');
    const t = document.getElementById('co-telefono');
    const no = document.getElementById('co-notas');
    if (n) n.value = '';
    if (t) t.value = '';
    if (no) no.value = '';
    const r = document.querySelector('input[name="co-metodo"][value="sinpe"]');
    if (r) r.checked = true;
  }

  // ------------------------------------------------------------
  // Init
  // ------------------------------------------------------------
  function init() {
    cargarDeStorage();
    restaurarForm();

    const toggle = document.getElementById('cart-toggle');
    const close = document.getElementById('cart-close');
    const overlay = document.getElementById('drawer-overlay');
    if (toggle) toggle.addEventListener('click', abrirDrawer);
    if (close) close.addEventListener('click', cerrarDrawer);
    if (overlay) overlay.addEventListener('click', cerrarDrawer);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        const drawer = document.getElementById('cart-drawer');
        if (drawer && drawer.classList.contains('abierto')) cerrarDrawer();
      }
    });

    const body = document.getElementById('cart-body');
    if (body) {
      body.addEventListener('click', function (e) {
        const qtyBtn = e.target.closest('[data-cart-qty]');
        if (qtyBtn) {
          e.preventDefault();
          cambiarCantidad(qtyBtn.dataset.uid, parseInt(qtyBtn.dataset.cartQty, 10) || 0);
          return;
        }
        const removeBtn = e.target.closest('[data-cart-remove]');
        if (removeBtn) {
          e.preventDefault();
          quitarItem(removeBtn.dataset.cartRemove);
          return;
        }
        const editBtn = e.target.closest('[data-cart-edit]');
        if (editBtn) {
          e.preventDefault();
          if (SG.booking && typeof SG.booking.abrir === 'function') {
            SG.booking.abrir(editBtn.dataset.servicioId, editBtn.dataset.cartEdit);
          }
        }
      });

      body.addEventListener('input', function (e) {
        if (e.target.id === 'co-nombre') cliente.nombre = e.target.value;
        else if (e.target.id === 'co-telefono') cliente.telefono = e.target.value;
        else if (e.target.id === 'co-notas') cliente.notas = e.target.value;
        else return;
        guardarEnStorage();
      });

      body.addEventListener('change', function (e) {
        if (e.target.name === 'co-metodo') {
          metodoPago = e.target.value === 'efectivo' ? 'efectivo' : 'sinpe';
          guardarEnStorage();
        }
      });
    }

    render();
    actualizarBadge();
  }

  // ------------------------------------------------------------
  // API pública
  // ------------------------------------------------------------
  return {
    init: init,
    abrirDrawer: abrirDrawer,
    cerrarDrawer: cerrarDrawer,
    agregarProducto: agregarProducto,
    agregarServicio: agregarServicio,
    actualizarItem: actualizarItem,
    cambiarCantidad: cambiarCantidad,
    quitarItem: quitarItem,
    vaciar: vaciar,
    revalidar: revalidar,
    contarItems: contarItems,
    total: total,
    tienePreciosPorConfirmar: tienePreciosPorConfirmar,
    getItems: function () { return items.slice(); },
    getMetodoPago: function () { return metodoPago; },
    getCliente: function () { return Object.assign({}, cliente); }
  };
})();