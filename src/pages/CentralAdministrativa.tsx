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

import { adapterSupabase } from "../adapters/adapterSupabase";
import { Funcionario, Area, Atividade } from "../types";

export default function CentralAdministrativa() {
  const [aba, setAba] = useState("funcionarios");
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);

  useEffect(() => {
    fetchDados();
  }, []);

  const fetchDados = async () => {
    try {
      const [func, ar, at] = await Promise.all([
        adapterSupabase.getFuncionarios(),
        adapterSupabase.getAreas(),
        adapterSupabase.getAtividades(),
      ]);

      setFuncionarios(func);
      setAreas(ar);
      setAtividades(at);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
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

      <Tabs value={aba} onValueChange={setAba}>
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
                <Button variant="outline">
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
                      <strong>Nome:</strong> {f.nome}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Cargo:</strong> {f.cargo}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="ghost" className="text-blue-500 hover:text-blue-700">
                        <Pencil size={16} />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700">
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
                <Button variant="outline">
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
                      <strong>Responsável:</strong> {a.responsavel}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="ghost" className="text-blue-500 hover:text-blue-700">
                        <Pencil size={16} />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700">
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
                <Button variant="outline">
                  <PlusCircle className="mr-2" size={16} />Nova
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {atividades.map((at) => (
                  <div
                    key={at.id}
                    className="border p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition"
                  >
                    <p className="text-sm font-medium">
                      <strong>Atividade:</strong> {at.nome}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Tipo:</strong> {at.tipo}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="ghost" className="text-blue-500 hover:text-blue-700">
                        <Pencil size={16} />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700">
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
