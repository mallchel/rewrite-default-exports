// import { ConnectionIdsByFileName } from './types';
import type {
  ASTNode,
  ASTPath,
  Collection,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  ExportSpecifier,
  ImportDeclaration,
  ImportSpecifier,
  JSCodeshift,
} from 'jscodeshift';
import { reservedWords } from './const';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error
import resolveSyncLib from 'resolve/sync';
import type { AnyFunction, DefaultImports, LocalImportPathsByName, NamedTypesValue } from './types';

export const debugLog = (...args: any[]) => {
  if (process.env.DEBUG_APP) {
    console.log(...args);
  }
};

export const getIsAcceptableModule = ({ filename }: { filename?: string }) => {
  return filename ? !/node_modules/.test(filename) : false;
};

export const ensureSetExistence = (map: Map<string, Set<string>>, key: string) => {
  if (!map.has(key)) {
    map.set(key, new Set());
  }
};

export const ensureMapExistence = (map: Map<string, Map<unknown, unknown>>, key: string) => {
  if (!map.has(key)) {
    map.set(key, new Map());
  }
};

export const capitalizeFirstLetter = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const generateNamedExport = ({ filePath }: { filePath: string }) => {
  // jsx,tsx has indirect sign that it exported by default component
  const hasJsx = ['jsx', 'tsx'].includes(filePath.split('.').slice(-1)[0]);
  let fileName =
    // get filename with ext
    filePath
      .split('/')
      .slice(-1)[0]
      // remove ext
      .split('.')[0];

  if (fileName === 'index') {
    fileName = filePath.split('/').slice(-2)[0];
  }

  if (hasJsx) {
    return capitalizeFirstLetter(fileName);
  }

  if (reservedWords.includes(fileName)) {
    fileName += 'Default';
  }

  return fileName;
};

export const writeTo = ({ fileName, data }: { fileName: string; data: unknown }) => {
  const fullPath = resolve('src', fileName);
  debugLog('writeTo', fullPath);

  writeFileSync(
    fullPath,
    JSON.stringify(data, (key, value) => {
      if (value instanceof Map) {
        return [...value.entries()];
      }

      if (value instanceof Set) {
        return [...value.values()];
      }

      return value;
    }),
    {
      flag: 'w',
    },
  );
};

export const readFrom = ({ fileName }: { fileName: string }) => {
  const fullPath = resolve('src', fileName);
  debugLog('readFrom', fullPath);

  return JSON.parse(readFileSync(fullPath, 'utf-8'));
};

export const getFullPathFromRelative = ({
  relativePath,
  currentFilePath,
  extensions,
}: {
  relativePath: string;
  currentFilePath: string;
  extensions: string[];
}): string => {
  try {
    return resolveSyncLib(relativePath, {
      basedir: currentFilePath.split('/').slice(0, -1).join('/'),
      extensions,
      includeCoreModules: false,
      preserveSymlinks: false,
    });
  } catch (e) {
    debugLog(e);

    return '';
  }
};

export const getClosest = ({
  path,
  type,
  matchNode,
}: {
  path: ASTPath;
  type?: NamedTypesValue;
  matchNode: (v: ASTNode) => boolean;
}) => {
  let parent = path.parent;
  let prevPath = path;

  while (parent) {
    if (Array.isArray(parent.value.body)) {
      const prevPathValueIndex = parent.value.body.indexOf(prevPath.value);

      if (prevPathValueIndex >= 0) {
        const targetNode = parent.value.body
          .slice(0, prevPathValueIndex)
          .reverse()
          .find((_node: any) => {
            return matchNode(_node) || type?.check(_node);
          });

        if (targetNode) {
          return targetNode;
        }
      }
    }

    if (type?.check(parent.value) || matchNode(parent.value)) {
      return parent;
    }

    prevPath = parent;
    parent = parent.parent;
  }

  return parent ?? null;
};

export const compose =
  <T extends AnyFunction>(...fns: T[]) =>
  <D>(doSomething?: D) =>
    fns.reduceRight((y, f) => f(y), doSomething);

export const tap =
  <T extends AnyFunction>(f: T) =>
  <S extends AnyFunction>(step: S) =>
  <A, C>(a: A, c: C) => {
    f(a, c);

    return step?.(a, c);
  };
