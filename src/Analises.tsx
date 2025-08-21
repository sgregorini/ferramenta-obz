import React from "react"
import { BarChart as BarChartIcon } from "lucide-react"

export default function AnalisesBI() {
  // URL de embed do seu relatório de Análises
  const embedUrl =
    "https://app.powerbi.com/reportEmbed?reportId=d8b435fa-56f6-43c9-9dfd-0f8ca7e0986e" +
    "&autoAuth=true&ctid=a743694b-8593-4647-bafb-ad9faa1cc904" +
    "&filterPaneEnabled=false&navContentPaneEnabled=false"

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 px-8 py-6">
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-4xl font-akkoMedium text-zinc-900 dark:text-white flex items-center gap-2">
          <BarChartIcon className="text-yellow-500" size={28} />
          Análises de Estrutura
        </h1>
        <div className="h-1 w-32 bg-yellow-400 mt-1 rounded" />
        <p className="text-zinc-500 dark:text-zinc-300 mt-2 text-[20px]">
          Aqui estão suas análises de SPAN, profundidade hierárquica e outros insights – diretamente
          do Power BI.
        </p>
      </div>

      {/* Embed do Power BI */}
      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-2">
        <div className="w-full h-[80vh]">
          <iframe
            title="BI - Rede Primavera"
            src={embedUrl}
            className="w-full h-full border-0 rounded-lg"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  )
}
