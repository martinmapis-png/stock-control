"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Filter } from "lucide-react";
function formatDate(date: Date) {
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Movement {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  createdAt: string;
  product: { name: string };
  warehouse: { name: string };
  technician?: { id: string; name: string } | null;
}

interface ReportData {
  movements: Movement[];
  summary: { totalEntradas: number; totalSalidas: number; totalMovimientos: number };
}

export function Reports() {
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState({
    productId: "",
    warehouseId: "",
    type: "",
    dateFrom: "",
    dateTo: "",
  });
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/products").then((r) => r.json()).then((p) => setProducts(p));
    fetch("/api/warehouses").then((r) => r.json()).then((w) => setWarehouses(w));
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.productId) params.set("productId", filters.productId);
    if (filters.warehouseId) params.set("warehouseId", filters.warehouseId);
    if (filters.type) params.set("type", filters.type);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);

    const res = await fetch(`/api/reports?${params}`);
    const data = await res.json();
    setReport(data);
    setLoading(false);
  };

  const exportCSV = () => {
    if (!report?.movements.length) return;
    const headers = ["Fecha", "Producto", "Depósito", "Tipo", "Cantidad", "Técnico", "Motivo"];
    const rows = report.movements.map((m) => [
      formatDate(new Date(m.createdAt)),
      m.product.name,
      m.warehouse.name,
      m.type,
      m.quantity,
      m.technician?.name || "",
      m.reason || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-stock-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Reportes
        </h2>
        <button
          onClick={exportCSV}
          disabled={!report?.movements.length}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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

      <button
        onClick={fetchReport}
        disabled={loading}
        className="flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium mb-6"
      >
        <Filter className="w-4 h-4" />
        {loading ? "Generando..." : "Generar reporte"}
      </button>

      {report && (
        <>
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
