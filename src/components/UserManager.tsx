"use client";

import { useState, useEffect } from "react";
import { Users, Plus, Pencil, Trash2, X, Check, Eye, EyeOff } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  canAddProducts: boolean;
  isTechnician: boolean;
  active: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  producto: "Agregar productos",
  tecnico: "Técnico",
  operador: "Operador",
};

export function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "operador",
    canAddProducts: false,
    isTechnician: false,
    active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const fetchUsers = () => {
    fetch(`/api/users?active=${showInactive ? "false" : "true"}`)
      .then((r) => r.json())
      .then(setUsers);
  };

  useEffect(() => {
    fetchUsers();
  }, [showInactive]);

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      password: "",
      role: "operador",
      canAddProducts: false,
      isTechnician: false,
      active: true,
    });
    setShowForm(false);
    setEditingId(null);
    setError(null);
  };

  const handleEdit = (u: User) => {
    setEditingId(u.id);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      canAddProducts: u.canAddProducts,
      isTechnician: u.isTechnician,
      active: u.active,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const url = editingId ? `/api/users/${editingId}` : "/api/users";
      const method = editingId ? "PUT" : "POST";
      const body: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
        canAddProducts: form.canAddProducts,
        isTechnician: form.isTechnician,
        active: editingId ? form.active : true,
      };
      if (form.password) body.password = form.password;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");

      fetchUsers();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Desactivar este usuario? No podrá iniciar sesión.")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al desactivar");
      }
      fetchUsers();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Users className="w-5 h-5" />
          Usuarios
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
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          >
            <Plus className="w-4 h-4" />
            Nuevo usuario
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 p-4 rounded-lg bg-slate-900/50 border border-slate-700 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-white">
              {editingId ? "Editar usuario" : "Nuevo usuario"}
            </h3>
            <button type="button" onClick={resetForm} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Nombre *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Juan Pérez"
                className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="juan@empresa.com"
                className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500"
                required
                disabled={!!editingId}
              />
              {editingId && (
                <p className="text-xs text-slate-500 mt-1">El email no se puede cambiar</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Contraseña {editingId ? "(dejar vacío para no cambiar)" : "*"}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                minLength={6}
                className="w-full px-4 py-2 pr-12 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500"
                required={!editingId}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Rol</label>
            <select
              value={form.role}
              onChange={(e) => {
                const r = e.target.value;
                setForm((f) => ({
                  ...f,
                  role: r,
                  canAddProducts: r === "admin" || r === "producto" ? true : f.canAddProducts,
                  isTechnician: r === "tecnico" ? true : f.isTechnician,
                }));
              }}
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500"
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.canAddProducts}
                onChange={(e) => setForm((f) => ({ ...f, canAddProducts: e.target.checked }))}
                className="rounded border-slate-600 bg-slate-900 text-emerald-600"
              />
              Puede agregar productos
            </label>
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isTechnician}
                onChange={(e) => setForm((f) => ({ ...f, isTechnician: e.target.checked }))}
                className="rounded border-slate-600 bg-slate-900 text-emerald-600"
              />
              Es técnico (asignable a salidas)
            </label>
            {editingId && (
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="rounded border-slate-600 bg-slate-900 text-emerald-600"
                />
                Usuario activo
              </label>
            )}
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
        {users.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No hay usuarios. Crea el primero.</p>
        ) : (
          users.map((u) => (
            <div
              key={u.id}
              className={`p-4 rounded-lg border flex items-center justify-between ${
                u.active ? "bg-slate-900/50 border-slate-700" : "bg-slate-900/30 border-slate-800 opacity-60"
              }`}
            >
              <div>
                <p className="font-medium text-white">
                  {u.name}
                  {!u.active && (
                    <span className="ml-2 text-xs text-amber-400">(inactivo)</span>
                  )}
                </p>
                <p className="text-sm text-slate-400">{u.email}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                  {u.canAddProducts && (
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                      Agregar productos
                    </span>
                  )}
                  {u.isTechnician && (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                      Técnico
                    </span>
                  )}
                </div>
              </div>
              {u.active && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(u)}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(u.id)}
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
