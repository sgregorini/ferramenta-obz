// src/adapters/adapterSupabase.ts
import { supabase } from "../lib/supabase";
import { Area, Funcionario, Atividade, Distribuicao } from "../types";

/* ============ Utils ============ */
const toNum = (v: any, min = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n) || Number.isNaN(n)) return min;
  return Math.max(min, n);
};
const isStr = (v: any) => typeof v === "string" && v.trim().length > 0;
const asUUID = (v: any) => (isStr(v) ? String(v).trim() : "");

/* Inserção em chunks (para payloads grandes) */
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

export const adapterSupabase = {
  /* ============ Leituras ============ */
  async getAreas(): Promise<Area[]> {
    const { data, error } = await supabase.from("areas").select("*");
    if (error) {
      console.error("getAreas error:", error);
      return [];
    }
    return (data || []) as Area[];
  },

  async getFuncionarios(): Promise<Funcionario[]> {
    const { data, error } = await supabase.from("funcionarios").select("*");
    if (error) {
      console.error("getFuncionarios error:", error);
      return [];
    }
    return (data || []) as Funcionario[];
  },

  async getAtividades(): Promise<Atividade[]> {
    const { data, error } = await supabase
      .from("atividades")
      .select("id, nome, descricao, tipo, cliente, recursos_necessarios, area_id, centro_custo");
    if (error || !data) return [];
    return data as Atividade[];
  },

  async getDistribuicaoReal(): Promise<Distribuicao[]> {
    const { data, error } = await supabase.from("distribuicao_percentual").select("*");
    if (error) {
      console.error("getDistribuicaoReal error:", error);
      return [];
    }
    return (data || []) as Distribuicao[];
  },

  async getDistribuicoesPorAtividadeIds(ids: string[]): Promise<Distribuicao[]> {
    const clean = (ids || []).map(asUUID).filter(isStr);
    if (!clean.length) return [];
    const { data, error } = await supabase
      .from("distribuicao_percentual")
      .select("*")
      .in("atividade_id", clean);
    if (error) {
      console.error("getDistribuicoesPorAtividadeIds error:", error);
      return [];
    }
    return (data || []) as Distribuicao[];
  },

  /* ============ CRUD Atividades (id = UUID string) ============ */
  async insertAtividade(payload: {
    nome: string;
    descricao: string;
    tipo: string;
    cliente: string;
    recursos_necessarios?: string;
    area_id: number;
    centro_custo?: string | null;
  }): Promise<{ error: any }> {
    const { error, status } = await supabase.from("atividades").insert(payload as any);
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
      recursos_necessarios?: string;
      area_id: number;
      centro_custo?: string | null;
    }
  ): Promise<{ error: any }> {
    const { error, status } = await supabase.from("atividades").update(payload as any).eq("id", id);
    if (error) console.error("updateAtividade error:", { status, error });
    return { error };
  },

  async deleteAtividade(id: string): Promise<{ error: any }> {
    const { error, status } = await supabase.from("atividades").delete().eq("id", id);
    if (error) console.error("deleteAtividade error:", { status, error });
    return { error };
  },

  /* ============ Simulações ============ */
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

  /* ============ Distribuições (replace por upsert) ============ */
  /**
   * Substitui/atualiza as linhas enviadas (por atividade), sem duplicar.
   * Usa UPSERT com onConflict (funcionario_id, atividade_id).
   * Se quiser comportamento "apagar o resto", chame limparDistribuicoes antes.
   */
// adapterSupabase.ts
async salvarDistribuicoes(funcionario_id: string, distribuicoes: any[]) {
  const isStr = (v: any) => typeof v === "string" && v.trim().length > 0;
  const toNum = (v: any, min = 0) => {
    const n = Number(v);
    if (!Number.isFinite(n) || Number.isNaN(n)) return min;
    return Math.max(min, n);
  };
  const asUUID = (v: any) => {
    if (!isStr(v)) return "";
    const s = String(v).trim();
    return s; // mantém string UUID
  };

  if (!isStr(funcionario_id)) {
    const error = "funcionario_id ausente ou inválido";
    console.error("salvarDistribuicoes:", error);
    return { error };
  }

  // Monta registros normalizados (inclui SEMPRE 'frequencia')
  const registros = (Array.isArray(distribuicoes) ? distribuicoes : [])
    .map((d) => {
      const atividade_id = asUUID(d?.atividade_id || "");
      if (!isStr(atividade_id)) return null; // ignora linhas sem id
      const duracao = toNum(d?.duracao_ocorrencia_horas, 0);
      const ocorr = toNum(d?.quantidade_ocorrencias, 0);

      // IMPORTANTE: frequencia SEMPRE presente no payload (string ou null)
      const frequencia = isStr(d?.frequencia) ? String(d.frequencia) : null;

      return {
        funcionario_id,                 // TEXT (UUID do funcionário como texto)
        atividade_id,                   // UUID
        duracao_ocorrencia_horas: duracao,
        quantidade_ocorrencias: ocorr,
        frequencia,                     // <- VAI NO PAYLOAD
        calculado_total_horas: duracao * ocorr,
        complexidade: d?.complexidade ?? null,
        prioridade: d?.prioridade ?? null,
      };
    })
    .filter(Boolean) as any[];

  try {
    // UPSERT com a constraint UNIQUE(funcionario_id, atividade_id)
    const { error, status } = await supabase
      .from("distribuicao_percentual")
      .upsert(registros, {
        onConflict: "funcionario_id,atividade_id",
        ignoreDuplicates: false,
        defaultToNull: false, // não zera colunas omitidas
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

  /** Apaga TODAS as linhas de um colaborador (use antes do upsert se quiser 'replace all') */
  async limparDistribuicoes(funcionarioId: string): Promise<{ error: any }> {
    try {
      const { error, status } = await supabase
        .from("distribuicao_percentual")
        .delete()
        .eq("funcionario_id", funcionarioId);
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
};
