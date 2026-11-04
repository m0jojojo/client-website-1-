/** Page numbers to show, with null for a gap: 1 … 4 5 6 … 12 */
export function pageWindow(current: number, total: number, siblings = 1): (number | null)[] {
  if (total <= 1) return [1];
  const keep = new Set<number>([1, total]);
  for (let i = current - siblings; i <= current + siblings; i++)
    if (i >= 1 && i <= total) keep.add(i);
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) {
      // Fill a single missing number instead of showing a pointless gap.
      if (n - sorted[i - 1] === 2) out.push(n - 1);
      else out.push(null);
    }
    out.push(n);
  });
  return out;
}
