"use client";

import { useState, useEffect } from "react";
import { Wrench, Plus, Pencil, Trash2, X, Check } from "lucide-react";

interface Technician {
  id: string;
  name: string;
  active: boolean;
}

export function TechnicianManager() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const fetchTechnicians = () => {
    fetch(`/api/technicians?active=${showInactive ? "false" : "true"}`)
      .then((r) => r.json())
      .then(setTechnicians);
  };

  useEffect(() => {
    fetchTechnicians();
  }, [showInactive]);

  const resetForm = () => {
    setFormName("");
    setShowForm(false);
    setEditingId(null);
    setError(null);
  };

  const handleEdit = (t: Technician) => {
    setEditingId(t.id);
    setFormName(t.name);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const url = editingId ? `/api/technicians/${editingId}` : "/api/technicians";
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { name: formName } : { name: formName };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");

      fetchTechnicians();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Desactivar este técnico? No aparecerá en el listado de salidas.")) return;
    try {
      const res = await fetch(`/api/technicians/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al desactivar");
      }
      fetchTechnicians();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Wrench className="w-5 h-5" />
          Técnicos
        </h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-600 bg-slate-900 text-emerald-600"
            />
            Ver inactivos
          </label>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          >
            <Plus className="w-4 h-4" />
            Nuevo técnico
          </button>
        </div>
      </div>

      <p className="text-slate-400 text-sm mb-4">
        Listado de técnicos para asignar a las salidas. No necesitan tener usuario en el sistema.
      </p>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 p-4 rounded-lg bg-slate-900/50 border border-slate-700 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-white">
              {editingId ? "Editar técnico" : "Nuevo técnico"}
            </h3>
            <button type="button" onClick={resetForm} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nombre *</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">{error}</div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium"
            >
              <Check className="w-4 h-4" />
              {loading ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {technicians.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No hay técnicos. Agrega uno para asignar a las salidas.</p>
        ) : (
          technicians.map((t) => (
            <div
              key={t.id}
              className={`p-4 rounded-lg border flex items-center justify-between ${
                t.active ? "bg-slate-900/50 border-slate-700" : "bg-slate-900/30 border-slate-800 opacity-60"
              }`}
            >
              <p className="font-medium text-white">
                {t.name}
                {!t.active && <span className="ml-2 text-xs text-amber-400">(inactivo)</span>}
              </p>
              {t.active && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(t)}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400"
                    title="Desactivar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
