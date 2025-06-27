import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Usuario, Funcionario, Area, Distribuicao } from "../types";
import {
  Home,
  Users,
  FileText,
  ChevronDown,
  ChevronUp,
  Share2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import EstruturaDrawer from "@/components/EstruturaDrawer";

interface DashboardProps {
  usuario: Usuario | null;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

export default function Dashboard({ usuario, darkMode, setDarkMode }: DashboardProps) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [distribuicoes, setDistribuicoes] = useState<Distribuicao[]>([]);
  const [expandidos, setExpandidos] = useState<Record<number, boolean>>({});
  const [estruturaAbertaId, setEstruturaAbertaId] = useState<number | null>(null);
  const [areaSelecionada, setAreaSelecionada] = useState<Area | null>(null);
  const navigate = useNavigate();

  const isAdmin = usuario?.permissao === "admin";

  useEffect(() => {
    async function carregarDados() {
      const [{ data: funcionariosData }, { data: areasData }, { data: distribuicoesData }] = await Promise.all([
        supabase.from("funcionarios").select("*"),
        supabase.from("areas").select("*"),
        supabase.from("distribuicao_percentual").select("*"),
      ]);
      setFuncionarios(funcionariosData || []);
      setAreas(areasData || []);
      setDistribuicoes(distribuicoesData || []);
    }
    carregarDados();
  }, []);

    const funcionarioLogado = funcionarios.find(f => f.id === usuario?.id);

  const unidadesResponsavel = useMemo(() => {
    const visiveis = areas.filter(
      (area) => isAdmin || area.responsavel_id === usuario?.id
    );
    return Array.from(new Set(visiveis.map((a) => a.unidade).filter(Boolean))) as string[];
  }, [areas, usuario]);

  const getNomeArea = (areaId: number) => {
    return areas.find((a) => a.id === areaId)?.nome || `Área #${areaId}`;
  };

  const contarFuncionariosPorAreaEUnidade = (areaId: number, unidade?: string) => {
    return funcionarios.filter(f => f.area_id === areaId && f.unidade_original === unidade).length;
  };

  const contarAtividadesPorArea = (areaId: number) => {
    const funcionariosDaArea = funcionarios.filter(f => f.area_id === areaId);
    const funcionarioIds = new Set(funcionariosDaArea.map(f => f.id));
    const atividades = new Set(
      distribuicoes
        .filter((d) => funcionarioIds.has(d.funcionario_id))
        .map((d) => d.atividade_id)
    );
    return atividades.size;
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 px-8 py-6 transition-colors">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-4xl font-akkoMedium text-zinc-900 dark:text-white flex items-center gap-2">
            <Home className="text-yellow-500" size={28} />
            Gestão de Estrutura
          </h1>
          <div className="h-1 w-32 bg-yellow-400 mt-1 rounded" />
          <p className="text-sm text-zinc-500 dark:text-zinc-300 mt-2">
            Visualize e gerencie as áreas operacionais.
          </p>
        </div>
      </div>

      {unidadesResponsavel.map((unidade) => {
        const funcionariosNaUnidade = funcionarios.filter(f => f.unidade_original === unidade);
        const subordinadoIds = new Set(funcionariosNaUnidade.map(f => f.id));
        const chefes = funcionarios.filter(f =>
          subordinadoIds.has(f.id) ||
          funcionariosNaUnidade.some(sub => sub.responde_para === f.id)
        );

        const candidatos = chefes.filter(chefe =>
          (isAdmin || chefe.id === usuario?.id) &&
          funcionariosNaUnidade.some(sub => sub.responde_para === chefe.id) &&
          !chefes.some(outro => outro.id === chefe.responde_para)
        );

        const areasNaUnidade = new Map<number, Funcionario>();
        funcionariosNaUnidade.forEach((f) => {
          const area = areas.find((a) => a.id === f.area_id);
          const visivel = area && (isAdmin || area.responsavel_id === usuario?.id);
          if (f.area_id && visivel && !areasNaUnidade.has(f.area_id)) {
            areasNaUnidade.set(f.area_id, f);
          }
        });

        const chefeList = candidatos.length > 0 ? candidatos : [usuario];

        return (
          <div key={unidade} className="mb-8">
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-white mb-3">{unidade}</h2>

            {chefeList.map((chefe) => chefe && (
              <Card key={chefe.id} className="mb-6 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                <div
                  className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  onClick={() => setExpandidos((prev) => ({ ...prev, [chefe.id]: !prev[chefe.id] }))}
                >
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-800 dark:text-white">{chefe.nome}</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {"cargo" in chefe ? chefe.cargo : funcionarioLogado?.cargo || "Responsável"}
                    </p>
                  </div>
                  <div className="flex gap-3 items-center">
                    <button
                      className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAreaSelecionada(null);
                        setEstruturaAbertaId(null);
                        setTimeout(() => setEstruturaAbertaId(chefe.id), 0);
                      }}
                      title="Ver estrutura hierárquica completa"
                    >
                      <Share2 size={18} />
                    </button>
                    {expandidos[chefe.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {expandidos[chefe.id] && (
                  <CardContent className="pl-6 pb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {Array.from(areasNaUnidade.entries()).map(([areaId, f]) => (
                        <Card
                          key={areaId}
                          onClick={() => navigate(`/area/${f.id}`)}
                          className="cursor-pointer rounded-xl border border-zinc-200 dark:border-zinc-700 hover:shadow-md"
                        >
                          <div className="h-2 rounded-t-xl bg-yellow-400" />
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-zinc-800 dark:text-white">{getNomeArea(areaId)}</h4>
                              <button
                                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const area = areas.find((a) => a.id === areaId);
                                  if (area) {
                                    setEstruturaAbertaId(null);
                                    setTimeout(() => {
                                      setEstruturaAbertaId(area.responsavel_id);
                                      setAreaSelecionada(area);
                                    }, 0);
                                  }
                                }}
                                title="Ver estrutura hierárquica da área"
                              >
                                <Share2 size={18} />
                              </button>
                            </div>
                            <div className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                              <div className="flex items-center gap-2">
                                <Users size={16} /> {contarFuncionariosPorAreaEUnidade(areaId, unidade)} Funcionário(s)
                              </div>
                              <div className="flex items-center gap-2">
                                <FileText size={16} /> {contarAtividadesPorArea(areaId)} Atividade(s)
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        );
      })}

      {estruturaAbertaId && (
        <EstruturaDrawer
          key={`${estruturaAbertaId}-${areaSelecionada?.id || "todas"}`}
          id={estruturaAbertaId}
          onClose={() => setEstruturaAbertaId(null)}
          filtroUnidade={!!areaSelecionada}
          areaFiltrada={areaSelecionada || undefined}
        />
      )}
    </div>
  );
}
