let uid = 0;

export function uniqueId (prefix = 'droplet'): string {
  return `${prefix}-${++uid}`;
}

// Composed and bubbling; returns false when a cancelable event was prevented
export function emit (
  element: Element,
  type: string,
  detail: unknown = null,
  options: CustomEventInit = {},
): boolean {
  const event = new CustomEvent(type, {
    bubbles:  true,
    composed: true,
    detail,
    ...options,
  });

  return element.dispatchEvent(event);
}

// Idempotent: an unchanged value writes nothing
export function reflectAttribute (element: Element, name: string, value: unknown): void {
  const next = String(value);

  if (element.getAttribute(name) !== next) {
    element.setAttribute(name, next);
  }
}

export function numberAttribute (element: Element, name: string, fallback = 0): number {
  const raw = element.getAttribute(name);

  if (raw === null || raw.trim() === '') {
    return fallback;
  }

  const value = Number(raw);

  return Number.isFinite(value) ? value : fallback;
}

export function escapeHTML (text: unknown): string {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function isRTL (element: Element): boolean {
  return getComputedStyle(element).direction === 'rtl';
}
