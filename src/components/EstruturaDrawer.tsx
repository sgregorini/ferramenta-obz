import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { UserCircle, UserPlus, ShieldCheck, X, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Funcionario, Area } from "../types";

interface Props {
  id: string; // ID do responsável inicial (topo)
  onClose: () => void;
  filtroUnidade: boolean;
  areaFiltrada?: Area;
  centroCustoSelecionado?: string; // nome do centro clicado
  unidadeSelecionada?: string; // ⬅️ Adicionada
}

export default function EstruturaDrawer({
  id,
  onClose,
  centroCustoSelecionado,
  unidadeSelecionada, // ⬅️ Adicionada
}: Props) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [currentId, setCurrentId] = useState<string>(id);
  const [centro, setCentro] = useState<Funcionario | null>(null);
  const [subordinados, setSubordinados] = useState<Funcionario[]>([]);
  const [gestor, setGestor] = useState<Funcionario | null>(null);
  const [hoverVoltar, setHoverVoltar] = useState(false);
  const [topoDiretoriaId, setTopoDiretoriaId] = useState<string | null>(null);
  
  // Use as props para definir os filtros
  const [filtroUnidadeAtual, setFiltroUnidadeAtual] = useState<string | null>(
    unidadeSelecionada || null
  );
  const [filtroCCAtual, setFiltroCCAtual] = useState<string | null>(
    centroCustoSelecionado || null
  );
  const [filtroAreaAtual, setFiltroAreaAtual] = useState<number | null>(null);

  useEffect(() => {
    setCurrentId(id);
    setFiltroCCAtual(centroCustoSelecionado || null);
    setFiltroUnidadeAtual(unidadeSelecionada || null);
  }, [id, centroCustoSelecionado, unidadeSelecionada]);

  useEffect(() => {
    async function carregarDados() {
      // 1. Busca todos os funcionários
      const { data: allFuncs, error: errFuncs } = await supabase
        .from("funcionarios")
        .select("*");
      if (errFuncs || !allFuncs) return;
      setFuncionarios(allFuncs);

      const responsavel = allFuncs.find((f) => f.id === currentId) || null;
      setCentro(responsavel);

      if (!responsavel) {
        setSubordinados([]);
        setGestor(null);
        return;
      }
      
      // Filtra a lista completa de funcionários com base no contexto
      const funcionariosFiltrados = allFuncs.filter((f) => {
        // Se um centro de custo foi selecionado, só mostra os funcionários daquela unidade e CC
        if (filtroCCAtual) {
          return f.unidade === filtroUnidadeAtual && f.centro_custo === filtroCCAtual;
        }
        // Caso contrário, considera apenas a unidade para o filtro
        return f.unidade === filtroUnidadeAtual;
      });

      // Monta o mapa de filhos com base nos funcionários filtrados
      const childrenMap: Record<string, Funcionario[]> = {};
      funcionariosFiltrados.forEach((f) => {
        if (f.responde_para) {
          childrenMap[f.responde_para] = childrenMap[f.responde_para] || [];
          childrenMap[f.responde_para].push(f);
        }
      });
      
      let nivel1 = childrenMap[responsavel.id] || [];
      nivel1 = Array.from(new Map(nivel1.map((f) => [f.id, f])).values());
      nivel1.sort((a, b) => {
        const countA = (childrenMap[a.id] || []).length;
        const countB = (childrenMap[b.id] || []).length;
        if (countB !== countA) return countB - countA;
        return (a.nome || "").localeCompare(b.nome || "");
      });
      setSubordinados(nivel1);

      // Encontra o gestor apenas dentro da hierarquia filtrada
      const directGestor = responsavel.responde_para
        ? funcionariosFiltrados.find((f) => f.id === responsavel.responde_para) || null
        : null;
      setGestor(directGestor);
      
      // Adicionado: Lógica para o topo da hierarquia, usando os funcionários filtrados
      let topo = responsavel;
      const visit = new Set<string>();
      while (topo.responde_para && !visit.has(topo.id)) {
        visit.add(topo.id);
        const supF = funcionariosFiltrados.find((f) => f.id === topo.responde_para);
        if (!supF) break;
        topo = supF;
      }
      setTopoDiretoriaId(topo.id);
    }
    carregarDados();
  }, [currentId, filtroCCAtual, filtroUnidadeAtual]);

  const getIcon = (cargo?: string) => {
    const safe = (cargo || "").toLowerCase();
    if (safe.includes("gerente"))
      return (
        <ShieldCheck className="w-8 h-8 mb-2 text-yellow-600" />
      );
    if (safe.includes("supervisor"))
      return <UserPlus className="w-8 h-8 mb-2 text-blue-600" />;
    return (
      <UserCircle className="w-8 h-8 mb-2 text-zinc-600 dark:text-zinc-300" />
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.3 }}
        className="fixed top-0 right-0 w-full md:w-[600px] h-full bg-white dark:bg-zinc-900 shadow-lg z-50 p-6 overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Estrutura Hierárquica
          </h1>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {centro && (
          <div className="flex flex-col items-center">
            {/* Card do responsável */}
            <div className="relative bg-yellow-400 text-black px-6 py-5 rounded-3xl shadow-xl mb-4 flex flex-col items-center border-2 border-yellow-500 scale-[1.03]">
              <ShieldCheck className="w-10 h-10 mb-2 text-yellow-800" />
              <div className="text-lg font-bold uppercase tracking-wide">
                {centro.nome}
              </div>
              <div className="text-sm">{centro.cargo}</div>
              <div className="absolute top-2 right-4 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow">
                {centroCustoSelecionado
                  ? "Membros do Centro"
                  : "Gestor Atual"}
              </div>
            </div>

            {/* Botão voltar */}
            {gestor && currentId !== id && (
              <div
                className="relative mb-4 flex items-center justify-center group cursor-pointer"
                onClick={() => {
                  setCurrentId(gestor.id);
                  setHoverVoltar(false);
                }}
                onMouseEnter={() => setHoverVoltar(true)}
                onMouseLeave={() => setHoverVoltar(false)}
              >
                <ArrowLeft className="text-blue-600 group-hover:scale-110 transition-transform duration-200" />
                {hoverVoltar && (
                  <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    className="ml-2 text-sm text-blue-600 font-medium"
                  >
                    Voltar
                  </motion.span>
                )}
              </div>
            )}

            {/* Título da seção */}
            <h2 className="text-zinc-700 dark:text-white font-semibold mb-4">
              {subordinados.length > 0
                ? centroCustoSelecionado
                  ? `Membros do Centro (${subordinados.length})`
                  : `Subordinado${
                      subordinados.length > 1 ? "s" : ""
                    } diretos:`
                : centroCustoSelecionado
                ? "Nenhum membro neste centro."
                : "Sem subordinados diretos."}
            </h2>

            {/* Lista de subordinados */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              {subordinados.map((sub) => {
                // Ajuste aqui para calcular a contagem de subordinados com base nos funcionários filtrados
                const countSub = funcionarios.filter(f => f.responde_para === sub.id && f.unidade === filtroUnidadeAtual && f.centro_custo === filtroCCAtual).length;
                return (
                  <motion.div
                    key={sub.id} // ✅ chave única corrigida
                    whileHover={{ scale: 1.03 }}
                    className="relative bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-600 p-4 rounded-3xl text-center shadow-sm hover:shadow-md transition-all flex flex-col items-center ring-1 ring-transparent hover:ring-yellow-300"
                    onClick={() => setCurrentId(sub.id)}
                  >
                    {getIcon(sub.cargo)}
                    <div className="font-semibold text-zinc-800 dark:text-white leading-tight text-sm uppercase">
                      {sub.nome}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {sub.cargo}
                    </div>
                    {countSub > 0 && (
                      <span className="absolute bottom-2 right-2 bg-yellow-500 text-white text-[10px] px-1 rounded-full">
                        {countSub}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}