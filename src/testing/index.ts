// Test-only helpers. Nothing here can leak into the bundle or docs: the build follows imports
// from the entry points, vitest collects only *.test.ts, and the analyzer reads only src/components.

// Callers remove the returned host when done
export function mount (html: string): HTMLDivElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

export const raf = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

// Waits a few frames so springs, paints, and focus moves settle
export async function settle (frames = 4): Promise<void> {
  for (let i = 0; i < frames; i++) {
    await raf();
  }
}
