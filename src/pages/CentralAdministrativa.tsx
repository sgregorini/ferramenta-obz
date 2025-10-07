import { useEffect, useState } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { DialogTitle as DrawerTitle, DialogDescription as DrawerDescription } from "@radix-ui/react-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import * as XLSX from "xlsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Pencil, Trash2, PlusCircle, ShieldCheck, FileDown, ChevronsUpDown, Check, Loader2 } from "lucide-react";

import { supabase } from "../lib/supabase";
import { adapterSupabase } from "../adapters/adapterSupabase";
import { toast } from "sonner";
import { Funcionario, Area, Atividade, Distribuicao, Usuario } from "../types";

export default function CentralAdministrativa() {
  const [aba, setAba] = useState<"usuarios" | "funcionarios" | "areas" | "atividades">(
    "funcionarios"
  );
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isUserDrawerOpen, setIsUserDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [userData, setUserData] = useState({
    nome: "",
    email: "",
    senha: "",
    permissao: "",
    funcionario_id: "",
  });
  const [isFuncionarioPopoverOpen, setIsFuncionarioPopoverOpen] = useState(false);

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchDados();
  }, []);

  const fetchDados = async () => {
    try {
      const [{ data: users }, { data: func }, { data: ar }, { data: at }] = await Promise.all([
        supabase.from("usuarios").select("*").order("nome"),
        supabase.from("funcionarios").select("*").order("nome"),
        supabase.from("areas").select("*").order("nome"),
        supabase.from("atividades").select("*").order("nome"),
      ]);
      setUsuarios(users ?? []);
      setFuncionarios(func ?? []);
      setAreas(ar ?? []);
      setAtividades(at ?? []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  const handleExportarTudo = async () => {
    setExporting(true);
    toast.info("Iniciando exportação completa... Isso pode levar um momento.");

    try {
      const distribuicoesCompletas = await adapterSupabase.getDistribuicaoReal();
      
      // Busca adicional para garantir que temos a área de TODOS os funcionários
      const { data: todosFuncionarios } = await supabase.from("funcionarios").select('id, area_id');
      const { data: todasAreas } = await supabase.from("areas").select('id, nome');
      const areaMap = new Map(todasAreas?.map(a => [a.id, a.nome]));
      const funcionarioAreaMap = new Map(todosFuncionarios?.map(f => [f.id, areaMap.get(f.area_id ?? -1)]));


      if (!distribuicoesCompletas || distribuicoesCompletas.length === 0) {
        toast.warning("Nenhuma distribuição encontrada para exportar.");
        setExporting(false); // Garante que o estado de loading termine aqui
        return;
      }

      // Usamos um Map para garantir que cada funcionário apareça, mesmo sem distribuição.
      const funcionariosMap = new Map<string, { info: any; distribuicoes: any[] }>();

      distribuicoesCompletas.forEach((d: any) => {
        if (!funcionariosMap.has(d.funcionario_id)) {
          // Armazena a primeira ocorrência, que tem os dados do funcionário
          funcionariosMap.set(d.funcionario_id, { info: d, distribuicoes: [] });
        }
        // Adiciona a distribuição se ela existir (atividade_id não é nulo)
        if (d.atividade_id) {
          // Adiciona apenas as linhas que são de fato distribuições
          funcionariosMap.get(d.funcionario_id)!.distribuicoes.push(d);
        }
      });

      const dataParaExportar: any[] = [];
      const pendentesParaExportar: any[] = [];

      // Itera sobre o mapa de funcionários para separar os dados
      for (const { info, distribuicoes } of funcionariosMap.values()) {
        const primeiroItem = info; // Agora 'info' sempre tem os dados do funcionário

        // Verifica se o funcionário tem alguma atividade (se a primeira linha tem atividade_id)
        if (distribuicoes.length > 0) {
          // Se tem, adiciona todas as suas distribuições à lista principal
          distribuicoes.forEach(d => {
            dataParaExportar.push({
              "ID Distribuição": d.id,
              "ID Funcionário": d.funcionario_id, // Mantido para referência
              "Funcionário": d.funcionario_nome,
              "Cargo": d.funcionario_cargo,
              "Centro de Custo": d.funcionario_centro_custo,
              "Diretoria": d.area_nome_oficial,
              "Unidade": d.funcionario_unidade,
              "Gestor (Líder) ID": d.gestor_id,
              "Gestor (Líder) Nome": d.gestor_nome,
              "ID Atividade": d.atividade_id,
              "Atividade": d.atividade_nome,
              "Diretoria (Área)": d.area_nome_oficial,
              "Frequência": d.frequencia,
              "Horas/Ocorrência": d.duracao_ocorrencia_horas,
              "Ocorrências/Mês": d.quantidade_ocorrencias,
              "Total Horas/Mês": d.calculado_total_horas ?? 0,
            });
          });
        } else {
          // Se não tem, adiciona à lista de pendentes
          pendentesParaExportar.push({
            "ID Funcionário": primeiroItem.funcionario_id,
            "Funcionário Pendente": primeiroItem.funcionario_nome,
            "Cargo": primeiroItem.funcionario_cargo,
            "Centro de Custo": primeiroItem.funcionario_centro_custo,
            "Diretoria": funcionarioAreaMap.get(primeiroItem.funcionario_id) ?? "Sem diretoria",
            "Unidade": primeiroItem.funcionario_unidade,
            "Gestor (Líder) Nome": primeiroItem.gestor_nome,
          });
        }
      }

      const workbook = XLSX.utils.book_new();

      // Cria a planilha de dados consolidados
      const worksheetPrincipal = XLSX.utils.json_to_sheet(dataParaExportar);
      XLSX.utils.book_append_sheet(workbook, worksheetPrincipal, "Dados Consolidados");

      // Cria a planilha de pendentes, se houver
      if (pendentesParaExportar.length > 0) {
        const worksheetPendentes = XLSX.utils.json_to_sheet(pendentesParaExportar);
        XLSX.utils.book_append_sheet(workbook, worksheetPendentes, "Pendentes de Preenchimento");
      }

      XLSX.writeFile(workbook, "Exportacao_Completa_Plataforma.xlsx");
      toast.success("Exportação concluída! O download deve começar em breve.");
    } catch (error) {
      console.error("Erro ao exportar tudo:", error);
      toast.error("Ocorreu um erro durante a exportação.");
    } finally {
      setExporting(false);
    }
  };

  // ---------------- USUÁRIOS ----------------
  const handleSaveUsuario = async () => {
    if (!userData.nome || !userData.email || !userData.permissao) {
      toast.warning("Nome, e-mail e permissão são obrigatórios.");
      return;
    }

    if (editingUser) {
      // Editando
      const payload: Partial<Usuario> = {
        nome: userData.nome,
        email: userData.email,
        permissao: userData.permissao as any,
      };
      if (userData.senha) { // Só atualiza a senha se uma nova for digitada
        payload.senha_hash = userData.senha;
      }
      const { error } = await supabase.from("usuarios").update(payload).eq("id", editingUser.id);
      if (error) {
        toast.error("Erro ao atualizar usuário: " + error.message);
      } else {
        toast.success("Usuário atualizado com sucesso!");
        setIsUserDrawerOpen(false);
        setIsFuncionarioPopoverOpen(false);
        fetchDados();
      }
    } else {
      // Criando
      if (!userData.senha) {
        toast.warning("A senha é obrigatória para novos usuários.");
        return;
      }
      const { error } = await supabase.from("usuarios").insert({
        nome: userData.nome,
        email: userData.email,
        senha_hash: userData.senha,
        permissao: userData.permissao,
        funcionario_id: userData.funcionario_id || null,
        ativo: true,
        flag_acesso_sistema: true,
      });

      if (error) {
        toast.error("Erro ao criar usuário: " + error.message);
      } else {
        toast.success("Usuário criado com sucesso!");
        setIsUserDrawerOpen(false);
        setIsFuncionarioPopoverOpen(false);
        fetchDados();
      }
    }
  };

  const openUserDrawer = (user: Usuario | null) => {
    setEditingUser(user);
    setUserData(user ? { nome: user.nome ?? '', email: user.email, permissao: user.permissao ?? '', senha: '', funcionario_id: user.funcionario_id ?? '' } : { nome: '', email: '', senha: '', permissao: '', funcionario_id: '' });
    setIsUserDrawerOpen(true);
  };

  const handleDeleteUsuario = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este usuário? A ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("usuarios").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir usuário: " + error.message);
    else {
      toast.success("Usuário excluído.");
      fetchDados();
    }
  };

  // ---------------- FUNCIONÁRIOS ----------------
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

  // ---------------- ÁREAS ----------------
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
    .eq("id", id); // id é number mesmo
  if (error) console.error("Erro ao editar área:", error);
  else fetchDados();
};

  const handleDeleteArea = async (id: number) => {
  if (!confirm("Tem certeza que deseja excluir esta área?")) return;
  const { error } = await supabase.from("areas").delete().eq("id", id); // aqui id é number
  if (error) console.error("Erro ao excluir área:", error);
  else fetchDados();
};


  // ---------------- ATIVIDADES ----------------
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

  const handleEditAtividade = async (id: string) => {
  const atv = atividades.find((x) => x.id === id);
  if (!atv) return;
  const nome = prompt("Editar nome da atividade:", atv.nome);
  if (nome === null) return;
  const tipo = prompt("Editar tipo:", atv.tipo ?? "");
  if (tipo === null) return;
  const { error } = await supabase
    .from("atividades")
    .update({ nome, tipo })
    .eq("id", id); // aqui id é string (uuid)
  if (error) console.error("Erro ao editar atividade:", error);
  else fetchDados();
};

  const handleDeleteAtividade = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta atividade?")) return;
    const { error } = await supabase.from("atividades").delete().eq("id", id);
    if (error) console.error("Erro ao excluir atividade:", error);
    else fetchDados();
  };

  // ---------------- RENDER ----------------
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 px-8 py-6 transition-colors">
      <div className="mb-6">
        <h1 className="text-4xl font-akkoMedium text-zinc-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="text-yellow-500" size={28} />
          Central Administrativa
        </h1>
        <div className="h-1 w-32 bg-yellow-400 mt-1 rounded" />
        <p className="text-zinc-500 dark:text-zinc-300 mt-2">
          Crie, edite ou mantenha dados de estrutura organizacional da
          instituição.
        </p>
      </div>

      {/* Botão de Exportação Global */}
      <div className="mb-6">
        <Button
          variant="outline"
          className="text-blue-600 border-blue-600 hover:bg-blue-50 hover:text-blue-700"
          onClick={handleExportarTudo}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-2" size={18} />
          )}
          {exporting ? "Exportando..." : "Exportar Dados Consolidados"}
        </Button>
      </div>

      <Tabs value={aba} onValueChange={(value) => setAba(value as any)}>
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="funcionarios">Funcionários</TabsTrigger>
          <TabsTrigger value="areas">Áreas</TabsTrigger>
          <TabsTrigger value="atividades">Atividades</TabsTrigger>
        </TabsList>

        {/* USUÁRIOS */}
        <TabsContent value="usuarios">
          <Card className="mt-4">
            <CardContent className="p-4">
              <Drawer 
                open={isUserDrawerOpen} 
                onOpenChange={setIsUserDrawerOpen}
                modal={!isFuncionarioPopoverOpen} // <-- AQUI ESTÁ A CORREÇÃO
              >
                <div className="flex justify-between mb-4">
                  <h2 className="text-lg font-semibold">Usuários da Plataforma</h2>
                  <DrawerTrigger asChild>
                    <Button variant="outline" onClick={() => openUserDrawer(null)}>
                      <PlusCircle className="mr-2" size={16} /> Novo Usuário
                    </Button>
                  </DrawerTrigger>
                </div>
                <DrawerContent>
                  <div className="mx-auto w-full max-w-md p-4">
                    <div className="text-center">
                      <DrawerTitle>{editingUser ? "Editar Usuário" : "Novo Usuário"}</DrawerTitle>
                      <DrawerDescription>Preencha as informações abaixo.</DrawerDescription>
                    </div>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="nome">Nome</Label>
                        <Input id="nome" value={userData.nome} onChange={(e) => setUserData({ ...userData, nome: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="email">E-mail</Label>
                        <Input id="email" type="email" value={userData.email} onChange={(e) => setUserData({ ...userData, email: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="senha">Senha</Label>
                        <Input id="senha" type="password" value={userData.senha} onChange={(e) => setUserData({ ...userData, senha: e.target.value })} placeholder={editingUser ? "Deixe em branco para não alterar" : "Senha de acesso"} />
                      </div>
                      <div>
                        <Label htmlFor="permissao">Permissão</Label>
                        <Select value={userData.permissao} onValueChange={(value) => setUserData({ ...userData, permissao: value })}>
                          <SelectTrigger id="permissao">
                            <SelectValue placeholder="Selecione a permissão" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="preenchedor">Preenchedor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Funcionário Vinculado (Opcional)</Label>
                        <Popover open={isFuncionarioPopoverOpen} onOpenChange={setIsFuncionarioPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={isFuncionarioPopoverOpen}
                              className="w-full justify-between"
                            >
                              <span className="truncate">
                                {userData.funcionario_id
                                  ? funcionarios.find((f) => f.id === userData.funcionario_id)?.nome
                                  : "Selecione um funcionário..."}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[360px] p-0" side="top" align="start" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
                            <Command>
                              <CommandInput placeholder="Buscar funcionário..." />
                              <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
                              <CommandGroup className="max-h-60 overflow-y-auto">
                                {funcionarios.map((f) => (
                                  <CommandItem
                                    key={f.id}
                                    value={f.nome}
                                    onSelect={() => {
                                      setUserData({ ...userData, funcionario_id: userData.funcionario_id === f.id ? '' : f.id });
                                      setIsFuncionarioPopoverOpen(false);
                                    }}
                                  >
                                    <Check className={`mr-2 h-4 w-4 ${userData.funcionario_id === f.id ? "opacity-100" : "opacity-0"}`} />
                                    {f.nome}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-2">
                      <Button onClick={handleSaveUsuario}>Salvar</Button>
                      <Button variant="outline" onClick={() => setIsUserDrawerOpen(false)}>Cancelar</Button>
                    </div>
                  </div>
                </DrawerContent>
              </Drawer>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {usuarios.map((u) => (
                  <div key={`user-${u.id}`} className="border p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition">
                    <p className="text-sm font-medium"><strong>Nome:</strong> {u.nome ?? "-"}</p>
                    <p className="text-sm text-muted-foreground"><strong>Email:</strong> {u.email ?? "-"}</p>
                    <p className="text-sm text-muted-foreground"><strong>Permissão:</strong> {u.permissao ?? "-"}</p>
                    {u.funcionario_id && <p className="text-xs text-muted-foreground"><strong>ID Func:</strong> {u.funcionario_id.slice(0,8)}...</p>}
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="ghost" onClick={() => openUserDrawer(u)}><Pencil size={16} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteUsuario(u.id)}><Trash2 size={16} /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FUNCIONÁRIOS */}
        <TabsContent value="funcionarios">
          <Card className="mt-4">
            <CardContent className="p-4">
              <div className="flex justify-between mb-4">
                <h2 className="text-lg font-semibold">Funcionários Cadastrados</h2>
                <Button variant="outline" onClick={handleNewFuncionario}>
                  <PlusCircle className="mr-2" size={16} /> Novo
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {funcionarios.map((f) => (
                    <div
                      key={`func-${f.id}`}
                      className="border p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition"
                  >
                    <p className="text-sm font-medium">
                      <strong>Nome:</strong> {f.nome ?? "-"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Cargo:</strong> {f.cargo ?? "-"}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditFuncionario(f.id)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteFuncionario(f.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ÁREAS */}
        <TabsContent value="areas">
          <Card className="mt-4">
            <CardContent className="p-4">
              <div className="flex justify-between mb-4">
                <h2 className="text-lg font-semibold">Áreas Cadastradas</h2>
                <Button variant="outline" onClick={handleNewArea}>
                  <PlusCircle className="mr-2" size={16} /> Nova
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {areas.map((a) => (
                   <div
                      key={`area-${a.id}`}
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditArea(a.id)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteArea(a.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ATIVIDADES */}
        <TabsContent value="atividades">
          <Card className="mt-4">
            <CardContent className="p-4">
              <div className="flex justify-between mb-4">
                <h2 className="text-lg font-semibold">Atividades Cadastradas</h2>
                <Button variant="outline" onClick={handleNewAtividade}>
                  <PlusCircle className="mr-2" size={16} /> Nova
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {atividades.map((at) => (
                  <div
                    key={`atv-${at.id}`}
                    className="border p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition"
                  >
                    <p className="text-sm font-medium">
                      <strong>Atividade:</strong> {at.nome}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Tipo:</strong> {at.tipo ?? "-"}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditAtividade(at.id)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteAtividade(at.id)}
                      >
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
