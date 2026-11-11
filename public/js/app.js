// app.js — Tienda VlackDiamond (frontend).
// Catálogo con filtros por categoría/marca/tipo, carrito en localStorage,
// registro/inicio de sesión de clientes y pedido por WhatsApp (sin pago aquí).
'use strict';

const WHATSAPP_DISPLAY = '+52 449 313 0357';

let products = [];
let filter = { category: 'all', brand: '', type: '' };
let cart = JSON.parse(localStorage.getItem('vd_cart') || '[]');
let currentUser = null;

const $ = (id) => document.getElementById(id);
const money = (n) => `$${Number(n || 0).toLocaleString('es-MX')} MXN`;
const moneyShort = (n) => `$${Number(n || 0).toLocaleString('es-MX')}`;

// Oferta: hay precio anterior y es mayor que el precio actual (el que se
// cobra). Devuelve el porcentaje de descuento redondeado, o null si no hay.
function offerInfo(p) {
  const original = Number(p.original_price_mxn);
  if (!Number.isInteger(original) || original <= p.price_mxn) return null;
  return { percent: Math.round((1 - p.price_mxn / original) * 100) };
}

// Precio con oferta: precio anterior tachado + precio actual grande.
// Sin oferta, solo el precio actual, como antes.
function priceHtml(p) {
  const offer = offerInfo(p);
  if (!offer) return `<p class="product-price">${money(p.price_mxn)}</p>`;
  return `<p class="product-price"><span class="price-old">${moneyShort(p.original_price_mxn)}</span> ${money(p.price_mxn)}</p>`;
}

function showStatus(message, kind = '') {
  const banner = $('status-banner');
  banner.hidden = !message;
  banner.textContent = message || '';
  banner.className = `status-banner${kind ? ` ${kind}` : ''}`;
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'La solicitud no se pudo completar.');
  return data;
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------
function catalogTitle() {
  if (filter.category === 'all') return 'Todos los productos';
  if (filter.brand) return `${filter.category} — ${filter.brand}`;
  if (filter.type) return `${filter.category} — ${filter.type}`;
  return filter.category;
}

function filteredProducts() {
  const search = ($('search-input').value || '').trim().toLowerCase();
  const minPrice = Number.parseInt($('price-min').value, 10);
  const maxPrice = Number.parseInt($('price-max').value, 10);
  const sort = $('sort-select').value;
  const list = products.filter((p) => {
    if (filter.category !== 'all' && p.category !== filter.category) return false;
    if (filter.brand && p.brand !== filter.brand) return false;
    if (filter.type && p.type !== filter.type) return false;
    if (Number.isInteger(minPrice) && p.price_mxn < minPrice) return false;
    if (Number.isInteger(maxPrice) && p.price_mxn > maxPrice) return false;
    if (search && !`${p.name} ${p.brand} ${p.description}`.toLowerCase().includes(search)) return false;
    return true;
  });
  if (sort === 'price-asc') list.sort((a, b) => a.price_mxn - b.price_mxn);
  else if (sort === 'price-desc') list.sort((a, b) => b.price_mxn - a.price_mxn);
  else if (sort === 'name-asc') list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  else if (sort === 'name-desc') list.sort((a, b) => b.name.localeCompare(a.name, 'es'));
  return list;
}

// Insignia derivada de los datos del producto (sin inventar ventas).
// Prioridad: "Agotado" (sin stock) > "Oferta -X%" > "Pocas piezas"
// (7 o menos) > "Premium" (precio de $1,400 o más).
function productBadge(p) {
  if (p.stock <= 0) return { text: 'Agotado', cls: 'badge-out' };
  const offer = offerInfo(p);
  if (offer) return { text: `Oferta -${offer.percent}%`, cls: 'badge-offer' };
  if (p.stock <= 7) return { text: 'Pocas piezas', cls: 'badge-low' };
  if (p.price_mxn >= 1400) return { text: 'Premium', cls: 'badge-premium' };
  return null;
}

function stockHtml(p) {
  if (p.stock <= 0) return `<p class="product-stock out"><span class="stock-dot out"></span>Agotado</p>`;
  if (p.stock <= 7) return `<p class="product-stock"><span class="stock-dot low"></span>Quedan ${p.stock} · Pocas piezas</p>`;
  return `<p class="product-stock"><span class="stock-dot"></span>${p.stock} disponibles</p>`;
}

