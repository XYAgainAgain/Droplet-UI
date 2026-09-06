// The whole batch is preflighted before anything is defined, so a collision
// never leaves a half-defined library.

import { TAG_PREFIX } from './tags.js';

export { TAG_PREFIX, TAGS } from './tags.js';
export type { TagName } from './tags.js';

export interface Collision {
  tag: string;
  existing: CustomElementConstructor;
  requested: CustomElementConstructor;
}

export interface DefineResult {
  defined: string[];
  alreadyDefined: string[];
  collisions: Collision[];
}

export interface DefineOptions {
  registry?: CustomElementRegistry;
  strict?: boolean;
}

export type DefineEntry = readonly [tag: string, ctor: CustomElementConstructor];

export class RegistrationError extends Error {
  readonly result: DefineResult;

  constructor (result: DefineResult) {
    super(`[${TAG_PREFIX}] ${result.collisions.map((c) => c.tag).join(', ')} already owned by another constructor`);
    this.name = 'RegistrationError';
    this.result = result;
  }
}

// One warning per tag per registry; repeat collisions on the same tag stay silent
const warnedTags = new WeakMap<CustomElementRegistry, Set<string>>();

function warnOnce (registry: CustomElementRegistry, tag: string): void {
  let seen = warnedTags.get(registry);
  if (!seen) {
    seen = new Set<string>();
    warnedTags.set(registry, seen);
  }
  if (seen.has(tag)) return;
  seen.add(tag);
  console.warn(`[${TAG_PREFIX}] ${tag} is already owned by another constructor; skipping`);
}

export function defineElements (entries: ReadonlyArray<DefineEntry>, options: DefineOptions = {}): DefineResult {
  const registry = options.registry ?? globalThis.customElements;
  const result: DefineResult = { defined: [], alreadyDefined: [], collisions: [] };
  if (!registry) return result;

  const pending: DefineEntry[] = [];
  // A tag repeated inside one batch is classified against the earlier pending
  // entry, or registry.define would throw NotSupportedError mid-batch.
  const claimed = new Map<string, CustomElementConstructor>();
  for (const [tag, ctor] of entries) {
    const existing = claimed.get(tag) ?? registry.get(tag);
    if (!existing) {
      claimed.set(tag, ctor);
      pending.push([tag, ctor]);
    } else if (existing === ctor) result.alreadyDefined.push(tag);
    else result.collisions.push({ tag, existing, requested: ctor });
  }

  if (result.collisions.length && options.strict) throw new RegistrationError(result);

  for (const collision of result.collisions) warnOnce(registry, collision.tag);
  for (const [tag, ctor] of pending) {
    registry.define(tag, ctor);
    result.defined.push(tag);
  }
  return result;
}
