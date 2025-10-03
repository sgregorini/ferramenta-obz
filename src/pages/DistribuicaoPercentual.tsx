// src/pages/DistribuicaoPercentual.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
  UIEvent,
} from "react";
import { supabase } from "../lib/supabase";
import { adapterSupabase } from "../adapters/adapterSupabase";
import { Area, Funcionario, Usuario, Atividade } from "../types";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  SlidersHorizontal,
  XCircle,
  Sparkles,
  Info,
  TriangleAlert,
  FileDown,
  ChevronsUpDown,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

/* ========= Tipos e Constantes ========= */
type Frequencia =
  | "Diária"
  | "Semanal"
  | "Mensal"
  | "Bimestral"
  | "Trimestral"
  | "Eventual"
  | "";

interface DistribuicaoPorAtividade {
  atividade_id: string;
  frequencia: Frequencia;
  duracao_ocorrencia_horas: number;
  quantidade_ocorrencias: number;
}
type Distribuicoes = Record<string, DistribuicaoPorAtividade[]>;

const OPCOES_FREQ: Frequencia[] = [
  "Diária",
  "Semanal",
  "Mensal",
  "Bimestral",
  "Trimestral",
  "Eventual",
  "",
];
const FREQ_CRITICAS: Frequencia[] = ["Mensal", "Bimestral", "Trimestral", "Eventual"];
const ROW_HEIGHT = 46;

/* ========= Utils ========= */
const sumHoras = (it: DistribuicaoPorAtividade[]) =>
  it.reduce(
    (acc, d) =>
      acc +
      (Number(d.duracao_ocorrencia_horas || 0) *
        Number(d.quantidade_ocorrencias || 0)),
    0
  );

const cls = (...a: (string | false | undefined)[]) =>
  a.filter(Boolean).join(" ");

// normaliza strings para comparação robusta (sem espaços/caixa)
const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

