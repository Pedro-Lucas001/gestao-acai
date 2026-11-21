# Integration hand-off — Gestão Açaí

## Backend
- Project: `services/api`
- Run: `cd services/api` then `func start --port 7071` (Azure Functions Core Tools v4)
- Build: `dotnet build services/api/GestaoAcai.Api.csproj`
- Health: `GET /api/health`
- Local configuration: copy `services/api/local.settings.example.json` to `services/api/local.settings.json`; set `ADMIN_PASSWORD`, a long random `ADMIN_API_TOKEN`, and PostgreSQL connection string. Never commit local settings.
- Auth: `POST /api/auth/login` with `{ "username": "...", "password": "..." }`; send returned token as `Authorization: Bearer <token> on protected routes.

## Frontend
- Project: `services/web`
- Install: `npm --prefix services/web install`
- Build: `npm --prefix services/web run build`
- Dev: `npm --prefix services/web run dev`
- API seam to replace: `services/web/src/api/index.ts`
- Preview/mock files to remove or replace: `services/web/src/api/mockClient.ts`; current zero-valued mock responses are previews, not persisted data.
- Shared types: `services/web/src/api/types.ts`; keep client and API DTOs aligned.

## API route inventory
- `POST /api/auth/login`
- `GET /api/health`
- `GET, POST /api/ingredients`
- `PUT, DELETE /api/ingredients/{id}`
- `GET, POST /api/products`
- `GET, PUT, DELETE /api/products/{id}`
- `GET, PUT /api/pricing/{productId}`
- `GET, POST /api/sales`
- `GET /api/sales/{id}`
- `GET, POST /api/expenses`
- `DELETE /api/expenses/{id}`
- `GET, PUT /api/fixed-costs`
- `GET /api/dashboard`
- `POST /api/calculations/break-even`

## Database
- Type: PostgreSQL
- ORM/migration tool: EF Core + Npgsql
- Migration directory: `services/api/Data/Migrations`
- Connection variable: `POSTGRESQL_CONNECTION_STRING`
- Create schema migrations only; **NO seed data**.
- Money and quantities use PostgreSQL decimal/numeric precision; sale rows retain price, unit-cost, and variable-fee snapshots.

## Services
- Essential: React/TypeScript web app, C# Azure Functions API, PostgreSQL, single-administrator authentication.
- Enhancement/reserved: Azure Blob Storage (not required by MVP; no attachment/export features in this scaffold).

## Integration checklist
- Implement PostgreSQL-backed endpoint handlers and EF Core migrations (no seed data).
- Replace `mockClient` through the one-file API seam; wire all dashboard/list screens to live API data.
- Add and wire a single-admin login flow; protect all non-health domain routes.
- Smoke-test every route above, including auth, invalid requests, calculations, and persistence.
- Add/execute backend and frontend tests and verify end-to-end.
