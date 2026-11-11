// db.js — Capa de datos SQLite para VlackDiamond.
// Usa el módulo integrado node:sqlite (Node >= 22.5, sin dependencias extra).
'use strict';

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

// En Render, DATA_DIR apunta al disco persistente (ver render.yaml y README).
// En local, la base vive en la raíz del proyecto.
const dataDir = process.env.DATA_DIR ? String(process.env.DATA_DIR) : __dirname;
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'vlackdiamond.db');

const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    brand TEXT DEFAULT '',
    type TEXT DEFAULT '',
    description TEXT DEFAULT '',
    price_mxn INTEGER NOT NULL,
    original_price_mxn INTEGER,
    stock INTEGER NOT NULL DEFAULT 0,
    image_path TEXT DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT DEFAULT '',
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE,
    user_id INTEGER,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT DEFAULT '',
    shipping_address TEXT NOT NULL,
    total_mxn INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendiente',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    unit_price_mxn INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    subtotal_mxn INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders (id)
  );
`);

// Migración para bases de datos ya existentes: si la tabla products se creó
// antes de los descuentos, no tiene la columna original_price_mxn.
// Se agrega solo si falta (comprobación idempotente, no borra productos).
const productColumns = db.prepare('PRAGMA table_info(products)').all().map((c) => c.name);
if (!productColumns.includes('original_price_mxn')) {
  db.exec('ALTER TABLE products ADD COLUMN original_price_mxn INTEGER');
}

// ---------------------------------------------------------------------------
// Productos de ejemplo (seed). Solo se insertan si la tabla está vacía.
// Precios en MXN (pesos mexicanos, números enteros). Sin fotos reales:
// el frontend muestra un elegante marcador dorado/negro cuando no hay foto.
// ---------------------------------------------------------------------------
const SEED_PRODUCTS = [
  // Perfumes Árabes (4)
  { name: 'Oud Royal Ámbar — 100 ml', category: 'Perfumes Árabes', brand: 'VlackDiamond Selection', type: '', description: 'Perfume árabe de oud, ámbar y vainilla. Intenso, elegante y de larga duración. Ideal para ocasiones especiales y para uso nocturno.', price_mxn: 1299, original_price_mxn: 1599, stock: 12 },
  { name: 'Musk Blanco de Arabia — 100 ml', category: 'Perfumes Árabes', brand: 'VlackDiamond Selection', type: '', description: 'Almizcle blanco suave y limpio, con notas de sándalo y flor de azahar. Fresco y versátil para uso diario.', price_mxn: 899, stock: 15 },
  { name: 'Azafrán Noir Oud — 100 ml', category: 'Perfumes Árabes', brand: 'VlackDiamond Selection', type: '', description: 'Azafrán, oud y cuero. Un aroma profundo y misterioso, con gran proyección. Para quien busca destacar.', price_mxn: 1499, stock: 8 },
  { name: 'Rosa de Damasco y Oud — 100 ml', category: 'Perfumes Árabes', brand: 'VlackDiamond Selection', type: '', description: 'Rosa de Damasco sobre base de oud y pachulí. Floral, cálido y sofisticado, unisex.', price_mxn: 1199, stock: 10 },
  // Gorras (5)
  { name: 'Gorra Clásica Negra', category: 'Gorras', brand: 'Barbas Hats', type: '', description: 'Gorra clásica de Barbas Hats en negro, con bordado discreto y ajuste trasero. Algodón resistente, talla única ajustable.', price_mxn: 749, stock: 20 },
  { name: 'Gorra Trucker Dorada', category: 'Gorras', brand: 'Barbas Hats', type: '', description: 'Gorra trucker de Barbas Hats con malla trasera y frente dorado. Fresca y llamativa, ideal para el día a día.', price_mxn: 799, stock: 14 },
  { name: 'Gorra Plana Gris', category: 'Gorras', brand: 'Dandy Hats', type: '', description: 'Gorra plana estilo Dandy Hats en gris jaspe, acabado premium y visera corta. Elegante y casual a la vez.', price_mxn: 849, stock: 10 },
  { name: 'Gorra Beisbolera Azul', category: 'Gorras', brand: 'JC Hats', type: '', description: 'Gorra beisbolera de JC Hats en azul marino, con logo bordado. Ajuste cómodo y materiales de alta calidad.', price_mxn: 699, stock: 18 },
  { name: 'Gorra VlackDiamond Edición Oro', category: 'Gorras', brand: 'Otros', type: '', description: 'Gorra edición especial VlackDiamond con detalles dorados y bordado premium. Pieza limitada, talla única ajustable.', price_mxn: 899, original_price_mxn: 1199, stock: 6 },
  // Bolsas para hombre (3)
  { name: 'Neceser de Piel Negro', category: 'Bolsas para hombre', brand: '', type: 'Neceser', description: 'Neceser de piel sintética premium en negro, con compartimentos internos y cierre metálico. Perfecto para el cuidado personal y los viajes.', price_mxn: 1099, stock: 9 },
  { name: 'Sobaquera Cruzada Negra', category: 'Bolsas para hombre', brand: '', type: 'Sobaquera', description: 'Bolsa sobaquera cruzada en negro, resistente al agua, con varios bolsillos y correa ajustable. Para llevar lo esencial con estilo.', price_mxn: 1299, stock: 11 },
  { name: 'Neceser Organizador de Viaje', category: 'Bolsas para hombre', brand: '', type: 'Neceser', description: 'Neceser organizador de viaje con divisiones internas, gancho para colgar y material impermeable por dentro. Compacto y práctico.', price_mxn: 899, stock: 13 },
  { name: 'Sobaquera de Cuero Café', category: 'Bolsas para hombre', brand: '', type: 'Sobaquera', description: 'Sobaquera de cuero café con acabado vintage, correa ajustable y forro interior suave. Un clásico que combina con todo.', price_mxn: 1499, original_price_mxn: 1899, stock: 7 },
];

function seedProducts() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM products').get();
  if (Number(count) > 0) return;
  const insert = db.prepare(`
    INSERT INTO products (name, category, brand, type, description, price_mxn, original_price_mxn, stock)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of SEED_PRODUCTS) {
    insert.run(p.name, p.category, p.brand, p.type, p.description, p.price_mxn, p.original_price_mxn || null, p.stock);
  }
}
seedProducts();

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------
function listProducts({ category, brand, type, activeOnly = true } = {}) {
  let sql = 'SELECT * FROM products WHERE 1 = 1';
  const params = [];
  if (activeOnly) sql += ' AND active = 1';
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (brand) { sql += ' AND brand = ?'; params.push(brand); }
  if (type) { sql += ' AND type = ?'; params.push(type); }
  sql += ' ORDER BY category ASC, name ASC';
  return db.prepare(sql).all(...params);
}

