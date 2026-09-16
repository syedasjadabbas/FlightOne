/**
 * Tiny classname joiner — no new dependency for something this small.
 * Falsy values (`false`, `undefined`, `null`, `""`) are dropped, everything
 * else is joined with a single space. Cross-cutting (dev guide §1.2): every
 * `components/ui/*` primitive uses this to compose variant/className props.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
