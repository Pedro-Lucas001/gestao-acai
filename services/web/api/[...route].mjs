import crypto from "node:crypto";
import { ensureSchema, getPool } from "./_db.mjs";

class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function round6(v) {
  return Math.round(v * 1_000_000) / 1_000_000;
}

function asNum(v) {
  return Number(v ?? 0);
}

function dateIso(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function text(value, limit = 120) {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s || s.length > limit) {
    throw new ApiError(`Preencha os textos com até ${limit} caracteres.`);
  }
  return s;
}

function num(value, positive = false, maximum = 1_000_000) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || (positive && n <= 0) || n > maximum) {
    throw new ApiError("Informe valores válidos, com até 6 casas decimais.");
  }
  return round6(n);
}

function validDate(value) {
  const s = typeof value === "string" ? value.trim() : "";
  if (!DATE_RE.test(s)) throw new ApiError("Informe uma data válida.");
  const y = Number(s.slice(0, 4));
  if (y < 2000 || y > 2100) {
    throw new ApiError("Informe uma data entre 2000 e 2100.");
  }
  return s;
}

function validUuid(id, label = "Registro") {
  if (!id || !UUID_RE.test(id)) {
    throw new ApiError(`${label} não encontrado.`, 404);
  }
  return id;
}

function dateRange(query) {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const defaultFrom = `${y}-${m}-01`;
  const lastDay = new Date(Date.UTC(y, now.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
  const from = query.from ? validDate(query.from) : defaultFrom;
  const to = query.to ? validDate(query.to) : lastDay;
  if (from > to) {
    throw new ApiError("A data final deve ser igual ou posterior à inicial.");
  }
  return { from, to };
}

function unitCostOf(recipe, ingredientsById) {
  return recipe.reduce((sum, item) => {
    const ing = ingredientsById.get(item.ingredientId);
    if (!ing || ing.purchaseQuantity <= 0) return sum;
    return sum + (item.quantity * ing.purchasePrice) / ing.purchaseQuantity;
  }, 0);
}

function feeOf(price, percent, perUnit) {
  return (price * percent) / 100 + perUnit;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) throw new ApiError("Preencha os dados do registro.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError("Confira os campos e o formato dos valores.");
  }
}

async function loadProductViews(db) {
  const [{ rows: ingRows }, { rows: prodRows }, { rows: recipeRows }] =
    await Promise.all([
      db.query(
        `SELECT "Id", "Name", "Unit", "PurchaseQuantity", "PurchasePrice" FROM "Ingredients"`,
      ),
      db.query(
        `SELECT "Id", "Name", "Size", "SalePrice", "FeePercent", "FeePerUnit" FROM "Products" ORDER BY "Name"`,
      ),
      db.query(
        `SELECT "ProductId", "IngredientId", "Quantity" FROM "RecipeItems"`,
      ),
    ]);

  const ingredientsById = new Map(
    ingRows.map((r) => [
      r.Id,
      {
        id: r.Id,
        name: r.Name,
        unit: r.Unit,
        purchaseQuantity: asNum(r.PurchaseQuantity),
        purchasePrice: asNum(r.PurchasePrice),
      },
    ]),
  );

  const recipeByProd = new Map();
  for (const r of recipeRows) {
    const list = recipeByProd.get(r.ProductId) ?? [];
    list.push({ ingredientId: r.IngredientId, quantity: asNum(r.Quantity) });
    recipeByProd.set(r.ProductId, list);
  }

  return prodRows.map((p) => {
    const recipe = recipeByProd.get(p.Id) ?? [];
    const price = asNum(p.SalePrice);
    const feePercent = asNum(p.FeePercent);
    const feePerUnit = asNum(p.FeePerUnit);
    const unitCost = round6(unitCostOf(recipe, ingredientsById));
    const variableFee = round6(feeOf(price, feePercent, feePerUnit));
    return {
      id: p.Id,
      name: p.Name,
      size: p.Size,
      price,
      feePercent,
      feePerUnit,
      unitCost,
      variableFee,
      contribution: round6(price - unitCost - variableFee),
      recipe,
    };
  });
}

async function loadSalesInRange(db, from, to) {
  const { rows: salesRows } = await db.query(
    `SELECT "Id", "SoldOn", "Channel", "PaymentMethod" FROM "Sales" WHERE "SoldOn" >= $1 AND "SoldOn" <= $2 ORDER BY "SoldOn" DESC, "Id" ASC`,
    [from, to],
  );
  if (!salesRows.length) return [];
  const ids = salesRows.map((s) => s.Id);
  const { rows: itemRows } = await db.query(
    `SELECT "SaleId", "ProductNameSnapshot", "Quantity", "SalePriceSnapshot", "UnitCostSnapshot", "VariableFeeSnapshot" FROM "SaleItems" WHERE "SaleId" = ANY($1::uuid[])`,
    [ids],
  );
  const itemsBySale = new Map();
  for (const it of itemRows) {
    const list = itemsBySale.get(it.SaleId) ?? [];
    list.push(it);
    itemsBySale.set(it.SaleId, list);
  }
  return salesRows.map((s) => {
    const items = itemsBySale.get(s.Id) ?? [];
    const quantity = round6(items.reduce((sum, x) => sum + asNum(x.Quantity), 0));
    const total = round6(
      items.reduce(
        (sum, x) => sum + asNum(x.Quantity) * asNum(x.SalePriceSnapshot),
        0,
      ),
    );
    const contribution = round6(
      items.reduce(
        (sum, x) =>
          sum +
          asNum(x.Quantity) *
            (asNum(x.SalePriceSnapshot) -
              asNum(x.UnitCostSnapshot) -
              asNum(x.VariableFeeSnapshot)),
        0,
      ),
    );
    return {
      id: s.Id,
      date: dateIso(s.SoldOn),
      channel: s.Channel,
      paymentMethod: s.PaymentMethod,
      productName: items.map((x) => x.ProductNameSnapshot).join(", "),
      quantity,
      total,
      contribution,
    };
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const db = getPool();
  if (!db) {
    return res.status(404).json({
      code: "NO_DATABASE",
      error: "Banco de dados na nuvem não configurado.",
    });
  }

  try {
    await ensureSchema(db);

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const parts = url.pathname
      .replace(/^\/api\/?/, "")
      .split("/")
      .filter(Boolean);
    const [resource, id] = parts;
    const query = Object.fromEntries(url.searchParams.entries());
    const method = (req.method || "GET").toUpperCase();

    if (resource === "health" && method === "GET") {
      await db.query("SELECT 1");
      return res.status(200).json({ status: "ok", database: "connected" });
    }

    // INGREDIENTS
    if (resource === "ingredients") {
      if (!id && method === "GET") {
        const { rows } = await db.query(
          `SELECT "Id", "Name", "Unit", "PurchaseQuantity", "PurchasePrice" FROM "Ingredients" ORDER BY "Name"`,
        );
        return res.status(200).json(
          rows.map((r) => ({
            id: r.Id,
            name: r.Name,
            unit: r.Unit,
            purchaseQuantity: asNum(r.PurchaseQuantity),
            purchasePrice: asNum(r.PurchasePrice),
          })),
        );
      }
      if (!id && method === "POST") {
        const b = await readBody(req);
        const name = text(b.name);
        const unit = text(b.unit, 12);
        if (!["g", "ml", "un"].includes(unit)) {
          throw new ApiError(
            "Use g, ml ou un e a mesma unidade na ficha técnica.",
          );
        }
        const purchaseQuantity = num(b.purchaseQuantity, true);
        const purchasePrice = num(b.purchasePrice);
        const newId = crypto.randomUUID();
        await db.query(
          `INSERT INTO "Ingredients" ("Id", "Name", "Unit", "PurchaseQuantity", "PurchasePrice") VALUES ($1, $2, $3, $4, $5)`,
          [newId, name, unit, purchaseQuantity, purchasePrice],
        );
        return res.status(200).json({
          id: newId,
          name,
          unit,
          purchaseQuantity,
          purchasePrice,
        });
      }
      if (id && method === "PUT") {
        validUuid(id, "Insumo");
        const { rows } = await db.query(
          `SELECT "Id", "Unit" FROM "Ingredients" WHERE "Id" = $1`,
          [id],
        );
        if (!rows.length) throw new ApiError("Insumo não encontrado.", 404);
        const b = await readBody(req);
        const name = text(b.name);
        const unit = text(b.unit, 12);
        if (!["g", "ml", "un"].includes(unit)) {
          throw new ApiError(
            "Use g, ml ou un e a mesma unidade na ficha técnica.",
          );
        }
        if (unit !== rows[0].Unit) {
          const used = await db.query(
            `SELECT 1 FROM "RecipeItems" WHERE "IngredientId" = $1 LIMIT 1`,
            [id],
          );
          if (used.rows.length) {
            throw new ApiError(
              "A unidade de um insumo usado em fichas técnicas não pode ser alterada.",
            );
          }
        }
        const purchaseQuantity = num(b.purchaseQuantity, true);
        const purchasePrice = num(b.purchasePrice);
        await db.query(
          `UPDATE "Ingredients" SET "Name" = $2, "Unit" = $3, "PurchaseQuantity" = $4, "PurchasePrice" = $5 WHERE "Id" = $1`,
          [id, name, unit, purchaseQuantity, purchasePrice],
        );
        return res.status(200).json({ id });
      }
      if (id && method === "DELETE") {
        validUuid(id, "Insumo");
        const result = await db.query(
          `DELETE FROM "Ingredients" WHERE "Id" = $1`,
          [id],
        );
        if (!result.rowCount) throw new ApiError("Insumo não encontrado.", 404);
        return res.status(200).json({ id });
      }
    }

    // PRODUCTS
    if (resource === "products") {
      if (!id && method === "GET") {
        return res.status(200).json(await loadProductViews(db));
      }
      if ((!id && method === "POST") || (id && method === "PUT")) {
        if (id) validUuid(id, "Produto");
        const b = await readBody(req);
        const name = text(b.name);
        const size = text(b.size, 40);
        const price = num(b.price, true);
        const feePercent = num(b.feePercent, false, 100);
        const feePerUnit = num(b.feePerUnit);
        const recipe = Array.isArray(b.recipe) ? b.recipe : [];
        const uniqueIds = new Set(recipe.map((x) => x.ingredientId));
        if (
          recipe.length === 0 ||
          recipe.length > 100 ||
          uniqueIds.size !== recipe.length
        ) {
          throw new ApiError(
            "Inclua de 1 a 100 insumos diferentes na ficha técnica.",
          );
        }
        const validatedRecipe = recipe.map((item) => ({
          ingredientId: validUuid(item.ingredientId, "Insumo"),
          quantity: num(item.quantity, true),
        }));

        const client = await db.connect();
        try {
          await client.query("BEGIN");
          const ingCheck = await client.query(
            `SELECT COUNT(*)::int AS c FROM "Ingredients" WHERE "Id" = ANY($1::uuid[])`,
            [validatedRecipe.map((x) => x.ingredientId)],
          );
          if (ingCheck.rows[0].c !== validatedRecipe.length) {
            throw new ApiError("Um dos insumos não existe mais.");
          }

          const prodId = id || crypto.randomUUID();
          if (id) {
            const upd = await client.query(
              `UPDATE "Products" SET "Name" = $2, "Size" = $3, "SalePrice" = $4, "FeePercent" = $5, "FeePerUnit" = $6 WHERE "Id" = $1`,
              [prodId, name, size, price, feePercent, feePerUnit],
            );
            if (!upd.rowCount) {
              throw new ApiError("Produto não encontrado.", 404);
            }
            await client.query(
              `DELETE FROM "RecipeItems" WHERE "ProductId" = $1`,
              [prodId],
            );
          } else {
            await client.query(
              `INSERT INTO "Products" ("Id", "Name", "Size", "SalePrice", "FeePercent", "FeePerUnit") VALUES ($1, $2, $3, $4, $5, $6)`,
              [prodId, name, size, price, feePercent, feePerUnit],
            );
          }

          for (const r of validatedRecipe) {
            await client.query(
              `INSERT INTO "RecipeItems" ("Id", "ProductId", "IngredientId", "Quantity") VALUES ($1, $2, $3, $4)`,
              [crypto.randomUUID(), prodId, r.ingredientId, r.quantity],
            );
          }
          await client.query("COMMIT");
          return res.status(200).json({ id: prodId });
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      }
      if (id && method === "DELETE") {
        validUuid(id, "Produto");
        const result = await db.query(
          `DELETE FROM "Products" WHERE "Id" = $1`,
          [id],
        );
        if (!result.rowCount) {
          throw new ApiError("Produto não encontrado.", 404);
        }
        return res.status(200).json({ id });
      }
    }

    // SALES
    if (resource === "sales") {
      if (!id && method === "GET") {
        const { from, to } = dateRange(query);
        return res.status(200).json(await loadSalesInRange(db, from, to));
      }
      if (!id && method === "POST") {
        const b = await readBody(req);
        const date = validDate(b.date);
        const channel = text(b.channel, 60);
        const paymentMethod = text(b.paymentMethod, 60);
        const rawItems =
          Array.isArray(b.items) && b.items.length > 0
            ? b.items
            : [
                {
                  productId: b.productId,
                  quantity: b.quantity,
                  price: b.price,
                  feePercent: b.feePercent,
                  feePerUnit: b.feePerUnit,
                },
              ];
        if (rawItems.length > 50) {
          throw new ApiError("Inclua até 50 itens por venda.");
        }
        const validated = rawItems.map((line) => ({
          productId: validUuid(line.productId, "Produto"),
          quantity: num(line.quantity, true),
          price: num(line.price, true),
          feePercent: num(line.feePercent, false, 100),
          feePerUnit: num(line.feePerUnit),
        }));

        const client = await db.connect();
        try {
          await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
          const products = await loadProductViews(client);
          const prodMap = new Map(products.map((p) => [p.id, p]));
          const saleId = crypto.randomUUID();
          await client.query(
            `INSERT INTO "Sales" ("Id", "SoldOn", "Channel", "PaymentMethod") VALUES ($1, $2, $3, $4)`,
            [saleId, date, channel, paymentMethod],
          );

          const names = [];
          let qtySum = 0;
          let totalSum = 0;
          let contribSum = 0;

          for (const line of validated) {
            const product = prodMap.get(line.productId);
            if (!product) throw new ApiError("Produto não encontrado.");
            if (!product.recipe.length) {
              throw new ApiError("Complete a ficha técnica antes de vender.");
            }
            const nameSnap = `${product.name} · ${product.size}`;
            const unitCost = round6(product.unitCost);
            const variableFee = round6(
              feeOf(line.price, line.feePercent, line.feePerUnit),
            );
            await client.query(
              `INSERT INTO "SaleItems" ("Id", "SaleId", "ProductId", "ProductNameSnapshot", "Quantity", "SalePriceSnapshot", "UnitCostSnapshot", "VariableFeeSnapshot") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                crypto.randomUUID(),
                saleId,
                product.id,
                nameSnap,
                line.quantity,
                line.price,
                unitCost,
                variableFee,
              ],
            );
            names.push(nameSnap);
            qtySum += line.quantity;
            totalSum += line.quantity * line.price;
            contribSum += line.quantity * (line.price - unitCost - variableFee);
          }

          await client.query("COMMIT");
          return res.status(200).json({
            id: saleId,
            date,
            channel,
            paymentMethod,
            productName: names.join(", "),
            quantity: round6(qtySum),
            total: round6(totalSum),
            contribution: round6(contribSum),
          });
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      }
      if (id && method === "DELETE") {
        validUuid(id, "Venda");
        const result = await db.query(`DELETE FROM "Sales" WHERE "Id" = $1`, [
          id,
        ]);
        if (!result.rowCount) throw new ApiError("Venda não encontrada.", 404);
        return res.status(200).json({ id });
      }
    }

    // EXPENSES
    if (resource === "expenses") {
      if (!id && method === "GET") {
        const { from, to } = dateRange(query);
        const { rows } = await db.query(
          `SELECT "Id", "Description", "Category", "OccurredOn", "Amount", "IsFixed" FROM "Expenses" WHERE "OccurredOn" >= $1 AND "OccurredOn" <= $2 ORDER BY "OccurredOn" DESC`,
          [from, to],
        );
        return res.status(200).json(
          rows.map((r) => ({
            id: r.Id,
            description: r.Description,
            category: r.Category,
            date: dateIso(r.OccurredOn),
            amount: asNum(r.Amount),
            isFixed: Boolean(r.IsFixed),
          })),
        );
      }
      if (!id && method === "POST") {
        const b = await readBody(req);
        const newId = crypto.randomUUID();
        await db.query(
          `INSERT INTO "Expenses" ("Id", "Description", "Category", "OccurredOn", "Amount", "IsFixed") VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            newId,
            text(b.description, 180),
            text(b.category, 80),
            validDate(b.date),
            num(b.amount, true),
            Boolean(b.isFixed),
          ],
        );
        return res.status(200).json({ id: newId });
      }
      if (id && method === "PUT") {
        validUuid(id, "Despesa");
        const b = await readBody(req);
        const result = await db.query(
          `UPDATE "Expenses" SET "Description" = $2, "Category" = $3, "OccurredOn" = $4, "Amount" = $5, "IsFixed" = $6 WHERE "Id" = $1`,
          [
            id,
            text(b.description, 180),
            text(b.category, 80),
            validDate(b.date),
            num(b.amount, true),
            Boolean(b.isFixed),
          ],
        );
        if (!result.rowCount) {
          throw new ApiError("Despesa não encontrada.", 404);
        }
        return res.status(200).json({ id });
      }
      if (id && method === "DELETE") {
        validUuid(id, "Despesa");
        const result = await db.query(
          `DELETE FROM "Expenses" WHERE "Id" = $1`,
          [id],
        );
        if (!result.rowCount) {
          throw new ApiError("Despesa não encontrada.", 404);
        }
        return res.status(200).json({ id });
      }
    }

    // FIXED COSTS
    if (resource === "fixed-costs") {
      if (method === "GET") {
        const { rows } = await db.query(
          `SELECT "MonthlyAmount" FROM "FixedCosts" WHERE "Id" = 1`,
        );
        return res
          .status(200)
          .json({ monthlyAmount: rows.length ? asNum(rows[0].MonthlyAmount) : 0 });
      }
      if (method === "PUT") {
        const b = await readBody(req);
        const monthlyAmount = num(b.monthlyAmount);
        await db.query(
          `INSERT INTO "FixedCosts" ("Id", "MonthlyAmount") VALUES (1, $1) ON CONFLICT ("Id") DO UPDATE SET "MonthlyAmount" = EXCLUDED."MonthlyAmount"`,
          [monthlyAmount],
        );
        return res.status(200).json({ monthlyAmount });
      }
    }

    // WORKSPACE EXTRAS (stock, goals, recurring expenses synced across devices)
    if (resource === "extras") {
      if (method === "GET") {
        const { rows } = await db.query(
          `SELECT "Data" FROM "WorkspaceExtras" WHERE "Id" = 1`,
        );
        const data = rows.length ? rows[0].Data : null;
        return res.status(200).json(
          data || {
            stock: {},
            goals: { revenueGoal: 0, unitsGoal: 0 },
            recurringExpenses: [],
          },
        );
      }
      if (method === "PUT") {
        const b = await readBody(req);
        const payload = {
          stock: b.stock && typeof b.stock === "object" ? b.stock : {},
          goals: {
            revenueGoal: Number(b.goals?.revenueGoal) || 0,
            unitsGoal: Number(b.goals?.unitsGoal) || 0,
          },
          recurringExpenses: Array.isArray(b.recurringExpenses)
            ? b.recurringExpenses
            : [],
        };
        await db.query(
          `INSERT INTO "WorkspaceExtras" ("Id", "Data") VALUES (1, $1::jsonb) ON CONFLICT ("Id") DO UPDATE SET "Data" = EXCLUDED."Data"`,
          [JSON.stringify(payload)],
        );
        return res.status(200).json(payload);
      }
    }

    // DASHBOARD
    if (resource === "dashboard" && method === "GET") {
      const { from, to } = dateRange(query);
      const [salesRes, itemsRes, expRes, fixedRes] = await Promise.all([
        db.query(
          `SELECT "Id", "SoldOn" FROM "Sales" WHERE "SoldOn" >= $1 AND "SoldOn" <= $2`,
          [from, to],
        ),
        db.query(
          `SELECT s."SoldOn", i."Quantity", i."SalePriceSnapshot", i."UnitCostSnapshot", i."VariableFeeSnapshot"
           FROM "SaleItems" i JOIN "Sales" s ON s."Id" = i."SaleId"
           WHERE s."SoldOn" >= $1 AND s."SoldOn" <= $2`,
          [from, to],
        ),
        db.query(
          `SELECT COALESCE(SUM("Amount"), 0) AS total FROM "Expenses" WHERE "OccurredOn" >= $1 AND "OccurredOn" <= $2`,
          [from, to],
        ),
        db.query(`SELECT "MonthlyAmount" FROM "FixedCosts" WHERE "Id" = 1`),
      ]);

      let revenue = 0;
      let cost = 0;
      let fees = 0;
      let quantity = 0;
      const dailyMap = new Map();

      for (const it of itemsRes.rows) {
        const q = asNum(it.Quantity);
        const p = asNum(it.SalePriceSnapshot);
        const c = asNum(it.UnitCostSnapshot);
        const f = asNum(it.VariableFeeSnapshot);
        revenue += q * p;
        cost += q * c;
        fees += q * f;
        quantity += q;
        const d = dateIso(it.SoldOn);
        dailyMap.set(d, round6((dailyMap.get(d) ?? 0) + q * p));
      }

      revenue = round6(revenue);
      cost = round6(cost);
      fees = round6(fees);
      quantity = round6(quantity);
      const expenses = round6(asNum(expRes.rows[0]?.total));
      const contribution = round6(revenue - cost - fees);
      const monthlyFixedCosts = fixedRes.rows.length
        ? asNum(fixedRes.rows[0].MonthlyAmount)
        : 0;
      const avgContrib = quantity > 0 ? contribution / quantity : 0;
      const breakEvenUnits =
        quantity > 0 && avgContrib > 0
          ? Math.ceil(monthlyFixedCosts / avgContrib)
          : null;

      return res.status(200).json({
        revenue,
        cost,
        fees,
        expenses,
        contribution,
        netResult: round6(contribution - expenses),
        salesCount: salesRes.rows.length,
        quantity,
        averageMargin: revenue > 0 ? (contribution / revenue) * 100 : 0,
        monthlyFixedCosts,
        breakEvenUnits,
        daily: Array.from(dailyMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, rev]) => ({ date, revenue: rev })),
      });
    }

    // ONE-CLICK SYNC LOCAL BROWSER DATA TO CLOUD DB
    if (resource === "sync-local" && method === "POST") {
      const b = await readBody(req);
      const ingredients = Array.isArray(b.ingredients) ? b.ingredients : [];
      const products = Array.isArray(b.products) ? b.products : [];
      const sales = Array.isArray(b.sales) ? b.sales : [];
      const expenses = Array.isArray(b.expenses) ? b.expenses : [];
      const monthlyFixedCosts = num(b.monthlyFixedCosts ?? 0);

      const client = await db.connect();
      try {
        await client.query("BEGIN");
        const idMap = new Map();
        const ensureUuid = (raw) => {
          if (raw && UUID_RE.test(raw)) return raw;
          if (!idMap.has(raw)) idMap.set(raw, crypto.randomUUID());
          return idMap.get(raw);
        };

        for (const ing of ingredients) {
          const uid = ensureUuid(ing.id);
          await client.query(
            `INSERT INTO "Ingredients" ("Id", "Name", "Unit", "PurchaseQuantity", "PurchasePrice")
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT ("Id") DO NOTHING`,
            [
              uid,
              text(ing.name),
              text(ing.unit, 12),
              num(ing.purchaseQuantity, true),
              num(ing.purchasePrice),
            ],
          );
        }

        for (const prod of products) {
          const pid = ensureUuid(prod.id);
          await client.query(
            `INSERT INTO "Products" ("Id", "Name", "Size", "SalePrice", "FeePercent", "FeePerUnit")
             VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT ("Id") DO NOTHING`,
            [
              pid,
              text(prod.name),
              text(prod.size, 40),
              num(prod.price, true),
              num(prod.feePercent ?? 0, false, 100),
              num(prod.feePerUnit ?? 0),
            ],
          );
          for (const r of prod.recipe ?? []) {
            await client.query(
              `INSERT INTO "RecipeItems" ("Id", "ProductId", "IngredientId", "Quantity")
               VALUES ($1, $2, $3, $4) ON CONFLICT ("ProductId", "IngredientId") DO NOTHING`,
              [
                crypto.randomUUID(),
                pid,
                ensureUuid(r.ingredientId),
                num(r.quantity, true),
              ],
            );
          }
        }

        for (const sale of sales) {
          const sid = ensureUuid(sale.id);
          const inserted = await client.query(
            `INSERT INTO "Sales" ("Id", "SoldOn", "Channel", "PaymentMethod")
             VALUES ($1, $2, $3, $4) ON CONFLICT ("Id") DO NOTHING`,
            [
              sid,
              validDate(sale.date),
              text(sale.channel || "Venda direta", 60),
              text(sale.paymentMethod || "PIX", 60),
            ],
          );
          if (inserted.rowCount) {
            const lines =
              Array.isArray(sale.items) && sale.items.length
                ? sale.items
                : [
                    {
                      productId: sale.productId,
                      productName: sale.productName,
                      quantity: sale.quantity,
                      salePriceSnapshot: sale.salePriceSnapshot,
                      unitCostSnapshot: sale.unitCostSnapshot,
                      variableFeeSnapshot: sale.variableFeeSnapshot,
                    },
                  ];
            for (const line of lines) {
              await client.query(
                `INSERT INTO "SaleItems" ("Id", "SaleId", "ProductId", "ProductNameSnapshot", "Quantity", "SalePriceSnapshot", "UnitCostSnapshot", "VariableFeeSnapshot")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                  crypto.randomUUID(),
                  sid,
                  ensureUuid(line.productId),
                  text(line.productName || "Produto", 180),
                  num(line.quantity, true),
                  num(line.salePriceSnapshot, true),
                  num(line.unitCostSnapshot ?? 0),
                  num(line.variableFeeSnapshot ?? 0),
                ],
              );
            }
          }
        }

        for (const exp of expenses) {
          await client.query(
            `INSERT INTO "Expenses" ("Id", "Description", "Category", "OccurredOn", "Amount", "IsFixed")
             VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT ("Id") DO NOTHING`,
            [
              ensureUuid(exp.id),
              text(exp.description, 180),
              text(exp.category, 80),
              validDate(exp.date),
              num(exp.amount, true),
              Boolean(exp.isFixed),
            ],
          );
        }

        if (monthlyFixedCosts > 0) {
          await client.query(
            `INSERT INTO "FixedCosts" ("Id", "MonthlyAmount") VALUES (1, $1) ON CONFLICT ("Id") DO UPDATE SET "MonthlyAmount" = EXCLUDED."MonthlyAmount"`,
            [monthlyFixedCosts],
          );
        }

        if (b.extras && typeof b.extras === "object") {
          const remappedStock = {};
          for (const [k, v] of Object.entries(b.extras.stock ?? {})) {
            remappedStock[ensureUuid(k)] = v;
          }
          const extrasPayload = {
            stock: remappedStock,
            goals: b.extras.goals ?? { revenueGoal: 0, unitsGoal: 0 },
            recurringExpenses: Array.isArray(b.extras.recurringExpenses)
              ? b.extras.recurringExpenses
              : [],
          };
          await client.query(
            `INSERT INTO "WorkspaceExtras" ("Id", "Data") VALUES (1, $1::jsonb) ON CONFLICT ("Id") DO UPDATE SET "Data" = EXCLUDED."Data"`,
            [JSON.stringify(extrasPayload)],
          );
        }

        await client.query("COMMIT");
        return res.status(200).json({ synced: true });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    return res.status(404).json({ error: "Rota não encontrada." });
  } catch (err) {
    if (err instanceof ApiError) {
      return res.status(err.status).json({ error: err.message });
    }
    if (err?.code === "23503" || err?.code === "23505") {
      return res.status(409).json({
        error:
          "O registro está em uso ou foi alterado. Atualize a página e confira os vínculos.",
      });
    }
    console.error("[netuno-api]", err);
    return res.status(503).json({
      error: "Não foi possível acessar o banco de dados. Tente novamente.",
    });
  }
}
