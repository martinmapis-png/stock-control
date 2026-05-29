"use client";

import { useState, useEffect } from "react";
import { Package, Warehouse, TrendingDown, User, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ProductTotal {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  total: number;
  lowStockThreshold: number | null;
}

interface DashboardData {
  totalProducts: number;
  totalWarehouses: number;
  productsWithTotal: ProductTotal[];
  lowStock: { product: string; total: number; threshold: number; warehouses: string }[];
  stockByWarehouse: { name: string; total: number }[];
  retirosPorTecnico: {
    technicianId: string;
    name: string;
    total: number;
    count: number;
    devoluciones?: number;
  }[];
}

interface RetiroDetalle {
  id: string;
  type: "salida" | "entrada";
  productName: string;
  quantity: number;
  warehouseName: string;
  reason: string | null;
  notes: string | null;
  createdAt: string;
}

function formatRetiroFecha(iso: string) {
  const d = new Date(iso);
  return {
    fecha: d.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    hora: d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retirosModal, setRetirosModal] = useState<{
    technicianId: string;
    name: string;
  } | null>(null);
  const [retirosDetalle, setRetirosDetalle] = useState<RetiroDetalle[]>([]);
  const [retirosLoading, setRetirosLoading] = useState(false);
  const [retirosError, setRetirosError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, warehousesRes, dashboardRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/warehouses"),
          fetch("/api/dashboard"),
        ]);

        if (!productsRes.ok || !warehousesRes.ok) {
          throw new Error("Error al conectar con el servidor. Verifica que la base de datos esté configurada.");
        }

        const products = await productsRes.json();
        const warehouses = await warehousesRes.json();
        const dashboardData = await dashboardRes.json();

        if (products?.error || warehouses?.error) {
          throw new Error(products?.error || warehouses?.error || "Error en el servidor");
        }

        const retirosPorTecnico = Array.isArray(dashboardData?.retirosPorTecnico)
          ? dashboardData.retirosPorTecnico
          : [];

        const productsList = Array.isArray(products) ? products : [];
        const warehousesList = Array.isArray(warehouses) ? warehouses : [];

        const productsWithTotal: ProductTotal[] = productsList.map(
          (p: { id: string; name: string; sku: string | null; barcode: string | null; lowStockThreshold?: number | null; stock?: { quantity: number; warehouse?: { name: string } }[] }) => {
            const stockList = p.stock || [];
            const total = stockList.reduce((s: number, st: { quantity: number }) => s + st.quantity, 0);
            return {
              id: p.id,
              name: p.name,
              sku: p.sku,
              barcode: p.barcode,
              total,
              lowStockThreshold: p.lowStockThreshold ?? null,
            };
          }
        );

        const lowStock: { product: string; total: number; threshold: number; warehouses: string }[] = [];
        const stockByWarehouse: { name: string; total: number }[] = [];

        warehousesList.forEach((w: { id: string; name: string; stock?: { quantity: number }[] }) => {
          const stockList = w.stock || [];
          const whTotal = stockList.reduce((s: number, st: { quantity: number }) => s + st.quantity, 0);
          stockByWarehouse.push({ name: w.name, total: whTotal });
        });

        productsList.forEach((p: { name: string; lowStockThreshold?: number | null; stock?: { quantity: number; warehouse: { name: string } }[] }) => {
          const threshold = p.lowStockThreshold;
          if (threshold == null) return;
          const stockList = p.stock || [];
          const total = stockList.reduce((s: number, st: { quantity: number }) => s + st.quantity, 0);
          if (total <= threshold) {
            const warehouses = stockList
              .filter((st: { quantity: number }) => st.quantity > 0)
              .map((st: { warehouse: { name: string } }) => st.warehouse.name)
              .join(", ") || "Sin stock";
            lowStock.push({
              product: p.name,
              total,
              threshold,
              warehouses,
            });
          }
        });

        setData({
          totalProducts: productsList.length,
          totalWarehouses: warehousesList.length,
          productsWithTotal,
          lowStock: lowStock.slice(0, 5),
          stockByWarehouse,
          retirosPorTecnico,
        });
      } catch (err) {
        console.error("Dashboard error:", err);
        setError(err instanceof Error ? err.message : "Error al cargar los datos");
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!retirosModal) {
      setRetirosDetalle([]);
      setRetirosError(null);
      return;
    }
    setRetirosLoading(true);
    setRetirosError(null);
    fetch(`/api/dashboard/technician-retiros/${retirosModal.technicianId}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Error al cargar retiros");
        setRetirosDetalle(Array.isArray(j.items) ? j.items : []);
      })
      .catch((e) => {
        setRetirosDetalle([]);
        setRetirosError(e instanceof Error ? e.message : "Error");
      })
      .finally(() => setRetirosLoading(false));
  }, [retirosModal]);

  if (error) {
    return (
      <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/30">
        <p className="text-red-400 font-medium mb-2">No se pudo cargar stock actual</p>
        <p className="text-slate-400 text-sm mb-4">{error}</p>
        <p className="text-slate-500 text-sm">
          Ejecuta en la carpeta del proyecto: <code className="bg-slate-800 px-2 py-1 rounded">npx prisma db push</code> y luego <code className="bg-slate-800 px-2 py-1 rounded">npm run db:seed</code>
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-emerald-500/20">
              <Package className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Productos</p>
              <p className="text-2xl font-bold text-white">{data.totalProducts}</p>
            </div>
          </div>
        </div>
        <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-blue-500/20">
              <Warehouse className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Depósitos</p>
              <p className="text-2xl font-bold text-white">{data.totalWarehouses}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">Todos los productos con stock actual</h3>
        {data.productsWithTotal.length > 0 ? (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600 sticky top-0 bg-slate-800/95">
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Producto</th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">SKU / Código</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.productsWithTotal.map((p) => (
                  <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                    <td className="py-3 px-2 text-white font-medium">{p.name}</td>
                    <td className="py-3 px-2 text-slate-400">
                      {[p.sku, p.barcode].filter(Boolean).join(" / ") || "-"}
                    </td>
                    <td className="py-3 px-2 text-right font-semibold text-emerald-400">{p.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-400 text-center py-12">No hay productos registrados</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            Retiros por técnico
          </h3>
          <p className="text-slate-500 text-sm mb-4">
            Unidades que cada técnico tiene en su poder (retiros menos devoluciones al depósito). Tocá un técnico para ver el detalle.
          </p>
          {data.retirosPorTecnico.length > 0 ? (
            <ul className="space-y-2">
              {data.retirosPorTecnico.map((t) => {
                const retirosLabel = t.count === 1 ? "1 retiro" : `${t.count} retiros`;
                const devLabel =
                  (t.devoluciones ?? 0) > 0
                    ? ` · ${t.devoluciones} devolución${t.devoluciones === 1 ? "" : "es"}`
                    : "";
                return (
                  <li key={t.technicianId}>
                    <button
                      type="button"
                      onClick={() =>
                        setRetirosModal({ technicianId: t.technicianId, name: t.name })
                      }
                      className="w-full flex justify-between items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-left hover:bg-blue-500/15 hover:border-blue-400/35 transition-colors cursor-pointer"
                    >
                      <span className="text-white font-medium">{t.name}</span>
                      <span className="text-blue-400 font-semibold shrink-0 text-right text-sm">
                        {t.total} u. en poder
                        <span className="block text-xs font-normal text-slate-400">
                          {retirosLabel}
                          {devLabel}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-slate-400 text-center py-12">No hay retiros registrados por técnicos</p>
          )}
        </div>

        <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white mb-4">Stock por depósito</h3>
          {data.stockByWarehouse.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.stockByWarehouse}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155" }}
                    labelStyle={{ color: "#f8fafc" }}
                  />
                  <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-slate-400 text-center py-12">Sin datos de stock</p>
          )}
        </div>
      </div>

      {retirosModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="retiros-modal-title"
          onClick={() => setRetirosModal(null)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col rounded-xl border border-slate-600 bg-slate-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-700">
              <div>
                <h2 id="retiros-modal-title" className="text-lg font-semibold text-white">
                  Movimientos — {retirosModal.name}
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Salidas al técnico y entradas devueltas al depósito.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRetirosModal(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 flex-1">
              {retirosLoading && (
                <p className="text-slate-400 text-center py-8">Cargando…</p>
              )}
              {retirosError && (
                <p className="text-red-400 text-sm text-center py-6">{retirosError}</p>
              )}
              {!retirosLoading && !retirosError && retirosDetalle.length === 0 && (
                <p className="text-slate-400 text-center py-8">Sin movimientos para este técnico.</p>
              )}
              {!retirosLoading && retirosDetalle.length > 0 && (
                <ul className="space-y-3">
                  {retirosDetalle.map((item) => {
                    const { fecha, hora } = formatRetiroFecha(item.createdAt);
                    const descripcion = [item.reason, item.notes].filter(Boolean).join(" · ") || null;
                    return (
                      <li
                        key={item.id}
                        className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 text-sm"
                      >
                        <p className="font-medium text-white flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              item.type === "salida"
                                ? "bg-red-500/20 text-red-400"
                                : "bg-emerald-500/20 text-emerald-400"
                            }`}
                          >
                            {item.type === "salida" ? "Salida" : "Devolución"}
                          </span>
                          {item.productName}{" "}
                          <span
                            className={
                              item.type === "salida" ? "text-blue-400" : "text-emerald-400"
                            }
                          >
                            ×{item.quantity}
                          </span>
                        </p>
                        <p className="text-slate-400 mt-1">
                          Depósito: <span className="text-slate-300">{item.warehouseName}</span>
                        </p>
                        <p className="text-slate-500 mt-2 text-xs">{fecha}</p>
                        <p className="text-slate-400 text-xs">Horario: {hora}</p>
                        {descripcion && (
                          <p className="text-slate-500 mt-2 text-xs border-t border-slate-700/80 pt-2">
                            {descripcion}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-amber-400" />
            Stock bajo
          </h3>
          <p className="text-slate-400 text-sm mb-4">
            Productos con umbral configurado cuyo stock total está en o por debajo del límite.
          </p>
          {data.lowStock.length > 0 ? (
            <ul className="space-y-2">
              {data.lowStock.map((item, i) => (
                <li
                  key={i}
                  className="flex justify-between items-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
                >
                  <span className="text-white font-medium">{item.product}</span>
                  <span className="text-amber-400 font-semibold text-right">
                    {item.total} / ≤{item.threshold}
                    <span className="block text-xs text-slate-400 font-normal">{item.warehouses}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-400 text-center py-12">No hay productos con stock bajo según su umbral configurado</p>
          )}
        </div>
      </div>
    </div>
  );
}
