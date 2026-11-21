export type Section = 'Visão geral' | 'Insumos' | 'Produtos' | 'Vendas' | 'Despesas' | 'Precificação';

export interface DashboardSummary {
  revenue: number;
  contribution: number;
  salesCount: number;
  averageMargin: number;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  purchaseQuantity: number;
  purchasePrice: number;
}

export interface Product {
  id: string;
  name: string;
  size: string;
  price: number;
}

export interface Sale {
  id: string;
  date: string;
  productName: string;
  channel: string;
  quantity: number;
  total: number;
}

export interface Expense {
  id: string;
  description: string;
  category: string;
  date: string;
  amount: number;
}
