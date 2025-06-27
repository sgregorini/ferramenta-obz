import { Navigate } from "react-router-dom";
import { ReactNode, useEffect, useState } from "react";

interface PrivateRouteProps {
  children: ReactNode;
}

export default function PrivateRoute({ children }: PrivateRouteProps) {
  const [usuario, setUsuario] = useState<any | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("usuario");
    if (storedUser) {
      try {
        setUsuario(JSON.parse(storedUser));
      } catch {
        setUsuario(null);
      }
    }
    setCarregando(false);
  }, []);

  if (carregando) return null;
  if (!usuario) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
