// ============================================================
// PRONTA — Belleza & Cosmética | Motor de Tienda (Supabase + MP)
// ============================================================

const SUPABASE_URL = 'https://xipumaajfvfxksacigae.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpcHVtYWFqZnZmeGtzYWNpZ2FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxNzU0NzAsImV4cCI6MjEwOTc1MTQ3MH0.xkVSPpK8FATICtj1JlZw32PapeMllHvKgA4MMV_Zj2Y';

const PRONTA_CONFIG = {
  whatsapp: '5491157948612',
  discountPercent: 5,       // 5% OFF en Transferencia y Efectivo
  senaPercent: 30,          // 30% de seña para pago en Efectivo
  quantityDiscounts: [
    { minQty: 3, percent: 10 }, // 4 o más unidades -> 8% OFF
    { minQty: 5, percent: 15 }  // 6 o más unidades -> 13% OFF
  ],
  bank: {
    titular: 'María Agustina López',
    banco: 'Naranja X',
    cbu: '4530000800014412407155',
    alias: 'pronta.ok'
  }
};

// Servicios fijos de Limpieza Facial (coordinación directa por WhatsApp)
const LIMPIEZAS_SERVICES = [
  {
    id: 'srv-limpieza-1',
    name: 'Opción 1 · Limpieza Esencial en 5 Pasos',
    price: 45000,
    section: 'servicios',
    sub_type: 'limpiezas',
    whatsappOnly: true,
    presentation: 'Duración: 1h 10min aprox. · Sin extracciones',
    image: 'https://placehold.co/500x400/F6ECEC/333333?text=Limpieza+Esencial',
    description:
      'Protocolo esencial en 5 pasos para recuperar la vitalidad y la barrera cutánea: 1) Higiene con leche/gel limpiador y retorno eudérmico, 2) Exfoliación / Peeling según biotipo, 3) Principios activos concentrados, 4) Máscara específica, 5) Protección solar y pautas domiciliarias. Incluye diagnóstico inicial, productos de gabinete, asesoramiento 24/7 y ambientación. (Opcional: adicional Lectura de Tarot +$15.000).'
  },
  {
    id: 'srv-limpieza-2',
    name: 'Opción 2 · Limpieza Profunda + Extracciones y Crioterapia',
    price: 55000,
    section: 'servicios',
    sub_type: 'limpiezas',
    whatsappOnly: true,
    presentation: 'Duración: 1h 30min aprox. · Con extracciones + Ice Globe',
    image: 'https://placehold.co/500x400/EEF2EC/333333?text=Limpieza+Profunda',
    description:
      'Protocolo completo de 5 pasos esenciales + extracciones de comedones, folículos pilosos y quistes superficiales + parches/mascarillas con agua termal y geles descongestivos + Crioterapia Facial con sistema Ice Globe (antiinflamatorio, tensor, estimula colágeno y atenúa bolsas y ojeras). Ideal para pieles reactivas, con acné inflamatorio, rosácea, opacas o cansadas. (Opcional: adicional Lectura de Tarot +$15.000).'
  },
  {
    id: 'srv-limpieza-3',
    name: 'Opción 3 · Full Experience (Profunda + Crio + Masajes + Tarot)',
    price: 70000,
    section: 'servicios',
    sub_type: 'limpiezas',
    whatsappOnly: true,
    presentation: 'Duración: 2h aprox. · 45 min Drenaje Linfático + Tarot opcional',
    image: 'https://placehold.co/500x400/E8CACA/333333?text=Full+Experience',
    description:
      'Experiencia integral: Limpieza Profunda en 5 pasos + extracciones + Crioterapia Facial con Ice Globe + 45 minutos de masajes drenantes, reafirmantes y descontracturantes en rostro, cuello, zona cervical, hombros y escote + Detox Psicoemocional con Lectura de Tarot (opcional, incluida sin costo adicional).'
  }
];

// Cliente Supabase
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado global
let allProducts = [];
let allCategories = [];
let allShippingMethods = [];
let cart = JSON.parse(localStorage.getItem('pronta_cart_v2') || '[]');
let activeSection = 'all';
let activeCategoryId = 'all';
let activeServiceSub = 'all';
let searchTerm = '';

// Formateador de moneda ARS
function formatARS(num) {
  return '$' + Number(num || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

// Notificaciones Toast
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'pronta-toast';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// Copiar al portapapeles
window.copyText = function (text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Copiado: ${text}`);
  });
};

// Obtener nombre real de categoría (usa columna 'label' de Supabase)
function getCategoryLabel(cat) {
  if (!cat) return '';
  return cat.label || cat.name || cat.title || 'Sin categoría';
}

function getCategoryName(catId) {
  if (!catId) return '';
  const found = allCategories.find(
    c => String(c.id) === String(catId) || getCategoryLabel(c).toLowerCase() === String(catId).toLowerCase()
  );
  return found ? getCategoryLabel(found) : String(catId);
}

// Detectar a qué sección principal pertenece un ítem (productos | kits | servicios)
function detectProductSection(prod) {
  if (prod.section === 'servicios') return 'servicios';
  if (prod.section === 'kits') return 'kits';

  const raw = [
    prod.section,
    prod.type,
    prod.category,
    prod.category_name,
    getCategoryName(prod.category_id),
    prod.name
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (raw.includes('kit') || raw.includes('gift') || raw.includes('pack') || raw.includes('combo') || raw.includes('regalo')) {
    return 'kits';
  }
  if (raw.includes('emulsi') || raw.includes('limpiador') || raw.includes('cremas') || raw.includes('serums') || raw.includes('brumas')) {
    return 'productos';
  }
  if (
    raw.includes('servicio') ||
    raw.includes('limpieza') ||
    raw.includes('producci') ||
    raw.includes('personalizad') ||
    raw.includes('curso') ||
    raw.includes('manual') ||
    raw.includes('crea tu') ||
    raw.includes('turno') ||
    raw.includes('protocolo')
  ) {
    return 'servicios';
  }
  return 'productos';
}

// Detectar sub-tipo dentro de Servicios (limpiezas | producciones | crea)
function detectServiceSubtype(prod) {
  if (prod.sub_type) return prod.sub_type;
  const raw = [prod.category, prod.name, prod.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (raw.includes('limpieza')) return 'limpiezas';
  if (raw.includes('producci') || raw.includes('personalizad')) return 'producciones';
  if (raw.includes('crea tu') || raw.includes('manual') || raw.includes('curso')) return 'crea';
  return 'limpiezas';
}

function getSectionLabel(section) {
  if (section === 'kits') return 'Kits & Gift';
  if (section === 'servicios') return 'Servicio';
  return 'Producto';
}

// Link de WhatsApp para coordinar turno de un servicio
function getServiceWhatsAppUrl(prod) {
  const text = `¡Hola PRONTA! Quiero coordinar un turno por privado para:\n• ${prod.name} (${formatARS(prod.price)})\n\n¿Qué días y horarios tenés disponibles?`;
  return `https://wa.me/${PRONTA_CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
}

// Buscar ítem tanto en Supabase como en los servicios fijos
function findItemById(itemId) {
  return (
    LIMPIEZAS_SERVICES.find(s => String(s.id) === String(itemId)) ||
    allProducts.find(p => String(p.id) === String(itemId))
  );
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  handleMercadoPagoReturn();
  bindUIEvents();
  syncCustomerProfileUI();
  await loadStoreData();
  renderCart();
});

// Retorno de Mercado Pago
function handleMercadoPagoReturn() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status') || params.get('collection_status') || params.get('payment_status');
  const lastOrderId = localStorage.getItem('pronta_last_order');

  if ((status === 'approved' || status === 'success') && lastOrderId) {
    cart = [];
    saveCart();
    localStorage.removeItem('pronta_last_order');
    window.history.replaceState({}, document.title, window.location.pathname);
    setTimeout(() => {
      showToast('¡Pago acreditado en Mercado Pago! Tu pedido está confirmado.');
    }, 600);
  }
}

