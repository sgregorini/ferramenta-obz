import { Link, useLocation } from "react-router-dom";
import {
  Home,
  ListTodo,
  BarChart,
  UserCog,
  ShieldCheck,
  Moon,
  Sun,
  SlidersHorizontal,
} from "lucide-react";

import { Usuario } from "../types";

interface SidebarProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  usuario: Usuario;
}

export default function Sidebar({ darkMode, setDarkMode, usuario }: SidebarProps) {
  const location = useLocation();

  const isAdmin = usuario.permissao === "admin";
  const isPreenchedor = usuario.permissao === "preenchedor";

  const menu = [
    {
      label: "Gestão de Estrutura",
      icon: <Home size={18} />,
      path: "/sistema",
      permitido: true,
    },
    {
      label: "Cadastro de Atividades",
      icon: <ListTodo size={18} />,
      path: "/sistema/cadastro-atividades",
      permitido: isAdmin || isPreenchedor,
    },
    {
      label: "Distribuição Percentual",
      icon: <SlidersHorizontal size={18} />,
      path: "/sistema/distribuicao-percentual",
      permitido: isAdmin || isPreenchedor,
    },
    {
      label: "Análises",
      icon: <BarChart size={18} />,
      path: "/sistema/analises",
      permitido: isAdmin,
    },
    {
      label: "Workforce Planning",
      icon: <UserCog size={18} />,
      path: "/sistema/workforce-planning",
      permitido: isAdmin,
    },
    {
      label: "Central Administrativa",
      icon: <ShieldCheck size={18} />,
      path: "/sistema/central-administrativa",
      permitido: isAdmin,
    },
  ];

  return (
    <div className="w-64 h-screen bg-[#F2F2F2] dark:bg-[#1F1F1F] text-[#212121] dark:text-white p-4 shadow-md flex flex-col justify-between transition-colors">
      <div>
        <h1 className="text-2xl font-akkoMedium text-center mb-6">
          <span className="text-brand-yellow">Plataforma</span> de Gestão
        </h1>

        <nav className="flex flex-col gap-1">
          {menu
            .filter((item) => item.permitido)
            .map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all text-sm font-medium
                    ${isActive
                      ? "bg-brand-yellow text-black shadow-sm"
                      : "hover:bg-[#E0E0E0] dark:hover:bg-[#333]"}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
        </nav>
      </div>

      <div className="border-t pt-4 mt-6 flex items-center justify-between text-sm px-4">
        <span className="text-zinc-500 dark:text-zinc-400">Modo tema</span>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#E0E0E0] dark:hover:bg-[#333]"
          title="Alternar tema"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          {darkMode ? "Claro" : "Escuro"}
        </button>
      </div>
    </div>
  );
}
