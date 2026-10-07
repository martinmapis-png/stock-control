"use client";

import { useEffect, useState } from "react";
import { FolderTree, Plus, Pencil, Trash2, X } from "lucide-react";

interface CategoryProduct {
  id: string;
  name: string;
  sku: string | null;
}

interface Category {
  id: string;
  name: string;
  products: CategoryProduct[];
}

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  categories: { id: string; name: string }[];
}

export function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | "none" | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [editName, setEditName] = useState("");
  const [editing, setEditing] = useState(false);
  const [productToAdd, setProductToAdd] = useState("");
  const [moveCategoryId, setMoveCategoryId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [categoriesRes, productsRes] = await Promise.all([
      fetch("/api/categories"),
      fetch("/api/products"),
    ]);
    const categoriesData = await categoriesRes.json();
    const productsData = await productsRes.json();
    setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    setProducts(
      Array.isArray(productsData)
        ? productsData.map((product: ProductOption) => ({
            ...product,
            categories: Array.isArray(product.categories) ? product.categories : [],
          }))
        : []
    );
  };

  useEffect(() => {
    load();
  }, []);

  const selected = selectedId && selectedId !== "none" ? categories.find((c) => c.id === selectedId) ?? null : null;
  const uncategorized = products.filter((p) => p.categories.length === 0);
  const availableToAdd = products.filter((p) => !p.categories.some((c) => c.id === selected?.id));

  const createCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear categoría");
      setName("");
      setShowForm(false);
      await load();
      setSelectedId(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const renameCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/categories/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al renombrar");
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async () => {
    if (!selected) return;
    const ok = window.confirm(
      `¿Eliminar la categoría «${selected.name}»?\n\nLos productos se quitan solo de esta categoría. Si están en otras, siguen ahí. No se borra el stock.`
    );
    if (!ok) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/categories/${selected.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error al eliminar");
      setSelectedId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const setProductCategories = async (productId: string, categoryIds: string[]) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar el producto");
      setProductToAdd("");
      setMoveCategoryId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const addProductToCategory = (productId: string, categoryId: string) => {
    const product = products.find((item) => item.id === productId);
    const ids = new Set((product?.categories ?? []).map((category) => category.id));
    ids.add(categoryId);
    setProductCategories(productId, [...ids]);
  };

  const removeProductFromCategory = (productId: string, categoryId: string) => {
    const product = products.find((item) => item.id === productId);
    const ids = (product?.categories ?? []).map((category) => category.id).filter((id) => id !== categoryId);
    setProductCategories(productId, ids);
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <FolderTree className="w-5 h-5" />
          Categorías
        </h2>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            setError(null);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
        >
          <Plus className="w-4 h-4" />
          Nueva categoría
        </button>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        Creá categorías y meté productos adentro. Un producto puede estar en todas las categorías que quieras.
      </p>

      {showForm && (
        <form onSubmit={createCategory} className="flex flex-wrap gap-2 mb-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la categoría"
            className="flex-1 min-w-[12rem] px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium"
          >
            Crear
          </button>
        </form>
      )}

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              setSelectedId("none");
              setEditing(false);
              setError(null);
            }}
            className={`w-full text-left px-4 py-3 rounded-lg border ${
              selectedId === "none"
                ? "bg-emerald-600/20 border-emerald-500 text-white"
                : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500"
            }`}
          >
            <span className="font-medium">Sin categoría</span>
            <span className="block text-xs text-slate-400 mt-1">{uncategorized.length} productos</span>
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                setSelectedId(category.id);
                setEditName(category.name);
                setEditing(false);
                setError(null);
              }}
              className={`w-full text-left px-4 py-3 rounded-lg border ${
                selectedId === category.id
                  ? "bg-emerald-600/20 border-emerald-500 text-white"
                  : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              <span className="font-medium">{category.name}</span>
              <span className="block text-xs text-slate-400 mt-1">
                {category.products.length} producto{category.products.length === 1 ? "" : "s"}
              </span>
            </button>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-slate-500 px-1">Todavía no hay categorías.</p>
          )}
        </div>

        <div className="lg:col-span-2 rounded-lg border border-slate-700 bg-slate-900/40 p-4 min-h-[16rem]">
          {selectedId === null && (
            <p className="text-slate-400 text-sm">Elegí una categoría para ver y agregar productos.</p>
          )}

          {selectedId === "none" && (
            <>
              <h3 className="text-lg font-medium text-white mb-3">Productos sin categoría</h3>
              {uncategorized.length === 0 ? (
                <p className="text-slate-400 text-sm">Todos los productos están en al menos una categoría.</p>
              ) : (
                <>
                  <form
                    className="flex flex-wrap gap-2 mb-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (productToAdd && moveCategoryId) addProductToCategory(productToAdd, moveCategoryId);
                    }}
                  >
                    <select
                      value={productToAdd}
                      onChange={(e) => setProductToAdd(e.target.value)}
                      className="flex-1 min-w-[10rem] px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
                    >
                      <option value="">Producto…</option>
                      {uncategorized.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={moveCategoryId}
                      onChange={(e) => setMoveCategoryId(e.target.value)}
                      className="flex-1 min-w-[10rem] px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
                    >
                      <option value="">Categoría…</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={loading || !productToAdd || !moveCategoryId}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium"
                    >
                      Agregar
                    </button>
                  </form>
                  <ul className="space-y-1">
                    {uncategorized.map((product) => (
                      <li key={product.id} className="py-2 border-b border-slate-800 text-white">
                        {product.name}
                        {product.sku ? <span className="text-slate-500 text-xs ml-2">{product.sku}</span> : null}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          {selected && (
            <>
              <div className="flex items-start justify-between gap-3 mb-4">
                {editing ? (
                  <form onSubmit={renameCategory} className="flex flex-1 flex-wrap gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 min-w-[10rem] px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
                      required
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="px-3 py-2 text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <h3 className="text-lg font-medium text-white">{selected.name}</h3>
                )}
                {!editing && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditName(selected.name);
                        setEditing(true);
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                      title="Renombrar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={deleteCategory}
                      disabled={loading}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40"
                      title="Eliminar categoría"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <form
                className="flex flex-wrap gap-2 mb-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (productToAdd) addProductToCategory(productToAdd, selected.id);
                }}
              >
                <select
                  value={productToAdd}
                  onChange={(e) => setProductToAdd(e.target.value)}
                  className="flex-1 min-w-[12rem] px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
                >
                  <option value="">Agregar producto…</option>
                  {availableToAdd.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                      {product.categories.length > 0
                        ? ` (también en ${product.categories.map((category) => category.name).join(", ")})`
                        : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={loading || !productToAdd}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium"
                >
                  Agregar
                </button>
              </form>

              {selected.products.length === 0 ? (
                <p className="text-slate-400 text-sm">Esta categoría todavía no tiene productos.</p>
              ) : (
                <ul className="space-y-1">
                  {selected.products.map((product) => (
                    <li
                      key={product.id}
                      className="flex items-center justify-between gap-2 py-2 border-b border-slate-800"
                    >
                      <span className="text-white">
                        {product.name}
                        {product.sku ? <span className="text-slate-500 text-xs ml-2">{product.sku}</span> : null}
                      </span>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => removeProductFromCategory(product.id, selected.id)}
                        className="text-sm text-slate-400 hover:text-white"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
