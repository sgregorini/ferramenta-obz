import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { UserCircle, UserPlus, ShieldCheck, X, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Funcionario {
  id: number;
  nome: string;
  cargo: string;
  responde_para?: number | null;
  area_id?: number | null;
  unidade_original?: string;
}

interface Area {
  id: number;
  nome: string;
  responsavel_id: number;
  responsavel: string; // nome, apenas informativo
}

interface Props {
  id: number;
  onClose: () => void;
  filtroUnidade: boolean;
  areaFiltrada?: Area | undefined;
}

export default function EstruturaDrawer({ id, onClose, filtroUnidade = false, areaFiltrada }: Props) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [centro, setCentro] = useState<Funcionario | null>(null);
  const [subordinados, setSubordinados] = useState<Funcionario[]>([]);
  const [gestor, setGestor] = useState<Funcionario | null>(null);
  const [hoverVoltar, setHoverVoltar] = useState(false);
  const [unidadeReferente, setUnidadeReferente] = useState<string | null>(null);

  useEffect(() => {
    async function carregarDados() {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, cargo, responde_para, area_id, unidade_original");

      if (error || !data) {
        console.error("Erro ao carregar funcionários:", error);
        return;
      }

      const dados: Funcionario[] = data.map((f) => ({
        ...f,
        responde_para: f.responde_para ? Number(f.responde_para) : null,
        area_id: f.area_id ? Number(f.area_id) : null,
      }));

      setFuncionarios(dados);

      let liderArea: Funcionario | undefined = undefined;

      if (areaFiltrada) {
        liderArea = dados.find(f => f.id === areaFiltrada.responsavel_id);
      } else {
        liderArea = dados.find(f => f.id === Number(id));
      }

      if (!liderArea) {
        console.error("Nenhum líder encontrado para renderizar a hierarquia.");
        return;
      }

      setCentro(liderArea);
      setUnidadeReferente(liderArea.unidade_original || null);

      const subordinadosFiltrados = dados.filter(
        (f) =>
          f.responde_para === liderArea!.id &&
          (!filtroUnidade || f.unidade_original === liderArea!.unidade_original) &&
          (!areaFiltrada || f.area_id === areaFiltrada.id)
      );

      setSubordinados(subordinadosFiltrados);

      const gestorDireto = dados.find(f => f.id === liderArea!.responde_para);
      setGestor(gestorDireto || null);
    }

    carregarDados();
  }, [id, areaFiltrada]);

  const getIcon = (cargo: string) => {
    if (cargo.toLowerCase().includes("gerente")) return <ShieldCheck className="w-8 h-8 mb-2 text-yellow-600" />;
    if (cargo.toLowerCase().includes("supervisor")) return <UserPlus className="w-8 h-8 mb-2 text-blue-600" />;
    return <UserCircle className="w-8 h-8 mb-2 text-zinc-600 dark:text-zinc-300" />;
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
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Estrutura Hierárquica</h1>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
            <X size={24} />
          </button>
        </div>

        {centro ? (
          <div className="flex flex-col items-center">
            <div className="relative bg-yellow-400 text-black px-6 py-5 rounded-3xl shadow-xl text-center mb-4 flex flex-col items-center border-2 border-yellow-500 scale-[1.03]">
              <ShieldCheck className="w-10 h-10 mb-2 text-yellow-800" />
              <div className="text-lg font-bold leading-tight font-akkoBold uppercase tracking-wide">
                {centro.nome}
              </div>
              <div className="text-sm text-zinc-800 font-medium">{centro.cargo}</div>
              <div className="absolute top-2 right-4 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow">
                Gestor Atual
              </div>
            </div>

            {gestor && (!filtroUnidade || gestor.unidade_original === unidadeReferente) && (
              <div
                className="relative mb-4 flex items-center justify-center group cursor-pointer"
                onClick={() => {
                  setCentro(gestor);
                  setGestor(funcionarios.find((f) => f.id === gestor?.responde_para) || null);
                  setSubordinados(
                    funcionarios.filter(
                      (f) =>
                        f.responde_para === gestor.id &&
                        (!filtroUnidade || f.unidade_original === unidadeReferente) &&
                        (!areaFiltrada || f.area_id === areaFiltrada.id)
                    )
                  );
                }}
                onMouseEnter={() => setHoverVoltar(true)}
                onMouseLeave={() => setHoverVoltar(false)}
              >
                <ArrowLeft className="text-blue-600 group-hover:scale-110 transition-transform duration-200" />
                <AnimatePresence>
                  {hoverVoltar && (
                    <motion.span
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -5 }}
                      className="ml-2 text-sm text-blue-600 font-medium"
                    >
                      Voltar para gestor direto
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            )}

            <h2 className="text-zinc-700 dark:text-white text-base font-semibold mb-4">
              {subordinados.length > 0
                ? `Subordinado${subordinados.length > 1 ? "s" : ""} diretos:`
                : "Sem subordinados diretos."}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              {subordinados.map((sub) => (
                <motion.div
                  key={sub.id}
                  whileHover={{ scale: 1.03 }}
                  className="cursor-pointer bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-600 p-4 rounded-3xl text-center shadow-sm hover:shadow-md transition-all flex flex-col items-center ring-1 ring-transparent hover:ring-yellow-300"
                  onClick={() => {
                    setCentro(sub);
                    setGestor(centro);
                    setSubordinados(
                      funcionarios.filter(
                        (f) =>
                          f.responde_para === sub.id &&
                          (!filtroUnidade || f.unidade_original === unidadeReferente) &&
                          (!areaFiltrada || f.area_id === areaFiltrada.id)
                      )
                    );
                  }}
                >
                  {getIcon(sub.cargo)}
                  <div className="font-semibold text-zinc-800 dark:text-white leading-tight text-sm uppercase">
                    {sub.nome}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{sub.cargo}</div>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-zinc-500 dark:text-zinc-300">Carregando dados...</p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
