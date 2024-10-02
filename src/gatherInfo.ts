import j, {
  type API,
  type ASTNode,
  type ASTPath,
  type ExportDefaultDeclaration,
  type ExportNamedDeclaration,
  type ExportSpecifier,
  type Identifier,
  type ImportDeclaration,
  type Literal,
} from 'jscodeshift';

import { readFileSync } from 'node:fs';
import {
  debugLog,
  generateNewExportName,
  getFullPathFromRelative,
  getIsAcceptableModule,
  getClosest,
  compose,
  filter,
  tap,
  iterateByExportDefaultDeclaration,
  gatherLocalImportPaths,
  gatherDefaultImports,
  makeIterateBySourcesNSpecifiers,
  getIsExportedDefaultSpecifier,
  getIsVisitedPath,
  getFromLocalImportPathsByName,
} from './utils';
import type {
  ProxyDefaultExports,
  LocalImportPathsByName,
  ExportsNames,
  DefaultImports,
  PreservedDefaultExports,
  Specifier,
  IterateBySourcesNSpecifiersFn,
  IterateByPathsArgs,
  LocalDefaultImports,
} from './types';
import { visitedFilePaths } from './const';

const getIsVDeclarationIdentifier = ({ path }: { path: ASTPath<ExportDefaultDeclaration> }) => {
  // in a case of identifier it might be
  // 1. a variable that is imported
  // 2. a variable that is saved in local var
  return j.Identifier.check(path.value.declaration);
};

const getIsNotVDeclarationIdentifier = ({ path }: { path: ASTPath<ExportDefaultDeclaration> }) => {
  return !getIsVDeclarationIdentifier({ path });
};

const makeAddToProxyIdentifier =
  ({
    localImportPathsByName,
    proxyDefaultExports,
    filePath,
    localDefaultImports,
  }: {
    localImportPathsByName: LocalImportPathsByName;
    proxyDefaultExports: ProxyDefaultExports;
    filePath: string;
    localDefaultImports: LocalDefaultImports;
  }) =>
  ({ path }: { path: ASTPath<ExportDefaultDeclaration & { declaration: Identifier }> }) => {
    if (
      // check within imports
      localDefaultImports.has(path.value.declaration.name)
    ) {
      const localImportPath = getFromLocalImportPathsByName({
        localImportPathsByName,
        declarationName: path.value.declaration.name,
      });

      if (!localImportPath) {
        console.error('localImportPath is not defined', path.value);

        return;
      }

      // we must to save only:
      // 1. import Something from './Test'
      //  export { Something as default } from './Test' OR export default Something
      // 2. export Something from './Test'
      debugLog('The file re-exports the path:', `"${localImportPath}"`);

      proxyDefaultExports.set(filePath, localImportPath);

      return;
    }
  };

const makeAddToExportNamesIdentifier =
  ({
    exportsNames,
    filePath,
    localDefaultImports,
  }: {
    exportsNames: ExportsNames;
    filePath: string;
    localDefaultImports: LocalDefaultImports;
  }) =>
  ({ path }: { path: ASTPath<ExportDefaultDeclaration & { declaration: Identifier }> }) => {
    const declarationName = path.value.declaration.name;

    if (declarationName && !localDefaultImports.has(declarationName)) {
      exportsNames.set(filePath, declarationName);
    }

    return;
  };

// find e.g.
// export default 123;
const makeAddToExportNamesNonIdentifier =
  ({ filePath, exportsNames }: { filePath: string; exportsNames: ExportsNames }) =>
  ({ path }: { path: ASTPath<ExportDefaultDeclaration> }) => {
    // All the other cases tell us that we have the declaration in this file
    // So, we have to use it
    const newName =
      // @ts-expect-error
      path.value.declaration?.id?.name ?? generateNewExportName({ filePath });
    exportsNames.set(filePath, newName);
  };

export const gatherProxyExportsViaNamedExports = ({
  path,
  filePath,
  proxyDefaultExports,
  _extensions,
  localImportPathsByName,
}: {
  path: ASTPath<ExportNamedDeclaration>;
  filePath: string;
  proxyDefaultExports: ProxyDefaultExports;
  _extensions: string[];
  localImportPathsByName: LocalImportPathsByName;
}) => {
  let relativePath = path.value.source?.value;

  // this logic needs for cases like:
  // `import Something from ...`,
  // 'export { Something as default };',
  // to find the path from the specifier
  if (!relativePath) {
    const specifier = path.value.specifiers?.find(({ local }) => {
      return local?.name && localImportPathsByName.has(local.name);
    });

    if (specifier) {
      const importPath = getFromLocalImportPathsByName({
        localImportPathsByName,
        specifier,
      });

      proxyDefaultExports.set(filePath, importPath!);

      return;
    }

    console.error('You do not have the relativePath for case:', { pValue: path.value });

    return;
  }

  const fullPathFromRelative = getFullPathFromRelative({
    relativePath: relativePath as string,
    currentFilePath: filePath,
    extensions: _extensions,
  });

  proxyDefaultExports.set(filePath, fullPathFromRelative);
};

