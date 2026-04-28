import { z } from 'zod'

// ── Primitives ─────────────────────────────────────────────────────────────────

const dateStr   = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)')
const moneyAmt  = z.number().min(0).max(9_999_999)
const shortText = (max = 200) => z.string().max(max).optional().nullable()
const colorHex  = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #1e3a2a').optional().nullable()

// Email that also accepts empty string (optional email fields)
const optionalEmail = z
  .string()
  .max(254)
  .refine(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email address')
  .optional()
  .nullable()

// ── Schemas ────────────────────────────────────────────────────────────────────

export const ticketSchema = z.object({
  job_name:          z.string().min(1, 'Job name is required').max(200).transform(s => s.trim()),
  driver_name:       z.string().min(1, 'Driver name is required').max(100).transform(s => s.trim()),
  date:              dateStr,
  rate:              moneyAmt.optional().nullable(),
  rate_type:         z.enum(['load', 'ton', 'hour']).optional().nullable(),
  truck_number:      shortText(50),
  material:          shortText(100),
  notes:             shortText(1000),
  hours_worked:      shortText(20),
  driver_start_time: shortText(10),
  driver_end_time:   shortText(10),
  ticket_number:     shortText(50),
  image_url:         shortText(2048),
  dispatch_id:       z.string().uuid().optional().nullable(),
  source:            z.enum(['office', 'driver']).optional().nullable(),
})

export const driverSchema = z.object({
  name:         z.string().min(1, 'Name is required').max(100).transform(s => s.trim()),
  email:        optionalEmail,
  phone:        shortText(20),
  truck_number: shortText(50),
  status:       z.enum(['active', 'inactive']).default('active'),
})

export const jobSchema = z.object({
  job_name:   z.string().min(1, 'Job name is required').max(200).transform(s => s.trim()),
  contractor: shortText(200),
  location:   shortText(500),
  material:   shortText(100),
  rate:       moneyAmt.optional().nullable(),
  rate_type:  z.enum(['load', 'ton', 'hour']).optional().nullable(),
  status:     z.enum(['active', 'completed', 'on_hold']).default('active'),
  start_date: dateStr.optional().nullable().or(z.literal('')),
  end_date:   dateStr.optional().nullable().or(z.literal('')),
  notes:      shortText(1000),
})

export const dispatchSchema = z.object({
  job_id:           z.string().uuid().optional().nullable(),
  driver_id:        z.string().uuid().optional().nullable(),
  subcontractor_id: z.string().uuid().optional().nullable(),
  truck_number:     shortText(50),
  start_time:       shortText(10),
  instructions:     shortText(1000),
  dispatch_type:    z.enum(['driver', 'subcontractor']).default('driver'),
}).refine(
  d => d.dispatch_type === 'subcontractor' ? !!d.subcontractor_id : !!d.driver_id,
  { message: 'A driver or subcontractor is required' }
)

export const invoiceSchema = z.object({
  invoice_number: z.string().min(1, 'Invoice number is required').max(50),
  invoice_type:   z.enum(['client', 'paystub', 'contractor']).optional().nullable(),
  client_name:    z.string().min(1, 'Client name is required').max(200).transform(s => s.trim()),
  client_address: shortText(500),
  due_date:       dateStr.optional().nullable().or(z.literal('')),
  date_from:      dateStr.optional().nullable().or(z.literal('')),
  date_to:        dateStr.optional().nullable().or(z.literal('')),
  payment_terms:  shortText(200),
  notes:          shortText(2000),
})

export const expenseSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500).transform(s => s.trim()),
  amount:      z.number().positive('Amount must be greater than 0').max(9_999_999),
  category:    z.string().min(1, 'Category is required').max(100),
  date:        dateStr,
})

export const companySchema = z.object({
  name:          z.string().min(1, 'Company name is required').max(200).transform(s => s.trim()),
  address:       shortText(500),
  phone:         shortText(20),
  email:         optionalEmail,
  primary_color: colorHex,
  accent_color:  colorHex,
})

export const fileUploadSchema = z.object({
  size: z.number().max(10 * 1024 * 1024, 'File must be under 10 MB'),
  type: z.string().refine(
    t => ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'].includes(t),
    'Only JPG, PNG, WEBP, HEIC, and PDF files are allowed'
  ),
})

// ── Helper ─────────────────────────────────────────────────────────────────────

export type ValidationResult<T> =
  | { ok: true;  data: T }
  | { ok: false; errors: Record<string, string> }

export function validate<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): ValidationResult<T> {
  const result = schema.safeParse(input)
  if (result.success) return { ok: true, data: result.data }

  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || 'root'
    if (!errors[key]) errors[key] = issue.message
  }
  return { ok: false, errors }
}
