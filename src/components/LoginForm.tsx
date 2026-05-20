"use client";

import { useState } from "react";
import { LogIn, KeyRound, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function LoginForm() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleResetPassword = async () => {
    setError(null);
    setResetMsg(null);
    try {
      const res = await fetch("/api/auth/reset-password", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResetMsg(data.message || "Contraseña reseteada. Usuario: admin / Contraseña: admin");
      } else {
        setError(data.error || `Error al resetear (${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión. ¿Está el servidor corriendo?");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800/50 rounded-xl p-8 border border-slate-700/50 shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">StockControl</h1>
        <p className="text-slate-400 text-center mb-6">Inicia sesión para continuar</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2 pr-12 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500"
                required
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
          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">{error}</div>
          )}
          {resetMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm">{resetMsg}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium"
          >
            <LogIn className="w-5 h-5" />
            {loading ? "Entrando..." : "Iniciar sesión"}
          </button>
          <button
            type="button"
            onClick={handleResetPassword}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-slate-400 hover:text-slate-300"
          >
            <KeyRound className="w-4 h-4" />
            Resetear contraseña del admin
          </button>
        </form>
      </div>
    </div>
  );
}
