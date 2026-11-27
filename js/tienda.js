// ============================================================
// PRONTA — Belleza & Cosmética | Motor de Tienda (Supabase + MP)
// ============================================================

const SUPABASE_URL = 'https://xipumaajfvfxksacigae.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpcHVtYWFqZnZmeGtzYWNpZ2FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxNzU0NzAsImV4cCI6MjEwOTc1MTQ3MH0.xkVSPpK8FATICtj1JlZw32PapeMllHvKgA4MMV_Zj2Y';

const PRONTA_CONFIG = {
  whatsapp: '5491157948612',
  discountPercent: 5,       // 5% OFF en Transferencia y Efectivo
  senaPercent: 30,          // 30% de seña para pago en Efectivo
  bank: {
    titular: 'María Agustina López',
    banco: 'Naranja',
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
let customerProfile = JSON.parse(localStorage.getItem('pronta_customer_v1') || 'null');
let currentAuthUser = null;
let activeSection = 'all';
let activeCategoryId = 'all';
let activeServiceSub = 'all';
let searchTerm = '';

// Escapado básico para evitar inyección HTML al pintar datos dinámicos
function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
// INICIALIZACIÓN Y SESIÓN DE SUPABASE AUTH
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  handleMercadoPagoReturn();
  bindUIEvents();
  await initAuthSession();
  await loadStoreData();
  renderCart();
});

async function initAuthSession() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    currentAuthUser = session?.user || null;
    if (currentAuthUser) {
      await fetchAndApplyCustomerProfile(currentAuthUser);
    } else {
      syncCustomerProfileUI();
    }

    sb.auth.onAuthStateChange(async (_event, nextSession) => {
      currentAuthUser = nextSession?.user || null;
      if (currentAuthUser) {
        await fetchAndApplyCustomerProfile(currentAuthUser);
      } else {
        syncCustomerProfileUI();
      }
    });
  } catch (err) {
    console.warn('Error inicializando sesión de Supabase:', err);
    syncCustomerProfileUI();
  }
}

