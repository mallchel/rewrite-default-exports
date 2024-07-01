import j, {
  type API,
  type ASTPath,
  type Collection,
  type ExportDefaultDeclaration,
  type ExportNamedDeclaration,
  type Identifier,
  type ImportDeclaration,
  type JSCodeshift,
  type Literal,
} from 'jscodeshift';

import { readFileSync } from 'node:fs';
import {
  debugLog,
  ensureSetExistence,
  generateNamedExport,
  getFullPathFromRelative,
  getIsAcceptableModule,
  getClosest,
  compose,
  filter,
  tap,
  iterateByExportDefaultDeclaration,
  iterateByExportImportDefaultInNamedDeclaration,
  gatherLocalImportsDefaultImports,
} from './utils';
import type { ProxyExports, LocalImportPathsByName, ExportsNames } from './types';

const visitedFilePaths = new Set<string>();

const getIsVDeclarationIdentifier = (p: ASTPath<ExportDefaultDeclaration>) => {
  // in a case of identifier it might be
  // 1. a variable that is imported
  // 2. a variable that is saved in local var
  return j.Identifier.check(p.value.declaration);
};

const getIsNotVDeclarationIdentifier = (p: ASTPath<ExportDefaultDeclaration>) => {
  return !getIsVDeclarationIdentifier(p);
};

const makeAddToProxyIdentifier =
  ({
    localImportPathsByName,
    proxyExports,
    filePath,
  }: {
    localImportPathsByName: LocalImportPathsByName;
    proxyExports: ProxyExports;
    filePath: string;
  }) =>
  (p: ASTPath<ExportDefaultDeclaration & { declaration: Identifier }>) => {
    const localImportPath = localImportPathsByName.get(p.value.declaration.name);

    if (
      // check within imports
      localImportPath
    ) {
      debugLog('The file re-exports the path:', `"${localImportPath}"`);

      proxyExports.set(filePath, localImportPath);

      return;
    }
  };

const makeAddToExportNamesIdentifier =
  ({ exportsNames, filePath }: { exportsNames: ExportsNames; filePath: string }) =>
  (path: ASTPath<ExportDefaultDeclaration & { declaration: Identifier }>) => {
    const declarationName = path.value.declaration.name;
    const topLevelDeclarationNode = getClosest({
      path,
      matchNode: (p) => {
        // TODO: add re-assign search
        const variableDeclaratorNode = j(p).findVariableDeclarators(declarationName).nodes()[0];

        return Boolean(variableDeclaratorNode);
      },
    });

    if (
      // check within top level vars
      topLevelDeclarationNode
    ) {
      const newName =
        topLevelDeclarationNode.declarations[0]?.id?.name ??
        generateNamedExport({
          filePath,
        });
      exportsNames.set(filePath, newName);
    }
  };

const makeAddToExportNamesNonIdentifier =
  ({ filePath, exportsNames }: { filePath: string; exportsNames: ExportsNames }) =>
  (path: ASTPath<ExportDefaultDeclaration>) => {
    // All the other cases tell us that we have the declaration in this file
    // So, we have to use it
    const newName =
      // @ts-expect-error
      path.value.declaration?.id?.name ?? generateNamedExport({ filePath });
    exportsNames.set(filePath, newName);
  };

// Cases:
// 1. export { default } from;
// 2. export { Something as default } from;
// 3. import { Something } from;
//    export { Something as default };
// 4. export { default as Something } from
export const gatherProxyExportsViaNamedExports = ({
  p,
  filePath,
  proxyExports,
  _extensions,
  localImportPathsByName,
}: {
  p: ASTPath<ExportNamedDeclaration>;
  filePath: string;
  proxyExports: ProxyExports;
  _extensions: string[];
  localImportPathsByName: LocalImportPathsByName;
}) => {
  let relativePath = p.value.source?.value;

  if (!relativePath) {
    const specifier = p.value.specifiers?.find(({ local }) => {
      return local?.name && localImportPathsByName.has(local.name);
    });

    if (specifier) {
      const importPath = localImportPathsByName.get(specifier.local!.name);

      proxyExports.set(filePath, importPath!);

      return;
    }

    console.error('You do not have the relativePath for case:', { pValue: p.value });

    return;
  }

  const fullPathFromRelative = getFullPathFromRelative({
    relativePath: relativePath as string,
    currentFilePath: filePath,
    extensions: _extensions,
  });

  proxyExports.set(filePath, fullPathFromRelative);
};