// Cargar datos reales desde Supabase
async function loadStoreData() {
  try {
    const [catRes, prodRes, shipRes] = await Promise.all([
      sb.from('categories').select('*'),
      sb.from('products').select('*').order('created_at', { ascending: false }),
      sb.from('shipping_methods').select('*')
    ]);

    allCategories = catRes.data || [];
    allProducts = prodRes.data || [];
    allShippingMethods = shipRes.data || [];

    renderCategories();
    renderCatalog();
    renderNewlyArrived();
    populateShippingOptions();
  } catch (err) {
    console.error('Error cargando datos de Supabase:', err);
    const grid = document.getElementById('products-grid');
    if (grid) {
      grid.innerHTML =
        '<div class="col-12 text-center py-5 text-danger">No se pudo conectar con el catálogo. Verificá tu conexión.</div>';
    }
  }
}

// ============================================================
// RENDERIZADO: CATEGORÍAS (COSMÉTICA), CATÁLOGO Y NEWLY ARRIVED
// ============================================================
function renderCategories() {
  const container = document.getElementById('categories-container');
  if (!container) return;

  if (!allCategories.length) {
    container.innerHTML = `
      <div class="swiper-slide"><div class="category-item" onclick="selectCatalogTab('productos')"><h3 class="fs-6 mb-0">Productos</h3></div></div>
      <div class="swiper-slide"><div class="category-item" onclick="selectCatalogTab('kits')"><h3 class="fs-6 mb-0">Kits & Gift</h3></div></div>
      <div class="swiper-slide"><div class="category-item" onclick="selectCatalogTab('servicios')"><h3 class="fs-6 mb-0">Servicios</h3></div></div>
    `;
  } else {
    container.innerHTML = allCategories.map(cat => {
      const label = getCategoryLabel(cat);
      const isActive = String(activeCategoryId) === String(cat.id);
      return `
        <div class="swiper-slide">
          <div class="category-item ${isActive ? 'active-cat' : ''}" onclick="filterByCategory('${cat.id}')">
            <h3 class="category-title fs-6 mb-0">${label}</h3>
          </div>
        </div>
      `;
    }).join('');
  }

  new Swiper('.category-carousel', {
    slidesPerView: 2,
    spaceBetween: 16,
    navigation: {
      nextEl: '.category-carousel-next',
      prevEl: '.category-carousel-prev'
    },
    breakpoints: {
      576: { slidesPerView: 3 },
      768: { slidesPerView: 4 },
      1200: { slidesPerView: 5 }
    }
  });
}

function buildProductCard(prod, isSlide = false) {
  const section = detectProductSection(prod);
  const imgUrl = prod.image || prod.image_url || 'https://placehold.co/400x400/FAF8F6/333333?text=PRONTA';
  const price = Number(prod.price || 0);
  const subtitle = prod.presentation || prod.volume || getCategoryName(prod.category_id || prod.category) || getSectionLabel(section);

  const isWhatsAppService = prod.whatsappOnly === true || (section === 'servicios' && detectServiceSubtype(prod) === 'limpiezas');

  const actionButton = isWhatsAppService
    ? `<a href="${getServiceWhatsAppUrl(prod)}" target="_blank" class="btn btn-pronta btn-sm w-100 rounded-3 py-2 text-decoration-none">
         Coordinar Turno por privado
       </a>`
    : `<button class="btn btn-pronta btn-sm w-100 rounded-3 py-2" onclick="addToCart('${prod.id}')">
         Agregar al carrito
       </button>`;

  const priceRowRight = isWhatsAppService
    ? `<span class="small text-pronta-sage fw-semibold">Turno previo</span>`
    : `<span class="small text-success fw-semibold">5% OFF transf.</span>`;

  const cardInner = `
    <div class="product-item position-relative">
      <div>
        <figure onclick="openProductDetail('${prod.id}')">
          <img src="${imgUrl}" alt="${prod.name}" loading="lazy">
        </figure>
        <span class="product-badge-section">${getSectionLabel(section)}</span>
        <h3 onclick="openProductDetail('${prod.id}')">${prod.name}</h3>
        <div class="small text-muted mb-2">${subtitle}</div>
      </div>
      <div>
        <div class="d-flex justify-content-between align-items-center mb-3">
          <span class="price">${formatARS(price)}</span>
          ${priceRowRight}
        </div>
        ${actionButton}
      </div>
    </div>
  `;

  return isSlide
    ? `<div class="swiper-slide h-auto">${cardInner}</div>`
    : `<div class="col">${cardInner}</div>`;
}

function buildCreaTuCosmeticaCard() {
  const waText = encodeURIComponent('¡Hola PRONTA! Quiero que me avisen cuando lancen los manuales y cursos de Crea Tu Cosmética.');
  return `
    <div class="col-12">
      <div class="bg-pronta-sage rounded-4 p-4 p-md-5 text-center border" style="border-color:#A3B19B !important;">
        <span class="product-badge-section mb-2">En Producción · Próximamente</span>
        <h3 class="mb-2">Crea Tu Cosmética</h3>
        <p class="text-muted mx-auto mb-4" style="max-width:560px;">
          Estamos preparando manuales prácticos y cursos de cosmética casera para que aprendas a formular tus propios productos desde cero.
        </p>
        <a href="https://wa.me/${PRONTA_CONFIG.whatsapp}?text=${waText}" target="_blank" class="btn btn-pronta rounded-3 px-4">
          Avisarme por WhatsApp cuando salga
        </a>
      </div>
    </div>
  `;
}

