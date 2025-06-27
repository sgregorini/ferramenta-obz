import { supabase } from "../lib/supabase";
import { Area, Funcionario, Atividade, Distribuicao } from "../types";

export const adapterSupabase = {
  async getAreas(): Promise<Area[]> {
    const { data, error } = await supabase.from("areas").select("*");
    if (error) throw error;
    return data || [];
  },

  async getFuncionarios(): Promise<Funcionario[]> {
    const { data, error } = await supabase.from("funcionarios").select("*");
    if (error) throw error;
    return data || [];
  },

  async getAtividades(): Promise<Atividade[]> {
    const { data, error } = await supabase
      .from("atividades")
      .select("id, nome, descricao, tipo, cliente, recursos_necessarios, area_id");
    if (error || !data) return [];
    return data;
  },

  async getDistribuicaoReal(): Promise<Distribuicao[]> {
    const { data, error } = await supabase.from("distribuicao_percentual").select("*");
    return error || !data ? [] : data;
  },

  async getDistribuicoesPorAtividadeIds(ids: number[]): Promise<Distribuicao[]> {
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from("distribuicao_percentual")
      .select("*")
      .in("atividade_id", ids);
    return error || !data ? [] : data;
  },

  async insertAtividade(payload: {
    nome: string;
    descricao: string;
    tipo: string;
    cliente: string;
    recursos_necessarios?: string;
    area_id: number;
  }): Promise<{ error: any }> {
    const { error } = await supabase.from("atividades").insert(payload);
    return { error };
  },

  async updateAtividade(
    id: number,
    payload: {
      nome: string;
      descricao: string;
      tipo: string;
      cliente: string;
      recursos_necessarios?: string;
      area_id: number;
    }
  ): Promise<{ error: any }> {
    const { error } = await supabase
      .from("atividades")
      .update(payload)
      .eq("id", id);
    return { error };
  },

  async deleteAtividade(id: number): Promise<{ error: any }> {
    const { error } = await supabase.from("atividades").delete().eq("id", id);
    return { error };
  },

  async getDistribuicoesSimuladas(nome?: string): Promise<Distribuicao[]> {
    const query = supabase.from("distribuicoes_simuladas").select("*");
    const { data, error } = nome ? await query.eq("simulacao_nome", nome) : await query;
    return error || !data ? [] : data;
  },

  async insertDistribuicaoSimulada(
    dados: (Distribuicao & { simulacao_nome: string })[]
  ): Promise<{ error: any }> {
    const { error } = await supabase.from("distribuicoes_simuladas").insert(dados);
    return { error };
  },

  async deleteSimulacao(nome: string): Promise<{ error: any }> {
    const promises = [
      supabase.from("estrutura_simulada").delete().eq("simulacao_nome", nome),
      supabase.from("atividades_simuladas").delete().eq("simulacao_nome", nome),
      supabase.from("distribuicoes_simuladas").delete().eq("simulacao_nome", nome),
    ];
    const results = await Promise.all(promises);
    return results.find((r) => r.error) || { error: null };
  },

  async getNomesUnicosSimulacoes(): Promise<{ simulacao_nome: string; criado_em: string }[]> {
    const { data, error } = await supabase
      .from("distribuicoes_simuladas")
      .select("simulacao_nome, criado_em")
      .order("criado_em", { ascending: false });
    if (error || !data) return [];
    return data;
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

  async salvarDistribuicoes(funcionario_id: string, distribuicoes: any[]) {
    const registros = distribuicoes.map((d) => ({
      funcionario_id,
      atividade_id: d.atividade_id,
      frequencia: d.frequencia,
      duracao_ocorrencia_horas: d.duracao_ocorrencia_horas,
      quantidade_ocorrencias: d.quantidade_ocorrencias,
      calculado_total_horas: d.duracao_ocorrencia_horas * d.quantidade_ocorrencias,
      complexidade: d.complexidade ?? null,
      prioridade: d.prioridade ?? null,
    }));

    const { error } = await supabase
      .from("distribuicao_percentual")
      .delete()
      .eq("funcionario_id", funcionario_id);
    if (error) return { error };

    const { error: insertError } = await supabase
      .from("distribuicao_percentual")
      .insert(registros);
    return { error: insertError };
  },

  async limparDistribuicoes(funcionarioId: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from("distribuicao_percentual")
      .delete()
      .eq("funcionario_id", funcionarioId);
    return { error };
  },
};
