// server.js — Tienda VlackDiamond: perfumes árabes, gorras y bolsas para hombre.
// Pedidos por WhatsApp, SIN pago en el sitio. Rubén cobra por transferencia
// y él mismo hace los envíos.
//
// Stack: Node.js >= 22.5, Express, SQLite (node:sqlite), multer.
// No hay Stripe ni ningún otro método de pago en este proyecto.
'use strict';

require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const {
  dbPath,
  ORDER_STATUSES,
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getUserByEmail,
  getUserById,
  createUser,
  publicUser,
  createOrder,
  getOrderById,
  listOrdersByUser,
  listAllOrders,
  setOrderStatus,
  getStats,
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const WHATSAPP_NUMBER = String(process.env.WHATSAPP_NUMBER || '524493130357').replace(/\D/g, '');
const ADMIN_KEY = process.env.ADMIN_KEY || '';

// El secreto de sesión: si no está configurado se genera uno aleatorio al
// arrancar (las sesiones no sobrevivirían a un reinicio) y se avisa en el log.
let SESSION_SECRET = process.env.SESSION_SECRET || '';
if (!SESSION_SECRET) {
  SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('[AVISO] SESSION_SECRET no está configurado: se generó uno temporal. Define SESSION_SECRET en .env / Render para que las sesiones sobrevivan a reinicios.');
}

if (!ADMIN_KEY) {
  console.error('[ERROR] ADMIN_KEY no está configurada. El panel /admin NO funcionará hasta que definas ADMIN_KEY en las variables de entorno (ver .env.example y README). El resto de la tienda sí funciona.');
}

// ---------------------------------------------------------------------------
// Archivos: fotos subidas y base de datos.
// En Render, DATA_DIR apunta al disco persistente (ver render.yaml).
// ---------------------------------------------------------------------------
const dataDir = process.env.DATA_DIR ? String(process.env.DATA_DIR) : __dirname;
const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, uploadsDir),
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase() || '.png';
    const safeExtension = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(extension)
      ? extension
      : '.png';
    callback(null, `producto-${Date.now()}-${Math.round(Math.random() * 1e6)}${safeExtension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // máximo 5 MB por foto
  fileFilter: (req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      return callback(new Error('Solo se permiten archivos de imagen.'));
    }
    callback(null, true);
  },
});

app.set('trust proxy', 1);
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Sesiones de clientes (sin dependencias extra).
// Token firmado con HMAC-SHA256 usando SESSION_SECRET, en cookie HttpOnly.
// ---------------------------------------------------------------------------
function signToken(userId) {
  const raw = `${userId}.${Date.now()}.${crypto.randomBytes(16).toString('hex')}`;
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(raw).digest('hex');
  return `${Buffer.from(raw).toString('base64url')}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  let raw;
  try {
    raw = Buffer.from(parts[0], 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(raw).digest('hex');
  const given = Buffer.from(parts[1], 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (given.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(given, expectedBuf)) return null;
  const userId = Number.parseInt(raw.split('.')[0], 10);
  return Number.isInteger(userId) ? userId : null;
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key) cookies[key] = decodeURIComponent(rest.join('='));
  }
  return cookies;
}

function getLoggedInUser(req) {
  const token = parseCookies(req).vd_session;
  const userId = verifyToken(token);
  if (!userId) return null;
  return getUserById(userId);
}

function requireLogin(req, res, next) {
  const user = getLoggedInUser(req);
  if (!user) return res.status(401).json({ error: 'Inicia sesión para ver tus pedidos.' });
  req.user = user;
  return next();
}

// ---------------------------------------------------------------------------
// Admin: la clave NUNCA tiene un valor por defecto como 'changeme'.
// Sin ADMIN_KEY configurada, todas las rutas de admin fallan con un error claro.
// ---------------------------------------------------------------------------
function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) {
    return res.status(500).json({
      error: 'ADMIN_KEY no está configurada en el servidor. Define ADMIN_KEY en las variables de entorno (ver README) para usar el panel de administración.',
    });
  }
  if (req.get('x-admin-key') !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Clave de administrador inválida.' });
  }
  return next();
}

// ---------------------------------------------------------------------------
// Contraseñas: hash con scrypt (módulo crypto integrado de Node, sin deps extra).
// ---------------------------------------------------------------------------
function hashPassword(password, saltHex) {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'utf8');
  const b = Buffer.from(expectedHash, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function setSessionCookie(res, userId) {
  res.cookie('vd_session', signToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
    path: '/',
  });
}

// ---------------------------------------------------------------------------
// Rutas públicas
// ---------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/stats', (req, res) => {
  res.json({ ...getStats(), whatsapp_number: WHATSAPP_NUMBER });
});