async function fetchAndApplyCustomerProfile(user) {
  if (!user) return;
  try {
    const { data, error } = await sb
      .from('customer_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;

    customerProfile = {
      id: user.id,
      name: data?.full_name || user.user_metadata?.full_name || '',
      email: data?.email || user.email || '',
      phone: data?.phone || user.user_metadata?.phone || '',
      address: data?.address || user.user_metadata?.address || '',
      province: data?.province || user.user_metadata?.province || '',
      postal: data?.postal_code || user.user_metadata?.postal_code || ''
    };
    localStorage.setItem('pronta_customer_v1', JSON.stringify(customerProfile));
    syncCustomerProfileUI();
  } catch (err) {
    console.warn('No se pudo cargar customer_profiles:', err);
    customerProfile = {
      id: user.id,
      name: user.user_metadata?.full_name || '',
      email: user.email || '',
      phone: '',
      address: '',
      province: '',
      postal: ''
    };
    syncCustomerProfileUI();
  }
}

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
    document.getElementById('products-grid').innerHTML =
      '<div class="col-12 text-center py-5 text-danger">No se pudo conectar con el catálogo. Verificá tu conexión.</div>';
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
      const label = escapeHTML(getCategoryLabel(cat));
      const isActive = String(activeCategoryId) === String(cat.id);
      return `
        <div class="swiper-slide">
          <div class="category-item ${isActive ? 'active-cat' : ''}" onclick="filterByCategory('${escapeHTML(cat.id)}')">
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
  const imgUrl = escapeHTML(prod.image || prod.image_url || 'https://placehold.co/400x400/FAF8F6/333333?text=PRONTA');
  const safeName = escapeHTML(prod.name);
  const price = Number(prod.price || 0);
  const subtitle = escapeHTML(prod.presentation || prod.volume || getCategoryName(prod.category_id || prod.category) || getSectionLabel(section));

  const isWhatsAppService = prod.whatsappOnly === true || (section === 'servicios' && detectServiceSubtype(prod) === 'limpiezas');

  const actionButton = isWhatsAppService
    ? `<a href="${getServiceWhatsAppUrl(prod)}" target="_blank" rel="noopener noreferrer" class="btn btn-pronta btn-sm w-100 rounded-3 py-2 text-decoration-none">
         Coordinar Turno por privado
       </a>`
    : `<button class="btn btn-pronta btn-sm w-100 rounded-3 py-2" onclick="addToCart('${escapeHTML(prod.id)}')">
         Agregar al carrito
       </button>`;

  const priceRowRight = isWhatsAppService
    ? `<span class="small text-pronta-sage fw-semibold">Turno previo</span>`
    : `<span class="small text-success fw-semibold">5% OFF transf.</span>`;

  const cardInner = `
    <div class="product-item position-relative">
      <div>
        <figure onclick="openProductDetail('${escapeHTML(prod.id)}')">
          <img src="${imgUrl}" alt="${safeName}" loading="lazy">
        </figure>
        <span class="product-badge-section">${escapeHTML(getSectionLabel(section))}</span>
        <h3 onclick="openProductDetail('${escapeHTML(prod.id)}')">${safeName}</h3>
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
        <a href="https://wa.me/${PRONTA_CONFIG.whatsapp}?text=${waText}" target="_blank" rel="noopener noreferrer" class="btn btn-pronta rounded-3 px-4">
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
  const imgUrl = escapeHTML(prod.image || prod.image_url || 'https://placehold.co/500x500/FAF8F6/333333?text=PRONTA');
  const safeName = escapeHTML(prod.name);
  const safePresentation = escapeHTML(prod.presentation || '');
  const safeDescription = escapeHTML(prod.description || 'Consultanos por WhatsApp para conocer más detalles y modo de uso.');
  const body = document.getElementById('product-detail-body');
  const isWhatsAppService = prod.whatsappOnly === true || (section === 'servicios' && detectServiceSubtype(prod) === 'limpiezas');

  const modalAction = isWhatsAppService
    ? `<a href="${getServiceWhatsAppUrl(prod)}" target="_blank" rel="noopener noreferrer" class="btn btn-pronta btn-lg w-100 rounded-3 text-decoration-none">
         Coordinar Turno por privado
       </a>`
    : `<button class="btn btn-pronta btn-lg w-100 rounded-3" onclick="addToCart('${escapeHTML(prod.id)}'); bootstrap.Modal.getInstance(document.getElementById('productDetailModal')).hide();">
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
        <img src="${imgUrl}" alt="${safeName}" class="img-fluid rounded-4 w-100" style="object-fit:cover; max-height:340px;">
      </div>
      <div class="col-md-7">
        <span class="product-badge-section">${escapeHTML(getSectionLabel(section))}</span>
        <h3 class="mb-1">${safeName}</h3>
        ${safePresentation ? `<div class="small text-pronta-sage fw-semibold mb-2">${safePresentation}</div>` : ''}
        <div class="fs-4 fw-bold mb-3" style="color:#333333;">${formatARS(prod.price)}</div>
        <p class="text-muted small mb-3">${safeDescription}</p>
        ${infoBadge}
        ${modalAction}
      </div>
    </div>
  `;

  new bootstrap.Modal(document.getElementById('productDetailModal')).show();
};

// ============================================================
// CARRITO DE COMPRAS (CON DESCUENTOS POR CANTIDAD Y ENVÍO GRATIS)
// ============================================================
function getProductQtyRules(prod) {
  if (!prod) return [];
  const rawList =
    Array.isArray(prod.quantity_discounts) && prod.quantity_discounts.length
      ? prod.quantity_discounts
      : Array.isArray(prod.volumeRules) && prod.volumeRules.length
        ? prod.volumeRules
        : [];

  return rawList
    .map(r => ({
      minQty: Number(r.minQty || r.min_qty || 0),
      percent: Number(r.percent ?? r.discountPercent ?? r.discount_percent ?? 0)
    }))
    .filter(r => r.minQty > 0 && r.percent > 0)
    .sort((a, b) => a.minQty - b.minQty);
}

