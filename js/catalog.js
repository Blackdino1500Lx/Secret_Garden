/* ============================================================
   Estética Secret Garden — catalog.js
   Carga categorías/servicios/productos y los dibuja en la landing.
   ============================================================ */

window.SG = window.SG || {};

SG.catalog = (function () {
  'use strict';

  const estado = {
    categorias: [],
    servicios: [],
    productos: [],
    imagenesServicios: {},  // { servicio_id: [{path, orden}, ...] }
    imagenesProductos: {},  // { producto_id: [{path, orden}, ...] }
    tabActivo: {
      secret_garden: null,
      yoshimi: null
    }
  };

  // ---------- Carga inicial ----------
  async function cargar() {
    if (!SG.sb) return; // config faltante

    const [catRes, servRes, prodRes, siRes, piRes] = await Promise.all([
      SG.sb.from('categorias').select('*').eq('activa', true).order('orden', { ascending: true }),
      SG.sb.from('servicios').select('*').eq('activo', true).order('orden', { ascending: true }),
      SG.sb.from('productos').select('*').eq('activo', true).order('orden', { ascending: true }),
      SG.sb.from('servicio_imagenes').select('*').order('orden', { ascending: true }),
      SG.sb.from('producto_imagenes').select('*').order('orden', { ascending: true })
    ]);

    if (catRes.error || servRes.error || prodRes.error) {
      console.error('[SG.catalog] Error al cargar catálogo:', {
        categorias: catRes.error, servicios: servRes.error, productos: prodRes.error
      });
      SG.ui.toast('No se pudo cargar el catálogo. Revisa la conexión.', 'error');
      return;
    }

    estado.categorias = catRes.data || [];
    estado.servicios = servRes.data || [];
    estado.productos = prodRes.data || [];

    // Agrupar imágenes por id
    (siRes.data || []).forEach(function (row) {
      if (!estado.imagenesServicios[row.servicio_id]) estado.imagenesServicios[row.servicio_id] = [];
      estado.imagenesServicios[row.servicio_id].push(row);
    });
    (piRes.data || []).forEach(function (row) {
      if (!estado.imagenesProductos[row.producto_id]) estado.imagenesProductos[row.producto_id] = [];
      estado.imagenesProductos[row.producto_id].push(row);
    });

    // Ordenar imágenes por "orden" dentro de cada servicio/producto
    Object.keys(estado.imagenesServicios).forEach(function (k) {
      estado.imagenesServicios[k].sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
    });
    Object.keys(estado.imagenesProductos).forEach(function (k) {
      estado.imagenesProductos[k].sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
    });

    renderTodo();
  }

  // ---------- Render de todo ----------
  function renderTodo() {
    renderTabs('secret_garden');
    renderTabs('yoshimi');
    renderServicios('secret_garden');
    renderServicios('yoshimi');
    renderProductos('secret_garden');
    renderProductos('yoshimi');
  }

  // ---------- Tabs por marca ----------
  function renderTabs(marca) {
    const contenedor = document.getElementById(
      marca === 'secret_garden' ? 'tabs-servicios-sg' : 'tabs-servicios-y'
    );
    if (!contenedor) return;

    const cats = estado.categorias.filter(function (c) {
      return c.marca === marca && c.tipo === 'servicio';
    });

    if (cats.length === 0) {
      contenedor.innerHTML = '';
      return;
    }

    const botones = [
      '<button class="tab active" data-cat="" data-marca="' + marca + '">Todos</button>'
    ].concat(cats.map(function (c) {
      return '<button class="tab" data-cat="' + SG.utils.esc(c.id) + '" data-marca="' + marca + '">' +
             SG.utils.esc(c.nombre) + '</button>';
    }));

    contenedor.innerHTML = botones.join('');

    contenedor.addEventListener('click', function (e) {
      const btn = e.target.closest('.tab');
      if (!btn) return;
      contenedor.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      const catId = btn.dataset.cat || null;
      estado.tabActivo[marca] = catId;
      renderServicios(marca);
    });
  }

  // ---------- Tarjetas de servicios ----------
  function renderServicios(marca) {
    const grid = document.getElementById(
      marca === 'secret_garden' ? 'grid-servicios-sg' : 'grid-servicios-y'
    );
    if (!grid) return;

    const filtro = estado.tabActivo[marca];
    let lista = estado.servicios.filter(function (s) { return s.marca === marca; });
    if (filtro) lista = lista.filter(function (s) { return s.categoria_id === filtro; });

    if (lista.length === 0) {
      grid.innerHTML = '<div class="empty-state">No hay servicios disponibles por ahora.</div>';
      return;
    }

    grid.innerHTML = lista.map(cardServicio).join('');
  }

  function cardServicio(s) {
    const imgs = estado.imagenesServicios[s.id] || [];
    const img = imgs.length > 0 ? SG.utils.imgUrl(imgs[0].path) : 'img/placeholders/placeholder.svg';
    const precio = SG.utils.precioFinal(s.precio, s.descuento_tipo, s.descuento_valor, s.descuento_hasta);
    const descTxt = SG.utils.descuentoTexto(s.descuento_tipo, s.descuento_valor, s.descuento_hasta);

    let precioHtml;
    if (precio == null) {
      precioHtml = '<span class="price-por-definir">Precio por definir</span>';
    } else if (descTxt) {
      precioHtml =
        '<span class="price-old">' + SG.utils.esc(SG.utils.formatCRC(s.precio)) + '</span>' +
        '<span class="price">' + SG.utils.esc(SG.utils.formatCRC(precio)) + '</span>' +
        '<span class="badge badge-discount">' + SG.utils.esc(descTxt) + '</span>';
    } else {
      precioHtml = '<span class="price">' + SG.utils.esc(SG.utils.formatCRC(precio)) + '</span>';
    }

    return '' +
      '<article class="card card-service" data-id="' + SG.utils.esc(s.id) + '" data-marca="' + SG.utils.esc(s.marca) + '">' +
        '<div class="card-media">' +
          '<img src="' + SG.utils.esc(img) + '" alt="' + SG.utils.esc(s.nombre) + '" loading="lazy" ' +
               'onerror="this.src=\'img/placeholders/placeholder.svg\'" />' +
        '</div>' +
        '<div class="card-body">' +
          '<h3 class="card-title">' + SG.utils.esc(s.nombre) + '</h3>' +
          '<p class="card-desc">' + SG.utils.esc(s.descripcion || '') + '</p>' +
          '<div class="card-meta"><span class="card-duration">' + SG.utils.esc(s.duracion_min) + ' min</span></div>' +
          '<div class="card-price">' + precioHtml + '</div>' +
          '<button class="btn btn-primary btn-block" data-action="agendar" data-id="' + SG.utils.esc(s.id) + '" data-marca="' + SG.utils.esc(s.marca) + '">Agendar</button>' +
        '</div>' +
      '</article>';
  }

  // ---------- Tarjetas de productos ----------
  function renderProductos(marca) {
    const grid = document.getElementById(
      marca === 'secret_garden' ? 'grid-productos-sg' : 'grid-productos-y'
    );
    if (!grid) return;

    const lista = estado.productos.filter(function (p) { return p.marca === marca; });

    if (lista.length === 0) {
      grid.innerHTML = '<div class="empty-state">Próximamente.</div>';
      return;
    }

    grid.innerHTML = lista.map(cardProducto).join('');
  }

  function cardProducto(p) {
    const imgs = estado.imagenesProductos[p.id] || [];
    const img = imgs.length > 0 ? SG.utils.imgUrl(imgs[0].path) : 'img/placeholders/placeholder.svg';
    const precio = SG.utils.precioFinal(p.precio, p.descuento_tipo, p.descuento_valor, p.descuento_hasta);
    const descTxt = SG.utils.descuentoTexto(p.descuento_tipo, p.descuento_valor, p.descuento_hasta);

    let precioHtml;
    if (descTxt) {
      precioHtml =
        '<span class="price-old">' + SG.utils.esc(SG.utils.formatCRC(p.precio)) + '</span>' +
        '<span class="price">' + SG.utils.esc(SG.utils.formatCRC(precio)) + '</span>' +
        '<span class="badge badge-discount">' + SG.utils.esc(descTxt) + '</span>';
    } else {
      precioHtml = '<span class="price">' + SG.utils.esc(SG.utils.formatCRC(precio)) + '</span>';
    }

    const agotado = p.agotado === true;
    const badgeAgotado = agotado ? '<span class="badge badge-agotado">Agotado</span>' : '';

    return '' +
      '<article class="card card-product ' + (agotado ? 'card-agotado' : '') + '" data-id="' + SG.utils.esc(p.id) + '" data-marca="' + SG.utils.esc(p.marca) + '">' +
        '<div class="card-media">' +
          '<img src="' + SG.utils.esc(img) + '" alt="' + SG.utils.esc(p.nombre) + '" loading="lazy" ' +
               'onerror="this.src=\'img/placeholders/placeholder.svg\'" />' +
        '</div>' +
        '<div class="card-body">' +
          '<h3 class="card-title">' + SG.utils.esc(p.nombre) + '</h3>' +
          '<p class="card-desc">' + SG.utils.esc(p.descripcion || '') + '</p>' +
          '<div class="card-price">' + precioHtml + ' ' + badgeAgotado + '</div>' +
          (!agotado
            ? '<div class="qty-control" data-qty-control>' +
                '<button type="button" data-qty="-1" aria-label="Quitar uno">−</button>' +
                '<span data-qty-value>1</span>' +
                '<button type="button" data-qty="1" aria-label="Agregar uno">+</button>' +
              '</div>'
            : '') +
          '<button class="btn btn-primary btn-block" ' +
                  (agotado ? 'disabled' : '') +
                  ' data-action="add-product" data-id="' + SG.utils.esc(p.id) + '" data-marca="' + SG.utils.esc(p.marca) + '">' +
            (agotado ? 'Agotado' : 'Agregar al carrito') +
          '</button>' +
        '</div>' +
      '</article>';
  }

  // ---------- Buscar un servicio/producto por id ----------
  function getServicio(id) {
    return estado.servicios.find(function (s) { return s.id === id; }) || null;
  }
  function getProducto(id) {
    return estado.productos.find(function (p) { return p.id === id; }) || null;
  }

  return {
    cargar: cargar,
    getServicio: getServicio,
    getProducto: getProducto,
    estado: estado
  };
})();