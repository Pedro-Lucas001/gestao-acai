import type { DashboardSummary, Expense, Ingredient, Product, Sale } from './types';

// Dados vazios intencionalmente: não representam resultados reais. O agente de integração
// substituirá esta implementação pelo cliente conectado à API em src/api/index.ts.
export const mockClient = {
  async getDashboard(): Promise<DashboardSummary> {
    return { revenue: 0, contribution: 0, salesCount: 0, averageMargin: 0 };
  },
  async getIngredients(): Promise<Ingredient[]> {
    return [];
  },
  async getProducts(): Promise<Product[]> {
    return [];
  },
  async getSales(): Promise<Sale[]> {
    return [];
  },
  async getExpenses(): Promise<Expense[]> {
    return [];
  },
};
