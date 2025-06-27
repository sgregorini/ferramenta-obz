import pandas as pd
import os

# Caminho do arquivo Excel
arquivo_excel = "P&L ABRIL 2025.xlsx"
abas_teste = ["AGS", "GDL"]  # teste só com 2 unidades

# Carrega arquivo
xls = pd.ExcelFile(arquivo_excel)
dados = []

# Palavras-chave para IGNORAR contas que não devem ser somadas
palavras_chave_ignorar = ["%", "índice", "margen", "variação", "taxa"]

# Loop nas abas
for unidade in abas_teste:
    df = pd.read_excel(xls, sheet_name=unidade, header=None)

    if df.shape[0] < 7 or df.shape[1] < 4:
        continue

    meses = df.iloc[6, 3:]
    contas = df.iloc[7:, 2]
    valores = df.iloc[7:, 3:]

    for i, conta in enumerate(contas):
        nome_conta = str(conta).strip().lower()
        if any(palavra in nome_conta for palavra in palavras_chave_ignorar):
            continue  # pula linhas de percentual ou indicador

        for j, mes in enumerate(meses):
            valor = valores.iat[i, j]
            if pd.notna(valor) and isinstance(valor, (int, float)):
                dados.append({
                    "Conta": str(conta).strip(),
                    "Unidade": unidade,
                    "Mês": str(mes).strip(),
                    "Valor": valor
                })

# Criar DataFrame e calcular total consolidado
df_longo = pd.DataFrame(dados)
df_total = (
    df_longo.groupby(["Conta", "Mês"], as_index=False)
    .agg({"Valor": "sum"})
    .assign(Unidade="TOTAL")
)

# Combinar detalhado + total
df_final = pd.concat([df_longo, df_total], ignore_index=True)

# Exportar para CSV
nome_arquivo = "Consolidado_AGS_GDL_Optimizado.csv"
df_final.to_csv(nome_arquivo, index=False, encoding="utf-8-sig")

print(f"Arquivo gerado com sucesso: {os.path.abspath(nome_arquivo)}")
