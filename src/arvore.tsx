// pages/Arvore.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getUsuarioLogado } from "../lib/utils";

interface Usuario {
  id: number;
  nome: string;
  perfil: "ADM" | "Responsável" | "Funcionário";
  area_id: number;
}

interface Funcionario {
  id: number;
  nome: string;
  cargo: string;
  responde_para_id: number | null;
  area_id: number;
}

export default function Arvore() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const navigate = useNavigate();

  console.log("Usuário logado:", usuario);
  
  useEffect(() => {
    const fetchUsuario = async () => {
      const user = await getUsuarioLogado();
      setUsuario(user);
    };
    fetchUsuario();
  }, []);

  useEffect(() => {
    if (usuario) {
      fetchFuncionarios();
    }
  }, [usuario]);

    const fetchFuncionarios = async () => {
    setCarregando(true);

    let query = supabase.from("funcionarios").select("*");

    if (usuario?.perfil === "Responsável" || usuario?.perfil === "Funcionário") {
        query = query.eq("area_id", usuario.area_id);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Erro ao buscar funcionarios", error);
        setFuncionarios([]);
    } else {
        setFuncionarios(data || []);
    }

    setCarregando(false);
    };

  const handleClickFuncionario = (func: Funcionario) => {
    if (usuario?.perfil === "Funcionário" && func.id !== usuario.id) return;
    navigate(`/funcionario/${func.id}`);
  };

  if (!usuario || carregando) {
    return (
      <div className="p-6 text-center text-gray-500 font-akkoLight">
        Carregando informações do usuário e equipe...
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Hierarquia da Área</h2>

      {usuario.perfil === "ADM" && (
        <Button className="mb-4" onClick={() => navigate("/cadastro-area")}>
          + Nova Área
        </Button>
      )}

      {usuario.perfil === "Responsável" && (
        <Button className="mb-4" onClick={() => navigate("/cadastro-funcionario")}>
          + Adicionar Funcionário
        </Button>
      )}

      {funcionarios.length === 0 ? (
        <p className="text-gray-500 font-akkoLight">Nenhum funcionário encontrado para esta área.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {funcionarios.map((func) => (
            <Card
              key={func.id}
              onClick={() => handleClickFuncionario(func)}
              className="cursor-pointer hover:shadow-lg"
            >
              <CardContent className="p-4">
                <h3 className="font-bold text-lg">{func.nome}</h3>
                <p className="text-sm text-gray-600">{func.cargo}</p>
                {func.id === usuario?.id && (
                  <p className="text-xs text-blue-500">(Você)</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