function HelpTip({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={`Ajuda: ${title}`}
          className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
          type="button"
        >
          <Info className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-w-xs text-sm leading-relaxed">
        <div className="font-medium mb-1">{title}</div>
        <div className="text-zinc-600">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

/* ========= Linha ========= */
type LinhaValue = {
  atividade_id: string;
  duracao_ocorrencia_horas: number | string;
  quantidade_ocorrencias: number | string;
  frequencia: Frequencia | "";
};

const linhaValida = (d: {
  duracao_ocorrencia_horas: number;
  quantidade_ocorrencias: number;
  frequencia: string;
}) => {
  const dur = Number(d.duracao_ocorrencia_horas) || 0;
  const occ = Number(d.quantidade_ocorrencias) || 0;
  return dur > 0 && occ > 0 && !!d.frequencia;
};

const sanitizeDistribuicoes = (arr: any[]) =>
  (Array.isArray(arr) ? arr : []).filter(linhaValida);

/** ✅ LinhaAtividade: agora sem setState no pai durante o render */
const LinhaAtividade = memo(function LinhaAtividade({
  atividadeNome,
  cargaMensal,
  initial,
  modoLote,
  onCommit,
}: {
  atividadeNome: string;
  cargaMensal: number;
  initial: LinhaValue;
  modoLote: boolean;
  onCommit: (val: {
    atividade_id: string;
    duracao_ocorrencia_horas: number;
    quantidade_ocorrencias: number;
    frequencia: Frequencia | "";
  }) => void;
}) {
  const [draft, setDraft] = useState<LinhaValue>(initial);
  const shouldCommitRef = useRef(false);

  useEffect(() => {
    setDraft(initial);
    // não commitar aqui: evita setState no pai durante render/mount
  }, [
    initial.atividade_id,
    initial.duracao_ocorrencia_horas,
    initial.quantidade_ocorrencias,
    initial.frequencia,
  ]);

  const total =
    (Number(draft.duracao_ocorrencia_horas) || 0) *
    (Number(draft.quantidade_ocorrencias) || 0);

  const warnAltaMensal =
    draft.frequencia &&
    ["Mensal", "Bimestral", "Trimestral", "Eventual"].includes(draft.frequencia) &&
    total > (cargaMensal || 0) * 0.6;

  const invalida =
    !!draft.frequencia &&
    ((Number(draft.duracao_ocorrencia_horas) || 0) <= 0 ||
      (Number(draft.quantidade_ocorrencias) || 0) <= 0);

  // marca que deve commitar; o commit real acontece no useEffect abaixo
  const markShouldCommit = useCallback(() => {
    shouldCommitRef.current = true;
  }, []);

  // ✅ Commit pós-render: normaliza e chama o onCommit fora do ciclo de render
  useEffect(() => {
    if (!shouldCommitRef.current) return;
    shouldCommitRef.current = false;

    const dur = Math.max(0, Number(draft.duracao_ocorrencia_horas) || 0);
    const occ = Math.max(0, Number(draft.quantidade_ocorrencias) || 0);
    let freq = (draft.frequencia || "") as Frequencia | "";

    if (freq && (dur <= 0 || occ <= 0)) freq = "";

    onCommit({
      atividade_id: String(draft.atividade_id),
      duracao_ocorrencia_horas: dur,
      quantidade_ocorrencias: occ,
      frequencia: freq,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draft.duracao_ocorrencia_horas,
    draft.quantidade_ocorrencias,
    draft.frequencia,
    draft.atividade_id,
    onCommit,
  ]);

  return (
    <div className="grid grid-cols-12 items-center px-3 py-2 border-t text-sm">
      <div className="col-span-6 pr-3 flex items-center gap-2">
        <span className="truncate" title={atividadeNome}>
          {atividadeNome}
        </span>
        {!modoLote && total > 0 && (
          <span className="text-[11px] text-zinc-500">({total.toFixed(1)}h/m)</span>
        )}
        {warnAltaMensal && <TriangleAlert className="h-3.5 w-3.5 text-amber-500" />}
        {invalida && (
          <span className="ml-2 text-[11px] text-red-500">
            complete horas e ocorrências
          </span>
        )}
      </div>

      <div className="col-span-2">
        <Input
          inputMode="decimal"
          className="text-right"
          placeholder="Ex.: 0.5"
          value={draft.duracao_ocorrencia_horas ?? ""}
          onChange={(e) =>
            setDraft((d) => ({ ...d, duracao_ocorrencia_horas: e.target.value }))
          }
          onBlur={markShouldCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur(); // dispara onBlur -> markShouldCommit
            }
          }}
        />
      </div>

      <div className="col-span-2">
        <Input
          inputMode="numeric"
          className="text-right"
          placeholder="Ex.: 20"
          value={draft.quantidade_ocorrencias ?? ""}
          onChange={(e) =>
            setDraft((d) => ({ ...d, quantidade_ocorrencias: e.target.value }))
          }
          onBlur={markShouldCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </div>

      <div className="col-span-2">
        <Select
          value={draft.frequencia || ""}
          onValueChange={(v) => {
            setDraft((prev) => ({ ...prev, frequencia: v as Frequencia }));
            markShouldCommit();
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {OPCOES_FREQ.filter(Boolean).map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
});

/* ========= MultiCargoPicker (trigger fixo + chips abaixo) ========= */
function MultiCargoPicker({
  options,
  value,
  onChange,
  disabled,
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? options.filter((c) => c.toLowerCase().includes(term)) : options;
  }, [options, q]);

  const toggle = React.useCallback(
    (cargo: string, checked: boolean) => {
      onChange(
        checked
          ? Array.from(new Set([...value, cargo]))
          : value.filter((c) => c !== cargo)
      );
    },
    [onChange, value]
  );

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="w-full inline-flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="truncate">
              {value.length ? `${value.length} selecionado(s)` : "Selecione cargos"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-2"
        >
          <div className="mb-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cargo..."
            />
          </div>

          <div className="max-h-64 overflow-auto pr-1">
            {filtered.map((cargo) => {
              const checked = value.includes(cargo);
              return (
                <label
                  key={cargo}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(chk) => toggle(cargo, !!chk)}
                  />
                  <span className="text-sm">{cargo}</span>
                </label>
              );
            })}
            {!filtered.length && (
              <div className="px-2 py-3 text-sm text-zinc-500">
                Nenhum cargo encontrado.
              </div>
            )}
          </div>

          {value.length > 0 && (
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => onChange([])}>
                Limpar seleção
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Chips (altura controlada, não bagunça alinhamento dos rótulos) */}
      {value.length > 0 && (
        <div className="mt-2 max-h-16 overflow-y-auto flex flex-wrap gap-1">
          {value.map((cargo) => (
            <span
              key={cargo}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs bg-zinc-50 dark:bg-zinc-800"
            >
              {cargo}
              <XCircle
                className="h-3 w-3 cursor-pointer opacity-70 hover:opacity-100"
                onClick={() => onChange(value.filter((v) => v !== cargo))}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========= Componente principal ========= */
export default function DistribuicaoPercentual({ usuario }: { usuario: Usuario }) {
  const isAdmin = usuario.permissao === "admin";

  const [unidade, setUnidade] = useState("");
  const [areaId, setAreaId] = useState<string>("");
  const [centroCusto, setCentroCusto] = useState<string>("");

  const [areas, setAreas] = useState<Area[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]); // carregadas do Supabase por área
  const [distribuicoes, setDistribuicoes] = useState<Distribuicoes>({});
  const [centrosCustoDisponiveis, setCentrosCustoDisponiveis] = useState<string[]>(
    []
  );
  const [allowedFuncionarioIds, setAllowedFuncionarioIds] = useState<string[]>([]);

  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [queryColab, setQueryColab] = useState("");

  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const [mostrarGuia, setMostrarGuia] = useState(true);
  const [somenteDoCC, setSomenteDoCC] = useState(false);

  const [cargosSelecionados, setCargosSelecionados] = useState<string[]>([]);

  // areaId como número (evita bug de comparação string vs number)
  const areaIdNum = useMemo(() => {
    const n = Number(areaId);
    return Number.isFinite(n) ? n : null;
  }, [areaId]);

  /* ---- escopo do usuário ---- */
  useEffect(() => {
    if (!usuario?.funcionario_id || isAdmin) return;
    (async () => {
      const { data, error } = await supabase
        .from("vw_subordinados_recursivos")
        .select("id")
        .eq("root_id", usuario.funcionario_id);
      if (error) {
        console.error("Erro subordinates:", error);
        return;
      }
      setAllowedFuncionarioIds((data || []).map((d: any) => String(d.id)));
    })();
  }, [usuario?.funcionario_id, isAdmin]);

  /* ---- carga inicial (sem atividades; serão buscadas por área) ---- */
  useEffect(() => {
    (async () => {
      let areasAPI = await adapterSupabase.getAreas();
      let funcionariosAPI = await adapterSupabase.getFuncionarios();
      const distribuicoesReais = await adapterSupabase.getDistribuicaoReal();

      if (!isAdmin) {
        if (allowedFuncionarioIds.length === 0) return;
        funcionariosAPI = funcionariosAPI.filter((f: Funcionario) =>
          allowedFuncionarioIds.includes(f.id)
        );
        const areaIds = funcionariosAPI
          .map((f: Funcionario) => f.area_id)
          .filter((v: any): v is number => !!v);
        areasAPI = areasAPI.filter((a: Area) => areaIds.includes(a.id));
      }

      const map: Distribuicoes = {};
      (distribuicoesReais || []).forEach((d: any) => {
        const fid = String(d.funcionario_id ?? "").trim();
        const aid = String(d.atividade_id ?? "").trim();
        if (!fid || !aid) return;
        (map[fid] ||= []).push({
          atividade_id: aid,
          frequencia: (d.frequencia ?? "") as Frequencia,
          duracao_ocorrencia_horas: Number(d.duracao_ocorrencia_horas ?? 0),
          quantidade_ocorrencias: Number(d.quantidade_ocorrencias ?? 0),
        });
      });
      setAreas(areasAPI);
      setFuncionarios(funcionariosAPI);
      setDistribuicoes(map);
    })();
  }, [allowedFuncionarioIds, isAdmin]);

  /* ---- carregar ATIVIDADES do Supabase pela ÁREA (igual ao Cadastro) ---- */
  useEffect(() => {
    (async () => {
      if (!areaIdNum || !centroCusto) {
        setAtividades([]);
        return;
      }

      // importante: filtrar por area_id + centro_custo no servidor (alinha com o Cadastro)
      const { data, error } = await supabase
        .from("atividades")
        .select("*")
        .eq("area_id", areaIdNum)
        .eq("centro_custo", centroCusto.trim()); // trim por segurança

      if (error) {
        console.error("Erro ao carregar atividades por área/CC:", error);
        setAtividades([]);
        return;
      }
      setAtividades((data || []) as Atividade[]);
    })();
  }, [areaIdNum, centroCusto]);

  /* ---- filtros ---- */
  const unidades = useMemo(
    () =>
      Array.from(new Set(funcionarios.map((f) => f.unidade).filter(Boolean))) as string[],
    [funcionarios]
  );

  const areasFiltradas = useMemo(
    () =>
      unidade
        ? areas.filter((a) =>
            funcionarios.some((f) => f.area_id === a.id && f.unidade === unidade)
          )
        : [],
    [areas, funcionarios, unidade]
  );

  useEffect(() => {
    if (!unidade || !areaIdNum) {
      setCentrosCustoDisponiveis([]);
      setCentroCusto("");
      return;
    }
    const lista = funcionarios
      .filter((f) => f.unidade === unidade && f.area_id === areaIdNum)
      .map((f) => f.centro_custo)
      .filter((cc): cc is string => !!cc);
    setCentrosCustoDisponiveis(Array.from(new Set(lista)).sort());

    if (!isAdmin && !centroCusto) {
      const meu = funcionarios.find(
        (f) =>
          f.id === usuario.funcionario_id &&
          f.unidade === unidade &&
          f.area_id === areaIdNum
      )?.centro_custo;
      if (meu) setCentroCusto(meu);
    }
  }, [funcionarios, unidade, areaIdNum, isAdmin]); // eslint-disable-line

  const filtrosOk = !!unidade && !!areaIdNum && !!centroCusto;

  const cargosDisponiveis = useMemo(() => {
    if (!filtrosOk) return [];
    const set = new Set(
      funcionarios
        .filter(
          (f) =>
            f.unidade === unidade &&
            f.area_id === areaIdNum &&
            f.centro_custo === centroCusto
        )
        .map((f) => f.cargo?.trim())
        .filter(Boolean) as string[]
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [funcionarios, filtrosOk, unidade, areaIdNum, centroCusto]);

  /* ---- colaboradores (inclui cargos) ---- */
  const colaboradores = useMemo(() => {
    if (!filtrosOk) return [];
    let lista = funcionarios.filter(
      (f) =>
        f.unidade === unidade &&
        f.area_id === areaIdNum &&
        f.centro_custo === centroCusto
    );

    if (cargosSelecionados.length) {
      lista = lista.filter((f) => f.cargo && cargosSelecionados.includes(f.cargo));
    }

    if (queryColab.trim()) {
      const q = queryColab.toLowerCase();
      lista = lista.filter((f) => f.nome.toLowerCase().includes(q));
    }

    return lista.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [
    funcionarios,
    filtrosOk,
    unidade,
    areaIdNum,
    centroCusto,
    queryColab,
    cargosSelecionados,
  ]);

  const fidsCC = useMemo(() => colaboradores.map((f) => f.id), [colaboradores]);

  const atividadeIdsUsadasNoCC = useMemo(() => {
    const set = new Set<string>();
    for (const fid of fidsCC) {
      (distribuicoes[fid] || []).forEach((d) => set.add(String(d.atividade_id)));
    }
    return set;
  }, [fidsCC, distribuicoes]);

  // *** AQUI É A CHAVE: mesmas regras do cadastro + normalização do CC ***
  const atividadesCombo = useMemo(() => {
    if (!filtrosOk || !areaIdNum) return [] as Atividade[];

    const sel = norm(centroCusto);

    // Base = todas as atividades da ÁREA (carregadas do Supabase)
    // Filtro final = centro_custo normalizado igual ao CC selecionado
    const base = atividades.filter((a) => {
      const sameArea = Number(a.area_id) === areaIdNum;
      const cc = norm((a as any).centro_custo);
      return sameArea && cc === sel;
    });

    if (!somenteDoCC) return base;

    const usadas = base.filter((a) => atividadeIdsUsadasNoCC.has(String(a.id)));
    return usadas.length ? usadas : base;
  }, [atividades, filtrosOk, areaIdNum, centroCusto, somenteDoCC, atividadeIdsUsadasNoCC]);

  const selecionado = useMemo(
    () => colaboradores.find((f) => f.id === selecionadoId) || null,
    [colaboradores, selecionadoId]
  );

  /* ---- ações de edição ---- */
  const commitLinhaSingle = (
    fid: string,
    v: {
      atividade_id: string;
      duracao_ocorrencia_horas: number;
      quantidade_ocorrencias: number;
      frequencia: Frequencia | "";
    }
  ) => {
    setDistribuicoes((prev) => {
      const curr = prev[fid] || [];
      const idx = curr.findIndex((d) => d.atividade_id === v.atividade_id);
      const base: DistribuicaoPorAtividade = {
        atividade_id: v.atividade_id,
        frequencia: "",
        duracao_ocorrencia_horas: 0,
        quantidade_ocorrencias: 0,
      };
      const novo = [...curr];
      if (idx >= 0) novo[idx] = { ...novo[idx], ...v };
      else novo.push({ ...base, ...v });
      return { ...prev, [fid]: novo };
    });
    setDirtyIds((s) => new Set(s).add(fid));
  };

  const commitLinhaBulk = (
    fids: string[],
    v: {
      atividade_id: string;
      duracao_ocorrencia_horas: number;
      quantidade_ocorrencias: number;
      frequencia: Frequencia | "";
    }
  ) => {
    setDistribuicoes((prev) => {
      const out = { ...prev };
      for (const fid of fids) {
        const curr = out[fid] || [];
        const idx = curr.findIndex((d) => d.atividade_id === v.atividade_id);
        const base: DistribuicaoPorAtividade = {
          atividade_id: v.atividade_id,
          frequencia: "",
          duracao_ocorrencia_horas: 0,
          quantidade_ocorrencias: 0,
        };
        const novo = [...curr];
        if (idx >= 0) novo[idx] = { ...novo[idx], ...v };
        else novo.push({ ...base, ...v });
        out[fid] = novo;
      }
      return out;
    });
    setDirtyIds((s) => {
      const next = new Set(s);
      fids.forEach((id) => next.add(id));
      return next;
    });
  };

  const limparTudo = async (ids: string[]) => {
    try {
      for (const fid of ids) {
        const { error } = await adapterSupabase.limparDistribuicoes(fid);
        if (error) throw error;
      }
      setDistribuicoes((prev) => {
        const out = { ...prev };
        ids.forEach((fid) => (out[fid] = []));
        return out;
      });
      setDirtyIds((s) => {
        const next = new Set(s);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      toast.success(ids.length > 1 ? "Distribuições removidas." : "Distribuição removida.");
    } catch (e: any) {
      console.error("Limpar erro:", e);
      toast.error(e?.message || "Erro ao limpar distribuições.");
    }
  };

  const copiarDe = (origemId: string, destinoIds: string[]) => {
    setDistribuicoes((prev) => {
      const src = sanitizeDistribuicoes(prev[origemId] || []);
      const out = { ...prev };
      destinoIds.forEach((did) => {
        out[did] = JSON.parse(JSON.stringify(src));
      });
      return out;
    });
    setDirtyIds((s) => {
      const next = new Set(s);
      destinoIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const preencherRestante = () => {
    const alvo = atividadesCombo[0];
    if (!alvo) return;
    const ids =
      selecionados.length > 1 ? selecionados : selecionado ? [selecionado.id] : [];
    if (ids.length === 0) return;

    setDistribuicoes((prev) => {
      const out = { ...prev };
      ids.forEach((fid) => {
        const f = colaboradores.find((x) => x.id === fid);
        if (!f?.carga_horaria) return;
        const atual = sumHoras(out[fid] || []);
        const restante = Math.max(0, (f.carga_horaria || 0) - atual);
        if (!restante) return;

        const base: DistribuicaoPorAtividade = {
          atividade_id: String(alvo.id),
          frequencia: "Mensal",
          quantidade_ocorrencias: 1,
          duracao_ocorrencia_horas: restante,
        };
        const idx = (out[fid] || []).findIndex(
          (d) => d.atividade_id === String(alvo.id)
        );
        const novo = [...(out[fid] || [])];
        if (idx >= 0) {
          const a = novo[idx];
          novo[idx] = {
            ...a,
            frequencia: "Mensal",
            quantidade_ocorrencias: 1,
            duracao_ocorrencia_horas: (a.duracao_ocorrencia_horas || 0) + restante,
          };
        } else novo.push(base);
        out[fid] = novo;
      });
      return out;
    });

    setDirtyIds((s) => {
      const next = new Set(s);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const salvarAlteracoes = async () => {
    const idsParaSalvar =
      selecionados.length > 1 ? selecionados : selecionado ? [selecionado.id] : [];

    const idsSujo = idsParaSalvar.filter((id) => dirtyIds.has(id));

    const totalValidas = idsSujo.reduce((acc, fid) => {
      const sane = sanitizeDistribuicoes(distribuicoes[fid] || []);
      return acc + sane.length;
    }, 0);

    if (totalValidas === 0) {
      toast.warning(
        "Não há linhas completas para salvar. Preencha horas, ocorrências e frequência."
      );
      return;
    }

    try {
      setSaving(true);
      let descartadas = 0;

      for (const fid of idsSujo) {
        const dist = distribuicoes[fid] || [];
        const sane = sanitizeDistribuicoes(dist);
        descartadas += dist.length - sane.length;

        const { error } = await adapterSupabase.salvarDistribuicoes(fid, sane);
        if (error) throw error;

        setDirtyIds((s) => {
          const next = new Set(s);
          next.delete(fid);
          return next;
        });
      }

      if (descartadas > 0) {
        toast.warning(
          `Algumas linhas sem dados completos foram ignoradas (${descartadas}).`
        );
      }
      toast.success("Alterações salvas.");
    } catch (e: any) {
      console.error("Salvar alterações:", e);
      toast.error(e?.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (colaboradores.length === 0) {
      toast.info("Nenhum colaborador para exportar com os filtros atuais.");
      return;
    }

    setSaving(true); // Reutilizando o estado de 'saving'
    toast.info("Gerando arquivo XLSX...");

    try {
      const dataToExport = [];
      for (const func of colaboradores) {
        const dists = sanitizeDistribuicoes(distribuicoes[func.id] || []);
        for (const dist of dists) {
          const atividade = atividades.find(a => a.id === dist.atividade_id);
            dataToExport.push({
              "Funcionário ID": func.id,
              "Funcionário Nome": func.nome,
              "Cargo": func.cargo,
              "Atividade Nome": atividade?.nome || `ID: ${dist.atividade_id}`,
              "Horas/Ocorrência": dist.duracao_ocorrencia_horas,
              "Ocorrências/Mês": dist.quantidade_ocorrencias,
              "Frequência": dist.frequencia,
              "Total Horas/Mês": dist.duracao_ocorrencia_horas * dist.quantidade_ocorrencias,
            });
          }
      }

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Distribuicoes");
      XLSX.writeFile(workbook, `Distribuicao_${centroCusto.replace(/\s/g, "_")}.xlsx`);
      toast.success("Arquivo gerado com sucesso!");
    } finally {
      setSaving(false);
    }
  };

  /* ---- resumo do selecionado ---- */
  const horasSel = selecionado ? sumHoras(distribuicoes[selecionado.id] || []) : 0;
  const cargaSel = selecionado?.carga_horaria || 0;
  const percSel = cargaSel ? (horasSel / cargaSel) * 100 : 0;

  const inconsistSel = useMemo(() => {
    if (!selecionado) return [];
    const curr = distribuicoes[selecionado.id] || [];
    return curr
      .map((d) => {
        const a = atividades.find((x) => String(x.id) === String(d.atividade_id));
        const total =
          (d.duracao_ocorrencia_horas || 0) * (d.quantidade_ocorrencias || 0);
        if (FREQ_CRITICAS.includes(d.frequencia) && total > (cargaSel || 0) * 0.6) {
          return `“${a?.nome}” ocupa ${total.toFixed(1)}h/mês, mas a frequência é ${d.frequencia.toLowerCase()}.`;
        }
        return null;
      })
      .filter(Boolean) as string[];
  }, [selecionado, distribuicoes, atividades, cargaSel]);

  /* Virtualização */
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const totalRows = atividadesCombo.length;
  const visible = 40;
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
  const end = Math.min(totalRows, start + visible + 10);
  const padTop = start * ROW_HEIGHT;
  const padBottom = (totalRows - end) * ROW_HEIGHT;

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop);
  };

  const modoLote = selecionados.length > 1;

  const idsParaSalvar =
    selecionados.length > 1 ? selecionados : selecionado ? [selecionado.id] : [];
  const idsSujo = idsParaSalvar.filter((id) => dirtyIds.has(id));
  const temAlgumaLinhaValidaNosSujos = useMemo(() => {
    return idsSujo.some(
      (fid) => sanitizeDistribuicoes(distribuicoes[fid] || []).length > 0
    );
  }, [idsSujo, distribuicoes]);

  const podeSalvar = idsSujo.length > 0 && temAlgumaLinhaValidaNosSujos && !saving;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Topbar */}
      <div className="sticky top-0 z-10 border-b bg-white/80 dark:bg-zinc-900/80 backdrop-blur px-6 py-3">
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-50">
          <SlidersHorizontal className="text-yellow-500" />
          <h1 className="text-xl font-semibold">Distribuição Percentual</h1>
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Filtros (alinhados pelo topo) */}
        <section className="grid gap-4 md:grid-cols-12 items-start">
          <div className="md:col-span-3">
            <Label>Unidade</Label>
            <Select
              value={unidade}
              onValueChange={(v) => {
                setUnidade(v);
                setAreaId("");
                setCentroCusto("");
                setSelecionadoId(null);
                setSelecionados([]);
                setCargosSelecionados([]);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {unidades.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-3">
            <Label>Área</Label>
            <Select
              value={areaId}
              onValueChange={(v) => {
                setAreaId(v);
                setCentroCusto("");
                setSelecionadoId(null);
                setSelecionados([]);
                setCargosSelecionados([]);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {areasFiltradas.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-3">
            <Label>Centro de Custo</Label>
            <Select
              value={centroCusto}
              onValueChange={(v) => {
                setCentroCusto(v);
                setSelecionadoId(null);
                setSelecionados([]);
                setCargosSelecionados([]);
              }}
              disabled={centrosCustoDisponiveis.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {centrosCustoDisponiveis.map((cc) => (
                  <SelectItem key={cc} value={cc}>
                    {cc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-3">
            <Label className="opacity-0 select-none">.</Label> {/* Espaçador para alinhar */}
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={colaboradores.length === 0 || saving}
              className="text-blue-600 border-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-300"
            >
              <FileDown className="h-4 w-4 mr-2" />
              {saving ? "Exportando..." : "Exportar Distribuições"}
            </Button>
          </div>

          <div className="md:col-span-6">
            <Label>Cargos</Label>
            <MultiCargoPicker
              options={cargosDisponiveis}
              value={cargosSelecionados}
              onChange={setCargosSelecionados}
              disabled={!filtrosOk || cargosDisponiveis.length === 0}
            />
          </div>

          <div className="md:col-span-3">
            <Label className="opacity-0 select-none"> </Label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={somenteDoCC}
                onChange={(e) => setSomenteDoCC(e.target.checked)}
              />
              Mostrar só atividades usadas neste CC
            </label>
          </div>
        </section>

        {/* Guia rápido */}
        {filtrosOk && mostrarGuia && (
          <div className="mt-4 border rounded-lg bg-white dark:bg-zinc-800/50 p-3 text-sm text-zinc-700 dark:text-zinc-200">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div>
                  <strong>Horas por ocorrência</strong>: tempo de UMA execução (em
                  horas). <em>Ex.: 0,5 = 30 min.</em>
                </div>
                <div>
                  <strong>Ocorrências/mês</strong>: quantas vezes a atividade acontece
                  no mês. <em>Ex.: 20.</em>
                </div>
                <div>
                  <strong>Frequência</strong>: periodicidade usada nas validações
                  (Mensal, Semanal...).
                </div>
                <div>
                  Total = <strong>Horas/ocorr. × Ocorr./mês</strong>. Meta ≈ 100% da
                  carga mensal.
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setMostrarGuia(false)}>
                Entendi
              </Button>
            </div>
          </div>
        )}

        {!filtrosOk ? (
          <div className="mt-10">
            <Card className="bg-white/80">
              <CardContent className="p-8 text-center text-zinc-600 dark:text-zinc-300">
                Selecione <strong>Unidade</strong>, <strong>Área</strong> e{" "}
                <strong>Centro de Custo</strong> para começar.
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
            {/* Coluna colaboradores */}
            <aside className="lg:col-span-3 space-y-3">
              {colaboradores.map((f) => {
                const horas = sumHoras(distribuicoes[f.id] || []);
                const perc = f.carga_horaria ? (horas / f.carga_horaria) * 100 : 0;
                const isSel = selecionadoId === f.id;
                const isChecked = selecionados.includes(f.id);
                const isDirty = dirtyIds.has(f.id);

                return (
                  <Card
                    key={f.id}
                    className={cls(
                      "border hover:shadow-sm transition bg-white",
                      isSel && "border-zinc-900",
                      isChecked && "ring-2 ring-yellow-400"
                    )}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() =>
                              setSelecionados((prev) =>
                                prev.includes(f.id)
                                  ? prev.filter((x) => x !== f.id)
                                  : [...prev, f.id]
                              )
                            }
                          />
                          <button
                            type="button"
                            onClick={() => setSelecionadoId(f.id)}
                            className="text-left"
                          >
                            <div className="font-medium leading-tight flex items-center gap-2">
                              {f.nome}
                              {isDirty && (
                                <span className="text-xs text-amber-600">• não salvo</span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {horas.toFixed(1)} / {f.carga_horaria ?? 0}h
                            </div>
                            <div className="text-[11px] text-zinc-500 truncate">{f.cargo}</div>
                          </button>
                        </div>
                        <span className={cls("text-[11px]", perc > 100 && "text-red-600")}>
                          {Math.min(999, perc).toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded mt-2 overflow-hidden">
                        <div
                          className={cls(
                            "h-1.5 rounded",
                            perc < 90 && "bg-amber-400",
                            perc >= 90 && perc <= 100 && "bg-green-500",
                            perc > 100 && "bg-red-500"
                          )}
                          style={{ width: `${Math.min(100, Math.abs(perc))}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {!colaboradores.length && (
                <div className="text-sm text-zinc-500">
                  Nenhum colaborador nessa combinação.
                </div>
              )}
            </aside>

            {/* Editor */}
            <main className="lg:col-span-6">
              <Card className="bg-white">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">
                        {modoLote
                          ? `Edição em lote (${selecionados.length} colaboradores)`
                          : selecionado
                          ? `Distribuição de ${selecionado.nome}`
                          : "Selecione um colaborador ou marque vários para editar em lote"}
                      </div>
                      {!modoLote && selecionado && (
                        <div className="text-xs text-zinc-500">
                          Carga: {cargaSel}h • Alocado: {horasSel.toFixed(1)}h •{" "}
                          {percSel.toFixed(1)}%
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          limparTudo(
                            modoLote ? selecionados : selecionado ? [selecionado.id] : []
                          )
                        }
                        disabled={modoLote ? selecionados.length === 0 : !selecionado}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        {modoLote ? "Limpar selecionados" : "Limpar"}
                      </Button>

                      <Button
                        onClick={salvarAlteracoes}
                        disabled={!podeSalvar || saving}
                        className="bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-50"
                      >
                        {saving ? "Salvando..." : "Salvar alterações"}
                      </Button>
                    </div>
                  </div>

                  {(modoLote || selecionado) && (
                    <>
                      {/* Ações rápidas */}
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Select
                            onValueChange={(origem) =>
                              copiarDe(
                                origem,
                                modoLote
                                  ? selecionados
                                  : selecionado
                                  ? [selecionado.id]
                                  : []
                              )
                            }
                          >
                            <SelectTrigger className="w-64">
                              <SelectValue placeholder="Copiar distribuição de..." />
                            </SelectTrigger>
                            <SelectContent>
                              {colaboradores.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <HelpTip title="Copiar distribuição">
                            Replica todas as linhas (atividades e valores) do colaborador
                            de origem para o(s) selecionado(s).
                          </HelpTip>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={preencherRestante}>
                            <Sparkles className="h-4 w-4 mr-1" /> Preencher restante
                          </Button>
                          <HelpTip title="Preencher restante">
                            Distribui automaticamente o que falta para 100% na primeira
                            atividade visível.
                          </HelpTip>
                        </div>
                      </div>

                      {/* Tabela */}
                      <div className="mt-4 border rounded-lg overflow-hidden">
                        <div className="grid grid-cols-12 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium px-3 py-2">
                          <div className="col-span-6 flex items-center gap-2">
                            Atividade
                            <HelpTip title="Atividade">
                              Tarefa realizada pelo colaborador. Cadastre/edite em
                              “Cadastro de Atividades”.
                            </HelpTip>
                          </div>
                          <div className="col-span-2 text-right pr-2 flex items-center justify-end gap-2">
                            Horas/ocorr.
                            <HelpTip title="Horas por ocorrência">
                              Tempo médio (em horas) de UMA execução. Use decimais: 0,5 =
                              30 min; 1,25 = 1h15.
                            </HelpTip>
                          </div>
                          <div className="col-span-2 text-right pr-2 flex items-center justify-end gap-2">
                            Ocorr./mês
                            <HelpTip title="Ocorrências por mês">
                              Quantas vezes a atividade acontece no mês. Ex.: 20.
                            </HelpTip>
                          </div>
                          <div className="col-span-2 flex items-center gap-2">
                            Frequência
                            <HelpTip title="Frequência">
                              Periodicidade usada nas validações (alertas).
                            </HelpTip>
                          </div>
                        </div>

                        <div
                          ref={viewportRef}
                          className="max-h-[56vh] overflow-auto"
                          onScroll={handleScroll}
                        >
                          <div style={{ paddingTop: padTop, paddingBottom: padBottom }}>
                            {atividadesCombo.slice(start, end).map((a) => {
                              const ids =
                                selecionados.length > 1
                                  ? selecionados
                                  : selecionado
                                  ? [selecionado.id]
                                  : [];
                              const base =
                                !modoLote && selecionado
                                  ? (distribuicoes[selecionado.id] || []).find(
                                      (d) => d.atividade_id === a.id
                                    )
                                  : undefined;

                              const initial: LinhaValue = {
                                atividade_id: String(a.id),
                                duracao_ocorrencia_horas:
                                  base?.duracao_ocorrencia_horas ?? 0,
                                quantidade_ocorrencias:
                                  base?.quantidade_ocorrencias ?? 0,
                                frequencia: (base?.frequencia ?? "") as any,
                              };

                              const onCommit = (val: {
                                atividade_id: string;
                                duracao_ocorrencia_horas: number;
                                quantidade_ocorrencias: number;
                                frequencia: Frequencia | "";
                              }) =>
                                selecionados.length > 1
                                  ? commitLinhaBulk(ids, val)
                                  : selecionado
                                  ? commitLinhaSingle(selecionado.id, val)
                                  : null;

                              return (
                                <LinhaAtividade
                                  key={`${a.id}-${selecionado?.id ?? "lote"}`}
                                  atividadeNome={a.nome}
                                  cargaMensal={selecionado?.carga_horaria || 0}
                                  initial={initial}
                                  modoLote={modoLote}
                                  onCommit={onCommit!}
                                />
                              );
                            })}
                            {!atividadesCombo.length && (
                              <div className="px-3 py-5 text-sm text-zinc-500">
                                Nenhuma atividade para esta combinação.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </main>

            {/* Resumo */}
            <aside className="lg:col-span-3">
              <Card className="bg-white">
                <CardContent className="p-4 sticky top-16 space-y-3">
                  <div className="text-base font-semibold">Resumo</div>
                  {selecionado ? (
                    <>
                      <ResumoLinha label="Carga Horária" value={`${cargaSel} h`} />
                      <ResumoLinha
                        label="Horas Alocadas"
                        value={`${horasSel.toFixed(1)} h`}
                      />
                      <ResumoLinha
                        label="% Alocado"
                        value={`${percSel.toFixed(1)} %`}
                      />
                      <div className="mt-2">
                        <div className="text-sm font-medium mb-1">Validações</div>
                        {inconsistSel.length ? (
                          <ul className="list-disc list-inside text-xs text-zinc-600 dark:text-zinc-300">
                            {inconsistSel.map((m, i) => (
                              <li key={i}>{m}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-xs text-zinc-500">
                            Nenhuma inconsistência relevante.
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-zinc-500">
                      Selecione um colaborador para ver o resumo.
                    </div>
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========= Subcomponentes ========= */
function ResumoLinha({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm border rounded px-2 py-1 bg-zinc-50 dark:bg-zinc-800/60">
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