// save to exportsNames
// save to proxyDefaultExports
export const makeGatherExportsAndProxyByExportDefaultDeclaration = ({
  proxyDefaultExports,
  localImportPathsByName,
  filePath,
  exportsNames,
  localDefaultImports,
}: {
  proxyDefaultExports: ProxyDefaultExports;
  localImportPathsByName: LocalImportPathsByName;
  filePath: string;
  exportsNames: ExportsNames;
  localDefaultImports: LocalDefaultImports;
}) => {
  const makeForIdentifier = compose(
    filter(getIsVDeclarationIdentifier),
    tap(
      makeAddToProxyIdentifier({
        proxyDefaultExports,
        localImportPathsByName,
        filePath,
        localDefaultImports,
      }),
    ),
    tap(makeAddToExportNamesIdentifier({ exportsNames, filePath, localDefaultImports })),
  );
  const makeForNonIdentifier = compose(
    filter(getIsNotVDeclarationIdentifier),
    tap(makeAddToExportNamesNonIdentifier({ exportsNames, filePath })),
  );

  return {
    makeForIdentifier,
    makeForNonIdentifier,
  };
};

export const gatherExportsAndProxyByExportNamedDeclaration = ({
  path,
  specifier,
  filePath,
  exportsNames,
  proxyDefaultExports,
  _extensions,
  localDefaultImports,
  localImportPathsByName,
}: {
  proxyDefaultExports: ProxyDefaultExports;
  path: ASTPath<ExportNamedDeclaration>;
  filePath: string;
  exportsNames: ExportsNames;
  specifier: ExportSpecifier;
  _extensions: string[];
  localDefaultImports: LocalDefaultImports;
  localImportPathsByName: LocalImportPathsByName;
}) => {
  if (!specifier.local?.name) {
    debugLog('specifier.local.name is not defined', specifier);

    return;
  }

  // for proxy - don't save exportsNames and vice versa
  if (
    getIsExportedDefaultSpecifier(specifier) &&
    // check local name for "export { default }"
    // !getIsImportedDefaultSpecifier(specifier) &&
    // check local name for "import Something from ...""
    !localDefaultImports.has(specifier.local.name)
  ) {
    exportsNames.set(filePath, specifier.local.name);
  }

  if (
    getIsExportedDefaultSpecifier(specifier) &&
    // getIsImportedDefaultSpecifier(specifier)
    localDefaultImports.has(specifier.local.name)
  ) {
    gatherProxyExportsViaNamedExports({
      path,
      filePath,
      proxyDefaultExports,
      _extensions,
      localImportPathsByName,
    });
  }
};

// Cases:
// proxyDefaultExports
// 1. export { default } from;
// 2. import Something from;
//    export { Something as default };

// exportDefaultViaNamedExport
// 1. export { Something as default } from;
// 2. import { Something } from;
//    export { Something as default };

