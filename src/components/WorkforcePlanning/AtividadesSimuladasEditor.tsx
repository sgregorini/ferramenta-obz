import { useEffect, useState } from "react";
import { Atividade } from "types"
import { adapterSupabase } from "@/adapters/adapterSupabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  simulacao: string | null;
}

export default function AtividadesSimuladasEditor({ simulacao }: Props) {
  const [atividades, setAtividades] = useState<Partial<Atividade>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (simulacao) carregar();
  }, [simulacao]);

  const carregar = async () => {
    setLoading(true);
    const { atividades } = await adapterSupabase.getSimulacaoCompleta(simulacao!);
    setAtividades(atividades);
    setLoading(false);
  };

  const handleChange = (index: number, key: keyof Atividade, value: any) => {
    setAtividades((prev) => {
      const nova = [...prev];
      nova[index] = { ...nova[index], [key]: value };
      return nova;
    });
  };

  const salvar = async () => {
    if (!simulacao) return;
    const dados = atividades.map((a) => ({ ...a, simulacao_nome: simulacao }));
    const { error } = await adapterSupabase.salvarAtividadesSimuladas(simulacao, dados);
    if (error) alert("Erro ao salvar");
    else alert("Atividades simuladas salvas com sucesso");
  };

  return (
    <Card className="my-4">
      <CardContent className="p-4">
        <h2 className="text-xl font-semibold mb-4">Atividades Simuladas</h2>
        {loading ? (
          <p>Carregando...</p>
        ) : (
          <div className="space-y-4">
            {atividades.map((a, i) => (
              <div key={i} className="grid grid-cols-2 gap-4">
                <Input
                  value={a.nome || ""}
                  onChange={(e) => handleChange(i, "nome", e.target.value)}
                  placeholder="Nome"
                />
                <Input
                  value={a.descricao || ""}
                  onChange={(e) => handleChange(i, "descricao", e.target.value)}
                  placeholder="Descrição"
                />
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => setAtividades([...atividades, {}])}
            >
              + Nova Atividade
            </Button>
          </div>
        )}
        <div className="flex justify-end mt-4">
          <Button onClick={salvar} className="bg-yellow-500 text-black">
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
