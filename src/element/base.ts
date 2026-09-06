// `class X extends HTMLElement` throws in Node, so the base is resolved at
// evaluation time; the stand-in is only ever extended, never constructed.
export const HTMLElementBase: typeof HTMLElement = typeof HTMLElement === 'function'
  ? HTMLElement
  : (class {} as unknown as typeof HTMLElement);
