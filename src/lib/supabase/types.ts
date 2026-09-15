export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ─── Table Row Types ──────────────────────────────────────────────────────────

type ClientRow = {
  id: string; user_id: string; name: string; company: string | null; email: string | null;
  phone: string | null; notes: string | null; score: number | null; created_at: string; updated_at: string;
  legal_name: string | null; cnpj: string | null; state_registration: string | null; address: string | null;
  billing_entity: string | null; billing_address: string | null; nf_rules: string | null
}
type ClientInsert = {
  user_id: string; name: string; company?: string | null; email?: string | null;
  phone?: string | null; notes?: string | null; score?: number | null;
  legal_name?: string | null; cnpj?: string | null; state_registration?: string | null; address?: string | null;
  billing_entity?: string | null; billing_address?: string | null; nf_rules?: string | null
}

type ClientContactRow = { id: string; client_id: string; name: string; role: string | null; email: string | null; phone: string | null; cc_invoices: boolean; created_at: string }
type ClientContactInsert = { client_id: string; name: string; role?: string | null; email?: string | null; phone?: string | null; cc_invoices?: boolean }

type JobRow = {
  id: string; user_id: string; client_id: string; name: string; description: string | null;
  hourly_rate: number; daily_rate: number; currency: 'BRL' | 'USD' | 'EUR';
  status: 'proposal' | 'active' | 'paused' | 'completed'; contract_value: number | null;
  start_date: string | null; end_date: string | null; is_recurring: boolean;
  tax_rate: number; notes: string | null; billing_mode: 'hourly' | 'daily' | 'fixed'; project_code: string | null;
  timezone: string | null; work_hours: string | null; is_confidential: boolean;
  end_client: string | null; intermediary: string | null; nf_description: string | null; po_number: string | null; thumbnail_url: string | null;
  created_at: string; updated_at: string
}
type JobInsert = {
  user_id: string; client_id: string; name: string; description?: string | null;
  hourly_rate: number; daily_rate: number; currency: 'BRL' | 'USD' | 'EUR';
  status: 'proposal' | 'active' | 'paused' | 'completed'; contract_value?: number | null;
  start_date?: string | null; end_date?: string | null; is_recurring: boolean;
  tax_rate: number; notes?: string | null; billing_mode?: 'hourly' | 'daily' | 'fixed'; project_code?: string | null;
  timezone?: string | null; work_hours?: string | null; is_confidential?: boolean;
  end_client?: string | null; intermediary?: string | null; nf_description?: string | null; po_number?: string | null; thumbnail_url?: string | null
}

type DailyLogRow = {
  id: string; user_id: string; job_id: string; date: string; meetings: string | null;
  requests: string | null; daily_rate: number; hours_worked: number; hours_billed: number;
  total_value: number; created_at: string; updated_at: string
}
type DailyLogInsert = {
  user_id: string; job_id: string; date: string; meetings?: string | null;
  requests?: string | null; daily_rate: number; hours_worked: number;
  hours_billed: number; total_value: number
}

type InvoiceRow = {
  id: string; user_id: string; job_id: string; invoice_number: string;
  period_start: string; period_end: string; total_hours_billed: number;
  subtotal: number; tax_rate: number; tax_amount: number; total: number;
  currency: 'BRL' | 'USD' | 'EUR'; status: 'draft' | 'sent' | 'paid' | 'overdue';
  sent_at: string | null; paid_at: string | null; due_date: string | null;
  notes: string | null; client_confirmed_at: string | null; created_at: string; updated_at: string;
  seq_number: string | null; po_number: string | null;
  nf_status: 'not_required' | 'pending' | 'requested' | 'issued' | 'sent';
  nf_series: 'paulinia' | 'sao_paulo' | null; nf_number: string | null; nf_issued_at: string | null;
  nf_amount_brl: number | null; nf_requested_at: string | null; nf_sent_at: string | null
}
type InvoiceInsert = {
  user_id: string; job_id: string; invoice_number: string; period_start: string;
  period_end: string; total_hours_billed: number; subtotal: number; tax_rate: number;
  tax_amount: number; total: number; currency: 'BRL' | 'USD' | 'EUR';
  status: 'draft' | 'sent' | 'paid' | 'overdue'; sent_at?: string | null;
  paid_at?: string | null; due_date?: string | null; notes?: string | null;
  client_confirmed_at?: string | null;
  seq_number?: string | null; po_number?: string | null;
  nf_status?: 'not_required' | 'pending' | 'requested' | 'issued' | 'sent';
  nf_series?: 'paulinia' | 'sao_paulo' | null; nf_number?: string | null; nf_issued_at?: string | null;
  nf_amount_brl?: number | null; nf_requested_at?: string | null; nf_sent_at?: string | null
}

