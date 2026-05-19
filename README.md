# Control de Stock - Empresa de Internet

Sistema de control de inventario con soporte para escaneo con pistola QR/código de barras, múltiples depósitos, dashboard y reportes.

## Características

- **Productos**: Agregar productos escaneando con pistola/cámara o ingresando datos manualmente
- **Depósitos**: Crear y gestionar múltiples depósitos/almacenes
- **Movimientos**: Registrar entradas, salidas y ajustes de stock por depósito
- **Dashboard**: Vista general con métricas, stock por depósito y alertas de stock bajo
- **Reportes**: Filtrar por producto, depósito, tipo de movimiento y rango de fechas. Exportar a CSV

## Requisitos

- Node.js 18+
- Navegador con soporte para cámara (HTTPS o localhost para escáner)

## Instalación

```bash
# Instalar dependencias
npm install

# Configurar .env (ver .env.example) y aplicar migraciones
npx prisma migrate dev

# Datos iniciales (depósito, admin, etc.)
npm run db:seed

# Iniciar en desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

## Uso del escáner

1. Haz clic en **Escanear** en el formulario de productos o movimientos
2. Permite el acceso a la cámara cuando el navegador lo solicite
3. Apunta al código de barras o QR del producto
4. El código se detectará automáticamente y se completará el formulario

**Nota**: Las pistolas de código de barras que simulan teclado funcionan como entrada manual: enfoca el campo de código y escanea. El valor se ingresará como si se escribiera.

## Estructura

- `/api/products` - CRUD de productos, búsqueda por barcode/SKU
- `/api/warehouses` - CRUD de depósitos
- `/api/stock` - Registrar movimientos de stock
- `/api/reports` - Reportes con filtros

## Base de datos

PostgreSQL (requerido en Vercel). Copia `.env.example` a `.env` y configura las URLs de tu base de datos.

```bash
npx prisma migrate dev   # desarrollo local
npm run db:seed          # datos iniciales (admin, depósito, etc.)
```

## Desplegar en Vercel

Vercel no soporta SQLite en serverless; la app usa **PostgreSQL** (Neon, Vercel Postgres, Supabase, etc.).

### 1. Base de datos

1. Crea una base PostgreSQL (recomendado: [Neon](https://neon.tech) gratis).
2. Copia la **connection string** y, si usas Neon, también la URL **directa** (sin pooler).

### 2. Proyecto en Vercel

1. Sube el código a GitHub/GitLab/Bitbucket.
2. En [vercel.com](https://vercel.com) → **Add New Project** → importa el repositorio.
3. Si el repo tiene carpeta anidada, en **Root Directory** elige `stock-control` (la carpeta con `package.json`).
4. Framework: **Next.js** (detectado automáticamente).

### 3. Variables de entorno

En el proyecto de Vercel → **Settings** → **Environment Variables**:

| Variable       | Descripción                                      |
|----------------|--------------------------------------------------|
| `DATABASE_URL` | URL de PostgreSQL (en Neon: la del **pooler**)   |
| `DIRECT_URL`   | URL directa (misma URL si no hay pooler separado)|

### 4. Deploy

Al hacer deploy, el build ejecuta `prisma migrate deploy` y crea las tablas.

Después del primer deploy, carga datos iniciales desde tu PC (con las mismas variables en `.env`):

```bash
npm run db:seed
```

### 5. Acceso

- URL: la que asigne Vercel (`*.vercel.app`).
- Login por defecto (tras seed): `admin@stockcontrol.local` / `admin123`
- El escáner con cámara requiere **HTTPS** (Vercel lo incluye).

### Desarrollo local

```bash
cp .env.example .env
# Edita DATABASE_URL y DIRECT_URL
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```
