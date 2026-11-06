// `extends HTMLElement` throws in Node; the stand-in is only extended, never constructed
export const HTMLElementBase: typeof HTMLElement = typeof HTMLElement === 'function'
  ? HTMLElement
  : (class {} as unknown as typeof HTMLElement);
