// Página /estrutura/:id com navegação estilo Teams (versão com layout Exímio)
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { UserCircle, UserPlus, ShieldCheck, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Funcionario {
  id: number;
  nome: string;
  cargo: string;
  responde_para?: number | null;
  subordinados?: Funcionario[];
}

export default function EstruturaHierarquica() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [centro, setCentro] = useState<Funcionario | null>(null);
  const [subordinados, setSubordinados] = useState<Funcionario[]>([]);
  const [gestor, setGestor] = useState<Funcionario | null>(null);
  const [hoverVoltar, setHoverVoltar] = useState(false);

  useEffect(() => {
    async function carregarDados() {
      let todos: any[] = [];
      let page = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .from("funcionarios")
          .select("id, nome, cargo, responde_para")
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error || !data || data.length === 0) break;
        todos.push(...data);
        page++;
      }

      const dados: Funcionario[] = todos.map((f) => ({
        ...f,
        responde_para: f.responde_para ? Number(f.responde_para) : null,
      }));

      setFuncionarios(dados);

      const central = dados.find((f) => f.id === Number(id));
      if (!central) return;

      setCentro(central);
      setSubordinados(dados.filter((f) => f.responde_para === central.id));
      const gestorDireto = dados.find((f) => f.id === central.responde_para);
      setGestor(gestorDireto || null);
    }

    carregarDados();
  }, [id]);

  const getIcon = (cargo: string) => {
    if (cargo.toLowerCase().includes("gerente")) return <ShieldCheck className="w-8 h-8 mb-2 text-yellow-600" />;
    if (cargo.toLowerCase().includes("supervisor")) return <UserPlus className="w-8 h-8 mb-2 text-blue-600" />;
    return <UserCircle className="w-8 h-8 mb-2 text-zinc-600 dark:text-zinc-300" />;
  };

  return (
    <div className="p-6 min-h-screen bg-gradient-to-b from-[#fdfdfd] to-[#f4f4f4] dark:from-zinc-900 dark:to-zinc-800">
      <h1 className="text-3xl font-extrabold mb-6 text-zinc-800 dark:text-white font-akkoMedium">
        Estrutura Hierárquica
      </h1>

      {centro ? (
        <div className="flex flex-col items-center">
          <div className="relative bg-yellow-400 text-black px-6 py-5 rounded-3xl shadow-xl text-center mb-4 flex flex-col items-center border-2 border-yellow-500 scale-[1.03]">
            <ShieldCheck className="w-10 h-10 mb-2 text-yellow-800" />
            <div className="text-lg font-bold leading-tight font-akkoBold uppercase tracking-wide">
              {centro.nome}
            </div>
            <div className="text-sm text-zinc-800 font-medium">
              {centro.cargo}
            </div>
            <div className="absolute top-2 right-4 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow">Gestor Atual</div>
          </div>

          {gestor && (
            <div
              className="relative mb-6 flex items-center justify-center group cursor-pointer"
              onClick={() => navigate(`/estrutura/${gestor.id}`)}
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
              ? `Subordinado${subordinados.length > 1 ? 's' : ''} diretos:`
              : "Sem subordinados diretos."}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {subordinados.map((sub) => (
              <motion.div
                key={sub.id}
                whileHover={{ scale: 1.05 }}
                className="cursor-pointer bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-600 p-4 rounded-3xl text-center shadow-md hover:shadow-lg transition-all flex flex-col items-center ring-1 ring-transparent hover:ring-yellow-300"
                onClick={() => navigate(`/estrutura/${sub.id}`)}
              >
                {getIcon(sub.cargo)}
                <div className="font-semibold text-zinc-800 dark:text-white leading-tight text-sm uppercase">
                  {sub.nome}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {sub.cargo}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-zinc-500 dark:text-zinc-300">Carregando dados...</p>
      )}
    </div>
  );
}
