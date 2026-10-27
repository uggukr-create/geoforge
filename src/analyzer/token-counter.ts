/**
 * Offline BPE-style token estimator for Claude and GPT tokenizers.
 * English prose averages about 4 chars per token, Cyrillic and other non-Latin
 * scripts about 2 chars per token, punctuation is usually its own token.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let latin = 0, other = 0, punct = 0, digits = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    if (/[A-Za-z]/.test(ch)) latin++;
    else if (/[0-9]/.test(ch)) digits++;
    else if (/[\p{L}]/u.test(ch)) other++;
    else punct++;
  }
  return Math.ceil(latin / 4 + other / 2 + digits / 2.5 + punct * 0.75 + (text.match(/\n/g)?.length ?? 0) * 0.5);
}

export function truncateToTokens(text: string, maxTokens: number): string {
  if (estimateTokens(text) <= maxTokens) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (estimateTokens(text.slice(0, mid)) <= maxTokens) lo = mid; else hi = mid - 1;
  }
  const cut = text.slice(0, lo);
  const nl = cut.lastIndexOf('\n');
  return (nl > lo * 0.6 ? cut.slice(0, nl) : cut).trimEnd();
}
