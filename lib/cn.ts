/** Join class names, dropping anything falsy.
 *
 * Deliberately not `clsx`: the only thing this codebase does with class names
 * is concatenate a few conditional strings, and that is nine lines rather than
 * a dependency. If a component ever needs conflict resolution (two competing
 * `px-*` utilities where the later must win), reach for `tailwind-merge` at
 * that point rather than growing this.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
