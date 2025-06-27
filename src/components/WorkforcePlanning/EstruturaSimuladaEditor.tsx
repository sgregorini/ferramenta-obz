import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { adapterSupabase } from "@/adapters/adapterSupabase";

interface LinhaEstrutura {
  id?: number;
  simulacao_nome: string;
  funcionario_id: number;
  nova_area_id: number;
  novo_responsavel_id?: number;
}

export default function EstruturaSimuladaEditor({ simulacao }: { simulacao: string }) {
  const [linhas, setLinhas] = useState<LinhaEstrutura[]>([]);
  const [novoFuncionario, setNovoFuncionario] = useState("");
  const [novaArea, setNovaArea] = useState("");

  useEffect(() => {
    if (simulacao) carregarEstrutura();
  }, [simulacao]);

  const carregarEstrutura = async () => {
    const dados = await adapterSupabase.getSimulacaoCompleta(simulacao);
    setLinhas(dados.estrutura || []);
  };

  const adicionarLinha = () => {
    if (!novoFuncionario || !novaArea) return alert("Preencha os campos.");
    const nova: LinhaEstrutura = {
      simulacao_nome: simulacao,
      funcionario_id: parseInt(novoFuncionario),
      nova_area_id: parseInt(novaArea),
    };
    setLinhas([...linhas, nova]);
    setNovoFuncionario("");
    setNovaArea("");
  };

  const salvar = async () => {
    const { error } = await adapterSupabase.salvarEstruturaSimulada(simulacao, linhas);
    if (error) return alert("Erro ao salvar.");
    alert("Estrutura salva com sucesso!");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex gap-4">
            <Input
              placeholder="ID do funcionário"
              value={novoFuncionario}
              onChange={(e) => setNovoFuncionario(e.target.value)}
              className="w-1/3"
            />
            <Input
              placeholder="Nova área ID"
              value={novaArea}
              onChange={(e) => setNovaArea(e.target.value)}
              className="w-1/3"
            />
            <Button onClick={adicionarLinha}>Adicionar</Button>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th>Funcionário</th>
                <th>Nova Área</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha, i) => (
                <tr key={i} className="border-t">
                  <td className="py-2">{linha.funcionario_id}</td>
                  <td>{linha.nova_area_id}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <Button onClick={salvar} className="bg-yellow-500 hover:bg-yellow-400 text-black">
              Salvar Estrutura
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
