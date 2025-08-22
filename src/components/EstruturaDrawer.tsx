import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { UserCircle, UserPlus, ShieldCheck, X, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Funcionario, Area } from "../types";

interface Props {
  id: string; // ID do responsável inicial (topo)
  onClose: () => void;
  filtroUnidade?: boolean; // não usado, mantido por compat
  areaFiltrada?: Area;     // quando abrir pela diretoria
  centroCustoSelecionado?: string; // nome do centro clicado
  unidadeSelecionada?: string;     // hospital/unidade
}

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

export default function EstruturaDrawer({
  id,
  onClose,
  centroCustoSelecionado,
  unidadeSelecionada,
  areaFiltrada,
}: Props) {
  const [todos, setTodos] = useState<Funcionario[]>([]);
  const [escopo, setEscopo] = useState<Funcionario[]>([]);
  const [currentId, setCurrentId] = useState<string>(id);

  const [centro, setCentro] = useState<Funcionario | null>(null);
  const [subordinados, setSubordinados] = useState<Funcionario[]>([]);
  const [gestor, setGestor] = useState<Funcionario | null>(null);
  const [hoverVoltar, setHoverVoltar] = useState(false);
  const [topoDiretoriaId, setTopoDiretoriaId] = useState<string | null>(null);

  // Filtros controlados (unidade/cc podem vir das props; unidade pode ser inferida do responsável)
  const [filtroUnidadeAtual, setFiltroUnidadeAtual] = useState<string | null>(
    unidadeSelecionada || null
  );
  const [filtroCCAtual, setFiltroCCAtual] = useState<string | null>(
    centroCustoSelecionado || null
  );

  useEffect(() => {
    setCurrentId(id);
    setFiltroCCAtual(centroCustoSelecionado || null);
    setFiltroUnidadeAtual(unidadeSelecionada || null);
  }, [id, centroCustoSelecionado, unidadeSelecionada]);

  useEffect(() => {
    async function carregar() {
      // 1) Puxa todos (independente de escopo). O escopo é aplicado abaixo.
      const { data: allFuncs, error } = await supabase
        .from("funcionarios")
        .select("*");
      if (error || !allFuncs) return;

      setTodos(allFuncs as Funcionario[]);

      // Responsável atual
      const responsavel = (allFuncs as Funcionario[]).find((f) => f.id === currentId) || null;
      setCentro(responsavel);

      if (!responsavel) {
        setEscopo([]);
        setSubordinados([]);
        setGestor(null);
        return;
      }

      // Se unidade não vier, infere do responsável
      const unidadeEmUso = filtroUnidadeAtual || responsavel.unidade || null;
      if (!filtroUnidadeAtual && unidadeEmUso) {
        setFiltroUnidadeAtual(unidadeEmUso);
      }

      // 2) Define escopo (lista filtrada) conforme modo:
      //    - Se vier CC -> unidade + CC
      //    - Se vier diretoria (areaFiltrada) -> unidade + area_id
      //    - Senão -> unidade
      const escopoFiltrado = (allFuncs as Funcionario[]).filter((f) => {
        const sameUn = unidadeEmUso ? norm(f.unidade) === norm(unidadeEmUso) : true;

        if (!sameUn) return false;

        if (filtroCCAtual) {
          return norm(f.centro_custo) === norm(filtroCCAtual);
        }

        if (areaFiltrada?.id) {
          // Escopo por diretoria (toda a área)
          return Number(f.area_id) === Number(areaFiltrada.id);
        }

        // fallback: só por unidade
        return true;
      });

      setEscopo(escopoFiltrado);

      // 3) Mapa de filhos dentro do escopo
      const childrenMap: Record<string, Funcionario[]> = {};
      escopoFiltrado.forEach((f) => {
        if (f.responde_para) {
          (childrenMap[f.responde_para] ||= []).push(f);
        }
      });

      // Subordinados diretos do atual
      let nivel1 = childrenMap[responsavel.id] || [];
      // remove duplicados e ordena
      nivel1 = Array.from(new Map(nivel1.map((f) => [f.id, f])).values()).sort((a, b) => {
        const ca = (childrenMap[a.id] || []).length;
        const cb = (childrenMap[b.id] || []).length;
        if (cb !== ca) return cb - ca;
        return (a.nome || "").localeCompare(b.nome || "");
      });
      setSubordinados(nivel1);

      // Gestor dentro do escopo
      const gest = responsavel.responde_para
        ? escopoFiltrado.find((f) => f.id === responsavel.responde_para) || null
        : null;
      setGestor(gest);

      // 4) Sobe até o topo DENTRO do escopo (útil pra breadcrumb futuro)
      let topo = responsavel;
      const visit = new Set<string>();
      while (topo.responde_para && !visit.has(topo.id)) {
        visit.add(topo.id);
        const supF = escopoFiltrado.find((f) => f.id === topo.responde_para);
        if (!supF) break;
        topo = supF;
      }
      setTopoDiretoriaId(topo?.id || null);
    }

    carregar();
    // areaFiltrada?.id entra pra re-aplicar quando abrir por diretoria
  }, [currentId, filtroCCAtual, filtroUnidadeAtual, areaFiltrada?.id]);

  // contador de filhos no ESCOPo
  const countFilhos = useMemo(() => {
    const map: Record<string, number> = {};
    escopo.forEach((f) => {
      if (f.responde_para) {
        map[f.responde_para] = (map[f.responde_para] || 0) + 1;
      }
    });
    return map;
  }, [escopo]);

  const getIcon = (cargo?: string) => {
    const safe = (cargo || "").toLowerCase();
    if (safe.includes("gerente")) return <ShieldCheck className="w-8 h-8 mb-2 text-yellow-600" />;
    if (safe.includes("supervisor")) return <UserPlus className="w-8 h-8 mb-2 text-blue-600" />;
    return <UserCircle className="w-8 h-8 mb-2 text-zinc-600 dark:text-zinc-300" />;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ duration: 0.3 }}
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
            {/* Card topo */}
            <div className="relative bg-yellow-400 text-black px-6 py-5 rounded-3xl shadow-xl mb-4 flex flex-col items-center border-2 border-yellow-500 scale-[1.03]">
              <ShieldCheck className="w-10 h-10 mb-2 text-yellow-800" />
              <div className="text-lg font-bold uppercase tracking-wide">{centro.nome}</div>
              <div className="text-sm">{centro.cargo}</div>
              <div className="absolute top-2 right-4 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow">
                {filtroCCAtual ? "Membros do Centro" : areaFiltrada ? "Diretoria" : "Gestor Atual"}
              </div>
            </div>

            {/* Botão voltar */}
            {gestor && currentId !== id && (
              <div
                className="relative mb-4 flex items-center justify-center group cursor-pointer"
                onClick={() => { setCurrentId(gestor.id); setHoverVoltar(false); }}
                onMouseEnter={() => setHoverVoltar(true)}
                onMouseLeave={() => setHoverVoltar(false)}
              >
                <ArrowLeft className="text-blue-600 group-hover:scale-110 transition-transform duration-200" />
                {hoverVoltar && (
                  <motion.span
                    initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -5 }}
                    className="ml-2 text-sm text-blue-600 font-medium"
                  >
                    Voltar
                  </motion.span>
                )}
              </div>
            )}

            {/* Título seção */}
            <h2 className="text-zinc-700 dark:text-white font-semibold mb-4">
              {subordinados.length > 0
                ? filtroCCAtual
                  ? `Membros do Centro (${subordinados.length})`
                  : `Subordinado${subordinados.length > 1 ? "s" : ""} diretos:`
                : filtroCCAtual
                ? "Nenhum membro neste centro."
                : "Sem subordinados diretos."}
            </h2>

            {/* Lista subordinados */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              {subordinados.map((sub) => {
                const qt = countFilhos[sub.id] || 0;
                return (
                  <motion.div
                    key={sub.id}
                    whileHover={{ scale: 1.03 }}
                    className="relative bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-600 p-4 rounded-3xl text-center shadow-sm hover:shadow-md transition-all flex flex-col items-center ring-1 ring-transparent hover:ring-yellow-300"
                    onClick={() => setCurrentId(sub.id)}
                  >
                    {getIcon(sub.cargo)}
                    <div className="font-semibold text-zinc-800 dark:text-white leading-tight text-sm uppercase">
                      {sub.nome}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{sub.cargo}</div>
                    {qt > 0 && (
                      <span className="absolute bottom-2 right-2 bg-yellow-500 text-white text-[10px] px-1 rounded-full">
                        {qt}
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
