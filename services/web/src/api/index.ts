import type {
  DashboardSummary,
  Expense,
  Ingredient,
  Period,
  Product,
  Sale,
  Snapshot,
} from "./types";
let token = "";
export const signOut = () => {
  token = "";
  window.dispatchEvent(new Event("acai:logout"));
};
const base = (
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_BASE_URL || "/api"
).replace(/\/$/, "");
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const abort = new AbortController();
  const timeout = window.setTimeout(() => abort.abort(), 15000);
  try {
    const response = await fetch(`${base}/${path}`, {
      method,
      signal: abort.signal,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json().catch(() => null);
    if (response.status === 401 && !path.startsWith("auth/")) signOut();
    if (!response.ok)
      throw new Error(
        data?.error ||
          `Não foi possível concluir a operação (${response.status}).`,
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
  async login(username: string, password: string) {
    const result = await request<{ accessToken: string }>(
      "auth/login",
      "POST",
      { username, password },
    );
    token = result.accessToken;
  },
  async load(period: Period): Promise<Snapshot> {
    const query = `?${new URLSearchParams({ from: period.from, to: period.to })}`;
    const [summary, ingredients, products, sales, expenses] = await Promise.all(
      [
        request<DashboardSummary>("dashboard" + query),
        request<Ingredient[]>("ingredients"),
        request<Product[]>("products"),
        request<Sale[]>("sales" + query),
        request<Expense[]>("expenses" + query),
      ],
    );
    return { summary, ingredients, products, sales, expenses };
  },
  save(path: string, body: unknown, id?: string) {
    return request(`${path}${id ? "/" + id : ""}`, id ? "PUT" : "POST", body);
  },
  remove(path: string, id: string) {
    return request(`${path}/${id}`, "DELETE");
  },
};
