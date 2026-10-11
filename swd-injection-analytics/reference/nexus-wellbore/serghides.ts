/**
 * Serghides (1984) Fanning Friction Factor
 *
 * Three-iteration Colebrook-White approximation matching pyRT _serghides_fanning().
 * Returns Fanning friction factor (Darcy/4).
 */

export function serghidesFanning(re: number, epsD: number): number {
  if (re < 1) return 0.0;
  if (re <= 2100) return 16.0 / re;

  const a = -2.0 * Math.log10(epsD / 3.7 + 12.0 / re);
  const b = -2.0 * Math.log10(epsD / 3.7 + (2.51 * a) / re);
  const c = -2.0 * Math.log10(epsD / 3.7 + (2.51 * b) / re);
  const diff = c - 2.0 * b + a;

  if (Math.abs(diff) < 1e-30) return 1.0 / (a * a) / 4.0;

  const fDarcy = Math.pow(a - ((b - a) * (b - a)) / diff, -2);
  return fDarcy / 4.0;
}
