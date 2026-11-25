import type {
  DashboardSummary,
  Expense,
  Ingredient,
  Period,
  Product,
  RecipeItem,
  Sale,
  Snapshot,
} from "./types";

const STORAGE_KEY = "netuno-acai:storage:v1";

interface StoredProduct {
  id: string;
  name: string;
  size: string;
  price: number;
  feePercent: number;
  feePerUnit: number;
  recipe: RecipeItem[];
}

interface StoredSale {
  id: string;
  date: string;
  productId: string;
  productName: string;
  channel: string;
  paymentMethod: string;
  quantity: number;
  salePriceSnapshot: number;
  unitCostSnapshot: number;
  variableFeeSnapshot: number;
}

interface LocalDatabase {
  version: 1;
  ingredients: Ingredient[];
  products: StoredProduct[];
  sales: StoredSale[];
  expenses: Expense[];
  monthlyFixedCosts: number;
}

function emptyDb(): LocalDatabase {
  return {
    version: 1,
    ingredients: [],
    products: [],
    sales: [],
    expenses: [],
    monthlyFixedCosts: 0,
  };
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readDb(): LocalDatabase {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDb();
    const parsed = JSON.parse(raw) as Partial<LocalDatabase>;
    return {
      version: 1,
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      sales: Array.isArray(parsed.sales) ? parsed.sales : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      monthlyFixedCosts:
        typeof parsed.monthlyFixedCosts === "number" &&
        Number.isFinite(parsed.monthlyFixedCosts) &&
        parsed.monthlyFixedCosts >= 0
          ? parsed.monthlyFixedCosts
          : 0,
    };
  } catch {
    return emptyDb();
  }
}

function writeDb(db: LocalDatabase): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function requireText(value: unknown, limit = 120): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed || trimmed.length > limit) {
    throw new Error(`Preencha os textos com até ${limit} caracteres.`);
  }
  return trimmed;
}

function requireNumber(
  value: unknown,
  positive = false,
  maximum = 1_000_000,
): number {
  const n = Number(value);
  if (
    !Number.isFinite(n) ||
    n < 0 ||
    (positive && n <= 0) ||
    n > maximum
  ) {
    throw new Error("Informe valores válidos, com até 6 casas decimais.");
  }
  return round6(n);
}

function requireDate(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error("Informe uma data válida.");
  }
  const year = Number(text.slice(0, 4));
  if (year < 2000 || year > 2100) {
    throw new Error("Informe uma data entre 2000 e 2100.");
  }
  return text;
}

function unitCostOf(
  recipe: RecipeItem[],
  ingredientsById: Map<string, Ingredient>,
): number {
  return recipe.reduce((sum, item) => {
    const ing = ingredientsById.get(item.ingredientId);
    if (!ing || ing.purchaseQuantity <= 0) return sum;
    return sum + (item.quantity * ing.purchasePrice) / ing.purchaseQuantity;
  }, 0);
}

function feeOf(price: number, percent: number, perUnit: number): number {
  return (price * percent) / 100 + perUnit;
}

function toProductView(
  product: StoredProduct,
  ingredientsById: Map<string, Ingredient>,
): Product {
  const unitCost = round6(unitCostOf(product.recipe, ingredientsById));
  const variableFee = round6(
    feeOf(product.price, product.feePercent, product.feePerUnit),
  );
  const contribution = round6(product.price - unitCost - variableFee);
  return {
    ...product,
    unitCost,
    variableFee,
    contribution,
  };
}

function toSaleView(sale: StoredSale): Sale {
  const total = round6(sale.quantity * sale.salePriceSnapshot);
  const contribution = round6(
    sale.quantity *
      (sale.salePriceSnapshot -
        sale.unitCostSnapshot -
        sale.variableFeeSnapshot),
  );
  return {
    id: sale.id,
    date: sale.date,
    productName: sale.productName,
    channel: sale.channel,
    paymentMethod: sale.paymentMethod,
    quantity: sale.quantity,
    total,
    contribution,
  };
}

