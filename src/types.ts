import type { types } from 'recast';

export type DefaultImports = Map<string, Set<string>>;
export type ExportsNames = Map<string, string>;
export type PreservedDefaultExports = Set<string>;
export type ProxyExports = Map<string, string>;

export type DefaultImportsArr = Array<[string, string[]]>;
export type ExportsNamesArr = Array<[string, string]>;
export type PreservedDefaultExportsArr = string[];
export type ProxyExportsArr = Array<[string, string]>;

export type NamedTypesValue = (typeof types.namedTypes)[keyof typeof types.namedTypes];

export type LocalImportPathsByName = Map<string, string>;

export type AnyFunction = (...args: any[]) => any;
