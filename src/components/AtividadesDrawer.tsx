import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { X, Search, User2, Hash, Tag, ListTree } from "lucide-react";
import type { Area } from "../types";

interface Atividade {
  id: string;
  nome: string;
  descricao?: string | null;
  tipo?: string | null;
  cliente?: string | null;
  recursos_necessarios?: string | null;
  area_id?: number | null;
  centro_custo?: string | null;
}

interface DrawerProps {
  unidade: string;
  diretoria: Area | null;
  areaId: number;
  centroCustoDisplay: string;  // rótulo para UI
  centroCustoNorm: string;     // chave normalizada p/ filtro
  onClose: () => void;
}

const strip = (s?: string | null) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export default function AtividadesDrawer({ unidade, diretoria, areaId, centroCustoDisplay, centroCustoNorm, onClose }: DrawerProps) {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [busca, setBusca] = useState("");
  const [todasAreas, setTodasAreas] = useState(false); // 👈 toggle

  useEffect(() => {
    (async () => {
      let query = supabase.from("atividades").select("*");
      if (!todasAreas) query = query.eq("area_id", areaId);
      const { data, error } = await query;
      if (!error && data) {
        setAtividades((data as Atividade[]).filter(a => strip(a.centro_custo) === centroCustoNorm));
      }
    })();
  }, [areaId, centroCustoNorm, todasAreas]);

  const atividadesFiltradas = useMemo(() => {
    const q = strip(busca);
    if (!q) return atividades;
    return atividades.filter(a =>
      strip(a.nome).includes(q) ||
      strip(a.descricao).includes(q) ||
      strip(a.tipo).includes(q) ||
      strip(a.cliente).includes(q)
    );
  }, [atividades, busca]);

  return (
    <AnimatePresence>
      <motion.div key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div key="drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.3 }} className="fixed top-0 right-0 w-full md:w-[800px] h-full bg-white dark:bg-zinc-900 shadow-lg z-50 p-6 overflow-y-auto">
        <div className="flex justify-between items-start gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Atividades do Centro</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
              <span className="font-medium">{centroCustoDisplay}</span> · {unidade} · {diretoria?.nome ?? "—"}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* controles */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1 flex items-center gap-2 border rounded-xl px-3 py-2 bg-white dark:bg-zinc-800 dark:border-zinc-700">
            <Search size={16} className="text-zinc-400" />
            <input className="w-full bg-transparent outline-none text-sm" placeholder="Buscar por nome/descrição/tipo…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <input type="checkbox" checked={todasAreas} onChange={(e) => setTodasAreas(e.target.checked)} />
            Incluir outras diretorias
          </label>
        </div>

        {/* KPI */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 mb-4">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
            <ListTree className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wide">Total de atividades</span>
          </div>
          <div className="text-2xl font-bold mt-1 text-zinc-900 dark:text-white">{atividades.length}</div>
        </div>

        {/* lista */}
        <ul className="space-y-3">
          {atividadesFiltradas.map(a => (
            <li key={a.id} className="border rounded-2xl p-4 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:shadow-sm transition">
              <div className="min-w-0">
                <h3 className="font-semibold text-zinc-900 dark:text-white leading-tight">
                  {a.nome}{" "}
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">· <Hash className="inline w-3 h-3" /> {a.id.slice(0, 8)}</span>
                </h3>
                {a.descricao && <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1 line-clamp-2">{a.descricao}</p>}
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {a.tipo && <span className="inline-flex items-center gap-1"><Tag className="w-3 h-3" /> {a.tipo}</span>}
                  {a.cliente && <span className="inline-flex items-center gap-1"><User2 className="w-3 h-3" /> Cliente: {a.cliente}</span>}
                </div>
              </div>
            </li>
          ))}
          {!atividadesFiltradas.length && (
            <li className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma atividade encontrada.</li>
          )}
        </ul>
      </motion.div>
    </AnimatePresence>
  );
}