type InvoiceItemRow = { id: string; invoice_id: string; log_id: string | null; date: string; description: string | null; hours_billed: number; rate: number; subtotal: number; quantity: number | null; unit: 'hour' | 'day' | 'project' | null; job_number: string | null; is_manual: boolean }
type InvoiceItemInsert = { invoice_id: string; log_id?: string | null; date: string; description?: string | null; hours_billed: number; rate: number; subtotal: number; quantity?: number | null; unit?: 'hour' | 'day' | 'project' | null; job_number?: string | null; is_manual?: boolean }

type AgendaEventRow = {
  id: string; user_id: string; job_id: string | null; title: string;
  description: string | null; type: 'payment' | 'delivery' | 'meeting' | 'milestone' | 'deadline';
  event_date: string; is_done: boolean;
  task_status: 'working_on_it' | 'done' | 'stuck' | 'todo';
  priority: 'low' | 'medium' | 'high' | null; budget: number | null;
  start_date: string | null; files_count: number;
  recurrence: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  recurrence_end: string | null;
  created_at: string; updated_at: string
}
type AgendaEventInsert = {
  user_id: string; job_id?: string | null; title: string; description?: string | null;
  type: 'payment' | 'delivery' | 'meeting' | 'milestone' | 'deadline'; event_date: string;
  is_done?: boolean; task_status?: 'working_on_it' | 'done' | 'stuck' | 'todo';
  priority?: 'low' | 'medium' | 'high' | null; budget?: number | null;
  start_date?: string | null; recurrence?: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  recurrence_end?: string | null
}

type UserAvailabilityRow = {
  id: string; user_id: string;
  status: 'disponivel' | 'parcialmente' | 'ocupado' | 'indisponivel';
  available_from: string | null; hours_per_week: number | null;
  working_days: string[]; message: string | null;
  accepting_projects: boolean; updated_at: string
}
type UserAvailabilityInsert = {
  user_id: string; status?: 'disponivel' | 'parcialmente' | 'ocupado' | 'indisponivel';
  available_from?: string | null; hours_per_week?: number | null;
  working_days?: string[]; message?: string | null; accepting_projects?: boolean
}

type ProjectRow = {
  id: string; user_id: string; client_id: string | null; name: string;
  description: string | null; status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  color: string; start_date: string | null; end_date: string | null;
  created_at: string; updated_at: string
}
type ProjectInsert = {
  user_id: string; client_id?: string | null; name: string; description?: string | null;
  status?: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  color?: string; start_date?: string | null; end_date?: string | null
}

type ProjectTaskRow = {
  id: string; project_id: string; user_id: string; title: string;
  description: string | null; status: 'todo' | 'in_progress' | 'done' | 'blocked';
  progress: number; start_date: string | null; end_date: string | null;
  position: number; created_at: string; updated_at: string
}
type ProjectTaskInsert = {
  project_id: string; user_id: string; title: string; description?: string | null;
  status?: 'todo' | 'in_progress' | 'done' | 'blocked'; progress?: number;
  start_date?: string | null; end_date?: string | null; position?: number
}

type ProjectTaskItemRow = {
  id: string; task_id: string; text: string; is_done: boolean;
  position: number; created_at: string
}
type ProjectTaskItemInsert = {
  task_id: string; text: string; is_done?: boolean; position?: number
}

