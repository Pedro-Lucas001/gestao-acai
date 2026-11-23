import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Plus, Trash2, X, LoaderCircle } from "lucide-react";
import { api, request } from "./api";
import type { Ingredient, Product, Section, Snapshot } from "./api/types";
import { brl, today } from "./format";
export type Editor = {
  section: Section;
  item?: Ingredient | Product;
  fixed?: boolean;
};

export function EditorModal({
  editor,
  data,
  onClose,
  onSaved,
}: {
  editor: Editor;
  data: Snapshot;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { section, item, fixed } = editor;
  const product = item as Product | undefined;
  const [recipe, setRecipe] = useState(
    product?.recipe ?? [{ ingredientId: "", quantity: 1 }],
  );
  const [saleProduct, setSaleProduct] = useState(data.products[0]?.id ?? "");
  const selected = data.products.find((x) => x.id === saleProduct);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLElement>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;
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
    : `${item ? "Editar" : "Adicionar"} ${section === "Insumos" ? "insumo" : section === "Produtos" ? "produto" : section === "Vendas" ? "venda" : "despesa"}`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const value = (name: string) => Number(form.get(name));
    setBusy(true);
    setError("");
    try {
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
            recipe,
          },
          item?.id,
        );
      else if (section === "Vendas")
        await api.save("sales", {
          date: text("date"),
          productId: saleProduct,
          quantity: value("quantity"),
          price: value("price"),
          channel: text("channel"),
          paymentMethod: text("paymentMethod"),
          feePercent: value("feePercent"),
          feePerUnit: value("feePerUnit"),
        });
      else
        await api.save("expenses", {
          description: text("description"),
          category: text("category"),
          date: text("date"),
          amount: value("amount"),
          isFixed: text("type") === "fixed",
        });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
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
          {fixed ? (
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
                value={(item as Ingredient)?.name}
                type="text"
                maxLength={120}
              />
              <div className="form-grid">
                <label>
                  Unidade base
                  <select
                    name="unit"
                    defaultValue={(item as Ingredient)?.unit ?? "g"}
                  >
                    <option value="g">Gramas (g)</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="un">Unidades (un)</option>
                  </select>
                </label>
                <Field
                  label="Quantidade comprada"
                  name="purchaseQuantity"
                  value={(item as Ingredient)?.purchaseQuantity}
                  positive
                />
              </div>
              <Field
                label="Valor total da compra (R$)"
                name="purchasePrice"
                value={(item as Ingredient)?.purchasePrice}
              />
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
                  value={product?.name}
                  type="text"
                  maxLength={120}
                />
                <Field
                  label="Tamanho"
                  name="size"
                  value={product?.size}
                  type="text"
                  placeholder="300 ml"
                  maxLength={40}
                />
              </div>
              <Field
                label="Preço de venda (R$)"
                name="price"
                value={product?.price}
                positive
              />
              <div className="form-grid">
                <Field
                  label="Taxa padrão (%)"
                  name="feePercent"
                  value={product?.feePercent ?? 0}
                  max={100}
                />
                <Field
                  label="Taxa por garrafa (R$)"
                  name="feePerUnit"
                  value={product?.feePerUnit ?? 0}
                />
              </div>
              <div className="recipe-heading">
                <h3>Ficha técnica por garrafa</h3>
                <button
                  type="button"
                  className="text-button"
                  disabled={recipe.length >= data.ingredients.length}
                  onClick={() =>
                    setRecipe([...recipe, { ingredientId: "", quantity: 1 }])
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
                <div className="recipe-row" key={index}>
                  <label>
                    Insumo
                    <select
                      required
                      value={row.ingredientId}
                      onChange={(e) =>
                        setRecipe(
                          recipe.map((r, i) =>
                            i === index
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
                            (r, i) => i !== index && r.ingredientId === x.id,
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
                      step="0.000001"
                      value={row.quantity}
                      onChange={(e) =>
                        setRecipe(
                          recipe.map((r, i) =>
                            i === index
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
                      setRecipe(recipe.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
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
                />
              </div>
              <div key={saleProduct}>
                <Field
                  label="Preço por garrafa (R$)"
                  name="price"
                  value={selected?.price}
                  positive
                />
                <div className="form-grid">
                  <Field
                    label="Taxa desta venda (%)"
                    name="feePercent"
                    value={selected?.feePercent ?? 0}
                    max={100}
                  />
                  <Field
                    label="Taxa por garrafa (R$)"
                    name="feePerUnit"
                    value={selected?.feePerUnit ?? 0}
                  />
                </div>
              </div>
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
                type="text"
                maxLength={180}
              />
              <div className="form-grid">
                <Field
                  label="Categoria"
                  name="category"
                  type="text"
                  maxLength={80}
                  placeholder="Ex.: Energia"
                />
                <label>
                  Tipo
                  <select name="type">
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
                  value={today()}
                />
                <Field label="Valor (R$)" name="amount" positive />
              </div>
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
                  section === "Produtos" &&
                  !data.ingredients.length) ||
                (section === "Vendas" && !data.products.length)
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
        {...(type === "number"
          ? { min: positive ? 0.000001 : 0, max, step: "0.000001" }
          : type === "date"
            ? { min: "2000-01-01", max: "2100-12-31" }
            : {})}
      />
    </label>
  );
}
