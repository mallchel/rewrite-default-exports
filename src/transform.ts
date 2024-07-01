import type { API, Collection, Identifier, JSCodeshift } from 'jscodeshift';
import { ExpressionKind } from 'ast-types/gen/kinds';

import {
  debugLog,
  getIsExportedDefaultSpecifier,
  getFullPathFromRelative,
  getImportedSpecifierName,
  iterateByExportImportDefaultInNamedDeclaration,
  iterateByExportDefaultDeclaration,
  getIsImportedDefaultSpecifier,
} from './utils';
import type {
  DefaultImports,
  DefaultImportsArr,
  ExportsNames,
  ExportsNamesArr,
  PreservedDefaultExports,
  ProxyExports,
  ProxyExportsArr,
} from './types';

export const transformExport = ({
  collection,
  j,
  preservedDefaultExports,
  exportsNames,
  filePath,
  proxyExports,
}: {
  collection: Collection;
  j: JSCodeshift;
  exportsNames: ExportsNames;
  proxyExports: ProxyExports;
  preservedDefaultExports: PreservedDefaultExports;
  filePath: string;
}) => {
  if (!proxyExports.has(filePath) && !exportsNames.has(filePath)) {
    return;
  }

  const shouldPreserveExportDefault = preservedDefaultExports.has(filePath);

  /**
   * @note
   * filePath is might me a proxy file here, so resolve the original filePath via proxyExports
   */

  const isProxyFile = proxyExports.has(filePath);
  let resolvedFilePath: string = isProxyFile ? proxyExports.get(filePath)! : filePath;

  while (isProxyFile && resolvedFilePath && proxyExports.has(resolvedFilePath)) {
    resolvedFilePath = proxyExports.get(resolvedFilePath)!;
  }

  let nameInsteadOfDefault = exportsNames.get(resolvedFilePath);
  let shouldUpdateExportDefaultId = Boolean(nameInsteadOfDefault);
  let nameInsteadOfDefaultIdentifier = nameInsteadOfDefault
    ? j.identifier(nameInsteadOfDefault)
    : undefined;
  // When we have no targetFilePath in exportsNames
  // it means our import was "named"
  const shouldUseImportSpecifier = isProxyFile && !nameInsteadOfDefault;

  iterateByExportDefaultDeclaration({
    callbacks: [
      (p, exportDefaultDeclaration) => {
        debugLog('iterateByExportDefaultDeclaration', p.value.declaration.type);

        const getFinalNode = () => {
          // TODO: add test-case
          if (
            j.FunctionDeclaration.check(p.value.declaration) ||
            j.ClassDeclaration.check(p.value.declaration)
          ) {
            return j.exportNamedDeclaration({
              ...p.value.declaration,
              ...(p.value.declaration.id ? undefined : { id: nameInsteadOfDefaultIdentifier }),
            });
          }

          if (j.Identifier.check(p.value.declaration)) {
            if (shouldUseImportSpecifier) {
              const localSpecifierName = (p.value.declaration as Identifier).name;

              nameInsteadOfDefault = getImportedSpecifierName({
                j,
                collection,
                localSpecifierName,
              });

              nameInsteadOfDefaultIdentifier = j.identifier(nameInsteadOfDefault);

              return j.exportNamedDeclaration(null, [
                j.exportSpecifier.from({
                  local: j.identifier(localSpecifierName),
                  exported: nameInsteadOfDefaultIdentifier,
                }),
              ]);
            }

            return j.exportNamedDeclaration(null, [
              j.exportSpecifier.from({
                local: nameInsteadOfDefaultIdentifier,
                exported: nameInsteadOfDefaultIdentifier!,
              }),
            ]);
          }

          const variableDeclaration = j.variableDeclaration('const', [
            j.variableDeclarator(
              nameInsteadOfDefaultIdentifier!,
              p.value.declaration as ExpressionKind,
            ),
          ]);

          return j.exportNamedDeclaration(variableDeclaration);
        };

        const finalNode = getFinalNode();

        if (shouldPreserveExportDefault) {
          if (shouldUpdateExportDefaultId) {
            exportDefaultDeclaration.replaceWith(() => {
              return j.exportDefaultDeclaration(nameInsteadOfDefaultIdentifier!);
            });
          }

          p.insertAfter(finalNode);
        } else {
          exportDefaultDeclaration.replaceWith(() => {
            return finalNode;
          });
        }
      },
    ],
    j,
    collection,
  });

  iterateByExportImportDefaultInNamedDeclaration({
    callbacks: [
      (p) => {
        let localSpecifierName;
        let localSpecifierNameIdentifier: Identifier | undefined = undefined;

        if (!nameInsteadOfDefault) {
          localSpecifierName = p.value.specifiers?.find(getIsExportedDefaultSpecifier)?.local
            ?.name!;

          if (shouldUseImportSpecifier) {
            nameInsteadOfDefault = getImportedSpecifierName({
              j,
              collection,
              localSpecifierName,
            });
          }

          if (!localSpecifierName) {
            throw new Error(`There is no name localSpecifierName, filePath: ${filePath}`);
          }

          localSpecifierNameIdentifier = j.identifier(localSpecifierName);
          nameInsteadOfDefaultIdentifier = j.identifier(nameInsteadOfDefault!);
        }

        let otherSpecifiers = p.value.specifiers ?? [];

        // remove export default
        if (!shouldPreserveExportDefault || shouldUpdateExportDefaultId) {
          otherSpecifiers = otherSpecifiers.filter((specifier) => {
            return (
              !getIsExportedDefaultSpecifier(specifier) && !getIsImportedDefaultSpecifier(specifier)
            );
          });
        }

        // create new export default
        if (shouldPreserveExportDefault && shouldUpdateExportDefaultId) {
          otherSpecifiers.push(
            j.exportSpecifier.from({
              local: localSpecifierNameIdentifier ?? nameInsteadOfDefaultIdentifier,
              exported: j.identifier('default'),
            }),
          );
        }

        otherSpecifiers.push(
          j.exportSpecifier.from({
            /**
             * localSpecifierName might be different from nameInsteadOfDefault
             * in the case:
             * import { Test as Test1 } from '...'
             * export { Test1 as Test };
             */
            local: localSpecifierNameIdentifier ?? nameInsteadOfDefaultIdentifier,
            exported: nameInsteadOfDefaultIdentifier!,
          }),
        );

        const replacement = j.exportNamedDeclaration.from({
          declaration: null,
          specifiers: otherSpecifiers,
          source: p.value.source,
        });

        p.replace(replacement);
      },
    ],
    j,
    collection,
  });
};

