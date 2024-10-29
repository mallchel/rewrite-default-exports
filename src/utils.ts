import j, {
  type ASTPath,
  type Collection,
  type ExportDefaultDeclaration,
  type ExportNamedDeclaration,
  type ExportSpecifier,
  type JSCodeshift,
} from 'jscodeshift';
import { Type } from 'ast-types/lib/types';
import { reservedWords, visitedFilePaths } from './const';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
// @ts-expect-error
import resolveSyncLib from 'resolve/sync';
import type {
  AnyFunction,
  DefaultImports,
  ExportsNames,
  IterateByPathsArgs,
  LocalDefaultImports,
  LocalImportPathsByName,
  NamedTypesValue,
  ProxyDefaultExports,
  Specifier,
} from './types';

export const debugLog = (...args: any[]) => {
  if (process.env.DEBUG_APP === 'true') {
    console.log(...args);
  }
};

export const getIsAcceptableModule = ({
  filename,
  extensions,
}: {
  filename?: string;
  extensions: string[];
}) => {
  return (
    filename &&
    !/node_modules/.exec(filename) &&
    extensions.includes('.' + filename.split('.').at(-1)!)
  );
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

export const generateNewExportName = ({ filePath }: { filePath: string }) => {
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
    fileName = fileName[0].toLocaleLowerCase() + fileName.slice(1);
  }

  fileName = fileName.replaceAll('-', '');

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

  const passedPath = dirname(resolve(fullPath));
  mkdirSync(passedPath, { recursive: true });

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
  matchNode: (v: unknown) => boolean;
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

export const map =
  <T extends AnyFunction>(f: T) =>
  <S extends AnyFunction>(step: S) =>
  <A, C>(a: A, c: C) => {
    const result = f(a, c);

    return step?.(a, result);
  };
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

const iterateBy = ({
  callbacks,
  collection,
  j,
  declaration,
  predicate,
}: {
  callbacks: Array<(p: ASTPath<ExportNamedDeclaration>) => void>;
  collection: Collection;
  j: JSCodeshift;
  declaration: Type<ExportNamedDeclaration>;
  predicate: (specifier: ExportSpecifier) => boolean;
}) => {
  const targetCollection = collection.find(declaration).filter((p) => {
    return Boolean(p.value.specifiers?.find(predicate));
  });

  targetCollection.forEach((item) => {
    callbacks.forEach((callback) => {
      callback(item);
    });
  });
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
  iterateBy({
    callbacks,
    j,
    collection,
    declaration: j.ExportNamedDeclaration,
    predicate: (specifier) => {
      return getIsExportedDefaultSpecifier(specifier) || getIsImportedDefaultSpecifier(specifier);
    },
  });
};

export const iterateByExportDefaultDeclaration = ({
  callbacks,
  collection,
  j,
}: {
  callbacks: Array<
    | ((
        args: { path: ASTPath<ExportDefaultDeclaration> },
        exportDefaultDeclaration: Collection<ExportDefaultDeclaration>,
      ) => void)
    | undefined
  >;
  collection: Collection;
  j: JSCodeshift;
}) => {
  const exportDefaultDeclaration = collection.find(j.ExportDefaultDeclaration);

  exportDefaultDeclaration.forEach((path) => {
    callbacks.forEach((callback) => {
      callback?.({ path }, exportDefaultDeclaration);
    });
  });
};

export const getFromLocalImportPathsByName = ({
  specifier,
  localImportPathsByName,
  declarationName,
}: {
  specifier?: Specifier;
  localImportPathsByName: LocalImportPathsByName;
  declarationName?: string;
}) => {
  return localImportPathsByName.get(declarationName ?? specifier!.local!.name);
};

const setToLocalImportPathsByName = ({
  specifier,
  importFullPath,
  localImportPathsByName,
}: {
  specifier: Specifier;
  importFullPath: string;
  localImportPathsByName: LocalImportPathsByName;
}) => {
  if (specifier.local) {
    localImportPathsByName.set(
      specifier.local.name === 'default' && j.ExportSpecifier.check(specifier)
        ? specifier.exported.name
        : specifier.local.name,
      importFullPath,
    );
  }
};

export const gatherLocalImportPaths = ({
  localImportPathsByName,
  specifier,
  importFullPath,
}: {
  localImportPathsByName: LocalImportPathsByName;
  specifier: Specifier;
  importFullPath?: string;
}) => {
  if (!importFullPath) {
    return;
  }

  setToLocalImportPathsByName({ specifier, importFullPath, localImportPathsByName });
};

export const gatherDefaultImports = ({
  filePath,
  defaultImports,
  specifier,
  importFullPath,
  j,
  localDefaultImports,
}: {
  filePath: string;
  defaultImports: DefaultImports;
  specifier: Specifier;
  importFullPath: string;
  j: JSCodeshift;
  localDefaultImports: LocalDefaultImports;
}) => {
  if (
    j.ImportDefaultSpecifier.check(specifier) ||
    (j.ExportSpecifier.check(specifier) && specifier.local?.name === 'default')
  ) {
    ensureSetExistence(defaultImports, filePath);
    defaultImports.get(filePath)!.add(importFullPath);
    localDefaultImports.set(specifier.local!.name, specifier);
  }
};

export const gatherDefaultExports = ({
  filePath,
  defaultImports,
  specifier,
  importFullPath,
  j,
}: {
  filePath: string;
  defaultImports: DefaultImports;
  specifier: Specifier;
  importFullPath: string;
  j: JSCodeshift;
}) => {
  if (j.ExportSpecifier.check(specifier) && specifier.exported.name === 'default') {
  }
};

export const getFinalFilePaths = ({
  targetFilePath,
  proxyDefaultExports,
}: {
  targetFilePath: string;
  proxyDefaultExports: ProxyDefaultExports;
}) => {
  const isProxyFile = proxyDefaultExports.has(targetFilePath);
  let resolvedFilePath: string = isProxyFile
    ? proxyDefaultExports.get(targetFilePath)!
    : targetFilePath;

  while (isProxyFile && resolvedFilePath && proxyDefaultExports.has(resolvedFilePath)) {
    resolvedFilePath = proxyDefaultExports.get(resolvedFilePath)!;
  }

  return resolvedFilePath;
};

export const convertFromJsonToMapSet = (arr: Array<[string, string[]]>) => {
  return new Map(arr.map((item) => [item[0], new Set(item[1])]));
};

export const makeIterateBySourcesNSpecifiers = compose(
  map(({ path, filePath, _extensions }) => {
    // source might be undefined for the ExportNamedDeclaration
    // ex: export { Test };
    if (!path.value.source) {
      return {
        importFullPath: undefined,
      };
    }

    // take importFullPath
    const valueSource = path.value.source;

    const importFullPath = getFullPathFromRelative({
      relativePath: valueSource.value as string,
      currentFilePath: filePath,
      extensions: _extensions,
    });

    return {
      importFullPath,
    };
  }),
  filter(({ _extensions }, { importFullPath }) => {
    return getIsAcceptableModule({ filename: importFullPath, extensions: _extensions });
  }),
  tap(({ iterateByPaths, path }) => {
    iterateByPaths?.forEach((iterateBySource: IterateByPathsArgs) => {
      iterateBySource({ path });
    });
  }),
  map(({ path }, { importFullPath }) => {
    return { specifiers: path.value.specifiers, importFullPath };
  }),
  tap(
    (
      {
        path,
        filePath,
        iterateBySpecifiers,
        j,
        defaultImports,
        localImportPathsByName,
        exportsNames,
        proxyDefaultExports,
        localDefaultImports,
      },
      { specifiers, importFullPath },
    ) => {
      if (!iterateBySpecifiers) {
        return;
      }

      specifiers.forEach((specifier: Specifier) => {
        iterateBySpecifiers?.forEach(
          (
            iterateBySpecifier: (args: {
              filePath: string;
              defaultImports: DefaultImports;
              localDefaultImports: LocalDefaultImports;
              localImportPathsByName: LocalImportPathsByName;
              specifier: Specifier;
              importFullPath: string;
              j: JSCodeshift;
              exportsNames: ExportsNames;
              path: ASTPath<unknown>;
              proxyDefaultExports: ProxyDefaultExports;
            }) => void,
          ) => {
            iterateBySpecifier({
              j,
              filePath,
              defaultImports,
              localImportPathsByName,
              specifier,
              importFullPath,
              exportsNames,
              path,
              proxyDefaultExports,
              localDefaultImports,
            });
          },
        );
      });
    },
  ),
);

export const getIsVisitedPath = (filePath: string) => {
  return visitedFilePaths.has(filePath);
};
