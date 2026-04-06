import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

export default async function PortalPage({ params }: { params: { token: string } }) {
  const supabase = await createClient()

  // Validate token (public read policy allows this)
  const { data: portal } = await supabase
    .from("client_portal_tokens")
    .select("client_id, user_id")
    .eq("token", params.token)
    .single()

  if (!portal) notFound()

  const { client_id, user_id } = portal

  // Fetch all data for this client
  const [{ data: client }, { data: jobs }, { data: invoices }, { data: projects }] = await Promise.all([
    supabase
      .from("clients")
      .select("name, company, email")
      .eq("id", client_id)
      .single(),
    supabase
      .from("jobs")
      .select("id, name, status, start_date, end_date, hourly_rate, currency")
      .eq("client_id", client_id)
      .eq("user_id", user_id),
    supabase
      .from("invoices")
      .select("invoice_number, total, currency, status, period_start, period_end, due_date")
      .eq("user_id", user_id)
      .in("job_id", (await supabase.from("jobs").select("id").eq("client_id", client_id).eq("user_id", user_id)).data?.map(j => j.id) ?? [])
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("name, status, start_date, end_date")
      .eq("user_id", user_id)
      .in("job_id", (await supabase.from("jobs").select("id").eq("client_id", client_id).eq("user_id", user_id)).data?.map(j => j.id) ?? []),
  ])

  if (!client) notFound()

  const INV_STATUS: Record<string, { label: string; class: string }> = {
    draft:   { label: "Rascunho", class: "bg-gray-100 text-gray-600" },
    sent:    { label: "Enviado",  class: "bg-amber-100 text-amber-700" },
    paid:    { label: "Pago",     class: "bg-green-100 text-green-700" },
    overdue: { label: "Vencido",  class: "bg-red-100 text-red-700" },
  }

  const JOB_STATUS: Record<string, string> = {
    proposal: "Proposta", active: "Em andamento", paused: "Pausado", completed: "Finalizado",
  }

  const PROJ_STATUS: Record<string, { label: string; class: string }> = {
    planning:    { label: "Planejamento", class: "bg-gray-100 text-gray-600" },
    in_progress: { label: "Em andamento", class: "bg-blue-100 text-blue-700" },
    review:      { label: "Revisão",      class: "bg-amber-100 text-amber-700" },
    done:        { label: "Concluído",    class: "bg-green-100 text-green-700" },
    on_hold:     { label: "Pausado",      class: "bg-gray-100 text-gray-500" },
  }

  const totalPaid = invoices?.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0) ?? 0
  const totalPending = invoices?.filter(i => i.status === "sent").reduce((s, i) => s + i.total, 0) ?? 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
              {client.company && <p className="text-sm text-gray-500">{client.company}</p>}
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-gray-400">Portal do cliente</p>
              <p className="text-xs text-gray-400">{format(new Date(), "dd/MM/yyyy", { locale: ptBR })}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Financial summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">Total pago</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">Aguardando pagamento</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(totalPending)}</p>
          </div>
        </div>

        {/* Jobs */}
        {jobs && jobs.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Jobs contratados</h2>
            <div className="bg-white rounded-xl border divide-y">
              {jobs.map(job => (
                <div key={job.id} className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{job.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(job.hourly_rate, job.currency)}/h
                      {job.start_date && ` · desde ${format(new Date(job.start_date + "T12:00"), "MMM yyyy", { locale: ptBR })}`}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    job.status === "active" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {JOB_STATUS[job.status] ?? job.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects */}
        {projects && projects.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Projetos</h2>
            <div className="bg-white rounded-xl border divide-y">
              {projects.map((proj, i) => {
                const st = PROJ_STATUS[proj.status] ?? { label: proj.status, class: "bg-gray-100 text-gray-600" }
                return (
                  <div key={i} className="px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{proj.name}</p>
                      {(proj.start_date || proj.end_date) && (
                        <p className="text-sm text-gray-500">
                          {proj.start_date && format(new Date(proj.start_date + "T12:00"), "dd/MM/yyyy")}
                          {proj.end_date && ` → ${format(new Date(proj.end_date + "T12:00"), "dd/MM/yyyy")}`}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${st.class}`}>
                      {st.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Invoices */}
        {invoices && invoices.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Invoices</h2>
            <div className="bg-white rounded-xl border divide-y">
              {invoices.map((inv, i) => {
                const st = INV_STATUS[inv.status] ?? { label: inv.status, class: "bg-gray-100 text-gray-600" }
                return (
                  <div key={i} className="px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">#{inv.invoice_number}</p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(inv.period_start + "T12:00"), "MMM yyyy", { locale: ptBR })}
                        {inv.due_date && ` · vence ${format(new Date(inv.due_date + "T12:00"), "dd/MM")}`}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${st.class}`}>
                        {st.label}
                      </span>
                      <p className="font-semibold text-gray-900">{formatCurrency(inv.total, inv.currency)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">
          Gerado por Freela Manager · acesso exclusivo para {client.name}
        </p>
      </div>
    </div>
  )
}
