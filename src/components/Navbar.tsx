"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Warehouse, BarChart3, LayoutDashboard } from "lucide-react";

const navItems = [
  { href: "/", label: "Stock actual", icon: LayoutDashboard },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/depositos", label: "Depósitos", icon: Warehouse },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-0 top-0 z-50 h-screen w-64 border-r border-slate-700 bg-slate-900/95 backdrop-blur">
      <div className="flex h-16 items-center border-b border-slate-700 px-6">
        <Link href="/" className="text-xl font-bold text-blue-400">
          StockControl
        </Link>
      </div>
      <ul className="space-y-1 p-4">
        {navItems.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                pathname === href
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon size={20} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
