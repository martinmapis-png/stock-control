"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Filter, FileDown } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function formatDate(date: Date) {
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatType(type: string) {
  if (type === "entrada") return "Entrada";
  if (type === "salida") return "Salida";
  if (type === "ajuste") return "Ajuste";
  return type;
}

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function todayValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

const REPORT_HEADERS = ["Fecha", "Producto", "Depósito", "Tipo", "Cantidad", "Técnico", "Motivo"] as const;
const STOCK_HEADERS = ["Producto", "Stock inicial", "Entradas", "Salidas", "Stock final"] as const;
const DAY_STOCK_HEADERS = ["Producto", "Cantidad", "Técnicos"] as const;
const DAY_ENTRY_HEADERS = ["Producto", "Entradas", "Salidas", "Diferencia", "Técnicos"] as const;
const DAY_DETAIL_HEADERS = ["Hora", "Producto", "Depósito", "Cantidad", "Técnico", "Motivo"] as const;

function movementRows(movements: Movement[]) {
  return movements.map((m) => [
    formatDate(new Date(m.createdAt)),
    m.product.name,
    m.warehouse.name,
    formatType(m.type),
    String(m.quantity),
    m.technician?.name || "-",
    m.reason || "-",
  ]);
}

function stockRows(items: MonthStockItem[]) {
  return items.map((i) => [
    i.productName,
    String(i.stockInicial),
    String(i.entradas),
    String(i.salidas),
    String(i.stockFinal),
  ]);
}

function filterSummary(
  filters: {
    productId: string;
    warehouseId: string;
    type: string;
    month: string;
    dateFrom: string;
    dateTo: string;
  },
  products: { id: string; name: string }[],
  warehouses: { id: string; name: string }[]
) {
  const parts: string[] = [];
  if (filters.productId) {
    parts.push(`Producto: ${products.find((p) => p.id === filters.productId)?.name ?? filters.productId}`);
  }
  if (filters.warehouseId) {
    parts.push(`Depósito: ${warehouses.find((w) => w.id === filters.warehouseId)?.name ?? filters.warehouseId}`);
  }
  if (filters.type) parts.push(`Tipo: ${formatType(filters.type)}`);
  if (filters.month) parts.push(`Mes: ${filters.month}`);
  if (filters.dateFrom) parts.push(`Desde: ${filters.dateFrom}`);
  if (filters.dateTo) parts.push(`Hasta: ${filters.dateTo}`);
  return parts.length ? parts.join(" · ") : "Sin filtros (todos los movimientos)";
}

interface Movement {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  createdAt: string;
  product: { id: string; name: string };
  warehouse: { name: string };
  technician?: { id: string; name: string } | null;
}

interface MonthStockItem {
  productId: string;
  productName: string;
  stockInicial: number;
  entradas: number;
  salidas: number;
  stockFinal: number;
}

interface MonthStock {
  month: string;
  label: string;
  stockInicial: number;
  entradas: number;
  salidas: number;
  stockFinal: number;
  items: MonthStockItem[];
}

interface ReportData {
  movements: Movement[];
  summary: { totalEntradas: number; totalSalidas: number; totalMovimientos: number };
  monthStock: MonthStock | null;
}

interface DayProductItem {
  productId: string;
  productName: string;
  quantity: number;
  technicians: string[];
}

interface DayExits {
  day: string;
  label: string;
  technicianId: string | null;
  technicianName: string | null;
  totalUnidades: number;
  totalMovimientos: number;
  items: DayProductItem[];
  movements: Movement[];
}

interface DayDifference {
  productId: string;
  productName: string;
  entradas: number;
  salidas: number;
  diferencia: number;
  technicians: string[];
}

interface DayBundle {
  exits: DayExits;
  entries: DayExits;
  differences: DayDifference[];
}

