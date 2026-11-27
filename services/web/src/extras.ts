import type { Product } from "./api/types";

const EXTRAS_KEY = "netuno-acai:extras:v1";

export interface StockEntry {
  currentStock: number;
  minStock: number;
}

export interface MonthlyGoals {
  revenueGoal: number;
  unitsGoal: number;
}

export interface RecurringExpense {
  id: string;
  description: string;
  category: string;
  amount: number;
  isFixed: boolean;
}

export interface WorkspaceExtras {
  stock: Record<string, StockEntry>;
  goals: MonthlyGoals;
  recurringExpenses: RecurringExpense[];
}

function defaultExtras(): WorkspaceExtras {
  return {
    stock: {},
    goals: { revenueGoal: 0, unitsGoal: 0 },
    recurringExpenses: [],
  };
}

function round6(v: number): number {
  return Math.round(v * 1_000_000) / 1_000_000;
}

export function loadExtras(): WorkspaceExtras {
  try {
    const raw = window.localStorage.getItem(EXTRAS_KEY);
    if (!raw) return defaultExtras();
    const parsed = JSON.parse(raw) as Partial<WorkspaceExtras>;
    return {
      stock:
        parsed.stock && typeof parsed.stock === "object" ? parsed.stock : {},
      goals: {
        revenueGoal:
          typeof parsed.goals?.revenueGoal === "number" &&
          parsed.goals.revenueGoal >= 0
            ? parsed.goals.revenueGoal
            : 0,
        unitsGoal:
          typeof parsed.goals?.unitsGoal === "number" &&
          parsed.goals.unitsGoal >= 0
            ? parsed.goals.unitsGoal
            : 0,
      },
      recurringExpenses: Array.isArray(parsed.recurringExpenses)
        ? parsed.recurringExpenses
        : [],
    };
  } catch {
    return defaultExtras();
  }
}

export function saveExtras(next: WorkspaceExtras): WorkspaceExtras {
  window.localStorage.setItem(EXTRAS_KEY, JSON.stringify(next));
  return next;
}

export function updateIngredientStock(
  ingredientId: string,
  entry: StockEntry | null,
): WorkspaceExtras {
  const current = loadExtras();
  const nextStock = { ...current.stock };
  if (entry === null) {
    delete nextStock[ingredientId];
  } else {
    nextStock[ingredientId] = {
      currentStock: Math.max(0, round6(entry.currentStock)),
      minStock: Math.max(0, round6(entry.minStock)),
    };
  }
  return saveExtras({ ...current, stock: nextStock });
}

export function deductStockForSaleItems(
  products: Product[],
  items: { productId: string; quantity: number }[],
): WorkspaceExtras {
  const current = loadExtras();
  if (!Object.keys(current.stock).length) return current;
  const productsById = new Map(products.map((p) => [p.id, p]));
  const nextStock = { ...current.stock };
  let changed = false;

  for (const item of items) {
    const product = productsById.get(item.productId);
    if (!product) continue;
    for (const r of product.recipe) {
      const tracked = nextStock[r.ingredientId];
      if (!tracked) continue;
      nextStock[r.ingredientId] = {
        ...tracked,
        currentStock: Math.max(
          0,
          round6(tracked.currentStock - r.quantity * item.quantity),
        ),
      };
      changed = true;
    }
  }

  return changed ? saveExtras({ ...current, stock: nextStock }) : current;
}

export function saveMonthlyGoals(goals: MonthlyGoals): WorkspaceExtras {
  const current = loadExtras();
  return saveExtras({
    ...current,
    goals: {
      revenueGoal: Math.max(0, goals.revenueGoal),
      unitsGoal: Math.max(0, goals.unitsGoal),
    },
  });
}

export function addRecurringExpense(
  template: Omit<RecurringExpense, "id">,
): WorkspaceExtras {
  const current = loadExtras();
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return saveExtras({
    ...current,
    recurringExpenses: [...current.recurringExpenses, { ...template, id }],
  });
}

export function removeRecurringExpense(id: string): WorkspaceExtras {
  const current = loadExtras();
  return saveExtras({
    ...current,
    recurringExpenses: current.recurringExpenses.filter((x) => x.id !== id),
  });
}
