"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Globe } from "lucide-react"
import { workHoursInLocal } from "@/lib/timezone"

interface JobWithHours {
  id: string
  name: string
  timezone?: string | null
  work_hours?: string | null
  clients?: { name: string } | null
}

/** Shows, for active jobs with a timezone, the client's working hours converted to local time (today). */
export function JobHoursToday({ jobs }: { jobs: JobWithHours[] }) {
  const rows = jobs
    .map((j) => ({ job: j, hours: workHoursInLocal(j.work_hours, j.timezone) }))
    .filter((r): r is { job: JobWithHours; hours: NonNullable<ReturnType<typeof workHoursInLocal>> } => r.hours !== null)

  if (rows.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Horário dos clientes hoje</CardTitle>
        <Globe className="w-4 h-4 text-sky-500" />
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(({ job, hours }) => (
          <div key={job.id} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium truncate">{job.name}</p>
              <p className="text-xs text-muted-foreground">
                {job.clients?.name ? `${job.clients.name} · ` : ""}{hours.remoteLabel}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-semibold">{hours.localLabel}</p>
              <p className="text-xs text-muted-foreground">
                {hours.diffHours > 0 ? "+" : ""}{hours.diffHours}h{hours.nextDay ? " · vira o dia" : ""}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