type UserSettingsRow = {
  user_id: string; company_name: string | null; cnpj_cpf: string | null;
  logo_url: string | null; invoice_color: string; hour_rounding: string;
  bank_beneficiary: string | null; bank_name: string | null; bank_account_type: string | null;
  bank_account_number: string | null; bank_routing: string | null; bank_swift: string | null;
  bank_iban: string | null; bank_address: string | null; pix_key: string | null;
  legal_name: string | null; municipal_registration: string | null; fiscal_address: string | null;
  accountant_name: string | null; accountant_email: string | null; next_invoice_seq: number;
  intermediary_bank_name: string | null; intermediary_bank_swift: string | null; intermediary_bank_aba: string | null;
  intermediary_bank_account: string | null; intermediary_bank_address: string | null;
  br_bank_name: string | null; br_bank_agency: string | null; br_bank_account: string | null;
  fx_bank_name: string | null; fx_bank_agency: string | null; fx_bank_account: string | null;
  fx_bank_swift: string | null;
  created_at: string; updated_at: string
}
type UserSettingsInsert = {
  user_id: string; company_name?: string | null; cnpj_cpf?: string | null;
  logo_url?: string | null; invoice_color?: string; hour_rounding?: string;
  bank_beneficiary?: string | null; bank_name?: string | null; bank_account_type?: string | null;
  bank_account_number?: string | null; bank_routing?: string | null; bank_swift?: string | null;
  bank_iban?: string | null; bank_address?: string | null; pix_key?: string | null;
  legal_name?: string | null; municipal_registration?: string | null; fiscal_address?: string | null;
  accountant_name?: string | null; accountant_email?: string | null; next_invoice_seq?: number;
  intermediary_bank_name?: string | null; intermediary_bank_swift?: string | null; intermediary_bank_aba?: string | null;
  intermediary_bank_account?: string | null; intermediary_bank_address?: string | null;
  br_bank_name?: string | null; br_bank_agency?: string | null; br_bank_account?: string | null;
  fx_bank_name?: string | null; fx_bank_agency?: string | null; fx_bank_account?: string | null;
  fx_bank_swift?: string | null
}

type ExpenseRow = {
  id: string; user_id: string;
  category: 'software' | 'hardware' | 'curso' | 'imposto' | 'servico' | 'outro';
  description: string; amount: number; date: string; notes: string | null;
  created_at: string; updated_at: string
}
type ExpenseInsert = {
  user_id: string; category: 'software' | 'hardware' | 'curso' | 'imposto' | 'servico' | 'outro';
  description: string; amount: number; date: string; notes?: string | null
}

type InvoicePaymentRow = {
  id: string; invoice_id: string; user_id: string; amount: number;
  paid_at: string; method: 'pix' | 'ted' | 'cartao' | 'boleto' | 'wire' | 'outro' | null;
  notes: string | null; exchange_rate: number | null; amount_received_brl: number | null; fees: number | null;
  created_at: string
}
type InvoicePaymentInsert = {
  invoice_id: string; user_id: string; amount: number; paid_at: string;
  method?: 'pix' | 'ted' | 'cartao' | 'boleto' | 'wire' | 'outro' | null; notes?: string | null;
  exchange_rate?: number | null; amount_received_brl?: number | null; fees?: number | null
}

type UserGoalRow = {
  id: string; user_id: string; type: 'hours_month' | 'revenue_month';
  target: number; period: string; created_at: string
}
type UserGoalInsert = {
  user_id: string; type: 'hours_month' | 'revenue_month'; target: number; period: string
}

type ProjectTemplateRow = {
  id: string; user_id: string; name: string; tasks: Json; created_at: string
}
type ProjectTemplateInsert = {
  user_id: string; name: string; tasks?: Json
}

type TimeOffRow = {
  id: string; user_id: string; date: string;
  type: 'ferias' | 'feriado' | 'folga' | 'doenca' | 'outro';
  note: string | null; created_at: string
}
type TimeOffInsert = {
  user_id: string; date: string;
  type: 'ferias' | 'feriado' | 'folga' | 'doenca' | 'outro'; note?: string | null
}

type AutomationSettingsRow = {
  user_id: string; billing_reminder_enabled: boolean; billing_reminder_days: number;
  weekly_summary_enabled: boolean; weekly_summary_day: number;
  recurring_invoice_enabled: boolean; recurring_invoice_job_id: string | null;
  recurring_invoice_day: number; recurring_invoice_frequency: 'monthly' | 'weekly';
  recurring_invoice_weekday: number; recurring_invoice_week_start: number; recurring_invoice_due_days: number;
  updated_at: string
}
type AutomationSettingsInsert = {
  user_id: string; billing_reminder_enabled?: boolean; billing_reminder_days?: number;
  weekly_summary_enabled?: boolean; weekly_summary_day?: number;
  recurring_invoice_enabled?: boolean; recurring_invoice_job_id?: string | null;
  recurring_invoice_day?: number; recurring_invoice_frequency?: 'monthly' | 'weekly';
  recurring_invoice_weekday?: number; recurring_invoice_week_start?: number; recurring_invoice_due_days?: number
}

