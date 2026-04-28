type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogCtx {
  userId?:    string
  companyId?: string
  feature?:   string
}

interface LogEntry extends LogCtx {
  ts:      string
  level:   LogLevel
  action:  string
  details: Record<string, unknown>
  err?:    string
  stack?:  string
}

const isDev = process.env.NODE_ENV !== 'production'

const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',
  info:  '\x1b[36m',
  warn:  '\x1b[33m',
  error: '\x1b[31m',
}

function emit(level: LogLevel, action: string, extra: LogCtx & { details?: Record<string, unknown>; error?: unknown }) {
  const entry: LogEntry = {
    ts:        new Date().toISOString(),
    level,
    action,
    details:   extra.details ?? {},
    userId:    extra.userId,
    companyId: extra.companyId,
    feature:   extra.feature,
  }

  if (extra.error) {
    const e = extra.error
    entry.err   = e instanceof Error ? e.message : String(e)
    entry.stack = e instanceof Error ? e.stack   : undefined
  }

  if (isDev) {
    const color = COLORS[level]
    const reset = '\x1b[0m'
    const ctx   = [entry.userId && `u:${entry.userId}`, entry.companyId && `c:${entry.companyId}`].filter(Boolean).join(' ')
    console[level === 'debug' ? 'log' : level](
      `${color}[${level.toUpperCase()}]${reset} ${action}${ctx ? ` (${ctx})` : ''}`,
      Object.keys(entry.details).length ? entry.details : '',
      entry.err ? `\n  ${entry.err}` : ''
    )
    return
  }

  // Production: one JSON line per log — picked up by Vercel / Railway / Fly.io log drain
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(JSON.stringify(entry))
}

// Base logger (no user context)
export const logger = {
  debug: (action: string, details?: Record<string, unknown>) =>
    emit('debug', action, { details }),
  info:  (action: string, details?: Record<string, unknown>) =>
    emit('info',  action, { details }),
  warn:  (action: string, details?: Record<string, unknown>) =>
    emit('warn',  action, { details }),
  error: (action: string, error?: unknown, details?: Record<string, unknown>) =>
    emit('error', action, { error, details }),

  // Returns a logger pre-bound with user/company/feature context
  withContext: (ctx: LogCtx) => ({
    debug: (action: string, details?: Record<string, unknown>) =>
      emit('debug', action, { ...ctx, details }),
    info:  (action: string, details?: Record<string, unknown>) =>
      emit('info',  action, { ...ctx, details }),
    warn:  (action: string, details?: Record<string, unknown>) =>
      emit('warn',  action, { ...ctx, details }),
    error: (action: string, error?: unknown, details?: Record<string, unknown>) =>
      emit('error', action, { ...ctx, error, details }),
  }),
}
