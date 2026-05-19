"use client";

import { useState, useEffect } from "react";
import { Warehouse, Plus, MapPin, Pencil, Trash2, X, ChevronRight } from "lucide-react";

interface WarehouseData {
  id: string;
  name: string;
  location: string | null;
  stock: { quantity: number; product: { name: string } }[];
}

export function WarehouseManager() {
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseData | null>(null);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseData | null>(null);
  const [form, setForm] = useState({ name: "", location: "" });
  const [editForm, setEditForm] = useState({ name: "", location: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWarehouses = () => {
    fetch("/api/warehouses").then((r) => r.json()).then(setWarehouses);
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const openWarehouse = (w: WarehouseData) => {
    setSelectedWarehouse(w);
    setEditingWarehouse(null);
    setEditForm({ name: w.name, location: w.location || "" });
    setError(null);
  };

  const closeWarehouse = () => {
    setSelectedWarehouse(null);
    setEditingWarehouse(null);
    setError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarehouse) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/warehouses/${editingWarehouse.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al actualizar");
      }
      const updated = await res.json();
      setSelectedWarehouse(updated);
      setEditingWarehouse(null);
      fetchWarehouses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedWarehouse) return;
    if (!confirm(`¿Eliminar el depósito "${selectedWarehouse.name}"? Se borrarán todos los movimientos y stock asociados.`)) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/warehouses/${selectedWarehouse.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al eliminar");
      }
      closeWarehouse();
      fetchWarehouses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear depósito");
      }

      fetchWarehouses();
      setForm({ name: "", location: "" });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Warehouse className="w-5 h-5" />
          Depósitos
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo depósito
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 rounded-lg bg-slate-900/50 border border-slate-700 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nombre *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Depósito Central"
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Ubicación</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Ej: Av. Principal 123"
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium"
          >
            {loading ? "Creando..." : "Crear depósito"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {warehouses.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No hay depósitos. Crea uno para empezar.</p>
        ) : (
          warehouses.map((w) => {
            const totalItems = w.stock.reduce((sum, s) => sum + s.quantity, 0);
            const productCount = w.stock.filter((s) => s.quantity > 0).length;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => openWarehouse(w)}
                className="w-full p-4 rounded-lg bg-slate-900/50 border border-slate-700 flex items-center justify-between hover:bg-slate-800/50 hover:border-slate-600 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                    <Warehouse className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{w.name}</p>
                    {w.location && (
                      <p className="text-sm text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {w.location}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-lg font-semibold text-emerald-400">{totalItems}</p>
                    <p className="text-xs text-slate-400">{productCount} productos</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500" />
                </div>
              </button>
            );
          })
        )}
      </div>

      {selectedWarehouse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !editingWarehouse && closeWarehouse()}
        >
          <div
            className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Ficha del depósito</h3>
                <button
                  onClick={closeWarehouse}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {editingWarehouse ? (
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Nombre *</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Ubicación</label>
                    <input
                      type="text"
                      value={editForm.location}
                      onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                      placeholder="Ej: Av. Principal 123"
                      className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {error && (
                    <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">{error}</div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium"
                    >
                      {loading ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingWarehouse(null)}
                      className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    <div>
                      <p className="text-sm text-slate-400">Nombre</p>
                      <p className="text-lg font-medium text-white">{selectedWarehouse.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Ubicación</p>
                      <p className="text-white">
                        {selectedWarehouse.location || (
                          <span className="text-slate-500">Sin especificar</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Stock total</p>
                      <p className="text-xl font-semibold text-emerald-400">
                        {selectedWarehouse.stock.reduce((s, st) => s + st.quantity, 0)} unidades
                      </p>
                      <p className="text-sm text-slate-400">
                        {selectedWarehouse.stock.filter((s) => s.quantity > 0).length} productos
                      </p>
                    </div>
                  </div>
                  {error && (
                    <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm mb-4">{error}</div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingWarehouse(selectedWarehouse)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
                    >
                      <Pencil className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
