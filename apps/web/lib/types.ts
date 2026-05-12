export type LoadTicket = {
  id: string
  load_id: string
  company_id: string
  ticket_number: string | null
  tonnage: number | null
  image_url: string | null
  created_at: string
}

export type Load = {
  id: string
  company_id: string
  job_name: string
  material: string | null
  load_type: string | null
  origin: string | null
  destination: string | null
  rate: number
  rate_type: string | null
  driver_name: string
  truck_number: string | null
  date: string
  hours_worked: string | null
  time_in: string | null
  time_out: string | null
  status: "pending" | "approved" | "disputed" | "invoiced" | "paid"
  notes: string | null
  image_url: string | null
  client_company: string | null
  dispatch_id: string | null
  driver_paid: boolean | null
  driver_paid_date: string | null
  driver_payment_id: string | null
  submitted_by_driver: boolean | null
  source: 'office' | 'driver' | null
  modification_reason: string | null
  original_hours: string | null
  original_loads: number | null
  driver_start_time: string | null
  driver_end_time: string | null
  created_at: string
  load_tickets?: LoadTicket[]
  // Rate breakdown columns
  total_pay?: number | null
  rate_quantity?: number | null
  // AI import columns
  generated_by_ai?: boolean | null
  source_document_url?: string | null
  ai_confidence?: number | null
  shift?: string | null
  phase?: string | null
  broker_name?: string | null
  project_number?: string | null
  billing_direction?: 'paid_to_us' | 'billed_to_us' | null
}

export type Driver = {
  id: string
  company_id: string
  name: string
  email: string | null
  phone: string | null
  status: "active" | "inactive"
  auth_user_id?: string | null
  created_at: string
  pay_type: string | null
  pay_rate_value: number | null
  pay_percent: number | null
  worker_type: string | null
  cdl_number: string | null
  cdl_class: string | null
  cdl_state: string | null
  cdl_expiry: string | null
  medical_card_expiry: string | null
  mvr_last_reviewed: string | null
  drug_test_date: string | null
  drug_test_result: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relation: string | null
  primary_truck: string | null
  last_active_at: string | null
  ytd_paid: number | null
  lifetime_paid: number | null
}

export type DriverNotification = {
  id: string
  driver_id: string
  company_id: string
  load_id: string | null
  type: 'approval' | 'modification' | 'rejection'
  message: string
  read: boolean
  created_at: string
}

export type Invoice = {
  id: string
  company_id: string
  invoice_number: string
  invoice_type: 'client' | 'paystub' | 'contractor' | null
  client_name: string
  client_address: string | null
  client_phone: string | null
  client_email: string | null
  total: number
  tax_rate: number | null
  status: "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "overpaid"
  due_date: string | null
  date_paid: string | null
  date_from: string | null
  date_to: string | null
  payment_method: string | null
  payment_terms: string | null
  notes: string | null
  last_reminder_sent_at: string | null
  reminder_count: number
  amount_paid: number | null
  amount_remaining: number | null
  overpaid_amount: number | null
  payment_notes: string | null
  created_at: string
}

export type TicketImport = {
  id: string
  company_id: string
  document_url: string | null
  document_type: string | null
  document_name: string | null
  status: 'pending' | 'processing' | 'review' | 'completed' | 'failed'
  total_rows: number
  imported_rows: number
  skipped_rows: number
  raw_extraction: Record<string, unknown> | null
  created_at: string
  completed_at: string | null
}

export type Payment = {
  id: string
  company_id: string
  invoice_id: string
  amount: number
  payment_date: string
  payment_method: string | null
  notes: string | null
  payment_type: string | null
  created_at: string
}

export type Job = {
  id: string
  company_id: string
  job_name: string
  contractor: string | null
  location: string | null
  material: string | null
  rate: number | null
  rate_type: string | null
  status: 'active' | 'completed' | 'on_hold'
  start_date: string | null
  end_date: string | null
  notes: string | null
  driver_cost: number | null
  fuel_cost: number | null
  other_costs: number | null
  share_token: string | null
  is_shared: boolean | null
  share_expires_at: string | null
  created_at: string
}

