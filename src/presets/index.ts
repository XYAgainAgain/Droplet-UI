// Presets are records people fork, not code they patch: every one of them,
// built-in included, comes through registerPreset and is stored as a deep copy.

import { SAFETY_BOUNDS, isConfigKey } from '../resolve/bounds.js';

export type PresetAxis = 'feel' | 'material' | 'palette' | 'substance';

export interface RegisterOptions {
  document?: Document;
  override?: boolean;
}

export class PresetError extends Error {
  constructor (message: string) {
    super(message);
    this.name = 'PresetError';
  }
}

type AxisRegistry = Map<PresetAxis, Map<string, object>>;

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

const BUILT_INS: Readonly<Record<PresetAxis, ReadonlySet<string>>> = Object.freeze({
  feel: new Set<string>(['gel']),
  material: new Set<string>(),
  palette: new Set<string>(),
  substance: new Set<string>(),
});

// An omitted document means the module-level registry in browsers and Node alike,
// so registration never reads globalThis.document and stays import-pure.
const documentRegistries = new WeakMap<Document, AxisRegistry>();
const moduleRegistry: AxisRegistry = new Map();

function axisMap (registry: AxisRegistry, axis: PresetAxis): Map<string, object> {
  let byName = registry.get(axis);
  if (!byName) {
    byName = new Map<string, object>();
    registry.set(axis, byName);
  }
  return byName;
}

function scopeFor (doc: Document | undefined, create: boolean): AxisRegistry | null {
  if (!doc) return moduleRegistry;
  const existing = documentRegistries.get(doc);
  if (existing) return existing;
  if (!create) return null;
  const created: AxisRegistry = new Map();
  documentRegistries.set(doc, created);
  return created;
}

const ARRAY_INDEX = /^(0|[1-9][0-9]*)$/;

// Enumerable data properties only: a getter, a hidden property, a symbol key, or
// an array hole all change shape under JSON.parse(JSON.stringify(record)).
function assertJsonSafe (value: unknown, path: string, seen: Set<object>): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new PresetError(`preset value at ${path} must be a finite number`);
    return;
  }
  if (typeof value !== 'object') throw new PresetError(`preset value at ${path} is not JSON-safe`);

  const object = value as object;
  if (seen.has(object)) throw new PresetError(`preset record is cyclic at ${path}`);
  seen.add(object);

  const isArray = Array.isArray(object);
  if (!isArray) {
    // Chain depth, not identity: a record built in another document carries that
    // realm's Object.prototype, and rejecting it would be a nasty surprise.
    const prototype = Object.getPrototypeOf(object) as object | null;
    if (prototype !== null && Object.getPrototypeOf(prototype) !== null) {
      throw new PresetError(`preset value at ${path} must be a plain object`);
    }
  }

  if (Object.getOwnPropertySymbols(object).length > 0) {
    throw new PresetError(`preset value at ${path} must not carry symbol-keyed properties`);
  }

  for (const key of Object.getOwnPropertyNames(object)) {
    if (isArray && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(object, key)!;
    if (!descriptor.enumerable) {
      throw new PresetError(`preset value at ${path} must not carry the non-enumerable property "${key}"`);
    }
    if (!('value' in descriptor)) {
      throw new PresetError(`preset value at ${path} must not carry the accessor property "${key}"`);
    }
    if (isArray && !ARRAY_INDEX.test(key)) {
      throw new PresetError(`preset array at ${path} must not carry the non-index property "${key}"`);
    }
    assertJsonSafe(descriptor.value, isArray ? `${path}[${key}]` : `${path}.${key}`, seen);
  }

  if (isArray) {
    const list = object as unknown[];
    for (let index = 0; index < list.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(list, index)) {
        throw new PresetError(`preset array at ${path} must not be sparse (hole at ${index})`);
      }
    }
  }

  seen.delete(object);
}

// Phases 5 and 6 give material, palette, and substance their schemas; until then
// any JSON-safe record is accepted on those axes.
function validateFeel (record: object): void {
  for (const [key, value] of Object.entries(record)) {
    if (!isConfigKey(key)) throw new PresetError(`feel preset key "${key}" is not a physics config key`);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new PresetError(`feel preset key "${key}" must be a finite number`);
    }
    const bound = SAFETY_BOUNDS[key];
    if (bound && (value < bound[0] || value > bound[1])) {
      throw new PresetError(`feel preset key "${key}" must be within ${bound[0]}–${bound[1]}`);
    }
  }
}

export function registerPreset (axis: PresetAxis, name: string, record: object, options: RegisterOptions = {}): void {
  if (!NAME_PATTERN.test(name)) throw new PresetError(`preset name "${name}" must match /^[a-z][a-z0-9-]*$/`);
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new PresetError(`preset "${name}" must be a plain object`);
  }
  assertJsonSafe(record, name, new Set<object>());
  if (axis === 'feel') validateFeel(record);

  const target = scopeFor(options.document, true)!;
  const byName = axisMap(target, axis);
  const taken = byName.has(name) || BUILT_INS[axis].has(name);
  if (taken && options.override !== true) {
    throw new PresetError(`preset "${name}" is already registered on axis "${axis}"; pass { override: true } to replace it`);
  }

  byName.set(name, structuredCopy(record));
}

export function getPreset<T extends object = object> (axis: PresetAxis, name: string, doc?: Document): Readonly<T> | null {
  const scoped = scopeFor(doc, false)?.get(axis)?.get(name);
  const record = scoped ?? moduleRegistry.get(axis)?.get(name);
  if (!record) return null;
  return deepFreeze(structuredCopy(record)) as Readonly<T>;
}

export function listPresets (axis: PresetAxis, doc?: Document): string[] {
  const names = new Set<string>(moduleRegistry.get(axis)?.keys());
  for (const name of scopeFor(doc, false)?.get(axis)?.keys() ?? []) names.add(name);
  return [...names].sort();
}

function structuredCopy (record: object): object {
  return JSON.parse(JSON.stringify(record)) as object;
}

function deepFreeze (value: object): object {
  for (const entry of Object.values(value)) {
    if (entry !== null && typeof entry === 'object') deepFreeze(entry as object);
  }
  return Object.freeze(value);
}
