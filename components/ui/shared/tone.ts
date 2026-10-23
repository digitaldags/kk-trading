/**
 * Category tone, picked by the category's position:
 * 0 = secondary container, 1 = tertiary container, 2 = surface highest, then repeats.
 */
export type Tone = "secondary" | "tertiary" | "highest";

const TONES: readonly Tone[] = ["secondary", "tertiary", "highest"];

export function toneForIndex(index: number): Tone {
  const i = ((Math.trunc(index) % TONES.length) + TONES.length) % TONES.length;
  return TONES[i] ?? "secondary";
}
