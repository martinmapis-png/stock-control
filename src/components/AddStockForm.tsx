"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Camera, Package, Search, Plus, Trash2 } from "lucide-react";
import { Scanner } from "./Scanner";
import { useAuth } from "@/contexts/AuthContext";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
}

interface Warehouse {
  id: string;
  name: string;
}

interface Technician {
  id: string;
  name: string;
}

interface AddStockFormProps {
  onStockUpdated: () => void;
}

interface StockLine {
  productId: string;
  name: string;
  quantity: number;
}

export function AddStockForm({ onStockUpdated }: AddStockFormProps) {
  const { user } = useAuth();
  const [showScanner, setShowScanner] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [productListFilter, setProductListFilter] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [type, setType] = useState<"entrada" | "salida" | "ajuste">("entrada");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [lines, setLines] = useState<StockLine[]>([]);

  useEffect(() => {
    fetch("/api/warehouses").then((r) => r.json()).then(setWarehouses);
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []));
    fetch("/api/technicians").then((r) => r.json()).then(setTechnicians);
  }, []);

  useEffect(() => {
    if (warehouses.length === 1) {
      setWarehouseId(warehouses[0].id);
    } else if (warehouses.length === 0) {
      setWarehouseId("");
    } else {
      setWarehouseId((id) => (!id || warehouses.some((w) => w.id === id) ? id : ""));
    }
  }, [warehouses]);

  const filteredProducts = useMemo(() => {
    const q = productListFilter.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const name = p.name.toLowerCase();
      const sku = (p.sku ?? "").toLowerCase();
      const barcode = p.barcode ?? "";
      return name.includes(q) || sku.includes(q) || barcode.includes(q);
    });
  }, [products, productListFilter]);

  const productsForSelect = useMemo(() => {
    if (!selectedProduct) return filteredProducts;
    const inFiltered = filteredProducts.some((p) => p.id === selectedProduct.id);
    if (inFiltered) return filteredProducts;
    return [selectedProduct, ...filteredProducts];
  }, [filteredProducts, selectedProduct]);

  const bumpQuantity = (delta: number) => {
    const cur = parseInt(quantity, 10);
    const base = isNaN(cur) || cur < 1 ? 0 : cur;
    setQuantity(String(Math.max(1, base + delta)));
  };

  const addLineToList = () => {
    if (!selectedProduct) {
      setError("Seleccioná un producto para agregar a la lista");
      return;
    }
    if (!warehouseId) {
      setError("Seleccioná el depósito primero");
      return;
    }
    if (type === "salida" && !technicianId) {
      setError("Las salidas requieren técnico responsable antes de armar la lista");
      return;
    }
    const q = parseInt(quantity, 10);
    if (isNaN(q) || q < 1) {
      setError("La cantidad debe ser al menos 1");
      return;
    }
    setError(null);
    setLines((prev) => {
      const i = prev.findIndex((l) => l.productId === selectedProduct.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + q };
        return next;
      }
      return [...prev, { productId: selectedProduct.id, name: selectedProduct.name, quantity: q }];
    });
    setSelectedProduct(null);
    setQuantity("1");
    setProductListFilter("");
    barcodeInputRef.current?.focus();
  };

  const removeLine = (productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  };

  const setLineQuantity = (productId: string, value: string) => {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1) return;
    setLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, quantity: n } : l))
    );
  };

  const handleScan = async (code: string) => {
    setShowScanner(false);
    try {
      const res = await fetch(`/api/products?barcode=${encodeURIComponent(code)}`);
      const product = await res.json();
      if (product?.id) {
        setSelectedProduct(product);
        setProductListFilter("");
      }
    } catch {
      setError("Producto no encontrado. Créalo primero.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) {
      setError("Seleccioná depósito");
      return;
    }
    if (type === "salida" && !technicianId) {
      setError("Las salidas requieren seleccionar un técnico responsable");
      return;
    }

    const useBatch = lines.length > 0;

    if (useBatch) {
      setError(null);
      setLoading(true);
      try {
        const res = await fetch("/api/stock/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            warehouseId,
            type,
            reason: reason || undefined,
            technicianId: type === "salida" ? technicianId || undefined : undefined,
            lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Error al registrar movimientos");
        }
        onStockUpdated();
        setLines([]);
        setReason("");
        setTechnicianId("");
        setQuantity("1");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!selectedProduct) {
      setError("Seleccioná un producto o agregá líneas a la lista");
      return;
    }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      setError("La cantidad debe ser al menos 1");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          warehouseId,
          type,
          quantity: qty,
          reason: reason || undefined,
          technicianId: type === "salida" ? technicianId || undefined : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al registrar movimiento");
      }

      onStockUpdated();
      setSelectedProduct(null);
      setQuantity("1");
      setReason("");
      setTechnicianId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Registrar movimiento</h2>
          <p className="text-sm text-slate-400 mt-1">
            Podés cargar una cantidad grande con los atajos, agregar varios productos a la lista y registrar todo junto (útil cuando entra mercadería variada).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors"
        >
          <Camera className="w-4 h-4" />
          Escanear
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-300">1. Producto</label>
          <p className="text-xs text-slate-500 -mt-2">
            Los productos se dan de alta en la pestaña{" "}
            <span className="text-slate-400">Productos</span>
            {user?.canAddProducts ? "" : " (necesitás permiso para crear nuevos)"}. Después aparecen acá para elegir cantidad.
          </p>
          <div>
            <span className="block text-xs font-medium text-slate-400 mb-1">Código de barras (pistola o Enter)</span>
            <input
              type="text"
              ref={barcodeInputRef}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && barcodeInput.trim()) {
                  e.preventDefault();
                  const code = barcodeInput.trim();
                  setBarcodeInput("");
                  const res = await fetch(`/api/products?barcode=${encodeURIComponent(code)}`);
                  const product = await res.json();
                  if (product?.id) {
                    setSelectedProduct(product);
                    setProductListFilter("");
                  } else {
                    setError("Producto no encontrado. Créalo en la pestaña Productos.");
                  }
                }
              }}
              placeholder="Enfoca y escanea con la pistola..."
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-400 mb-1">Buscar en la lista</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={productListFilter}
                onChange={(e) => setProductListFilter(e.target.value)}
                placeholder="Nombre, SKU o código de barras..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedProduct?.id ?? ""}
              onChange={(e) => {
                const p = products.find((x) => x.id === e.target.value);
                setSelectedProduct(p ?? null);
              }}
              className="flex-1 px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500 min-w-0"
            >
              <option value="">
                {products.length === 0 ? "No hay productos — creá algunos en Productos" : "Seleccioná un producto…"}
              </option>
              {productsForSelect.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sku ? ` · SKU ${p.sku}` : ""}
                  {p.barcode ? ` · ${p.barcode}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="shrink-0 p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
              title="Escanear con cámara"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>
          {selectedProduct && (
            <p className="text-sm text-emerald-400/90">
              Seleccionado: <span className="font-medium text-white">{selectedProduct.name}</span>
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">2. Depósito</label>
          {warehouses.length === 1 ? (
            <div className="w-full px-4 py-2 rounded-lg bg-slate-900/80 border border-slate-600 text-slate-200">
              <p className="font-medium text-white">{warehouses[0].name}</p>
              <p className="text-xs text-slate-500 mt-1">Único depósito cargado; se usa automáticamente.</p>
            </div>
          ) : (
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500"
              required
            >
              <option value="">Selecciona depósito</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Tipo de movimiento</label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as "entrada" | "salida" | "ajuste");
                if (e.target.value !== "salida") setTechnicianId("");
              }}
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">3. Cantidad (unidades)</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1"
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-xs text-slate-500 self-center mr-1">Sumar:</span>
              {[10, 50, 100, 500].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => bumpQuantity(n)}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200"
                >
                  +{n}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={addLineToList}
              disabled={
                !selectedProduct ||
                !warehouseId ||
                (type === "salida" && !technicianId) ||
                !quantity ||
                parseInt(quantity, 10) < 1
              }
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:pointer-events-none text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar a la lista (varios productos)
            </button>
            <p className="text-xs text-slate-500 mt-1.5">
              Si agregás el mismo producto otra vez, se suman las unidades en la misma línea.
            </p>
          </div>
        </div>

        {lines.length > 0 && (
          <div className="rounded-lg border border-slate-600/80 bg-slate-900/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-200">
                Lista para registrar ({lines.length} {lines.length === 1 ? "línea" : "líneas"})
              </h3>
              <button
                type="button"
                onClick={() => setLines([])}
                className="text-xs text-slate-400 hover:text-red-400"
              >
                Vaciar lista
              </button>
            </div>
            <ul className="space-y-2">
              {lines.map((line) => (
                <li
                  key={line.productId}
                  className="flex flex-wrap items-center gap-2 text-sm bg-slate-800/60 rounded-lg px-3 py-2"
                >
                  <span className="text-slate-200 flex-1 min-w-[8rem]">{line.name}</span>
                  <label className="flex items-center gap-1.5 text-slate-400">
                    <span className="text-xs">Cant.</span>
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => setLineQuantity(line.productId, e.target.value)}
                      className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-600 text-white text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeLine(line.productId)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-700"
                    title="Quitar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {type === "salida" && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Técnico responsable *
            </label>
            <select
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500"
              required
            >
              <option value="">Selecciona técnico</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {technicians.length === 0 && (
              <p className="text-amber-400 text-sm mt-1">
                No hay técnicos. Agrégalos en la pestaña Técnicos.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Motivo (opcional)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Recepción de proveedor"
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={
            loading ||
            !warehouseId ||
            (type === "salida" && !technicianId) ||
            (lines.length > 0
              ? false
              : !selectedProduct || !quantity || parseInt(quantity, 10) < 1)
          }
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium transition-colors"
        >
          <Package className="w-4 h-4" />
          {loading
            ? "Registrando..."
            : lines.length > 0
              ? `Registrar ${lines.length} movimiento${lines.length === 1 ? "" : "s"}`
              : "Registrar movimiento"}
        </button>
      </form>

      {showScanner && <Scanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
    </div>
  );
}
