function countBefore(text: string, offset: number, kept: RegExp): number {
  let count = 0;
  for (let i = 0; i < offset && i < text.length; i++) if (kept.test(text[i]!)) count++;
  return count;
}

function caretOffset(text: string, count: number, kept: RegExp, forward: boolean): number {
  const beforeNext = forward || count === 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (!kept.test(text[i]!)) continue;
    if (beforeNext && seen === count) return i;
    seen++;
    if (!beforeNext && seen === count) return i + 1;
  }
  return text.length;
}

export function reformat(input: HTMLInputElement, text: string, kept: RegExp, forward = false): void {
  if (text === input.value) return;
  const focused = document.activeElement === input;
  const count = countBefore(input.value, input.selectionStart ?? input.value.length, kept);
  input.value = text;
  if (!focused) return;
  const at = caretOffset(text, count, kept, forward);
  input.setSelectionRange(at, at);
}
