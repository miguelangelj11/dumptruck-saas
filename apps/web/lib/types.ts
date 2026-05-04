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
  status: "draft" | "sent" | "partially_paid" | "paid" | "overdue"
  due_date: string | null
  date_paid: string | null
  date_from: string | null
  date_to: string | null
  payment_terms: string | null
  notes: string | null
  created_at: string
}

export type Payment = {
  id: string
  company_id: string
  invoice_id: string
  amount: number
  payment_date: string
  payment_method: string | null
  notes: string | null
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
  created_at: string
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
  material: string | null
  rate: number
  rate_type: string | null
  status: 'pending' | 'invoiced' | 'paid'
  notes: string | null
  created_at: string
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
}
