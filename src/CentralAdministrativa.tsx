import { useEffect, useState } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, PlusCircle, ShieldCheck } from "lucide-react";

import { supabase } from "../lib/supabase";
import { Funcionario, Area, Atividade } from "../types";

export default function CentralAdministrativa() {
  const [aba, setAba] = useState<"funcionarios" | "areas" | "atividades">("funcionarios");
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);

  useEffect(() => {
    fetchDados();
  }, []);

  const fetchDados = async () => {
    try {
      const [{ data: func }, { data: ar }, { data: at }] = await Promise.all([
        supabase.from("funcionarios").select("*").order("nome"),
        supabase.from("areas").select("*").order("nome"),
        supabase.from("atividades").select("*").order("nome"),
      ]);
      setFuncionarios(func ?? []);
      setAreas(ar ?? []);
      setAtividades(at ?? []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  // CRUD básico via prompts
  const handleNewFuncionario = async () => {
    const nome = prompt("Digite o nome do novo funcionário:");
    if (!nome) return;
    const cargo = prompt("Digite o cargo do funcionário:");
    const { error } = await supabase
      .from("funcionarios")
      .insert({ nome, cargo })
      .single();
    if (error) console.error("Erro ao criar funcionário:", error);
    else fetchDados();
  };

  const handleEditFuncionario = async (id: string) => {
    const f = funcionarios.find((x) => x.id === id);
    if (!f) return;
    const nome = prompt("Editar nome:", f.nome ?? "");
    if (nome === null) return;
    const cargo = prompt("Editar cargo:", f.cargo ?? "");
    if (cargo === null) return;
    const { error } = await supabase
      .from("funcionarios")
      .update({ nome, cargo })
      .eq("id", id);
    if (error) console.error("Erro ao editar funcionário:", error);
    else fetchDados();
  };

  const handleDeleteFuncionario = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este funcionário?")) return;
    const { error } = await supabase.from("funcionarios").delete().eq("id", id);
    if (error) console.error("Erro ao excluir funcionário:", error);
    else fetchDados();
  };

  const handleNewArea = async () => {
    const nome = prompt("Digite o nome da nova área:");
    if (!nome) return;
    const responsavel = prompt("Digite o responsável pela área:");
    const { error } = await supabase
      .from("areas")
      .insert({ nome, responsavel })
      .single();
    if (error) console.error("Erro ao criar área:", error);
    else fetchDados();
  };

  const handleEditArea = async (id: number) => {
    const a = areas.find((x) => x.id === id);
    if (!a) return;
    const nome = prompt("Editar nome da área:", a.nome ?? "");
    if (nome === null) return;
    const responsavel = prompt("Editar responsável:", a.responsavel ?? "");
    if (responsavel === null) return;
    const { error } = await supabase
      .from("areas")
      .update({ nome, responsavel })
      .eq("id", id);
    if (error) console.error("Erro ao editar área:", error);
    else fetchDados();
  };

  const handleDeleteArea = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir esta área?")) return;
    const { error } = await supabase.from("areas").delete().eq("id", id);
    if (error) console.error("Erro ao excluir área:", error);
    else fetchDados();
  };

  const handleNewAtividade = async () => {
    const nome = prompt("Digite o nome da nova atividade:");
    if (!nome) return;
    const tipo = prompt("Digite o tipo da atividade:");
    const { error } = await supabase
      .from("atividades")
      .insert({ nome, tipo })
      .single();
    if (error) console.error("Erro ao criar atividade:", error);
    else fetchDados();
  };

  const handleEditAtividade = async (id: number) => {
    const atv = atividades.find((x) => x.id === id);
    if (!atv) return;
    const nome = prompt("Editar nome da atividade:", atv.nome);
    if (nome === null) return;
    const tipo = prompt("Editar tipo:", atv.tipo ?? "");
    if (tipo === null) return;
    const { error } = await supabase
      .from("atividades")
      .update({ nome, tipo })
      .eq("id", id);
    if (error) console.error("Erro ao editar atividade:", error);
    else fetchDados();
  };

  const handleDeleteAtividade = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir esta atividade?")) return;
    const { error } = await supabase.from("atividades").delete().eq("id", id);
    if (error) console.error("Erro ao excluir atividade:", error);
    else fetchDados();
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 px-8 py-6 transition-colors">
      <div className="mb-6">
        <h1 className="text-4xl font-akkoMedium text-zinc-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="text-yellow-500" size={28} />
          Central Administrativa
        </h1>
        <div className="h-1 w-32 bg-yellow-400 mt-1 rounded" />
        <p className="text-zinc-500 dark:text-zinc-300 mt-2">
          Crie, edite ou mantenha dados de estrutura organizacional da instituição.
        </p>
      </div>

      <Tabs value={aba} onValueChange={(value) => setAba(value as any)}>
        <TabsList>
          <TabsTrigger value="funcionarios">Funcionários</TabsTrigger>
          <TabsTrigger value="areas">Áreas</TabsTrigger>
          <TabsTrigger value="atividades">Atividades</TabsTrigger>
        </TabsList>

        <TabsContent value="funcionarios">
          <Card className="mt-4">
            <CardContent className="p-4">
              <div className="flex justify-between mb-4">
                <h2 className="text-lg font-semibold">Funcionários Cadastrados</h2>
                <Button variant="outline" onClick={handleNewFuncionario}>
                  <PlusCircle className="mr-2" size={16} />Novo
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {funcionarios.map((f) => (
                  <div
                    key={f.id}
                    className="border p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition"
                  >
                    <p className="text-sm font-medium">
                      <strong>Nome:</strong> {f.nome ?? "-"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Cargo:</strong> {f.cargo ?? "-"}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="ghost" onClick={() => handleEditFuncionario(f.id)}>
                        <Pencil size={16} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteFuncionario(f.id)}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="areas">
          <Card className="mt-4">
            <CardContent className="p-4">
              <div className="flex justify-between mb-4">
                <h2 className="text-lg font-semibold">Áreas Cadastradas</h2>
                <Button variant="outline" onClick={handleNewArea}>
                  <PlusCircle className="mr-2" size={16} />Nova
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {areas.map((a) => (
                  <div
                    key={a.id}
                    className="border p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition"
                  >
                    <p className="text-sm font-medium">
                      <strong>Nome:</strong> {a.nome}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Responsável:</strong> {a.responsavel ?? "-"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Status:</strong> {a.status}
                    </p>
                    <div className="flex gap-2 mt-2">

                      <Button size="sm" variant="ghost" onClick={() => handleEditArea(a.id)}>
                        <Pencil size={16} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteArea(a.id)}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="atividades">
          <Card className="mt-4">
            <CardContent className="p-4">
              <div className="flex justify-between mb-4">
                <h2 className="text-lg font-semibold">Atividades Cadastradas</h2>
                <Button variant="outline" onClick={handleNewAtividade}>
                  <PlusCircle className="mr-2" size={16} />Nova
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {atividades.map(at => (
                  <div key={at.id} className="border p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition">
                    <p className="text-sm font-medium"><strong>Atividade:</strong> {at.nome}</p>
                    <p className="text-sm text-muted-foreground"><strong>Tipo:</strong> {at.tipo ?? "-"}</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="ghost" onClick={() => handleEditAtividade(at.id)}>
                        <Pencil size={16} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteAtividade(at.id)}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}