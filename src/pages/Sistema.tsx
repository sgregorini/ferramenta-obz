import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";

import Dashboard from "./Dashboard";
import CadastroAtividades from "./CadastroAtividades";
import Analises from "./Analises";
import Configuracoes from "./Configuracoes";
import DistribuicaoPercentual from "./DistribuicaoPercentual";
import WorkeforcePlanning from "./WorkforcePlanning";
import CentralAdministrativa from "./CentralAdministrativa";
import GestaoAtividades from "./GestaoAtividades";
import Login from "./Login";

import { Usuario } from "../types";

interface SistemaProps {
  usuario: Usuario;
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function Sistema({ usuario, darkMode, setDarkMode }: SistemaProps) {
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const isAdmin = usuario.permissao === "admin";
  const isPreenchedor = usuario.permissao === "preenchedor";

  const handleLogout = () => {
    localStorage.removeItem("usuario");
    navigate("/login");
  };

  return (
    <div className="flex h-screen flex-col">
      {/* ✅ Barra superior amarela */}
      <header className="bg-yellow-400 text-black flex justify-between items-center px-6 py-3 shadow-sm">
        <div className="text-sm font-akkoMedium uppercase tracking-wide">
          Bem-vindo, <span className="font-akkoBold">{usuario.nome}</span>
        </div>
        <button
          onClick={handleLogout}
          className="bg-white hover:bg-zinc-100 text-black text-sm font-akkoBold px-4 py-1.5 rounded shadow border border-black"
        >
          Sair
        </button>
      </header>

      {/* ✅ Conteúdo com sidebar e rotas */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar setDarkMode={setDarkMode} darkMode={darkMode} usuario={usuario} />
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  usuario={usuario}
                  darkMode={darkMode}
                  setDarkMode={setDarkMode}
                />
              }
            />


            {(isAdmin || isPreenchedor) && (
              <Route
                path="/gestao-atividades"
                element={<GestaoAtividades usuario={usuario} />}
              />
            )}

            {(isAdmin || isPreenchedor) && (
              <Route
                path="/cadastro-atividades"
                element={<CadastroAtividades usuario={usuario} />}
              />
            )}

            {isAdmin && (
              <>
                <Route path="/analises" element={<Analises />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
                <Route path="/workforce-planning" element={<WorkeforcePlanning />} />
                <Route path="/central-administrativa" element={<CentralAdministrativa />} />
              </>
            )}

            {(isAdmin || isPreenchedor) && (
              <Route
                path="/distribuicao-percentual"
                element={<DistribuicaoPercentual usuario={usuario} />}
              />
            )}

            <Route path="/login" element={<Login setUsuario={() => {}} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
