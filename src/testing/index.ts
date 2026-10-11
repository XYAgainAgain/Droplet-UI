/*
 * Shared helpers for the component tests (and only the tests): mount a
 * fragment into the live document, and wait out animation frames so canvas
 * paints, springs and focus moves settle before asserting.
 *
 * This module is deliberately outside the library: the vite build only
 * follows imports from src/droplet.ts, vitest only collects *.test.ts and the
 * manifest analyzer only reads src/components/** - so nothing here can leak
 * into the bundle, the test run or the docs.
 */

// Mount an HTML fragment into the document; callers remove the host when done
export function mount (html: string): HTMLDivElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

// One animation frame
export const raf = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

// Wait a handful of frames so springs / paints / focus moves settle
export async function settle (frames = 4): Promise<void> {
  for (let i = 0; i < frames; i++) {
    await raf();
  }
}
