import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Plus, Trash2, X, LoaderCircle } from "lucide-react";
import { api, request } from "./api";
import type {
  Expense,
  Ingredient,
  Product,
  Section,
  Snapshot,
} from "./api/types";
import {
  addRecurringExpense,
  deductStockForSaleItems,
  saveMonthlyGoals,
  updateIngredientStock,
} from "./extras";
import type { WorkspaceExtras } from "./extras";
import { brl, brlUnit, pct, today } from "./format";

export type Editor = {
  section: Section;
  item?: Ingredient | Product | Expense;
  fixed?: boolean;
  goals?: boolean;
  stockItem?: Ingredient;
  duplicate?: Product;
  presetProductId?: string;
  suggestedPrice?: number;
};

type RecipeRow = { key: number; ingredientId: string; quantity: number };
type ExtraSaleItem = {
  key: number;
  productId: string;
  quantity: number;
  price: number;
  feePercent: number;
  feePerUnit: number;
};

export function EditorModal({
  editor,
  data,
  extras,
  onExtrasChanged,
  onClose,
  onSaved,
}: {
  editor: Editor;
  data: Snapshot;
  extras: WorkspaceExtras;
  onExtrasChanged: (next: WorkspaceExtras) => void;
  onClose: () => void;
  onSaved: (message?: string) => void;
}) {
  const {
    section,
    item,
    fixed,
    goals,
    stockItem,
    duplicate,
    presetProductId,
    suggestedPrice,
  } = editor;
  const ingredient =
    section === "Insumos" ? (item as Ingredient | undefined) : undefined;
  const product =
    section === "Produtos" ? (item as Product | undefined) : undefined;
  const productSeed = duplicate ?? product;
  const expense =
    section === "Despesas" ? (item as Expense | undefined) : undefined;

  const nextRowKey = useRef(1);
  const [recipe, setRecipe] = useState<RecipeRow[]>(() =>
    (productSeed?.recipe ?? [{ ingredientId: "", quantity: 1 }]).map((row) => ({
      key: nextRowKey.current++,
      ingredientId: row.ingredientId,
      quantity: row.quantity,
    })),
  );

  // Live preview states for Insumos
  const [ingUnit, setIngUnit] = useState(ingredient?.unit ?? "g");
  const [ingQty, setIngQty] = useState<number>(
    ingredient?.purchaseQuantity ?? 0,
  );
  const [ingPrice, setIngPrice] = useState<number>(
    ingredient?.purchasePrice ?? 0,
  );

  // Live preview states for Produtos
  const [prodPrice, setProdPrice] = useState<number>(
    suggestedPrice ?? productSeed?.price ?? 0,
  );
  const [prodFeePercent, setProdFeePercent] = useState<number>(
    productSeed?.feePercent ?? 0,
  );
  const [prodFeePerUnit, setProdFeePerUnit] = useState<number>(
    productSeed?.feePerUnit ?? 0,
  );

  // Live preview states for Vendas (primary item + optional multi-item cart)
  const [saleProduct, setSaleProduct] = useState(
    presetProductId ?? data.products[0]?.id ?? "",
  );
  const selected = data.products.find((x) => x.id === saleProduct);
  const [saleQty, setSaleQty] = useState<number>(1);
  const [salePrice, setSalePrice] = useState<number>(selected?.price ?? 0);
  const [saleFeePercent, setSaleFeePercent] = useState<number>(
    selected?.feePercent ?? 0,
  );
  const [saleFeePerUnit, setSaleFeePerUnit] = useState<number>(
    selected?.feePerUnit ?? 0,
  );
  const [extraItems, setExtraItems] = useState<ExtraSaleItem[]>([]);
  const [saveAsRecurring, setSaveAsRecurring] = useState(false);

  useEffect(() => {
    if (selected) {
      setSalePrice(selected.price);
      setSaleFeePercent(selected.feePercent);
      setSaleFeePerUnit(selected.feePerUnit);
    }
  }, [selected?.id]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLElement>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  const ingredientsById = useMemo(
    () => new Map(data.ingredients.map((x) => [x.id, x])),
    [data.ingredients],
  );
  const productsById = useMemo(
    () => new Map(data.products.map((x) => [x.id, x])),
    [data.products],
  );

  const productPreview = useMemo(() => {
    const unitCost = recipe.reduce((sum, row) => {
      const ing = ingredientsById.get(row.ingredientId);
      if (!ing || ing.purchaseQuantity <= 0 || !Number.isFinite(row.quantity)) {
        return sum;
      }
      return sum + (row.quantity * ing.purchasePrice) / ing.purchaseQuantity;
    }, 0);
    const price = Number.isFinite(prodPrice) ? prodPrice : 0;
    const fee =
      (price * (Number.isFinite(prodFeePercent) ? prodFeePercent : 0)) / 100 +
      (Number.isFinite(prodFeePerUnit) ? prodFeePerUnit : 0);
    const contribution = price - unitCost - fee;
    const margin = price > 0 ? (contribution / price) * 100 : 0;
    return { unitCost, fee, contribution, margin };
  }, [recipe, ingredientsById, prodPrice, prodFeePercent, prodFeePerUnit]);

  const salePreview = useMemo(() => {
    const lines = [
      {
        product: selected,
        qty: Number.isFinite(saleQty) && saleQty > 0 ? saleQty : 0,
        price: Number.isFinite(salePrice) && salePrice > 0 ? salePrice : 0,
        feePercent: Number.isFinite(saleFeePercent) ? saleFeePercent : 0,
        feePerUnit: Number.isFinite(saleFeePerUnit) ? saleFeePerUnit : 0,
      },
      ...extraItems.map((extra) => ({
        product: productsById.get(extra.productId),
        qty: Number.isFinite(extra.quantity) && extra.quantity > 0 ? extra.quantity : 0,
        price: Number.isFinite(extra.price) && extra.price > 0 ? extra.price : 0,
        feePercent: Number.isFinite(extra.feePercent) ? extra.feePercent : 0,
        feePerUnit: Number.isFinite(extra.feePerUnit) ? extra.feePerUnit : 0,
      })),
    ];
    let total = 0;
    let totalCost = 0;
    let totalFees = 0;
    for (const line of lines) {
      const unitCost = line.product?.unitCost ?? 0;
      const unitFee = (line.price * line.feePercent) / 100 + line.feePerUnit;
      total += line.qty * line.price;
      totalCost += line.qty * unitCost;
      totalFees += line.qty * unitFee;
    }
    return {
      total,
      totalCost,
      totalFees,
      contribution: total - totalCost - totalFees,
    };
  }, [
    saleQty,
    salePrice,
    saleFeePercent,
    saleFeePerUnit,
    selected,
    extraItems,
    productsById,
  ]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.querySelector<HTMLElement>("input,select,button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) onClose();
      if (e.key === "Tab" && dialog) {
        const elements = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input,select",
          ),
        );
        const first = elements[0],
          last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);

  const title = fixed
    ? "Custos fixos mensais"
    : goals
      ? "Metas do mês"
      : stockItem
        ? `Estoque · ${stockItem.name}`
        : duplicate
          ? "Duplicar produto"
          : `${item ? "Editar" : "Adicionar"} ${section === "Insumos" ? "insumo" : section === "Produtos" ? "produto" : section === "Vendas" ? "venda" : "despesa"}`;

  function addExtraSaleItem() {
    const fallback =
      data.products.find(
        (p) =>
          p.id !== saleProduct && !extraItems.some((e) => e.productId === p.id),
      ) ?? data.products[0];
    if (!fallback) return;
    setExtraItems([
      ...extraItems,
      {
        key: nextRowKey.current++,
        productId: fallback.id,
        quantity: 1,
        price: fallback.price,
        feePercent: fallback.feePercent,
        feePerUnit: fallback.feePerUnit,
      },
    ]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const value = (name: string) => Number(form.get(name));
    setBusy(true);
    setError("");
    try {
      if (goals) {
        const next = saveMonthlyGoals({
          revenueGoal: value("revenueGoal"),
          unitsGoal: value("unitsGoal"),
        });
        onExtrasChanged(next);
        onSaved("Metas atualizadas com sucesso.");
        return;
      }
      if (stockItem) {
        const next = updateIngredientStock(stockItem.id, {
          currentStock: value("currentStock"),
          minStock: value("minStock"),
        });
        onExtrasChanged(next);
        onSaved("Estoque atualizado com sucesso.");
        return;
      }
      if (fixed)
        await request("fixed-costs", "PUT", {
          monthlyAmount: value("monthlyAmount"),
        });
      else if (section === "Insumos")
        await api.save(
          "ingredients",
          {
            name: text("name"),
            unit: text("unit"),
            purchaseQuantity: value("purchaseQuantity"),
            purchasePrice: value("purchasePrice"),
          },
          item?.id,
        );
      else if (section === "Produtos")
        await api.save(
          "products",
          {
            name: text("name"),
            size: text("size"),
            price: value("price"),
            feePercent: value("feePercent"),
            feePerUnit: value("feePerUnit"),
            recipe: recipe.map(({ ingredientId, quantity }) => ({
              ingredientId,
              quantity,
            })),
          },
          duplicate ? undefined : item?.id,
        );
      else if (section === "Vendas") {
        const primary = {
          productId: saleProduct,
          quantity: value("quantity"),
          price: value("price"),
          feePercent: value("feePercent"),
          feePerUnit: value("feePerUnit"),
        };
        if (extraItems.length > 0) {
          const allItems = [
            primary,
            ...extraItems.map((x) => ({
              productId: x.productId,
              quantity: x.quantity,
              price: x.price,
              feePercent: x.feePercent,
              feePerUnit: x.feePerUnit,
            })),
          ];
          await api.save("sales", {
            date: text("date"),
            ...primary,
            channel: text("channel"),
            paymentMethod: text("paymentMethod"),
            items: allItems,
          });
          onExtrasChanged(deductStockForSaleItems(data.products, allItems));
        } else {
          await api.save("sales", {
            date: text("date"),
            ...primary,
            channel: text("channel"),
            paymentMethod: text("paymentMethod"),
          });
          onExtrasChanged(deductStockForSaleItems(data.products, [primary]));
        }
      } else {
        const payload = {
          description: text("description"),
          category: text("category"),
          date: text("date"),
          amount: value("amount"),
          isFixed: text("type") === "fixed",
        };
        await api.save("expenses", payload, item?.id);
        if (!item && saveAsRecurring) {
          onExtrasChanged(
            addRecurringExpense({
              description: payload.description,
              category: payload.category,
              amount: payload.amount,
              isFixed: payload.isFixed,
            }),
          );
        }
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const currentStock = stockItem ? extras.stock[stockItem.id] : undefined;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">SEU NEGÓCIO EM DIA</span>
            <h2 id="editor-title">{title}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar formulário"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit}>
          {goals ? (
            <>
              <p className="muted">
                Defina suas metas mensais para acompanhar o progresso direto na
                Visão geral. Deixe 0 para desativar uma meta.
              </p>
              <div className="form-grid">
                <Field
                  label="Meta de faturamento (R$)"
                  name="revenueGoal"
                  value={extras.goals.revenueGoal}
                />
                <Field
                  label="Meta de garrafas"
                  name="unitsGoal"
                  value={extras.goals.unitsGoal}
                />
              </div>
            </>
          ) : stockItem ? (
            <>
              <p className="muted">
                Informe a quantidade disponível em{" "}
                <strong>{stockItem.unit}</strong>. Cada venda registrada abate
                automaticamente este estoque pela ficha técnica.
              </p>
              <div className="form-grid">
                <Field
                  label={`Estoque atual (${stockItem.unit})`}
                  name="currentStock"
                  value={currentStock?.currentStock ?? 0}
                />
                <Field
                  label={`Alerta mínimo (${stockItem.unit})`}
                  name="minStock"
                  value={currentStock?.minStock ?? 0}
                />
              </div>
              {currentStock && (
                <div className="stock-clear-row">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      onExtrasChanged(
                        updateIngredientStock(stockItem.id, null),
                      );
                      onSaved("Controle de estoque removido para este insumo.");
                    }}
                  >
                    Desativar controle de estoque deste insumo
                  </button>
                </div>
              )}
            </>
          ) : fixed ? (
            <>
              <p className="muted">
                Esta previsão alimenta o ponto de equilíbrio mensal. Para compor
                o resultado do período, registre as despesas efetivamente
                ocorridas na aba Despesas.
              </p>
              <Field
                label="Previsão mensal (R$)"
                name="monthlyAmount"
                value={data.summary.monthlyFixedCosts}
              />
            </>
          ) : section === "Insumos" ? (
            <>
              <Field
                label="Nome do insumo"
                name="name"
                value={ingredient?.name}
                type="text"
                maxLength={120}
              />
              <div className="form-grid">
                <label>
                  Unidade base
                  <select
                    name="unit"
                    defaultValue={ingredient?.unit ?? "g"}
                    onChange={(e) => setIngUnit(e.target.value)}
                  >
                    <option value="g">Gramas (g)</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="un">Unidades (un)</option>
                  </select>
                </label>
                <Field
                  label="Quantidade comprada"
                  name="purchaseQuantity"
                  value={ingredient?.purchaseQuantity}
                  positive
                  onChange={(v) => setIngQty(Number(v))}
                />
              </div>
              <Field
                label="Valor total da compra (R$)"
                name="purchasePrice"
                value={ingredient?.purchasePrice}
                onChange={(v) => setIngPrice(Number(v))}
              />
              {ingQty > 0 && ingPrice >= 0 && (
                <div className="live-preview">
                  <span>Custo unitário calculado</span>
                  <strong>
                    {brlUnit(ingPrice / ingQty)} / {ingUnit}
                  </strong>
                </div>
              )}
              <p className="form-hint">
                Converta kg para g e litros para ml. Ex.: 1 kg = 1.000 g. Use a
                mesma unidade na ficha técnica.
              </p>
            </>
          ) : section === "Produtos" ? (
            <>
              <div className="form-grid">
                <Field
                  label="Nome / sabor"
                  name="name"
                  value={
                    duplicate ? `${duplicate.name} (cópia)` : product?.name
                  }
                  type="text"
                  maxLength={120}
                />
                <Field
                  label="Tamanho"
                  name="size"
                  value={productSeed?.size}
                  type="text"
                  placeholder="300 ml"
                  maxLength={40}
                />
              </div>
              <Field
                label="Preço de venda (R$)"
                name="price"
                value={suggestedPrice ?? productSeed?.price}
                positive
                onChange={(v) => setProdPrice(Number(v))}
              />
              <div className="form-grid">
                <Field
                  label="Taxa padrão (%)"
                  name="feePercent"
                  value={productSeed?.feePercent ?? 0}
                  max={100}
                  onChange={(v) => setProdFeePercent(Number(v))}
                />
                <Field
                  label="Taxa por garrafa (R$)"
                  name="feePerUnit"
                  value={productSeed?.feePerUnit ?? 0}
                  onChange={(v) => setProdFeePerUnit(Number(v))}
                />
              </div>
              <div className="recipe-heading">
                <h3>Ficha técnica por garrafa</h3>
                <button
                  type="button"
                  className="text-button"
                  disabled={recipe.length >= data.ingredients.length}
                  onClick={() =>
                    setRecipe([
                      ...recipe,
                      {
                        key: nextRowKey.current++,
                        ingredientId: "",
                        quantity: 1,
                      },
                    ])
                  }
                >
                  <Plus size={16} /> Insumo
                </button>
              </div>
              {!data.ingredients.length && (
                <p className="notice">
                  Cadastre os insumos antes de criar um produto.
                </p>
              )}
              {recipe.map((row, index) => (
                <div className="recipe-row" key={row.key}>
                  <label>
                    Insumo
                    <select
                      required
                      value={row.ingredientId}
                      onChange={(e) =>
                        setRecipe(
                          recipe.map((r) =>
                            r.key === row.key
                              ? { ...r, ingredientId: e.target.value }
                              : r,
                          ),
                        )
                      }
                    >
                      <option value="">Selecione</option>
                      {data.ingredients.map((x) => (
                        <option
                          key={x.id}
                          value={x.id}
                          disabled={recipe.some(
                            (r) =>
                              r.key !== row.key && r.ingredientId === x.id,
                          )}
                        >
                          {x.name} ({x.unit})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Quantidade
                    <input
                      aria-label={`Quantidade do insumo ${index + 1}`}
                      type="number"
                      required
                      min="0.000001"
                      max="1000000"
                      step="any"
                      value={row.quantity}
                      onChange={(e) =>
                        setRecipe(
                          recipe.map((r) =>
                            r.key === row.key
                              ? { ...r, quantity: Number(e.target.value) }
                              : r,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-button"
                    disabled={recipe.length === 1}
                    aria-label={`Remover insumo ${index + 1}`}
                    onClick={() =>
                      setRecipe(recipe.filter((r) => r.key !== row.key))
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
              {prodPrice > 0 && (
                <div className="live-preview-grid">
                  <div>
                    <small>CMV / garrafa</small>
                    <strong>{brl(productPreview.unitCost)}</strong>
                  </div>
                  <div>
                    <small>Taxas</small>
                    <strong>{brl(productPreview.fee)}</strong>
                  </div>
                  <div>
                    <small>Contribuição</small>
                    <strong
                      className={
                        productPreview.contribution <= 0 ? "text-bad" : ""
                      }
                    >
                      {brl(productPreview.contribution)}
                    </strong>
                  </div>
                  <div>
                    <small>Margem</small>
                    <strong
                      className={
                        productPreview.contribution <= 0 ? "text-bad" : ""
                      }
                    >
                      {pct(productPreview.margin)}
                    </strong>
                  </div>
                </div>
              )}
              <p className="form-hint">
                Inclua a polpa, complementos, garrafa e tampa. Os custos
                acompanham os preços atuais dos insumos.
              </p>
            </>
          ) : section === "Vendas" ? (
            <>
              <label>
                Produto
                <select
                  required
                  value={saleProduct}
                  onChange={(e) => setSaleProduct(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {data.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.size}
                    </option>
                  ))}
                </select>
              </label>
              {!data.products.length && (
                <p className="notice">
                  Cadastre um produto com ficha técnica antes de vender.
                </p>
              )}
              <div className="form-grid">
                <Field
                  label="Data da venda"
                  name="date"
                  type="date"
                  value={today()}
                />
                <Field
                  label="Quantidade de garrafas"
                  name="quantity"
                  value={1}
                  positive
                  onChange={(v) => setSaleQty(Number(v))}
                />
              </div>
              <div key={saleProduct}>
                <Field
                  label="Preço por garrafa (R$)"
                  name="price"
                  value={selected?.price}
                  positive
                  onChange={(v) => setSalePrice(Number(v))}
                />
                <div className="form-grid">
                  <Field
                    label="Taxa desta venda (%)"
                    name="feePercent"
                    value={selected?.feePercent ?? 0}
                    max={100}
                    onChange={(v) => setSaleFeePercent(Number(v))}
                  />
                  <Field
                    label="Taxa por garrafa (R$)"
                    name="feePerUnit"
                    value={selected?.feePerUnit ?? 0}
                    onChange={(v) => setSaleFeePerUnit(Number(v))}
                  />
                </div>
              </div>
              {data.products.length > 0 && (
                <div className="recipe-heading">
                  <h3>Mais sabores neste pedido</h3>
                  <button
                    type="button"
                    className="text-button"
                    onClick={addExtraSaleItem}
                  >
                    <Plus size={16} /> Adicionar sabor
                  </button>
                </div>
              )}
              {extraItems.map((extra, idx) => (
                <div className="extra-sale-row" key={extra.key}>
                  <label>
                    Sabor {idx + 2}
                    <select
                      required
                      value={extra.productId}
                      onChange={(e) => {
                        const prod = productsById.get(e.target.value);
                        setExtraItems(
                          extraItems.map((row) =>
                            row.key === extra.key
                              ? {
                                  ...row,
                                  productId: e.target.value,
                                  price: prod?.price ?? row.price,
                                  feePercent:
                                    prod?.feePercent ?? row.feePercent,
                                  feePerUnit:
                                    prod?.feePerUnit ?? row.feePerUnit,
                                }
                              : row,
                          ),
                        );
                      }}
                    >
                      {data.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.size}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Qtd.
                    <input
                      type="number"
                      required
                      min="0.000001"
                      max="1000000"
                      step="any"
                      value={extra.quantity}
                      onChange={(e) =>
                        setExtraItems(
                          extraItems.map((row) =>
                            row.key === extra.key
                              ? { ...row, quantity: Number(e.target.value) }
                              : row,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Preço (R$)
                    <input
                      type="number"
                      required
                      min="0.000001"
                      max="1000000"
                      step="any"
                      value={extra.price}
                      onChange={(e) =>
                        setExtraItems(
                          extraItems.map((row) =>
                            row.key === extra.key
                              ? { ...row, price: Number(e.target.value) }
                              : row,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remover sabor ${idx + 2}`}
                    onClick={() =>
                      setExtraItems(
                        extraItems.filter((row) => row.key !== extra.key),
                      )
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
              <div className="form-grid">
                <label>
                  Canal
                  <select name="channel">
                    <option>Venda direta</option>
                    <option>WhatsApp</option>
                    <option>Delivery</option>
                    <option>Atacado</option>
                  </select>
                </label>
                <label>
                  Pagamento
                  <select name="paymentMethod">
                    <option>PIX</option>
                    <option>Dinheiro</option>
                    <option>Débito</option>
                    <option>Crédito</option>
                  </select>
                </label>
              </div>
              {selected && salePreview.total > 0 && (
                <div className="live-preview-grid">
                  <div>
                    <small>Total da venda</small>
                    <strong>{brl(salePreview.total)}</strong>
                  </div>
                  <div>
                    <small>CMV total</small>
                    <strong>{brl(salePreview.totalCost)}</strong>
                  </div>
                  <div>
                    <small>Taxas</small>
                    <strong>{brl(salePreview.totalFees)}</strong>
                  </div>
                  <div>
                    <small>Contribuição</small>
                    <strong
                      className={salePreview.contribution <= 0 ? "text-bad" : ""}
                    >
                      {brl(salePreview.contribution)}
                    </strong>
                  </div>
                </div>
              )}
              <p className="form-hint">
                CMV atual: {brl(selected?.unitCost ?? 0)} / garrafa. Preço,
                custo e taxas serão preservados no histórico.
              </p>
            </>
          ) : (
            <>
              <Field
                label="Descrição"
                name="description"
                value={expense?.description}
                type="text"
                maxLength={180}
              />
              <div className="form-grid">
                <Field
                  label="Categoria"
                  name="category"
                  value={expense?.category}
                  type="text"
                  maxLength={80}
                  placeholder="Ex.: Energia"
                />
                <label>
                  Tipo
                  <select
                    name="type"
                    defaultValue={expense?.isFixed ? "fixed" : "variable"}
                  >
                    <option value="variable">Variável</option>
                    <option value="fixed">Fixa</option>
                  </select>
                </label>
              </div>
              <div className="form-grid">
                <Field
                  label="Data da despesa"
                  name="date"
                  type="date"
                  value={expense?.date ?? today()}
                />
                <Field
                  label="Valor (R$)"
                  name="amount"
                  value={expense?.amount}
                  positive
                />
              </div>
              {!expense && (
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={saveAsRecurring}
                    onChange={(e) => setSaveAsRecurring(e.target.checked)}
                  />
                  <span>
                    Salvar como modelo recorrente (para lançar em 1 clique nos
                    próximos meses)
                  </span>
                </label>
              )}
              <p className="form-hint">
                Evite registrar novamente o CMV e as taxas já incluídas nas
                vendas.
              </p>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              className="primary-button"
              disabled={
                busy ||
                (!fixed &&
                  !goals &&
                  !stockItem &&
                  section === "Produtos" &&
                  !data.ingredients.length) ||
                (!fixed &&
                  !goals &&
                  !stockItem &&
                  section === "Vendas" &&
                  !data.products.length)
              }
            >
              {busy && <LoaderCircle className="spin" size={17} />}
              {busy ? "Salvando…" : "Salvar registro"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  type = "number",
  positive,
  max = 1000000,
  onChange,
  ...props
}: {
  label: string;
  name: string;
  value?: string | number;
  type?: string;
  positive?: boolean;
  max?: number;
  maxLength?: number;
  placeholder?: string;
  onChange?: (val: string) => void;
}) {
  return (
    <label>
      {label}
      <input
        {...props}
        name={name}
        type={type}
        defaultValue={value}
        required
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        {...(type === "number"
          ? { min: positive ? 0.000001 : 0, max, step: "any" }
          : type === "date"
            ? { min: "2000-01-01", max: "2100-12-31" }
            : {})}
      />
    </label>
  );
}