export type ReceivedDispatch = {
  id: string
  company_id: string
  sender_company_id: string | null
  sender_company_name: string | null
  sender_contact_name: string | null
  sender_phone: string | null
  sender_email: string | null
  job_name: string
  job_location: string | null
  material: string | null
  trucks_needed: number | null
  rate: number | null
  rate_type: string | null
  start_date: string | null
  end_date: string | null
  shift: string | null
  notes: string | null
  share_token: string
  status: 'pending' | 'accepted' | 'declined' | 'converted' | 'expired'
  responded_at: string | null
  response_notes: string | null
  converted_job_id: string | null
  converted_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface JobProfitMetrics {
  jobId: string
  jobName: string
  totalRevenue: number
  totalCosts: number
  profit: number
  profitMargin: number
  loadsCount: number
  profitPerLoad: number
}

export interface DriverProfitability {
  driverId: string
  driverName: string
  totalRevenue: number
  estimatedCost: number
  profit: number
  profitMargin: number
  loadsCount: number
  profitPerLoad: number
  isTopPerformer: boolean
  isBelowAverage: boolean
}

export interface ProfitAlert {
  id: string
  type: 'losing_money' | 'low_margin' | 'driver_underperforming' | 'cost_spike'
  title: string
  description: string
  dollarImpact: number
  entityId: string
  entityType: 'job' | 'driver'
  severity: 'warning' | 'critical'
}

export interface CompanyProfitSummary {
  totalRevenue: number
  totalCosts: number
  netProfit: number
  profitMargin: number
  weekRevenue: number
  weekCosts: number
  weekProfit: number
}

export type InvoiceLineItem = {
  id: string
  invoice_id: string
  line_date: string | null
  truck_number: string | null
  driver_name: string | null
  material: string | null
  ticket_number: string | null
  time_worked: string | null
  quantity: number | null
  rate: number | null
  rate_type: string | null
  amount: number
  deduction_pct: number | null
  sort_order: number
  // local-only: populated from load data, stripped before DB insert
  photo_url?: string | null
}

export type ClientCompany = {
  id: string
  company_id: string
  name: string
  address: string | null
  email: string | null
  phone: string | null
  portal_token: string | null
  created_at: string
}

export type Contractor = {
  id: string
  company_id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  status: 'active' | 'inactive'
  notes: string | null
  created_at: string
  coi_expiry: string | null
  coi_url: string | null
  w9_on_file: boolean | null
  w9_url: string | null
  contract_url: string | null
  license_url: string | null
  compliance_status: string | null
  day_rate: number | null
  night_rate: number | null
  default_rate_type: string | null
  last_worked_at: string | null
  ytd_paid: number | null
  lifetime_paid: number | null
}

export type ContractorTicketSlip = {
  id: string
  ticket_id: string
  company_id: string
  tonnage: number | null
  image_url: string | null
  created_at: string
}

export type ContractorTicket = {
  id: string
  contractor_id: string
  company_id: string
  job_name: string
  client_company: string | null
  date: string
  hours_worked: string | null
  truck_number: string | null
  ticket_number: string | null
  material: string | null
  rate: number
  rate_type: string | null
  status: 'pending' | 'invoiced' | 'paid'
  notes: string | null
  created_at: string
  payment_status: string | null
  paid_at: string | null
  payment_method: string | null
  payment_reference: string | null
  payment_batch_id: string | null
  contractor_ticket_slips?: ContractorTicketSlip[]
}

export type DispatchStatus = 'dispatched' | 'accepted' | 'working' | 'completed' | 'cancelled' | 'declined'

export type Dispatch = {
  id: string
  company_id: string
  job_id: string | null
  driver_id: string | null
  driver_name: string
  truck_number: string | null
  dispatch_date: string
  start_time: string | null
  status: DispatchStatus
  loads_completed: number
  instructions: string | null
  notes: string | null
  accepted_at: string | null
  first_ticket_at: string | null
  completed_at: string | null
  subcontractor_id: string | null
  dispatch_type: 'driver' | 'subcontractor' | null
  last_followup_sent_at: string | null
  followup_count: number
  created_at: string
  updated_at: string
}

export type Expense = {
  id: string
  company_id: string
  description: string
  amount: number
  category: string
  date: string
  created_at: string
}

export type ReceivedInvoice = {
  id: string
  company_id: string
  subcontractor_name: string
  their_invoice_number: string | null
  amount: number
  date_received: string | null
  work_start_date: string | null
  work_end_date: string | null
  status: 'pending_review' | 'approved' | 'paid' | 'disputed'
  file_url: string | null
  notes: string | null
  paid_date: string | null
  created_at: string
}

export type DriverPayment = {
  id: string
  company_id: string
  driver_id: string | null
  driver_name: string
  amount: number
  payment_date: string
  payment_method: string
  check_number: string | null
  period_start: string | null
  period_end: string | null
  notes: string | null
  created_at: string
  ticket_count: number | null
  ticket_ids: string[] | null
  payment_reference: string | null
}

export interface DriverScore {
  driverId: string
  driverName: string
  score: number
  loadsToday: number
  profitPerLoad: number
  isWorking: boolean
  isAvailable: boolean
  explanations: string[]
}

export interface DriverRecommendation {
  bestDriver: DriverScore | null
  rankedDrivers: DriverScore[]
  noDriversAvailable: boolean
  fallbackReason?: string
}

export interface RateInsight {
  avgRate: number
  percentDiff: number
  recommendation: string
  isBelowAverage: boolean
  sampleSize: number
}

export interface DispatchOptimizationHint {
  type: 'uneven_load_distribution' | 'idle_driver' | 'overloaded_driver'
  message: string
  affectedDrivers: string[]
  suggestion: string
}
