import type { Period } from "./api/types";

export function previousPeriod(period: Period): Period {
  const fromMs = Date.parse(period.from + "T12:00:00Z");
  const toMs = Date.parse(period.to + "T12:00:00Z");
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) {
    return period;
  }
  const days = Math.round((toMs - fromMs) / 86400000) + 1;
  const prevTo = new Date(fromMs - 86400000);
  const prevFrom = new Date(fromMs - days * 86400000);
  return {
    from: prevFrom.toISOString().slice(0, 10),
    to: prevTo.toISOString().slice(0, 10),
  };
}

export function deltaPercent(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || Math.abs(previous) < 0.0001) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[;"\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
): void {
  const lines = [
    headers.map(escapeCsvCell).join(";"),
    ...rows.map((row) => row.map(escapeCsvCell).join(";")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
