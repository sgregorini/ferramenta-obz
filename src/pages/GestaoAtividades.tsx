import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Home, ChevronDown, ChevronUp, Share2, Layers3 } from "lucide-react";
import AtividadesDrawer from "@/components/AtividadesDrawer";
import type { Funcionario, Area, Usuario } from "../types";

interface DashboardProps { usuario: Usuario | null; }

type CcMetrics = {
  areaId: number;
  ccDisplay: string;
  ccNorm: string;
  totalArea: number;    // só desta diretoria
  totalGlobal: number;  // todas diretorias com o mesmo CC
};

interface Atividade {
  id: string;
  nome: string;
  area_id?: number | null;
  centro_custo?: string | null;
}

const strip = (s?: string | null) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export default function GestaoAtividades({ usuario }: DashboardProps) {
  const [funcs, setFuncs] = useState<Funcionario[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [ativs, setAtivs] = useState<Atividade[]>([]);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [drawer, setDrawer] = useState<{ unidade: string; diretoria: Area | null; ccDisplay: string; ccNorm: string; areaId: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: f }, { data: a }, { data: t }] = await Promise.all([
        supabase.from("funcionarios").select("*"),
        supabase.from("areas").select("*"),
        supabase.from("atividades").select("*"),
      ]);
      setFuncs((f || []) as Funcionario[]);
      setAreas((a || []) as Area[]);
      setAtivs((t || []) as Atividade[]);
      setLoading(false);
    })();
  }, []);

  // hospital -> diretoria -> bucket(centers)
  const viewData = useMemo(() => {
    type Bucket = { centers: Map<string, CcMetrics>; diretor?: string };
    const mapa = new Map<string, Map<string, Bucket>>();

    const ensure = (hospital: string, diretoria: string) => {
      const h = hospital || "—";
      if (!mapa.has(h)) mapa.set(h, new Map());
      const porDir = mapa.get(h)!;
      if (!porDir.has(diretoria)) porDir.set(diretoria, { centers: new Map(), diretor: undefined });
      return porDir.get(diretoria)!;
    };

    // Índices auxiliares
    const idxAreaCcUnid = new Map<string, string>();   // `${areaId}::${ccNorm}` -> unidade
    const idxAreaCcLabel = new Map<string, string>();  // `${areaId}::${ccNorm}` -> rótulo CC
    const idxCcGlobalUnid = new Map<string, string>(); // ccNorm -> unidade (fallback)

    funcs.filter(f => f.unidade && f.centro_custo && f.area_id != null).forEach(f => {
      const areaId = Number(f.area_id);
      const ccDisplay = (f.centro_custo || "").trim();
      const ccNorm = strip(ccDisplay);
      const k = `${areaId}::${ccNorm}`;
      if (!idxAreaCcUnid.has(k)) idxAreaCcUnid.set(k, f.unidade!);
      if (!idxAreaCcLabel.has(k)) idxAreaCcLabel.set(k, ccDisplay);
      if (!idxCcGlobalUnid.has(ccNorm)) idxCcGlobalUnid.set(ccNorm, f.unidade!);

      const areaObj = areas.find(a => Number(a.id) === areaId);
      const diretoria = areaObj?.nome || "Sem Diretoria";
      const bucket = ensure(f.unidade!, diretoria);
      // baseline do center (sem contagem ainda)
      const centerKey = k; // `${areaId}::${ccNorm}`
      if (!bucket.centers.has(centerKey)) {
        bucket.centers.set(centerKey, { areaId, ccDisplay, ccNorm, totalArea: 0, totalGlobal: 0 });
        if (!bucket.diretor && areaObj?.responsavel_id) {
          bucket.diretor = funcs.find(x => x.id === areaObj.responsavel_id)?.nome;
        }
      }
    });

    // Contagens: por área+ccNorm e global por ccNorm
    const countArea = new Map<string, number>();
    const countGlobal = new Map<string, number>();
    const firstAtvLabel = new Map<string, string>(); // se não tiver label via funcionário

    ativs.forEach(a => {
      const areaId = Number(a.area_id ?? NaN);
      const cc = (a.centro_custo || "").trim();
      if (!cc || Number.isNaN(areaId)) return;
      const ccNorm = strip(cc);
      const k = `${areaId}::${ccNorm}`;
      countArea.set(k, (countArea.get(k) || 0) + 1);
      countGlobal.set(ccNorm, (countGlobal.get(ccNorm) || 0) + 1);
      if (!firstAtvLabel.has(k)) firstAtvLabel.set(k, cc);
    });

    // Unimos as chaves vindas de funcionários + atividades
    const allAreaKeys = new Set<string>([
      ...Array.from(idxAreaCcUnid.keys()),
      ...Array.from(countArea.keys()),
    ]);

    allAreaKeys.forEach(k => {
      const [areaIdStr, ccNorm] = k.split("::");
      const areaId = Number(areaIdStr);

      // hospital / diretoria
      const unidade = idxAreaCcUnid.get(k) || idxCcGlobalUnid.get(ccNorm) || "—";
      const areaObj = areas.find(a => Number(a.id) === areaId);
      const diretoria = areaObj?.nome || "Sem Diretoria";

      const bucket = ensure(unidade, diretoria);
      const ccDisplay = idxAreaCcLabel.get(k) || firstAtvLabel.get(k) || "(centro sem rótulo)";

      const metric = bucket.centers.get(k) || { areaId, ccDisplay, ccNorm, totalArea: 0, totalGlobal: 0 };
      metric.areaId = areaId;
      metric.ccDisplay = ccDisplay;
      metric.ccNorm = ccNorm;
      metric.totalArea = countArea.get(k) || 0;
      metric.totalGlobal = countGlobal.get(ccNorm) || metric.totalArea; // se só existe nesta área, global == área

      bucket.centers.set(k, metric);

      // diretor
      if (!bucket.diretor && areaObj?.responsavel_id) {
        bucket.diretor = funcs.find(x => x.id === areaObj.responsavel_id)?.nome;
      }
    });

    return mapa;
  }, [funcs, areas, ativs]);

  const hospitais = useMemo(() => Array.from(viewData.keys()).sort(), [viewData]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-100 dark:from-zinc-900 dark:to-zinc-950 px-4 md:px-8 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Home className="text-yellow-500" size={32} />
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Gestão de Atividades</h1>
      </div>

      {loading && <div className="text-zinc-500 dark:text-zinc-400 text-sm">Carregando…</div>}

      {hospitais.map(hospital => {
        const diretoriasMap = viewData.get(hospital)!;
        const diretorias = Array.from(diretoriasMap.entries())
          .filter(([nome], _, arr) => (arr.some(([n]) => n !== "Sem Diretoria") ? nome !== "Sem Diretoria" : true))
          .sort(([a], [b]) => a.localeCompare(b));

        return (
          <div key={hospital} className="mb-10">
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-white mb-4 border-b border-zinc-300 dark:border-zinc-700 pb-2">
              {hospital}
            </h2>

            {diretorias.map(([diretoria, bucket]) => {
              const centros = Array.from(bucket.centers.values()).sort((a, b) => a.ccDisplay.localeCompare(b.ccDisplay));
              const key = `${hospital}-${diretoria}`;
              const isExpandido = expandidos[key] || false;
              const areaObj = areas.find(a => a.nome === diretoria) || null;

              return (
                <Card key={diretoria} className="mb-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all bg-white dark:bg-zinc-900">
                  <div className="flex justify-between items-center p-5 cursor-pointer" onClick={() => setExpandidos(prev => ({ ...prev, [key]: !prev[key] }))}>
                    <div>
                      <p className="font-semibold text-lg md:text-xl text-zinc-800 dark:text-white">{diretoria}</p>
                      {!!bucket.diretor && <p className="text-sm text-zinc-500 dark:text-zinc-300 mt-1">{bucket.diretor}</p>}
                    </div>
                    <div className="flex gap-2 items-center">
                      {isExpandido ? <ChevronUp size={22} className="text-zinc-500" /> : <ChevronDown size={22} className="text-zinc-500" />}
                    </div>
                  </div>

                  {isExpandido && (
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-5">
                      {centros.map(m => {
                        const extra = Math.max(0, m.totalGlobal - m.totalArea);
                        return (
                          <Card
                            key={`${m.areaId}::${m.ccNorm}`}
                            className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow bg-zinc-50 dark:bg-zinc-800 cursor-pointer hover:ring-2 hover:ring-yellow-300"
                            onClick={() => setDrawer({ unidade: hospital, diretoria: areaObj, ccDisplay: m.ccDisplay, ccNorm: m.ccNorm, areaId: m.areaId })}
                          >
                            <p className="font-medium text-zinc-800 dark:text-white text-center text-sm md:text-base mb-3 flex items-center justify-center gap-2">
                              <Layers3 className="w-4 h-4" /> {m.ccDisplay}
                            </p>

                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-500 dark:text-zinc-300">Atividades</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                                {m.totalArea}{extra > 0 ? ` (+${extra})` : ""}
                              </span>
                            </div>

                            <button
                              className="mt-4 w-full inline-flex items-center justify-center gap-2 text-xs font-medium py-1.5 rounded-lg bg-yellow-500 text-black hover:bg-yellow-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDrawer({ unidade: hospital, diretoria: areaObj, ccDisplay: m.ccDisplay, ccNorm: m.ccNorm, areaId: m.areaId });
                              }}
                            >
                              <Share2 className="w-3 h-3" /> Ver atividades
                            </button>
                          </Card>
                        );
                      })}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })}

      {drawer && (
        <AtividadesDrawer
          unidade={drawer.unidade}
          diretoria={drawer.diretoria}
          centroCustoDisplay={drawer.ccDisplay}
          centroCustoNorm={drawer.ccNorm}
          areaId={drawer.areaId}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
