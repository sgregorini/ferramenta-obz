import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { UserCircle, Share2, Home, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import EstruturaDrawer from "@/components/EstruturaDrawer";
import { Funcionario, Area, Usuario } from "../types";

interface DashboardProps {
  usuario: Usuario | null;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

export default function Dashboard({ usuario }: DashboardProps) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [estruturaAbertaId, setEstruturaAbertaId] = useState<string | null>(null);
  const [centroCustoSelecionado, setCentroCustoSelecionado] = useState<string | null>(null);
  const [areaSelecionada, setAreaSelecionada] = useState<Area | undefined>(undefined);
  const [allowedFuncionarioIds, setAllowedFuncionarioIds] = useState<string[]>([]);

useEffect(() => {
  if (!usuario?.funcionario_id) return;
  const carregarSubordinados = async () => {
    const { data, error } = await supabase
      .from("vw_subordinados_recursivos")
      .select("id")
      .eq("root_id", usuario.funcionario_id);

    if (error) {
      console.error(error);
      return;
    }
    setAllowedFuncionarioIds(data.map((d) => d.id));
  };

  carregarSubordinados();
}, [usuario?.funcionario_id]);

useEffect(() => {
  const carregar = async () => {
    const { data: funcionariosData } = await supabase.from("funcionarios").select("*");
    const { data: areasData } = await supabase.from("areas").select("*");

    if (funcionariosData) {
      if (usuario?.permissao === "admin") {
        // Admin visualiza tudo
        setFuncionarios(funcionariosData);
      } else {
        // Filtra funcionários pelo allowedFuncionarioIds (próprio + subordinados)
        setFuncionarios(funcionariosData.filter(f => allowedFuncionarioIds.includes(f.id)));
      }
    }

    setAreas(areasData || []);
  };
  carregar();
}, [allowedFuncionarioIds, usuario?.permissao]);

const [responsaveisExtras, setResponsaveisExtras] = useState<Funcionario[]>([]);

useEffect(() => {
  const carregarResponsaveisExtras = async () => {
    if (areas.length === 0 || funcionarios.length === 0) return;

    const responsavelIdsFaltantes = areas
      .filter(a => a.responsavel_id)
      .map(a => a.responsavel_id as string)
      .filter(id => !funcionarios.some(f => f.id === id));

    if (responsavelIdsFaltantes.length === 0) {
      setResponsaveisExtras([]);
      return;
    }

    const { data, error } = await supabase
      .from('funcionarios')
      .select('*')
      .in('id', responsavelIdsFaltantes);

    if (error) {
      console.error("Erro ao buscar responsáveis extras:", error);
      setResponsaveisExtras([]);
    } else {
      setResponsaveisExtras(data as Funcionario[]);
    }
  };

  carregarResponsaveisExtras();
}, [areas, funcionarios]);


  const unidadesComCentros = Array.from(
    new Set(
      funcionarios
        .filter((f) => f.centro_custo && f.centro_custo.trim() !== "")
        .map((f) => f.unidade ?? "")
        .filter(Boolean)
    )
  );

  function rastrearDiretoria(funcionario: Funcionario): { area?: Area; responsavel?: Funcionario } {
    let atual = funcionario;
    const visitados = new Set<string>();
    while (atual && !visitados.has(atual.id)) {
      visitados.add(atual.id);
      const area = areas.find((a) => a.id === atual.area_id);
      if (area) {
        const responsavel = funcionarios.find((f) => f.id === area.responsavel_id);
        return { area, responsavel };
      }
      atual = funcionarios.find((f) => f.id === atual.responde_para) as Funcionario;
    }
    return {};
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-100 dark:from-zinc-900 dark:to-zinc-950 px-4 md:px-8 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Home className="text-yellow-500" size={32} />
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Gestão de Estrutura</h1>
      </div>

      {unidadesComCentros.map((hospital) => {
        const centrosPorDiretoria = new Map<string, Set<string>>();
        const diretoresMap = new Map<string, Funcionario>();

      funcionarios
        .filter((f) => f.unidade === hospital && f.centro_custo && f.centro_custo.trim() !== "")
        .forEach((f) => {
          const { area, responsavel } = rastrearDiretoria(f);
          const nomeDiretoria = area?.nome ?? "Sem Diretoria";

          if (!centrosPorDiretoria.has(nomeDiretoria)) {
            centrosPorDiretoria.set(nomeDiretoria, new Set());

            let responsavelFinal = responsavel;
            if (!responsavelFinal && area?.responsavel_id) {
              responsavelFinal =
                funcionarios.find(f => f.id === area.responsavel_id) ??
                responsaveisExtras.find(f => f.id === area.responsavel_id);
            }

            if (responsavelFinal) {
              diretoresMap.set(nomeDiretoria, responsavelFinal);
            }
          }

          centrosPorDiretoria.get(nomeDiretoria)!.add(f.centro_custo!);
        });


        if (centrosPorDiretoria.size === 0) return null;

        // Remove 'Sem Diretoria' entries
        const diretorias = [...centrosPorDiretoria.entries()]
          .filter(([nome]) => nome !== "Sem Diretoria");
        if (diretorias.length === 0) return null;

        return (
          <div key={hospital} className="mb-10">
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-white mb-4 border-b border-zinc-300 dark:border-zinc-700 pb-2">
              {hospital}
            </h2>

            {diretorias.map(([diretoria, centrosSet]) => {
              const centros = Array.from(centrosSet).sort();
              const key = `${hospital}-${diretoria}`;
              const isExpandido = expandidos[key] || false;
              const responsavel = diretoresMap.get(diretoria);

              return (
                <Card key={diretoria} className="mb-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all bg-white dark:bg-zinc-900">
                  <div
                    className="flex justify-between items-center p-5 cursor-pointer"
                onClick={() =>
                  setExpandidos((prev) => ({ ...prev, [key]: !prev[key] }))
                }
                  >
                    <div>
                      <p className="font-semibold text-lg md:text-xl text-zinc-800 dark:text-white">{diretoria}</p>
                      {responsavel && <p className="text-sm text-zinc-500 dark:text-zinc-300 mt-1">{responsavel.nome}</p>}
                    </div>
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (responsavel?.id) {
                              setEstruturaAbertaId(responsavel.id);
                          } else {
                              // Busca a área pelo nome da diretoria para pegar o responsavel_id
                              const areaCorrespondente = areas.find(a => a.nome === diretoria);
                              if (areaCorrespondente?.responsavel_id) {
                                  console.warn("Responsável da área não está nos subordinados, usando area.responsavel_id:", areaCorrespondente.responsavel_id);
                                  setEstruturaAbertaId(areaCorrespondente.responsavel_id);
                              } else {
                                  console.warn("Responsável da área não encontrado e area.responsavel_id também não disponível para diretoria:", diretoria);
                              }
                          }
                          setAreaSelecionada(undefined);
                          setCentroCustoSelecionado(null);
                        }}
                        className="p-1 rounded hover:bg-yellow-100 dark:hover:bg-yellow-600"
                      >
                        <Share2 size={20} className="text-yellow-600 dark:text-yellow-300" />
                      </button>
                      {isExpandido ? <ChevronUp size={22} className="text-zinc-500" /> : <ChevronDown size={22} className="text-zinc-500" />}
                    </div>
                  </div>

                  {isExpandido && (
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-5">
                      {Array.from(centrosSet).sort().map((centro: string) => (
                        <Card
                          key={centro}
                          className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow bg-zinc-50 dark:bg-zinc-800 cursor-pointer hover:ring-2 hover:ring-yellow-300"
                          onClick={async () => {
                            setCentroCustoSelecionado(centro);
                            const { data: responsavelCentro } = await supabase
                              .from("responsaveis_centros_custo")
                              .select("funcionario_id")
                              .eq("centro_custo", centro)
                              .eq("unidade", hospital)
                              .maybeSingle();

                            if (responsavelCentro?.funcionario_id) {
                              setEstruturaAbertaId(responsavelCentro.funcionario_id);
                            } else {
                              const funcionarioDoCentro = funcionarios.find(
                                (f) => f.centro_custo === centro && f.unidade === hospital
                              );
                              if (funcionarioDoCentro) {
                                const { responsavel } = rastrearDiretoria(funcionarioDoCentro);
                                setEstruturaAbertaId(responsavel?.id || funcionarioDoCentro.id);
                              }
                            }
                          }}
                        >
                          <p className="font-medium text-zinc-800 dark:text-white text-center text-sm md:text-base">{centro}</p>
                        </Card>
                      ))}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })}

      {estruturaAbertaId && (
        <EstruturaDrawer
          id={estruturaAbertaId}
          onClose={() => {
            setEstruturaAbertaId(null);
            setCentroCustoSelecionado(null);
          }}
          filtroUnidade={!!areaSelecionada}
          areaFiltrada={areaSelecionada}
          centroCustoSelecionado={centroCustoSelecionado || undefined}
        />
      )}
    </div>
  );
}