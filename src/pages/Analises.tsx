import { useEffect, useState } from "react";
import { apiAdapter } from "../adapters/apiAdapter";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart as BarCharticon, BarChart3, Users, ActivitySquare, DollarSign } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Bar,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { Progress } from "@/components/ui/progress";
import { Area, Funcionario, Atividade, Distribuicao } from "../types"; // ou "@/types" se estiver com alias

const COLORS = ["#FFCC00", "#FFE066", "#FFD740", "#FFC300", "#FFB300"];
export default function Analises() {
  const [indicadores, setIndicadores] = useState<any[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaSelecionada, setAreaSelecionada] = useState<string | null>(null);
  const [graficoFTE, setGraficoFTE] = useState<{ cargo: string; fte: number }[]>([]);
  const [graficoAtividades, setGraficoAtividades] = useState<{ tipo: string; total: number }[]>([]);
  const [torreAtividades, setTorreAtividades] = useState<any[]>([]);

  useEffect(() => {
    buscarAreas();
  }, []);

  useEffect(() => {
    buscarIndicadores(areaSelecionada);
  }, [areaSelecionada]);
  const buscarAreas = async () => {
    const areas = await apiAdapter.getAreas();
    setAreas(areas);
  };

  const buscarIndicadores = async (areaId: string | null) => {
    const funcionarios = await apiAdapter.getFuncionarios();

    const funcionariosFiltrados = areaId
      ? funcionarios.filter((f: Funcionario) => f.area_id === parseInt(areaId))
      : funcionarios;

    const atividades = await apiAdapter.getAtividades();

    const atividadesFiltradas = areaId
      ? atividades.filter((a: Atividade) => a.area_id === parseInt(areaId))
      : atividades;

    const atividadesIds = atividadesFiltradas.map((a) => a.id);

    const distribuicoes = await apiAdapter.getDistribuicoesPorAtividadeIds(atividadesIds);
    const totalFTE = distribuicoes.reduce((acc, d: Distribuicao) => acc + d.percentual / 100, 0);
    const custoTotal = funcionariosFiltrados.reduce((acc, f: Funcionario) => acc + f.salario, 0);
    const produtividade = distribuicoes.length > 0
      ? (distribuicoes.filter((d) => d.percentual > 0).length / distribuicoes.length) * 100
      : 0;

    setIndicadores([
      {
        titulo: "Total de FTEs Atuais",
        valor: totalFTE.toFixed(2),
        icone: <Users className="w-6 h-6 text-yellow-500" />,
      },
      {
        titulo: "Custo Total da Área (R$)",
        valor: custoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        icone: <DollarSign className="w-6 h-6 text-yellow-500" />,
      },
      {
        titulo: "Atividades Ativas",
        valor: atividadesFiltradas.length.toString(),
        icone: <ActivitySquare className="w-6 h-6 text-yellow-500" />,
      },
      {
        titulo: "Produtividade Média",
        valor: `${produtividade.toFixed(0)}%`,
        icone: <BarChart3 className="w-6 h-6 text-yellow-500" />,
      },
    ]);

    const ftePorCargo: Record<string, number> = {};
    distribuicoes.forEach((d: Distribuicao) => {
      const funcionario = funcionarios.find((f: Funcionario) => f.id === d.funcionario_id);
      if (funcionario) {
        ftePorCargo[funcionario.cargo] = (ftePorCargo[funcionario.cargo] || 0) + d.percentual / 100;
      }
    });

    setGraficoFTE(Object.entries(ftePorCargo).map(([cargo, fte]) => ({ cargo, fte })));

    const tipoAtividadeCount: Record<string, number> = {};
    atividadesFiltradas.forEach((a: Atividade) => {
      tipoAtividadeCount[a.tipo] = (tipoAtividadeCount[a.tipo] || 0) + 1;
    });

    setGraficoAtividades(Object.entries(tipoAtividadeCount).map(([tipo, total]) => ({ tipo, total })));
    const custosPorAtividade: Record<number, number> = {};
    const prioridadesPorAtividade: Record<number, number> = {};

    distribuicoes.forEach((d: Distribuicao) => {
      const funcionario = funcionarios.find((f: Funcionario) => f.id === d.funcionario_id);
      const salario = funcionario?.salario || 0;
      const custo = (d.percentual / 100) * salario;

      custosPorAtividade[d.atividade_id] = (custosPorAtividade[d.atividade_id] || 0) + custo;
      if (prioridadesPorAtividade[d.atividade_id] === undefined) {
        prioridadesPorAtividade[d.atividade_id] = d.prioridade;
      }
    });

    const atividadesDetalhadas = atividadesFiltradas.map((a) => ({
      nome: a.nome || a.descricao || a.tipo,
      custo: custosPorAtividade[a.id] || 0,
      prioridade: prioridadesPorAtividade[a.id] ?? 9999,
    }));

    const totalGeral = atividadesDetalhadas.reduce((acc, a) => acc + a.custo, 0);

    const torre = atividadesDetalhadas
      .map((a) => ({
        nome: a.nome,
        valor: a.custo,
        percentual: totalGeral > 0 ? (a.custo / totalGeral) * 100 : 0,
        prioridade: a.prioridade,
      }))
      .sort((b, a) => a.prioridade - b.prioridade);

    setTorreAtividades(torre);
  };
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 px-8 py-6 transition-colors">
      <div className="mb-6">
        <h1 className="text-4xl font-akkoMedium text-zinc-900 dark:text-white flex items-center gap-2">
          <BarCharticon className="text-yellow-500" size={28} />
          Análises da Área
        </h1>
        <div className="h-1 w-32 bg-yellow-400 mt-1 rounded" />
        <p className="text-zinc-500 dark:text-zinc-300 mt-2 text-[20px]">
          Explore os indicadores da área, a distribuição de FTEs e os tipos de atividades registradas.
        </p>
      </div>

      <div className="max-w-xs mb-6">
        <Select onValueChange={setAreaSelecionada}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as Áreas</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.id.toString()}>
                {a.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {indicadores.map((item, index) => (
          <Card key={index} className="shadow-md">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-yellow-100 p-3 rounded-full">{item.icone}</div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-300">{item.titulo}</p>
                <p className="text-xl font-semibold text-gray-800 dark:text-white">{item.valor}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2 text-gray-800 dark:text-white">Distribuição de FTE por Cargo</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={graficoFTE} dataKey="fte" nameKey="cargo" outerRadius={100}>
                {graficoFTE.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2 text-gray-800 dark:text-white">Tipos de Atividades</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={graficoAtividades}>
              <XAxis dataKey="tipo" stroke="#888888" />
              <YAxis stroke="#888888" />
              <Tooltip />
              <Bar dataKey="total" fill="#FFCC00" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-6 mt-12">
        <h2 className="text-lg font-semibold mb-2 text-gray-800 dark:text-white">
          Torre de Atividades (Base mais relevante embaixo)
        </h2>
        <div className="space-y-4">
          {torreAtividades.map((item, i) => (
            <div key={i} className="flex flex-col">
              <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-300">
                <span>{item.nome}</span>
                <span>
                  {item.valor.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}{" "}
                  ({item.percentual.toFixed(1)}%)
                </span>
              </div>
              <Progress value={item.percentual} className="h-2 bg-gray-200" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