export const localStore = {
  load(period: Period): Snapshot {
    const db = readDb();
    const ingredients = [...db.ingredients].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
    const ingredientsById = new Map(ingredients.map((x) => [x.id, x]));
    const products = [...db.products]
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map((p) => toProductView(p, ingredientsById));

    const filteredSales = db.sales
      .filter((s) => s.date >= period.from && s.date <= period.to)
      .sort((a, b) =>
        b.date !== a.date
          ? b.date.localeCompare(a.date)
          : a.id.localeCompare(b.id),
      );
    const sales = filteredSales.map(toSaleView);

    const expenses = db.expenses
      .filter((e) => e.date >= period.from && e.date <= period.to)
      .sort((a, b) => b.date.localeCompare(a.date));

    const revenue = round6(
      filteredSales.reduce(
        (sum, s) => sum + s.quantity * s.salePriceSnapshot,
        0,
      ),
    );
    const cost = round6(
      filteredSales.reduce(
        (sum, s) => sum + s.quantity * s.unitCostSnapshot,
        0,
      ),
    );
    const fees = round6(
      filteredSales.reduce(
        (sum, s) => sum + s.quantity * s.variableFeeSnapshot,
        0,
      ),
    );
    const totalExpenses = round6(
      expenses.reduce((sum, e) => sum + e.amount, 0),
    );
    const contribution = round6(revenue - cost - fees);
    const quantity = round6(
      filteredSales.reduce((sum, s) => sum + s.quantity, 0),
    );
    const averageMargin = revenue > 0 ? (contribution / revenue) * 100 : 0;
    const avgContributionPerUnit = quantity > 0 ? contribution / quantity : 0;
    const breakEvenUnits =
      quantity > 0 && avgContributionPerUnit > 0
        ? Math.ceil(db.monthlyFixedCosts / avgContributionPerUnit)
        : null;

    const dailyMap = new Map<string, number>();
    for (const s of filteredSales) {
      dailyMap.set(
        s.date,
        round6((dailyMap.get(s.date) ?? 0) + s.quantity * s.salePriceSnapshot),
      );
    }
    const daily = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rev]) => ({ date, revenue: rev }));

    const summary: DashboardSummary = {
      revenue,
      cost,
      fees,
      expenses: totalExpenses,
      contribution,
      netResult: round6(contribution - totalExpenses),
      salesCount: filteredSales.length,
      quantity,
      averageMargin,
      monthlyFixedCosts: db.monthlyFixedCosts,
      breakEvenUnits,
      daily,
    };

    return { summary, ingredients, products, sales, expenses };
  },

  save(path: string, body: Record<string, unknown>, id?: string): unknown {
    const db = readDb();

    if (path === "fixed-costs") {
      db.monthlyFixedCosts = requireNumber(body.monthlyAmount);
      writeDb(db);
      return { monthlyAmount: db.monthlyFixedCosts };
    }

    if (path === "ingredients") {
      const name = requireText(body.name);
      const unit = requireText(body.unit, 12);
      if (!["g", "ml", "un"].includes(unit)) {
        throw new Error(
          "Use g, ml ou un e a mesma unidade na ficha técnica.",
        );
      }
      const purchaseQuantity = requireNumber(body.purchaseQuantity, true);
      const purchasePrice = requireNumber(body.purchasePrice);

      if (id) {
        const existing = db.ingredients.find((x) => x.id === id);
        if (!existing) throw new Error("Insumo não encontrado.");
        if (
          existing.unit !== unit &&
          db.products.some((p) => p.recipe.some((r) => r.ingredientId === id))
        ) {
          throw new Error(
            "A unidade de um insumo usado em fichas técnicas não pode ser alterada.",
          );
        }
        existing.name = name;
        existing.unit = unit;
        existing.purchaseQuantity = purchaseQuantity;
        existing.purchasePrice = purchasePrice;
        writeDb(db);
        return { id };
      }

      const row: Ingredient = {
        id: newId(),
        name,
        unit,
        purchaseQuantity,
        purchasePrice,
      };
      db.ingredients.push(row);
      writeDb(db);
      return row;
    }

    if (path === "products") {
      const name = requireText(body.name);
      const size = requireText(body.size, 40);
      const price = requireNumber(body.price, true);
      const feePercent = requireNumber(body.feePercent, false, 100);
      const feePerUnit = requireNumber(body.feePerUnit);
      const rawRecipe = Array.isArray(body.recipe)
        ? (body.recipe as RecipeItem[])
        : [];
      const uniqueIds = new Set(rawRecipe.map((r) => r.ingredientId));
      if (
        rawRecipe.length === 0 ||
        rawRecipe.length > 100 ||
        uniqueIds.size !== rawRecipe.length
      ) {
        throw new Error(
          "Inclua de 1 a 100 insumos diferentes na ficha técnica.",
        );
      }
      const ingredientIds = new Set(db.ingredients.map((x) => x.id));
      const recipe: RecipeItem[] = rawRecipe.map((item) => {
        if (!ingredientIds.has(item.ingredientId)) {
          throw new Error("Um dos insumos não existe mais.");
        }
        return {
          ingredientId: item.ingredientId,
          quantity: requireNumber(item.quantity, true),
        };
      });

      if (id) {
        const existing = db.products.find((x) => x.id === id);
        if (!existing) throw new Error("Produto não encontrado.");
        existing.name = name;
        existing.size = size;
        existing.price = price;
        existing.feePercent = feePercent;
        existing.feePerUnit = feePerUnit;
        existing.recipe = recipe;
        writeDb(db);
        return { id };
      }

      const row: StoredProduct = {
        id: newId(),
        name,
        size,
        price,
        feePercent,
        feePerUnit,
        recipe,
      };
      db.products.push(row);
      writeDb(db);
      return { id: row.id };
    }

    if (path === "sales") {
      const date = requireDate(body.date);
      const quantity = requireNumber(body.quantity, true);
      const price = requireNumber(body.price, true);
      const feePercent = requireNumber(body.feePercent, false, 100);
      const feePerUnit = requireNumber(body.feePerUnit);
      const channel = requireText(body.channel, 60);
      const paymentMethod = requireText(body.paymentMethod, 60);
      const productId = String(body.productId ?? "");
      const product = db.products.find((p) => p.id === productId);
      if (!product) throw new Error("Produto não encontrado.");
      if (!product.recipe.length) {
        throw new Error("Complete a ficha técnica antes de vender.");
      }
      const ingredientsById = new Map(db.ingredients.map((x) => [x.id, x]));
      const cost = round6(unitCostOf(product.recipe, ingredientsById));
      const variableFee = round6(feeOf(price, feePercent, feePerUnit));
      const sale: StoredSale = {
        id: newId(),
        date,
        productId: product.id,
        productName: `${product.name} · ${product.size}`,
        channel,
        paymentMethod,
        quantity,
        salePriceSnapshot: price,
        unitCostSnapshot: cost,
        variableFeeSnapshot: variableFee,
      };
      db.sales.push(sale);
      writeDb(db);
      return toSaleView(sale);
    }

    if (path === "expenses") {
      const description = requireText(body.description, 180);
      const category = requireText(body.category, 80);
      const date = requireDate(body.date);
      const amount = requireNumber(body.amount, true);
      const isFixed = Boolean(body.isFixed);

      if (id) {
        const existing = db.expenses.find((x) => x.id === id);
        if (!existing) throw new Error("Despesa não encontrada.");
        existing.description = description;
        existing.category = category;
        existing.date = date;
        existing.amount = amount;
        existing.isFixed = isFixed;
        writeDb(db);
        return { id };
      }

      const row: Expense = {
        id: newId(),
        description,
        category,
        date,
        amount,
        isFixed,
      };
      db.expenses.push(row);
      writeDb(db);
      return { id: row.id };
    }

    throw new Error("Operação não suportada.");
  },

  remove(path: string, id: string): { id: string } {
    const db = readDb();

    if (path === "ingredients") {
      const exists = db.ingredients.some((x) => x.id === id);
      if (!exists) throw new Error("Insumo não encontrado.");
      if (db.products.some((p) => p.recipe.some((r) => r.ingredientId === id))) {
        throw new Error(
          "Este insumo está vinculado a uma ficha técnica e não pode ser excluído.",
        );
      }
      db.ingredients = db.ingredients.filter((x) => x.id !== id);
      writeDb(db);
      return { id };
    }

    if (path === "products") {
      const exists = db.products.some((x) => x.id === id);
      if (!exists) throw new Error("Produto não encontrado.");
      if (db.sales.some((s) => s.productId === id)) {
        throw new Error(
          "Este produto possui vendas registradas e não pode ser excluído.",
        );
      }
      db.products = db.products.filter((x) => x.id !== id);
      writeDb(db);
      return { id };
    }

    if (path === "sales") {
      const exists = db.sales.some((x) => x.id === id);
      if (!exists) throw new Error("Venda não encontrada.");
      db.sales = db.sales.filter((x) => x.id !== id);
      writeDb(db);
      return { id };
    }

    if (path === "expenses") {
      const exists = db.expenses.some((x) => x.id === id);
      if (!exists) throw new Error("Despesa não encontrada.");
      db.expenses = db.expenses.filter((x) => x.id !== id);
      writeDb(db);
      return { id };
    }

    throw new Error("Operação não suportada.");
  },

  exportBackup(): string {
    return JSON.stringify(readDb(), null, 2);
  },

  importBackup(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Arquivo inválido. Selecione um backup JSON da Netuno Açaí.");
    }
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Formato de backup inválido.");
    }
    const candidate = parsed as Partial<LocalDatabase>;
    if (
      !Array.isArray(candidate.ingredients) ||
      !Array.isArray(candidate.products) ||
      !Array.isArray(candidate.sales) ||
      !Array.isArray(candidate.expenses)
    ) {
      throw new Error(
        "O arquivo não contém a estrutura esperada de backup (insumos, produtos, vendas e despesas).",
      );
    }
    writeDb({
      version: 1,
      ingredients: candidate.ingredients,
      products: candidate.products,
      sales: candidate.sales,
      expenses: candidate.expenses,
      monthlyFixedCosts:
        typeof candidate.monthlyFixedCosts === "number" &&
        Number.isFinite(candidate.monthlyFixedCosts) &&
        candidate.monthlyFixedCosts >= 0
          ? candidate.monthlyFixedCosts
          : 0,
    });
  },
};