// Vista de detalle: al hacer clic en la foto o el nombre se abre el producto completo.
function openProductDetail(productId) {
  const p = products.find((item) => item.id === productId);
  if (!p) return;
  const meta = [p.category, p.brand, p.type].filter(Boolean).join(' · ');
  $('detail-content').innerHTML = `
    ${productPhotoHtml(p)}
    <h2>${escapeHtml(p.name)}</h2>
    <p class="product-meta">${escapeHtml(meta)}</p>
    <p class="product-desc">${escapeHtml(p.description)}</p>
    ${priceHtml(p)}
    ${stockHtml(p)}
    <p class="checkout-note">Envío a todo México. Pago por transferencia al confirmar por WhatsApp (${WHATSAPP_DISPLAY}).</p>
    <button class="btn btn-gold btn-block" data-add="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>Agregar al carrito</button>`;
  openOverlay('detail-overlay');
}

function productPhotoHtml(p) {
  const badge = productBadge(p);
  const badgeHtml = badge ? `<span class="product-badge ${badge.cls}">${badge.text}</span>` : '';
  if (p.image_path) {
    return `<div class="product-media">${badgeHtml}<img class="product-photo" src="${p.image_path}" alt="Foto de ${escapeHtml(p.name)}" loading="lazy"></div>`;
  }
  return `<div class="product-media">${badgeHtml}<div class="product-placeholder" aria-label="Sin foto todavía"><span class="monogram">VD</span><small>VLACKDIAMOND</small></div></div>`;
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderProducts() {
  const list = filteredProducts();
  $('catalog-title').textContent = catalogTitle();
  $('result-count').textContent = list.length === products.length
    ? `${list.length} productos`
    : `${list.length} de ${products.length} productos`;
  $('empty-catalog').hidden = list.length > 0;
  $('product-grid').innerHTML = list.map((p, index) => {
    const meta = [p.category, p.brand, p.type].filter(Boolean).join(' · ');
    const outOfStock = p.stock <= 0;
    return `<article class="product-card" style="animation-delay:${Math.min(index * 45, 360)}ms">
      <div data-detail="${p.id}" role="button" tabindex="0" aria-label="Ver detalle de ${escapeHtml(p.name)}">${productPhotoHtml(p)}</div>
      <div class="product-body">
        <h3><a href="#" data-detail="${p.id}">${escapeHtml(p.name)}</a></h3>
        <p class="product-meta">${escapeHtml(meta)}</p>
        <p class="product-desc">${escapeHtml(p.description)}</p>
        ${priceHtml(p)}
        ${stockHtml(p)}
        <button class="btn btn-gold btn-block" data-add="${p.id}" ${outOfStock ? 'disabled' : ''}>Agregar al carrito</button>
      </div>
    </article>`;
  }).join('');
}

async function loadProducts() {
  try {
    products = await getJson('/api/products');
    renderProducts();
  } catch (error) {
    console.error(error);
    showStatus('No se pudo cargar el catálogo. Revisa que la tienda esté en funcionamiento.', 'error');
  }
}

function setFilter(category, brand = '', type = '') {
  filter = { category, brand, type };
  document.querySelectorAll('.nav-link').forEach((b) => {
    b.classList.toggle('active', b.dataset.filter === category && !brand && !type);
  });
  document.querySelector('.site-header').classList.remove('nav-open');
  const menuToggle = $('menu-toggle');
  if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
  renderProducts();
  document.querySelector('.toolbar').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------------------------------------------------------------------
// Carrito
// ---------------------------------------------------------------------------
function saveCart() {
  localStorage.setItem('vd_cart', JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  $('cart-count').textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
}

function cartTotal() {
  return cart.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.product_id);
    return sum + (product ? product.price_mxn * item.quantity : 0);
  }, 0);
}

function addToCart(productId) {
  const product = products.find((p) => p.id === productId);
  if (!product || product.stock <= 0) return;
  const line = cart.find((item) => item.product_id === productId);
  const currentQty = line ? line.quantity : 0;
  if (currentQty + 1 > product.stock) {
    showStatus(`Solo quedan ${product.stock} de "${product.name}".`, 'error');
    return;
  }
  if (line) line.quantity += 1;
  else cart.push({ product_id: productId, quantity: 1 });
  saveCart();
  showStatus(`"${product.name}" agregado al carrito.`, 'ok');
}