export const transformImport = ({
  collection,
  j,
  exportsNames,
  filePath,
  defaultImports,
  _extensions,
}: {
  collection: Collection;
  j: JSCodeshift;
  exportsNames: ExportsNames;
  filePath: string;
  defaultImports: DefaultImports;
  _extensions: string[];
}) => {
  const defaultImportPaths = defaultImports.get(filePath);

  if (!defaultImportPaths) {
    return;
  }

  collection.find(j.ImportDefaultSpecifier).replaceWith((p) => {
    // resolve real path without aliases, relative paths etc.
    const targetFilepath = getFullPathFromRelative({
      relativePath: p.parent.value.source.value as string,
      currentFilePath: filePath,
      extensions: _extensions,
    });

    const nameInsteadOfDefault = exportsNames.get(targetFilepath);

    if (!nameInsteadOfDefault) {
      console.error('There is no "nameInsteadOfDefault" for targetFilepath: ', targetFilepath);

      return p;
    }

    return j.importSpecifier(j.identifier(nameInsteadOfDefault));
  });
};

// const transformDefaultUsage = ({
//   collection,
//   j,
//   filePath,
// }: {
//   collection: Collection;
//   j: JSCodeshift;
//   filePath: string;
// }) => {
// const importNamespaceSpecifier = collection.find(j.ImportNamespaceSpecifier).get();
// importNamespaceSpecifier.parent.value.source.value;

// if (!exportsNames.has(filePath) && !proxyExports.has(filePath)) {
//   return;
// }

// // Patch direct access to "default" of ImportNamespaceSpecifier
// collection
//   .find(j.MemberExpression, {
//     object: { name: importNamespaceSpecifier },
//     property: { name: 'default' },
//   })
//   .replaceWith((p) => {
//     console.log('! p');

//     return j.memberExpression(p.value.object, {
//       ...(p.value.property as Identifier),
//       name: nameInsteadOfDefault,
//     });
//   });
// };

const transform = (
  fileInfo: { path: string; source: string },
  api: API,
  {
    preservedDefaultExportsArr,
    _extensions,
    exportsNamesArr,
    proxyExportsArr,
    defaultImportsArr,
  }: {
    defaultImportsArr: DefaultImportsArr;
    exportsNamesArr: ExportsNamesArr;
    proxyExportsArr: ProxyExportsArr;
    preservedDefaultExportsArr: string[];
    _extensions: string[];
  },
) => {
  const j = api.jscodeshift;
  const exportsNames = new Map(exportsNamesArr);
  const proxyExports = new Map(proxyExportsArr);
  const defaultImports = new Map(defaultImportsArr.map((item) => [item[0], new Set(item[1])]));
  const preservedDefaultExports: PreservedDefaultExports = new Set(preservedDefaultExportsArr);

  debugLog('transform start', {
    'fileInfo.path': fileInfo.path,
  });

  const collection = j(fileInfo.source);

  transformExport({
    collection,
    j,
    preservedDefaultExports,
    exportsNames,
    filePath: fileInfo.path,
    proxyExports,
  });

  transformImport({
    collection,
    j,
    exportsNames,
    filePath: fileInfo.path,
    defaultImports,
    _extensions,
  });

  // transformDefaultUsage({
  //   collection,
  //   j,
  //   filePath: fileInfo.path,
  // });

  return collection.toSource();
};

export default transform;