function getCartItemPricing(item) {
  const prod = findItemById(item.productId);
  const rules = getProductQtyRules(prod);
  const qty = Number(item.qty || 1);
  const baseUnitPrice = Number(item.price || 0);

  let appliedRule = null;
  let nextRule = null;
  for (const r of rules) {
    if (qty >= r.minQty) appliedRule = r;
    else if (!nextRule) nextRule = r;
  }

  const discountPercent = appliedRule ? appliedRule.percent : 0;
  const finalUnitPrice = Math.round(baseUnitPrice * (1 - discountPercent / 100));
  const lineBaseTotal = baseUnitPrice * qty;
  const lineFinalTotal = finalUnitPrice * qty;
  const lineSavings = lineBaseTotal - lineFinalTotal;

  return {
    baseUnitPrice,
    finalUnitPrice,
    discountPercent,
    lineBaseTotal,
    lineFinalTotal,
    lineSavings,
    nextRule
  };
}

function getCartTotals() {
  let rawSubtotal = 0;
  let subtotal = 0;
  for (const item of cart) {
    const p = getCartItemPricing(item);
    rawSubtotal += p.lineBaseTotal;
    subtotal += p.lineFinalTotal;
  }
  return {
    rawSubtotal,
    qtyDiscountTotal: rawSubtotal - subtotal,
    subtotal
  };
}

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

function getCartSubtotal() {
  return getCartTotals().subtotal;
}

function buildCartFreeShippingBanner(subtotal) {
  const hasOnlyServices = cart.length > 0 && cart.every(i => i.section === 'servicios');
  if (!cart.length || hasOnlyServices) return '';

  const thresholds = allShippingMethods
    .filter(m => m.active !== false && Number(m.free_threshold || 0) > 0)
    .sort((a, b) => Number(a.free_threshold) - Number(b.free_threshold));

  if (!thresholds.length) return '';

  const rows = thresholds.map(m => {
    const limit = Number(m.free_threshold);
    const label = escapeHTML(m.name || m.label || 'Envío');
    if (subtotal >= limit) {
      return `<div class="small text-success fw-semibold">✓ ¡Tenés ${label} GRATIS!</div>`;
    }
    const missing = limit - subtotal;
    const pct = Math.min(100, Math.round((subtotal / limit) * 100));
    return `
      <div class="mb-2">
        <div class="small text-muted">
          Te faltan <strong class="text-dark">${formatARS(missing)}</strong> para <strong>${label} GRATIS</strong>
        </div>
        <div class="progress mt-1" style="height:5px;">
          <div class="progress-bar" role="progressbar" style="width:${pct}%; background-color:#A3B19B;"></div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <li class="list-group-item bg-light border-0 rounded-3 mt-2 p-3">
      <div class="small fw-bold mb-1" style="color:#333;">🚚 Envío gratis</div>
      ${rows}
    </li>
  `;
}

function renderCart() {
  const list = document.getElementById('cart-items-list');
  const totals = getCartTotals();
  const totalItems = cart.reduce((acc, item) => acc + item.qty, 0);

  document.getElementById('cart-count-badge').textContent = totalItems;
  document.getElementById('desktop-cart-count').textContent = totalItems;
  document.getElementById('mobile-cart-badge').textContent = totalItems;
  document.getElementById('header-cart-total').textContent = formatARS(totals.subtotal);
  document.getElementById('cart-subtotal').textContent = formatARS(totals.subtotal);
  document.getElementById('btn-open-checkout').disabled = cart.length === 0;

  if (!cart.length) {
    list.innerHTML = '<li class="list-group-item text-center text-muted py-4 border-0">Tu carrito está vacío.</li>';
    return;
  }

  const itemsHtml = cart.map(item => {
    const p = getCartItemPricing(item);
    const priceLine = p.discountPercent > 0
      ? `<span class="text-decoration-line-through text-muted me-1">${formatARS(p.baseUnitPrice)}</span>
         <span class="text-success fw-semibold">${formatARS(p.finalUnitPrice)} c/u (${p.discountPercent}% OFF)</span>`
      : `${formatARS(p.baseUnitPrice)} c/u`;

    const nextHint = p.nextRule
      ? `<div class="text-pronta-sage" style="font-size:0.75rem;">
           Sumá ${p.nextRule.minQty - item.qty} más para ${p.nextRule.percent}% OFF
         </div>`
      : '';

    return `
      <li class="list-group-item d-flex justify-content-between align-items-center py-3">
        <div class="me-2">
          <div class="fw-semibold small">${escapeHTML(item.name)}</div>
          <div class="text-muted" style="font-size:0.8rem;">${priceLine}</div>
          ${nextHint}
        </div>
        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="updateCartQty('${escapeHTML(item.productId)}', -1)">-</button>
          <span class="small fw-bold">${item.qty}</span>
          <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="updateCartQty('${escapeHTML(item.productId)}', 1)">+</button>
        </div>
      </li>
    `;
  }).join('');

  const savingsHtml = totals.qtyDiscountTotal > 0
    ? `<li class="list-group-item d-flex justify-content-between small text-success fw-semibold bg-light border-0 rounded-3 mt-2 py-2 px-3">
         <span>Ahorro por cantidad</span>
         <span>-${formatARS(totals.qtyDiscountTotal)}</span>
       </li>`
    : '';

  list.innerHTML = itemsHtml + savingsHtml + buildCartFreeShippingBanner(totals.subtotal);
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
    const label = escapeHTML(m.name || m.label);
    return `<option value="${cost}" data-name="${label}" data-threshold="${m.free_threshold || 0}">
      ${label} (${cost === 0 ? 'Gratis' : formatARS(cost)})
    </option>`;
  }).join('');
}

