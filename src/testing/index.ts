// Test-only: no entry imports it, vitest collects only *.test.ts, and cem reads only src/components

// Callers remove the returned host when done
export function mount (html: string): HTMLDivElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

export const raf = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

export async function settle (frames = 4): Promise<void> {
  for (let i = 0; i < frames; i++) {
    await raf();
  }
}
