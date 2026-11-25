export const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    v,
  );
export const brlUnit = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: v > 0 && v < 0.1 ? 4 : 2,
  }).format(v);
export const num = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 }).format(v);
export const pct = (v: number) =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(v)}%`;
export const datePt = (date: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(date + "T12:00:00"));
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const monthPeriod = () => {
  const to = today();
  return { from: to.slice(0, 8) + "01", to };
};
export const rollingPeriod = (days: number) => {
  const end = today();
  const start = new Date(end + "T12:00:00Z");
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { from: start.toISOString().slice(0, 10), to: end };
};
