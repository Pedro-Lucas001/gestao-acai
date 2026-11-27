import { localStore } from "./localStore";
import { previousPeriod } from "../reports";
import type {
  DashboardSummary,
  Expense,
  Ingredient,
  Period,
  Product,
  Sale,
  Snapshot,
} from "./types";

const env = (import.meta as unknown as { env: Record<string, string> }).env;
const configuredBase = env.VITE_API_BASE_URL || "";
const base = (configuredBase || "/api").replace(/\/$/, "");

export type StorageMode = "api" | "local";

let storageMode: StorageMode =
  env.VITE_STORAGE_MODE === "local" ? "local" : "api";
let extrasSupported = false;

class ApiHttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (storageMode === "local") {
    const clean = path.split("?")[0];
    const [resource, id] = clean.split("/");
    if (method === "DELETE" && id) {
      return localStore.remove(resource, id) as T;
    }
    if (method === "POST" || method === "PUT") {
      return localStore.save(
        resource,
        (body ?? {}) as Record<string, unknown>,
        id,
      ) as T;
    }
  }

  const abort = new AbortController();
  const timeout = window.setTimeout(() => abort.abort(), 15000);
  try {
    const response = await fetch(`${base}/${path}`, {
      method,
      signal: abort.signal,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok)
      throw new ApiHttpError(
        data?.error ||
          `Não foi possível concluir a operação (${response.status}).`,
        response.status,
      );
    if (data === null)
      throw new Error(
        "Resposta inválida da API. Confira a configuração do servidor.",
      );
    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw new Error(
        "O servidor demorou a responder. Confira a conexão e tente novamente.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "Não foi possível conectar ao servidor. Confira a conexão e tente novamente.",
      );
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export const api = {
  getMode(): StorageMode {
    return storageMode;
  },
  async load(period: Period): Promise<Snapshot> {
    if (storageMode === "local") {
      return localStore.load(period);
    }
    const query = `?${new URLSearchParams({ from: period.from, to: period.to })}`;
    const prev = previousPeriod(period);
    const prevQuery = `?${new URLSearchParams({ from: prev.from, to: prev.to })}`;
    try {
      const [summary, ingredients, products, sales, expenses, previousSummary] =
        await Promise.all([
          request<DashboardSummary>("dashboard" + query),
          request<Ingredient[]>("ingredients"),
          request<Product[]>("products"),
          request<Sale[]>("sales" + query),
          request<Expense[]>("expenses" + query),
          prev.from !== period.from || prev.to !== period.to
            ? request<DashboardSummary>("dashboard" + prevQuery).catch(
                () => undefined,
              )
            : Promise.resolve(undefined),
        ]);
      return {
        summary,
        previousSummary,
        ingredients,
        products,
        sales,
        expenses,
      };
    } catch (error) {
      if (
        !configuredBase &&
        error instanceof ApiHttpError &&
        error.status === 404
      ) {
        storageMode = "local";
        return localStore.load(period);
      }
      throw error;
    }
  },
  save(path: string, body: unknown, id?: string) {
    return request(`${path}${id ? "/" + id : ""}`, id ? "PUT" : "POST", body);
  },
  remove(path: string, id: string) {
    return request(`${path}/${id}`, "DELETE");
  },
  exportLocalBackup(): string {
    return localStore.exportBackup();
  },
  importLocalBackup(raw: string): void {
    localStore.importBackup(raw);
  },
  hasLocalData(): boolean {
    return localStore.hasLocalData();
  },
  async loadExtrasFromServer(): Promise<{
    stock: Record<string, { currentStock: number; minStock: number }>;
    goals: { revenueGoal: number; unitsGoal: number };
    recurringExpenses: {
      id: string;
      description: string;
      category: string;
      amount: number;
      isFixed: boolean;
    }[];
  } | null> {
    if (storageMode !== "api") return null;
    try {
      const res = await fetch(`${base}/extras`);
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        typeof data.stock !== "object"
      ) {
        return null;
      }
      extrasSupported = true;
      return {
        stock: data.stock && !Array.isArray(data.stock) ? data.stock : {},
        goals: {
          revenueGoal: Number(data.goals?.revenueGoal) || 0,
          unitsGoal: Number(data.goals?.unitsGoal) || 0,
        },
        recurringExpenses: Array.isArray(data.recurringExpenses)
          ? data.recurringExpenses
          : [],
      };
    } catch {
      return null;
    }
  },
  async saveExtrasToServer(payload: unknown): Promise<void> {
    if (storageMode !== "api" || !extrasSupported) return;
    try {
      await fetch(`${base}/extras`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Non-blocking sync when running against local .NET API without /extras.
    }
  },
  async syncLocalToCloud(): Promise<void> {
    const raw = JSON.parse(localStore.exportBackup());
    await request("sync-local", "POST", raw);
    localStore.clearLocalData();
  },
};