function renderCatalog() {
  const grid = document.getElementById('products-grid');
  const statusEl = document.getElementById('catalog-filter-status');
  const subBar = document.getElementById('services-subfilters');
  if (!grid) return;

  if (subBar) {
    subBar.classList.toggle('d-none', activeSection !== 'servicios');
  }

  const combinedCatalog = [...allProducts, ...LIMPIEZAS_SERVICES];

  if (activeSection === 'servicios' && activeServiceSub === 'crea') {
    const creaItems = combinedCatalog.filter(
      p => detectProductSection(p) === 'servicios' && detectServiceSubtype(p) === 'crea'
    );
    if (statusEl) statusEl.textContent = 'Servicios · Crea Tu Cosmética (Manuales & Cursos)';
    if (!creaItems.length) {
      grid.innerHTML = buildCreaTuCosmeticaCard();
      return;
    }
    grid.innerHTML = creaItems.map(p => buildProductCard(p, false)).join('');
    return;
  }

  const filtered = combinedCatalog.filter(prod => {
    const sec = detectProductSection(prod);
    const matchSection = activeSection === 'all' || sec === activeSection;
    const matchServiceSub =
      activeSection !== 'servicios' ||
      activeServiceSub === 'all' ||
      detectServiceSubtype(prod) === activeServiceSub;

    const selectedCatName = getCategoryName(activeCategoryId).toLowerCase();
    const matchCategory =
      activeCategoryId === 'all' ||
      String(prod.category_id) === String(activeCategoryId) ||
      String(prod.category || '').toLowerCase() === String(activeCategoryId).toLowerCase() ||
      String(prod.category || '').toLowerCase() === selectedCatName;

    const matchSearch =
      !searchTerm ||
      (prod.name || '').toLowerCase().includes(searchTerm) ||
      (prod.description || '').toLowerCase().includes(searchTerm);

    return matchSection && matchServiceSub && matchCategory && matchSearch;
  });

  if (statusEl) {
    if (activeCategoryId !== 'all') {
      statusEl.textContent = `Mostrando ${filtered.length} producto(s) en ${getCategoryName(activeCategoryId)}`;
    } else {
      const secLabel = activeSection === 'all' ? 'todo el catálogo' : getSectionLabel(activeSection);
      statusEl.textContent = `Mostrando ${filtered.length} ítem(s) en ${secLabel}`;
    }
  }

  if (!filtered.length) {
    let emptyHtml = `
      <div class="col-12 text-center py-5 text-muted">
        No encontramos ítems en esta sección todavía.
        <div class="mt-2">
          <button class="btn btn-sm btn-outline-pronta" onclick="resetFilters()">Ver todo el catálogo</button>
        </div>
      </div>
    `;
    if (activeSection === 'servicios' && activeServiceSub === 'all') {
      emptyHtml += buildCreaTuCosmeticaCard();
    }
    grid.innerHTML = emptyHtml;
    return;
  }

  let html = filtered.map(p => buildProductCard(p, false)).join('');
  if (activeSection === 'servicios' && activeServiceSub === 'all') {
    html += buildCreaTuCosmeticaCard();
  }
  grid.innerHTML = html;
}

function renderNewlyArrived() {
  const container = document.getElementById('newly-arrived-container');
  if (!container) return;

  const flagged = allProducts.filter(p => p.is_new === true || p.featured === true);
  const arrivals = (flagged.length ? flagged : allProducts).slice(0, 8);

  if (!arrivals.length) {
    container.innerHTML = '<div class="swiper-slide text-muted py-4">Próximamente nuevos lanzamientos.</div>';
    return;
  }

  container.innerHTML = arrivals.map(p => buildProductCard(p, true)).join('');

  new Swiper('.new-arrivals-carousel', {
    slidesPerView: 1.2,
    spaceBetween: 20,
    navigation: {
      nextEl: '.new-arrivals-next',
      prevEl: '.new-arrivals-prev'
    },
    breakpoints: {
      576: { slidesPerView: 2 },
      992: { slidesPerView: 3 },
      1200: { slidesPerView: 4 }
    }
  });
}

// ============================================================
// FILTROS Y DETALLE DE PRODUCTO / SERVICIO
// ============================================================
window.selectCatalogTab = function (section) {
  activeSection = section;
  activeCategoryId = 'all';
  activeServiceSub = 'all';

  document.querySelectorAll('#catalog-tabs .nav-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });
  document.querySelectorAll('#services-subfilters button').forEach(btn => {
    btn.classList.toggle('active-pill', btn.dataset.sub === 'all');
  });

  const headerSelect = document.getElementById('header-category-filter');
  if (headerSelect) headerSelect.value = section;

  renderCategories();
  renderCatalog();
};

window.selectServiceSub = function (sub) {
  activeServiceSub = sub;
  document.querySelectorAll('#services-subfilters button').forEach(btn => {
    btn.classList.toggle('active-pill', btn.dataset.sub === sub);
  });
  renderCatalog();
};

window.filterByCategory = function (catId) {
  activeCategoryId = catId;
  activeSection = catId === 'all' ? 'all' : 'productos';
  activeServiceSub = 'all';

  document.querySelectorAll('#catalog-tabs .nav-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === activeSection);
  });

  renderCategories();
  renderCatalog();
  document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
};

window.resetFilters = function () {
  activeSection = 'all';
  activeCategoryId = 'all';
  activeServiceSub = 'all';
  searchTerm = '';
  const desktopInput = document.getElementById('desktop-search-input');
  if (desktopInput) desktopInput.value = '';
  selectCatalogTab('all');
};

window.openProductDetail = function (prodId) {
  const prod = findItemById(prodId);
  if (!prod) return;

  const section = detectProductSection(prod);
  const imgUrl = prod.image || prod.image_url || 'https://placehold.co/500x500/FAF8F6/333333?text=PRONTA';
  const body = document.getElementById('product-detail-body');
  const isWhatsAppService = prod.whatsappOnly === true || (section === 'servicios' && detectServiceSubtype(prod) === 'limpiezas');

  const modalAction = isWhatsAppService
    ? `<a href="${getServiceWhatsAppUrl(prod)}" target="_blank" class="btn btn-pronta btn-lg w-100 rounded-3 text-decoration-none">
         Coordinar Turno por privado
       </a>`
    : `<button class="btn btn-pronta btn-lg w-100 rounded-3" onclick="addToCart('${prod.id}'); bootstrap.Modal.getInstance(document.getElementById('productDetailModal')).hide();">
         Agregar al Carrito
       </button>`;

  const infoBadge = isWhatsAppService
    ? `<div class="small bg-light p-2 rounded-3 mb-4">
         ✨ Incluye diagnóstico previo, insumos esterilizados, aromaterapia y apoyo domiciliario.
       </div>`
    : `<div class="small bg-light p-2 rounded-3 mb-4">
         ✨ <strong>${formatARS(Number(prod.price) * 0.95)}</strong> abonando por Transferencia o Efectivo (5% OFF).
       </div>`;

  body.innerHTML = `
    <div class="row g-4 align-items-center">
      <div class="col-md-5">
        <img src="${imgUrl}" alt="${prod.name}" class="img-fluid rounded-4 w-100" style="object-fit:cover; max-height:340px;">
      </div>
      <div class="col-md-7">
        <span class="product-badge-section">${getSectionLabel(section)}</span>
        <h3 class="mb-1">${prod.name}</h3>
        ${prod.presentation ? `<div class="small text-pronta-sage fw-semibold mb-2">${prod.presentation}</div>` : ''}
        <div class="fs-4 fw-bold mb-3" style="color:#333333;">${formatARS(prod.price)}</div>
        <p class="text-muted small mb-3">${prod.description || 'Consultanos por WhatsApp para conocer más detalles y modo de uso.'}</p>
        ${infoBadge}
        ${modalAction}
      </div>
    </div>
  `;

  new bootstrap.Modal(document.getElementById('productDetailModal')).show();
};