function formatDiff(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function dayStockRows(items: DayProductItem[]) {
  return items.map((item) => [
    item.productName,
    String(item.quantity),
    item.technicians.length ? item.technicians.join(", ") : "-",
  ]);
}

function dayEntryRows(items: DayDifference[]) {
  return items.map((item) => [
    item.productName,
    String(item.entradas),
    String(item.salidas),
    formatDiff(item.diferencia),
    item.technicians.length ? item.technicians.join(", ") : "-",
  ]);
}

function dayDetailRows(movements: Movement[]) {
  return movements.map((m) => [
    formatTime(new Date(m.createdAt)),
    m.product.name,
    m.warehouse.name,
    String(m.quantity),
    m.technician?.name || "-",
    m.reason || "-",
  ]);
}

export function Reports() {
  const [mode, setMode] = useState<"month" | "day" | "entries">("month");
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [technicians, setTechnicians] = useState<{ id: string; name: string; active: boolean }[]>([]);
  const [filters, setFilters] = useState({
    productId: "",
    warehouseId: "",
    type: "",
    month: currentMonthValue(),
    dateFrom: "",
    dateTo: "",
  });
  const [dayFilters, setDayFilters] = useState({ day: todayValue(), technicianId: "" });
  const [report, setReport] = useState<ReportData | null>(null);
  const [dayBundle, setDayBundle] = useState<DayBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/products").then((r) => r.json()).then((p) => setProducts(p));
    fetch("/api/warehouses").then((r) => r.json()).then((w) => setWarehouses(w));
    fetch("/api/technicians?active=false")
      .then((r) => r.json())
      .then((t) => setTechnicians(Array.isArray(t) ? t : []));
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (filters.productId) params.set("productId", filters.productId);
    if (filters.warehouseId) params.set("warehouseId", filters.warehouseId);
    if (filters.type) params.set("type", filters.type);
    if (filters.month) params.set("month", filters.month);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);

    const res = await fetch(`/api/reports?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo generar el reporte");
      setLoading(false);
      return;
    }
    setReport(data);
    setLoading(false);
  };

  const fetchDayReport = async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ day: dayFilters.day });
    if (dayFilters.technicianId) params.set("technicianId", dayFilters.technicianId);
    const res = await fetch(`/api/reports?${params}`);
    const data = await res.json();
    if (!res.ok || !data.dayExits || !data.dayEntries) {
      setError(data.error || "No se pudo generar el reporte");
      setLoading(false);
      return;
    }
    setDayBundle({
      exits: data.dayExits,
      entries: data.dayEntries,
      differences: Array.isArray(data.differences) ? data.differences : [],
    });
    setLoading(false);
  };

  const dayReport = mode === "entries" ? dayBundle?.entries ?? null : dayBundle?.exits ?? null;
  const isDayMode = mode === "day" || mode === "entries";

  const canExport = isDayMode
    ? Boolean(
        dayBundle &&
          (mode === "entries"
            ? dayBundle.differences.length > 0 || dayBundle.entries.movements.length > 0
            : dayBundle.exits.movements.length > 0 || dayBundle.exits.items.length > 0)
      )
    : Boolean(report && (report.movements.length > 0 || (report.monthStock?.items.length ?? 0) > 0));

  const exportCSV = () => {
    if (!canExport) return;

    if (mode === "entries" && dayBundle) {
      const sections = [
        DAY_ENTRY_HEADERS.join(","),
        ...dayEntryRows(dayBundle.differences).map((r) => r.map((c) => `"${c}"`).join(",")),
        "",
        DAY_DETAIL_HEADERS.join(","),
        ...dayDetailRows(dayBundle.entries.movements).map((r) => r.map((c) => `"${c}"`).join(",")),
      ];
      const blob = new Blob(["\ufeff" + sections.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const who = dayBundle.entries.technicianName ? `-${dayBundle.entries.technicianName}` : "";
      a.download = `entradas-${dayBundle.entries.day}${who}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (mode === "day" && dayReport) {
      const sections = [
        DAY_STOCK_HEADERS.join(","),
        ...dayStockRows(dayReport.items).map((r) => r.map((c) => `"${c}"`).join(",")),
        "",
        DAY_DETAIL_HEADERS.join(","),
        ...dayDetailRows(dayReport.movements).map((r) => r.map((c) => `"${c}"`).join(",")),
      ];
      const blob = new Blob(["\ufeff" + sections.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `salidas-${dayReport.day}${dayReport.technicianName ? `-${dayReport.technicianName}` : ""}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (!report) return;

    const sections: string[] = [];

    if (report.monthStock?.items.length) {
      sections.push(
        STOCK_HEADERS.join(","),
        ...stockRows(report.monthStock.items).map((r) => r.map((c) => `"${c}"`).join(",")),
        ""
      );
    }

    sections.push(
      REPORT_HEADERS.join(","),
      ...movementRows(report.movements).map((r) => r.map((c) => `"${c}"`).join(","))
    );

    const csv = sections.join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-stock-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (!canExport) return;

    if (mode === "entries" && dayBundle) {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const entries = dayBundle.entries;
      const who = entries.technicianName ? `Técnico: ${entries.technicianName}` : "Todos los técnicos";
      const mismatches = dayBundle.differences.filter((item) => item.diferencia !== 0).length;

      doc.setFontSize(16);
      doc.text("Entradas de stock", 14, 16);
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`Día: ${entries.label}  ·  ${who}`, 14, 23);
      doc.text(
        `Unidades: ${entries.totalUnidades}  |  Movimientos: ${entries.totalMovimientos}  |  Diferencias: ${mismatches}  |  Generado: ${formatDate(new Date())}`,
        14,
        29
      );
      doc.setTextColor(0, 0, 0);

      let nextY = 36;
      if (dayBundle.differences.length) {
        doc.setFontSize(12);
        doc.text("Entradas y diferencia contra las salidas", 14, nextY);
        nextY += 4;
        autoTable(doc, {
          startY: nextY,
          head: [DAY_ENTRY_HEADERS as unknown as string[]],
          body: dayEntryRows(dayBundle.differences),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [5, 150, 105], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { left: 14, right: 14 },
          tableWidth: pageWidth - 28,
          columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
          didParseCell: (data) => {
            if (data.section !== "body") return;
            const item = dayBundle.differences[data.row.index];
            if (item && item.diferencia !== 0) {
              data.cell.styles.fillColor = [254, 243, 199];
              if (data.column.index === 3) data.cell.styles.textColor = [180, 83, 9];
            }
          },
        });
        nextY = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? nextY) + 10;
      }

      if (entries.movements.length) {
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text("Detalle de entradas", 14, nextY);
        nextY += 4;
        autoTable(doc, {
          startY: nextY,
          head: [DAY_DETAIL_HEADERS as unknown as string[]],
          body: dayDetailRows(entries.movements),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [5, 150, 105], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { left: 14, right: 14 },
          tableWidth: pageWidth - 28,
          columnStyles: { 3: { halign: "right" } },
        });
      }

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `StockControl · Página ${i} de ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: "center" }
        );
      }

      doc.save(`entradas-${entries.day}.pdf`);
      return;
    }

    if (mode === "day" && dayReport) {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const who = dayReport.technicianName ? `Técnico: ${dayReport.technicianName}` : "Todos los técnicos";

      doc.setFontSize(16);
      doc.text("Salidas de stock", 14, 16);
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`Día: ${dayReport.label}  ·  ${who}`, 14, 23);
      doc.text(
        `Unidades: ${dayReport.totalUnidades}  |  Movimientos: ${dayReport.totalMovimientos}  |  Generado: ${formatDate(new Date())}`,
        14,
        29
      );
      doc.setTextColor(0, 0, 0);

      let nextY = 36;
      if (dayReport.items.length) {
        doc.setFontSize(12);
        doc.text("Stock que salió", 14, nextY);
        nextY += 4;
        autoTable(doc, {
          startY: nextY,
          head: [DAY_STOCK_HEADERS as unknown as string[]],
          body: dayStockRows(dayReport.items),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [220, 38, 38], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { left: 14, right: 14 },
          tableWidth: pageWidth - 28,
          columnStyles: { 1: { halign: "right" } },
        });
        nextY = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? nextY) + 10;
      }

      if (dayReport.movements.length) {
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text("Detalle", 14, nextY);
        nextY += 4;
        autoTable(doc, {
          startY: nextY,
          head: [DAY_DETAIL_HEADERS as unknown as string[]],
          body: dayDetailRows(dayReport.movements),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [5, 150, 105], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { left: 14, right: 14 },
          tableWidth: pageWidth - 28,
          columnStyles: { 3: { halign: "right" } },
        });
      }

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `StockControl · Página ${i} de ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: "center" }
        );
      }

      doc.save(`salidas-${dayReport.day}.pdf`);
      return;
    }

    if (!report) return;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(16);
    doc.text("Reporte de movimientos de stock", 14, 16);

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Generado: ${formatDate(new Date())}`, 14, 23);
    doc.text(filterSummary(filters, products, warehouses), 14, 29);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    let nextY = 36;

    if (report.monthStock) {
      const m = report.monthStock;
      doc.text(
        `${m.label} — Stock inicial: ${m.stockInicial}  |  Entradas: ${m.entradas}  |  Salidas: ${m.salidas}  |  Stock final: ${m.stockFinal}`,
        14,
        nextY
      );
      nextY += 6;

      if (m.items.length) {
        doc.setFontSize(12);
        doc.text("Detalle de stock por producto", 14, nextY);
        nextY += 4;

        autoTable(doc, {
          startY: nextY,
          head: [STOCK_HEADERS as unknown as string[]],
          body: stockRows(m.items),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [37, 99, 235], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { left: 14, right: 14 },
          tableWidth: pageWidth - 28,
          columnStyles: {
            1: { halign: "right" },
            2: { halign: "right" },
            3: { halign: "right" },
            4: { halign: "right" },
          },
        });

        nextY = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? nextY) + 10;
      }
    } else {
      doc.text(
        `Entradas: ${report.summary.totalEntradas}   |   Salidas: ${report.summary.totalSalidas}   |   Movimientos: ${report.summary.totalMovimientos}`,
        14,
        nextY
      );
      nextY += 7;
    }

    if (report.movements.length) {
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text("Detalle de movimientos", 14, nextY);
      nextY += 4;

      autoTable(doc, {
        startY: nextY,
        head: [REPORT_HEADERS as unknown as string[]],
        body: movementRows(report.movements),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [5, 150, 105], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 14, right: 14 },
        tableWidth: pageWidth - 28,
      });
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `StockControl · Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: "center" }
      );
    }

    doc.save(`reporte-stock-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Reportes
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportCSV}
            disabled={!canExport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          <button
            onClick={exportPDF}
            disabled={!canExport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium"
          >
            <FileDown className="w-4 h-4" />
            Exportar PDF
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => setMode("month")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            mode === "month" ? "bg-emerald-600 text-white" : "bg-slate-900 text-slate-300 border border-slate-600"
          }`}
        >
          Reporte mensual
        </button>
        <button
          type="button"
          onClick={() => setMode("day")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            mode === "day" ? "bg-emerald-600 text-white" : "bg-slate-900 text-slate-300 border border-slate-600"
          }`}
        >
          Salidas del día
        </button>
        <button
          type="button"
          onClick={() => setMode("entries")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            mode === "entries" ? "bg-emerald-600 text-white" : "bg-slate-900 text-slate-300 border border-slate-600"
          }`}
        >
          Entradas del día
        </button>
      </div>

      {mode === "day" || mode === "entries" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Día</label>
            <input
              type="date"
              value={dayFilters.day}
              onChange={(e) => setDayFilters((f) => ({ ...f, day: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Técnico</label>
            <select
              value={dayFilters.technicianId}
              onChange={(e) => setDayFilters((f) => ({ ...f, technicianId: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todos (día completo)</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.active ? "" : " (inactivo)"}
                </option>
              ))}
            </select>
          </div>
          <p className="md:col-span-2 text-sm text-slate-400">
            {mode === "entries"
              ? "Lista las entradas de ese día y marca en amarillo los productos cuya cantidad no coincide con las salidas."
              : "Lista todo el stock que salió ese día. Elegí un técnico para ver solo lo que retiró."}
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Mes</label>
          <input
            type="month"
            value={filters.month}
            onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Producto</label>
          <select
            value={filters.productId}
            onChange={(e) => setFilters((f) => ({ ...f, productId: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Todos</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Depósito</label>
          <select
            value={filters.warehouseId}
            onChange={(e) => setFilters((f) => ({ ...f, warehouseId: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Todos</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Tipo</label>
          <select
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Todos</option>
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
            <option value="ajuste">Ajuste</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Desde</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Hasta</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>
      )}

      <button
        onClick={mode === "day" || mode === "entries" ? fetchDayReport : fetchReport}
        disabled={loading || ((mode === "day" || mode === "entries") && !dayFilters.day)}
        className="flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium mb-6"
      >
        <Filter className="w-4 h-4" />
        {loading ? "Generando..." : "Generar reporte"}
      </button>

      {error && <p className="text-red-400 mb-6">{error}</p>}

      {mode === "entries" && dayBundle && (
        <>
          <p className="text-sm text-slate-400 mb-3">
            {dayBundle.entries.label}
            {dayBundle.entries.technicianName ? ` · ${dayBundle.entries.technicianName}` : " · Todos los técnicos"}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-sm text-slate-400">Unidades que entraron</p>
              <p className="text-xl font-bold text-emerald-400">{dayBundle.entries.totalUnidades}</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-700/50 border border-slate-600">
              <p className="text-sm text-slate-400">Movimientos</p>
              <p className="text-xl font-bold text-white">{dayBundle.entries.totalMovimientos}</p>
            </div>
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <p className="text-sm text-slate-400">Productos con diferencia</p>
              <p className="text-xl font-bold text-amber-300">
                {dayBundle.differences.filter((item) => item.diferencia !== 0).length}
              </p>
            </div>
          </div>

          <h3 className="text-lg font-medium text-white mb-3">Entradas y diferencias</h3>
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Producto</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">Entradas</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">Salidas</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">Diferencia</th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Técnicos</th>
                </tr>
              </thead>
              <tbody>
                {dayBundle.differences.map((item) => {
                  const mismatch = item.diferencia !== 0;
                  return (
                    <tr
                      key={item.productId}
                      className={`border-b border-slate-700/50 ${
                        mismatch ? "bg-amber-500/15" : "hover:bg-slate-800/30"
                      }`}
                    >
                      <td className="py-3 px-2 text-white font-medium">
                        {item.productName}
                        {mismatch && (
                          <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-300">
                            Difiere
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right text-emerald-400">{item.entradas}</td>
                      <td className="py-3 px-2 text-right text-red-400">{item.salidas}</td>
                      <td
                        className={`py-3 px-2 text-right font-medium ${
                          mismatch ? "text-amber-300" : "text-slate-400"
                        }`}
                      >
                        {formatDiff(item.diferencia)}
                      </td>
                      <td className="py-3 px-2 text-slate-300">
                        {item.technicians.length ? item.technicians.join(", ") : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {dayBundle.differences.length === 0 && (
              <p className="text-center text-slate-400 py-8">No hubo entradas ni salidas en ese día</p>
            )}
          </div>

          <h3 className="text-lg font-medium text-white mb-3">Detalle de entradas</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Hora</th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Producto</th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Depósito</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">Cantidad</th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Técnico</th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {dayBundle.entries.movements.map((m) => {
                  const mismatch = dayBundle.differences.some(
                    (item) => item.productId === m.product.id && item.diferencia !== 0
                  );
                  return (
                    <tr
                      key={m.id}
                      className={`border-b border-slate-700/50 ${
                        mismatch ? "bg-amber-500/15" : "hover:bg-slate-800/30"
                      }`}
                    >
                      <td className="py-3 px-2 text-slate-300">{formatTime(new Date(m.createdAt))}</td>
                      <td className="py-3 px-2 text-white">{m.product.name}</td>
                      <td className="py-3 px-2 text-slate-300">{m.warehouse.name}</td>
                      <td className="py-3 px-2 text-right font-medium text-white">{m.quantity}</td>
                      <td className="py-3 px-2 text-slate-400">{m.technician?.name || "-"}</td>
                      <td className="py-3 px-2 text-slate-400">{m.reason || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {dayBundle.entries.movements.length === 0 && (
              <p className="text-center text-slate-400 py-8">No hubo entradas en ese día</p>
            )}
          </div>
        </>
      )}

      {mode === "day" && dayReport && (
        <>
          <p className="text-sm text-slate-400 mb-3">
            {dayReport.label}
            {dayReport.technicianName ? ` · ${dayReport.technicianName}` : " · Todos los técnicos"}
          </p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-slate-400">Unidades que salieron</p>
              <p className="text-xl font-bold text-red-400">{dayReport.totalUnidades}</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-700/50 border border-slate-600">
              <p className="text-sm text-slate-400">Movimientos</p>
              <p className="text-xl font-bold text-white">{dayReport.totalMovimientos}</p>
            </div>
          </div>

          <h3 className="text-lg font-medium text-white mb-3">Stock que salió</h3>
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Producto</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">Cantidad</th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Técnicos</th>
                </tr>
              </thead>
              <tbody>
                {dayReport.items.map((item) => (
                  <tr key={item.productId} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                    <td className="py-3 px-2 text-white font-medium">{item.productName}</td>
                    <td className="py-3 px-2 text-right text-red-400 font-medium">{item.quantity}</td>
                    <td className="py-3 px-2 text-slate-300">
                      {item.technicians.length ? item.technicians.join(", ") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dayReport.items.length === 0 && (
              <p className="text-center text-slate-400 py-8">No hubo salidas en ese día</p>
            )}
          </div>

          <h3 className="text-lg font-medium text-white mb-3">Detalle</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Hora</th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Producto</th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Depósito</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">Cantidad</th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Técnico</th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {dayReport.movements.map((m) => (
                  <tr key={m.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                    <td className="py-3 px-2 text-slate-300">{formatTime(new Date(m.createdAt))}</td>
                    <td className="py-3 px-2 text-white">{m.product.name}</td>
                    <td className="py-3 px-2 text-slate-300">{m.warehouse.name}</td>
                    <td className="py-3 px-2 text-right font-medium text-white">{m.quantity}</td>
                    <td className="py-3 px-2 text-slate-400">{m.technician?.name || "-"}</td>
                    <td className="py-3 px-2 text-slate-400">{m.reason || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {mode === "month" && report && (
        <>
          {report.monthStock ? (
            <div className="mb-8">
              <p className="text-sm text-slate-400 mb-3">{report.monthStock.label}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm text-slate-400">Stock inicial</p>
                  <p className="text-xl font-bold text-blue-400">{report.monthStock.stockInicial}</p>
                </div>
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-sm text-slate-400">Entradas</p>
                  <p className="text-xl font-bold text-emerald-400">{report.monthStock.entradas}</p>
                </div>
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-slate-400">Salidas</p>
                  <p className="text-xl font-bold text-red-400">{report.monthStock.salidas}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                  <p className="text-sm text-slate-400">Stock final</p>
                  <p className="text-xl font-bold text-white">{report.monthStock.stockFinal}</p>
                </div>
              </div>

              <h3 className="text-lg font-medium text-white mb-3">Detalle por producto</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="text-left py-3 px-2 text-slate-400 font-medium">Producto</th>
                      <th className="text-right py-3 px-2 text-slate-400 font-medium">Stock inicial</th>
                      <th className="text-right py-3 px-2 text-slate-400 font-medium">Entradas</th>
                      <th className="text-right py-3 px-2 text-slate-400 font-medium">Salidas</th>
                      <th className="text-right py-3 px-2 text-slate-400 font-medium">Stock final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.monthStock.items.map((item) => (
                      <tr key={item.productId} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                        <td className="py-3 px-2 text-white font-medium">{item.productName}</td>
                        <td className="py-3 px-2 text-right text-blue-400">{item.stockInicial}</td>
                        <td className="py-3 px-2 text-right text-emerald-400">{item.entradas}</td>
                        <td className="py-3 px-2 text-right text-red-400">{item.salidas}</td>
                        <td className="py-3 px-2 text-right text-white font-medium">{item.stockFinal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {report.monthStock.items.length === 0 && (
                  <p className="text-center text-slate-400 py-8">No hay stock para el mes seleccionado</p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-sm text-slate-400">Entradas</p>
                <p className="text-xl font-bold text-emerald-400">{report.summary.totalEntradas}</p>
              </div>
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-slate-400">Salidas</p>
                <p className="text-xl font-bold text-red-400">{report.summary.totalSalidas}</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                <p className="text-sm text-slate-400">Total movimientos</p>
                <p className="text-xl font-bold text-white">{report.summary.totalMovimientos}</p>
              </div>
            </div>
          )}

          <h3 className="text-lg font-medium text-white mb-3">Detalle de movimientos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Fecha</th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Producto</th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Depósito</th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Tipo</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">Cantidad</th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Técnico</th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {report.movements.map((m) => (
                  <tr key={m.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                    <td className="py-3 px-2 text-slate-300">
                      {formatDate(new Date(m.createdAt))}
                    </td>
                    <td className="py-3 px-2 text-white">{m.product.name}</td>
                    <td className="py-3 px-2 text-slate-300">{m.warehouse.name}</td>
                    <td className="py-3 px-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          m.type === "entrada"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : m.type === "salida"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        {m.type}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right font-medium text-white">{m.quantity}</td>
                    <td className="py-3 px-2 text-slate-400">{m.technician?.name || "-"}</td>
                    <td className="py-3 px-2 text-slate-400">{m.reason || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.movements.length === 0 && (
              <p className="text-center text-slate-400 py-12">No hay movimientos con los filtros seleccionados</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
