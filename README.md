# VlackDiamond — Tienda en línea

Tienda de **perfumes árabes, gorras (Barbas Hats, Dandy Hats, JC Hats) y bolsas para hombre (neceser y sobaquera)**.

**No hay pago en la página.** El cliente arma su pedido, escribe sus datos de envío y al confirmar se guarda el pedido y se le redirige a WhatsApp (**+52 449 313 0357**) con el mensaje ya llenado, para pagar por transferencia. Rubén cobra por WhatsApp y él mismo hace los envíos.

## Qué incluye

- Catálogo con menú desplegable por categoría, marca y tipo; búsqueda, filtro por precio y orden (precio y nombre).
- Vista de detalle de cada producto y carrito en forma de cajón lateral.
- Registro e inicio de sesión de clientes (contraseña con hash `scrypt`, sin dependencias extra) e historial de pedidos con su estado.
- Pedidos para clientes registrados y para invitados.
- Panel de administración en `/admin` para subir productos con foto y cambiar el estado de los pedidos.
- 13 productos de ejemplo (4 perfumes, 5 gorras y 4 bolsas) con precios en MXN.
- Diseño de lujo negro y dorado, como TOMB, responsive para celular y computadora: tipografía serif (Playfair Display) para títulos y sans limpia para texto, hero de portada con dos botones (Ver catálogo y Pedir por WhatsApp), franja de confianza, tarjetas de categoría que filtran el catálogo, guía de compra en 3 pasos, franja de marcas y pie de página en columnas. Las tarjetas de producto llevan insignia según los datos (Oferta con su porcentaje, Premium, Pocas piezas o Agotado), precio grande, indicador de stock y botón dorado de ancho completo. Un producto está en oferta cuando tiene un precio anterior mayor que su precio actual: se muestra el precio anterior tachado y la insignia *Oferta -X%*; el pedido siempre cobra el precio actual.
- Lluvia de lujo al fondo: monedas de oro, lingotes de oro y diamantes cayendo suavemente (se puede pausar con el botón del pie de página).

## Cómo subir un producto (3 pasos, para Rubén)

**Paso 1 — Entra al panel.**
Abre `https://tu-tienda.onrender.com/admin` (o `http://localhost:3000/admin` en local) y escribe tu clave de administrador (`ADMIN_KEY`). Esa clave se queda guardada solo en tu navegador.

**Paso 2 — Llena el formulario.**
Escribe el nombre, elige la categoría (Perfumes Árabes, Gorras o Bolsas para hombre), la marca o el tipo, la descripción, el precio en MXN y el stock. Luego haz clic en *Foto* y sube la foto del producto (máx. 5 MB, solo imágenes). Si no subes foto, la tienda muestra un marcador dorado elegante con las letras VD.

**Paso 3 — Guarda y revisa.**
Pulsa *Guardar producto*. El producto aparece de inmediato en la tienda. Para cambiarlo después, pulsa *Editar* en la lista; para quitarlo, *Eliminar*.

Para cambiar el estado de un pedido (Pendiente → Confirmado → Enviado → Entregado, o Cancelado), usa el menú de estado en la lista de pedidos del mismo panel.

## Cómo poner un producto en oferta (3 pasos, para Rubén)

**Paso 1 — Abre el producto en el panel.**
En `/admin`, busca el producto en la lista y pulsa *Editar* (o crea uno nuevo con el formulario).

**Paso 2 — Llena el precio anterior.**
En el campo *Precio anterior en MXN (opcional, para oferta)* escribe el precio normal, que debe ser mayor que el precio actual. Ejemplo: precio actual $1,199 y precio anterior $1,499 → la tienda muestra la oferta de -20%.

**Paso 3 — Guarda y revisa.**
Pulsa *Guardar producto*. En la tienda se ve el precio anterior tachado, el precio de oferta en grande y la insignia dorada *Oferta -20%*. El pedido siempre cobra el precio de oferta, nunca el anterior. Para quitar la oferta, edita el producto, borra el precio anterior y guarda.

## Cómo correrla en tu computadora

Requisitos: Node.js 22.5 o más nuevo.

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar las variables de ejemplo y llenarlas
cp .env.example .env
# Edita .env y pon una ADMIN_KEY larga y secreta y un SESSION_SECRET largo.

# 3. Arrancar
npm start
```

Abre `http://localhost:3000` para la tienda y `http://localhost:3000/admin` para el panel.

La base de datos `vlackdiamond.db` se crea sola la primera vez que arranca el servidor, junto con los 13 productos de ejemplo. Las fotos subidas se guardan en la carpeta `uploads/`.

## Cómo subirla a Render (servicio propio, separado de TOMB)

