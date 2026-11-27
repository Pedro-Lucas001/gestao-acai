import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  Boxes,
  Calculator,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Copy,
  CreditCard,
  Download,
  FileSpreadsheet,
  FlaskConical,
  HardDrive,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Package,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Repeat,
  Search,
  Settings2,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
  Waves,
  X,
  Zap,
} from "lucide-react";
import { api } from "./api";
import type { StorageMode } from "./api";
import { Brand } from "./components/Brand";
import { Intro } from "./components/Intro";
import type {
  Expense,
  Ingredient,
  Period,
  Product,
  Sale,
  Section,
  Snapshot,
} from "./api/types";
import {
  loadExtras,
  removeRecurringExpense,
} from "./extras";
import type { RecurringExpense, WorkspaceExtras } from "./extras";
import { EditorModal } from "./Forms";
import type { Editor } from "./Forms";
import {
  brl,
  brlUnit,
  datePt,
  monthPeriod,
  num,
  pct,
  rollingPeriod,
  today,
} from "./format";
import { deltaPercent, exportCsv } from "./reports";

const navigation = [
  { label: "Visão geral", icon: LayoutDashboard },
  { label: "Insumos", icon: FlaskConical },
  { label: "Produtos", icon: Boxes },
  { label: "Vendas", icon: CreditCard },
  { label: "Despesas", icon: Wallet },
  { label: "Precificação", icon: CircleDollarSign },
] as const;