// Catálogo público: solo productos activos. Filtros: ?category= &brand= &type=
app.get('/api/products', (req, res) => {
  const { category, brand, type } = req.query;
  res.json(listProducts({ category, brand, type, activeOnly: true }));
});

app.get('/api/products/:id', (req, res) => {
  const product = getProductById(Number.parseInt(req.params.id, 10));
  if (!product || !product.active) return res.status(404).json({ error: 'Producto no encontrado.' });
  res.json(product);
});

// ---------------------------------------------------------------------------
// Registro e inicio de sesión de clientes
// ---------------------------------------------------------------------------
app.post('/api/auth/register', (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '');

    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Escribe un correo válido.' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    if (getUserByEmail(email)) return res.status(409).json({ error: 'Ese correo ya está registrado. Inicia sesión.' });

    const { salt, hash } = hashPassword(password);
    const user = createUser({ name, email, phone, password_hash: hash, password_salt: salt });
    setSessionCookie(res, user.id);
    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo crear la cuenta.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = getUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }
    setSessionCookie(res, user.id);
    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo iniciar sesión.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('vd_session', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = getLoggedInUser(req);
  res.json({ user: publicUser(user) });
});

// Historial de pedidos del cliente (solo con sesión iniciada)
app.get('/api/orders/my', requireLogin, (req, res) => {
  res.json(listOrdersByUser(req.user.id));
});

// ---------------------------------------------------------------------------
// Pedidos: sin pago en el sitio. Se guarda el pedido y se devuelve el enlace
// de WhatsApp con el mensaje ya llenado para pagar por transferencia.
// Funciona para clientes registrados (pedido ligado a su cuenta) y para
// invitados (solo nombre, teléfono y dirección son obligatorios).
// ---------------------------------------------------------------------------
function buildWhatsAppMessage(order) {
  const lines = [];
  lines.push(`Hola VlackDiamond, quiero confirmar mi pedido ${order.order_number}.`);
  lines.push('');
  lines.push(`Cliente: ${order.customer_name}`);
  lines.push(`Teléfono: ${order.customer_phone}`);
  if (order.customer_email) lines.push(`Correo: ${order.customer_email}`);
  lines.push(`Dirección de envío: ${order.shipping_address}`);
  lines.push('');
  lines.push('Productos:');
  for (const item of order.items) {
    lines.push(`- ${item.product_name} x${item.quantity} — $${item.subtotal_mxn} MXN`);
  }
  lines.push('');
  lines.push(`Total: $${order.total_mxn} MXN`);
  lines.push('');
  lines.push('Quedo al pendiente de los datos para la transferencia. ¡Gracias!');
  return lines.join('\n');
}

app.post('/api/orders', (req, res) => {
  try {
    const customerName = String(req.body.customer_name || '').trim();
    const customerPhone = String(req.body.customer_phone || '').trim();
    const customerEmail = String(req.body.customer_email || '').trim();
    const shippingAddress = String(req.body.shipping_address || '').trim();
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];

    if (!customerName) return res.status(400).json({ error: 'El nombre es obligatorio.' });
    if (!customerPhone) return res.status(400).json({ error: 'El teléfono es obligatorio.' });
    if (!shippingAddress) return res.status(400).json({ error: 'La dirección de envío es obligatoria.' });
    if (rawItems.length === 0) return res.status(400).json({ error: 'El carrito está vacío.' });

    // Normalizar y validar los artículos contra el catálogo (el precio y el
    // nombre siempre se toman de la base de datos, nunca del cliente).
    const items = [];
    for (const raw of rawItems) {
      const productId = Number.parseInt(raw.product_id, 10);
      const quantity = Number.parseInt(raw.quantity, 10);
      if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ error: 'Hay un artículo inválido en el carrito.' });
      }
      const product = getProductById(productId);
      if (!product || !product.active) {
        return res.status(400).json({ error: 'Uno de los productos ya no está disponible.' });
      }
      items.push({
        product_id: product.id,
        product_name: product.name,
        unit_price_mxn: product.price_mxn,
        quantity,
        subtotal_mxn: product.price_mxn * quantity,
      });
    }

    const loggedInUser = getLoggedInUser(req);
    const order = createOrder({
      user_id: loggedInUser ? loggedInUser.id : null,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      shipping_address: shippingAddress,
      items,
    });

    const message = buildWhatsAppMessage(order);
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    res.json({ order, whatsapp_url: whatsappUrl });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || 'No se pudo crear el pedido.' });
  }
});

// ---------------------------------------------------------------------------
// Admin (protegido con ADMIN_KEY en el header x-admin-key)
// ---------------------------------------------------------------------------
app.get('/api/admin/verify', requireAdmin, (req, res) => {
  res.json({ ok: true });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  res.json(getStats());
});

app.get('/api/admin/products', requireAdmin, (req, res) => {
  res.json(listProducts({ activeOnly: false }));
});

