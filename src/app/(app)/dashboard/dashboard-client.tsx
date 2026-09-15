"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MonthlyView, type MonthlyViewProps } from "./monthly-view"
import { DailyView, type DailyViewProps } from "./daily-view"

export interface DashboardClientProps {
  monthly: MonthlyViewProps
  daily: DailyViewProps
}

export function DashboardClient({ monthly, daily }: DashboardClientProps) {
  return (
    <div className="p-6 space-y-6">
      <Tabs defaultValue="hoje">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-light tracking-tight">Dashboard</h1>
          <TabsList>
            <TabsTrigger value="hoje">Hoje</TabsTrigger>
            <TabsTrigger value="mensal">Mensal</TabsTrigger>
          </TabsList>
        </div>

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
