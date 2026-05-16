"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MonthlyView, type MonthlyViewProps } from "./monthly-view"

export interface DashboardClientProps {
  monthly: MonthlyViewProps
}

export function DashboardClient({ monthly }: DashboardClientProps) {
  return (
    <div className="p-6 space-y-6">
      <Tabs defaultValue="hoje">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <TabsList>
            <TabsTrigger value="hoje">Hoje</TabsTrigger>
            <TabsTrigger value="mensal">Mensal</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="hoje">
          <div className="py-8 text-center text-muted-foreground">
            <p className="text-sm">Visão diária — em construção</p>
          </div>
        </TabsContent>
        <TabsContent value="mensal">
          <MonthlyView {...monthly} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