type AvailabilityHoldRow = {
  id: string; user_id: string; client_id: string | null; job_id: string | null;
  type: '1st_hold' | '2nd_hold' | 'booked'; start_date: string; end_date: string;
  note: string | null; created_at: string
}
type AvailabilityHoldInsert = {
  user_id: string; client_id?: string | null; job_id?: string | null;
  type?: '1st_hold' | '2nd_hold' | 'booked'; start_date: string; end_date: string; note?: string | null
}

type AutomationLogRow = {
  id: string; user_id: string; type: string; payload: Json | null;
  status: string; error_msg: string | null; created_at: string
}
type AutomationLogInsert = {
  user_id: string; type: string; payload?: Json | null;
  status?: string; error_msg?: string | null
}

type SalesPipelineRow = {
  id: string; user_id: string; client_id: string | null;
  stage: 'lead' | 'contacted' | 'proposal' | 'negotiation' | 'won' | 'lost';
  title: string; value: number | null; expected_close: string | null;
  notes: string | null; position: number; created_at: string; updated_at: string
}
type SalesPipelineInsert = {
  user_id: string; client_id?: string | null;
  stage?: 'lead' | 'contacted' | 'proposal' | 'negotiation' | 'won' | 'lost';
  title: string; value?: number | null; expected_close?: string | null;
  notes?: string | null; position?: number
}

type ClientInteractionRow = {
  id: string; user_id: string; client_id: string;
  type: 'email' | 'call' | 'meeting' | 'note' | 'proposal';
  summary: string; happened_at: string; created_at: string
}
type ClientInteractionInsert = {
  user_id: string; client_id: string;
  type: 'email' | 'call' | 'meeting' | 'note' | 'proposal';
  summary: string; happened_at?: string
}

type ClientPortalTokenRow = {
  id: string; user_id: string; client_id: string; token: string; created_at: string
}
type ClientPortalTokenInsert = {
  user_id: string; client_id: string; token?: string
}

type ApiKeyRow = {
  id: string; user_id: string; name: string; key_hash: string;
  key_prefix: string; is_active: boolean; last_used: string | null; created_at: string
}
type ApiKeyInsert = {
  user_id: string; name: string; key_hash: string; key_prefix: string;
  is_active?: boolean; last_used?: string | null
}

type WebhookRow = {
  id: string; user_id: string; name: string; url: string;
  events: string[]; secret: string; is_active: boolean;
  last_fired: string | null; created_at: string
}
type WebhookInsert = {
  user_id: string; name: string; url: string; events?: string[];
  secret?: string; is_active?: boolean; last_fired?: string | null
}

type PaymentLinkRow = {
  id: string; user_id: string; invoice_id: string;
  provider: 'stripe' | 'mercadopago'; link_url: string;
  status: 'pending' | 'paid' | 'expired'; created_at: string
}
type PaymentLinkInsert = {
  user_id: string; invoice_id: string; provider: 'stripe' | 'mercadopago';
  link_url: string; status?: 'pending' | 'paid' | 'expired'
}

type WebhookDeliveryRow = {
  id: string; webhook_id: string; event: string; payload: Json;
  status_code: number | null; response: string | null; fired_at: string
}
type WebhookDeliveryInsert = {
  webhook_id: string; event: string; payload: Json;
  status_code?: number | null; response?: string | null
}

type NfRequestRow = {
  id: string; user_id: string; invoice_id: string; sent_to: string; reply_to: string | null;
  subject: string; body: string; resend_id: string | null; status: 'sent' | 'failed'; error: string | null; created_at: string
}
type NfRequestInsert = {
  user_id: string; invoice_id: string; sent_to: string; reply_to?: string | null; subject: string; body: string;
  resend_id?: string | null; status?: 'sent' | 'failed'; error?: string | null
}

type JobDocumentRow = {
  id: string; user_id: string; job_id: string;
  kind: 'contract' | 'invoice' | 'accountant_email' | 'nf' | 'das_issued' | 'das_paid' | 'payment_proof';
  path: string; file_name: string; mime_type: string | null; size_bytes: number | null; uploaded_at: string
}
type JobDocumentInsert = {
  user_id: string; job_id: string;
  kind: 'contract' | 'invoice' | 'accountant_email' | 'nf' | 'das_issued' | 'das_paid' | 'payment_proof';
  path: string; file_name: string; mime_type?: string | null; size_bytes?: number | null
}