function getSelectedPaymentMethod() {
  const checked = document.querySelector('input[name="paymentMethod"]:checked');
  return checked ? checked.value : 'mercadopago';
}

function calculateCheckoutTotals() {
  const subtotal = getCartSubtotal();
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

  return { subtotal, discount, shippingCost, shippingName, total, paymentMethod, senaAmount, cashRest };
}

function updateCheckoutUI() {
  const t = calculateCheckoutTotals();

  document.getElementById('chk-subtotal').textContent = formatARS(t.subtotal);
  document.getElementById('chk-shipping-cost').textContent = t.shippingCost === 0 ? 'Gratis' : formatARS(t.shippingCost);
  document.getElementById('chk-total').textContent = formatARS(t.total);

  const discRow = document.getElementById('chk-discount-row');
  if (t.discount > 0) {
    discRow.classList.remove('d-none');
    document.getElementById('chk-discount').textContent = '-' + formatARS(t.discount);
  } else {
    discRow.classList.add('d-none');
  }

  const bankBox = document.getElementById('bank-info-box');
  const senaRow = document.getElementById('chk-sena-row');

  if (t.paymentMethod === 'transferencia' || t.paymentMethod === 'efectivo') {
    bankBox.classList.remove('d-none');
  } else {
    bankBox.classList.add('d-none');
  }

  if (t.paymentMethod === 'efectivo') {
    senaRow.classList.remove('d-none');
    document.getElementById('chk-sena-amount').textContent = formatARS(t.senaAmount);
    document.getElementById('chk-cash-rest').textContent = formatARS(t.cashRest);
  } else {
    senaRow.classList.add('d-none');
  }

  const btn = document.getElementById('btn-confirm-order');
  if (t.paymentMethod === 'mercadopago') {
    btn.textContent = `Pagar ${formatARS(t.total)} con Mercado Pago`;
  } else if (t.paymentMethod === 'transferencia') {
    btn.textContent = `Confirmar Pedido (${formatARS(t.total)} por Transferencia)`;
  } else {
    btn.textContent = `Confirmar Pedido (Seña ${formatARS(t.senaAmount)})`;
  }
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  if (!cart.length) return;

  const btn = document.getElementById('btn-confirm-order');
  btn.disabled = true;
  btn.textContent = 'Procesando pedido...';

  const name = document.getElementById('chk-name').value.trim();
  const email = document.getElementById('chk-email').value.trim();
  const phone = document.getElementById('chk-phone').value.trim();
  const address = document.getElementById('chk-address').value.trim();

  customerProfile = { ...(customerProfile || {}), name, email, phone, address };
  localStorage.setItem('pronta_customer_v1', JSON.stringify(customerProfile));
  syncCustomerProfileUI();

  if (currentAuthUser) {
    try {
      await sb.from('customer_profiles').upsert({
        id: currentAuthUser.id,
        email,
        full_name: name,
        phone,
        address
      });
    } catch (err) {
      console.warn('No se pudo sincronizar perfil al confirmar pedido:', err);
    }
  }

  const totals = calculateCheckoutTotals();

  const paymentLabels = {
    mercadopago: 'Mercado Pago',
    transferencia: 'Transferencia Bancaria (5% OFF)',
    efectivo: 'Efectivo con seña 50% (5% OFF)'
  };

  let savedOrderId = 'PR-' + Date.now().toString().slice(-6);
  try {
    const orderPayload = {
      user_id: currentAuthUser ? currentAuthUser.id : null,
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
      const response = await fetch('/api/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(item => ({
            title: item.name || 'Producto PRONTA',
            quantity: item.qty,
            unit_price: getCartItemPricing(item).finalUnitPrice
          })),
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
      btn.disabled = false;
      updateCheckoutUI();
      return;
    }
  }

