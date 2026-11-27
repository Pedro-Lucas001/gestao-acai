export type Section =
  | "Visão geral"
  | "Insumos"
  | "Produtos"
  | "Vendas"
  | "Despesas"
  | "Precificação";
export interface Period {
  from: string;
  to: string;
}
export interface DashboardSummary {
  revenue: number;
  contribution: number;
  salesCount: number;
  averageMargin: number;
  cost: number;
  fees: number;
  expenses: number;
  netResult: number;
  quantity: number;
  monthlyFixedCosts: number;
  breakEvenUnits: number | null;
  daily: { date: string; revenue: number }[];
}
export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  purchaseQuantity: number;
  purchasePrice: number;
}
export interface RecipeItem {
  ingredientId: string;
  quantity: number;
}
export interface Product {
  id: string;
  name: string;
  size: string;
  price: number;
  feePercent: number;
  feePerUnit: number;
  recipe: RecipeItem[];
  unitCost: number;
  variableFee: number;
  contribution: number;
}
export interface Sale {
  id: string;
  date: string;
  productName: string;
  channel: string;
  paymentMethod: string;
  quantity: number;
  total: number;
  contribution: number;
}
export interface Expense {
  id: string;
  description: string;
  category: string;
  date: string;
  amount: number;
  isFixed: boolean;
}
export interface Snapshot {
  summary: DashboardSummary;
  previousSummary?: DashboardSummary;
  ingredients: Ingredient[];
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
}
