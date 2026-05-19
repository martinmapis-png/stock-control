"use client";

import { useState } from "react";
import { LayoutDashboard, Package, Warehouse, FileText, Box, Menu, Users, LogOut, Wrench } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { Dashboard } from "@/components/Dashboard";
import { AddProductForm } from "@/components/AddProductForm";
import { AddStockForm } from "@/components/AddStockForm";
import { StockTable } from "@/components/StockTable";
import { WarehouseManager } from "@/components/WarehouseManager";
import { Reports } from "@/components/Reports";
import { UserManager } from "@/components/UserManager";
import { TechnicianManager } from "@/components/TechnicianManager";

type Tab = "dashboard" | "products" | "stock" | "warehouses" | "technicians" | "users" | "reports";

export default function Home() {
  const { user, logout, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin = user?.role === "admin";

  const tabs: { id: Tab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { id: "dashboard", label: "Stock actual", icon: LayoutDashboard },
    { id: "products", label: "Productos", icon: Package },
    { id: "stock", label: "Movimientos", icon: Box },
    { id: "warehouses", label: "Depósitos", icon: Warehouse },
    { id: "technicians", label: "Técnicos", icon: Wrench },
    { id: "users", label: "Usuarios", icon: Users, adminOnly: true },
    { id: "reports", label: "Reportes", icon: FileText },
  ];

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  const selectTab = (id: Tab) => {
    setActiveTab(id);
    setMenuOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-white">
              Control de Stock
            </h1>
            <nav className="hidden md:flex items-center gap-1">
              {visibleTabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => selectTab(id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === id
                      ? "bg-emerald-600 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
              <div className="ml-4 flex items-center gap-2 border-l border-slate-700 pl-4">
                <span className="text-sm text-slate-400">{user.name}</span>
                <button
                  onClick={logout}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </nav>
            <div className="md:hidden relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <Menu className="w-6 h-6" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden />
                  <div className="absolute right-0 top-full mt-2 py-2 w-48 rounded-lg bg-slate-800 border border-slate-700 shadow-xl z-50">
                  {visibleTabs.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => selectTab(id)}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm ${
                        activeTab === id ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                  <div className="border-t border-slate-700 mt-2 pt-2">
                    <p className="px-4 py-1 text-xs text-slate-400">{user.name}</p>
                    <button
                      onClick={() => { logout(); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar sesión
                    </button>
                  </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "dashboard" && <Dashboard key={refreshKey} />}

        {activeTab === "products" && (
          <div className="space-y-6">
            {user.canAddProducts ? (
              <AddProductForm
                onProductAdded={() => setRefreshKey((k) => k + 1)}
              />
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 text-amber-200">
                No tienes permiso para agregar productos. Solo los usuarios designados pueden crear nuevos productos.
              </div>
            )}
            <StockTable
              key={refreshKey}
              onInventoryChanged={() => setRefreshKey((k) => k + 1)}
              isAdmin={isAdmin}
              actingUserId={user?.id ?? null}
            />
          </div>
        )}

        {activeTab === "stock" && (
          <div className="space-y-6">
            <AddStockForm onStockUpdated={() => setRefreshKey((k) => k + 1)} />
            <StockTable
              key={refreshKey}
              onInventoryChanged={() => setRefreshKey((k) => k + 1)}
              isAdmin={isAdmin}
              actingUserId={user?.id ?? null}
            />
          </div>
        )}

        {activeTab === "warehouses" && <WarehouseManager key={refreshKey} />}

        {activeTab === "technicians" && <TechnicianManager key={refreshKey} />}

        {activeTab === "users" && <UserManager key={refreshKey} />}

        {activeTab === "reports" && <Reports key={refreshKey} />}
      </main>
    </div>
  );
}
