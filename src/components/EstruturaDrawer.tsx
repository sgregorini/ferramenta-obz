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
}

export default function EstruturaDrawer({ id, onClose, filtroUnidade, areaFiltrada, centroCustoSelecionado }: Props) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [currentId, setCurrentId] = useState<string>(id);
  const [centro, setCentro] = useState<Funcionario | null>(null);
  const [subordinados, setSubordinados] = useState<Funcionario[]>([]);
  const [gestor, setGestor] = useState<Funcionario | null>(null);
  const [hoverVoltar, setHoverVoltar] = useState(false);
  const [topoDiretoriaId, setTopoDiretoriaId] = useState<string | null>(null);

  // Dados de filtro da view (unidade, cc, diretoria)
  const [filtroUnidadeAtual, setFiltroUnidadeAtual] = useState<string | null>(null);
  const [filtroCCAtual, setFiltroCCAtual] = useState<string | null>(null);
  const [filtroAreaAtual, setFiltroAreaAtual] = useState<number | null>(null);

  useEffect(() => { setCurrentId(id); }, [id]);

  useEffect(() => {
    async function carregarDados() {
      // 1. Busca todos os funcionários
      const { data: allFuncs, error: errFuncs } = await supabase.from("funcionarios").select("*");
      if (errFuncs || !allFuncs) return;
      setFuncionarios(allFuncs);

      // 2. Busca todos os vínculos do responsável na view
      const { data: vinculos, error: errVinc } = await supabase
        .from("vw_estrutura_completa")
        .select("unidade, centro_custo, area_id")
        .eq("funcionario_id", currentId);

      if (errVinc || !vinculos) return;

      // 3. Escolhe o vínculo correto
      let vinculo = vinculos[0] || null;
      if (centroCustoSelecionado) {
        vinculo =
          vinculos.find(v => v.centro_custo === centroCustoSelecionado) ||
          vinculos[0] ||
          null;
      }

      if (vinculo) {
        setFiltroUnidadeAtual(vinculo.unidade);
        setFiltroCCAtual(vinculo.centro_custo);
        setFiltroAreaAtual(vinculo.area_id ? Number(vinculo.area_id) : null); // ✅ conversão p/ number
      }

      // 4. Define o responsável atual
      const responsavel = allFuncs.find((f) => f.id === currentId) || null;
      setCentro(responsavel);
      if (!responsavel) return;

      // 5. Monta childrenMap filtrando pelo vínculo correto
      const childrenMap: Record<string, Funcionario[]> = {};
      allFuncs
        .filter(f => {
          if (!vinculo) return true;

          // Se estou explorando um centro específico, filtra por unidade + CC + área
          if (centroCustoSelecionado) {
            return (
              f.unidade === vinculo.unidade &&
              f.centro_custo === vinculo.centro_custo &&
              Number(f.area_id) === Number(vinculo.area_id) // ✅ comparando números
            );
          }

          // Se estou no nível de diretoria, não restringe por CC/área
          return f.unidade === vinculo.unidade;
        })
        .forEach((f) => {
          if (f.responde_para) {
            childrenMap[f.responde_para] = childrenMap[f.responde_para] || [];
            childrenMap[f.responde_para].push(f);
          }
        });

      const nivel1 = childrenMap[responsavel.id] || [];

      // 6. Ordena por quantidade de subordinados e nome
      nivel1.sort((a, b) => {
        const countA = (childrenMap[a.id] || []).length;
        const countB = (childrenMap[b.id] || []).length;
        if (countB !== countA) return countB - countA;
        return (a.nome || "").localeCompare(b.nome || "");
      });

      setSubordinados(nivel1);

      // 7. Define gestor (parent)
      const directGestor = responsavel.responde_para
        ? allFuncs.find((f) => f.id === responsavel.responde_para) || null
        : null;
      setGestor(directGestor);

      // 8. Calcula topo da diretoria
      let topo = responsavel;
      const visit = new Set<string>();
      while (topo.responde_para && !visit.has(topo.id)) {
        visit.add(topo.id);
        const supF = allFuncs.find((f) => f.id === topo.responde_para);
        if (!supF) break;
        topo = supF;
      }
      setTopoDiretoriaId(topo.id);
    }
    carregarDados();
  }, [currentId, centroCustoSelecionado]);

  const getIcon = (cargo?: string) => {
    const safe = (cargo || "").toLowerCase();
    if (safe.includes("gerente")) return <ShieldCheck className="w-8 h-8 mb-2 text-yellow-600" />;
    if (safe.includes("supervisor")) return <UserPlus className="w-8 h-8 mb-2 text-blue-600" />;
    return <UserCircle className="w-8 h-8 mb-2 text-zinc-600 dark:text-zinc-300" />;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.3 }}
        className="fixed top-0 right-0 w-full md:w-[600px] h-full bg-white dark:bg-zinc-900 shadow-lg z-50 p-6 overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Estrutura Hierárquica</h1>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
            <X size={24} />
          </button>
        </div>

        {centro && (
          <div className="flex flex-col items-center">
            {/* Card do responsável */}
            <div className="relative bg-yellow-400 text-black px-6 py-5 rounded-3xl shadow-xl mb-4 flex flex-col items-center border-2 border-yellow-500 scale-[1.03]">
              <ShieldCheck className="w-10 h-10 mb-2 text-yellow-800" />
              <div className="text-lg font-bold uppercase tracking-wide">{centro.nome}</div>
              <div className="text-sm">{centro.cargo}</div>
              <div className="absolute top-2 right-4 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow">
                {centroCustoSelecionado ? 'Membros do Centro' : 'Gestor Atual'}
              </div>
            </div>

            {/* Botão voltar */}
            {gestor && currentId !== id && (
              <div
                className="relative mb-4 flex items-center justify-center group cursor-pointer"
                onClick={() => { setCurrentId(gestor.id); setHoverVoltar(false); }}
                onMouseEnter={() => setHoverVoltar(true)} onMouseLeave={() => setHoverVoltar(false)}
              >
                <ArrowLeft className="text-blue-600 group-hover:scale-110 transition-transform duration-200" />
                {hoverVoltar && (
                  <motion.span initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -5 }} className="ml-2 text-sm text-blue-600 font-medium">
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
                  : `Subordinado${subordinados.length > 1 ? 's' : ''} diretos:`
                : centroCustoSelecionado
                ? 'Nenhum membro neste centro.'
                : 'Sem subordinados diretos.'}
            </h2>

            {/* Lista de subordinados */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              {subordinados.map((sub) => {
                const countSub = subordinados.filter((f) => f.responde_para === sub.id).length;
                return (
                  <motion.div
                    key={sub.id} // ✅ chave única corrigida
                    whileHover={{ scale: 1.03 }}
                    className="relative bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-600 p-4 rounded-3xl text-center shadow-sm hover:shadow-md transition-all flex flex-col items-center ring-1 ring-transparent hover:ring-yellow-300"
                    onClick={() => setCurrentId(sub.id)}
                  >
                    {getIcon(sub.cargo)}
                    <div className="font-semibold text-zinc-800 dark:text-white leading-tight text-sm uppercase">{sub.nome}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{sub.cargo}</div>
                    {countSub > 0 && <span className="absolute bottom-2 right-2 bg-yellow-500 text-white text-[10px] px-1 rounded-full">{countSub}</span>}
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
