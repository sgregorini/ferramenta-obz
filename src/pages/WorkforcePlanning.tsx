import { useEffect, useState } from "react";
import { adapterSupabase } from "../adapters/adapterSupabase";
import { Area, Funcionario, Atividade, Distribuicao } from "../types";
import EstruturaSimuladaEditor from "@/components/WorkforcePlanning/EstruturaSimuladaEditor";
import AtividadesSimuladasEditor from "@/components/WorkforcePlanning/AtividadesSimuladasEditor";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function WorkforcePlanning() {
  const [modo, setModo] = useState<"estrutura" | "atividades" | "distribuicoes">("estrutura");
  const [simulacoes, setSimulacoes] = useState<{ simulacao_nome: string; criado_em: string }[]>([]);
  const [simulacaoSelecionada, setSimulacaoSelecionada] = useState<string | null>(null);

  const [estrutura, setEstrutura] = useState<Funcionario[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [distribuicoes, setDistribuicoes] = useState<Distribuicao[]>([]);

  const carregarSimulacoes = async () => {
    const sims = await adapterSupabase.getNomesUnicosSimulacoes();
    setSimulacoes(sims);
  };

  const carregarSimulacao = async (nome: string) => {
    setSimulacaoSelecionada(nome);
    const { estrutura, atividades, distribuicoes } = await adapterSupabase.getSimulacaoCompleta(nome);
    setEstrutura(estrutura || []);
    setAtividades(atividades || []);
    setDistribuicoes(distribuicoes || []);
  };

  useEffect(() => {
    carregarSimulacoes();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Simulações Organizacionais</h1>
        <Button
          onClick={() => {
            const nome = prompt("Nome da nova simulação:");
            if (nome) {
              setSimulacaoSelecionada(nome);
              setEstrutura([]);
              setAtividades([]);
              setDistribuicoes([]);
            }
          }}
        >
          + Nova Simulação
        </Button>
      </div>

      <div className="max-w-sm">
        <Select onValueChange={carregarSimulacao}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma simulação" />
          </SelectTrigger>
          <SelectContent>
            {simulacoes.map((s, idx) => (
              <SelectItem key={idx} value={s.simulacao_nome}>
                {s.simulacao_nome} ({new Date(s.criado_em).toLocaleDateString()})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {modo === "estrutura" && <EstruturaSimuladaEditor />}
      {modo === "atividades" && <AtividadesSimuladasEditor />}
      {modo === "distribuicoes" && <DistribuicoesSimuladasEditor />}

      {simulacaoSelecionada && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold mb-2">Estrutura</h2>
              <ul className="text-sm space-y-1">
                {estrutura.map((f) => (
                  <li key={f.id}>{f.nome} — {f.cargo}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold mb-2">Atividades</h2>
              <ul className="text-sm space-y-1">
                {atividades.map((a) => (
                  <li key={a.id}>{a.nome}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold mb-2">Distribuições</h2>
              <ul className="text-sm space-y-1">
                {distribuicoes.map((d, idx) => (
                  <li key={idx}>F{d.funcionario_id} - A{d.atividade_id}: {d.percentual}%</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