const cartTotals = getCartTotals();
  const itemsText = cart.map(i => {
    const p = getCartItemPricing(i);
    const discTag = p.discountPercent > 0 ? ` (${p.discountPercent}% OFF)` : '';
    return `• ${i.qty}x ${i.name}${discTag}: ${formatARS(p.lineFinalTotal)}`;
  }).join('\n');

  const qtyDiscHtml = cartTotals.qtyDiscountTotal > 0
    ? `<div class="d-flex justify-content-between text-success"><span>Descuento por cantidad:</span><span>-${formatARS(cartTotals.qtyDiscountTotal)}</span></div>`
    : '';

  const payDiscHtml = totals.discount > 0
    ? `<div class="d-flex justify-content-between text-success"><span>Descuento ${PRONTA_CONFIG.discountPercent}% OFF (${totals.paymentMethod}):</span><span>-${formatARS(totals.discount)}</span></div>`
    : '';

  const shippingHtml = `<div class="d-flex justify-content-between"><span>Envío (${escapeHTML(totals.shippingName)}):</span><span>${totals.shippingCost === 0 ? 'Gratis' : formatARS(totals.shippingCost)}</span></div>`;

  let amountSummaryHTML = `
    <div class="d-flex justify-content-between"><span>Subtotal productos:</span><span>${formatARS(cartTotals.rawSubtotal)}</span></div>
    ${qtyDiscHtml}
    ${payDiscHtml}
    ${shippingHtml}
    <hr class="my-2">
    <div class="d-flex justify-content-between fw-bold"><span>Total a transferir:</span><span>${formatARS(totals.total)}</span></div>
  `;

  let paymentMsg = `Subtotal lista: ${formatARS(cartTotals.rawSubtotal)}`;
  if (cartTotals.qtyDiscountTotal > 0) paymentMsg += `\nDescuento por cantidad: -${formatARS(cartTotals.qtyDiscountTotal)}`;
  if (totals.discount > 0) paymentMsg += `\nDescuento 5% OFF: -${formatARS(totals.discount)}`;
  paymentMsg += `\nEnvío: ${totals.shippingName} (${totals.shippingCost === 0 ? 'Gratis' : formatARS(totals.shippingCost)})`;
  paymentMsg += `\nMedio de pago: Transferencia Bancaria (5% OFF)\nTotal a transferir: ${formatARS(totals.total)}`;

  if (totals.paymentMethod === 'efectivo') {
    amountSummaryHTML = `
      <div class="d-flex justify-content-between"><span>Subtotal productos:</span><span>${formatARS(cartTotals.rawSubtotal)}</span></div>
      ${qtyDiscHtml}
      ${payDiscHtml}
      ${shippingHtml}
      <hr class="my-2">
      <div class="d-flex justify-content-between fw-bold"><span>Total con descuentos:</span><span>${formatARS(totals.total)}</span></div>
      <div class="d-flex justify-content-between text-pronta fw-bold"><span>Seña a transferir ahora (50%):</span><span>${formatARS(totals.senaAmount)}</span></div>
      <div class="d-flex justify-content-between"><span>Saldo restante en efectivo:</span><span>${formatARS(totals.cashRest)}</span></div>
    `;
    paymentMsg = `Subtotal lista: ${formatARS(cartTotals.rawSubtotal)}`;
    if (cartTotals.qtyDiscountTotal > 0) paymentMsg += `\nDescuento por cantidad: -${formatARS(cartTotals.qtyDiscountTotal)}`;
    if (totals.discount > 0) paymentMsg += `\nDescuento 5% OFF: -${formatARS(totals.discount)}`;
    paymentMsg += `\nEnvío: ${totals.shippingName} (${totals.shippingCost === 0 ? 'Gratis' : formatARS(totals.shippingCost)})`;
    paymentMsg += `\nMedio de pago: Efectivo con seña (5% OFF)\nTotal: ${formatARS(totals.total)}\nSeña a transferir (50%): ${formatARS(totals.senaAmount)}\nRestante en efectivo: ${formatARS(totals.cashRest)}`;
  }

  const waMessage = `¡Hola PRONTA! Acabo de realizar un pedido (#${savedOrderId}):\n\n` +
    `${itemsText}\n\n` +
    `${paymentMsg}\n\n` +
    `Mis datos:\nNombre: ${name}\nTel: ${phone}\nDirección/Nota: ${address || '-'}\n\n` +
    `¡Te adjunto el comprobante de transferencia!`;

  const waUrl = `https://wa.me/${PRONTA_CONFIG.whatsapp}?text=${encodeURIComponent(waMessage)}`;

  document.getElementById('checkout-form').classList.add('d-none');
  document.getElementById('checkout-success-view').classList.remove('d-none');
  document.getElementById('success-order-subtitle').textContent = `Pedido #${savedOrderId} registrado para ${name}.`;
  document.getElementById('success-amount-summary').innerHTML = amountSummaryHTML;
  document.getElementById('btn-send-whatsapp').href = waUrl;

  cart = [];
  saveCart();
  btn.disabled = false;
}

