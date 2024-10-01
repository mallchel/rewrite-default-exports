import type { API, ASTNode, Collection, Identifier, JSCodeshift, Literal } from 'jscodeshift';
import { ExpressionKind } from 'ast-types/gen/kinds';

import {
  debugLog,
  getIsExportedDefaultSpecifier,
  getFullPathFromRelative,
  iterateByExportImportDefaultInNamedDeclaration,
  iterateByExportDefaultDeclaration,
  getIsImportedDefaultSpecifier,
  getFinalFilePaths,
  convertFromJsonToMapSet,
  getIsAcceptableModule,
  getClosest,
} from './utils';
import type {
  DefaultImports,
  DefaultImportsArr,
  ExportsNames,
  ExportsNamesArr,
  PreservedDefaultExports,
  ProxyDefaultExports,
  ProxyDefaultExportsArr,
} from './types';

export const transformExport = ({
  collection,
  j,
  preservedDefaultExports,
  exportsNames,
  filePath,
  proxyDefaultExports,
  defaultImports,
  _extensions,
}: {
  collection: Collection;
  j: JSCodeshift;
  exportsNames: ExportsNames;
  proxyDefaultExports: ProxyDefaultExports;
  preservedDefaultExports: PreservedDefaultExports;
  filePath: string;
  defaultImports: DefaultImports;
  _extensions: string[];
}) => {
  if (
    !proxyDefaultExports.has(filePath) &&
    !exportsNames.has(filePath) &&
    !defaultImports.has(filePath)
  ) {
    return;
  }

  const shouldPreserveExportDefault = preservedDefaultExports.has(filePath);

  /**
   * @note
   * filePath is might me a proxy file here, so resolve the original filePath via proxyDefaultExports
   */

  const finalFilePath = getFinalFilePaths({ targetFilePath: filePath, proxyDefaultExports });
  const isProxyFile = proxyDefaultExports.has(filePath);

  let nameInsteadOfDefault = exportsNames.get(finalFilePath);
  let shouldUpdateExportDefaultId = Boolean(nameInsteadOfDefault);
  let nameInsteadOfDefaultIdentifier = nameInsteadOfDefault
    ? j.identifier(nameInsteadOfDefault)
    : undefined;
  // When we have no targetFilePath in exportsNames
  // it means our import was "named"
  const shouldUseImportSpecifier = isProxyFile && !nameInsteadOfDefault;

  iterateByExportDefaultDeclaration({
    callbacks: [
      ({ path }, exportDefaultDeclaration) => {
        debugLog('iterateByExportDefaultDeclaration', path.value.declaration.type);
        // fallback to nameInsteadOfDefault in cases:
        // export default 123;
        // export default {...};
        let localIdentifierName =
          (path.value.declaration as Identifier).name ?? nameInsteadOfDefault;
        let localIdentifierNameIdentifier = j.identifier(localIdentifierName);

        const getFinalNode = () => {
          // TODO: add test-case
          if (
            j.FunctionDeclaration.check(path.value.declaration) ||
            j.ClassDeclaration.check(path.value.declaration)
          ) {
            return j.exportNamedDeclaration({
              ...path.value.declaration,
              ...(path.value.declaration.id ? undefined : { id: nameInsteadOfDefaultIdentifier }),
            });
          }

          if (j.Identifier.check(path.value.declaration)) {
            return j.exportNamedDeclaration(null, [
              j.exportSpecifier.from({
                local: localIdentifierNameIdentifier,
                exported: nameInsteadOfDefaultIdentifier!,
              }),
            ]);
          }

          const isIdentifierNameAlreadyUsed = !!getClosest({
            path,
            matchNode: (p) => {
              const variableDeclarator = j(p as ASTNode)
                .find(j.Identifier, { name: localIdentifierName })
                .nodes()[0];

              return Boolean(variableDeclarator);
            },
          });

          if (isIdentifierNameAlreadyUsed) {
            localIdentifierName += 'Alias';
          }
          localIdentifierNameIdentifier = j.identifier(localIdentifierName);

          const variableDeclaration = j.variableDeclaration('const', [
            j.variableDeclarator(
              localIdentifierNameIdentifier,
              path.value.declaration as ExpressionKind,
            ),
          ]);

          if (localIdentifierNameIdentifier.name === nameInsteadOfDefaultIdentifier?.name) {
            return j.exportNamedDeclaration(variableDeclaration);
          }

          return [
            variableDeclaration,
            j.exportNamedDeclaration(null, [
              j.exportSpecifier.from({
                local: localIdentifierNameIdentifier,
                exported: nameInsteadOfDefaultIdentifier!,
              }),
            ]),
          ];
        };

        const finalNode = getFinalNode();

        if (shouldPreserveExportDefault) {
          if (shouldUpdateExportDefaultId) {
            exportDefaultDeclaration.replaceWith(() => {
              return j.exportDefaultDeclaration(localIdentifierNameIdentifier!);
            });
          }

          // before is needed for cases like:
          // export default 123; ->
          // export const NewName = 123;
          // export default NewName;
          path.insertBefore(...(Array.isArray(finalNode) ? finalNode : [finalNode]));
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

        // check default import
        // Case for: `export { default as Test1 } from '../Test';`,
        if (p.value.specifiers?.find(getIsImportedDefaultSpecifier)) {
          const targetFilePath = getFullPathFromRelative({
            relativePath: p.value.source!.value as string,
            currentFilePath: filePath,
            extensions: _extensions,
          });

          nameInsteadOfDefault = exportsNames.get(targetFilePath);
          nameInsteadOfDefaultIdentifier = j.identifier(nameInsteadOfDefault!);
        }

        // if (!nameInsteadOfDefault) {
        localSpecifierName = p.value.specifiers?.find(getIsExportedDefaultSpecifier)?.local?.name!;

        // case:
        // export { default } from './Test'
        // we should use newName instead of default
        if (localSpecifierName === 'default') {
          localSpecifierName = nameInsteadOfDefault;
        }

        // for case like:
        // export { Test as default } from './Test'
        // we need only remove as default
        if (!nameInsteadOfDefault) {
          nameInsteadOfDefault = localSpecifierName;
        }

        // case:
        // export { default as Test1 } from './Test'
        // replace to export { Test1 }
        localSpecifierNameIdentifier = j.identifier(localSpecifierName ?? nameInsteadOfDefault!);
        nameInsteadOfDefaultIdentifier = j.identifier(nameInsteadOfDefault!);

        let otherSpecifiers = p.value.specifiers ?? [];
        let oldNamedExportIdentifier: Identifier | undefined = undefined;

        // remove export default and import default
        if (!shouldPreserveExportDefault || shouldUpdateExportDefaultId) {
          otherSpecifiers = otherSpecifiers.filter((specifier) => {
            const isAllowedToStay =
              !getIsExportedDefaultSpecifier(specifier) &&
              !getIsImportedDefaultSpecifier(specifier);

            // we can have only one default import and only one export default in each file
            // so we will filter only one specifier per each ExportNamedDeclaration
            if (!isAllowedToStay && specifier.exported.name !== 'default') {
              oldNamedExportIdentifier = j.identifier(specifier.exported.name);
            }

            return isAllowedToStay;
          });
        }

        // create new export default
        if (shouldPreserveExportDefault && shouldUpdateExportDefaultId) {
          otherSpecifiers.push(
            j.exportSpecifier.from({
              local: localSpecifierNameIdentifier,
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
            local: localSpecifierNameIdentifier,
            exported: oldNamedExportIdentifier ?? nameInsteadOfDefaultIdentifier!,
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

export const transformImportAndUsage = ({
  collection,
  j,
  exportsNames,
  filePath,
  defaultImports,
  _extensions,
  proxyDefaultExports,
  originalCollection,
}: {
  collection: Collection;
  j: JSCodeshift;
  exportsNames: ExportsNames;
  filePath: string;
  defaultImports: DefaultImports;
  _extensions: string[];
  proxyDefaultExports: ProxyDefaultExports;
  originalCollection: Collection;
}) => {
  const defaultImportPaths = defaultImports.get(filePath);

  if (!defaultImportPaths) {
    return;
  }

  const replaceIdentifiers = ({
    nameInsteadOfDefaultIdentifier,
    oldName,
  }: {
    nameInsteadOfDefaultIdentifier: Identifier;
    oldName: string;
  }) => {
    collection.find(j.Identifier, { name: oldName }).forEach((p) => {
      if (j.Property.check(p.parentPath.value)) {
        if (p.parentPath.value.value === p.value) {
          p.parentPath.replace({
            ...p.parentPath.value,
            value: nameInsteadOfDefaultIdentifier,
          });
        }

        return;
      }

      if (
        j.ExportSpecifier.check(p.parentPath.value) ||
        j.ImportSpecifier.check(p.parentPath.value)
      ) {
        return;
      }

      p.replace(nameInsteadOfDefaultIdentifier);
    });
  };

  const transformImportDefaultSpecifier = () => {
    collection.find(j.ImportDefaultSpecifier).forEach((p) => {
      // resolve real path without aliases, relative paths etc.
      const targetFilepath = getFullPathFromRelative({
        relativePath: p.parent.value.source.value as string,
        currentFilePath: filePath,
        extensions: _extensions,
      });

      if (!getIsAcceptableModule({ filename: targetFilepath, extensions: _extensions })) {
        return;
      }

      const finalFilePath = getFinalFilePaths({
        targetFilePath: targetFilepath,
        proxyDefaultExports,
      });

      const nameInsteadOfDefault = exportsNames.get(finalFilePath);

      if (!nameInsteadOfDefault) {
        console.error('There is no "nameInsteadOfDefault" for finalFilePath: ', finalFilePath);

        return;
      }

      const importedOldName = p.value.local!.name;
      const nameInsteadOfDefaultIdentifier = j.identifier(nameInsteadOfDefault);
      const importAliasIdentifier = j.identifier(importedOldName);

      const newImportSpecifier = j.importSpecifier.from({
        local: importAliasIdentifier,
        imported: nameInsteadOfDefaultIdentifier,
      });
      p.replace(newImportSpecifier);

      replaceIdentifiers({
        oldName: importedOldName,
        nameInsteadOfDefaultIdentifier: importAliasIdentifier,
      });
    });
  };

  transformImportDefaultSpecifier();
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

// if (!exportsNames.has(filePath) && !proxyDefaultExports.has(filePath)) {
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
    proxyDefaultExportsArr,
    defaultImportsArr,
  }: {
    defaultImportsArr: DefaultImportsArr;
    exportsNamesArr: ExportsNamesArr;
    proxyDefaultExportsArr: ProxyDefaultExportsArr;
    preservedDefaultExportsArr: string[];
    _extensions: string[];
  },
) => {
  const j = api.jscodeshift;
  const exportsNames = new Map(exportsNamesArr);
  const proxyDefaultExports = new Map(proxyDefaultExportsArr);
  const defaultImports = convertFromJsonToMapSet(defaultImportsArr);
  const preservedDefaultExports: PreservedDefaultExports = new Set(preservedDefaultExportsArr);

  debugLog('transform start', {
    'fileInfo.path': fileInfo.path,
  });

  const collection = j(fileInfo.source);
  const originalCollection = j(fileInfo.source);

  transformExport({
    collection,
    j,
    preservedDefaultExports,
    exportsNames,
    filePath: fileInfo.path,
    proxyDefaultExports,
    defaultImports,
    _extensions,
  });

  transformImportAndUsage({
    collection,
    j,
    exportsNames,
    filePath: fileInfo.path,
    defaultImports,
    _extensions,
    proxyDefaultExports,
    originalCollection,
  });

  // transformDefaultUsage({
  //   collection,
  //   j,
  //   filePath: fileInfo.path,
  // });

  return collection.toSource();
};

export default transform;