// ============================================================
// CARRITO DE COMPRAS
// ============================================================
function saveCart() {
  localStorage.setItem('pronta_cart_v2', JSON.stringify(cart));
  renderCart();
}

window.addToCart = function (prodId) {
  const prod = findItemById(prodId);
  if (!prod) return;

  const existing = cart.find(i => String(i.productId) === String(prod.id));
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      productId: prod.id,
      name: prod.name,
      price: Number(prod.price || 0),
      section: detectProductSection(prod),
      qty: 1
    });
  }

  saveCart();
  showToast(`Agregado: ${prod.name}`);
};

window.updateCartQty = function (prodId, delta) {
  const idx = cart.findIndex(i => String(i.productId) === String(prodId));
  if (idx === -1) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  saveCart();
};

window.removeCartItem = function (prodId) {
  const idx = cart.findIndex(i => String(i.productId) === String(prodId));
  if (idx === -1) return;
  cart.splice(idx, 1);
  saveCart();
};

function getCartSubtotal() {
  return cart.reduce((acc, item) => acc + Number(item.price) * Number(item.qty), 0);
}

function getQuantityDiscountInfo() {
  const productCatalog =
    typeof allProducts !== 'undefined' && Array.isArray(allProducts)
      ? allProducts
      : (typeof products !== 'undefined' && Array.isArray(products) ? products : []);

  let eligibleQty = 0;
  let amount = 0;
  let maxPercent = 0;
  let nextRule = null;

  for (const item of cart) {
    if (item.section === 'servicios') continue;

    const qty = Number(item.qty || 0);
    const unitPrice = Number(item.price || 0);
    if (qty <= 0 || unitPrice <= 0) continue;

    const prodId = item.productId ?? item.id;
    const prod = productCatalog.find((p) => String(p.id) === String(prodId));

    let rawTiers = prod?.quantity_discounts ?? [];
    if (typeof rawTiers === 'string') {
      try { rawTiers = JSON.parse(rawTiers); } catch (_) { rawTiers = []; }
    }
    const tiers = Array.isArray(rawTiers) ? rawTiers : [];

    if (tiers.length > 0) {
      eligibleQty += qty;
    }

    const itemPct = getItemQuantityDiscountPercent(tiers, qty);
    if (itemPct > 0) {
      amount += Math.round((unitPrice * qty) * (itemPct / 100));
      if (itemPct > maxPercent) maxPercent = itemPct;
    }

    const upcoming = tiers
      .slice()
      .sort((a, b) => Number(a.minQty) - Number(b.minQty))
      .find((r) => qty < Number(r.minQty));

    if (upcoming && (!nextRule || Number(upcoming.minQty) - qty < Number(nextRule.minQty) - eligibleQty)) {
      nextRule = upcoming;
    }
  }

  return { eligibleQty, percent: maxPercent, amount, nextRule };
}

function getItemQuantityDiscountPercent(productOrTiers, qty) {
  const tiers = Array.isArray(productOrTiers)
    ? productOrTiers
    : (productOrTiers?.quantity_discounts || []);
  const count = Number(qty || 0);
  if (!Array.isArray(tiers) || tiers.length === 0 || count <= 0) return 0;

  const validTiers = tiers
    .filter(t => Number(t.minQty) <= count && Number(t.percent) > 0)
    .sort((a, b) => Number(b.minQty) - Number(a.minQty));

  return validTiers.length > 0 ? Number(validTiers[0].percent) : 0;
}
function renderCart() {
  const list = document.getElementById('cart-items-list');
  const rawSubtotal = getCartSubtotal();
  const qtyDisc = getQuantityDiscountInfo();
  const netSubtotal = rawSubtotal - qtyDisc.amount;
  const totalItems = cart.reduce((acc, item) => acc + item.qty, 0);

  const countBadge = document.getElementById('cart-count-badge');
  const desktopCount = document.getElementById('desktop-cart-count');
  const mobileBadge = document.getElementById('mobile-cart-badge');
  const headerTotal = document.getElementById('header-cart-total');
  const subtotalEl = document.getElementById('cart-subtotal');
  const checkoutBtn = document.getElementById('btn-open-checkout');

  if (countBadge) countBadge.textContent = totalItems;
  if (desktopCount) desktopCount.textContent = totalItems;
  if (mobileBadge) mobileBadge.textContent = totalItems;
  if (headerTotal) headerTotal.textContent = formatARS(netSubtotal);
  if (subtotalEl) {
    subtotalEl.innerHTML = qtyDisc.amount > 0
      ? `<span class="text-muted text-decoration-line-through small me-1">${formatARS(rawSubtotal)}</span> ${formatARS(netSubtotal)}`
      : formatARS(rawSubtotal);
  }
  if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;

  // Aviso dinámico de descuento por cantidad dentro del carrito
  let qtyBanner = document.getElementById('cart-qty-discount-banner');
  if (!qtyBanner && list && list.parentElement) {
    qtyBanner = document.createElement('div');
    qtyBanner.id = 'cart-qty-discount-banner';
    qtyBanner.className = 'small rounded-3 p-2 mt-2';
    list.parentElement.insertBefore(qtyBanner, list.nextSibling);
  }
  if (qtyBanner) {
    if (!cart.length) {
      qtyBanner.classList.add('d-none');
    } else if (qtyDisc.amount > 0) {
      qtyBanner.classList.remove('d-none');
      qtyBanner.style.backgroundColor = '#EEF2EC';
      qtyBanner.style.color = '#2f4f2f';
      const nextHint = qtyDisc.nextRule
        ? ` Sumá ${qtyDisc.nextRule.minQty - qtyDisc.eligibleQty} más para llegar al ${qtyDisc.nextRule.percent}% OFF.`
        : '';
      qtyBanner.innerHTML = `🎉 <strong>${qtyDisc.percent}% OFF por cantidad aplicado</strong> (-${formatARS(qtyDisc.amount)}).${nextHint}`;
    } else if (qtyDisc.nextRule) {
      qtyBanner.classList.remove('d-none');
      qtyBanner.style.backgroundColor = '#FAF8F6';
      qtyBanner.style.color = '#555555';
      const missing = qtyDisc.nextRule.minQty - qtyDisc.eligibleQty;
      qtyBanner.innerHTML = `✨ Sumá <strong>${missing} producto(s)</strong> más y obtené un <strong>${qtyDisc.nextRule.percent}% OFF</strong> por cantidad.`;
    } else {
      qtyBanner.classList.add('d-none');
    }
  }

  if (!list) return;

  if (!cart.length) {
    list.innerHTML = '<li class="list-group-item text-center text-muted py-4 border-0">Tu carrito está vacío.</li>';
    return;
  }

  list.innerHTML = cart.map(item => `
    <li class="list-group-item d-flex justify-content-between align-items-center py-3">
      <div class="me-2">
        <div class="fw-semibold small">${item.name}</div>
        <div class="text-muted" style="font-size:0.8rem;">${formatARS(item.price)} c/u</div>
      </div>
     <div class="d-flex align-items-center gap-2">
        <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="updateCartQty('${item.productId}', -1)">-</button>
        <span class="small fw-bold">${item.qty}</span>
        <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="updateCartQty('${item.productId}', 1)">+</button>
        <button type="button" class="btn btn-sm btn-outline-danger py-0 px-1" title="Eliminar producto" aria-label="Eliminar producto" onclick="removeCartItem('${item.productId}')">🗑️</button>
      </div>
    </li>
  `).join('');
}

