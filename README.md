# PostgreSQL Note — Product Inventory API

A RESTful **Product Inventory API** built with **Node.js, Express 5, Prisma ORM, and PostgreSQL**. It demonstrates a modern Prisma setup (Prisma 7 with the PostgreSQL driver adapter) including migrations, a generated ESM client, filtering, sorting, and pagination.

> This project is a learning/notes project for working with PostgreSQL + Prisma in an Express API.

---

## Tech Stack

| Layer | Technology |

 Runtime | Node.js (ES Modules) 
 Server | Express 5 |
 ORM | Prisma 7
 Database | PostgreSQL 18 |




## Data Model

The `Product` model (`prisma/schema.prisma`):

| Field | Type | Notes |
|-------|------|-------|
| `id` | Int | Primary key, autoincrement |
| `name` | String | Required |
| `description` | String? | Optional |
| `price` | Decimal(12,2) | Required |
| `category` | String | Required, indexed |
| `sku` | String | Required, **unique** |
| `stock` | Int | Defaults to `0` |
| `createdAt` | DateTime | Defaults to now |
| `updatedAt` | DateTime | Auto-updated |

Indexes: `category`, `price`, and a unique index on `sku`.

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL (Docker)

```bash
docker compose up -d
```

This starts a PostgreSQL 18 container:
### 3. Configure environment variables

Create a `.env` file in the project root:



> `DATABASE_URL` is read by `prisma.config.ts` and by `src/config/prisma.js`. `.env` is already listed in `.gitignore`, so it will not be committed.

### 4. Run migrations and generate the client

```bash
npx prisma migrate deploy
npx prisma generate
```

### 5. Start the server

```bash
# Development (watch mode)
npm run dev

# Production
npm start
```

---

## API Endpoints



| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/products` | Create a new product |
| `GET` | `/api/products` | List products (filter, sort, paginate) |
| `GET` | `/api/products/:id` | Get a single product by ID |
| `PATCH` | `/api/products/:id` | Update a product |
| `DELETE` | `/api/products/:id` | Delete a product |

### Query parameters for `GET /api/products`

| Parameter | Example | Description |
|-----------|---------|-------------|
| `category` | `Electronics` | Filter by category |
| `minPrice` | `100` | Minimum price |
| `maxPrice` | `1000` | Maximum price |
| `search` | `phone` | Case-insensitive partial name search |
| `sort` | `price_asc` / `price_desc` | Sort order (defaults to newest) |
| `page` | `1` | Page number (default `1`) |
| `limit` | `10` | Items per page (default `10`) |

---

## Example Requests

### Create a product

```http
POST /api/products
Content-Type: application/json

{
  "name": "Wireless Mouse",
  "description": "Ergonomic wireless mouse",
  "price": 15000,
  "category": "Electronics",
  "sku": "WM-001",
  "stock": 25
}
```

**Response** `201 Created`

```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "id": 1,
    "name": "Wireless Mouse",
    "description": "Ergonomic wireless mouse",
    "price": "15000",
    "category": "Electronics",
    "sku": "WM-001",
    "stock": 25,
    "createdAt": "2026-11-11T15:17:30.000Z",
    "updatedAt": "2026-11-11T15:17:30.000Z"
  }
}
```

### List products

```http
GET /api/products?category=Electronics&minPrice=1000&maxPrice=50000&sort=price_asc&page=1&limit=10
```

**Response** `200 OK`

```json
{
  "success": true,
  "count": 1,
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "pages": 1
  },
  "data": []
}
```

### Get, update, delete

```http
GET    /api/products/1
PATCH  /api/products/1      # body: any updatable fields
DELETE /api/products/1
```

---

## Error Handling

All errors flow through `src/middleware/errorMiddleware.js`:

| Prisma Code | HTTP | Meaning |
|-------------|------|---------|
| `P2002` | 400 | Unique constraint failed (duplicate `sku`) |
| `P2025` | 404 | Record not found |
| — | 500 | Fallback internal server error |

---

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `tsx watch src/index.js` | Run with auto-reload |
| `npm start` | `node src/index.js` | Run once |
| `npm run build` | `tsc` | TypeScript build (see notes) |

---

## Notes & Known Issues

A code review of the current implementation. These are worth fixing before relying on the API.

### 🔴 High priority

1. **Error handler is registered before the routes** — `src/index.js`
   ```js
   app.use(express.json());
   app.use(errorHandler);              // ← too early
   app.use('/api/products', productRoutes);
   ```
   Express error-handling middleware must be registered **last**. As written, `next(error)` from the controllers never reaches `errorHandler`, so Prisma errors (`P2002`, `P2025`) fall through to Express's default handler and return an HTML 500 instead of the intended JSON. **Fix:** move `app.use(errorHandler)` to *after* `app.use('/api/products', productRoutes)`.

2. **`.ts` import inside a `.js` file** — `src/config/prisma.js`
   ```js
   import { PrismaClient } from "../generated/prisma/client.ts";
   ```
   `npm start` runs `node src/index.js`, and Node cannot import `.ts` files. This works with `tsx` (`npm run dev`) but **fails in production** (`npm start`). Either run the app with `tsx` in `start`, switch the Prisma generator to emit `.js`, or rename the source files to `.ts`.

### 🟡 Medium priority

3. **Extensionless import** — `src/controllers/productController.js`
   ```js
   import { prisma } from "../config/prisma";   // missing .js
   ```
   Inconsistent with the other ESM imports. Under strict Node ESM this fails to resolve. Add the `.js` extension (or `.ts` if going all-TypeScript).

4. **No 404 handler for unknown routes.** Requests to undefined paths get Express's default HTML 404. Add a `notFound` middleware right before `errorHandler`:
   ```js
   app.use((req, res, next) => {
     res.status(404).json({ success: false, message: `Not Found - ${req.originalUrl}` });
   });
   ```

5. **Invalid `:id` is not validated.** `parseInt(id)` can produce `NaN`, which Prisma then rejects with a validation error → 500. Validate first and return `400`:
   ```js
   const id = Number(req.params.id);
   if (!Number.isInteger(id) || id <= 0) {
     return res.status(400).json({ success: false, message: 'Invalid product ID' });
   }
   ```

6. **No input validation on create/update.** Missing or malformed fields (e.g. `price` as text, negative `stock`) reach Prisma and surface as a 500. Validate required fields and types in the controller and return `400` for bad input. Consider mapping `PrismaClientValidationError` to `400` in the error middleware too.

### 🟢 Low priority / notes

7. **`price` is a `Decimal`.** Prisma serializes `Decimal` values to **strings** in JSON (e.g. `"15000"`), not numbers. If clients expect a number, convert (e.g. `product.price.toNumber()`) or add a serializer. The README example reflects this.

8. **`npm run build` runs `tsc`** but the source is `.js` and there is no `tsconfig.json`. The script likely does nothing useful or errors. Add a `tsconfig.json` (if moving to TypeScript) or remove the script.

9. **`search` only matches `name`.** Fine as-is, but you may want to also search `description` / `sku`.

10. **Port fallback mismatch.** `src/index.js` defaults to `3000`, while `.env` sets `PORT=5000`. Not a bug, just be consistent.

---

## License

ISC
