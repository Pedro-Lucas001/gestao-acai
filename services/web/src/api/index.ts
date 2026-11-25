import { localStore } from "./localStore";
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
    try {
      const [summary, ingredients, products, sales, expenses] =
        await Promise.all([
          request<DashboardSummary>("dashboard" + query),
          request<Ingredient[]>("ingredients"),
          request<Product[]>("products"),
          request<Sale[]>("sales" + query),
          request<Expense[]>("expenses" + query),
        ]);
      return { summary, ingredients, products, sales, expenses };
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
};