function renderCart() {
  const container = $('cart-items');
  if (cart.length === 0) {
    container.innerHTML = '<p>Tu carrito está vacío.</p>';
  } else {
    container.innerHTML = cart.map((item) => {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) return '';
      return `<div class="cart-line">
        <div><strong>${escapeHtml(product.name)}</strong><br>${money(product.price_mxn)} c/u</div>
        <div class="qty">
          <button data-dec="${product.id}" aria-label="Quitar uno">−</button>
          <span>${item.quantity}</span>
          <button data-inc="${product.id}" aria-label="Agregar uno">+</button>
        </div>
        <strong>${money(product.price_mxn * item.quantity)}</strong>
        <button class="btn btn-small btn-danger" data-remove="${product.id}" aria-label="Quitar del carrito">✕</button>
      </div>`;
    }).join('');
  }
  $('cart-total').textContent = money(cartTotal());
  $('order-success').hidden = true;
  $('checkout-error').hidden = true;
  // Prellenar los datos si el cliente inició sesión.
  if (currentUser) {
    if (!$('co-name').value) $('co-name').value = currentUser.name || '';
    if (!$('co-phone').value) $('co-phone').value = currentUser.phone || '';
    if (!$('co-email').value) $('co-email').value = currentUser.email || '';
  }
}

function openOverlay(id) { $(id).hidden = false; }
function closeOverlay(id) { $(id).hidden = true; }

// ---------------------------------------------------------------------------
// Pedido por WhatsApp
// ---------------------------------------------------------------------------
async function submitOrder(event) {
  event.preventDefault();
  if (cart.length === 0) {
    $('checkout-error').hidden = false;
    $('checkout-error').textContent = 'Tu carrito está vacío.';
    return;
  }
  const payload = {
    customer_name: $('co-name').value.trim(),
    customer_phone: $('co-phone').value.trim(),
    customer_email: $('co-email').value.trim(),
    shipping_address: $('co-address').value.trim(),
    items: cart.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
  };
  try {
    const result = await getJson('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    $('order-number').textContent = result.order.order_number;
    $('order-whatsapp-link').href = result.whatsapp_url;
    $('order-success').hidden = false;
    $('checkout-error').hidden = true;
    $('checkout-form').hidden = true;
    cart = [];
    saveCart();
    // Abrir WhatsApp en una pestaña nueva.
    window.open(result.whatsapp_url, '_blank', 'noopener');
    await loadProducts(); // refrescar stock
    if (currentUser) await loadMyOrders();
  } catch (error) {
    $('checkout-error').hidden = false;
    $('checkout-error').textContent = error.message;
  }
}

// ---------------------------------------------------------------------------
// Cuenta de cliente
// ---------------------------------------------------------------------------
async function refreshMe() {
  try {
    const { user } = await getJson('/api/auth/me');
    currentUser = user;
  } catch {
    currentUser = null;
  }
  $('account-guest').hidden = Boolean(currentUser);
  $('account-user').hidden = !currentUser;
  $('account-button').textContent = currentUser ? currentUser.name.split(' ')[0] : 'Mi cuenta';
  if (currentUser) {
    $('account-name').textContent = currentUser.name;
    $('account-email').textContent = `${currentUser.email}${currentUser.phone ? ` · ${currentUser.phone}` : ''}`;
    await loadMyOrders();
  }
}

async function loadMyOrders() {
  try {
    const orders = await getJson('/api/orders/my');
    $('my-orders').innerHTML = orders.length === 0
      ? '<p>Todavía no tienes pedidos.</p>'
      : orders.map((o) => `<div class="order-card">
          <strong>${escapeHtml(o.order_number)}</strong> · ${new Date(o.created_at + 'Z').toLocaleDateString('es-MX')}<br>
          Estado: <span class="order-status">${escapeHtml(o.status)}</span> · Total: ${money(o.total_mxn)}<br>
          ${o.items.map((i) => `${escapeHtml(i.product_name)} x${i.quantity}`).join('<br>')}
        </div>`).join('');
  } catch {
    $('my-orders').innerHTML = '<p>No se pudieron cargar tus pedidos.</p>';
  }
}

function showTab(which) {
  $('tab-login').classList.toggle('active', which === 'login');
  $('tab-register').classList.toggle('active', which === 'register');
  $('login-form').hidden = which !== 'login';
  $('register-form').hidden = which !== 'register';
  $('account-error').hidden = true;
}

async function handleLogin(event) {
  event.preventDefault();
  try {
    await getJson('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('login-email').value.trim(), password: $('login-password').value }),
    });
    await refreshMe();
    showStatus('Sesión iniciada. Bienvenido de vuelta.', 'ok');
  } catch (error) {
    $('account-error').hidden = false;
    $('account-error').textContent = error.message;
  }
}