function parseProductFields(req) {
  const name = String(req.body.name || '').trim();
  const category = String(req.body.category || '').trim();
  const brand = String(req.body.brand || '').trim();
  const type = String(req.body.type || '').trim();
  const description = String(req.body.description || '').trim();
  const priceMxn = Number.parseInt(req.body.price_mxn, 10);
  // Precio anterior (oferta): opcional. Vacío = sin oferta (null).
  const rawOriginal = String(req.body.original_price_mxn ?? '').trim();
  const originalPriceMxn = rawOriginal === '' ? null : Number.parseInt(rawOriginal, 10);
  const stock = Number.parseInt(req.body.stock, 10);
  const active = req.body.active === undefined ? true : ['1', 'true', 'on', 'sí', 'si'].includes(String(req.body.active).toLowerCase());
  return { name, category, brand, type, description, price_mxn: priceMxn, original_price_mxn: originalPriceMxn, stock, active };
}

function validateProductFields(fields) {
  const categories = ['Perfumes Árabes', 'Gorras', 'Bolsas para hombre'];
  if (!fields.name) return 'El nombre es obligatorio.';
  if (!categories.includes(fields.category)) return 'La categoría debe ser: Perfumes Árabes, Gorras o Bolsas para hombre.';
  if (!Number.isInteger(fields.price_mxn) || fields.price_mxn <= 0) return 'El precio en MXN debe ser un número mayor que 0.';
  if (fields.original_price_mxn !== null && fields.original_price_mxn !== undefined) {
    if (!Number.isInteger(fields.original_price_mxn) || fields.original_price_mxn <= 0) return 'El precio anterior debe ser un número entero mayor que 0.';
    if (fields.original_price_mxn <= fields.price_mxn) return 'El precio anterior debe ser mayor que el precio actual para ser una oferta.';
  }
  if (!Number.isInteger(fields.stock) || fields.stock < 0) return 'El stock debe ser 0 o más.';
  return null;
}

app.post('/api/admin/products', requireAdmin, upload.single('image'), (req, res) => {
  try {
    const fields = parseProductFields(req);
    const error = validateProductFields(fields);
    if (error) return res.status(400).json({ error });
    const imagePath = req.file ? `/uploads/${req.file.filename}` : '';
    const product = createProduct({ ...fields, image_path: imagePath });
    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo crear el producto.' });
  }
});

app.put('/api/admin/products/:id', requireAdmin, upload.single('image'), (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const current = getProductById(id);
    if (!current) return res.status(404).json({ error: 'Producto no encontrado.' });
    const fields = parseProductFields(req);
    // En edición, los campos vacíos conservan el valor actual, EXCEPTO el
    // precio anterior: vacío significa quitar la oferta (null).
    const merged = {
      name: fields.name || current.name,
      category: fields.category || current.category,
      brand: fields.brand || current.brand,
      type: fields.type || current.type,
      description: fields.description || current.description,
      price_mxn: Number.isInteger(fields.price_mxn) ? fields.price_mxn : current.price_mxn,
      original_price_mxn: fields.original_price_mxn,
      stock: Number.isInteger(fields.stock) ? fields.stock : current.stock,
      active: req.body.active === undefined ? Boolean(current.active) : fields.active,
      image_path: req.file ? `/uploads/${req.file.filename}` : current.image_path,
    };
    const error = validateProductFields(merged);
    if (error) return res.status(400).json({ error });
    // Borrar la foto anterior si se subió una nueva.
    if (req.file && current.image_path) {
      const oldPath = path.join(uploadsDir, path.basename(current.image_path));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    res.json(updateProduct(id, merged));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo actualizar el producto.' });
  }
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const current = getProductById(id);
    if (!current) return res.status(404).json({ error: 'Producto no encontrado.' });
    deleteProduct(id);
    if (current.image_path) {
      const filePath = path.join(uploadsDir, path.basename(current.image_path));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo eliminar el producto.' });
  }
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  res.json(listAllOrders());
});

app.patch('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const status = String(req.body.status || '').trim();
    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Estado inválido. Usa uno de: ${ORDER_STATUSES.join(', ')}.` });
    }
    const order = setOrderStatus(id, status);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo actualizar el pedido.' });
  }
});

// Manejo de errores de multer (archivo muy grande o no es imagen).
app.use((error, req, res, next) => {
  if (error) return res.status(400).json({ error: error.message || 'Error al subir la imagen.' });
  return next();
});

app.listen(PORT, () => {
  console.log(`VlackDiamond corriendo en http://localhost:${PORT}`);
  console.log(`Base de datos: ${dbPath}`);
  console.log(`WhatsApp de pedidos: +${WHATSAPP_NUMBER}`);
  if (!ADMIN_KEY) {
    console.log('ADMIN_KEY no configurada: /admin no funcionará hasta definirla.');
  }
});
