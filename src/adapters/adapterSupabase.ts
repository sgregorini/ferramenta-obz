// src/adapters/adapterSupabase.ts
import { supabase } from "../lib/supabase";
import type { Area, Funcionario, Atividade, Distribuicao } from "../types";

/* ================== Utils ================== */
const isStr = (v: any): v is string => typeof v === "string" && v.trim().length > 0;
const normStr = (v: any) => (isStr(v) ? v.trim() : "");
const toNum = (v: any, min = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n) || Number.isNaN(n)) return min;
  return Math.max(min, n);
};
const asUUID = (v: any) => normStr(v);

/** Inserção em chunks (útil p/ payloads grandes) */
async function insertInChunks<T>(table: string, rows: T[], chunk = 200) {
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error, status } = await supabase.from(table).insert(slice as any);
    if (error) {
      console.error(`Insert chunk failed (${table})`, { status, error });
      return { error };
    }
  }
  return { error: null };
}

/* ================== Leitura paginada (PostgREST range inclusivo) ================== */
const PAGE_SIZE = 2000;

/**
 * Busca todas as linhas de uma tabela/view em blocos usando .range().
 * Tipagem do builder como `any` para compat v2 (@supabase/postgrest-js).
 */
async function fetchAllRows<T>(
  from: string,
  selectCols: string,
  decorate?: (q: any) => any
): Promise<T[]> {
  let start = 0;
  const out: T[] = [];
  while (true) {
    let q: any = supabase.from(from).select(selectCols);
    if (decorate) q = decorate(q);            // ex.: .order('id', { ascending: false })
    q = q.range(start, start + PAGE_SIZE - 1); // .range sempre por último
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data as T[]) || [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }
  return out;
}

/* ===========================================================
   Adapter
   =========================================================== */