export default function App() {
  const [intro, setIntro] = useState(true);
  const finishIntro = useCallback(() => setIntro(false), []);
  const [section, setSection] = useState<Section>("Visão geral");
  const [period, setPeriod] = useState<Period>(monthPeriod);
  const [data, setData] = useState<Snapshot>();
  const [extras, setExtras] = useState<WorkspaceExtras>(loadExtras);
  const [storageMode, setStorageMode] = useState<StorageMode>(api.getMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<Editor>();
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState("");
  const version = useRef(0);
  const importInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const current = ++version.current;
    setLoading(true);
    setError("");
    setData(undefined);
    try {
      const snapshot = await api.load(period);
      if (version.current === current) {
        setData(snapshot);
        setStorageMode(api.getMode());
      }
    } catch (e) {
      if (version.current === current) setError((e as Error).message);
    } finally {
      if (version.current === current) setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
    return () => {
      ++version.current;
    };
  }, [load]);

  useEffect(() => {
    if (!intro) {
      const frame = requestAnimationFrame(() =>
        document.getElementById("page-title")?.focus({ preventScroll: true }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [intro]);

  useEffect(() => {
    if (toast) {
      const timer = window.setTimeout(() => setToast(""), 4500);
      return () => window.clearTimeout(timer);
    }
  }, [toast]);

  const closeEditor = useCallback(() => setEditor(undefined), []);
  const saved = (message?: string) => {
    setEditor(undefined);
    setToast(message ?? "Registro salvo com sucesso.");
    void load();
  };
  const navigate = (next: Section) => {
    setSection(next);
    setMobile(false);
  };

  const handleExportBackup = () => {
    const json = api.exportLocalBackup();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `netuno-acai-backup-${today()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setToast("Backup exportado com sucesso.");
  };

  const handleImportBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      api.importLocalBackup(text);
      setExtras(loadExtras());
      setToast("Backup importado com sucesso.");
      void load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleLaunchRecurring = async (template: RecurringExpense) => {
    try {
      await api.save("expenses", {
        description: template.description,
        category: template.category,
        date: today(),
        amount: template.amount,
        isFixed: template.isFixed,
      });
      setToast(`Despesa "${template.description}" lançada para hoje.`);
      void load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (intro) return <Intro onComplete={finishIntro} />;

  const create = (target: Section = section, presetProductId?: string) =>
    setEditor({
      section:
        target === "Visão geral"
          ? "Vendas"
          : target === "Precificação"
            ? "Produtos"
            : target,
      presetProductId,
    });

  return (
    <div className="app-shell">
      <a href="#page-title" className="skip-link">
        Pular para o conteúdo
      </a>
      <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
        <button
          className="icon-button mobile-close"
          onClick={() => setMobile(false)}
          aria-label="Fechar menu"
        >
          <X size={22} />
        </button>
        <Brand />
        <span className="nav-label">MEU NEGÓCIO</span>
        <nav aria-label="Menu principal">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${section === label ? "active" : ""}`}
              aria-current={section === label ? "page" : undefined}
              onClick={() => navigate(label)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {section === label && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Waves size={22} />
            <strong>De olho na margem.</strong>
            <p>
              Conheça o custo de cada garrafa para precificar com confiança.
            </p>
            <button onClick={() => navigate("Precificação")}>
              Ver precificação <ArrowRight size={15} />
            </button>
          </div>
          <div className="profile">
            <span>N</span>
            <div>
              <strong>Meu espaço</strong>
              <small>
                {storageMode === "local"
                  ? "Salvo neste navegador"
                  : "Organização pessoal"}
              </small>
            </div>
            {storageMode === "local" ? (
              <HardDrive size={17} aria-label="Armazenamento local" />
            ) : (
              <ShieldCheck size={17} />
            )}
          </div>
          {storageMode === "local" && (
            <div className="backup-bar">
              <button
                type="button"
                className="backup-button"
                onClick={handleExportBackup}
              >
                <Download size={13} /> Exportar
              </button>
              <button
                type="button"
                className="backup-button"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload size={13} /> Importar
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                aria-label="Importar backup JSON"
                onChange={(e) => void handleImportBackup(e)}
              />
            </div>
          )}
        </div>
      </aside>
      {mobile && (
        <button
          className="scrim"
          onClick={() => setMobile(false)}
          aria-label="Fechar menu"
        />
      )}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-location">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Abrir menu"
            >
              <Menu size={23} />
            </button>
            <span>
              Netuno Açaí <ChevronRight size={14} />
              <b>{section}</b>
            </span>
          </div>
          <div className="topbar-actions">
            {data && (
              <button
                type="button"
                className="secondary-button refresh print-btn"
                onClick={() => window.print()}
                aria-label="Imprimir relatório"
              >
                <Printer size={15} />
                <span>Relatório</span>
              </button>
            )}
            <button
              className="secondary-button refresh"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Atualizar dados"
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              <span>Atualizar</span>
            </button>
          </div>
        </header>
        <div className="page-wrap">
          <section className="page-heading">
            <div>
              <span className="eyebrow">GESTÃO FINANCEIRA · NETUNO AÇAÍ</span>
              <h1 id="page-title" tabIndex={-1}>
                {section === "Visão geral"
                  ? "Seu negócio, em perspectiva."
                  : section}
              </h1>
              <p>
                {section === "Visão geral"
                  ? "Os números que ajudam a escolher o próximo passo."
                  : section === "Insumos"
                    ? "O custo de uma boa decisão começa nos ingredientes."
                    : section === "Produtos"
                      ? "Cada sabor, tamanho e custo em um só lugar."
                      : section === "Vendas"
                        ? "Registre suas vendas e acompanhe a contribuição."
                        : section === "Despesas"
                          ? "Saiba para onde vai cada real do seu negócio."
                          : "Preço com propósito. Margem com clareza."}
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() => create()}
              disabled={!data || loading}
            >
              <Plus size={18} />
              {section === "Visão geral" || section === "Vendas"
                ? "Registrar venda"
                : section === "Insumos"
                  ? "Novo insumo"
                  : section === "Despesas"
                    ? "Nova despesa"
                    : "Novo produto"}
            </button>
          </section>
          <PeriodPicker period={period} onChange={setPeriod} />
          {toast && (
            <div role="status" className="success">
              <Check size={18} />
              {toast}
            </div>
          )}
          {error && (
            <div className="error load-error" role="alert">
              <strong>Não foi possível carregar os dados.</strong>
              <p>{error}</p>
              <button className="secondary-button" onClick={() => void load()}>
                Tentar novamente
              </button>
            </div>
          )}
          {loading && (
            <div className="loading" role="status">
              <LoaderCircle className="spin" size={24} />
              <span>Carregando os dados do seu negócio…</span>
            </div>
          )}
          {data && !loading && (
            <>
              {section === "Visão geral" ? (
                <Overview
                  data={data}
                  extras={extras}
                  period={period}
                  navigate={navigate}
                  create={create}
                  openGoals={() => setEditor({ section, goals: true })}
                />
              ) : section === "Precificação" ? (
                <Pricing
                  data={data}
                  edit={(p, suggestedPrice) =>
                    setEditor({ section: "Produtos", item: p, suggestedPrice })
                  }
                  fixed={() => setEditor({ section, fixed: true })}
                />
              ) : (
                <Records
                  key={section}
                  data={data}
                  extras={extras}
                  period={period}
                  section={section}
                  create={(presetProductId) =>
                    create(section, presetProductId)
                  }
                  edit={(item) => setEditor({ section, item })}
                  duplicateProduct={(p) =>
                    setEditor({ section: "Produtos", duplicate: p })
                  }
                  openStock={(ing) =>
                    setEditor({ section: "Insumos", stockItem: ing })
                  }
                  launchRecurring={handleLaunchRecurring}
                  removeRecurring={(id) =>
                    setExtras(removeRecurringExpense(id))
                  }
                  reload={() => {
                    setToast("Registro excluído.");
                    void load();
                  }}
                />
              )}
            </>
          )}
        </div>
        <footer className="footer">
          <span>
            NETUNO AÇAÍ <i /> Feito para o seu negócio.
          </span>
          <span>
            {storageMode === "local"
              ? "Modo local (navegador) · Valores em BRL"
              : "Valores em BRL · Horário de Brasília"}
          </span>
        </footer>
      </main>
      {editor && data && (
        <EditorModal
          editor={editor}
          data={data}
          extras={extras}
          onExtrasChanged={setExtras}
          onClose={closeEditor}
          onSaved={saved}
        />
      )}
    </div>
  );
}

function PeriodPicker({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  const [draft, setDraft] = useState(period);
  const [custom, setCustom] = useState(false);

  useEffect(() => {
    setDraft(period);
  }, [period]);

  const month = monthPeriod();
  const last7 = rollingPeriod(7);
  const last30 = rollingPeriod(30);

  const isSame = (a: Period, b: Period) => a.from === b.from && a.to === b.to;
  const activePreset = custom
    ? "custom"
    : isSame(period, month)
      ? "month"
      : isSame(period, last7)
        ? "7d"
        : isSame(period, last30)
          ? "30d"
          : "custom";

  return (
    <div className="period-bar">
      <div className="period-tabs">
        <button
          className={activePreset === "month" ? "selected" : ""}
          onClick={() => {
            onChange(month);
            setCustom(false);
          }}
        >
          Este mês
        </button>
        <button
          className={activePreset === "7d" ? "selected" : ""}
          onClick={() => {
            onChange(last7);
            setCustom(false);
          }}
        >
          7 dias
        </button>
        <button
          className={activePreset === "30d" ? "selected" : ""}
          onClick={() => {
            onChange(last30);
            setCustom(false);
          }}
        >
          30 dias
        </button>
        <button
          className={activePreset === "custom" ? "selected" : ""}
          onClick={() => {
            setDraft(period);
            setCustom(!custom);
          }}
        >
          Personalizar
        </button>
      </div>
      {custom ? (
        <form
          className="date-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.from && draft.to && draft.from <= draft.to) {
              onChange(draft);
              setCustom(false);
            }
          }}
        >
          <label>
            De
            <input
              type="date"
              required
              min="2000-01-01"
              max={draft.to}
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </label>
          <label>
            Até
            <input
              type="date"
              required
              min={draft.from}
              max="2100-12-31"
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </label>
          <button className="secondary-button">Aplicar</button>
        </form>
      ) : (
        <span className="period-caption">
          <CalendarDays size={15} />
          {datePt(period.from)} — {datePt(period.to)}
        </span>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
  tone = "",
  delta = null,
  invertDelta = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: string;
  delta?: number | null;
  invertDelta?: boolean;
}) {
  const showDelta = delta !== null && Math.abs(delta) >= 0.1;
  const good = showDelta ? (invertDelta ? delta < 0 : delta > 0) : false;
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <div className="metric-foot">
        <small>{detail}</small>
        {showDelta && (
          <span
            className={`delta-pill ${good ? "up" : "down"}`}
            title="Comparado ao período anterior"
          >
            {delta > 0 ? "+" : ""}
            {pct(delta)}
          </span>
        )}
      </div>
    </article>
  );
}

function Overview({
  data,
  extras,
  period,
  navigate,
  create,
  openGoals,
}: {
  data: Snapshot;
  extras: WorkspaceExtras;
  period: Period;
  navigate: (s: Section) => void;
  create: (s: Section, presetProductId?: string) => void;
  openGoals: () => void;
}) {
  const s = data.summary;
  const prev = data.previousSummary;
  const averageTicket = s.salesCount > 0 ? s.revenue / s.salesCount : 0;

  const lowStockItems = useMemo(
    () =>
      data.ingredients.filter((ing) => {
        const entry = extras.stock[ing.id];
        return entry && entry.currentStock <= entry.minStock;
      }),
    [data.ingredients, extras.stock],
  );

  const channelStats = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number }>();
    for (const sale of data.sales) {
      const current = map.get(sale.channel) ?? { revenue: 0, count: 0 };
      current.revenue += sale.total;
      current.count += 1;
      map.set(sale.channel, current);
    }
    return Array.from(map.entries())
      .map(([channel, info]) => ({ channel, ...info }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [data.sales]);

  const productRanking = useMemo(() => {
    const map = new Map<
      string,
      { name: string; quantity: number; revenue: number; contribution: number }
    >();
    for (const sale of data.sales) {
      const key = sale.productName;
      const cur = map.get(key) ?? {
        name: key,
        quantity: 0,
        revenue: 0,
        contribution: 0,
      };
      cur.quantity += sale.quantity;
      cur.revenue += sale.total;
      cur.contribution += sale.contribution;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 5);
  }, [data.sales]);

  const revProgress =
    extras.goals.revenueGoal > 0
      ? Math.min(100, (s.revenue / extras.goals.revenueGoal) * 100)
      : null;
  const unitsProgress =
    extras.goals.unitsGoal > 0
      ? Math.min(100, (s.quantity / extras.goals.unitsGoal) * 100)
      : null;
  const breakEvenProgress =
    s.breakEvenUnits !== null && s.breakEvenUnits > 0
      ? Math.min(100, (s.quantity / s.breakEvenUnits) * 100)
      : null;

  return (
    <>
      {lowStockItems.length > 0 && (
        <div className="stock-alert" role="status">
          <AlertTriangle size={18} />
          <div>
            <strong>Alerta de reposição de estoque:</strong>{" "}
            {lowStockItems
              .map((ing) => {
                const st = extras.stock[ing.id];
                return `${ing.name} (${num(st.currentStock)} ${ing.unit})`;
              })
              .join(", ")}
            .
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => navigate("Insumos")}
          >
            Repor <ArrowRight size={14} />
          </button>
        </div>
      )}
      {data.products.length > 0 && (
        <div className="quick-sale-strip">
          <span className="quick-sale-label">
            <Zap size={14} /> Venda rápida
          </span>
          <div className="quick-sale-buttons">
            {data.products.slice(0, 4).map((p) => (
              <button
                type="button"
                key={p.id}
                className="quick-sale-chip"
                onClick={() => create("Vendas", p.id)}
              >
                <Plus size={13} />
                <span>
                  {p.name} · {p.size}
                </span>
                <b>{brl(p.price)}</b>
              </button>
            ))}
          </div>
        </div>
      )}
      <section className="metric-grid">
        <Metric
          label="Faturamento"
          value={brl(s.revenue)}
          detail={
            s.salesCount > 0
              ? `${num(s.quantity)} garrafas · ticket médio ${brl(averageTicket)}`
              : `${num(s.quantity)} garrafas · 0 vendas`
          }
          icon={<CircleDollarSign size={21} />}
          tone="featured"
          delta={prev ? deltaPercent(s.revenue, prev.revenue) : null}
        />
        <Metric
          label="Contribuição"
          value={brl(s.contribution)}
          detail={
            s.quantity > 0
              ? `${brl(s.contribution / s.quantity)} por garrafa vendida`
              : "Após CMV e taxas das vendas"
          }
          icon={<ArrowUpRight size={21} />}
          delta={prev ? deltaPercent(s.contribution, prev.contribution) : null}
        />
        <Metric
          label="Despesas"
          value={brl(s.expenses)}
          detail={`${data.expenses.length} ${data.expenses.length === 1 ? "lançamento" : "lançamentos"} no período`}
          icon={<ArrowDownLeft size={21} />}
          delta={prev ? deltaPercent(s.expenses, prev.expenses) : null}
          invertDelta
        />
        <Metric
          label="Resultado estimado"
          value={brl(s.netResult)}
          detail="Contribuição menos despesas"
          icon={<TrendingUp size={21} />}
          tone={s.netResult < 0 ? "negative" : "result"}
          delta={prev ? deltaPercent(s.netResult, prev.netResult) : null}
        />
      </section>
      <section className="panel goals-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">METAS E EQUILÍBRIO</span>
            <h2>Progresso do período</h2>
          </div>
          <button type="button" className="text-button" onClick={openGoals}>
            <Target size={15} /> Definir metas
          </button>
        </div>
        <div className="goals-grid">
          <div className="goal-item">
            <div className="goal-top">
              <span>Ponto de equilíbrio</span>
              <b>
                {s.breakEvenUnits !== null && s.breakEvenUnits > 0
                  ? `${num(s.quantity)} / ${num(s.breakEvenUnits)} garrafas`
                  : "Sem projeção ativa"}
              </b>
            </div>
            <div className="margin-track">
              <span style={{ width: `${breakEvenProgress ?? 0}%` }} />
            </div>
          </div>
          <div className="goal-item">
            <div className="goal-top">
              <span>Meta de faturamento</span>
              <b>
                {extras.goals.revenueGoal > 0
                  ? `${brl(s.revenue)} / ${brl(extras.goals.revenueGoal)}`
                  : "Não definida"}
              </b>
            </div>
            <div className="margin-track">
              <span style={{ width: `${revProgress ?? 0}%` }} />
            </div>
          </div>
          <div className="goal-item">
            <div className="goal-top">
              <span>Meta de garrafas</span>
              <b>
                {extras.goals.unitsGoal > 0
                  ? `${num(s.quantity)} / ${num(extras.goals.unitsGoal)} un`
                  : "Não definida"}
              </b>
            </div>
            <div className="margin-track">
              <span style={{ width: `${unitsProgress ?? 0}%` }} />
            </div>
          </div>
        </div>
      </section>
      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">EVOLUÇÃO DO NEGÓCIO</span>
              <h2>Faturamento por dia</h2>
              <p>Vendas registradas no período selecionado</p>
            </div>
            <span className="legend">
              <i /> Receita
            </span>
          </div>
          <RevenueChart daily={s.daily} period={period} />
        </article>
        <article className="panel result-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">CADA GARRAFA CONTA</span>
              <h2>Composição do resultado</h2>
            </div>
            <CircleDollarSign size={21} />
          </div>
          <div className="result-rows">
            <div>
              <span>Receita de vendas</span>
              <b>{brl(s.revenue)}</b>
            </div>
            <div>
              <span>CMV dos produtos</span>
              <b>− {brl(s.cost)}</b>
            </div>
            <div>
              <span>Taxas variáveis</span>
              <b>− {brl(s.fees)}</b>
            </div>
            <div className="subtotal">
              <span>Contribuição</span>
              <b>{brl(s.contribution)}</b>
            </div>
            <div>
              <span>Despesas do período</span>
              <b>− {brl(s.expenses)}</b>
            </div>
            <div className="total">
              <span>Resultado estimado</span>
              <b>{brl(s.netResult)}</b>
            </div>
          </div>
          <p className="panel-note">
            Baseado nos registros. Custos fixos previstos entram apenas no ponto
            de equilíbrio.
          </p>
        </article>
      </section>
      <section className="content-grid lower-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Últimas vendas</h2>
              <p>Um olhar sobre os seus últimos registros</p>
            </div>
            <button className="text-button" onClick={() => navigate("Vendas")}>
              Ver todas <ArrowRight size={15} />
            </button>
          </div>
          {data.sales.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Data</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sales.slice(0, 5).map((sale) => (
                    <tr key={sale.id}>
                      <td>
                        <strong>{sale.productName}</strong>
                        <small>
                          {sale.channel} · {num(sale.quantity)}{" "}
                          {sale.quantity === 1 ? "garrafa" : "garrafas"}
                        </small>
                      </td>
                      <td>{datePt(sale.date)}</td>
                      <td className="amount">{brl(sale.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              icon={<CreditCard />}
              title="Sua próxima venda começa aqui"
              text="Registre uma venda para acompanhar receita, custos e contribuição."
              action="Registrar primeira venda"
              onClick={() => create("Vendas")}
            />
          )}
        </article>
        <article className="panel margin-panel">
          <div className="panel-heading">
            <div>
              <h2>Margem de contribuição</h2>
              <p>O que sobra após CMV e taxas</p>
            </div>
            <ArrowUpRight size={21} />
          </div>
          <div className="margin-value">
            {num(Number(s.averageMargin.toFixed(1)))}
            <span>%</span>
          </div>
          <div className="margin-track">
            <span
              style={{
                width: `${Math.max(0, Math.min(100, s.averageMargin))}%`,
              }}
            />
          </div>
          <p>
            {s.revenue
              ? "Percentual sobre a receita registrada no período."
              : "A margem será calculada quando houver vendas."}
          </p>
          {channelStats.length > 0 && (
            <div className="channel-breakdown">
              <span className="eyebrow">VENDAS POR CANAL</span>
              {channelStats.map((item) => (
                <div className="channel-row" key={item.channel}>
                  <span>
                    {item.channel} ({item.count})
                  </span>
                  <b>{brl(item.revenue)}</b>
                </div>
              ))}
            </div>
          )}
          <button
            className="text-button"
            onClick={() => navigate("Precificação")}
          >
            Analisar meus preços <ArrowRight size={16} />
          </button>
        </article>
      </section>
      {productRanking.length > 0 && (
        <section className="panel ranking-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">MAIS LUCRATIVOS DO PERÍODO</span>
              <h2>Ranking de sabores</h2>
              <p>Ordenado pela contribuição gerada nas vendas filtradas</p>
            </div>
            <Award size={20} />
          </div>
          <div className="ranking-list">
            {productRanking.map((item, idx) => {
              const maxContrib = Math.max(
                productRanking[0]?.contribution ?? 1,
                1,
              );
              return (
                <div className="ranking-row" key={item.name}>
                  <span className="ranking-pos">#{idx + 1}</span>
                  <div className="ranking-info">
                    <div className="ranking-top">
                      <strong>{item.name}</strong>
                      <span>
                        {num(item.quantity)} un · {brl(item.revenue)} ·{" "}
                        <b>{brl(item.contribution)} contrib.</b>
                      </span>
                    </div>
                    <div className="margin-track">
                      <span
                        style={{
                          width: `${Math.max(4, Math.min(100, (item.contribution / maxContrib) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <section className="quick-grid">
        {[
          {
            section: "Insumos",
            icon: FlaskConical,
            title: "Cadastrar insumo",
            text: "Comece pelo custo de compra",
          },
          {
            section: "Produtos",
            icon: Boxes,
            title: "Criar ficha técnica",
            text: "Conheça o custo por garrafa",
          },
          {
            section: "Despesas",
            icon: Wallet,
            title: "Registrar despesa",
            text: "Mantenha os gastos em dia",
          },
        ].map(({ section, icon: Icon, title, text }) => (
          <button
            className="quick-card"
            key={section}
            onClick={() => create(section as Section)}
          >
            <span>
              <Icon size={21} />
            </span>
            <div>
              <strong>{title}</strong>
              <small>{text}</small>
            </div>
            <ArrowRight size={18} />
          </button>
        ))}
      </section>
      <p className="disclaimer">
        <ShieldCheck size={16} /> A contribuição não representa lucro líquido. O
        resultado estimado considera somente as despesas e vendas registradas.
      </p>
    </>
  );
}

function RevenueChart({
  daily,
  period,
}: {
  daily: Snapshot["summary"]["daily"];
  period: Period;
}) {
  if (!daily.length)
    return (
      <div className="chart-empty">
        <div className="chart-empty-bars" aria-hidden="true">
          {[25, 48, 35, 66, 50, 85, 70, 100, 88, 120, 105].map((h, i) => (
            <i key={i} style={{ height: h }} />
          ))}
        </div>
        <div>
          <TrendingUp size={24} />
          <strong>Uma visão clara, venda após venda.</strong>
          <p>O gráfico ganha vida com seus registros reais.</p>
        </div>
      </div>
    );
  const rawCount =
    Math.round((Date.parse(period.to) - Date.parse(period.from)) / 86400000) +
    1;
  const count = Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 1;
  const bucketDays = Math.max(1, Math.ceil(count / 31));
  const buckets: { label: string; value: number }[] = [];
  const values = new Map(daily.map((x) => [x.date, x.revenue]));
  for (let i = 0; i < count; i += bucketDays) {
    let value = 0;
    let label = "";
    for (let j = i; j < Math.min(count, i + bucketDays); j++) {
      const date = new Date(Date.parse(period.from) + j * 86400000)
        .toISOString()
        .slice(0, 10);
      if (j === i) label = date;
      value += values.get(date) ?? 0;
    }
    buckets.push({ label, value });
  }
  const max = Math.max(...buckets.map((x) => x.value), 1);
  return (
    <div className="revenue-chart">
      <div className="chart-scale">
        <span>{brl(max)}</span>
        <span>{brl(max / 2)}</span>
        <span>R$ 0</span>
      </div>
      <div
        className="chart-columns"
        role="img"
        aria-label={`Faturamento de ${datePt(period.from)} a ${datePt(period.to)}. ${bucketDays > 1 ? `Barras de ${bucketDays} dias.` : "Barras diárias."}`}
      >
        {buckets.map((x, i) => (
          <div className="chart-column" key={x.label}>
            <div className="chart-bar-space">
              <div
                className={`chart-bar ${i === 0 ? "edge-left" : i === buckets.length - 1 ? "edge-right" : ""}`}
                tabIndex={0}
                style={{ height: `${(x.value / max) * 100}%` }}
                aria-label={`${datePt(x.label)}${bucketDays > 1 ? `, até ${bucketDays} dias` : ""}: ${brl(x.value)}`}
              >
                <span>
                  {datePt(x.label)}
                  <b>{brl(x.value)}</b>
                </span>
              </div>
            </div>
            <small>
              {i % Math.max(1, Math.ceil(buckets.length / 6)) === 0
                ? x.label.slice(8) + "/" + x.label.slice(5, 7)
                : ""}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty({
  icon,
  title,
  text,
  action,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="secondary-button" onClick={onClick}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  );
}

function Records({
  section,
  data,
  extras,
  period,
  create,
  edit,
  duplicateProduct,
  openStock,
  launchRecurring,
  removeRecurring,
  reload,
}: {
  section: Section;
  data: Snapshot;
  extras: WorkspaceExtras;
  period: Period;
  create: (presetProductId?: string) => void;
  edit: (item: Ingredient | Product | Expense) => void;
  duplicateProduct: (p: Product) => void;
  openStock: (ing: Ingredient) => void;
  launchRecurring: (t: RecurringExpense) => Promise<void>;
  removeRecurring: (id: string) => void;
  reload: () => void;
}) {
  const [search, setSearch] = useState("");
  const [chipFilter, setChipFilter] = useState("ALL");
  const [pending, setPending] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ingredientNames = useMemo(
    () => new Map(data.ingredients.map((i) => [i.id, i.name])),
    [data.ingredients],
  );

  const filterChips = useMemo(() => {
    if (section === "Vendas") {
      const channels = Array.from(new Set(data.sales.map((s) => s.channel)));
      const payments = Array.from(
        new Set(data.sales.map((s) => s.paymentMethod)),
      );
      return [
        { id: "ALL", label: "Todas" },
        ...channels.map((c) => ({ id: `ch:${c}`, label: c })),
        ...payments.map((p) => ({ id: `pm:${p}`, label: p })),
      ];
    }
    if (section === "Despesas") {
      const categories = Array.from(
        new Set(data.expenses.map((e) => e.category)),
      ).slice(0, 5);
      return [
        { id: "ALL", label: "Todas" },
        { id: "type:fixed", label: "Fixas" },
        { id: "type:variable", label: "Variáveis" },
        ...categories.map((c) => ({ id: `cat:${c}`, label: c })),
      ];
    }
    return [];
  }, [section, data.sales, data.expenses]);

  const query = search.trim().toLocaleLowerCase("pt-BR");

  const rows = useMemo(() => {
    const match = (fields: string[]) =>
      !query ||
      fields.some((f) => f.toLocaleLowerCase("pt-BR").includes(query));

    if (section === "Insumos") {
      return data.ingredients.filter((x) =>
        match([x.name, x.unit, brl(x.purchasePrice), num(x.purchaseQuantity)]),
      );
    }
    if (section === "Produtos") {
      return data.products.filter((x) =>
        match([
          x.name,
          x.size,
          brl(x.price),
          ...x.recipe.map((r) => ingredientNames.get(r.ingredientId) ?? ""),
        ]),
      );
    }
    if (section === "Vendas") {
      return data.sales.filter((x) => {
        if (chipFilter.startsWith("ch:") && x.channel !== chipFilter.slice(3))
          return false;
        if (
          chipFilter.startsWith("pm:") &&
          x.paymentMethod !== chipFilter.slice(3)
        )
          return false;
        return match([
          x.productName,
          x.channel,
          x.paymentMethod,
          datePt(x.date),
          brl(x.total),
        ]);
      });
    }
    return data.expenses.filter((x) => {
      if (chipFilter === "type:fixed" && !x.isFixed) return false;
      if (chipFilter === "type:variable" && x.isFixed) return false;
      if (chipFilter.startsWith("cat:") && x.category !== chipFilter.slice(4))
        return false;
      return match([
        x.description,
        x.category,
        datePt(x.date),
        x.isFixed ? "Fixa" : "Variável",
        brl(x.amount),
      ]);
    });
  }, [section, data, query, chipFilter, ingredientNames]);

  async function remove(id: string) {
    if (pending !== id) {
      setPending(id);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.remove(
        section === "Insumos"
          ? "ingredients"
          : section === "Produtos"
            ? "products"
            : section === "Vendas"
              ? "sales"
              : "expenses",
        id,
      );
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setPending(undefined);
    }
  }

  function handleExportCsv() {
    const suffix = `${period.from}_${period.to}`;
    if (section === "Insumos") {
      exportCsv(
        `netuno-insumos-${today()}.csv`,
        ["Insumo", "Unidade", "Qtd Compra", "Valor Compra", "Custo Unitario"],
        (rows as Ingredient[]).map((x) => [
          x.name,
          x.unit,
          num(x.purchaseQuantity),
          x.purchasePrice.toFixed(2).replace(".", ","),
          (x.purchasePrice / x.purchaseQuantity).toFixed(4).replace(".", ","),
        ]),
      );
    } else if (section === "Produtos") {
      exportCsv(
        `netuno-produtos-${today()}.csv`,
        ["Produto", "Tamanho", "Preco", "CMV", "Taxas", "Contribuicao"],
        (rows as Product[]).map((x) => [
          x.name,
          x.size,
          x.price.toFixed(2).replace(".", ","),
          x.unitCost.toFixed(2).replace(".", ","),
          x.variableFee.toFixed(2).replace(".", ","),
          x.contribution.toFixed(2).replace(".", ","),
        ]),
      );
    } else if (section === "Vendas") {
      exportCsv(
        `netuno-vendas-${suffix}.csv`,
        [
          "Data",
          "Produto",
          "Canal",
          "Pagamento",
          "Quantidade",
          "Total",
          "Contribuicao",
        ],
        (rows as Sale[]).map((x) => [
          datePt(x.date),
          x.productName,
          x.channel,
          x.paymentMethod,
          num(x.quantity),
          x.total.toFixed(2).replace(".", ","),
          x.contribution.toFixed(2).replace(".", ","),
        ]),
      );
    } else {
      exportCsv(
        `netuno-despesas-${suffix}.csv`,
        ["Data", "Descricao", "Categoria", "Tipo", "Valor"],
        (rows as Expense[]).map((x) => [
          datePt(x.date),
          x.description,
          x.category,
          x.isFixed ? "Fixa" : "Variavel",
          x.amount.toFixed(2).replace(".", ","),
        ]),
      );
    }
  }

  const labelOf = (item: Ingredient | Product | Sale | Expense) =>
    "name" in item
      ? item.name
      : "productName" in item
        ? item.productName
        : item.description;

  const actions = (
    item: Ingredient | Product | Sale | Expense,
    canEdit: boolean,
    extraButtons?: ReactNode,
  ) => (
    <div className="row-actions">
      {extraButtons}
      {canEdit && (
        <button
          className="icon-button"
          aria-label={`Editar ${labelOf(item)}`}
          onClick={() => edit(item as Ingredient | Product | Expense)}
        >
          <Pencil size={16} />
        </button>
      )}
      {pending === item.id ? (
        <>
          <button
            className="danger-button"
            disabled={busy}
            onClick={() => void remove(item.id)}
          >
            Confirmar exclusão
          </button>
          <button
            className="icon-button"
            onClick={() => setPending(undefined)}
            aria-label="Cancelar exclusão"
          >
            <X size={16} />
          </button>
        </>
      ) : (
        <button
          className="icon-button"
          disabled={busy}
          aria-label={`Excluir ${labelOf(item)}`}
          onClick={() => void remove(item.id)}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );

  const salesTotals = useMemo(() => {
    if (section !== "Vendas") return null;
    const list = rows as Sale[];
    const qty = list.reduce((s, x) => s + x.quantity, 0);
    const total = list.reduce((s, x) => s + x.total, 0);
    const contrib = list.reduce((s, x) => s + x.contribution, 0);
    return { qty, total, contrib };
  }, [section, rows]);

  const expenseTotals = useMemo(() => {
    if (section !== "Despesas") return null;
    const list = rows as Expense[];
    const total = list.reduce((s, x) => s + x.amount, 0);
    const fixed = list
      .filter((x) => x.isFixed)
      .reduce((s, x) => s + x.amount, 0);
    return { total, fixed, variable: total - fixed };
  }, [section, rows]);

  return (
    <>
      {section === "Vendas" && data.products.length > 0 && (
        <div className="quick-sale-strip">
          <span className="quick-sale-label">
            <Zap size={14} /> Venda rápida
          </span>
          <div className="quick-sale-buttons">
            {data.products.slice(0, 4).map((p) => (
              <button
                type="button"
                key={p.id}
                className="quick-sale-chip"
                onClick={() => create(p.id)}
              >
                <Plus size={13} />
                <span>
                  {p.name} · {p.size}
                </span>
                <b>{brl(p.price)}</b>
              </button>
            ))}
          </div>
        </div>
      )}
      {section === "Despesas" && extras.recurringExpenses.length > 0 && (
        <section className="panel recurring-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">LANÇAMENTO EM 1 CLIQUE</span>
              <h2>Despesas recorrentes</h2>
            </div>
            <Repeat size={18} />
          </div>
          <div className="recurring-grid">
            {extras.recurringExpenses.map((tpl) => (
              <div className="recurring-card" key={tpl.id}>
                <div>
                  <strong>{tpl.description}</strong>
                  <small>
                    {tpl.category} · {brl(tpl.amount)}
                  </small>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="secondary-button recurring-launch"
                    onClick={() => void launchRecurring(tpl)}
                  >
                    Lançar hoje
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remover modelo ${tpl.description}`}
                    onClick={() => removeRecurring(tpl.id)}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="panel listing-panel">
        <div className="panel-heading">
          <div>
            <h2>
              {section === "Produtos"
                ? "Catálogo de produtos"
                : section === "Insumos"
                  ? "Seus insumos"
                  : section === "Vendas"
                    ? "Histórico de vendas"
                    : "Despesas do período"}
            </h2>
            <p>
              {rows.length} registro{rows.length === 1 ? "" : "s"}
              {section === "Vendas" || section === "Despesas"
                ? " no período"
                : " no catálogo"}
            </p>
          </div>
          <div className="listing-tools">
            {rows.length > 0 && (
              <button
                type="button"
                className="secondary-button csv-button"
                onClick={handleExportCsv}
              >
                <FileSpreadsheet size={15} />
                <span>CSV</span>
              </button>
            )}
            <label className="search">
              <Search size={17} />
              <input
                aria-label={`Buscar em ${section}`}
                placeholder="Buscar…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
        </div>
        {filterChips.length > 1 && (
          <div className="filter-chips" role="group" aria-label="Filtros rápidos">
            {filterChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={`chip ${chipFilter === chip.id ? "active" : ""}`}
                onClick={() => setChipFilter(chip.id)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
        {salesTotals && rows.length > 0 && (
          <div className="summary-strip">
            <div>
              <small>Garrafas</small>
              <strong>{num(salesTotals.qty)}</strong>
            </div>
            <div>
              <small>Faturamento</small>
              <strong>{brl(salesTotals.total)}</strong>
            </div>
            <div>
              <small>Contribuição</small>
              <strong>{brl(salesTotals.contrib)}</strong>
            </div>
          </div>
        )}
        {expenseTotals && rows.length > 0 && (
          <div className="summary-strip">
            <div>
              <small>Total no período</small>
              <strong>{brl(expenseTotals.total)}</strong>
            </div>
            <div>
              <small>Despesas fixas</small>
              <strong>{brl(expenseTotals.fixed)}</strong>
            </div>
            <div>
              <small>Despesas variáveis</small>
              <strong>{brl(expenseTotals.variable)}</strong>
            </div>
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!rows.length ? (
          <Empty
            icon={<Search />}
            title={
              search || chipFilter !== "ALL"
                ? "Nenhum resultado para este filtro"
                : "Tudo começa com o primeiro registro"
            }
            text={
              search || chipFilter !== "ALL"
                ? "Tente limpar a busca ou trocar o filtro selecionado."
                : `Adicione ${section.toLowerCase()} para organizar seu negócio.`
            }
            action={
              search || chipFilter !== "ALL" ? undefined : "Adicionar registro"
            }
            onClick={() => create()}
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {(section === "Insumos"
                    ? [
                        "Insumo",
                        "Compra",
                        "Custo unitário",
                        "Estoque",
                        "Ações",
                      ]
                    : section === "Produtos"
                      ? [
                          "Produto",
                          "CMV / garrafa",
                          "Preço",
                          "Contribuição",
                          "Ações",
                        ]
                      : section === "Vendas"
                        ? [
                            "Produto",
                            "Data",
                            "Canal / pagamento",
                            "Qtd.",
                            "Total",
                            "Contribuição",
                            "Ações",
                          ]
                        : ["Descrição", "Categoria", "Data", "Valor", "Ações"]
                  ).map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section === "Insumos"
                  ? (rows as Ingredient[]).map((x) => {
                      const stock = extras.stock[x.id];
                      const low = stock && stock.currentStock <= stock.minStock;
                      return (
                        <tr key={x.id}>
                          <td>
                            <strong>{x.name}</strong>
                            <small>
                              {brl(x.purchasePrice)} · Unidade base: {x.unit}
                            </small>
                          </td>
                          <td>
                            {num(x.purchaseQuantity)} {x.unit}
                          </td>
                          <td>
                            {brlUnit(x.purchasePrice / x.purchaseQuantity)} /{" "}
                            {x.unit}
                          </td>
                          <td>
                            {stock ? (
                              <button
                                type="button"
                                className={`badge stock-pill ${low ? "bad" : ""}`}
                                onClick={() => openStock(x)}
                              >
                                {num(stock.currentStock)} {x.unit}
                                {low ? " · Baixo" : ""}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => openStock(x)}
                              >
                                <Package size={14} /> Controlar
                              </button>
                            )}
                          </td>
                          <td>{actions(x, true)}</td>
                        </tr>
                      );
                    })
                  : section === "Produtos"
                    ? (rows as Product[]).map((x) => {
                        const margin =
                          x.price > 0 ? (x.contribution / x.price) * 100 : 0;
                        return (
                          <tr key={x.id}>
                            <td>
                              <strong>{x.name}</strong>
                              <small>
                                {x.size} · {x.recipe.length}{" "}
                                {x.recipe.length === 1 ? "insumo" : "insumos"}
                              </small>
                            </td>
                            <td>{brl(x.unitCost)}</td>
                            <td>{brl(x.price)}</td>
                            <td>
                              <span
                                className={`badge ${x.contribution <= 0 ? "bad" : ""}`}
                              >
                                {brl(x.contribution)} · {pct(margin)}
                              </span>
                            </td>
                            <td>
                              {actions(
                                x,
                                true,
                                <button
                                  className="icon-button"
                                  aria-label={`Duplicar ${x.name}`}
                                  title="Duplicar produto"
                                  onClick={() => duplicateProduct(x)}
                                >
                                  <Copy size={15} />
                                </button>,
                              )}
                            </td>
                          </tr>
                        );
                      })
                    : section === "Vendas"
                      ? (rows as Sale[]).map((x) => (
                          <tr key={x.id}>
                            <td>
                              <strong>{x.productName}</strong>
                            </td>
                            <td>{datePt(x.date)}</td>
                            <td>
                              {x.channel}
                              <small>{x.paymentMethod}</small>
                            </td>
                            <td>{num(x.quantity)}</td>
                            <td className="amount">{brl(x.total)}</td>
                            <td>{brl(x.contribution)}</td>
                            <td>{actions(x, false)}</td>
                          </tr>
                        ))
                      : (rows as Expense[]).map((x) => (
                          <tr key={x.id}>
                            <td>
                              <strong>{x.description}</strong>
                              <small>{x.isFixed ? "Fixa" : "Variável"}</small>
                            </td>
                            <td>{x.category}</td>
                            <td>{datePt(x.date)}</td>
                            <td className="amount">{brl(x.amount)}</td>
                            <td>{actions(x, true)}</td>
                          </tr>
                        ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Pricing({
  data,
  edit,
  fixed,
}: {
  data: Snapshot;
  edit: (p: Product, suggestedPrice?: number) => void;
  fixed: () => void;
}) {
  const s = data.summary;
  const [simProductId, setSimProductId] = useState(data.products[0]?.id ?? "");
  const [targetMargin, setTargetMargin] = useState(45);

  const simProduct =
    data.products.find((p) => p.id === simProductId) ?? data.products[0];

  const simulation = useMemo(() => {
    if (!simProduct) return null;
    const denom = 1 - simProduct.feePercent / 100 - targetMargin / 100;
    if (denom <= 0.01) return { viable: false as const };
    const suggestedPrice =
      Math.ceil(((simProduct.unitCost + simProduct.feePerUnit) / denom) * 100) /
      100;
    const variableFee =
      (suggestedPrice * simProduct.feePercent) / 100 + simProduct.feePerUnit;
    const contribution = suggestedPrice - simProduct.unitCost - variableFee;
    const breakEven =
      contribution > 0
        ? Math.ceil(s.monthlyFixedCosts / contribution)
        : null;
    return {
      viable: true as const,
      suggestedPrice,
      contribution,
      breakEven,
    };
  }, [simProduct, targetMargin, s.monthlyFixedCosts]);

  return (
    <>
      <div className="pricing-intro">
        <div>
          <span className="eyebrow">PLANEJE COM CLAREZA</span>
          <h2>Um preço que faz sentido para você.</h2>
          <p>
            Contribuição por garrafa = preço − ficha técnica − taxas variáveis.
          </p>
        </div>
        <div className="pricing-fixed">
          <small>Custos fixos previstos / mês</small>
          <strong>{brl(s.monthlyFixedCosts)}</strong>
          <button className="text-button" onClick={fixed}>
            <Settings2 size={16} /> Configurar
          </button>
        </div>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Rentabilidade por produto</h2>
            <p>Custos atuais dos insumos e taxas padrão do produto.</p>
          </div>
        </div>
        {data.products.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    "Produto",
                    "Preço",
                    "CMV",
                    "Taxas",
                    "Contribuição",
                    "Margem",
                    "",
                  ].map((x, i) => (
                    <th key={i}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.products.map((p) => {
                  const margin =
                    p.price > 0 ? (p.contribution / p.price) * 100 : 0;
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <small>{p.size}</small>
                      </td>
                      <td>{brl(p.price)}</td>
                      <td>{brl(p.unitCost)}</td>
                      <td>{brl(p.variableFee)}</td>
                      <td>{brl(p.contribution)}</td>
                      <td>
                        <span
                          className={`badge ${p.contribution <= 0 ? "bad" : ""}`}
                        >
                          {num(Number(margin.toFixed(1)))}%
                        </span>
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => edit(p)}
                        >
                          Ajustar <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<CircleDollarSign />}
            title="Conheça a margem de cada sabor"
            text="Cadastre seus insumos e crie a ficha técnica do primeiro produto."
          />
        )}
      </section>
      {simProduct && (
        <section className="panel simulator-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">SIMULADOR DE PREÇO</span>
              <h2>Encontre o preço ideal para sua margem</h2>
              <p>
                Simule quanto cobrar para alcançar a margem desejada sobre cada
                garrafa.
              </p>
            </div>
            <Calculator size={20} />
          </div>
          <div className="simulator-body">
            <div className="simulator-controls">
              <label>
                Produto para simular
                <select
                  value={simProduct.id}
                  onChange={(e) => setSimProductId(e.target.value)}
                >
                  {data.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.size} (atual: {brl(p.price)})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Margem desejada: <strong>{targetMargin}%</strong>
                <input
                  type="range"
                  min={10}
                  max={80}
                  step={1}
                  value={targetMargin}
                  onChange={(e) => setTargetMargin(Number(e.target.value))}
                />
              </label>
            </div>
            {simulation?.viable ? (
              <div className="simulator-result">
                <div>
                  <small>Preço sugerido</small>
                  <strong>{brl(simulation.suggestedPrice)}</strong>
                </div>
                <div>
                  <small>Nova contribuição</small>
                  <strong>{brl(simulation.contribution)} / un</strong>
                </div>
                <div>
                  <small>Equilíbrio só com este sabor</small>
                  <strong>
                    {simulation.breakEven !== null
                      ? `${num(simulation.breakEven)} garrafas/mês`
                      : "—"}
                  </strong>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => edit(simProduct, simulation.suggestedPrice)}
                >
                  Usar este preço <ArrowRight size={15} />
                </button>
              </div>
            ) : (
              <p className="notice">
                A margem desejada somada à taxa percentual (
                {simProduct.feePercent}%) ultrapassa 100%. Reduza a margem alvo.
              </p>
            )}
          </div>
        </section>
      )}
      <article className="break-even">
        <span>
          <TrendingUp size={25} />
        </span>
        <div>
          <h3>Ponto de equilíbrio mensal</h3>
          <p>
            {s.quantity <= 0
              ? "Registre vendas para calcular a contribuição média por garrafa."
              : s.breakEvenUnits === null
                ? "Sem ponto de equilíbrio viável: a contribuição média é nula ou negativa."
                : `Estimativa de ${num(s.breakEvenUnits)} garrafas por mês para cobrir os custos fixos previstos.`}
          </p>
          <small>
            Projeção com o mix e a contribuição média das vendas do período.
            Custos fixos previstos não são descontados novamente do resultado.
          </small>
        </div>
      </article>
    </>
  );
}