// ============================================================
// CHECKOUT & 3 MEDIOS DE PAGO
// ============================================================
function populateShippingOptions() {
  const select = document.getElementById('chk-shipping');
  if (!select) return;

  if (!allShippingMethods.length) {
    select.innerHTML = '<option value="0" data-name="Retiro / A coordinar">Retiro / A coordinar ($0)</option>';
    return;
  }

  select.innerHTML = allShippingMethods.map(m => {
    const cost = Number(m.price || m.cost || 0);
    return `<option value="${cost}" data-name="${m.name || m.label}" data-threshold="${m.free_threshold || 0}">
      ${m.name || m.label} (${cost === 0 ? 'Gratis' : formatARS(cost)})
    </option>`;
  }).join('');
}

function renderCartShipping(currentSubtotal) {
  const box = document.getElementById('cart-shipping-box');
  if (!box) return;

  const hasOnlyServices = cart.length > 0 && cart.every(i => i.section === 'servicios');
  if (!cart.length || hasOnlyServices) {
    box.innerHTML = '';
    return;
  }

  const methods = (typeof allShippingMethods !== 'undefined' && Array.isArray(allShippingMethods))
    ? allShippingMethods
    : [];

  if (!methods.length) {
    box.innerHTML = '';
    return;
  }

  const savedName = localStorage.getItem('pronta_selected_shipping_name') || '';

  const optionsHtml = methods.map((m, idx) => {
    const label = m.name || m.label || 'Envío';
    const baseCost = Number(m.price ?? m.cost ?? 0);
    const threshold = Number(m.free_threshold ?? 0);
    const isFree = threshold > 0 && currentSubtotal >= threshold;
    const effectiveCost = isFree ? 0 : baseCost;
    const selected = savedName ? savedName === label : idx === 0;

    return `<option value="${effectiveCost}" data-name="${label}" data-threshold="${threshold}" ${selected ? 'selected' : ''}>
      ${label} (${effectiveCost === 0 ? 'Gratis' : formatARS(effectiveCost)})
    </option>`;
  }).join('');

  const freeHintsHtml = methods
    .filter(m => Number(m.free_threshold ?? 0) > 0)
    .map(m => {
      const label = m.name || m.label || 'Envío';
      const threshold = Number(m.free_threshold);
      const missing = Math.max(0, threshold - currentSubtotal);
      return missing === 0
        ? `<div class="small text-success">✅ Envío gratis habilitado en <strong>${label}</strong> (desde ${formatARS(threshold)}).</div>`
        : `<div class="small text-muted">🚚 Envío gratis en <strong>${label}</strong> a partir de <strong>${formatARS(threshold)}</strong> (te faltan ${formatARS(missing)}).</div>`;
    }).join('');

  box.innerHTML = `
    <label for="cart-shipping-select" class="form-label small fw-bold mb-1">Envío o retiro</label>
    <select id="cart-shipping-select" class="form-select form-select-sm mb-2">
      ${optionsHtml}
    </select>
    ${freeHintsHtml}
  `;

  const sel = document.getElementById('cart-shipping-select');
  if (sel) {
    const currentOpt = sel.options[sel.selectedIndex];
    if (currentOpt) {
      localStorage.setItem('pronta_selected_shipping_name', currentOpt.dataset.name || '');
    }
    sel.addEventListener('change', () => {
      const opt = sel.options[sel.selectedIndex];
      if (opt) {
        localStorage.setItem('pronta_selected_shipping_name', opt.dataset.name || '');
      }
      syncCheckoutShippingFromCart();
      if (typeof calculateCheckoutTotals === 'function') {
        calculateCheckoutTotals();
      }
    });
  }
}

