import { useEffect, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { DialogTitle as DrawerTitle, DialogDescription as DrawerDescription } from "@radix-ui/react-dialog";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue} from "../components/ui/select";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Drawer, DrawerContent, DrawerTrigger } from "../components/ui/drawer";
import { Popover, PopoverTrigger, PopoverContent } from "../components/ui/popover";
import { Checkbox } from "../components/ui/checkbox";
import { PlusCircle, Pencil, Trash2, ListTodo } from "lucide-react";
import { apiAdapter } from "../adapters/apiAdapter";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { Usuario, Area, Atividade, Atividade_Modelo } from "../types";

interface Props {
  usuario: Usuario;
}

export default function CadastroAtividadesNovaVisao({ usuario }: Props) {
  const isAdmin = usuario.permissao === "admin";

  const [allowedFuncionarioIds, setAllowedFuncionarioIds] = useState<string[]>([]);
  const [unidadesDisponiveis, setUnidadesDisponiveis] = useState<string[]>([]);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaSelecionada, setAreaSelecionada] = useState("");
  const [centrosCustoDisponiveis, setCentrosCustoDisponiveis] = useState<string[]>([]);
  const [centrosCustoSelecionados, setCentrosCustoSelecionados] = useState<string[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);

  const [openDrawer, setOpenDrawer] = useState(false);
  const [atividade, setAtividade] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("");
  const [cliente, setCliente] = useState("");
  const [recursos, setRecursos] = useState("");
  const [atividadeEditando, setAtividadeEditando] = useState<Atividade | null>(null);
  const [tipoFiltroModelo, setTipoFiltroModelo] = useState<string>("todos");
  const [nivelFiltroModelo, setNivelFiltroModelo] = useState<string>("todos");
  const [modelosDisponiveis, setModelosDisponiveis] = useState<Atividade_Modelo[]>([]);
  const [mostrarModelos, setMostrarModelos] = useState(false);

  useEffect(() => {
    if (openDrawer && !atividadeEditando) {
      setAtividade("");
      setDescricao("");
      setTipo("");
      setCliente("");
      setRecursos("");
      setMostrarModelos(false);
      setTipoFiltroModelo("todos");
      setNivelFiltroModelo("todos");
      setModelosDisponiveis([]);
    }
  }, [openDrawer, atividadeEditando]);

  async function carregarModelos() {
    const { data, error } = await supabase
      .from("atividades_modelo")
      .select("*")
      .ilike("tipo", tipoFiltroModelo === "todos" ? "%" : tipoFiltroModelo)
      .ilike("nivel_cargo", nivelFiltroModelo === "todos" ? "%" : nivelFiltroModelo);

    if (error) {
      toast.error("Erro ao carregar modelos.");
      return;
    }
    setModelosDisponiveis(data || []);
  }

  async function carregarAtividadesFiltradas() {
    if (!areaSelecionada || centrosCustoSelecionados.length === 0) {
      setAtividades([]);
      return;
    }
    const { data, error } = await supabase
      .from("atividades")
      .select("*")
      .eq("area_id", Number(areaSelecionada))
      .in("centro_custo", centrosCustoSelecionados);

    if (error || !data) {
      toast.error("Erro ao carregar atividades.");
      return;
    }

    if (centrosCustoSelecionados.length === 1) {
      setAtividades(data as Atividade[]);
      return;
    }

    const atividadesPorCentro: Record<string, Atividade[]> = {};
    centrosCustoSelecionados.forEach((cc) => {
      atividadesPorCentro[cc] = (data as Atividade[]).filter((a) => a.centro_custo === cc);
    });

    const interseccao = atividadesPorCentro[centrosCustoSelecionados[0]].filter(
      (a) =>
        centrosCustoSelecionados
          .slice(1)
          .every((cc) =>
            atividadesPorCentro[cc].some((b) => b.nome === a.nome && b.tipo === a.tipo)
          )
    );

    setAtividades(interseccao);
  }

  async function getAllowedFuncionarioIds(funcionarioId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("vw_subordinados_recursivos")
      .select("id")
      .eq("root_id", funcionarioId);

    if (error || !data) {
      console.error("Erro ao buscar subordinados via view:", error);
      return [funcionarioId];
    }
    return Array.from(new Set(data.map((d) => d.id as string)));
  }

  useEffect(() => {
    (async () => {
      if (isAdmin) {
        const { data, error } = await supabase
          .from("funcionarios")
          .select("unidade")
          .not("unidade", "is", null);

        if (error || !data) {
          console.error(error);
          setUnidadesDisponiveis([]);
        } else {
          const unidades = Array.from(new Set(data.map((d) => d.unidade))).sort() as string[];
          setUnidadesDisponiveis(unidades);
        }
      } else if (usuario.funcionario_id) {
        const ids = await getAllowedFuncionarioIds(usuario.funcionario_id);
        setAllowedFuncionarioIds(ids);

        const { data, error } = await supabase
          .from("funcionarios")
          .select("unidade")
          .in("id", ids)
          .not("unidade", "is", null);

        if (error || !data) {
          console.error(error);
          setUnidadesDisponiveis([]);
        } else {
          const unidades = Array.from(new Set(data.map((d) => d.unidade))).sort() as string[];
          setUnidadesDisponiveis(unidades);
        }
      }
    })();
  }, [isAdmin, usuario.funcionario_id]);

  useEffect(() => {
    (async () => {
      if (!unidadeSelecionada) {
        setAreas([]);
        return;
      }
      let areaIds: number[] = [];

      if (isAdmin) {
        const { data, error } = await supabase
          .from("funcionarios")
          .select("area_id")
          .eq("unidade", unidadeSelecionada)
          .not("area_id", "is", null);

        if (!error && data) {
          areaIds = (data as { area_id: number | null }[])
            .map((d) => d.area_id!)
            .filter(Boolean) as number[];
        }
      } else if (allowedFuncionarioIds.length > 0) {
        const { data, error } = await supabase
          .from("funcionarios")
          .select("area_id")
          .eq("unidade", unidadeSelecionada)
          .in("id", allowedFuncionarioIds)
          .not("area_id", "is", null);

        if (!error && data) {
          areaIds = (data as { area_id: number | null }[])
            .map((d) => d.area_id!)
            .filter(Boolean) as number[];
        }
      }

      areaIds = Array.from(new Set(areaIds));
      if (areaIds.length === 0) {
        setAreas([]);
        return;
      }

      const todasAreas = await apiAdapter.getAreas();
      setAreas(todasAreas.filter((a: Area) => areaIds.includes(a.id)));
    })();
  }, [unidadeSelecionada, isAdmin, allowedFuncionarioIds]);

  useEffect(() => {
    (async () => {
      if (!unidadeSelecionada || !areaSelecionada) {
        setCentrosCustoDisponiveis([]);
        setCentrosCustoSelecionados([]);
        return;
      }

      let query = supabase
        .from("funcionarios")
        .select("centro_custo, id")
        .eq("unidade", unidadeSelecionada)
        .eq("area_id", Number(areaSelecionada))
        .not("centro_custo", "is", null);

      if (!isAdmin && allowedFuncionarioIds.length > 0) {
        query = query.in("id", allowedFuncionarioIds);
      }

      const { data, error } = await query;
      if (error || !data) return;

      const centros = Array.from(new Set((data as any[]).map((d) => d.centro_custo))).sort();
      setCentrosCustoDisponiveis(centros as string[]);
    })();
  }, [unidadeSelecionada, areaSelecionada, isAdmin, allowedFuncionarioIds]);

  useEffect(() => {
    (async () => {
      if (!areaSelecionada || centrosCustoSelecionados.length === 0) {
        setAtividades([]);
        return;
      }
      const { data, error } = await supabase
        .from("atividades")
        .select("*")
        .eq("area_id", Number(areaSelecionada))
        .in("centro_custo", centrosCustoSelecionados);

      if (error || !data) {
        toast.error("Erro ao carregar atividades.");
        return;
      }
      if (centrosCustoSelecionados.length === 1) {
        setAtividades(data as Atividade[]);
      } else {
        const porCentro: Record<string, Atividade[]> = {};
        centrosCustoSelecionados.forEach((cc) => {
          porCentro[cc] = (data as Atividade[]).filter((a) => a.centro_custo === cc);
        });
        const comum = porCentro[centrosCustoSelecionados[0]].filter((a) =>
          centrosCustoSelecionados.slice(1).every((cc) =>
            porCentro[cc].some((b) => b.nome === a.nome && b.tipo === a.tipo)
          )
        );
        setAtividades(comum);
      }
    })();
  }, [areaSelecionada, centrosCustoSelecionados]);

  const handleSalvar = async () => {
    if (!atividade || !descricao || !tipo || !cliente || !areaSelecionada || centrosCustoSelecionados.length === 0) {
      toast.warning("Preencha todos os campos obrigatórios.");
      return;
    }
    for (const cc of centrosCustoSelecionados) {
      const payload = {
        nome: atividade,
        descricao,
        tipo,
        cliente,
        recursos_necessarios: recursos,
        area_id: Number(areaSelecionada),
        centro_custo: cc,
      };

      let error;
      if (atividadeEditando) {
        ({ error } = await apiAdapter.updateAtividade(atividadeEditando.id, payload));
      } else {
        ({ error } = await apiAdapter.insertAtividade(payload));
      }

      if (error) {
        console.error(error);
        toast.error("Erro ao salvar atividade.");
        return;
      }
    }
    toast.success(atividadeEditando ? "Atividade atualizada com sucesso." : "Atividades criadas com sucesso.");
    setOpenDrawer(false);
    await carregarAtividadesFiltradas();
  };

  // >>> AQUI: id é string (UUID)
  const handleExcluir = async (id: string) => {
    const { error } = await apiAdapter.deleteAtividade(id);
    if (error) {
      toast.error("Erro ao excluir atividade.");
    } else {
      toast.success("Atividade excluída com sucesso.");
      await carregarAtividadesFiltradas();
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 px-8 py-6 transition-colors">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-4xl font-akkoMedium text-zinc-900 dark:text-white flex items-center gap-2">
            <ListTodo className="text-yellow-500" size={28} />
            Cadastro de Atividades
          </h1>
          <div className="h-1 w-32 bg-yellow-400 mt-1 rounded" />
          <p className="text-sm text-zinc-500 dark:text-zinc-300 mt-2">
            Crie, edite ou mantenha dados de estrutura organizacional da instituição.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Unidade */}
        <div className="flex-1">
          <Select onValueChange={setUnidadeSelecionada} value={unidadeSelecionada}>
            <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
            <SelectContent>
              {unidadesDisponiveis.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Área */}
        <div className="flex-1">
          <Select onValueChange={setAreaSelecionada} value={areaSelecionada} disabled={!unidadeSelecionada}>
            <SelectTrigger><SelectValue placeholder="Selecione a área" /></SelectTrigger>
            <SelectContent>
              {areas.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Popover de Centro de Custo + botão limpar */}
          <div className="flex-1 flex gap-2 items-start">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" disabled={centrosCustoDisponiveis.length === 0}>
                  {centrosCustoSelecionados.length > 0
                    ? `${centrosCustoSelecionados.length} centro(s) selecionado(s)`
                    : "Selecione centros de custo"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 max-h-64 overflow-y-auto p-2 space-y-1">
                {centrosCustoDisponiveis.map((cc) => (
                  <div key={cc} className="flex items-center gap-2 py-1">
                    <Checkbox
                      checked={centrosCustoSelecionados.includes(cc)}
                      onCheckedChange={(checked) => {
                        setCentrosCustoSelecionados((prev) =>
                          checked ? [...prev, cc] : prev.filter((c) => c !== cc)
                        );
                      }}
                    />
                    <label className="text-sm">{cc}</label>
                  </div>
                ))}
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:underline mt-[2px]"
              onClick={() => setCentrosCustoSelecionados([])}
              disabled={centrosCustoSelecionados.length === 0}
            >
              Limpar
            </Button>
          </div>


        {/* Botão Nova Atividade */}
        <Drawer open={openDrawer} onOpenChange={(open) => {
          setOpenDrawer(open);
          if (!open) {
            setAtividadeEditando(null);
          }
        }}>
          <DrawerTrigger asChild>
            <Button
              className="bg-yellow-400 text-black hover:brightness-110"
              disabled={!areaSelecionada || centrosCustoSelecionados.length === 0}
              onClick={() => {
                setAtividadeEditando(null); // <- limpa ANTES de abrir
                setOpenDrawer(true);        // <- abre o drawer
              }}
            >
              <PlusCircle className="mr-2" size={18} /> Nova Atividade
            </Button>
          </DrawerTrigger>
          <DrawerContent className="p-6 space-y-8 max-h-[90vh] overflow-y-auto overscroll-contain">

              {/* --- NOVO: Filtros para modelos --- */}
          <DrawerTitle>Nova Atividade</DrawerTitle>
          <DrawerDescription>Preencha ou selecione um modelo para agilizar o cadastro.</DrawerDescription>
            <div className="grid grid-cols-2 gap-2">
              <Select onValueChange={setTipoFiltroModelo} value={tipoFiltroModelo}>
                <SelectTrigger><SelectValue placeholder="Filtrar por tipo (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="Atendimento">Atendimento</SelectItem>
                  <SelectItem value="Exame">Exame</SelectItem>
                  <SelectItem value="Cirurgia">Cirurgia</SelectItem>
                  <SelectItem value="Administrativo">Administrativo</SelectItem>
                  <SelectItem value="Imagem">Imagem</SelectItem>
                  <SelectItem value="Laboratorio">Laboratório</SelectItem>
                  <SelectItem value="Pronto Atendimento">Pronto Atendimento</SelectItem>
                  <SelectItem value="Faturamento">Faturamento</SelectItem>
                  <SelectItem value="Manutencao">Manutenção</SelectItem>
                </SelectContent>
              </Select>

              <Select onValueChange={setNivelFiltroModelo} value={nivelFiltroModelo}>
                <SelectTrigger><SelectValue placeholder="Filtrar por nível (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="Operacional">Operacional</SelectItem>
                  <SelectItem value="Coordenacao">Coordenação</SelectItem>
                  <SelectItem value="Gerencia/Diretoria">Gerência/Diretoria</SelectItem>
                </SelectContent>
              </Select>
            </div>

          <div className="flex justify-center">
            <Button
              variant="default"
              className="bg-yellow-500 text-black hover:brightness-110 transition"
              onClick={() => {
                carregarModelos();
                setMostrarModelos(true);
              }}
            >
              🔍 Buscar Modelos Disponíveis
            </Button>
          </div>

            {/* --- NOVO: Lista de modelos filtrados --- */}

          {mostrarModelos && modelosDisponiveis.length > 0 && (
            <div
              className={`space-y-3 transition-all duration-300 w-full overflow-y-auto border border-zinc-300 dark:border-zinc-700 rounded-md p-4 bg-zinc-50 dark:bg-zinc-900 shadow-inner`}
              style={{ maxHeight: mostrarModelos ? '60vh' : '0', minHeight: mostrarModelos ? '200px' : '0' }}
            >
              {modelosDisponiveis.map((modelo) => (
                <div
                  key={modelo.id}
                  className="border rounded-md p-3 hover:bg-yellow-100 cursor-pointer transition"
                  onClick={() => {
                    setAtividade(modelo.nome);
                    setDescricao(modelo.descricao || "");
                    setTipo(modelo.tipo || "");
                    setCliente(modelo.cliente || "");
                    setRecursos(modelo.recursos_necessarios || "");
                    toast.success("Modelo aplicado!");
                  }}
                >
                  <p className="font-semibold">{modelo.nome}</p>
                  <p className="text-sm text-zinc-600">{modelo.descricao}</p>
                  <p className="text-xs text-zinc-500">
                    Tipo: {modelo.tipo} | Nível: {modelo.nivel_cargo}
                  </p>
                </div>
              ))}
            </div>
          )}


            <Input value={atividade} onChange={(e) => setAtividade(e.target.value)} placeholder="Nome da atividade*" />
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição*" />
            <Select onValueChange={setTipo} value={tipo}>
              <SelectTrigger><SelectValue placeholder="Tipo*" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Finalística">Finalística</SelectItem>
                <SelectItem value="Apoio">Apoio</SelectItem>
                <SelectItem value="Outros">Outros</SelectItem>
              </SelectContent>
            </Select>
            <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Cliente*" />
            <Textarea value={recursos} onChange={(e) => setRecursos(e.target.value)} placeholder="Recursos necessários" />
            <div className="flex justify-end">
              <Button onClick={handleSalvar} className="bg-yellow-500 text-black hover:brightness-110">
                Salvar
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {atividades.length > 0 ? (
        <Card className="shadow-md">
          <CardContent className="p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-600 dark:text-zinc-300 border-b">
                  <th className="py-2">Nome</th>
                  <th className="py-2">Tipo</th>
                  <th className="py-2">Cliente</th>
                  <th className="py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {atividades.map((a) => (
                  <tr key={a.id} className="border-b border-dashed border-zinc-200 dark:border-zinc-700">
                    <td className="py-2 text-zinc-900 dark:text-white">{a.nome}</td>
                    <td className="py-2 text-zinc-600 dark:text-zinc-400">{a.tipo}</td>
                    <td className="py-2 text-zinc-600 dark:text-zinc-400">{a.cliente}</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-blue-600"
                          onClick={() => {
                            setAtividade(a.nome);
                            setDescricao(a.descricao || "");
                            setTipo(a.tipo || "");
                            setCliente(a.cliente || "");
                            setRecursos(a.recursos_necessarios || "");
                            setAtividadeEditando(a);
                            setOpenDrawer(true);
                          }}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600"
                          onClick={() => handleExcluir(a.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : areaSelecionada && centrosCustoSelecionados.length > 0 ? (
        <p> Nenhuma atividade cadastrada ainda para esta área e centros de custo. </p>
      ) : null}
    </div>
  );
}
