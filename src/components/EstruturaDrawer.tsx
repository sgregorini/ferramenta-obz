import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { UserCircle, UserPlus, ShieldCheck, X, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Funcionario, Area } from "../types";

interface Props {
  id: string;                    // quando abre por CC ou fallback
  onClose: () => void;
  areaFiltrada?: Area;           // quando abre pela diretoria
  centroCustoSelecionado?: string;
  unidadeSelecionada?: string;
}

// normaliza para comparações estáveis
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
  const [currentId, setCurrentId] = useState<string>(id);

  const [centro, setCentro] = useState<Funcionario | null>(null);
  const [subordinados, setSubordinados] = useState<Funcionario[]>([]);
  const [gestor, setGestor] = useState<Funcionario | null>(null);
  const [hoverVoltar, setHoverVoltar] = useState(false);

  // raiz preferencial: se veio diretoria, tenta usar o responsável da área
// Se for CENTRO DE CUSTO, a raiz é SEMPRE o id (responsável do CC).
// Se for DIRETORIA, a raiz é o responsável da área.
  useEffect(() => {
    if (centroCustoSelecionado) {
      setCurrentId(id); // responsável do CC
    } else {
      setCurrentId(areaFiltrada?.responsavel_id || id); // diretoria
    }
  }, [id, areaFiltrada?.responsavel_id, centroCustoSelecionado]);

  useEffect(() => {
    (async () => {
      const { data: allFuncs, error } = await supabase.from("funcionarios").select("*");
      if (error || !allFuncs) return;

      const todosFuncs = (allFuncs as Funcionario[]) || [];
      setTodos(todosFuncs);

      // ===== 1) Resolver RAIZ robustamente (diferença entre responsavel_id e id real no RH)
      const responsavelIdArea = areaFiltrada?.responsavel_id;
      const responsavelNomeArea = areaFiltrada?.responsavel;

      const idsPorNome = responsavelNomeArea
        ? todosFuncs
            .filter((f) => strip(f.nome) === strip(responsavelNomeArea))
            .map((f) => f.id)
        : [];

      const rootIds = new Set<string>(
        [responsavelIdArea, ...idsPorNome].filter(
          (x): x is string => !!x && x.trim().length > 0
        )
      );

      // se abriu por CC (ou não há área), ainda queremos um root “visual”
      const rootVisual = centroCustoSelecionado
          ? (todosFuncs.find((f) => f.id === id) || null)               // CC: raiz é o responsável do CC (id)
          : (todosFuncs.find((f) => f.id === (responsavelIdArea || currentId)) // Diretoria
              || todosFuncs.find((f) => f.id === id)
              || null);
      setCentro(rootVisual);

      // ===== 2) ESCOPo visível: sempre fixa UNIDADE; restringe por CC se vier
      const unSel = unidadeSelecionada || rootVisual?.unidade || null;

      const baseUnidade = todosFuncs.filter((f) =>
        unSel ? norm(f.unidade) === norm(unSel) : true
      );

      const baseUnCC = centroCustoSelecionado
        ? baseUnidade.filter(
            (f) => norm(f.centro_custo) === norm(centroCustoSelecionado)
          )
        : baseUnidade;

      // ===== 3) Pertencimento por HIERARQUIA
      // A cadeia pode atravessar unidades: usa a base completa p/ subir responde_para
      const byId = new Map(todosFuncs.map((f) => [f.id, f]));

      const alcançaQualquerRaiz = (fid: string): boolean => {
        if (rootIds.size === 0) return false; // só quando abre por diretoria
        const visit = new Set<string>();
        let cur = byId.get(fid);
        while (cur && cur.responde_para && !visit.has(cur.id)) {
          if (rootIds.has(cur.responde_para)) return true;
          visit.add(cur.id);
          cur = byId.get(cur.responde_para);
        }
        return false;
      };

      let baseFinal: Funcionario[] = [];

      // sempre inclui o responsável do CC, mesmo que ele esteja fora do CC/unidade
      if (centroCustoSelecionado) {
        const resp = todosFuncs.find((f) => f.id === currentId);
        if (resp) baseFinal.push(resp);

        // todos os funcionários do CC/unidade
        baseFinal.push(
          ...todosFuncs.filter(
            (f) =>
              norm(f.unidade) === norm(unSel) &&
              norm(f.centro_custo) === norm(centroCustoSelecionado)
          )
        );
      } else if (rootIds.size > 0) {
        // abriu por diretoria
        baseFinal = baseUnCC.filter((f) => alcançaQualquerRaiz(f.id));
      } else {
        baseFinal = baseUnCC;
      }

      setEscopo(baseFinal);


      // ===== 4) Mapa de filhos DENTRO do escopo (para exibir níveis)
      const idsEscopo = new Set(baseFinal.map((f) => f.id));
      const childrenMap: Record<string, Funcionario[]> = {};
      baseFinal.forEach((f) => {
        if (f.responde_para && idsEscopo.has(f.responde_para)) {
          (childrenMap[f.responde_para] ||= []).push(f);
        }
      });

      // ===== 5) NÍVEL 1
      // (a) se algum dos roots estiver no escopo, filhos diretos dele(s)
      let nivel1: Funcionario[] = [];
      rootIds.forEach((rid) => {
        if (childrenMap[rid]) nivel1.push(...childrenMap[rid]);
      });

      // (b) se vazou (ex.: diretor fora da unidade), pega “topo local”:
      //     quem NÃO tem superior dentro do escopo (primeiro degrau da unidade)
      if (nivel1.length === 0) {
        const temSuperiorLocal = (f: Funcionario) =>
          !!(f.responde_para && idsEscopo.has(f.responde_para));
        nivel1 = baseFinal.filter((f) => !temSuperiorLocal(f));
      }

      // ordena por “liderança” (qtde de filhos no escopo) e nome
      nivel1 = Array.from(new Map(nivel1.map((f) => [f.id, f])).values()).sort((a, b) => {
        const ca = (childrenMap[a.id] || []).length;
        const cb = (childrenMap[b.id] || []).length;
        if (cb !== ca) return cb - ca;
        return (a.nome || "").localeCompare(b.nome || "");
      });

      setSubordinados(nivel1);

      // ===== 6) Botão Voltar:
      // só mostra se o superior do rootVisual também está no escopo (senão some)
      const sup =
        (rootVisual?.responde_para &&
          baseFinal.find((f) => f.id === rootVisual.responde_para)) ||
        null;
      setGestor(sup);
    })();
  }, [currentId, areaFiltrada?.responsavel_id, areaFiltrada?.responsavel, centroCustoSelecionado, unidadeSelecionada]);

  const countFilhos = useMemo(() => {
    const map: Record<string, number> = {};
    escopo.forEach((f) => {
      if (f.responde_para) map[f.responde_para] = (map[f.responde_para] || 0) + 1;
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
            {/* topo */}
            <div className="relative bg-yellow-400 text-black px-6 py-5 rounded-3xl shadow-xl mb-4 flex flex-col items-center border-2 border-yellow-500 scale-[1.03]">
              <ShieldCheck className="w-10 h-10 mb-2 text-yellow-800" />
              <div className="text-lg font-bold uppercase tracking-wide">{centro.nome}</div>
              <div className="text-sm">{centro.cargo}</div>
              <div className="absolute top-2 right-4 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow">
                {centroCustoSelecionado ? "Membros do Centro" : areaFiltrada ? "Diretoria" : "Gestor Atual"}
              </div>
            </div>

            {/* voltar (só se o gestor está no escopo) */}
            {gestor && (
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

            <h2 className="text-zinc-700 dark:text-white font-semibold mb-4">
              {subordinados.length > 0
                ? centroCustoSelecionado
                  ? `Membros do Centro (${subordinados.length})`
                  : `Subordinado${subordinados.length > 1 ? "s" : ""} na unidade:`
                : centroCustoSelecionado
                ? "Nenhum membro neste centro."
                : "Sem subordinados nesta unidade."}
            </h2>

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
