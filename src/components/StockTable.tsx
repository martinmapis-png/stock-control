"use client";

import { useState, useEffect } from "react";
import { Search, Package, Pencil, Plus, Trash2 } from "lucide-react";

interface Warehouse {
  id: string;
  name: string;
}

interface StockTableProps {
  /** Llamado tras sumar unidades desde esta tabla (p. ej. refrescar dashboard). */
  onInventoryChanged?: () => void;
  /** Administrador: puede eliminar productos (y su stock / movimientos). */
  isAdmin?: boolean;
  /** Id del usuario en sesión; requerido para autorizar el borrado en el servidor. */
  actingUserId?: string | null;
}

interface ProductWithStock {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  lowStockThreshold: number | null;
  stock: { quantity: number; warehouse: { name: string } }[];
}

export function StockTable({ onInventoryChanged, isAdmin, actingUserId }: StockTableProps) {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [search, setSearch] = useState("");
  const [editingThreshold, setEditingThreshold] = useState<string | null>(null);
  const [thresholdValue, setThresholdValue] = useState("");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [quickAddFor, setQuickAddFor] = useState<{ id: string; name: string } | null>(null);
  const [quickWarehouseId, setQuickWarehouseId] = useState("");
  const [quickQty, setQuickQty] = useState("1");
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canDeleteProducts = Boolean(isAdmin && actingUserId);

  const fetchProducts = () => {
    const url = search ? `/api/products?search=${encodeURIComponent(search)}` : "/api/products";
    fetch(url)
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []));
  };

  useEffect(() => {
    fetchProducts();
  }, [search]);

  useEffect(() => {
    fetch("/api/warehouses")
      .then((r) => r.json())
      .then((data) => setWarehouses(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    if (!quickAddFor || warehouses.length === 0) return;
    setQuickWarehouseId((current) =>
      current && warehouses.some((w) => w.id === current) ? current : warehouses[0].id
    );
  }, [quickAddFor, warehouses]);

  const submitQuickAdd = async () => {
    if (!quickAddFor) return;
    if (!quickWarehouseId) {
      setQuickError("Elegí un depósito");
      return;
    }
    const q = parseInt(quickQty, 10);
    if (isNaN(q) || q < 1) {
      setQuickError("La cantidad debe ser al menos 1");
      return;
    }
    setQuickError(null);
    setQuickLoading(true);
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: quickAddFor.id,
          warehouseId: quickWarehouseId,
          type: "entrada",
          quantity: q,
          reason: "Entrada desde inventario (productos)",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Error al sumar unidades");
      }
      setQuickAddFor(null);
      setQuickQty("1");
      fetchProducts();
      onInventoryChanged?.();
    } catch (e) {
      setQuickError(e instanceof Error ? e.message : "Error");
    } finally {
      setQuickLoading(false);
    }
  };

  const handleDeleteProduct = async (p: ProductWithStock) => {
    if (!actingUserId) return;
    const ok = window.confirm(
      `¿Eliminar el producto «${p.name}»?\n\nSe borrarán sus existencias en depósitos y el historial de movimientos. No se puede deshacer.`
    );
    if (!ok) return;
    setDeleteError(null);
    if (quickAddFor?.id === p.id) {
      setQuickAddFor(null);
      setQuickError(null);
    }
    setDeletingId(p.id);
    try {
      const res = await fetch(`/api/products/${p.id}`, {
        method: "DELETE",
        headers: { "X-Acting-User-Id": actingUserId },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "No se pudo eliminar");
      }
      fetchProducts();
      onInventoryChanged?.();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveThreshold = async (productId: string) => {
    const val = thresholdValue.trim() === "" ? null : parseInt(thresholdValue, 10);
    if (thresholdValue.trim() !== "" && (isNaN(val as number) || (val as number) < 0)) return;
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lowStockThreshold: val }),
      });
      if (res.ok) {
        setEditingThreshold(null);
        fetchProducts();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Package className="w-5 h-5" />
          Inventario
        </h2>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, SKU o código..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {canDeleteProducts && (
        <p className="text-xs text-slate-500 mb-3">
          Como administrador podés eliminar productos con el ícono de papelera. El stock y los movimientos de ese producto se borran junto con la ficha.
        </p>
      )}

      {deleteError && (
        <div className="mb-3 p-3 rounded-lg bg-red-500/15 text-red-400 text-sm">{deleteError}</div>
      )}

      {quickAddFor && (
        <div className="mb-4 rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-4 space-y-3">
          <p className="text-sm text-slate-200">
            <span className="text-emerald-400 font-medium">Sumar unidades</span> —{" "}
            <span className="font-semibold text-white">{quickAddFor.name}</span>
          </p>
          <p className="text-xs text-slate-500">
            Se registra una <strong className="text-slate-400">entrada</strong> en el depósito elegido (suma al stock actual).
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Depósito</label>
              <select
                value={quickWarehouseId}
                onChange={(e) => setQuickWarehouseId(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm min-w-[10rem]"
              >
                {warehouses.length === 0 ? (
                  <option value="">Sin depósitos</option>
                ) : (
                  warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Cantidad</label>
              <input
                type="number"
                min={1}
                value={quickQty}
                onChange={(e) => setQuickQty(e.target.value)}
                className="w-24 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
              />
            </div>
            <button
              type="button"
              onClick={submitQuickAdd}
              disabled={quickLoading || warehouses.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {quickLoading ? "Guardando…" : "Registrar entrada"}
            </button>
            <button
              type="button"
              onClick={() => {
                setQuickAddFor(null);
                setQuickError(null);
                setQuickQty("1");
              }}
              className="px-3 py-2 text-sm text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
          </div>
          {quickError && <p className="text-sm text-red-400">{quickError}</p>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-600">
              <th className="text-left py-3 px-2 text-slate-400 font-medium">Producto</th>
              <th className="text-left py-3 px-2 text-slate-400 font-medium">SKU / Código</th>
              <th className="text-left py-3 px-2 text-slate-400 font-medium">Stock por depósito</th>
              <th className="text-right py-3 px-2 text-slate-400 font-medium">Total</th>
              <th className="text-center py-3 px-2 text-slate-400 font-medium">Sumar unidades</th>
              {canDeleteProducts && (
                <th className="text-center py-3 px-2 text-slate-400 font-medium w-14">Eliminar</th>
              )}
              <th className="text-center py-3 px-2 text-slate-400 font-medium">Avisar bajo</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const total = p.stock.reduce((s, st) => s + st.quantity, 0);
              const isEditing = editingThreshold === p.id;
              return (
                <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                  <td className="py-3 px-2 text-white font-medium">{p.name}</td>
                  <td className="py-3 px-2 text-slate-400">
                    {[p.sku, p.barcode].filter(Boolean).join(" / ") || "-"}
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex flex-wrap gap-2">
                      {p.stock
                        .filter((s) => s.quantity > 0)
                        .map((s) => (
                          <span
                            key={s.warehouse.name}
                            className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-xs"
                          >
                            {s.warehouse.name}: {s.quantity}
                          </span>
                        ))}
                      {p.stock.every((s) => s.quantity === 0) && (
                        <span className="text-slate-500">Sin stock</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right font-semibold text-emerald-400">{total}</td>
                  <td className="py-3 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setQuickAddFor({ id: p.id, name: p.name });
                        setQuickError(null);
                        setQuickQty("1");
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/35 border border-emerald-700/40"
                      title="Registrar entrada de stock para este producto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Sumar
                    </button>
                  </td>
                  {canDeleteProducts && (
                    <td className="py-3 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(p)}
                        disabled={deletingId === p.id}
                        className="inline-flex items-center justify-center p-2 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-950/40 disabled:opacity-40"
                        title="Eliminar producto (solo admin)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                  <td className="py-3 px-2 text-center">
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min={0}
                          value={thresholdValue}
                          onChange={(e) => setThresholdValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveThreshold(p.id);
                            if (e.key === "Escape") {
                              setEditingThreshold(null);
                              setThresholdValue("");
                            }
                          }}
                          className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-600 text-white text-sm"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveThreshold(p.id)}
                          className="text-emerald-400 hover:text-emerald-300 text-sm"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => {
                            setEditingThreshold(null);
                            setThresholdValue("");
                          }}
                          className="text-slate-400 hover:text-white text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingThreshold(p.id);
                          setThresholdValue(p.lowStockThreshold?.toString() ?? "");
                        }}
                        className="flex items-center gap-1 mx-auto px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-slate-700"
                        title="Editar umbral de stock bajo"
                      >
                        {p.lowStockThreshold !== null ? (
                          <>≤{p.lowStockThreshold}</>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {products.length === 0 && (
          <p className="text-center text-slate-400 py-12">No hay productos. Agrega uno para empezar.</p>
        )}
      </div>
    </div>
  );
}