export const adapterSupabase = {
  /* ============ Leituras básicas ============ */
  async getAreas(): Promise<Area[]> {
    try {
      const data = await fetchAllRows<Area>("areas", "*");
      return data || [];
    } catch (error) {
      console.error("getAreas error:", error);
      return [];
    }
  },

  async getFuncionarios(): Promise<Funcionario[]> {
    try {
      const data = await fetchAllRows<any>("funcionarios", "*");
      // Normaliza ID (remove espaços etc.) para bater com chaves usadas na distribuição
      return (data || []).map((f: any) => ({
        ...f,
        id: normStr(f.id),
      })) as Funcionario[];
    } catch (error) {
      console.error("getFuncionarios error:", error);
      return [];
    }
  },

  async getAtividades(): Promise<Atividade[]> {
    try {
      const data = await fetchAllRows<Atividade>(
        "atividades",
        "id, nome, descricao, tipo, cliente, recursos_necessarios, area_id, centro_custo"
      );
      return data || [];
    } catch (error) {
      console.error("getAtividades error:", error);
      return [];
    }
  },

  /* ===========================================================
     DISTRIBUIÇÃO — leitura via VIEW (robusto, paginado)
     =========================================================== */
  async getDistribuicaoReal(): Promise<Distribuicao[]> {
    try {
      const rows = await fetchAllRows<any>(
        "vw_distribuicao_completa",
        `
          dp_id,
          funcionario_id,
          funcionario_nome,
          funcionario_cargo,
          funcionario_unidade,
          atividade_id,
          atividade_nome,
          frequencia,
          duracao_ocorrencia_horas,
          quantidade_ocorrencias,
          calculado_total_horas,
          area_id_oficial,
          area_nome_oficial
        `,
        // ordena para estabilidade entre páginas
        (q) => q.order("dp_id", { ascending: false })
      );

      return (rows || []).map((d: any) => ({
        id: normStr(d.dp_id),
        funcionario_id: normStr(d.funcionario_id),
        funcionario_nome: d.funcionario_nome ?? null,
        funcionario_cargo: d.funcionario_cargo ?? null,
        funcionario_unidade: d.funcionario_unidade ?? null,
        atividade_id: normStr(d.atividade_id),
        atividade_nome: d.atividade_nome ?? null,
        frequencia: d.frequencia ?? null,
        duracao_ocorrencia_horas: toNum(d.duracao_ocorrencia_horas, 0),
        quantidade_ocorrencias: toNum(d.quantidade_ocorrencias, 0),
        calculado_total_horas: toNum(d.calculado_total_horas, 0),
        area_id_oficial: normStr(d.area_id_oficial),
        area_nome_oficial: d.area_nome_oficial ?? null,
      })) as Distribuicao[];
    } catch (error) {
      console.error("getDistribuicaoReal error:", error);
      return [];
    }
  },

  async getDistribuicoesPorAtividadeIds(ids: string[]): Promise<Distribuicao[]> {
    const clean = (ids || []).map(asUUID).filter(isStr);
    if (!clean.length) return [];
    try {
      const { data, error } = await (supabase as any)
        .from("vw_distribuicao_completa")
        .select(`
          dp_id,
          funcionario_id,
          funcionario_nome,
          funcionario_cargo,
          funcionario_unidade,
          atividade_id,
          atividade_nome,
          frequencia,
          duracao_ocorrencia_horas,
          quantidade_ocorrencias,
          calculado_total_horas,
          area_id_oficial,
          area_nome_oficial
        `)
        .in("atividade_id", clean)
        .order("dp_id", { ascending: false });

      if (error) throw error;

      return (data || []).map((d: any) => ({
        id: normStr(d.dp_id),
        funcionario_id: normStr(d.funcionario_id),
        funcionario_nome: d.funcionario_nome ?? "—",
        funcionario_cargo: d.funcionario_cargo ?? "—",
        funcionario_unidade: d.funcionario_unidade ?? "—",
        atividade_id: normStr(d.atividade_id),
        atividade_nome: d.atividade_nome ?? "— sem atividade —",
        frequencia: d.frequencia ?? "",
        duracao_ocorrencia_horas: toNum(d.duracao_ocorrencia_horas, 0),
        quantidade_ocorrencias: toNum(d.quantidade_ocorrencias, 0),
        calculado_total_horas: toNum(d.calculado_total_horas, 0),
        area_id_oficial: normStr(d.area_id_oficial),
        area_nome_oficial: d.area_nome_oficial ?? "—",
      })) as unknown as Distribuicao[];
    } catch (error) {
      console.error("getDistribuicoesPorAtividadeIds error:", error);
      return [];
    }
  },

  /* ===========================================================
     DISTRIBUIÇÃO — salvar (UPSERT por funcionário + atividade)
     =========================================================== */
  async salvarDistribuicoes(
    funcionario_id: string,
    distribuicoes: Array<{
      atividade_id: string;
      frequencia?: string | null;
      duracao_ocorrencia_horas?: number;
      quantidade_ocorrencias?: number;
    }>
  ): Promise<{ error: any }> {
    const fid = normStr(funcionario_id);
    if (!fid) {
      const error = "funcionario_id ausente ou inválido";
      console.error("salvarDistribuicoes:", error);
      return { error };
    }

    const registros = (Array.isArray(distribuicoes) ? distribuicoes : [])
      .map((d) => {
        const atividade_id = asUUID(d?.atividade_id || "");
        if (!atividade_id) return null; // não upsert sem atividade
        const horas = toNum(d?.duracao_ocorrencia_horas, 0);
        const ocorr = toNum(d?.quantidade_ocorrencias, 0);
        const freq = isStr(d?.frequencia) ? String(d?.frequencia) : (d?.frequencia ?? null);

        return {
          funcionario_id: fid,                 // TEXT
          atividade_id,                        // UUID
          frequencia: freq,                    // string ou null
          duracao_ocorrencia_horas: horas,
          quantidade_ocorrencias: ocorr,
          calculado_total_horas: horas * ocorr,
        };
      })
      .filter(Boolean) as any[];

    try {
      const { error, status } = await supabase
        .from("distribuicao_percentual")
        .upsert(registros, {
          onConflict: "funcionario_id,atividade_id",
          ignoreDuplicates: false,
          defaultToNull: false,
        });

      if (error) {
        console.error("upsert distribuicao_percentual error:", { status, error });
        return { error };
      }
      return { error: null };
    } catch (e) {
      console.error("salvarDistribuicoes exception:", e);
      return { error: e };
    }
  },

  /** Remove todas as linhas de um colaborador (útil para "replace all"). */
  async limparDistribuicoes(funcionarioId: string): Promise<{ error: any }> {
    try {
      const { error, status } = await supabase
        .from("distribuicao_percentual")
        .delete()
        .eq("funcionario_id", normStr(funcionarioId));
      if (error) {
        console.error("limparDistribuicoes error:", { status, error });
        return { error };
      }
      return { error: null };
    } catch (e) {
      console.error("limparDistribuicoes exception:", e);
      return { error: e };
    }
  },

  /* ============ CRUD Atividades ============ */
  async insertAtividade(payload: {
    nome: string;
    descricao: string;
    tipo: string;
    cliente: string;
    recursos_necessarios?: string | null;
    area_id: number;
    centro_custo?: string | null;
  }): Promise<{ error: any }> {
    const body = {
      ...payload,
      nome: normStr(payload.nome),
      descricao: normStr(payload.descricao),
      tipo: normStr(payload.tipo),
      cliente: normStr(payload.cliente),
      recursos_necessarios: payload.recursos_necessarios ?? null,
      centro_custo: payload.centro_custo ?? null,
    };
    const { error, status } = await supabase.from("atividades").insert(body as any);
    if (error) console.error("insertAtividade error:", { status, error });
    return { error };
  },

  async updateAtividade(
    id: string,
    payload: {
      nome: string;
      descricao: string;
      tipo: string;
      cliente: string;
      recursos_necessarios?: string | null;
      area_id: number;
      centro_custo?: string | null;
    }
  ): Promise<{ error: any }> {
    const body = {
      ...payload,
      nome: normStr(payload.nome),
      descricao: normStr(payload.descricao),
      tipo: normStr(payload.tipo),
      cliente: normStr(payload.cliente),
      recursos_necessarios: payload.recursos_necessarios ?? null,
      centro_custo: payload.centro_custo ?? null,
    };
    const { error, status } = await supabase
      .from("atividades")
      .update(body as any)
      .eq("id", asUUID(id));
    if (error) console.error("updateAtividade error:", { status, error });
    return { error };
  },

  async deleteAtividade(id: string): Promise<{ error: any }> {
    const { error, status } = await supabase.from("atividades").delete().eq("id", asUUID(id));
    if (error) console.error("deleteAtividade error:", { status, error });
    return { error };
  },

  /* ============ Simulações (seu código original, mantido) ============ */
  async getDistribuicoesSimuladas(nome?: string): Promise<Distribuicao[]> {
    const query = supabase.from("distribuicoes_simuladas").select("*");
    const { data, error } = nome ? await query.eq("simulacao_nome", nome) : await query;
    if (error) {
      console.error("getDistribuicoesSimuladas error:", error);
      return [];
    }
    return (data || []) as Distribuicao[];
  },

  async insertDistribuicaoSimulada(
    dados: (Distribuicao & { simulacao_nome: string })[]
  ): Promise<{ error: any }> {
    const { error, status } = await supabase.from("distribuicoes_simuladas").insert(dados as any);
    if (error) console.error("insertDistribuicaoSimulada error:", { status, error });
    return { error };
  },

  async deleteSimulacao(nome: string): Promise<{ error: any }> {
    const results = await Promise.all([
      supabase.from("estrutura_simulada").delete().eq("simulacao_nome", nome),
      supabase.from("atividades_simuladas").delete().eq("simulacao_nome", nome),
      supabase.from("distribuicoes_simuladas").delete().eq("simulacao_nome", nome),
    ]);
    const failing = results.find((r) => (r as any).error);
    if ((failing as any)?.error) console.error("deleteSimulacao error:", (failing as any).error);
    return (failing as any) || { error: null };
  },

  async getNomesUnicosSimulacoes(): Promise<{ simulacao_nome: string; criado_em: string }[]> {
    const { data, error } = await supabase
      .from("distribuicoes_simuladas")
      .select("simulacao_nome, criado_em")
      .order("criado_em", { ascending: false });
    if (error) {
      console.error("getNomesUnicosSimulacoes error:", error);
      return [];
    }
    return (data || []) as any[];
  },

  async getSimulacaoCompleta(nome: string) {
    const [estrutura, atividades, distribuicoes] = await Promise.all([
      supabase.from("estrutura_simulada").select("*").eq("simulacao_nome", nome),
      supabase.from("atividades_simuladas").select("*").eq("simulacao_nome", nome),
      supabase.from("distribuicoes_simuladas").select("*").eq("simulacao_nome", nome),
    ]);
    return {
      estrutura: estrutura.data,
      atividades: atividades.data,
      distribuicoes: distribuicoes.data,
    };
  },
};

// DEBUG: expõe no console do navegador em ambiente de desenvolvimento
if (import.meta.env.DEV) {
  // @ts-ignore
  (globalThis as any).adapterSupabase = adapterSupabase;
}