// ============================================================
// EVENTOS DE INTERFAZ Y AUTENTICACIÓN DE CLIENTA
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

      document.getElementById('checkout-form').classList.remove('d-none');
      document.getElementById('checkout-success-view').classList.add('d-none');
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

  // Iniciar sesión con Supabase Auth
  const custLoginForm = document.getElementById('customer-login-form');
  if (custLoginForm) {
    custLoginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btnLogin = document.getElementById('btn-cust-login');
      const loginEmail = document.getElementById('login-cust-email').value.trim();
      const loginPass = document.getElementById('login-cust-password').value;

      btnLogin.disabled = true;
      btnLogin.textContent = 'Ingresando...';

      try {
        const { data, error } = await sb.auth.signInWithPassword({
          email: loginEmail,
          password: loginPass
        });

        if (error) {
          showCustomerLoginFeedback(error.message || 'No se pudo iniciar sesión. Verificá tu email y contraseña.', true);
          return;
        }

        currentAuthUser = data.user;
        await fetchAndApplyCustomerProfile(currentAuthUser);
        showCustomerLoginFeedback(`¡Bienvenida de nuevo, ${customerProfile?.name || loginEmail}!`, false);
        showToast('Sesión iniciada');
        await loadCustomerOrders();
      } catch (err) {
        showCustomerLoginFeedback('Ocurrió un error al iniciar sesión. Intentá nuevamente.', true);
      } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = 'Iniciar Sesión';
      }
    });
  }

  // Crear cuenta o actualizar perfil en Supabase Auth + customer_profiles
  const custForm = document.getElementById('customer-profile-form');
  if (custForm) {
    custForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btnSave = document.getElementById('btn-save-profile');
      const fullName = document.getElementById('cust-name').value.trim();
      const email = document.getElementById('cust-email').value.trim();
      const password = document.getElementById('cust-password').value;
      const phone = document.getElementById('cust-phone').value.trim();
      const address = document.getElementById('cust-address').value.trim();
      const province = document.getElementById('cust-province').value.trim();
      const postal = document.getElementById('cust-postal').value.trim();

      btnSave.disabled = true;
      btnSave.textContent = 'Guardando...';

      try {
        if (!currentAuthUser) {
          if (!password || password.length < 6) {
            showCustomerProfileFeedback('Elegí una contraseña de al menos 6 caracteres para crear tu cuenta.', true);
            return;
          }

          const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: window.location.origin,
              data: {
                full_name: fullName,
                phone,
                address,
                province,
                postal_code: postal
              }
            }
          });

          if (error) {
            showCustomerProfileFeedback(error.message || 'No se pudo crear la cuenta.', true);
            return;
          }

          if (data?.user && data?.session) {
            currentAuthUser = data.user;
            await sb.from('customer_profiles').upsert({
              id: data.user.id,
              email,
              full_name: fullName,
              phone,
              address,
              province,
              postal_code: postal
            });
            await fetchAndApplyCustomerProfile(currentAuthUser);
            showCustomerProfileFeedback('¡Cuenta creada y datos guardados con éxito!', false);
            showToast('¡Cuenta creada!');
          } else {
            customerProfile = { name: fullName, email, phone, address, province, postal };
            localStorage.setItem('pronta_customer_v1', JSON.stringify(customerProfile));
            syncCustomerProfileUI();
            showCustomerProfileFeedback(
              '¡Cuenta creada! Revisá tu correo para confirmar el email y luego iniciá sesión para ver tus pedidos.',
              false
            );
            showToast('Revisá tu email para confirmar la cuenta');
          }
        } else {
          const { error } = await sb.from('customer_profiles').upsert({
            id: currentAuthUser.id,
            email,
            full_name: fullName,
            phone,
            address,
            province,
            postal_code: postal
          });

          if (error) throw error;

          customerProfile = {
            id: currentAuthUser.id,
            name: fullName,
            email,
            phone,
            address,
            province,
            postal
          };
          localStorage.setItem('pronta_customer_v1', JSON.stringify(customerProfile));
          syncCustomerProfileUI();
          showCustomerProfileFeedback('¡Tus datos quedaron actualizados!', false);
          showToast('¡Datos guardados!');
        }
      } catch (err) {
        console.error('Error guardando cuenta/perfil:', err);
        showCustomerProfileFeedback('No se pudieron guardar tus datos. Intentá nuevamente.', true);
      } finally {
        btnSave.disabled = false;
        btnSave.textContent = 'Guardar Mis Datos';
      }
    });
  }
}