function syncCheckoutShippingFromCart() {
  const chkSelect = document.getElementById('chk-shipping');
  const savedName = localStorage.getItem('pronta_selected_shipping_name');
  if (!chkSelect || !savedName) return;

  const idx = Array.from(chkSelect.options).findIndex(
    o => (o.dataset.name || o.textContent || '').trim() === savedName.trim()
  );
  if (idx >= 0) {
    chkSelect.selectedIndex = idx;
    chkSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
function getSelectedPaymentMethod() {
  const checked = document.querySelector('input[name="paymentMethod"]:checked');
  return checked ? checked.value : 'mercadopago';
}

function calculateCheckoutTotals() {
const rawSubtotal = getCartSubtotal();
const qtyDisc = getQuantityDiscountInfo();
const subtotal = rawSubtotal - qtyDisc.amount;
  const paymentMethod = getSelectedPaymentMethod();
  const hasOnlyServices = cart.length > 0 && cart.every(i => i.section === 'servicios');

  let shippingCost = 0;
  let shippingName = 'Servicio presencial (Sin envío)';

  const shipSelect = document.getElementById('chk-shipping');
  const shipNote = document.getElementById('shipping-note');

  if (hasOnlyServices) {
    if (shipSelect) shipSelect.disabled = true;
    if (shipNote) shipNote.textContent = 'Tu carrito contiene solo servicios, no se cobra envío.';
  } else if (shipSelect) {
    shipSelect.disabled = false;
    const opt = shipSelect.options[shipSelect.selectedIndex];
    if (opt) {
      shippingCost = Number(opt.value || 0);
      shippingName = opt.dataset.name || 'Envío';
      const threshold = Number(opt.dataset.threshold || 0);
      if (threshold > 0 && subtotal >= threshold) {
        shippingCost = 0;
        if (shipNote) shipNote.textContent = `¡Envío bonificado por superar ${formatARS(threshold)}!`;
      } else {
        if (shipNote) shipNote.textContent = '';
      }
    }
  }

  const hasDiscount = paymentMethod === 'transferencia' || paymentMethod === 'efectivo';
  const discount = hasDiscount ? Math.round(subtotal * (PRONTA_CONFIG.discountPercent / 100)) : 0;
  const total = subtotal - discount + shippingCost;
  const senaAmount = paymentMethod === 'efectivo' ? Math.round(total * (PRONTA_CONFIG.senaPercent / 100)) : 0;
  const cashRest = paymentMethod === 'efectivo' ? total - senaAmount : 0;

  return { subtotal, discount, shippingCost, shippingName, total, paymentMethod, senaAmount, cashRest, qtyDiscount: qtyDisc.amount, qtyDiscountPercent: qtyDisc.percent };
}

function updateCheckoutUI() {
  const t = calculateCheckoutTotals();

  const subEl = document.getElementById('chk-subtotal');
  const shipEl = document.getElementById('chk-shipping-cost');
  const totEl = document.getElementById('chk-total');
  if (subEl) subEl.textContent = formatARS(t.subtotal);
  if (shipEl) shipEl.textContent = t.shippingCost === 0 ? 'Gratis' : formatARS(t.shippingCost);
  if (totEl) totEl.textContent = formatARS(t.total);

  const discRow = document.getElementById('chk-discount-row');
  if (discRow) {
    if (t.discount > 0) {
      discRow.classList.remove('d-none');
      const discVal = document.getElementById('chk-discount');
      if (discVal) discVal.textContent = '-' + formatARS(t.discount);
    } else {
      discRow.classList.add('d-none');
    }
  }

  const bankBox = document.getElementById('bank-info-box');
  const senaRow = document.getElementById('chk-sena-row');

  if (bankBox) {
    if (t.paymentMethod === 'transferencia' || t.paymentMethod === 'efectivo') {
      bankBox.classList.remove('d-none');
    } else {
      bankBox.classList.add('d-none');
    }
  }

  if (senaRow) {
    if (t.paymentMethod === 'efectivo') {
      senaRow.classList.remove('d-none');
      const senaEl = document.getElementById('chk-sena-amount');
      const restEl = document.getElementById('chk-cash-rest');
      if (senaEl) senaEl.textContent = formatARS(t.senaAmount);
      if (restEl) restEl.textContent = formatARS(t.cashRest);
    } else {
      senaRow.classList.add('d-none');
    }
  }

  const btn = document.getElementById('btn-confirm-order');
  if (btn) {
    if (t.paymentMethod === 'mercadopago') {
      btn.textContent = `Pagar ${formatARS(t.total)} con Mercado Pago`;
    } else if (t.paymentMethod === 'transferencia') {
      btn.textContent = `Confirmar Pedido (${formatARS(t.total)} por Transferencia)`;
    } else {
      btn.textContent = `Confirmar Pedido (Seña ${formatARS(t.senaAmount)})`;
    }
  }
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  if (!cart.length) return;

  const btn = document.getElementById('btn-confirm-order');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Procesando pedido...';
  }

  const name = document.getElementById('chk-name')?.value.trim() || '';
  const email = document.getElementById('chk-email')?.value.trim() || '';
  const phone = document.getElementById('chk-phone')?.value.trim() || '';
  const address = document.getElementById('chk-address')?.value.trim() || '';

  customerProfile = { ...(customerProfile || {}), name, email, phone, address };
  upsertCustomerAccount(customerProfile);
  localStorage.setItem('pronta_customer_v1', JSON.stringify(customerProfile));
  syncCustomerProfileUI();
  const totals = calculateCheckoutTotals();

  const paymentLabels = {
    mercadopago: 'Mercado Pago',
    transferencia: 'Transferencia Bancaria (5% OFF)',
    efectivo: 'Efectivo con seña 50% (5% OFF)'
  };

  let savedOrderId = 'PR-' + Date.now().toString().slice(-6);
  try {
    const orderPayload = {
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      shipping_address: address,
      shipping_method: totals.shippingName,
      shipping_cost: totals.shippingCost,
      payment_method: paymentLabels[totals.paymentMethod],
      items: cart,
      total: totals.total,
      status: 'Pendiente'
    };

    const { data, error } = await sb.from('orders').insert([orderPayload]).select();
    if (!error && data && data[0] && data[0].id) {
      savedOrderId = data[0].id;
    } else if (error) {
      console.warn('Aviso al insertar orden en Supabase:', error.message);
    }
  } catch (err) {
    console.warn('Error guardando orden:', err);
  }

  localStorage.setItem('pronta_last_order', savedOrderId);

  if (totals.paymentMethod === 'mercadopago') {
    try {
      const response = await fetch('/api/create-preference', {        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
...(() => {
      const factor = totals.qtyDiscountPercent > 0 ? (1 - totals.qtyDiscountPercent / 100) : 1;
      return {
        items: cart.map(item => ({
          title: item.name || 'Producto PRONTA',
          quantity: item.qty,
          unit_price: Math.round(Number(item.price || 0) * (item.section !== 'servicios' ? factor : 1))
        }))
      };
    })(),
    payer: { name, email },
    shipping_cost: totals.shippingCost
  })
});

      const mpData = await response.json();
      const checkoutUrl = mpData.init_point || mpData.sandbox_init_point;

      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      } else {
        throw new Error('No se recibió el link de pago de Mercado Pago.');
      }
    } catch (err) {
      console.error('Error Mercado Pago:', err);
      showToast('Hubo un problema al conectar con Mercado Pago. Probá nuevamente.');
      if (btn) btn.disabled = false;
      updateCheckoutUI();
      return;
    }
  }

  const itemsText = cart.map(i => `• ${i.qty}x ${i.name} (${formatARS(i.price * i.qty)})`).join('\n');
  let amountSummaryHTML = `<strong>Total a transferir (5% OFF incluido):</strong> ${formatARS(totals.total)}`;
  let paymentMsg = `Medio de pago: Transferencia Bancaria (5% OFF)\nTotal a transferir: ${formatARS(totals.total)}`;

  if (totals.paymentMethod === 'efectivo') {
    amountSummaryHTML = `
      <div><strong>Total con 5% OFF:</strong> ${formatARS(totals.total)}</div>
      <div class="text-pronta"><strong>Seña a transferir ahora (50%):</strong> ${formatARS(totals.senaAmount)}</div>
      <div><strong>Saldo restante en efectivo:</strong> ${formatARS(totals.cashRest)}</div>
    `;
    paymentMsg = `Medio de pago: Efectivo con seña (5% OFF)\nTotal: ${formatARS(totals.total)}\nSeña a transferir (50%): ${formatARS(totals.senaAmount)}\nRestante en efectivo: ${formatARS(totals.cashRest)}`;
  }

  const waMessage = `¡Hola PRONTA! Acabo de realizar un pedido (#${savedOrderId}):\n\n` +
    `${itemsText}\n\n` +
    `Envío: ${totals.shippingName} (${formatARS(totals.shippingCost)})\n` +
    `${paymentMsg}\n\n` +
    `Mis datos:\nNombre: ${name}\nTel: ${phone}\nDirección/Nota: ${address || '-'}\n\n` +
    `¡Te adjunto el comprobante de transferencia!`;

  const waUrl = `https://wa.me/${PRONTA_CONFIG.whatsapp}?text=${encodeURIComponent(waMessage)}`;

  document.getElementById('checkout-form')?.classList.add('d-none');
  document.getElementById('checkout-success-view')?.classList.remove('d-none');
  const subTitle = document.getElementById('success-order-subtitle');
  const sumEl = document.getElementById('success-amount-summary');
  const waBtn = document.getElementById('btn-send-whatsapp');
  if (subTitle) subTitle.textContent = `Pedido #${savedOrderId} registrado para ${name}.`;
  if (sumEl) sumEl.innerHTML = amountSummaryHTML;
  if (waBtn) waBtn.href = waUrl;

  cart = [];
  saveCart();
  if (btn) btn.disabled = false;
}

