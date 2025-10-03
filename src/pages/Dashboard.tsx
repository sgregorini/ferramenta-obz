import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Share2, Home, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import EstruturaDrawer from "@/components/EstruturaDrawer";
import type { Funcionario, Area, Usuario } from "../types";

interface DashboardProps {
  usuario: Usuario | null;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

export default function Dashboard({ usuario }: DashboardProps) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);     // escopo visível do usuário
  const [todosFuncionarios, setTodosFuncionarios] = useState<Funcionario[]>([]); // base completa p/ descobrir centros relacionados
  const [areas, setAreas] = useState<Area[]>([]);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [estruturaAbertaId, setEstruturaAbertaId] = useState<string | null>(null);

  const [centroCustoSelecionado, setCentroCustoSelecionado] = useState<string | null>(null);
  const [areaSelecionada, setAreaSelecionada] = useState<Area | undefined>(undefined);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<string | null>(null);

  const [allowedFuncionarioIds, setAllowedFuncionarioIds] = useState<string[]>([]);
  const [ccResponsavel, setCcResponsavel] = useState<{ unidade: string; centro_custo: string }[]>([]);

  // 1) Calcula IDs permitidos (o próprio + subordinados recursivos)
  useEffect(() => {
    if (!usuario?.funcionario_id) return;
    (async () => {
      const myId = usuario.funcionario_id!;
      const { data, error } = await supabase
        .from("vw_subordinados_recursivos")
        .select("id")
        .eq("root_id", myId);

      if (error) {
        console.error(error);
        setAllowedFuncionarioIds([myId]); // ao menos o próprio
        return;
      }

      const ids = new Set<string>((data || []).map((d: any) => d.id as string));
      ids.add(myId);
      setAllowedFuncionarioIds(Array.from(ids));
    })();
  }, [usuario?.funcionario_id]);

  // 2) Carrega funcionários/áreas e mapeia centros onde o usuário é responsável direto
  useEffect(() => {
    (async () => {
      const [{ data: funcionariosData }, { data: areasData }, { data: ccRespData }] =
        await Promise.all([
          supabase.from("funcionarios").select("*"),
          supabase.from("areas").select("*"),
          supabase
            .from("responsaveis_centros_custo")
            .select("unidade, centro_custo, funcionario_id")
            .eq("funcionario_id", usuario?.funcionario_id || "__none__"),
        ]);

      setTodosFuncionarios((funcionariosData || []) as Funcionario[]);
      setAreas((areasData || []) as Area[]);

      if (usuario?.permissao === "admin") {
        setFuncionarios((funcionariosData || []) as Funcionario[]);
      } else {
        setFuncionarios(
          (funcionariosData || []).filter((f: any) =>
            allowedFuncionarioIds.includes(f.id)
          ) as Funcionario[]
        );
      }

      setCcResponsavel(
        (ccRespData || []).map((r: any) => ({
          unidade: r.unidade as string,
          centro_custo: r.centro_custo as string,
        }))
      );
    })();
  }, [allowedFuncionarioIds, usuario?.permissao, usuario?.funcionario_id]);

  // Ajuda a achar diretoria/área de um funcionário (usando TODOS os funcionários, não só os visíveis)
  function rastrearDiretoria(funcionario: Funcionario): { area?: Area; responsavel?: Funcionario } {
    let atual: Funcionario | undefined = funcionario;
    const visitados = new Set<string>();

    while (atual && !visitados.has(atual.id)) {
      visitados.add(atual.id);
      const area = areas.find((a) => Number(a.id) === Number(atual!.area_id));
      if (area) {
        const resp =
          todosFuncionarios.find((f) => f.id === area.responsavel_id) || undefined;
        return { area, responsavel: resp };
      }
      atual = todosFuncionarios.find((f) => f.id === atual!.responde_para) as
        | Funcionario
        | undefined;
    }
    return {};
  }

  // 3) Monta as coleções de hospitais/diretorias/centros RELACIONADOS ao usuário
  const viewData = useMemo(() => {
    // Map: hospital -> diretoria -> { centers: Set<string>, diretor?: Funcionario }
    const porHospital = new Map<
      string,
      Map<string, { centers: Set<string>; diretor?: Funcionario }>
    >();

    const addCC = (hospital: string, diretoria: string, cc: string, diretor?: Funcionario) => {
      const h = hospital || "—";
      if (!porHospital.has(h)) porHospital.set(h, new Map());
      const mapDir = porHospital.get(h)!;
      if (!mapDir.has(diretoria)) mapDir.set(diretoria, { centers: new Set(), diretor });
      const bucket = mapDir.get(diretoria)!;
      bucket.centers.add(cc);
      if (diretor && !bucket.diretor) bucket.diretor = diretor;
    };

    // a) Centros vindos dos FUNCIONÁRIOS do escopo do usuário
    funcionarios
      .filter((f) => f.centro_custo && f.unidade)
      .forEach((f) => {
        const { area, responsavel } = rastrearDiretoria(f);
        const nomeDir = area?.nome || "Sem Diretoria";
        addCC(f.unidade!, nomeDir, f.centro_custo!, responsavel);
      });

    // b) Centros onde o usuário é responsável direto (tabela responsaveis_centros_custo)
    ccResponsavel.forEach(({ unidade, centro_custo }) => {
      // tentar achar área pela base completa (qualquer funcionário desse CC)
      const algum = todosFuncionarios.find(
        (x) => norm(x.unidade) === norm(unidade) && norm(x.centro_custo) === norm(centro_custo)
      );
      let nomeDir = "Sem Diretoria";
      let diretor: Funcionario | undefined = undefined;
      if (algum) {
        const { area, responsavel } = rastrearDiretoria(algum);
        nomeDir = area?.nome || nomeDir;
        diretor = responsavel;
      }
      addCC(unidade, nomeDir, centro_custo, diretor);
    });

    // c) Centros de áreas em que o usuário é DIRETOR
    const minhasAreas = areas.filter((a) => a.responsavel_id === usuario?.funcionario_id);
    if (minhasAreas.length) {
      // usa a base completa para achar todos os CC dessa(s) área(s)
      todosFuncionarios
        .filter(
          (f) =>
            f.unidade &&
            f.centro_custo &&
            minhasAreas.some((a) => Number(a.id) === Number(f.area_id))
        )
        .forEach((f) => {
          const { area, responsavel } = rastrearDiretoria(f);
          const nomeDir = area?.nome || "Sem Diretoria";
          addCC(f.unidade!, nomeDir, f.centro_custo!, responsavel);
        });
    }

    return porHospital;
  }, [funcionarios, todosFuncionarios, areas, ccResponsavel, usuario?.funcionario_id]);

  const hospitais = useMemo(() => Array.from(viewData.keys()).sort(), [viewData]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-100 dark:from-zinc-900 dark:to-zinc-950 px-4 md:px-8 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Home className="text-yellow-500" size={32} />
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Gestão de Estrutura</h1>
      </div>

      {hospitais.map((hospital) => {
        const diretoriasMap = viewData.get(hospital)!;

        // remove "Sem Diretoria" apenas se houver outras (senão, mostramos)
        const entries = Array.from(diretoriasMap.entries());
        const temOutras = entries.some(([nome]) => nome !== "Sem Diretoria");
        const diretorias = entries
          .filter(([nome]) => (temOutras ? nome !== "Sem Diretoria" : true))
          .sort(([a], [b]) => a.localeCompare(b));

        if (!diretorias.length) return null;

        return (
          <div key={hospital} className="mb-10">
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-white mb-4 border-b border-zinc-300 dark:border-zinc-700 pb-2">
              {hospital}
            </h2>

            {diretorias.map(([diretoria, info]) => {
              const centros = Array.from(info.centers).sort();
              const key = `${hospital}-${diretoria}`;
              const isExpandido = expandidos[key] || false;
              const responsavel = info.diretor;

              return (
                <Card
                  key={diretoria}
                  className="mb-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all bg-white dark:bg-zinc-900"
                >
                  <div
                    className="flex justify-between items-center p-5 cursor-pointer"
                    onClick={() =>
                      setExpandidos((prev) => ({ ...prev, [key]: !prev[key] }))
                    }
                  >
                    <div>
                      <p className="font-semibold text-lg md:text-xl text-zinc-800 dark:text-white">
                        {diretoria}
                      </p>
                      {responsavel && (
                        <p className="text-sm text-zinc-500 dark:text-zinc-300 mt-1">
                          {responsavel.nome}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Abre HIERARQUIA da DIRETORIA
                          if (responsavel?.id) {
                            setEstruturaAbertaId(responsavel.id);
                          } else {
                            // fallback: tenta achar algum funcionário da diretoria
                            const algum = todosFuncionarios.find(
                              (f) =>
                                f.unidade === hospital &&
                                areas.some(
                                  (a) => a.nome === diretoria && Number(a.id) === Number(f.area_id)
                                )
                            );
                            setEstruturaAbertaId(algum?.id || null);
                          }

                          // passa unidade + área para o drawer
                          const areaObj = areas.find((a) => a.nome === diretoria);
                          setAreaSelecionada(areaObj);
                          setCentroCustoSelecionado(null);
                          setUnidadeSelecionada(hospital);
                        }}
                        className="p-1 rounded hover:bg-yellow-100 dark:hover:bg-yellow-600"
                      >
                        <Share2 size={20} className="text-yellow-600 dark:text-yellow-300" />
                      </button>
                      {isExpandido ? (
                        <ChevronUp size={22} className="text-zinc-500" />
                      ) : (
                        <ChevronDown size={22} className="text-zinc-500" />
                      )}
                    </div>
                  </div>

                  {isExpandido && (
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-5">
                      {centros.map((centro) => (
                        <Card
                          key={centro}
                          className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow bg-zinc-50 dark:bg-zinc-800 cursor-pointer hover:ring-2 hover:ring-yellow-300"
                          onClick={async () => {
                            // Abre HIERARQUIA do CENTRO
                            setCentroCustoSelecionado(centro);
                            setUnidadeSelecionada(hospital);
                            setAreaSelecionada(areas.find((a) => a.nome === diretoria));

                            // tenta encontrar responsável pelo centro
                            const { data: respCC } = await supabase
                              .from("responsaveis_centros_custo")
                              .select("funcionario_id")
                              .eq("centro_custo", centro)
                              .eq("unidade", hospital)
                              .maybeSingle();

                            if (respCC?.funcionario_id) {
                                setEstruturaAbertaId(respCC.funcionario_id);
                                setCentroCustoSelecionado(centro);
                                setUnidadeSelecionada(hospital);
                                setAreaSelecionada(undefined); // ✅ mantém undefined no fluxo de CC
                                return;
                              }


                            // fallback: pega alguém do centro e sobe até diretoria
                            const algum = todosFuncionarios.find(
                              (f) => norm(f.unidade) === norm(hospital) && norm(f.centro_custo) === norm(centro)
                            );
                            if (algum) {
                              const dir = areas.find((a) => Number(a.id) === Number(algum.area_id));
                              if (dir?.responsavel_id) {
                                setEstruturaAbertaId(dir.responsavel_id);
                                return;
                              }
                              setEstruturaAbertaId(algum.id);
                            }
                          }}
                        >
                          <p className="font-medium text-zinc-800 dark:text-white text-center text-sm md:text-base">
                            {centro}
                          </p>
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
            setUnidadeSelecionada(null);
            setAreaSelecionada(undefined);
          }}
          filtroUnidade={true}
          areaFiltrada={areaSelecionada}
          centroCustoSelecionado={centroCustoSelecionado || undefined}
          unidadeSelecionada={unidadeSelecionada || undefined}
        />
      )}
    </div>
  );
}
