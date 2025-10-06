// types.ts
export interface Funcionario {
  id: string; // text
  nome: string;
  cargo: string;
  responde_para?: string | null;
  salario: number | null;
  area_id?: number | null;
  carga_horaria: number | null;
  regime: string | null;
  unidade?: string | null;
  tipo_unidade?: string | null;
  centro_custo?: string | null;
  cargo_original?: string | null;
  composicao_salarial?: string | null;
  data_admissao?: string | null;
  salario_total?: number | null;
  responsavel_centro_custo?: boolean | null; // no banco é numeric, mas melhor mapear como boolean
  nivel_hierarquico?: string | null; // no banco é text, não number
}

export interface Area {
  id: number; // integer
  nome?: string | null;
  responsavel?: string | null;
  cor?: string | null;
  status?: string | null;
  responsavel_id?: string | null;
}

export interface Atividade {
  id: string; // uuid
  nome: string;
  descricao?: string | null;
  tipo?: string | null;
  cliente?: string | null;
  recursos_necessarios?: string | null;
  area_id?: number | null;
  centro_custo?: string | null;
}

export interface Atividade_Modelo {
  id: number; // integer
  nome: string;
  descricao?: string | null;
  tipo?: string | null;
  nivel_cargo?: string;
  cliente?: string | null;
  recursos_necessarios?: string | null;
  criado_em?: string | null; // timestamptz
}

// OBS: a tabela distribuicao_percentual no seu schema tem id UUID,
// funcionario_id TEXT, atividade_id UUID, e vários NUMERIC.
// Deixo os tipos alinhados ao banco:
export interface Distribuicao {
  id: string; // uuid
  funcionario_id?: string | null; // text (UUID do funcionário salvo como text)
  atividade_id?: string | null; // uuid
  percentual?: number | null;
  frequencia?: number | string | null; // pode ser numeric no banco; no app você usa labels
  complexidade?: number | null;
  prioridade?: number | null;
  gasto_estimado?: number | null;
  duracao_ocorrencia_horas?: number | null;
  quantidade_ocorrencias?: number | null;
  calculado_total_horas?: number | null;
  funcionario_centro_custo?: string | null; // Adicionado
  gestor_id?: string | null;               // Adicionado
  gestor_nome?: string | null;             // Adicionado
}

export interface Usuario {
  id: string; // UUID (public.usuarios.id)
  email: string;
  permissao: "admin" | "preenchedor" | "visualizador";
  ativo: boolean;
  flag_acesso_sistema?: boolean;
  criado_em?: string; // timestamp
  funcionario_id?: string | null; // text (UUID do funcionário como text)
  senha_hash?: string | null;
  nome?: string | null;
}

export interface ResponsavelCentroCusto {
  id: string;
  unidade: string | null;
  centro_custo: string | null;
  funcionario_id: string | null;
  diretoria: string | null;
  created_at?: string | null;
}
