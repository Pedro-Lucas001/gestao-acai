import { useEffect, useState } from 'react';
import {
  ArrowDownRight, ArrowUpRight, Bell, Boxes, ChevronDown, CircleDollarSign,
  ClipboardList, CreditCard, FlaskConical, LayoutDashboard, Menu, Plus, Search,
  Settings2, Sparkles, Wallet, X,
} from 'lucide-react';
import { api } from './api';
import type { DashboardSummary, Expense, Ingredient, Product, Sale, Section } from './api/types';

const menu: { label: Section; icon: typeof LayoutDashboard }[] = [
  { label: 'Visão geral', icon: LayoutDashboard },
  { label: 'Insumos', icon: FlaskConical },
  { label: 'Produtos', icon: Boxes },
  { label: 'Vendas', icon: CreditCard },
  { label: 'Despesas', icon: Wallet },
  { label: 'Precificação', icon: CircleDollarSign },
];

const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const datePt = (date: string) => new Intl.DateTimeFormat('pt-BR').format(new Date(`${date}T12:00:00`));

export default function App() {
  const [section, setSection] = useState<Section>('Visão geral');
  const [summary, setSummary] = useState<DashboardSummary>();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [modal, setModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    void Promise.all([
      api.getDashboard().then(setSummary),
      api.getIngredients().then(setIngredients),
      api.getProducts().then(setProducts),
      api.getSales().then(setSales),
      api.getExpenses().then(setExpenses),
    ]);
  }, []);

  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
  const title = section === 'Visão geral' ? 'Bom dia, empreendedor 👋' : section;
  const subtitle = section === 'Visão geral'
    ? 'Aqui está o resumo financeiro do seu negócio.'
    : `Acompanhe e organize ${section.toLocaleLowerCase('pt-BR')} do seu negócio.`;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><span>G</span></div>
          <div><strong>gestão<span> açaí</span></strong><small>CONTROLE INTELIGENTE</small></div>
          <button className="icon-button mobile-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={19} /></button>
        </div>
        <div className="workspace-label">ESPAÇO DE TRABALHO</div>
        <button className="workspace-select"><span className="workspace-dot">A</span><span>Meu negócio<small>Administrador</small></span><ChevronDown size={16} /></button>
        <div className="nav-label">MENU PRINCIPAL</div>
        <nav className="nav-list" aria-label="Menu principal">
          {menu.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${section === label ? 'active' : ''}`} onClick={() => { setSection(label); setMenuOpen(false); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {label === 'Insumos' && ingredients.length > 0 && <span className="nav-count">{ingredients.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><Sparkles size={17} /></div><strong>Organize seu negócio</strong><p>Registre os custos para descobrir o lucro real por produto.</p><button onClick={() => setSection('Insumos')}>Começar agora <span>→</span></button></div>
          <button className="nav-item settings-item"><Settings2 size={18} /><span>Configurações</span></button>
          <div className="profile"><div className="avatar">A</div><div><strong>Administrador</strong><small>Minha conta</small></div><ChevronDown size={16} /></div>
        </div>
      </aside>
      {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={21} /></button>
          <div className="breadcrumbs">Meu negócio <span>/</span> <b>{section}</b></div>
          <div className="topbar-actions"><span className="period-label">Período</span><button className="period-select">Este mês <ChevronDown size={15} /></button><button className="icon-button notification" aria-label="Notificações"><Bell size={18} /><i /></button></div>
        </header>

        <div className="page-wrap">
          <section className="page-heading">
            <div><div className="eyebrow">{section === 'Visão geral' ? new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()).toLocaleUpperCase('pt-BR') : 'GESTÃO FINANCEIRA'}</div><h1>{title}</h1><p>{subtitle}</p></div>
            <button className="primary-button" onClick={() => setModal(true)}><Plus size={17} /> {section === 'Visão geral' ? 'Novo registro' : `Adicionar ${section === 'Insumos' ? 'insumo' : section === 'Produtos' ? 'produto' : section === 'Vendas' ? 'venda' : section === 'Despesas' ? 'despesa' : 'preço'}`}</button>
          </section>

          {section === 'Visão geral' && (
            <>
              <section className="metric-grid">
                <Metric icon={<CircleDollarSign size={19} />} label="VENDAS NO PERÍODO" value={brl(summary?.revenue ?? 0)} note="Faturamento registrado" tone="green" />
                <Metric icon={<ArrowUpRight size={19} />} label="CONTRIBUIÇÃO" value={brl(summary?.contribution ?? 0)} note="Após custos e taxas variáveis" tone="purple" />
                <Metric icon={<ClipboardList size={19} />} label="VENDAS REALIZADAS" value={String(summary?.salesCount ?? 0)} note="Neste período" tone="orange" />
                <Metric icon={<ArrowDownRight size={19} />} label="DESPESAS REGISTRADAS" value={brl(totalExpenses)} note="Não inclui taxas das vendas" tone="blue" />
              </section>
              <section className="content-grid">
                <div className="panel sales-panel">
                  <div className="panel-heading"><div><h2>Vendas recentes</h2><p>Acompanhe suas últimas vendas registradas</p></div><button className="text-button" onClick={() => setSection('Vendas')}>Ver todas <span>→</span></button></div>
                  {sales.length ? <div className="table-scroll"><table><thead><tr><th>PRODUTO</th><th>DATA</th><th>CANAL</th><th>VALOR</th></tr></thead><tbody>{sales.slice(0, 5).map((sale) => <tr key={sale.id}><td className="product-cell"><span className="product-thumb">A</span>{sale.productName}</td><td>{datePt(sale.date)}</td><td><span className="badge">{sale.channel}</span></td><td className="amount-cell">{brl(sale.total)}</td></tr>)}</tbody></table></div> : <EmptyState icon={<CreditCard size={21} />} title="Suas vendas aparecerão aqui" text="Registre sua primeira venda para acompanhar o faturamento e a contribuição." action="Registrar venda" onClick={() => { setSection('Vendas'); setModal(true); }} />}
                </div>
                <div className="panel margin-panel">
                  <div className="panel-heading"><div><h2>Margem média</h2><p>Margem de contribuição no período</p></div><span className="mini-icon"><CircleDollarSign size={17} /></span></div>
                  <div className="margin-value">{(summary?.averageMargin ?? 0).toFixed(1)}<small>%</small></div>
                  <div className="margin-track"><span style={{ width: `${Math.min(summary?.averageMargin ?? 0, 100)}%` }} /></div>
                  <div className="margin-foot"><span>Contribuição média</span><strong>{brl(summary?.contribution ?? 0)}</strong></div>
                  <div className="tip-box"><Sparkles size={15} /><span>Cadastre seus custos e fichas técnicas para entender melhor a margem de cada produto.</span></div>
                </div>
              </section>
              <section className="quick-grid">
                <button className="quick-card" onClick={() => { setSection('Insumos'); setModal(true); }}><span className="quick-icon lilac"><FlaskConical size={18} /></span><span><strong>Cadastrar insumo</strong><small>Atualize preços e custos</small></span><span className="quick-arrow">→</span></button>
                <button className="quick-card" onClick={() => { setSection('Produtos'); setModal(true); }}><span className="quick-icon mint"><Boxes size={18} /></span><span><strong>Criar produto</strong><small>Monte sua ficha técnica</small></span><span className="quick-arrow">→</span></button>
                <button className="quick-card" onClick={() => { setSection('Despesas'); setModal(true); }}><span className="quick-icon peach"><Wallet size={18} /></span><span><strong>Registrar despesa</strong><small>Organize seus gastos</small></span><span className="quick-arrow">→</span></button>
              </section>
              <div className="disclaimer"><span className="info-dot">i</span> A contribuição considera custos e taxas variáveis registrados. O lucro líquido também depende das despesas fixas do período.</div>
            </>
          )}

          {section !== 'Visão geral' && <SectionView section={section} ingredients={ingredients} products={products} sales={sales} expenses={expenses} onCreate={() => setModal(true)} />}
        </div>
        <footer className="footer"><span>Gestão Açaí <span className="footer-dot">•</span> Controle simples, decisões melhores.</span><span>Valores em reais (R$)</span></footer>
      </main>
      {modal && <CreateModal section={section} onClose={() => setModal(false)} />}
    </div>
  );
}

function Metric({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string; note: string; tone: string }) {
  return <article className="metric-card"><div className="metric-top"><span className={`metric-icon ${tone}`}>{icon}</span><span className="metric-label">{label}</span></div><strong className="metric-value">{value}</strong><span className="metric-note">{note}</span></article>;
}

function EmptyState({ icon, title, text, action, onClick }: { icon: React.ReactNode; title: string; text: string; action: string; onClick: () => void }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><strong>{title}</strong><p>{text}</p><button className="secondary-button" onClick={onClick}><Plus size={15} />{action}</button></div>;
}

function SectionView({ section, ingredients, products, sales, expenses, onCreate }: { section: Section; ingredients: Ingredient[]; products: Product[]; sales: Sale[]; expenses: Expense[]; onCreate: () => void }) {
  if (section === 'Precificação') return <div className="panel explainer-panel"><span className="quick-icon lilac"><CircleDollarSign size={20} /></span><h2>Precificação e margem</h2><p>Compare preço de venda, custo dos insumos e taxas variáveis para estimar a contribuição por garrafa.</p><div className="formula">Contribuição unitária = preço de venda − CMV − taxas variáveis</div><div className="tip-box"><Sparkles size={15} /><span>Cadastre produtos, fichas técnicas e custos variáveis para alimentar esta análise. O lucro líquido considera também as despesas fixas do período.</span></div><p className="muted-note">A contribuição não representa lucro líquido. O cálculo considera apenas os dados registrados.</p></div>;
  const isIngredients = section === 'Insumos';
  const isProducts = section === 'Produtos';
  const isSales = section === 'Vendas';
  const rows = isIngredients ? ingredients : isProducts ? products : isSales ? sales : expenses;
  const emptyLabel = isIngredients ? 'insumos' : isProducts ? 'produtos' : isSales ? 'vendas' : 'despesas';
  return <section className="panel listing-panel"><div className="panel-heading"><div><h2>{section} cadastrados</h2><p>{rows.length} registro{rows.length === 1 ? '' : 's'} no período atual</p></div><button className="search-button"><Search size={16} /><span>Buscar</span></button></div>
    {rows.length ? <div className="table-scroll"><table><thead><tr>{isIngredients ? <><th>INSUMO</th><th>UNIDADE</th><th>QUANTIDADE DE COMPRA</th><th>PREÇO DA COMPRA</th><th>CUSTO UNITÁRIO</th></> : isProducts ? <><th>PRODUTO</th><th>TAMANHO</th><th>PREÇO DE VENDA</th></> : isSales ? <><th>PRODUTO</th><th>DATA</th><th>CANAL</th><th>QUANTIDADE</th><th>TOTAL</th></> : <><th>DESCRIÇÃO</th><th>CATEGORIA</th><th>DATA</th><th>VALOR</th></>}</tr></thead><tbody>{rows.map((entry) => {
      if (isIngredients) { const item = entry as Ingredient; return <tr key={item.id}><td>{item.name}</td><td>{item.unit}</td><td>{item.purchaseQuantity}</td><td>{brl(item.purchasePrice)}</td><td>{brl(item.purchasePrice / (item.purchaseQuantity || 1))}</td></tr>; }
      if (isProducts) { const item = entry as Product; return <tr key={item.id}><td>{item.name}</td><td>{item.size}</td><td>{brl(item.price)}</td></tr>; }
      if (isSales) { const item = entry as Sale; return <tr key={item.id}><td>{item.productName}</td><td>{datePt(item.date)}</td><td>{item.channel}</td><td>{item.quantity}</td><td>{brl(item.total)}</td></tr>; }
      const item = entry as Expense; return <tr key={item.id}><td>{item.description}</td><td>{item.category}</td><td>{datePt(item.date)}</td><td>{brl(item.amount)}</td></tr>;
    })}</tbody></table></div> : <EmptyState icon={isIngredients ? <FlaskConical size={21} /> : isProducts ? <Boxes size={21} /> : isSales ? <CreditCard size={21} /> : <Wallet size={21} />} title={`Nenhum registro de ${emptyLabel}`} text={`Adicione seu primeiro registro de ${emptyLabel} para começar a acompanhar suas informações.`} action={`Adicionar ${isIngredients ? 'insumo' : isProducts ? 'produto' : isSales ? 'venda' : 'despesa'}`} onClick={onCreate} />}
  </section>;
}

function CreateModal({ section, onClose }: { section: Section; onClose: () => void }) {
  const label = section === 'Insumos' ? 'insumo' : section === 'Produtos' ? 'produto' : section === 'Vendas' ? 'venda' : section === 'Despesas' ? 'despesa' : 'registro';
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><span className="eyebrow">NOVO REGISTRO</span><h2 id="modal-title">Adicionar {label}</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={19} /></button></div><p className="modal-copy">O formulário ficará conectado aos dados reais na etapa de integração da API.</p><label>Nome ou descrição<input placeholder={section === 'Insumos' ? 'Ex.: Polpa de açaí' : section === 'Produtos' ? 'Ex.: Açaí tradicional' : section === 'Despesas' ? 'Ex.: Aluguel' : 'Digite uma descrição'} /></label><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={onClose}>Continuar <span>→</span></button></div></section></div>;
}
