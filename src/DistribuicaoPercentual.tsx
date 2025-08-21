import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { supabase } from "../lib/supabase";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { toast } from "sonner";

import { adapterSupabase } from "../adapters/adapterSupabase";
import { Area, Funcionario, Usuario } from "../types";

interface Atividade {
  id: number;
  nome: string;
  area_id?: number | null;
  unidade?: string;
}

interface DistribuicaoPorAtividade {
  atividade_id: number;
  frequencia: string;
  duracao_ocorrencia_horas: number;
  quantidade_ocorrencias: number;
}

type Distribuicoes = {
  [funcionario_id: string]: DistribuicaoPorAtividade[];
};

interface Props {
  usuario: Usuario;
}

export default function DistribuicaoPorFuncionario({ usuario }: Props) {
  const isAdmin = usuario.permissao === "admin";

  const [unidadeSelecionada, setUnidadeSelecionada] = useState("");
  const [areaId, setAreaId] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [funcionarioDrawerAberto, setFuncionarioDrawerAberto] = useState<string | null>(null);
  const [distribuicoes, setDistribuicoes] = useState<Distribuicoes>({});
  const [centrosCustoDisponiveis, setCentrosCustoDisponiveis] = useState<string[]>([]);
  const [centroCustoSelecionado, setCentroCustoSelecionado] = useState<string>("");
  const [allowedFuncionarioIds, setAllowedFuncionarioIds] = useState<string[]>([]);


  const opcoesFrequencia = ["Diária", "Semanal", "Mensal", "Bimestral", "Trimestral", "Eventual"];

  useEffect(() => {
  if (!usuario?.funcionario_id || isAdmin) return;

  const carregarSubordinados = async () => {
    const { data, error } = await supabase
      .from("vw_subordinados_recursivos")
      .select("id")
      .eq("root_id", usuario.funcionario_id);

    if (error) {
      console.error("Erro ao carregar subordinados recursivos:", error);
      return;
    }

    setAllowedFuncionarioIds(data.map((d) => d.id));
  };

  carregarSubordinados();
}, [usuario?.funcionario_id, isAdmin]);


  useEffect(() => {
    const carregarDados = async () => {
      let areasAPI = await adapterSupabase.getAreas();
      let funcionariosAPI = await adapterSupabase.getFuncionarios();
      let atividadesAPI = await adapterSupabase.getAtividades();
      const distribuicoesReais = await adapterSupabase.getDistribuicaoReal();

      if (!isAdmin) {
        if (allowedFuncionarioIds.length === 0) return;

        funcionariosAPI = funcionariosAPI.filter(f => allowedFuncionarioIds.includes(f.id));
        const areaIds = funcionariosAPI
          .map(f => f.area_id)
          .filter((id): id is number => !!id);

        areasAPI = areasAPI.filter(a => areaIds.includes(a.id));
        atividadesAPI = atividadesAPI.filter(a => a.area_id != null && areaIds.includes(a.area_id));
      }

      const distribPorFuncionario: Distribuicoes = {};
      distribuicoesReais.forEach((d) => {
        const funcionarioId = d.funcionario_id != null ? String(d.funcionario_id) : undefined;
        if (!funcionarioId) return;
        if (!distribPorFuncionario[funcionarioId]) {
          distribPorFuncionario[funcionarioId] = [];
        }
        distribPorFuncionario[funcionarioId].push({
          atividade_id: d.atividade_id ?? 0,
          frequencia: d.frequencia ?? "",
          duracao_ocorrencia_horas: d.duracao_ocorrencia_horas ?? 0,
          quantidade_ocorrencias: d.quantidade_ocorrencias ?? 0,
        });
      });

      setAreas(areasAPI);
      setFuncionarios(funcionariosAPI);
      setAtividades(atividadesAPI);
      setDistribuicoes(distribPorFuncionario);

      if (areasAPI.length > 0) {
        const unidadeDefault = funcionariosAPI[0]?.unidade || "";
        setUnidadeSelecionada(unidadeDefault);
        const primeiraArea = areasAPI.find((a) =>
          funcionariosAPI.some((f) => f.area_id === a.id && f.unidade === unidadeDefault)
        );
        if (primeiraArea) setAreaId(primeiraArea.id.toString());
      }
    };
    carregarDados();
  }, [allowedFuncionarioIds, isAdmin]);

useEffect(() => {
  const carregarCentrosCusto = async () => {
    // ADMIN: filtra por unidade + área
    if (isAdmin && unidadeSelecionada && areaId) {
      const filtrados = funcionarios.filter(
        (f) =>
          f.unidade === unidadeSelecionada &&
          f.area_id === Number(areaId) &&
          typeof f.centro_custo === "string"
      );
      const unicos = Array.from(
        new Set(filtrados.map((f) => f.centro_custo!))
      ).sort();
      setCentrosCustoDisponiveis(unicos);
      setCentroCustoSelecionado("");
    }
    // NÃO-ADMIN: idem, se houver área selecionada
    else if (!isAdmin && unidadeSelecionada && areaId) {
      const filtrados = funcionarios.filter(
        (f) =>
          f.unidade === unidadeSelecionada &&
          f.area_id === Number(areaId)
      );
      const unicos = Array.from(
        new Set(
          filtrados
            .map((f) => f.centro_custo)
            .filter((cc): cc is string => !!cc)
        )
      ).sort();
      setCentrosCustoDisponiveis(unicos);
      // pré-seleciona o centro do próprio usuário, se existir
      const meu = filtrados.find((f) => f.id === usuario.funcionario_id)
        ?.centro_custo;
      if (meu) setCentroCustoSelecionado(meu);
    }
    // caso contrário limpa tudo
    else {
      setCentrosCustoDisponiveis([]);
      setCentroCustoSelecionado("");
    }
  };

  carregarCentrosCusto();
}, [isAdmin, unidadeSelecionada, areaId, funcionarios]);

  const unidades = Array.from(new Set(funcionarios.map((f) => f.unidade).filter(Boolean))) as string[];
  const areasFiltradas = unidadeSelecionada
    ? areas.filter((a) => funcionarios.some((f) => f.area_id === a.id && f.unidade === unidadeSelecionada))
    : [];
  const funcionariosFiltrados =
    areaId && centroCustoSelecionado
      ? funcionarios.filter(
          (f) =>
            f.area_id?.toString() === areaId &&
            f.centro_custo === centroCustoSelecionado
        )
      : [];
  const atividadesFiltradas = areaId ? atividades.filter((a) => a.area_id?.toString() === areaId) : [];

  const handleChange = (
    funcionario_id: string,
    atividade_id: number,
    campo: keyof DistribuicaoPorAtividade,
    valor: string | number
  ) => {
    setDistribuicoes((prev) => {
      const distribs = prev[funcionario_id] || [];
      const index = distribs.findIndex((d) => d.atividade_id === atividade_id);
      const novaDistribuicao = [...distribs];

      if (index >= 0) {
        novaDistribuicao[index] = {
          ...novaDistribuicao[index],
          [campo]: campo === "frequencia" ? String(valor) : Number(valor),
        };
      } else {
        novaDistribuicao.push({
          atividade_id,
          frequencia: campo === "frequencia" ? String(valor) : "",
          duracao_ocorrencia_horas: campo === "duracao_ocorrencia_horas" ? Number(valor) : 0,
          quantidade_ocorrencias: campo === "quantidade_ocorrencias" ? Number(valor) : 0,
        });
      }

      return { ...prev, [funcionario_id]: novaDistribuicao };
    });
  };

  const handleSalvar = async (funcionarioId: string) => {
    const distribs = distribuicoes[funcionarioId] || [];
    try {
      const response = await adapterSupabase.salvarDistribuicoes(funcionarioId, distribs);
      if (response?.error) throw response.error;
      toast.success("Distribuição salva com sucesso!");
    } catch {
      toast.error("Erro ao salvar a distribuição.");
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 px-8 py-6 transition-colors">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-4xl font-akkoMedium text-zinc-900 dark:text-white flex items-center gap-2">
            <SlidersHorizontal className="text-yellow-500" size={28} />
            Distribuição por Funcionário
          </h1>
          <div className="h-1 w-32 bg-yellow-400 mt-1 rounded" />
          <p className="text-sm text-zinc-500 dark:text-zinc-300 mt-2">
            Altere a alocação de atividades com duração, frequência e volume.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        <div>
          <Label>Unidade</Label>
          <Select value={unidadeSelecionada} onValueChange={(v) => {
            setUnidadeSelecionada(v);
            setAreaId("");
            setFuncionarioDrawerAberto(null);
          }}>
            <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
            <SelectContent>
              {unidades.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

      {unidadeSelecionada && (
        <div>
          <Label>Área</Label>
          <Select value={areaId} onValueChange={(v) => {
            setAreaId(v);
            setFuncionarioDrawerAberto(null);
          }}>
            <SelectTrigger><SelectValue placeholder="Selecione a área" /></SelectTrigger>
            <SelectContent>
              {areasFiltradas.map((a) => <SelectItem key={a.id} value={a.id.toString()}>{a.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {unidadeSelecionada && (
        <div>
          <Label>Centro de Custo</Label>
          {isAdmin ? (
            <Select value={centroCustoSelecionado} onValueChange={(v) => {
              setCentroCustoSelecionado(v);
              setFuncionarioDrawerAberto(null);
            }} disabled={centrosCustoDisponiveis.length === 0}>
              <SelectTrigger><SelectValue placeholder="Selecione o centro de custo" /></SelectTrigger>
              <SelectContent>
                {centrosCustoDisponiveis.map((cc) => <SelectItem key={cc} value={cc}>{cc}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Select
        value={centroCustoSelecionado}
        onValueChange={(v) => {
          setCentroCustoSelecionado(v);
          setFuncionarioDrawerAberto(null);
        }}
        disabled={centrosCustoDisponiveis.length === 0}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecione o centro de custo" />
        </SelectTrigger>
        <SelectContent>
          {centrosCustoDisponiveis.map((cc) => (
            <SelectItem key={cc} value={cc}>{cc}</SelectItem>
          ))}
        </SelectContent>
      </Select>

          )}
        </div>
      ) }
      </div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {funcionariosFiltrados.map((f) => {
    const distribs = distribuicoes[f.id] || [];
    const horasTotais = distribs.reduce((acc, d) => acc + ((d.duracao_ocorrencia_horas || 0) * (d.quantidade_ocorrencias || 0)), 0);
    const cargaHoraria = f.carga_horaria ?? 0;
    const ociosidade = cargaHoraria - horasTotais;
    const ociosidadePercentual = cargaHoraria > 0 ? (ociosidade / cargaHoraria) * 100 : 0;

    const alertas = distribs.map((d) => {
      const atividade = atividades.find((a) => a.id === d.atividade_id);
      const total = (d.duracao_ocorrencia_horas || 0) * (d.quantidade_ocorrencias || 0);
      const frequenciaCrítica = ["Mensal", "Bimestral", "Trimestral", "Eventual"];
      if (frequenciaCrítica.includes(d.frequencia) && total > (f.carga_horaria ?? 0) * 0.6) {
        return `⚠️ "${atividade?.nome}" ocupa ${total.toFixed(1)}h por mês, mas é apenas ${d.frequencia.toLowerCase()}.`;
      }
      return null;
    }).filter(Boolean);

    return (
      <Drawer key={f.id} open={funcionarioDrawerAberto === f.id.toString()} onOpenChange={(open) => {
        setFuncionarioDrawerAberto(open ? f.id.toString() : null);
      }}>
        <DrawerTrigger asChild>
          <Card className="cursor-pointer border-2 hover:shadow-lg transition">
            <CardContent className="p-4">
              <div className="font-semibold text-zinc-800 dark:text-white">{f.nome}</div>
              <p className="text-sm text-zinc-500">Carga Horária: {f.carga_horaria}h</p>
              <p className="text-sm text-zinc-500">Atividades atribuídas: {distribs.length}</p>
              <p className="text-sm text-zinc-500">Tempo estimado ocupado: {horasTotais.toFixed(1)}h</p>
              <p className="text-sm text-yellow-700">
                💤 Ociosidade: {ociosidade.toFixed(1)}h ({ociosidadePercentual.toFixed(1)}%)
              </p>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded mt-2">
                <div
                  className="h-2 rounded bg-yellow-500"
                  style={{ width: `${(horasTotais / (f.carga_horaria ?? 1)) * 100}%` }}
                />
              </div>
              {alertas.length > 0 && (
                <div className="mt-2 bg-yellow-50 border border-yellow-300 text-yellow-800 text-sm rounded p-2">
                  <strong>Inconsistências:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {alertas.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </DrawerTrigger>
        <DrawerContent className="p-6">
          <h2 className="text-xl font-semibold mb-4">Distribuição de {f.nome}</h2>
          <div className="space-y-4">
            {atividadesFiltradas.map((a) => {
              const current = distribuicoes[f.id]?.find((d) => d.atividade_id === a.id) || {
                duracao_ocorrencia_horas: 0,
                quantidade_ocorrencias: 0,
                frequencia: "",
              };

              const horasTotal = current.duracao_ocorrencia_horas * current.quantidade_ocorrencias;

              return (
                <div key={a.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-4">
                    <span className="w-1/4 text-zinc-800 dark:text-white">{a.nome}</span>

                    <Input
                      type="number"
                      min={0}
                      placeholder="Horas por ocorrência"
                      value={current.duracao_ocorrencia_horas || ""}
                      onChange={(e) =>
                        handleChange(f.id.toString(), a.id, "duracao_ocorrencia_horas", Number(e.target.value))
                      }
                      className="w-32"
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder="Ocorrências/mês"
                      value={current.quantidade_ocorrencias || ""}
                      onChange={(e) =>
                        handleChange(f.id.toString(), a.id, "quantidade_ocorrencias", Number(e.target.value))
                      }
                      className="w-24"
                    />
                    <Select
                      value={current.frequencia}
                      onValueChange={(v) =>
                        handleChange(f.id.toString(), a.id, "frequencia", v)
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Frequência" />
                      </SelectTrigger>
                      <SelectContent>
                        {opcoesFrequencia.map((freq) => (
                          <SelectItem key={freq} value={freq}>
                            {freq}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {horasTotal > 0 && (
                    <span className="text-xs text-zinc-500 ml-1">
                      🕒 Estimado: <strong>{horasTotal.toFixed(1)}h/mês</strong>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 text-right">
            <Button
              onClick={() => handleSalvar(f.id.toString())}
              className="bg-yellow-500 text-black font-akkoMedium px-6 py-2 hover:brightness-110"
            >
              Salvar Distribuição
            </Button>
            <Button
              variant="outline"
              className="mt-3 ml-3"
              onClick={async () => {
                const res = await adapterSupabase.limparDistribuicoes(f.id.toString());
                if (!res.error) {
                  toast.success("Distribuições removidas com sucesso.");
                  setDistribuicoes((prev) => ({ ...prev, [f.id.toString()]: [] }));
                } else {
                  toast.error("Erro ao limpar distribuições.");
                }
              }}
            >
              Limpar Distribuições
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    );
  })}
</div>

    </div>
  );
}