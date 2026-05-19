"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Warehouse, BarChart3, PlusCircle } from "lucide-react";

const navItems = [
  { href: "/", label: "Stock actual", icon: BarChart3 },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/agregar", label: "Agregar Stock", icon: PlusCircle },
  { href: "/depositos", label: "Depósitos", icon: Warehouse },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-0 top-0 z-50 h-screen w-64 border-r border-slate-700/50 bg-slate-900/95 backdrop-blur">
      <div className="flex h-16 items-center border-b border-slate-700/50 px-6">
        <h1 className="text-xl font-bold text-sky-400">StockControl</h1>
      </div>
      <ul className="space-y-1 p-4">
        {navItems.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                pathname === href
                  ? "bg-sky-500/20 text-sky-400"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
