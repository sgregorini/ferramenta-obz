from supabase import create_client, Client
import pandas as pd
from dotenv import load_dotenv
import os

# Load env vars
load_dotenv()
SUPABASE_URL = "https://jnqoxczvhjarprnvedsf.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpucW94Y3p2aGphcnBybnZlZHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxMTI0NzcsImV4cCI6MjA2MzY4ODQ3N30.aW6M5Mi5Lo4fVLq3qnZVmEJvJPpQQXUPKsD_J7fcsso"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


file_path = "REDE PRIMAVERA - RELATÓRIO DA CONSULTORIA HC 2.xlsx"
df = pd.read_excel(file_path, sheet_name="BASE")
df.columns = df.columns.str.strip()

# === 1. Tabela AREAS com ID manual ===
df_areas_raw = df[["Área", "Unidade Negócio", "Responsável Área"]].dropna().drop_duplicates()
df_areas_raw.columns = ["area_nome", "unidade", "responsavel_nome"]
df_func_ids = df.rename(columns={"Cadastro": "id", "Nome": "nome"})[["id", "nome"]]
df_areas = df_areas_raw.merge(df_func_ids, how="left", left_on="responsavel_nome", right_on="nome")
df_areas = df_areas.rename(columns={"id": "responsavel"})
df_areas["cor"] = "#CCCCCC"
df_areas["status"] = "ativa"
df_areas["id"] = range(1, len(df_areas) + 1)
df_areas_final = df_areas.rename(columns={"area_nome": "nome"})[["id", "nome", "unidade", "responsavel", "cor", "status"]]

supabase.table("areas").delete().neq("id", 0).execute()
supabase.table("areas").insert(df_areas_final.to_dict(orient="records")).execute()

# === 2. Tabela FUNCIONARIOS ===
de_para_area = {(row["nome"], row["unidade"]): row["id"] for _, row in df_areas_final.iterrows()}
df["area_id"] = df.apply(lambda row: de_para_area.get((row["Área"], row["Unidade Negócio"])), axis=1)

df_func_final = df.rename(columns={
    "Cadastro": "id",
    "Nome": "nome",
    "Cargos": "cargo",
    "Salario": "salario",
    "Jornada Horas": "carga_horaria",
    "Regime": "regime",
    "Admissão": "admissao",
})[[
    "id", "nome", "cargo", "salario", "carga_horaria", "regime", "admissao", "area_id"
]]

supabase.table("funcionarios").delete().neq("id", 0).execute()
supabase.table("funcionarios").upsert(df_func_final.to_dict(orient="records")).execute()

# === 3. Tabela COMPOSICAO_SALARIAL ===
df_comp = df.rename(columns={"Cadastro": "funcionario_id", "referência": "referencia"})[[
    "funcionario_id", "referencia", "Salario", "Insalubridade", "Periculosidade",
    "Adicional Função", "Anuênio", "Gratificação Setor", "Adic. Tomo/Ressonância",
    "Gratificação RT", "Gratificação Assessoria", "Grat., Pós Graduação",
    "Ajuda de Custo", "Quebra de Caixa", "Remuneração", "Custo/Encargos 58,64%",
    "Ticket", "Plano de Saúde", "Plano Odonto", "Seguro vida", "Total remuneração"
]]
df_comp.columns = df_comp.columns.str.replace(" ", "_").str.lower()

supabase.table("composicoes_salarial").delete().neq("id", 0).execute()
supabase.table("composicoes_salarial").insert(df_comp.to_dict(orient="records")).execute()

print("✅ Base enviada com sucesso para o Supabase!")
