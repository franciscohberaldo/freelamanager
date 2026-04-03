export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type ClientRow = { id: string; user_id: string; name: string; company: string | null; email: string | null; phone: string | null; notes: string | null; created_at: string; updated_at: string }
type ClientInsert = { user_id: string; name: string; company?: string | null; email?: string | null; phone?: string | null; notes?: string | null }

type ClientContactRow = { id: string; client_id: string; name: string; role: string | null; email: string | null; phone: string | null; created_at: string }
type ClientContactInsert = { client_id: string; name: string; role?: string | null; email?: string | null; phone?: string | null }

type JobRow = { id: string; user_id: string; client_id: string; name: string; description: string | null; hourly_rate: number; daily_rate: number; currency: 'BRL' | 'USD' | 'EUR'; status: 'proposal' | 'active' | 'paused' | 'completed'; contract_value: number | null; start_date: string | null; end_date: string | null; is_recurring: boolean; tax_rate: number; notes: string | null; created_at: string; updated_at: string }
type JobInsert = { user_id: string; client_id: string; name: string; description?: string | null; hourly_rate: number; daily_rate: number; currency: 'BRL' | 'USD' | 'EUR'; status: 'proposal' | 'active' | 'paused' | 'completed'; contract_value?: number | null; start_date?: string | null; end_date?: string | null; is_recurring: boolean; tax_rate: number; notes?: string | null }

type DailyLogRow = { id: string; user_id: string; job_id: string; date: string; meetings: string | null; requests: string | null; daily_rate: number; hours_worked: number; hours_billed: number; total_value: number; created_at: string; updated_at: string }
type DailyLogInsert = { user_id: string; job_id: string; date: string; meetings?: string | null; requests?: string | null; daily_rate: number; hours_worked: number; hours_billed: number; total_value: number }

type InvoiceRow = { id: string; user_id: string; job_id: string; invoice_number: string; period_start: string; period_end: string; total_hours_billed: number; subtotal: number; tax_rate: number; tax_amount: number; total: number; currency: 'BRL' | 'USD' | 'EUR'; status: 'draft' | 'sent' | 'paid' | 'overdue'; sent_at: string | null; paid_at: string | null; due_date: string | null; notes: string | null; created_at: string; updated_at: string }
type InvoiceInsert = { user_id: string; job_id: string; invoice_number: string; period_start: string; period_end: string; total_hours_billed: number; subtotal: number; tax_rate: number; tax_amount: number; total: number; currency: 'BRL' | 'USD' | 'EUR'; status: 'draft' | 'sent' | 'paid' | 'overdue'; sent_at?: string | null; paid_at?: string | null; due_date?: string | null; notes?: string | null }

type InvoiceItemRow = { id: string; invoice_id: string; log_id: string | null; date: string; description: string | null; hours_billed: number; rate: number; subtotal: number }
type InvoiceItemInsert = { invoice_id: string; log_id?: string | null; date: string; description?: string | null; hours_billed: number; rate: number; subtotal: number }

type AgendaEventRow = { id: string; user_id: string; job_id: string | null; title: string; description: string | null; type: 'payment' | 'delivery' | 'meeting' | 'milestone' | 'deadline'; event_date: string; is_done: boolean; created_at: string; updated_at: string }
type AgendaEventInsert = { user_id: string; job_id?: string | null; title: string; description?: string | null; type: 'payment' | 'delivery' | 'meeting' | 'milestone' | 'deadline'; event_date: string; is_done?: boolean }

export type Database = {
  public: {
    Tables: {
      clients:         { Row: ClientRow;        Insert: ClientInsert;        Update: Partial<ClientInsert>;        Relationships: [] }
      client_contacts: { Row: ClientContactRow; Insert: ClientContactInsert; Update: Partial<ClientContactInsert>; Relationships: [] }
      jobs:            { Row: JobRow;           Insert: JobInsert;           Update: Partial<JobInsert>;           Relationships: [] }
      daily_logs:      { Row: DailyLogRow;      Insert: DailyLogInsert;      Update: Partial<DailyLogInsert>;      Relationships: [] }
      invoices:        { Row: InvoiceRow;       Insert: InvoiceInsert;       Update: Partial<InvoiceInsert>;       Relationships: [] }
      invoice_items:   { Row: InvoiceItemRow;   Insert: InvoiceItemInsert;   Update: Partial<InvoiceItemInsert>;   Relationships: [] }
      agenda_events:   { Row: AgendaEventRow;   Insert: AgendaEventInsert;   Update: Partial<AgendaEventInsert>;   Relationships: [] }
      invoice_sequences: {
        Row: { id: string; user_id: string; year: number; last_seq: number }
        Insert: { user_id: string; year: number; last_seq?: number }
        Update: { last_seq?: number }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_next_invoice_number: {
        Args: { p_user_id: string; p_year: number }
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Convenience types
export type Client = Database['public']['Tables']['clients']['Row']
export type ClientContact = Database['public']['Tables']['client_contacts']['Row']
export type Job = Database['public']['Tables']['jobs']['Row']
export type DailyLog = Database['public']['Tables']['daily_logs']['Row']
export type Invoice = Database['public']['Tables']['invoices']['Row']
export type InvoiceItem = Database['public']['Tables']['invoice_items']['Row']
export type AgendaEvent = Database['public']['Tables']['agenda_events']['Row']

export type JobWithClient = Job & { clients: Client }
export type DailyLogWithJob = DailyLog & { jobs: JobWithClient }
export type InvoiceWithJob = Invoice & { jobs: JobWithClient }
export type AgendaEventWithJob = AgendaEvent & { jobs: Job | null }
