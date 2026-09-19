"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MonthlyView, type MonthlyViewProps } from "./monthly-view"
import { DailyView, type DailyViewProps } from "./daily-view"
import { PageHeader } from "@/components/page-header"

export interface DashboardClientProps {
  monthly: MonthlyViewProps
  daily: DailyViewProps
}

export function DashboardClient({ monthly, daily }: DashboardClientProps) {
  return (
    <div className="px-8 py-6 space-y-6">
      <Tabs defaultValue="hoje">
        <PageHeader
          eyebrow="Visão geral"
          title="Início"
          description="O mês de hoje em números: horas, faturamento e o que vence."
        />
        <TabsList>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="mensal">Mensal</TabsTrigger>
        </TabsList>

        <TabsContent value="hoje">
          <DailyView {...daily} />
        </TabsContent>
        <TabsContent value="mensal">
          <MonthlyView {...monthly} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