async function handleRegister(event) {
  event.preventDefault();
  try {
    await getJson('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: $('reg-name').value.trim(),
        email: $('reg-email').value.trim(),
        phone: $('reg-phone').value.trim(),
        password: $('reg-password').value,
      }),
    });
    await refreshMe();
    showStatus('Cuenta creada. Ya puedes pedir y ver tu historial.', 'ok');
  } catch (error) {
    $('account-error').hidden = false;
    $('account-error').textContent = error.message;
  }
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------
document.addEventListener('click', (event) => {
  const detailLink = event.target.closest('[data-detail]');
  if (detailLink) {
    event.preventDefault();
    openProductDetail(Number(detailLink.dataset.detail));
    return;
  }
  const filterButton = event.target.closest('[data-filter]');
  if (filterButton) {
    setFilter(filterButton.dataset.filter, filterButton.dataset.brand || '', filterButton.dataset.type || '');
    return;
  }
  const addButton = event.target.closest('[data-add]');
  if (addButton) { addToCart(Number(addButton.dataset.add)); return; }
  const inc = event.target.closest('[data-inc]');
  if (inc) {
    const line = cart.find((i) => i.product_id === Number(inc.dataset.inc));
    const product = products.find((p) => p.id === Number(inc.dataset.inc));
    if (line && product && line.quantity < product.stock) { line.quantity += 1; saveCart(); renderCart(); }
    return;
  }
  const dec = event.target.closest('[data-dec]');
  if (dec) {
    const line = cart.find((i) => i.product_id === Number(dec.dataset.dec));
    if (line) { line.quantity -= 1; if (line.quantity <= 0) cart = cart.filter((i) => i !== line); saveCart(); renderCart(); }
    return;
  }
  const remove = event.target.closest('[data-remove]');
  if (remove) {
    cart = cart.filter((i) => i.product_id !== Number(remove.dataset.remove));
    saveCart();
    renderCart();
    return;
  }
  const close = event.target.closest('[data-close]');
  if (close) closeOverlay(close.dataset.close);
});

document.querySelectorAll('.overlay').forEach((overlay) => {
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.hidden = true;
  });
});

$('search-input').addEventListener('input', renderProducts);
$('price-min').addEventListener('input', renderProducts);
$('price-max').addEventListener('input', renderProducts);
$('sort-select').addEventListener('change', renderProducts);
$('cart-button').addEventListener('click', () => { $('checkout-form').hidden = false; renderCart(); openOverlay('cart-overlay'); });
$('account-button').addEventListener('click', () => { openOverlay('account-overlay'); });
$('checkout-form').addEventListener('submit', submitOrder);
$('login-form').addEventListener('submit', handleLogin);
$('register-form').addEventListener('submit', handleRegister);
$('tab-login').addEventListener('click', () => showTab('login'));
$('tab-register').addEventListener('click', () => showTab('register'));
$('logout-button').addEventListener('click', async () => {
  await getJson('/api/auth/logout', { method: 'POST' });
  currentUser = null;
  await refreshMe();
});

updateCartCount();
loadProducts();
refreshMe();

// ---------------------------------------------------------------------------
// Pulido visual: header con desenfoque al bajar, menú móvil y aparición
// de las secciones al hacer scroll (respetando movimiento reducido).
// ---------------------------------------------------------------------------
const siteHeader = document.querySelector('.site-header');
function syncHeaderShadow() {
  siteHeader.classList.toggle('scrolled', window.scrollY > 12);
}
window.addEventListener('scroll', syncHeaderShadow, { passive: true });
syncHeaderShadow();

const menuToggle = $('menu-toggle');
if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    const open = siteHeader.classList.toggle('nav-open');
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  });
}

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
} else if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));
} else {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
}
