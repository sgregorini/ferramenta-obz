import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import { Usuario } from "./types";

import Login from "./pages/Login";
import Arvore from "./pages/arvore";
import EstruturaVisual from "./pages/EstruturaVisual";
import Sistema from "./pages/Sistema";

import { Toaster } from "sonner";
import PrivateRoute from "./components/PrivateRoute";

export default function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const stored = localStorage.getItem("usuario");
    return stored ? JSON.parse(stored) : null;
  });

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    const stored = localStorage.getItem("usuario");
    if (stored) {
      setUsuario(JSON.parse(stored));
    } else {
      setUsuario(null);
    }
  }, []);


  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return (
    <Router>
      <>
        <Routes>
          <Route path="/login" element={<Login setUsuario={setUsuario} />} />

          <Route
            path="/sistema/*"
            element={
              <PrivateRoute>
                <Sistema
                  usuario={JSON.parse(localStorage.getItem("usuario")!)}
                  darkMode={darkMode}
                  setDarkMode={setDarkMode}
                />
              </PrivateRoute>
            }
          />
          <Route path="/estrutura/:id" element={<EstruturaVisual />} />
          <Route path="/arvore" element={<Arvore />} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster />
      </>
    </Router>
  );
}
