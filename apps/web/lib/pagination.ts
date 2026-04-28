export const PAGE_SIZE = 50

export function pageRange(page: number): [number, number] {
  return [page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1]
}
