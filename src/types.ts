export interface Funcionario {
  id: number;
  nome: string;
  cargo: string;
  responde_para?: number | null;
  salario: number;
  area_id: number;
  carga_horaria: number;
  regime: string;
  email: string;
  senha_hash: string;
  ativo: boolean;
  permissao?: "admin" | "preenchedor" | "visualizador";
  flag_acesso_sistema?: boolean;
  empresa?: string;
  unidade_original?: string;
  tipo_unidade?: string;
  centro_custo?: string;
  cargo_original?: string;
  cargo_resumido?: string;
  composicao_salarial?: string;
  data_admissao?: string; // ou Date
  salario_total?: number;
  responsavel_centro_custo?: string;

  // Calculado no frontend
  possui_atividade?: boolean;
}

export interface Area {
  id: number;
  nome: string;
  responsavel: string;
  cor?: string;
  unidade?: string;
  status?: string;
  responsavel_id: number
}


export interface Atividade {
  id: number;
  nome: string;
  tipo: string;
  descricao?: string;
  cliente?: string;
  recursos_necessarios?: string;
  area_id: number; // <-- Remova o `?`
}


export interface Distribuicao {
  id: number;
  funcionario_id: number;
  atividade_id: number;
  frequencia: string;
  duracao_ocorrencia_horas: number;
  quantidade_ocorrencias: number;
  calculado_total_horas?: number;
  complexidade?: number;
  prioridade?: number;
  gasto_estimado?: number;
}


export interface DistribuicaoSimulada {
  id: number;
  simulacao_nome: string;
  area_id: number;
  funcionario_id: number;
  atividade_id: number;
  percentual: number;
  criado_em: string;
}


export interface SimulacaoResumo {
  simulacao_nome: string;
}

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  role?: string;
  area_id?: number;
  permissao: "admin" | "preenchedor" | "visualizador"; 
}

