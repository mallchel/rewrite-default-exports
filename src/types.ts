import type {
  ASTPath,
  ExportSpecifier,
  ImportDefaultSpecifier,
  ImportSpecifier,
  JSCodeshift,
} from 'jscodeshift';
import type { types } from 'recast';

export type DefaultImports = Map<string, Set<string>>;
export type ExportsNames = Map<string, string>;
export type LocalDefaultImports = Map<string, Specifier>;
export type PreservedDefaultExports = Set<string>;
export type ProxyDefaultExports = Map<string, string>;

export type DefaultImportsArr = Array<[string, string[]]>;
export type ExportsNamesArr = Array<[string, string]>;
export type PreservedDefaultExportsArr = string[];
export type ProxyDefaultExportsArr = Array<[string, string]>;

export type NamedTypesValue = (typeof types.namedTypes)[keyof typeof types.namedTypes];

export type LocalImportPathsByName = Map<string, string>;

export type AnyFunction = (...args: any[]) => any;

export type Specifier = ImportSpecifier | ExportSpecifier | ImportDefaultSpecifier;

export type IterateByPathsArgs = (args: { path: {} }) => void;

export type IterateBySpecifierArgs<Specifier, PathDeclaration> = (args: {
  filePath: string;
  defaultImports: DefaultImports;
  localDefaultImports: LocalDefaultImports;
  specifier: Specifier;
  importFullPath: string;
  j: JSCodeshift;
  localImportPathsByName: LocalImportPathsByName;
  proxyDefaultExports: ProxyDefaultExports;
  exportsNames: ExportsNames;
  path: ASTPath<PathDeclaration>;
  _extensions: string[];
}) => void;

export type IterateBySourcesNSpecifiersFn<Specifier, PathDeclaration> = (args: {
  filePath: string;
  iterateByPaths?: Array<IterateByPathsArgs>;
  iterateBySpecifiers?: Array<IterateBySpecifierArgs<Specifier, PathDeclaration>>;
  j: JSCodeshift;
  localImportPathsByName: LocalImportPathsByName;
  path: ASTPath<PathDeclaration>;
  _extensions: string[];
  defaultImports: DefaultImports;
  localDefaultImports: LocalDefaultImports;
  proxyDefaultExports: ProxyDefaultExports;
  exportsNames: ExportsNames;
}) => void;