// ============================================================
// EVENTOS DE INTERFAZ
// ============================================================
function bindUIEvents() {
  const desktopSearch = document.getElementById('desktop-search-input');
  if (desktopSearch) {
    desktopSearch.addEventListener('input', e => {
      searchTerm = e.target.value.trim().toLowerCase();
      renderCatalog();
    });
  }

  const headerCat = document.getElementById('header-category-filter');
  if (headerCat) {
    headerCat.addEventListener('change', e => {
      selectCatalogTab(e.target.value);
      document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  const mobileBtn = document.getElementById('mobile-search-btn');
  if (mobileBtn) {
    mobileBtn.addEventListener('click', () => {
      const val = document.getElementById('mobile-search-input')?.value || '';
      searchTerm = val.trim().toLowerCase();
      renderCatalog();
      document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  const btnOpenCheckout = document.getElementById('btn-open-checkout');
  if (btnOpenCheckout) {
    btnOpenCheckout.addEventListener('click', () => {
      const offcanvasEl = document.getElementById('offcanvasCart');
      const offcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl);
      if (offcanvas) offcanvas.hide();

      document.getElementById('checkout-form')?.classList.remove('d-none');
      document.getElementById('checkout-success-view')?.classList.add('d-none');
      prefillCheckoutFromCustomer();
      updateCheckoutUI();
      new bootstrap.Modal(document.getElementById('checkoutModal')).show();
    });
  }

  const shipSelect = document.getElementById('chk-shipping');
  if (shipSelect) {
    shipSelect.addEventListener('change', updateCheckoutUI);
  }

  document.querySelectorAll('.payment-option-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.payment-option-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      updateCheckoutUI();
    });
  });

  const checkoutForm = document.getElementById('checkout-form');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', handleCheckoutSubmit);
  }

  const custLoginForm = document.getElementById('customer-login-form');
  if (custLoginForm) {
    custLoginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const loginEmail = document.getElementById('login-cust-email')?.value.trim() || '';
      const loginPass = document.getElementById('login-cust-password')?.value || '';

      const localMatch = customerAccounts.find(
        acc => (acc.email || '').toLowerCase() === loginEmail.toLowerCase()
      );

      if (localMatch) {
        if (localMatch.password && localMatch.password !== loginPass) {
          showCustomerLoginFeedback('La contraseña no coincide con este email.', true);
          return;
        }
        customerProfile = { ...localMatch };
        localStorage.setItem('pronta_customer_v1', JSON.stringify(customerProfile));
        syncCustomerProfileUI();
        showCustomerLoginFeedback(`¡Bienvenida de nuevo, ${customerProfile.name || customerProfile.email}!`, false);
        showToast(`Sesión iniciada: ${customerProfile.name || customerProfile.email}`);
        await loadCustomerOrders();
        return;
      }

      try {
        const { data, error } = await sb
          .from('orders')
          .select('*')
          .ilike('customer_email', loginEmail)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && data && data.length) {
          const latestOrder = data[0];
          customerProfile = {
            name: latestOrder.customer_name || '',
            email: latestOrder.customer_email || loginEmail,
            password: loginPass,
            phone: latestOrder.customer_phone || '',
            address: latestOrder.shipping_address || '',
            province: '',
            postal: '',
            avatar: ''
          };
          upsertCustomerAccount(customerProfile);
          localStorage.setItem('pronta_customer_v1', JSON.stringify(customerProfile));
          syncCustomerProfileUI();
          showCustomerLoginFeedback('Cuenta encontrada por tu historial de pedidos. ¡Datos cargados!', false);
          showToast('Sesión iniciada');
          await loadCustomerOrders();
          return;
        }
      } catch (err) {
        console.warn('Error consultando cuenta en Supabase:', err);
      }

      showCustomerLoginFeedback('No encontramos una cuenta con ese email. Podés crearla en "Crear Cuenta / Mis Datos".', true);
    });
  }

  const avatarInput = document.getElementById('cust-avatar-file');
  if (avatarInput) {
    avatarInput.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const previewImg = document.getElementById('cust-avatar-preview');
        const placeholder = document.getElementById('cust-avatar-placeholder');
        if (previewImg && result) {
          previewImg.src = result;
          previewImg.classList.remove('d-none');
        }
        if (placeholder) placeholder.classList.add('d-none');
      };
      reader.readAsDataURL(file);
    });
  }

  const custForm = document.getElementById('customer-profile-form');
  if (custForm) {
    custForm.addEventListener('submit', e => {
      e.preventDefault();
      const previewImg = document.getElementById('cust-avatar-preview');
      const currentAvatar = previewImg && !previewImg.classList.contains('d-none') && previewImg.src
        ? previewImg.src
        : (customerProfile?.avatar || '');

      customerProfile = {
        name: document.getElementById('cust-name')?.value.trim() || '',
        email: document.getElementById('cust-email')?.value.trim() || '',
        password: document.getElementById('cust-password')?.value || '',
        phone: document.getElementById('cust-phone')?.value.trim() || '',
        address: document.getElementById('cust-address')?.value.trim() || '',
        province: document.getElementById('cust-province')?.value.trim() || '',
        postal: document.getElementById('cust-postal')?.value.trim() || '',
        avatar: currentAvatar
      };
      upsertCustomerAccount(customerProfile);
      localStorage.setItem('pronta_customer_v1', JSON.stringify(customerProfile));
      syncCustomerProfileUI();
      showToast('¡Tus datos quedaron guardados!');
    });
  }
}

// ============================================================
// PERFIL DE CLIENTE E HISTORIAL DE PEDIDOS
// ============================================================
let customerProfile = JSON.parse(localStorage.getItem('pronta_customer_v1') || 'null');

function renderAvatarPreview(avatarDataUrl, fallbackLabel = '?') {
  const previewImg = document.getElementById('cust-avatar-preview');
  const placeholder = document.getElementById('cust-avatar-placeholder');
  const headerIcon = document.getElementById('header-customer-icon');
  const headerAvatar = document.getElementById('header-customer-avatar');

  if (avatarDataUrl) {
    if (previewImg) {
      previewImg.src = avatarDataUrl;
      previewImg.classList.remove('d-none');
    }
    if (placeholder) placeholder.classList.add('d-none');
    if (headerAvatar) {
      headerAvatar.src = avatarDataUrl;
      headerAvatar.classList.remove('d-none');
    }
    if (headerIcon) headerIcon.classList.add('d-none');
  } else {
    if (previewImg) {
      previewImg.src = '';
      previewImg.classList.add('d-none');
    }
    if (placeholder) {
      placeholder.textContent = (fallbackLabel || '?').charAt(0).toUpperCase();
      placeholder.classList.remove('d-none');
    }
    if (headerAvatar) {
      headerAvatar.src = '';
      headerAvatar.classList.add('d-none');
    }
    if (headerIcon) headerIcon.classList.remove('d-none');
  }
}

