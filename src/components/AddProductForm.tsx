"use client";

import { useState, useEffect } from "react";
import { Camera, Plus } from "lucide-react";
import { Scanner } from "./Scanner";

interface Warehouse {
  id: string;
  name: string;
}

interface AddProductFormProps {
  onProductAdded: () => void;
  onProductFound?: (product: { id: string; name: string }) => void;
}

export function AddProductForm({ onProductAdded, onProductFound }: AddProductFormProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [mode, setMode] = useState<"new" | "add">("new");
  const [form, setForm] = useState({
    name: "",
    sku: "",
    barcode: "",
    description: "",
    lowStockThreshold: "",
    initialWarehouseId: "",
    initialQuantity: "",
  });
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/warehouses")
      .then((r) => r.json())
      .then((data) => setWarehouses(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    if (warehouses.length === 1) {
      setForm((f) => ({ ...f, initialWarehouseId: warehouses[0].id }));
    } else if (warehouses.length === 0) {
      setForm((f) => ({ ...f, initialWarehouseId: "" }));
    } else {
      setForm((f) => {
        if (!f.initialWarehouseId) return f;
        const exists = warehouses.some((w) => w.id === f.initialWarehouseId);
        return exists ? f : { ...f, initialWarehouseId: "" };
      });
    }
  }, [warehouses]);

  const handleScan = async (code: string) => {
    setShowScanner(false);
    setForm((f) => ({ ...f, barcode: code }));

    try {
      const res = await fetch(`/api/products?barcode=${encodeURIComponent(code)}`);
      const product = await res.json();
      if (product?.id) {
        onProductFound?.(product);
      } else {
        setMode("new");
        setForm((f) => ({ ...f, name: "", barcode: code }));
      }
    } catch {
      setMode("new");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const iq = parseInt(form.initialQuantity.trim(), 10);
    if (!isNaN(iq) && iq > 0 && !form.initialWarehouseId.trim()) {
      setError("Para cargar unidades iniciales elegí un depósito");
      return;
    }
    setLoading(true);

    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        barcode: form.barcode,
        description: form.description,
        lowStockThreshold: form.lowStockThreshold,
        initialWarehouseId: form.initialWarehouseId.trim() || undefined,
        initialQuantity: form.initialQuantity.trim() || undefined,
      };

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear producto");
      }

      const product = await res.json();
      onProductAdded();
      onProductFound?.(product);
      setForm({
        name: "",
        sku: "",
        barcode: "",
        description: "",
        lowStockThreshold: "",
        initialWarehouseId: warehouses.length === 1 ? warehouses[0].id : "",
        initialQuantity: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Agregar producto</h2>
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
        >
          <Camera className="w-4 h-4" />
          Escanear
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-400 rounded-lg bg-slate-900/50 border border-slate-700/60 px-3 py-2">
          <span className="text-emerald-400 font-medium">Stock:</span> podés cargar unidades al crear el producto (abajo) o sumar después con{" "}
          <span className="text-slate-300">Sumar unidades</span> en la tabla de inventario, o en la pestaña{" "}
          <span className="text-slate-300">Movimientos</span> con una entrada.
        </p>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Nombre *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nombre del producto"
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">SKU</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              placeholder="Código SKU"
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Código de barras</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.barcode}
                onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                placeholder="Usa la pistola aquí o escanea con cámara"
                className="flex-1 px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Descripción</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Descripción opcional"
            rows={2}
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 resize-none"
          />
        </div>
        <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-emerald-200">Cantidad inicial (opcional)</h3>
          <p className="text-xs text-slate-500">
            {warehouses.length === 1 ? (
              <>
                Si completás la cantidad, se registra una <strong className="text-slate-400">entrada</strong> en{" "}
                <span className="text-slate-400">{warehouses[0].name}</span> al guardar el producto.
              </>
            ) : (
              <>
                Si completás depósito y cantidad, se registra una <strong className="text-slate-400">entrada</strong> al
                guardar el producto.
              </>
            )}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Depósito</label>
              {warehouses.length === 1 ? (
                <div className="w-full px-4 py-2 rounded-lg bg-slate-900/80 border border-slate-600 text-slate-200">
                  <p className="font-medium text-white">{warehouses[0].name}</p>
                  <p className="text-xs text-slate-500 mt-1">Único depósito cargado; se usa automáticamente.</p>
                </div>
              ) : (
                <>
                  <select
                    value={form.initialWarehouseId}
                    onChange={(e) => setForm((f) => ({ ...f, initialWarehouseId: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Sin stock inicial</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                  {warehouses.length === 0 && (
                    <p className="text-xs text-amber-400 mt-1">No hay depósitos. Creá uno en la pestaña Depósitos.</p>
                  )}
                </>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Unidades a ingresar</label>
              <input
                type="number"
                min={1}
                value={form.initialQuantity}
                onChange={(e) => setForm((f) => ({ ...f, initialQuantity: e.target.value }))}
                placeholder="Ej: 24"
                className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Avisar stock bajo cuando queden (unidades)
          </label>
          <input
            type="number"
            min={0}
            value={form.lowStockThreshold}
            onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: e.target.value }))}
            placeholder="Ej: 5 (vacío = no avisar)"
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Se mostrará alerta en el dashboard cuando el stock total sea menor o igual a este valor. Dejar vacío para no avisar.
          </p>
        </div>
        {error && (
          <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">{error}</div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {loading ? "Guardando..." : "Crear producto"}
        </button>
      </form>

      {showScanner && <Scanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
    </div>
  );
}
