let cached: string | null = null

export async function getCompanyId(): Promise<string | null> {
  if (cached) return cached

  const res = await fetch('/api/me/company-id')
  if (!res.ok) return null

  const { companyId } = await res.json()
  if (companyId) {
    cached = companyId
    return cached
  }

  return null
}

export function clearCompanyIdCache() {
  cached = null
}