function syncCustomerProfileUI() {
  const headerBadge = document.getElementById('header-customer-name');
  const navLogin = document.getElementById('cust-nav-login');
  const navOrders = document.getElementById('cust-nav-orders');
  const profileBtn = document.getElementById('cust-tab-profile-btn');
  const profileSub = document.getElementById('cust-profile-subtitle');
  const logoutBtn = document.getElementById('btn-cust-logout');
  const saveBtn = document.getElementById('btn-cust-save');

  const isLoggedIn = Boolean(customerProfile && customerProfile.email);

  if (isLoggedIn) {
    const firstName = (customerProfile.name || customerProfile.email).trim().split(' ')[0];
    if (headerBadge) {
      headerBadge.textContent = firstName;
      headerBadge.classList.remove('d-none');
    }
    renderAvatarPreview(customerProfile.avatar || '', firstName);
    if (navLogin) navLogin.classList.add('d-none');
    if (navOrders) navOrders.classList.remove('d-none');
    if (profileBtn) {
      profileBtn.textContent = 'Mis Datos';
      bootstrap.Tab.getOrCreateInstance(profileBtn).show();
    }
    if (profileSub) profileSub.textContent = 'Sesión iniciada. Podés actualizar tus datos, foto o revisar tus pedidos en la pestaña "Mis Pedidos".';
    if (logoutBtn) logoutBtn.classList.remove('d-none');
    if (saveBtn) saveBtn.textContent = 'Guardar Cambios';

    const fields = {
      'cust-name': customerProfile.name,
      'cust-email': customerProfile.email,
      'cust-password': customerProfile.password,
      'cust-phone': customerProfile.phone,
      'cust-address': customerProfile.address,
      'cust-province': customerProfile.province,
      'cust-postal': customerProfile.postal,
      'login-cust-email': customerProfile.email
    };
    Object.entries(fields).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    });
  } else {
    if (headerBadge) {
      headerBadge.textContent = '';
      headerBadge.classList.add('d-none');
    }
    renderAvatarPreview('', '?');
    if (navLogin) navLogin.classList.remove('d-none');
    if (navOrders) navOrders.classList.add('d-none');
    if (profileBtn) profileBtn.textContent = 'Crear Cuenta';
    if (profileSub) profileSub.textContent = 'Completá tus datos para crear tu cuenta y agilizar tus próximas compras.';
    if (logoutBtn) logoutBtn.classList.add('d-none');
    if (saveBtn) saveBtn.textContent = 'Crear Cuenta';

    const loginBtn = document.getElementById('cust-tab-login-btn');
    if (loginBtn) bootstrap.Tab.getOrCreateInstance(loginBtn).show();
  }
}

function prefillCheckoutFromCustomer() {
  if (!customerProfile) return;
  const combinedAddress = [
    customerProfile.address,
    customerProfile.province ? `Prov. ${customerProfile.province}` : '',
    customerProfile.postal ? `CP ${customerProfile.postal}` : ''
  ]
    .filter(Boolean)
    .join(' · ');

  const map = {
    'chk-name': customerProfile.name,
    'chk-email': customerProfile.email,
    'chk-phone': customerProfile.phone,
    'chk-address': combinedAddress || customerProfile.address
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && !el.value && val) el.value = val;
  });
}

window.clearCustomerProfile = function () {
  customerProfile = null;
  localStorage.removeItem('pronta_customer_v1');
  document.getElementById('customer-profile-form')?.reset();
  document.getElementById('customer-login-form')?.reset();
  const ordersList = document.getElementById('cust-orders-list');
  if (ordersList) ordersList.innerHTML = '';
  syncCustomerProfileUI();
  showToast('Sesión cerrada');
};

window.loadCustomerOrders = async function () {
  const listEl = document.getElementById('cust-orders-list');
  const ownerEl = document.getElementById('cust-orders-owner');
  if (!listEl) return;

  if (!customerProfile || !customerProfile.email) {
    listEl.innerHTML = '<div class="text-center text-muted small py-4">Iniciá sesión para ver tus pedidos.</div>';
    return;
  }

  const email = customerProfile.email.trim().toLowerCase();
  if (ownerEl) ownerEl.textContent = email;
  listEl.innerHTML = '<div class="text-center text-muted small py-4">Cargando tus pedidos...</div>';

  try {
    const { data, error } = await sb
      .from('orders')
      .select('*')
      .ilike('customer_email', email)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || !data.length) {
      listEl.innerHTML = '<div class="text-center text-muted small py-4">Todavía no tenés pedidos realizados con esta cuenta.</div>';
      return;
    }

    listEl.innerHTML = data.map(o => {
      const dateStr = o.created_at
        ? new Date(o.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';
      const itemsText = Array.isArray(o.items)
        ? o.items.map(i => `${i.qty}x ${i.name}`).join(' · ')
        : '';
      return `
        <div class="border rounded-3 p-3 bg-light">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <strong class="small">Pedido #${String(o.id).slice(0, 8)} ${dateStr ? '· ' + dateStr : ''}</strong>
            <span class="badge rounded-pill" style="background-color:#D4A3A3; color:#333333;">${o.status || 'Pendiente'}</span>
          </div>
          <div class="small text-muted mb-1">${itemsText}</div>
          <div class="d-flex justify-content-between small fw-bold">
            <span>${o.payment_method || ''}</span>
            <span>${formatARS(o.total)}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    listEl.innerHTML = '<div class="text-center text-danger small py-4">No se pudieron cargar tus pedidos en este momento.</div>';
  }
};

let customerAccounts = JSON.parse(localStorage.getItem('pronta_customer_accounts_v1') || '[]');

function upsertCustomerAccount(profile) {
  if (!profile || !profile.email) return;
  const normalizedEmail = profile.email.trim().toLowerCase();
  const idx = customerAccounts.findIndex(acc => (acc.email || '').toLowerCase() === normalizedEmail);
  const existing = idx !== -1 ? customerAccounts[idx] : {};
  const merged = {
    ...existing,
    ...profile,
    email: profile.email.trim(),
    password: profile.password !== undefined && profile.password !== '' ? profile.password : (existing.password || '')
  };
  if (idx !== -1) {
    customerAccounts[idx] = merged;
  } else {
    customerAccounts.push(merged);
  }
  localStorage.setItem('pronta_customer_accounts_v1', JSON.stringify(customerAccounts));
}

window.switchToCustomerRegisterTab = function () {
  const regBtn = document.getElementById('cust-tab-profile-btn');
  if (regBtn) bootstrap.Tab.getOrCreateInstance(regBtn).show();
};

function showCustomerLoginFeedback(message, isError = false) {
  const fb = document.getElementById('cust-login-feedback');
  if (!fb) return;
  fb.textContent = message;
  fb.className = `small mt-2 ${isError ? 'text-danger fw-semibold' : 'text-success fw-semibold'}`;
  fb.classList.remove('d-none');
}
