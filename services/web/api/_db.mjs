import pg from "pg";

const { Pool } = pg;

let pool = null;
let schemaReady = null;

export function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRESQL_CONNECTION_STRING ||
    ""
  ).trim();
}

export function getPool() {
  const connectionString = getConnectionString();
  if (!connectionString) return null;
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "Ingredients" (
  "Id" uuid PRIMARY KEY,
  "Name" varchar(120) NOT NULL,
  "Unit" varchar(12) NOT NULL,
  "PurchaseQuantity" numeric(18,6) NOT NULL,
  "PurchasePrice" numeric(18,6) NOT NULL
);

CREATE TABLE IF NOT EXISTS "Products" (
  "Id" uuid PRIMARY KEY,
  "Name" varchar(120) NOT NULL,
  "Size" varchar(40) NOT NULL,
  "SalePrice" numeric(18,6) NOT NULL,
  "FeePercent" numeric(18,6) NOT NULL,
  "FeePerUnit" numeric(18,6) NOT NULL
);

CREATE TABLE IF NOT EXISTS "RecipeItems" (
  "Id" uuid PRIMARY KEY,
  "ProductId" uuid NOT NULL REFERENCES "Products"("Id") ON DELETE CASCADE,
  "IngredientId" uuid NOT NULL REFERENCES "Ingredients"("Id") ON DELETE RESTRICT,
  "Quantity" numeric(18,6) NOT NULL,
  CONSTRAINT "UQ_RecipeItems_Product_Ingredient" UNIQUE ("ProductId", "IngredientId")
);

CREATE TABLE IF NOT EXISTS "Sales" (
  "Id" uuid PRIMARY KEY,
  "SoldOn" date NOT NULL,
  "Channel" varchar(60) NOT NULL,
  "PaymentMethod" varchar(60) NOT NULL
);

CREATE TABLE IF NOT EXISTS "SaleItems" (
  "Id" uuid PRIMARY KEY,
  "SaleId" uuid NOT NULL REFERENCES "Sales"("Id") ON DELETE CASCADE,
  "ProductId" uuid NOT NULL REFERENCES "Products"("Id") ON DELETE RESTRICT,
  "ProductNameSnapshot" varchar(180) NOT NULL,
  "Quantity" numeric(18,6) NOT NULL,
  "SalePriceSnapshot" numeric(18,6) NOT NULL,
  "UnitCostSnapshot" numeric(18,6) NOT NULL,
  "VariableFeeSnapshot" numeric(18,6) NOT NULL
);

CREATE TABLE IF NOT EXISTS "Expenses" (
  "Id" uuid PRIMARY KEY,
  "Description" varchar(180) NOT NULL,
  "Category" varchar(80) NOT NULL,
  "OccurredOn" date NOT NULL,
  "Amount" numeric(18,6) NOT NULL,
  "IsFixed" boolean NOT NULL
);

CREATE TABLE IF NOT EXISTS "FixedCosts" (
  "Id" integer PRIMARY KEY,
  "MonthlyAmount" numeric(18,6) NOT NULL
);

CREATE TABLE IF NOT EXISTS "WorkspaceExtras" (
  "Id" integer PRIMARY KEY,
  "Data" jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS "IX_Expenses_OccurredOn" ON "Expenses" ("OccurredOn");
CREATE INDEX IF NOT EXISTS "IX_Sales_SoldOn" ON "Sales" ("SoldOn");
CREATE INDEX IF NOT EXISTS "IX_RecipeItems_IngredientId" ON "RecipeItems" ("IngredientId");
CREATE INDEX IF NOT EXISTS "IX_SaleItems_ProductId" ON "SaleItems" ("ProductId");
CREATE INDEX IF NOT EXISTS "IX_SaleItems_SaleId" ON "SaleItems" ("SaleId");
`;

export async function ensureSchema(db) {
  if (!schemaReady) {
    schemaReady = db.query(SCHEMA_SQL).catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}