function getProductById(id) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id) || null;
}

function createProduct({ name, category, brand, type, description, price_mxn, original_price_mxn, stock, image_path }) {
  const info = db.prepare(`
    INSERT INTO products (name, category, brand, type, description, price_mxn, original_price_mxn, stock, image_path, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(name, category, brand || '', type || '', description || '', price_mxn, original_price_mxn || null, stock, image_path || '');
  return getProductById(info.lastInsertRowid);
}

function updateProduct(id, fields) {
  const current = getProductById(id);
  if (!current) return null;
  const next = { ...current, ...fields };
  db.prepare(`
    UPDATE products
    SET name = ?, category = ?, brand = ?, type = ?, description = ?,
        price_mxn = ?, original_price_mxn = ?, stock = ?, image_path = ?, active = ?
    WHERE id = ?
  `).run(
    next.name, next.category, next.brand || '', next.type || '',
    next.description || '', next.price_mxn, next.original_price_mxn || null, next.stock,
    next.image_path || '', next.active ? 1 : 0, id
  );
  return getProductById(id);
}

function deleteProduct(id) {
  return db.prepare('DELETE FROM products WHERE id = ?').run(id).changes > 0;
}

// ---------------------------------------------------------------------------
// Usuarios (clientes)
// ---------------------------------------------------------------------------
function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase()) || null;
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
}

function createUser({ name, email, phone, password_hash, password_salt }) {
  const info = db.prepare(`
    INSERT INTO users (name, email, phone, password_hash, password_salt)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, String(email).toLowerCase(), phone || '', password_hash, password_salt);
  return getUserById(info.lastInsertRowid);
}

function publicUser(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, created_at: user.created_at };
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------
const ORDER_STATUSES = ['Pendiente', 'Confirmado', 'Enviado', 'Entregado', 'Cancelado'];

function createOrder({ user_id, customer_name, customer_phone, customer_email, shipping_address, items }) {
  // items: [{ product_id, product_name, unit_price_mxn, quantity, subtotal_mxn }]
  const total = items.reduce((sum, item) => sum + item.subtotal_mxn, 0);
  // node:sqlite (esta versión) no expone db.transaction(): transacción manual,
  // mismo patrón que usa TOMB en su migración de base de datos.
  db.exec('BEGIN IMMEDIATE');
  let orderId;
  try {
    // Validar y descontar stock dentro de la misma transacción.
    for (const item of items) {
      const product = getProductById(item.product_id);
      if (!product || !product.active) throw new Error(`El producto "${item.product_name}" ya no está disponible.`);
      if (product.stock < item.quantity) throw new Error(`No hay suficiente stock de "${item.product_name}". Quedan ${product.stock}.`);
    }
    const orderInfo = db.prepare(`
      INSERT INTO orders (user_id, customer_name, customer_phone, customer_email, shipping_address, total_mxn, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Pendiente')
    `).run(user_id || null, customer_name, customer_phone, customer_email || '', shipping_address, total);
    orderId = orderInfo.lastInsertRowid;
    const orderNumber = `VD-${String(orderId).padStart(6, '0')}`;
    db.prepare('UPDATE orders SET order_number = ? WHERE id = ?').run(orderNumber, orderId);
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price_mxn, quantity, subtotal_mxn)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      insertItem.run(orderId, item.product_id, item.product_name, item.unit_price_mxn, item.quantity, item.subtotal_mxn);
      db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.product_id);
    }
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* ya no hay transacción activa */ }
    throw error;
  }
  return getOrderById(orderId);
}

function getOrderById(id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return null;
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC').all(id);
  return order;
}

function getOrderByNumber(orderNumber) {
  const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber);
  if (!order) return null;
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC').all(order.id);
  return order;
}

function listOrdersByUser(userId) {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(userId);
  for (const order of orders) {
    order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC').all(order.id);
  }
  return orders;
}

function listAllOrders() {
  const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
  for (const order of orders) {
    order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC').all(order.id);
  }
  return orders;
}

function setOrderStatus(id, status) {
  if (!ORDER_STATUSES.includes(status)) return null;
  const info = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  if (info.changes === 0) return null;
  return getOrderById(id);
}

function getStats() {
  const products = db.prepare('SELECT COUNT(*) AS c FROM products WHERE active = 1').get().c;
  const orders = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
  const revenue = db.prepare("SELECT COALESCE(SUM(total_mxn), 0) AS s FROM orders WHERE status != 'Cancelado'").get().s;
  const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  return { products, orders, revenue_mxn: revenue, users };
}

module.exports = {
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
  getOrderByNumber,
  listOrdersByUser,
  listAllOrders,
  setOrderStatus,
  getStats,
};