window.handleForgotPassword = async function () {
  const emailInput = document.getElementById('login-cust-email');
  const email = (emailInput?.value || '').trim();
  if (!email) {
    showCustomerLoginFeedback('Escribí tu email primero y volvé a hacer clic en "¿Olvidaste tu contraseña?".', true);
    emailInput?.focus();
    return;
  }

  try {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) throw error;
    showCustomerLoginFeedback(`Te enviamos un enlace de recuperación a ${email}.`, false);
    showToast('Correo de recuperación enviado');
  } catch (err) {
    showCustomerLoginFeedback('No se pudo enviar el correo de recuperación. Verificá el email.', true);
  }
};

// ============================================================
// PERFIL DE CLIENTE E HISTORIAL DE PEDIDOS
// ============================================================
function syncCustomerProfileUI() {
  const headerBadge = document.getElementById('header-customer-name');
  const passGroup = document.getElementById('cust-password-group');
  const passInput = document.getElementById('cust-password');
  const helpText = document.getElementById('cust-profile-help');

  if (currentAuthUser) {
    if (passGroup) passGroup.classList.add('d-none');
    if (passInput) passInput.required = false;
    if (helpText) {
      helpText.textContent = `Sesión iniciada como ${currentAuthUser.email}. Podés editar tus datos de envío cuando quieras.`;
    }
  } else {
    if (passGroup) passGroup.classList.remove('d-none');
    if (passInput) passInput.required = true;
    if (helpText) {
      helpText.textContent = 'Creá tu cuenta o completá tus datos para agilizar tus próximas compras.';
    }
  }

  if (customerProfile && (customerProfile.name || customerProfile.email)) {
    const firstName = (customerProfile.name || customerProfile.email).trim().split(' ')[0];
    if (headerBadge) {
      headerBadge.textContent = firstName;
      headerBadge.classList.remove('d-none');
    }
    const fields = {
      'cust-name': customerProfile.name,
      'cust-email': customerProfile.email,
      'cust-phone': customerProfile.phone,
      'cust-address': customerProfile.address,
      'cust-province': customerProfile.province,
      'cust-postal': customerProfile.postal,
      'cust-orders-email': customerProfile.email,
      'login-cust-email': customerProfile.email
    };
    Object.entries(fields).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    });
  } else if (headerBadge) {
    headerBadge.textContent = '';
    headerBadge.classList.add('d-none');
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

window.clearCustomerProfile = async function () {
  try {
    await sb.auth.signOut();
  } catch (err) {
    console.warn('Error al cerrar sesión en Supabase:', err);
  }
  currentAuthUser = null;
  customerProfile = null;
  localStorage.removeItem('pronta_customer_v1');
  document.getElementById('customer-profile-form')?.reset();
  const ordersEmail = document.getElementById('cust-orders-email');
  if (ordersEmail) ordersEmail.value = '';
  document.getElementById('cust-orders-list').innerHTML =
    '<div class="text-center text-muted small py-4">Sesión cerrada. Iniciá sesión para consultar tus pedidos.</div>';
  syncCustomerProfileUI();
  showToast('Sesión cerrada');
};

window.loadCustomerOrders = async function () {
  const emailInput = document.getElementById('cust-orders-email');
  const email = (emailInput?.value || currentAuthUser?.email || customerProfile?.email || '').trim().toLowerCase();
  const listEl = document.getElementById('cust-orders-list');
  if (!listEl) return;

  if (!currentAuthUser) {
    listEl.innerHTML =
      '<div class="text-center text-muted small py-4">Iniciá sesión en tu cuenta PRONTA para ver el historial de tus pedidos de forma segura.</div>';
    return;
  }

  listEl.innerHTML = '<div class="text-center text-muted small py-4">Buscando tus pedidos...</div>';

  try {
    let query = sb.from('orders').select('*').order('created_at', { ascending: false });

    if (email) {
      query = query.or(`user_id.eq.${currentAuthUser.id},customer_email.ilike.${email}`);
    } else {
      query = query.eq('user_id', currentAuthUser.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || !data.length) {
      listEl.innerHTML = '<div class="text-center text-muted small py-4">No encontramos pedidos asociados a tu cuenta todavía.</div>';
      return;
    }

    listEl.innerHTML = data.map(o => {
      const dateStr = o.created_at
        ? new Date(o.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';
      const itemsText = Array.isArray(o.items)
        ? o.items.map(i => `${escapeHTML(i.qty)}x ${escapeHTML(i.name)}`).join(' · ')
        : '';
      return `
        <div class="border rounded-3 p-3 bg-light">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <strong class="small">Pedido #${escapeHTML(String(o.id).slice(0, 8))} ${dateStr ? '· ' + escapeHTML(dateStr) : ''}</strong>
            <span class="badge rounded-pill" style="background-color:#D4A3A3; color:#333333;">${escapeHTML(o.status || 'Pendiente')}</span>
          </div>
          <div class="small text-muted mb-1">${itemsText}</div>
          <div class="d-flex justify-content-between small fw-bold">
            <span>${escapeHTML(o.payment_method || '')}</span>
            <span>${formatARS(o.total)}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error cargando pedidos de clienta:', err);
    listEl.innerHTML = '<div class="text-center text-danger small py-4">No se pudieron cargar los pedidos en este momento.</div>';
  }
};

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

function showCustomerProfileFeedback(message, isError = false) {
  const fb = document.getElementById('cust-profile-feedback');
  if (!fb) return;
  fb.textContent = message;
  fb.className = `small mt-2 ${isError ? 'text-danger fw-semibold' : 'text-success fw-semibold'}`;
  fb.classList.remove('d-none');
}
