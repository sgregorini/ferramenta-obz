import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { UserCircle, UserPlus, ShieldCheck, X, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Funcionario, Area } from "../types";

interface Props {
  id: string;                    // ID usado como raiz quando abre por CC ou fallback quando abre por diretoria
  onClose: () => void;
  areaFiltrada?: Area;           // quando abre pela diretoria
  centroCustoSelecionado?: string;
  unidadeSelecionada?: string;
}

// normalizadores
const strip = (s?: string | null) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

export default function EstruturaDrawer({
  id,
  onClose,
  areaFiltrada,
  centroCustoSelecionado,
  unidadeSelecionada,
}: Props) {
  const [todos, setTodos] = useState<Funcionario[]>([]);
  const [escopo, setEscopo] = useState<Funcionario[]>([]);
  const [root, setRoot] = useState<Funcionario | null>(null);
  const [nivel1, setNivel1] = useState<Funcionario[]>([]);
  const [gestor, setGestor] = useState<Funcionario | null>(null);
  const [hoverVoltar, setHoverVoltar] = useState(false);

  // gera key única e nunca vazia
  const keyFrom = (f: Funcionario, idx: number) => {
    const baseId = String(f.id || "").trim();
    if (baseId) return `id:${baseId}`;
    const nome = (f.nome || "sem-nome").trim().toLowerCase();
    const chefe = String(f.responde_para || "no-chefe");
    return `gen:${nome}|${chefe}|${idx}`;
  };

  // >>> Navegação dinâmica (drill-down)
  const [localRootId, setLocalRootId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  // reset navegação quando muda o escopo
  useEffect(() => {
    setLocalRootId(null);
    setHistory([]);
  }, [id, areaFiltrada?.responsavel_id, centroCustoSelecionado, unidadeSelecionada]);

  // carregar todos
  useEffect(() => {
    (async () => {
      const { data: allFuncs, error } = await supabase.from("funcionarios").select("*");
      if (error || !allFuncs) return;
      setTodos((allFuncs as Funcionario[]) || []);
    })();
  }, []);

  // montar árvore
  useEffect(() => {
    if (!todos.length) return;

    const byId = new Map<string, Funcionario>(todos.map((f) => [String(f.id), f]));

    const responsavelIdArea = areaFiltrada?.responsavel_id || null;
    const defaultRootId: string | null = centroCustoSelecionado
      ? id
      : (responsavelIdArea || id);

    const effectiveRootId = (localRootId && String(localRootId).trim()) ? localRootId : defaultRootId;
    const rootFunc = effectiveRootId ? byId.get(String(effectiveRootId)) || null : null;
    setRoot(rootFunc);

    if (!rootFunc) {
      setEscopo([]);
      setNivel1([]);
      setGestor(null);
      return;
    }

    const chegaNoRoot = (fid: string): boolean => {
      if (String(fid) === String(rootFunc.id)) return true;
      const visit = new Set<string>();
      let cur = byId.get(fid);
      while (cur && cur.responde_para && !visit.has(String(cur.id))) {
        if (String(cur.responde_para) === String(rootFunc.id)) return true;
        visit.add(String(cur.id));
        cur = byId.get(String(cur.responde_para));
      }
      return false;
    };

    const ancestraisAteRoot = (fid: string): string[] => {
      const chain: string[] = [];
      const visit = new Set<string>();
      let cur = byId.get(fid);
      while (cur && cur.responde_para && !visit.has(String(cur.id))) {
        chain.push(String(cur.responde_para));
        if (String(cur.responde_para) === String(rootFunc.id)) break;
        visit.add(String(cur.id));
        cur = byId.get(String(cur.responde_para));
      }
      return chain;
    };

    const uniSel = unidadeSelecionada ? norm(unidadeSelecionada) : "";
    const ccSel = centroCustoSelecionado ? norm(centroCustoSelecionado) : "";

    const inScopeArea = (f: Funcionario): boolean => {
      const okUnidade = uniSel ? norm(f.unidade) === uniSel : true;
      return okUnidade && chegaNoRoot(String(f.id));
    };

    const inScopeCC = (f: Funcionario): boolean => {
      const okUnidade = uniSel ? norm(f.unidade) === uniSel : true;
      const okCC = ccSel ? norm(f.centro_custo) === ccSel : true;
      return okUnidade && okCC && chegaNoRoot(String(f.id));
    };

    let base: Funcionario[] = [];
    if (centroCustoSelecionado) base = todos.filter(inScopeCC);
    else base = todos.filter(inScopeArea);

    const idsEscopo = new Set<string>(base.map((f) => String(f.id)));
    idsEscopo.add(String(rootFunc.id));

    for (const f of base) {
      for (const anc of ancestraisAteRoot(String(f.id))) {
        idsEscopo.add(String(anc));
        if (String(anc) === String(rootFunc.id)) break;
      }
    }

    const escopoList = Array.from(idsEscopo)
      .map((id) => byId.get(String(id)))
      .filter((x): x is Funcionario => !!x);

    setEscopo(escopoList);

    const escopoSet = new Set<string>(escopoList.map((f) => String(f.id)));
    const childrenMap: Record<string, Funcionario[]> = {};
    for (const f of escopoList) {
      const chefeId = f.responde_para ? String(f.responde_para) : null;
      if (chefeId && escopoSet.has(chefeId)) {
        (childrenMap[chefeId] ||= []).push(f);
      }
    }

    let n1 = childrenMap[String(rootFunc.id)] || [];
    n1 = n1
      .slice()
      .sort((a, b) => {
        const ca = (childrenMap[String(a.id)] || []).length;
        const cb = (childrenMap[String(b.id)] || []).length;
        if (cb !== ca) return cb - ca;
        return (a.nome || "").localeCompare(b.nome || "");
      });

    const seen = new Set<string>();
    const sig = (f: Funcionario) =>
      `${String(f.id || "no-id")}|${String(f.responde_para || "no-chefe")}|${(f.nome || "").trim().toLowerCase()}`;

    n1 = n1.filter((f) => {
      const s = sig(f);
      if (seen.has(s)) return false;
      seen.add(s);
      return true;
    });

    setNivel1(n1);

    const sup =
      (rootFunc.responde_para &&
        escopoList.find((f) => String(f.id) === String(rootFunc.responde_para))) ||
      null;
    setGestor(sup);
  }, [
    todos,
    id,
    areaFiltrada?.responsavel_id,
    centroCustoSelecionado,
    unidadeSelecionada,
    localRootId,
  ]);

  const countFilhos = useMemo(() => {
    const map: Record<string, number> = {};
    const setIds = new Set(escopo.map((f) => String(f.id)));
    escopo.forEach((f) => {
      if (f.responde_para && setIds.has(String(f.responde_para))) {
        map[String(f.responde_para)] = (map[String(f.responde_para)] || 0) + 1;
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

  const handleDrillDown = (nextId?: string | null) => {
    if (!nextId) return;
    setHistory((prev) => {
      const current = root?.id ? String(root.id) : "";
      return current ? [...prev, current] : prev;
    });
    setLocalRootId(String(nextId));
  };

  const handleVoltar = () => {
    setHoverVoltar(false);
    setHistory((prev) => {
      if (!prev.length) return prev;
      const clone = prev.slice();
      const last = clone.pop()!;
      setLocalRootId(last);
      return clone;
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        key="drawer"
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

        {root && (
          <div className="flex flex-col items-center">
            <div className="relative bg-yellow-400 text-black px-6 py-5 rounded-3xl shadow-xl mb-4 flex flex-col items-center border-2 border-yellow-500 scale-[1.03]">
              <ShieldCheck className="w-10 h-10 mb-2 text-yellow-800" />
              <div className="text-lg font-bold uppercase tracking-wide">{root.nome}</div>
              <div className="text-sm">{root.cargo}</div>
              <div className="absolute top-2 right-4 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow">
                {centroCustoSelecionado ? "Responsável do Centro" : areaFiltrada ? "Diretoria" : "Gestor Atual"}
              </div>
            </div>

            {(gestor || history.length > 0) && (
              <div
                className="relative mb-4 flex items-center justify-center group cursor-pointer"
                onClick={handleVoltar}
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

            <h2 className="text-zinc-700 dark:text-white font-semibold mb-4">
              {nivel1.length > 0
                ? centroCustoSelecionado
                  ? `Subordinados nesse Centro de Custo(${nivel1.length})`
                  : `Subordinados${nivel1.length > 1 ? "s" : ""}:`
                : centroCustoSelecionado
                ? "Nenhum subordinado neste centro de custo"
                : "Sem subordinados"}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              {nivel1.filter(Boolean).map((sub, idx) => {
                const qt = sub?.id ? (countFilhos[String(sub.id)] || 0) : 0;
                const key = keyFrom(sub, idx);

                return (
                  <motion.div
                    key={key}
                    whileHover={{ scale: 1.03 }}
                    className="relative bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-600 p-4 rounded-3xl text-center shadow-sm hover:shadow-md transition-all flex flex-col items-center ring-1 ring-transparent hover:ring-yellow-300 cursor-pointer"
                    onClick={() => handleDrillDown(sub?.id)}
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