type AccountingDocumentRow = {
  id: string; user_id: string; competencia: string; scope: 'month' | 'year';
  kind: 'das_guide' | 'das_payment' | 'fee_receipt' | 'fee_payment' | 'tfe' | 'dasn_guide' | 'dasn_payment' | 'statement';
  path: string; file_name: string; mime_type: string | null; size_bytes: number | null;
  amount: number | null; uploaded_at: string
}
type AccountingDocumentInsert = {
  user_id: string; competencia: string; scope?: 'month' | 'year';
  kind: 'das_guide' | 'das_payment' | 'fee_receipt' | 'fee_payment' | 'tfe' | 'dasn_guide' | 'dasn_payment' | 'statement';
  path: string; file_name: string; mime_type?: string | null; size_bytes?: number | null;
  amount?: number | null
}

// ─── Database Type Map ────────────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      clients:              { Row: ClientRow;              Insert: ClientInsert;              Update: Partial<ClientInsert>;              Relationships: [] }
      client_contacts:      { Row: ClientContactRow;      Insert: ClientContactInsert;      Update: Partial<ClientContactInsert>;      Relationships: [] }
      jobs:                 { Row: JobRow;                 Insert: JobInsert;                 Update: Partial<JobInsert>;                 Relationships: [] }
      daily_logs:           { Row: DailyLogRow;           Insert: DailyLogInsert;           Update: Partial<DailyLogInsert>;           Relationships: [] }
      invoices:             { Row: InvoiceRow;            Insert: InvoiceInsert;            Update: Partial<InvoiceInsert>;            Relationships: [] }
      invoice_items:        { Row: InvoiceItemRow;        Insert: InvoiceItemInsert;        Update: Partial<InvoiceItemInsert>;        Relationships: [] }
      agenda_events:        { Row: AgendaEventRow;        Insert: AgendaEventInsert;        Update: Partial<AgendaEventInsert>;        Relationships: [] }
      invoice_sequences:    { Row: { id: string; user_id: string; year: number; last_seq: number }; Insert: { user_id: string; year: number; last_seq?: number }; Update: { last_seq?: number }; Relationships: [] }
      user_availability:    { Row: UserAvailabilityRow;   Insert: UserAvailabilityInsert;   Update: Partial<UserAvailabilityInsert>;   Relationships: [] }
      projects:             { Row: ProjectRow;            Insert: ProjectInsert;            Update: Partial<ProjectInsert>;            Relationships: [] }
      project_tasks:        { Row: ProjectTaskRow;        Insert: ProjectTaskInsert;        Update: Partial<ProjectTaskInsert>;        Relationships: [] }
      project_task_items:   { Row: ProjectTaskItemRow;    Insert: ProjectTaskItemInsert;    Update: Partial<ProjectTaskItemInsert>;    Relationships: [] }
      user_settings:        { Row: UserSettingsRow;       Insert: UserSettingsInsert;       Update: Partial<UserSettingsInsert>;       Relationships: [] }
      expenses:             { Row: ExpenseRow;            Insert: ExpenseInsert;            Update: Partial<ExpenseInsert>;            Relationships: [] }
      invoice_payments:     { Row: InvoicePaymentRow;     Insert: InvoicePaymentInsert;     Update: Partial<InvoicePaymentInsert>;     Relationships: [] }
      user_goals:           { Row: UserGoalRow;           Insert: UserGoalInsert;           Update: Partial<UserGoalInsert>;           Relationships: [] }
      project_templates:    { Row: ProjectTemplateRow;    Insert: ProjectTemplateInsert;    Update: Partial<ProjectTemplateInsert>;    Relationships: [] }
      time_off:             { Row: TimeOffRow;            Insert: TimeOffInsert;            Update: Partial<TimeOffInsert>;            Relationships: [] }
      automation_settings:  { Row: AutomationSettingsRow; Insert: AutomationSettingsInsert; Update: Partial<AutomationSettingsInsert>; Relationships: [] }
      availability_holds:   { Row: AvailabilityHoldRow; Insert: AvailabilityHoldInsert; Update: Partial<AvailabilityHoldInsert>; Relationships: [] }
      automation_log:       { Row: AutomationLogRow;      Insert: AutomationLogInsert;      Update: Partial<AutomationLogInsert>;      Relationships: [] }
      sales_pipeline:       { Row: SalesPipelineRow;      Insert: SalesPipelineInsert;      Update: Partial<SalesPipelineInsert>;      Relationships: [] }
      client_interactions:  { Row: ClientInteractionRow;  Insert: ClientInteractionInsert;  Update: Partial<ClientInteractionInsert>;  Relationships: [] }
      client_portal_tokens: { Row: ClientPortalTokenRow;  Insert: ClientPortalTokenInsert;  Update: Partial<ClientPortalTokenInsert>;  Relationships: [] }
      api_keys:             { Row: ApiKeyRow;             Insert: ApiKeyInsert;             Update: Partial<ApiKeyInsert>;             Relationships: [] }
      webhooks:             { Row: WebhookRow;            Insert: WebhookInsert;            Update: Partial<WebhookInsert>;            Relationships: [] }
      payment_links:        { Row: PaymentLinkRow;        Insert: PaymentLinkInsert;        Update: Partial<PaymentLinkInsert>;        Relationships: [] }
      webhook_deliveries:   { Row: WebhookDeliveryRow;    Insert: WebhookDeliveryInsert;    Update: Partial<WebhookDeliveryInsert>;    Relationships: [] }
      nf_requests:          { Row: NfRequestRow;          Insert: NfRequestInsert;          Update: Partial<NfRequestInsert>;          Relationships: [] }
      job_documents:        { Row: JobDocumentRow;        Insert: JobDocumentInsert;        Update: Partial<JobDocumentInsert>;        Relationships: [] }
      accounting_documents: { Row: AccountingDocumentRow; Insert: AccountingDocumentInsert; Update: Partial<AccountingDocumentInsert>; Relationships: [] }
    }
    Views: Record<string, never>
    Functions: {
      get_next_invoice_number: {
        Args: { p_user_id: string; p_year: number }
        Returns: string
      }
      get_next_invoice_seq: {
        Args: { p_user_id: string }
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// ─── Convenience Aliases ──────────────────────────────────────────────────────

export type Client = Database['public']['Tables']['clients']['Row']
export type ClientContact = Database['public']['Tables']['client_contacts']['Row']
export type Job = Database['public']['Tables']['jobs']['Row']
export type DailyLog = Database['public']['Tables']['daily_logs']['Row']
export type Invoice = Database['public']['Tables']['invoices']['Row']
export type InvoiceItem = Database['public']['Tables']['invoice_items']['Row']
export type AgendaEvent = Database['public']['Tables']['agenda_events']['Row']
export type UserAvailability = Database['public']['Tables']['user_availability']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectTask = Database['public']['Tables']['project_tasks']['Row']
export type ProjectTaskItem = Database['public']['Tables']['project_task_items']['Row']
export type UserSettings = Database['public']['Tables']['user_settings']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row']
export type InvoicePayment = Database['public']['Tables']['invoice_payments']['Row']
export type UserGoal = Database['public']['Tables']['user_goals']['Row']
export type ProjectTemplate = Database['public']['Tables']['project_templates']['Row']
export type TimeOff = Database['public']['Tables']['time_off']['Row']
export type AvailabilityHold = Database['public']['Tables']['availability_holds']['Row']
export type AutomationSettings = Database['public']['Tables']['automation_settings']['Row']
export type AutomationLog = Database['public']['Tables']['automation_log']['Row']
export type SalesPipeline = Database['public']['Tables']['sales_pipeline']['Row']
export type ClientInteraction = Database['public']['Tables']['client_interactions']['Row']
export type ClientPortalToken = Database['public']['Tables']['client_portal_tokens']['Row']
export type ApiKey = Database['public']['Tables']['api_keys']['Row']
export type Webhook = Database['public']['Tables']['webhooks']['Row']
export type PaymentLink = Database['public']['Tables']['payment_links']['Row']
export type WebhookDelivery = Database['public']['Tables']['webhook_deliveries']['Row']
export type NfRequest = Database['public']['Tables']['nf_requests']['Row']
export type JobDocument = Database['public']['Tables']['job_documents']['Row']
export type AccountingDocument = Database['public']['Tables']['accounting_documents']['Row']

// ─── Composite Types (matching actual query shapes) ───────────────────────────

export type JobWithClient = Job & { clients: Client }
export type DailyLogWithJob = DailyLog & { jobs: JobWithClient }
export type InvoiceWithJob = Invoice & { jobs: JobWithClient }
export type AgendaEventWithJob = AgendaEvent & { jobs: Job | null }
export type ProjectWithClient = Project & { clients: Client | null }
export type ProjectWithTasks = Project & { clients: Client | null; project_tasks: ProjectTask[] }
export type ProjectTaskWithItems = ProjectTask & { project_task_items: ProjectTaskItem[] }