export const filter =
  <T extends AnyFunction>(predicate: T) =>
  <S extends AnyFunction>(step: S) =>
  <A, C>(a: A, c: C) =>
    predicate(a, c) ? step?.(a, c) : a;

export const getIsExportedDefaultSpecifier = ({ exported }: ExportSpecifier) => {
  return exported.name === 'default';
};

export const getIsImportedDefaultSpecifier = ({ local }: ExportSpecifier) => {
  return local?.name === 'default';
};

export const iterateByExportImportDefaultInNamedDeclaration = ({
  callbacks,
  collection,
  j,
}: {
  callbacks: Array<(p: ASTPath<ExportNamedDeclaration>) => void>;
  collection: Collection;
  j: JSCodeshift;
}) => {
  const exportedOrImportedDefaultSpecifier = collection
    .find(j.ExportNamedDeclaration)
    .filter((p) => {
      return Boolean(
        p.value.specifiers?.find((specifier) => {
          return (
            getIsExportedDefaultSpecifier(specifier) || getIsImportedDefaultSpecifier(specifier)
          );
        }),
      );
    });

  exportedOrImportedDefaultSpecifier.forEach((item) => {
    callbacks.forEach((callback) => {
      callback(item);
    });
  });
};

export const iterateByExportDefaultDeclaration = ({
  callbacks,
  collection,
  j,
}: {
  callbacks: Array<
    | ((
        p: ASTPath<ExportDefaultDeclaration>,
        exportDefaultDeclaration: Collection<ExportDefaultDeclaration>,
      ) => void)
    | undefined
  >;
  collection: Collection;
  j: JSCodeshift;
}) => {
  const exportDefaultDeclaration = collection.find(j.ExportDefaultDeclaration);

  exportDefaultDeclaration.forEach((item) => {
    callbacks.forEach((callback) => {
      callback?.(item, exportDefaultDeclaration);
    });
  });
};

export const getImportedSpecifierName = ({
  collection,
  localSpecifierName,
  j,
}: {
  collection: Collection;
  localSpecifierName: string;
  j: JSCodeshift;
}) => {
  const importDeclarations = collection.find(j.ImportDeclaration).nodes();

  let targetSpecifier: ImportSpecifier | undefined;
  importDeclarations.find((importDeclaration) => {
    console.log('! importDeclaration', importDeclaration.source.value);

    const specifier = importDeclaration.specifiers?.find((specifier) => {
      return specifier.local?.name === localSpecifierName;
    }) as ImportSpecifier;

    targetSpecifier = specifier;

    return specifier;
  });

  if (j.ImportDefaultSpecifier.check(targetSpecifier)) {
    throw new Error('You call getImportedSpecifierName for ImportDefaultSpecifier');
  }

  if (!targetSpecifier) {
    console.error('targetSpecifier is undefined');
  }

  return targetSpecifier!.imported.name;
};

export const gatherLocalImportsDefaultImports = ({
  path,
  filePath,
  defaultImports,
  _extensions,
  localImportPathsByName,
  j,
}: {
  path: ASTPath<ImportDeclaration> | ASTPath<ExportNamedDeclaration>;
  filePath: string;
  defaultImports: DefaultImports;
  _extensions: string[];
  localImportPathsByName: LocalImportPathsByName;
  j: JSCodeshift;
}) => {
  // source might be undefined for the ExportNamedDeclaration
  // ex: export { Test };
  if (!path.value.source) {
    return;
  }

  const valueSource = path.value.source;

  path.value.specifiers?.forEach((specifier) => {
    const importFullPath = getFullPathFromRelative({
      relativePath: valueSource.value as string,
      currentFilePath: filePath,
      extensions: _extensions,
    });

    if (!getIsAcceptableModule({ filename: importFullPath })) {
      return;
    }

    if (specifier.local) {
      localImportPathsByName.set(specifier.local.name, importFullPath);
    }

    if (j.ImportDefaultSpecifier.check(specifier)) {
      ensureSetExistence(defaultImports, filePath);
      defaultImports.get(filePath)!.add(importFullPath);
    }
  });
};