export const makeFnsToIterateByExportDefault = ({
  proxyExports,
  localImportPathsByName,
  filePath,
  exportsNames,
}: {
  proxyExports: ProxyExports;
  localImportPathsByName: LocalImportPathsByName;
  filePath: string;
  exportsNames: ExportsNames;
}) => {
  const makeForIdentifier = compose(
    filter(getIsVDeclarationIdentifier),
    tap(makeAddToProxyIdentifier({ proxyExports, localImportPathsByName, filePath })),
    tap(makeAddToExportNamesIdentifier({ exportsNames, filePath })),
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

const gatherInfo = (
  fileInfo: { path: string; source: string },
  api: API,
  {
    defaultImports,
    preservedDefaultExports,
    _extensions,
    exportsNames,
    proxyExports,
  }: {
    defaultImports: Map<string, Set<string>>;
    exportsNames: Map<string, string>;
    proxyExports: Map<string, string>;
    preservedDefaultExports: Set<string>;
    _extensions: string[];
  },
) => {
  const j = api.jscodeshift;

  if (!getIsAcceptableModule({ filename: fileInfo.path }) || visitedFilePaths.has(fileInfo.path)) {
    return;
  }
  visitedFilePaths.add(fileInfo.path);

  debugLog('gatherInfo start', fileInfo.path);
  const collection = j(fileInfo.source);
  const localImportPathsByName: LocalImportPathsByName = new Map();

  // gather localImportPathsByName, defaultImports
  collection.find(j.ImportDeclaration).forEach((path) => {
    gatherLocalImportsDefaultImports({
      path,
      filePath: fileInfo.path,
      defaultImports,
      _extensions,
      localImportPathsByName,
      j,
    });
  });
  collection.find(j.ExportNamedDeclaration).forEach((path) => {
    gatherLocalImportsDefaultImports({
      path,
      filePath: fileInfo.path,
      defaultImports,
      _extensions,
      localImportPathsByName,
      j,
    });
  });

  // preservedDefaultExports
  // if so, leave default export inside the module because
  // 1. in the project we can have an abstract component that doesn't know the names of exports
  // 2. and all we have to do is try to find the path to that import and mark it as a file where we have to leave default export next to named export
  collection.find(j.ImportExpression).forEach((path) => {
    let pathRoResolve = '';

    switch (true) {
      // "StringLiteral" for babel-parser createImportExpressions option
      // path is already in value
      case path.value.source.type === 'StringLiteral': {
        pathRoResolve = path.value.source.value as string;

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
            const variableDeclarator = j(p).findVariableDeclarators(name).nodes()[0];

            if (variableDeclarator) {
              // TODO: supports ExpressionKind later
              pathRoResolve = (variableDeclarator.init as Literal).value as string;
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

    if (pathRoResolve) {
      const filePath = getFullPathFromRelative({
        relativePath: pathRoResolve,
        currentFilePath: fileInfo.path,
        extensions: _extensions,
      });

      if (filePath) {
        preservedDefaultExports.add(filePath);
      }
    }

    debugLog('preservedDefaultExports', preservedDefaultExports);
  });

  const fnsForProxyExports = makeFnsToIterateByExportDefault({
    exportsNames,
    proxyExports,
    filePath: fileInfo.path,
    localImportPathsByName,
  });

  iterateByExportDefaultDeclaration({
    j,
    collection,
    callbacks: [fnsForProxyExports.makeForIdentifier(), fnsForProxyExports.makeForNonIdentifier()],
  });

  iterateByExportImportDefaultInNamedDeclaration({
    collection,
    j,
    callbacks: [
      (p) => {
        gatherProxyExportsViaNamedExports({
          filePath: fileInfo.path,
          proxyExports,
          _extensions,
          localImportPathsByName,
          p,
        });
      },
    ],
  });

  // iterate all imports to resolve them and gather data
  for (const localImportPath of localImportPathsByName.values()) {
    if (
      !getIsAcceptableModule({ filename: localImportPath }) ||
      visitedFilePaths.has(localImportPath)
    ) {
      continue;
    }

    gatherInfo({ path: localImportPath, source: readFileSync(localImportPath, 'utf-8') }, api, {
      defaultImports,
      preservedDefaultExports,
      proxyExports,
      _extensions,
      exportsNames,
    });
  }

  // Do not transform file at this phase
  return fileInfo.source;
};

export default gatherInfo;