// importDefaultViaNamedExport
// 1. export { default as Something } from
const gatherInfo = (
  fileInfo: { path: string; source: string },
  api: API,
  {
    defaultImports,
    preservedDefaultExports,
    _extensions,
    exportsNames,
    proxyDefaultExports,
  }: {
    defaultImports: DefaultImports;
    exportsNames: ExportsNames;
    proxyDefaultExports: ProxyDefaultExports;
    preservedDefaultExports: PreservedDefaultExports;
    _extensions: string[];
  },
) => {
  const j = api.jscodeshift;

  if (
    !getIsAcceptableModule({ filename: fileInfo.path, extensions: _extensions }) ||
    getIsVisitedPath(fileInfo.path)
  ) {
    return;
  }
  visitedFilePaths.add(fileInfo.path);

  debugLog('gatherInfo start', fileInfo.path);
  const collection = j(fileInfo.source);
  const localImportPathsByName: LocalImportPathsByName = new Map();
  const localDefaultImports: LocalDefaultImports = new Map();

  const iterateBySourcesNSpecifiers = makeIterateBySourcesNSpecifiers();

  collection.find(j.ImportDeclaration).forEach((path) => {
    (iterateBySourcesNSpecifiers as IterateBySourcesNSpecifiersFn<Specifier, ImportDeclaration>)?.({
      path,
      filePath: fileInfo.path,
      defaultImports,
      localImportPathsByName,
      j,
      iterateBySpecifiers: [gatherLocalImportPaths, gatherDefaultImports],
      _extensions,
      proxyDefaultExports,
      exportsNames,
      localDefaultImports,
    });
  });

  collection.find(j.ExportNamedDeclaration).forEach((path) => {
    (
      iterateBySourcesNSpecifiers as IterateBySourcesNSpecifiersFn<
        ExportSpecifier,
        ExportNamedDeclaration
      >
    )?.({
      path,
      filePath: fileInfo.path,
      defaultImports,
      localImportPathsByName,
      j,
      proxyDefaultExports,
      exportsNames,
      iterateBySpecifiers: [
        gatherLocalImportPaths,
        gatherDefaultImports,
        gatherExportsAndProxyByExportNamedDeclaration,
      ],
      _extensions,
      localDefaultImports,
    });
  });

  // preservedDefaultExports
  // if so, leave default export inside the module because
  // 1. in the project we can have an abstract component that doesn't know the names of exports
  // 2. and all we have to do is try to find the path to that import and mark it as a file where we have to leave default export next to named export
  collection.find(j.ImportExpression).forEach((path) => {
    let pathToResolve = '';

    switch (true) {
      // "StringLiteral" for babel-parser createImportExpressions option
      // path is already in value
      case path.value.source.type === 'StringLiteral' || path.value.source.type === 'Literal': {
        pathToResolve = path.value.source.value as string;

        break;
      }

      // path stored in variable
      // find closest VariableDeclarator with the given name
      // OR find the closest re-assign of the variable
      // if the value of the variable is not found, don't do anything
      case path.value.source.type === 'Identifier': {
        const { name } = path.value.source;

        getClosest({
          path,
          matchNode: (p) => {
            // TODO: supports AssignmentExpression later
            const variableDeclarator = j(p as ASTNode)
              .findVariableDeclarators(name)
              .nodes()[0];

            if (variableDeclarator) {
              // TODO: supports ExpressionKind later
              pathToResolve = (variableDeclarator.init as Literal).value as string;
            }

            return Boolean(variableDeclarator);
          },
        });

        break;
      }

      default: {
        break;
      }
    }

    if (pathToResolve) {
      const filePath = getFullPathFromRelative({
        relativePath: pathToResolve,
        currentFilePath: fileInfo.path,
        extensions: _extensions,
      });

      if (filePath) {
        preservedDefaultExports.add(filePath);
        // we have not local import name for importExpression
        // but we have to save it to localImportPathsByName to iterate it by later
        localImportPathsByName.set(filePath, filePath);
      }
    }

    debugLog('preservedDefaultExports', preservedDefaultExports);
  });

  const gatherExportsAndProxyByExportDefaultDeclaration =
    makeGatherExportsAndProxyByExportDefaultDeclaration({
      exportsNames,
      proxyDefaultExports,
      filePath: fileInfo.path,
      localImportPathsByName,
      localDefaultImports,
    });
  const gatherExportsAndProxyByExportDefaultDeclarationForIdentifier =
    gatherExportsAndProxyByExportDefaultDeclaration.makeForIdentifier<IterateByPathsArgs>();
  const gatherExportsAndProxyByExportDefaultDeclarationForNonIdentifier =
    gatherExportsAndProxyByExportDefaultDeclaration.makeForNonIdentifier<IterateByPathsArgs>();

  iterateByExportDefaultDeclaration({
    j,
    collection,
    callbacks: [
      gatherExportsAndProxyByExportDefaultDeclarationForIdentifier,
      gatherExportsAndProxyByExportDefaultDeclarationForNonIdentifier,
    ],
  });

  // iterate all imports to resolve them and gather data
  for (const localImportPath of localImportPathsByName.values()) {
    if (
      !getIsAcceptableModule({ filename: localImportPath, extensions: _extensions }) ||
      getIsVisitedPath(localImportPath)
    ) {
      continue;
    }

    gatherInfo({ path: localImportPath, source: readFileSync(localImportPath, 'utf-8') }, api, {
      defaultImports,
      preservedDefaultExports,
      proxyDefaultExports,
      _extensions,
      exportsNames,
    });
  }

  // Do not transform file at this phase
  return fileInfo.source;
};

export default gatherInfo;