1. Sube este código a un repositorio nuevo de GitHub (por ejemplo `vlackdiamond-shop`).
2. En Render, crea un **New → Web Service** y conecta ese repositorio. O usa el archivo `render.yaml` incluido (Blueprint) para crearlo con un clic.
3. Configura:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Variables de entorno:**
     - `ADMIN_KEY` — tu clave de administrador (obligatoria; sin ella el panel no funciona y nunca uses `changeme`).
     - `SESSION_SECRET` — un texto largo y secreto (Render puede generarlo).
     - `WHATSAPP_NUMBER` — `524493130357` (ya viene en `render.yaml`).
     - `DATA_DIR` — `/opt/render/project/src/data` (ya viene en `render.yaml`).
4. El `render.yaml` ya incluye un **disco persistente de 1 GB** montado en esa carpeta. Es importante: sin disco persistente, Render borra la base de datos (`vlackdiamond.db`) y las fotos (`uploads/`) cada vez que redespliegues. Con el disco, tus productos, clientes y pedidos sobreviven a los redeploys.
5. Despliega y abre tu URL de Render. La tienda debe mostrar los 13 productos de ejemplo.

> Nota: el plan gratuito de Render duerme el servidor después de 15 minutos sin visitas (la primera carga tarda ~1 minuto). Si quieres que siempre esté despierto, cambia la instancia a la de pago ($7 USD/mes aprox.). Esto es igual que con TOMB: pagar el plan del espacio de trabajo no despierta el servicio; lo que lo despierta es pasar la instancia a paga.

## Variables de entorno

| Variable | Para qué | Obligatoria |
| --- | --- | --- |
| `PORT` | Puerto local (Render lo asigna solo) | No (3000 por defecto) |
| `ADMIN_KEY` | Clave del panel `/admin` | **Sí** |
| `SESSION_SECRET` | Secreto para las sesiones de clientes | Sí (si falta, se genera uno temporal y se avisa) |
| `WHATSAPP_NUMBER` | WhatsApp de los pedidos | No (por defecto `524493130357`) |
| `DATA_DIR` | Carpeta de la base de datos y fotos (disco persistente en Render) | No en local |

## Rutas de la API

| Método | Ruta | Para qué |
| --- | --- | --- |
| GET | `/api/products` | Catálogo (filtros `?category=&brand=&type=`) |
| GET | `/api/products/:id` | Un producto |
| GET | `/api/stats` | Contadores de la tienda |
| POST | `/api/auth/register` | Crear cuenta de cliente |
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/logout` | Cerrar sesión |
| GET | `/api/auth/me` | Sesión actual |
| POST | `/api/orders` | Crear pedido (invitado o registrado) y obtener el enlace de WhatsApp |
| GET | `/api/orders/my` | Historial de pedidos del cliente (con sesión) |
| GET/POST/PUT/DELETE | `/api/admin/products…` | CRUD de productos (con `x-admin-key`) |
| GET | `/api/admin/orders` | Todos los pedidos |
| PATCH | `/api/admin/orders/:id/status` | Cambiar estado del pedido |

## Estructura del proyecto

```text
vlackdiamond-shop/
├── server.js            # Servidor Express: catálogo, auth, pedidos, admin
├── db.js                # SQLite (node:sqlite) + productos de ejemplo
├── package.json         # Dependencias: express, multer, dotenv
├── .env.example         # Variables de entorno de ejemplo (sin secretos reales)
├── render.yaml          # Despliegue en Render + disco persistente
├── README.md            # Esta guía
├── uploads/             # Fotos subidas por el admin (vacía al inicio)
└── public/
    ├── index.html       # Tienda: hero, menú, catálogo, carrito, cuenta
    ├── admin.html       # Panel de administración
    ├── terminos.html    # Términos y condiciones
    ├── privacidad.html  # Aviso de privacidad
    ├── css/app.css      # Estilo negro y dorado
    ├── js/app.js        # Filtros, carrito, pedidos por WhatsApp, cuenta
    └── js/lux-rain.js   # Lluvia de monedas, lingotes y diamantes al fondo
```

## Limitaciones conocidas

- **SQLite necesita disco persistente en Render** (ya configurado en `render.yaml`). Sin disco, la base y las fotos se pierden al redesplegar.
- **No hay pago en línea a propósito:** el cobro es por transferencia en WhatsApp. El pedido queda en *Pendiente* hasta que Rubén confirma la transferencia y cambia el estado en el panel.
- Las sesiones de cliente viven en una cookie firmada; si cambia `SESSION_SECRET`, todos deben volver a iniciar sesión.
- El número de WhatsApp está en `WHATSAPP_NUMBER` (por defecto `524493130357`).
