import { useEffect, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../components/ui/select";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Drawer, DrawerContent, DrawerTrigger } from "../components/ui/drawer";
import { PlusCircle, Pencil, Trash2, ListTodo } from "lucide-react";
import { apiAdapter } from "../adapters/apiAdapter";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { Usuario, Area, Atividade } from "../types";

interface Props {
  usuario: Usuario;
}

export default function CadastroAtividadesNovaVisao({ usuario }: Props) {
  const isAdmin = usuario.permissao === "admin";

  const [areas, setAreas] = useState<Area[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState("");
  const [areaSelecionada, setAreaSelecionada] = useState("");

  const [atividade, setAtividade] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("");
  const [cliente, setCliente] = useState("");
  const [recursos, setRecursos] = useState("");

  const [openDrawer, setOpenDrawer] = useState(false);
  const [atividadeEditando, setAtividadeEditando] = useState<Atividade | null>(null);
  const [sugestoes, setSugestoes] = useState<Atividade[]>([]);
  const [mostrarTodas, setMostrarTodas] = useState(false);

  useEffect(() => {
    const carregarAreas = async () => {
      const data = await apiAdapter.getAreas();
      if (!Array.isArray(data)) return;

      const filtradas = isAdmin
        ? data
        : data.filter((a) => Number(a.responsavel_id) === Number(usuario.id));

      setAreas(filtradas);
    };
    carregarAreas();
  }, []);

  useEffect(() => {
    const carregarAtividades = async () => {
      if (!areaSelecionada) return;
      const todas: Atividade[] = await apiAdapter.getAtividades();
      const filtradas = todas.filter((a) => a.area_id === Number(areaSelecionada));
      setAtividades(filtradas);
    };
    carregarAtividades();
  }, [areaSelecionada]);

  useEffect(() => {
    if (!openDrawer) {
      setAtividade("");
      setDescricao("");
      setTipo("");
      setCliente("");
      setRecursos("");
      setAtividadeEditando(null);
      setMostrarTodas(false);
    } else {
      const carregarSugestoes = async () => {
        const { data, error } = await supabase.from("atividades_modelo").select("*");
        if (!error && data) setSugestoes(data);
      };
      carregarSugestoes();
    }
  }, [openDrawer]);

  const unidades = Array.from(new Set(areas.map((a) => a.unidade).filter(Boolean))) as string[];
  const areasFiltradas = areas.filter((a) => a.unidade === unidadeSelecionada);

  const handleSalvar = async () => {
    if (!atividade || !descricao || !tipo || !cliente || !areaSelecionada) {
      toast.warning("Preencha todos os campos obrigatórios.");
      return;
    }

    const payload = {
      nome: atividade,
      descricao,
      tipo,
      cliente,
      recursos_necessarios: recursos,
      area_id: Number(areaSelecionada),
    };

    let error;
    if (atividadeEditando) {
      ({ error } = await apiAdapter.updateAtividade(atividadeEditando.id, payload));
    } else {
      ({ error } = await apiAdapter.insertAtividade(payload));
    }

    if (error) {
      toast.error("Erro ao salvar atividade.");
      console.error(error);
    } else {
      toast.success(atividadeEditando ? "Atividade atualizada com sucesso." : "Atividade criada com sucesso.");
      setOpenDrawer(false);
      const todas: Atividade[] = await apiAdapter.getAtividades();
      const filtradas = todas.filter((a) => a.area_id === Number(areaSelecionada));
      setAtividades(filtradas);
    }
  };

  const handleExcluir = async (id: number) => {
    toast("Tem certeza que deseja excluir esta atividade?", {
      description: "Esta ação não poderá ser desfeita.",
      action: {
        label: "Confirmar exclusão",
        onClick: async () => {
          const { error } = await apiAdapter.deleteAtividade(id);
          if (error) {
            toast.error("Erro ao excluir atividade.");
            console.error(error);
          } else {
            toast.success("Atividade excluída com sucesso.");
            setAtividades((prev) => prev.filter((a) => a.id !== id));
          }
        },
      },
    });
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
        <div className="flex-1">
          <Select onValueChange={setUnidadeSelecionada} value={unidadeSelecionada}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a unidade" />
            </SelectTrigger>
            <SelectContent>
              {unidades.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Select onValueChange={setAreaSelecionada} value={areaSelecionada} disabled={!unidadeSelecionada}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a área" />
            </SelectTrigger>
            <SelectContent>
              {areasFiltradas.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>{a.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Drawer open={openDrawer} onOpenChange={setOpenDrawer}>
          <DrawerTrigger asChild>
            <Button className="bg-yellow-400 text-black hover:brightness-110" disabled={!areaSelecionada}>
              <PlusCircle className="mr-2" size={18} /> Nova Atividade
            </Button>
          </DrawerTrigger>
          <DrawerContent className="p-6 space-y-4">
            <h2 className="text-xl font-semibold">
              {atividadeEditando ? "Editar Atividade" : "Nova Atividade"}
            </h2>

            {sugestoes.length > 0 && (
              <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded-md mb-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-2">Sugestões de atividades:</p>
                <div className="grid gap-2">
                  {(mostrarTodas ? sugestoes : sugestoes.slice(0, 5)).map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setAtividade(s.nome);
                        setDescricao(s.descricao || "");
                        setTipo(s.tipo || "");
                        setCliente(s.cliente || "");
                        setRecursos(s.recursos_necessarios || "");
                      }}
                      className="text-left bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 p-2 rounded hover:bg-yellow-100 dark:hover:bg-zinc-700 transition"
                    >
                      <p className="font-medium text-zinc-800 dark:text-zinc-100">{s.nome}</p>
                      {s.descricao && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">{s.descricao}</p>
                      )}
                    </button>
                  ))}
                  {sugestoes.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-yellow-600 mt-2 hover:underline"
                      onClick={() => setMostrarTodas((prev) => !prev)}
                    >
                      {mostrarTodas ? "Mostrar menos" : "Ver todas as sugestões"}
                    </Button>
                  )}
                </div>
              </div>
            )}

            <Input value={atividade} onChange={(e) => setAtividade(e.target.value)} placeholder="Nome da atividade*" />
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição*" />
            <Select onValueChange={setTipo} value={tipo}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo*" />
              </SelectTrigger>
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
                            setTipo(a.tipo);
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
      ) : areaSelecionada ? (
        <p className="text-zinc-500 dark:text-zinc-400">Nenhuma atividade cadastrada ainda para esta área.</p>
      ) : null}
    </div>
  );
}