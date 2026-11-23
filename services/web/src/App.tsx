import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FlaskConical,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Wallet,
  Waves,
  X,
} from "lucide-react";
import { api, signOut } from "./api";
import type {
  Ingredient,
  Period,
  Product,
  Section,
  Snapshot,
} from "./api/types";
import { EditorModal } from "./Forms";
import type { Editor } from "./Forms";
import { brl, datePt, monthPeriod, num, today } from "./format";
const navigation = [
  { label: "Visão geral", icon: LayoutDashboard },
  { label: "Insumos", icon: FlaskConical },
  { label: "Produtos", icon: Boxes },
  { label: "Vendas", icon: CreditCard },
  { label: "Despesas", icon: Wallet },
  { label: "Precificação", icon: CircleDollarSign },
] as const;
export function Brand({ large = false }: { large?: boolean }) {
  return (
    <div className={`brand ${large ? "brand-large" : ""}`}>
      <div className="logo-frame">
        <img src="/netuno-logo.jpg" alt="Netuno Açaí" />
      </div>
      {!large && <span>GESTÃO DO NEGÓCIO</span>}
    </div>
  );
}
function Login({ onLogin }: { onLogin: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api.login(
        String(values.get("username")),
        String(values.get("password")),
      );
      onLogin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-shell">
      <aside className="login-story">
        <span className="login-kicker">
          <Waves size={24} /> NETUNO AÇAÍ
        </span>
        <div>
          <span className="eyebrow">CADA GARRAFA CONTA.</span>
          <h1>
            Mais clareza.
            <br />
            Mais controle.
            <br />
            <em>Seu negócio no rumo.</em>
          </h1>
          <p>Transforme custos, preços e vendas em decisões para o seu açaí.</p>
          <div className="story-tags">
            <span>
              <Check size={16} /> Custos reais
            </span>
            <span>
              <Check size={16} /> Margem por produto
            </span>
          </div>
        </div>
        <span className="login-foot">DO PRIMEIRO INSUMO À ÚLTIMA VENDA.</span>
      </aside>
      <main className="login-main">
        <Brand large />
        <div className="login-form">
          <span className="eyebrow">BEM-VINDO DE VOLTA</span>
          <h2>Acesse seu negócio</h2>
          <p>Entre com sua conta de administrador.</p>
          <form onSubmit={submit}>
            <label>
              Usuário
              <input
                name="username"
                autoComplete="username"
                required
                maxLength={120}
                placeholder="Seu usuário"
              />
            </label>
            <label>
              Senha
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Sua senha"
              />
            </label>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <button className="primary-button" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <>
                  Entrar no painel <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          <small>
            <ShieldCheck size={15} /> Acesso exclusivo à administração
          </small>
        </div>
      </main>
    </div>
  );
}
export default function App() {
  const [logged, setLogged] = useState(false);
  const [section, setSection] = useState<Section>("Visão geral");
  const [period, setPeriod] = useState<Period>(monthPeriod);
  const [data, setData] = useState<Snapshot>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<Editor>();
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState("");
  const version = useRef(0);
  const load = useCallback(async () => {
    const current = ++version.current;
    setLoading(true);
    setError("");
    setData(undefined);
    try {
      const snapshot = await api.load(period);
      if (version.current === current) setData(snapshot);
    } catch (e) {
      if (version.current === current) setError((e as Error).message);
    } finally {
      if (version.current === current) setLoading(false);
    }
  }, [period]);
  useEffect(() => {
    if (logged) void load();
  }, [logged, load]);
  useEffect(() => {
    const logout = () => {
      ++version.current;
      setLogged(false);
      setData(undefined);
      setEditor(undefined);
      setError("");
      setToast("");
    };
    window.addEventListener("acai:logout", logout);
    return () => window.removeEventListener("acai:logout", logout);
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = window.setTimeout(() => setToast(""), 4500);
      return () => window.clearTimeout(timer);
    }
  }, [toast]);
  const closeEditor = useCallback(() => setEditor(undefined), []);
  const saved = () => {
    setEditor(undefined);
    setToast("Registro salvo com sucesso.");
    void load();
  };
  const navigate = (next: Section) => {
    setSection(next);
    setMobile(false);
  };
  if (!logged) return <Login onLogin={() => setLogged(true)} />;
  const create = (target: Section = section) =>
    setEditor({
      section:
        target === "Visão geral"
          ? "Vendas"
          : target === "Precificação"
            ? "Produtos"
            : target,
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
        <span className="nav-label">ADMINISTRAÇÃO</span>
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
          <button className="nav-item" onClick={() => signOut()}>
            <LogOut size={18} /> Sair da conta
          </button>
          <div className="profile">
            <span>A</span>
            <div>
              <strong>Administrador</strong>
              <small>Netuno Açaí</small>
            </div>
            <ShieldCheck size={17} />
          </div>
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
          <button
            className="secondary-button refresh"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Atualizar dados"
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            <span>Atualizar</span>
          </button>
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
                  period={period}
                  navigate={navigate}
                  create={create}
                />
              ) : section === "Precificação" ? (
                <Pricing
                  data={data}
                  edit={(p) => setEditor({ section: "Produtos", item: p })}
                  fixed={() => setEditor({ section, fixed: true })}
                />
              ) : (
                <Records
                  key={section}
                  data={data}
                  section={section}
                  create={() => create()}
                  edit={(item) => setEditor({ section, item })}
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
          <span>Valores em BRL · Horário de Brasília</span>
        </footer>
      </main>
      {editor && data && (
        <EditorModal
          editor={editor}
          data={data}
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
  const presets = (days: number) => {
    const end = today();
    const start = new Date(end + "T12:00:00Z");
    start.setUTCDate(start.getUTCDate() - days + 1);
    onChange({ from: start.toISOString().slice(0, 10), to: end });
    setCustom(false);
  };
  const month = monthPeriod();
  return (
    <div className="period-bar">
      <div className="period-tabs">
        <button
          className={
            !custom && period.from === month.from && period.to === month.to
              ? "selected"
              : ""
          }
          onClick={() => {
            onChange(month);
            setCustom(false);
          }}
        >
          Este mês
        </button>
        <button onClick={() => presets(7)}>7 dias</button>
        <button onClick={() => presets(30)}>30 dias</button>
        <button
          className={custom ? "selected" : ""}
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
            onChange(draft);
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
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: string;
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
function Overview({
  data,
  period,
  navigate,
  create,
}: {
  data: Snapshot;
  period: Period;
  navigate: (s: Section) => void;
  create: (s: Section) => void;
}) {
  const s = data.summary;
  return (
    <>
      <section className="metric-grid">
        <Metric
          label="Faturamento"
          value={brl(s.revenue)}
          detail={`${num(s.quantity)} garrafas · ${s.salesCount} ${s.salesCount === 1 ? "venda" : "vendas"}`}
          icon={<CircleDollarSign size={21} />}
          tone="featured"
        />
        <Metric
          label="Contribuição"
          value={brl(s.contribution)}
          detail="Após CMV e taxas das vendas"
          icon={<ArrowUpRight size={21} />}
        />
        <Metric
          label="Despesas"
          value={brl(s.expenses)}
          detail="Despesas registradas no período"
          icon={<ArrowDownLeft size={21} />}
        />
        <Metric
          label="Resultado estimado"
          value={brl(s.netResult)}
          detail="Contribuição menos despesas"
          icon={<TrendingUp size={21} />}
          tone={s.netResult < 0 ? "negative" : "result"}
        />
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
                  {data.sales.slice(0, 4).map((sale) => (
                    <tr key={sale.id}>
                      <td>
                        <strong>{sale.productName}</strong>
                        <small>
                          {sale.channel} · {num(sale.quantity)} garrafas
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
          <button
            className="text-button"
            onClick={() => navigate("Precificação")}
          >
            Analisar meus preços <ArrowRight size={16} />
          </button>
        </article>
      </section>
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
  // Include days with no sales; aggregate into at most 31 contiguous buckets for long ranges.
  const count =
    Math.round((Date.parse(period.to) - Date.parse(period.from)) / 86400000) +
    1;
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
                className="chart-bar"
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
  create,
  edit,
  reload,
}: {
  section: Section;
  data: Snapshot;
  create: () => void;
  edit: (item: Ingredient | Product) => void;
  reload: () => void;
}) {
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const source =
    section === "Insumos"
      ? data.ingredients
      : section === "Produtos"
        ? data.products
        : section === "Vendas"
          ? data.sales
          : data.expenses;
  const rows = source.filter((x) =>
    JSON.stringify(x)
      .toLocaleLowerCase("pt-BR")
      .includes(search.toLocaleLowerCase("pt-BR")),
  );
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
  const actions = (
    item: Ingredient | Product | { id: string },
    canEdit: boolean,
  ) => (
    <div className="row-actions">
      {canEdit && (
        <button
          className="icon-button"
          aria-label={`Editar ${"name" in item ? item.name : "registro"}`}
          onClick={() => edit(item as Ingredient | Product)}
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
          aria-label={`Excluir ${"name" in item ? item.name : "despesa"}`}
          onClick={() => void remove(item.id)}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
  return (
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
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!rows.length ? (
        <Empty
          icon={<Search />}
          title={
            search
              ? "Nenhum resultado para esta busca"
              : "Tudo começa com o primeiro registro"
          }
          text={
            search
              ? "Tente buscar por outro nome ou valor."
              : `Adicione ${section.toLowerCase()} para organizar seu negócio.`
          }
          action={search ? undefined : "Adicionar registro"}
          onClick={create}
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
                      "Valor da compra",
                      "Custo unitário",
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
                        ]
                      : ["Descrição", "Categoria", "Data", "Valor", "Ações"]
                ).map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section === "Insumos"
                ? (rows as Ingredient[]).map((x) => (
                    <tr key={x.id}>
                      <td>
                        <strong>{x.name}</strong>
                        <small>Unidade base: {x.unit}</small>
                      </td>
                      <td>
                        {num(x.purchaseQuantity)} {x.unit}
                      </td>
                      <td>{brl(x.purchasePrice)}</td>
                      <td>
                        {num(x.purchasePrice / x.purchaseQuantity)} R$ /{" "}
                        {x.unit}
                      </td>
                      <td>{actions(x, true)}</td>
                    </tr>
                  ))
                : section === "Produtos"
                  ? (rows as Product[]).map((x) => (
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
                            className={`badge ${x.contribution < 0 ? "bad" : ""}`}
                          >
                            {brl(x.contribution)}
                          </span>
                        </td>
                        <td>{actions(x, true)}</td>
                      </tr>
                    ))
                  : section === "Vendas"
                    ? (rows as Snapshot["sales"]).map((x) => (
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
                        </tr>
                      ))
                    : (rows as Snapshot["expenses"]).map((x) => (
                        <tr key={x.id}>
                          <td>
                            <strong>{x.description}</strong>
                            <small>{x.isFixed ? "Fixa" : "Variável"}</small>
                          </td>
                          <td>{x.category}</td>
                          <td>{datePt(x.date)}</td>
                          <td className="amount">{brl(x.amount)}</td>
                          <td>{actions(x, false)}</td>
                        </tr>
                      ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function Pricing({
  data,
  edit,
  fixed,
}: {
  data: Snapshot;
  edit: (p: Product) => void;
  fixed: () => void;
}) {
  const s = data.summary;
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
                {data.products.map((p) => (
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
                        {num(
                          Number(((p.contribution / p.price) * 100).toFixed(1)),
                        )}
                        %
                      </span>
                    </td>
                    <td>
                      <button className="text-button" onClick={() => edit(p)}>
                        Ajustar <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
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
