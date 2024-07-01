import test, { describe, it, mock } from 'node:test';
import { equal, throws } from 'node:assert/strict';
import j, { type Collection, type JSCodeshift } from 'jscodeshift';
import { gatherProxyExportsViaNamedExports, makeFnsToIterateByExportDefault } from '../gatherInfo';
import { getFullPathFromRelative } from '../__mocks__/utils';
import * as utils from '../utils';
import type { LocalImportPathsByName, ProxyExports } from '../types';

// TODO: maybe rewrite this file to test the whole file
describe('gatherInfo', () => {
  mock.method(utils, 'getFullPathFromRelative', getFullPathFromRelative);
  const _extensions = [''];

  const runGatherProxyExportsViaNamedExports = ({
    collection,
    filePath,
    j,
    proxyExports,
    localImportPathsByName,
  }: {
    collection: Collection;
    filePath: string;
    j: JSCodeshift;
    proxyExports: ProxyExports;
    localImportPathsByName: LocalImportPathsByName;
  }) => {
    utils.iterateByExportImportDefaultInNamedDeclaration({
      j,
      collection,
      callbacks: [
        (p) =>
          gatherProxyExportsViaNamedExports({
            filePath,
            proxyExports,
            _extensions,
            localImportPathsByName,
            p,
          }),
      ],
    });
  };

  test('should find "export { default } from"', () => {
    const targetPath = './relative-path';
    const code = `export { default } from '${targetPath}';`;
    const proxyExports = new Map();
    const filePath = 'test-file-path';

    runGatherProxyExportsViaNamedExports({
      collection: j(code),
      j,
      filePath,
      proxyExports,
      localImportPathsByName: new Map(),
    });

    equal(proxyExports.get(filePath), targetPath);
  });

  test('should find "export { Something as default } from"', () => {
    const targetPath = './relative-path';
    const code = `export { Something as default } from '${targetPath}';`;
    const proxyExports = new Map();
    const filePath = 'test-file-path';

    runGatherProxyExportsViaNamedExports({
      collection: j(code),
      j,
      filePath,
      proxyExports,
      localImportPathsByName: new Map(),
    });

    equal(proxyExports.get(filePath), targetPath);
  });

  test('should find "import { Something }...export { Something as default }"', () => {
    const targetPath = './relative-path';
    const code = `
      import { Something } from '${targetPath}';
      export { Something as default };
    `;
    const proxyExports = new Map();
    const filePath = 'test-file-path';

    runGatherProxyExportsViaNamedExports({
      collection: j(code),
      j,
      filePath,
      proxyExports,
      localImportPathsByName: new Map([['Something', targetPath]]),
    });

    equal(proxyExports.get(filePath), targetPath);
  });

  test('should find "import Something...export default Something"', () => {
    const targetPath = './relative-path';

    const code = `
      import Something from '${targetPath}';
      export default Something;
      `;

    const proxyExports = new Map();
    const filePath = 'current-file-path';

    const fnsToIterateByExportDefault = makeFnsToIterateByExportDefault({
      exportsNames: new Map(),
      proxyExports,
      filePath,
      localImportPathsByName: new Map([['Something', targetPath]]),
    });

    utils.iterateByExportDefaultDeclaration({
      j,
      collection: j(code),
      callbacks: [
        fnsToIterateByExportDefault.makeForIdentifier(),
        fnsToIterateByExportDefault.makeForNonIdentifier(),
      ],
    });

    equal(proxyExports.get(filePath), targetPath);
  });

  test('should find "const Something...export default Something"', () => {
    const targetExportName = 'Something';
    const code = `
      const ${targetExportName} = () => {};
      export default ${targetExportName};
      `;

    const exportsNames = new Map();
    const filePath = 'current-file-path';

    const fnsToIterateByExportDefault = makeFnsToIterateByExportDefault({
      exportsNames,
      proxyExports: new Map(),
      filePath,
      localImportPathsByName: new Map(),
    });

    utils.iterateByExportDefaultDeclaration({
      j,
      collection: j(code),
      callbacks: [
        fnsToIterateByExportDefault.makeForIdentifier(),
        fnsToIterateByExportDefault.makeForNonIdentifier(),
      ],
    });

    equal(exportsNames.get(filePath), targetExportName);
  });

  test('should find local const', () => {
    const targetExportName = 'Test1';
    const code = `
      console.log('exportDefault');
      const anythingElse = 123;
      const Test1 = 123;
      export { anythingElse };
      export default Test1;
      `;
    const exportsNames = new Map();
    const filePath = 'current-file-path';

    const fnsToIterateByExportDefault = makeFnsToIterateByExportDefault({
      exportsNames,
      proxyExports: new Map(),
      filePath,
      localImportPathsByName: new Map(),
    });

    utils.iterateByExportDefaultDeclaration({
      j,
      collection: j(code),
      callbacks: [
        fnsToIterateByExportDefault.makeForIdentifier(),
        fnsToIterateByExportDefault.makeForNonIdentifier(),
      ],
    });

    equal(exportsNames.get(filePath), targetExportName);
  });

  test('should find default export in named declaration', () => {
    const code = `
      export { default as Modals, modalProps, ModalProps } from './Modals';
      `;
    const exportsNames = new Map();
    const defaultImports = new Map();
    const proxyExports = new Map();
    const localImportPathsByName = new Map();
    const filePath = 'current-file-path';

    const collection = j(code);

    collection.find(j.ImportDeclaration).forEach((path) => {
      utils.gatherLocalImportsDefaultImports({
        path,
        filePath,
        defaultImports,
        _extensions,
        localImportPathsByName,
        j,
      });
    });
    collection.find(j.ExportNamedDeclaration).forEach((path) => {
      utils.gatherLocalImportsDefaultImports({
        path,
        filePath,
        defaultImports,
        _extensions,
        localImportPathsByName,
        j,
      });
    });

    console.log('! exportsNames', { exportsNames, proxyExports, localImportPathsByName });

    equal(localImportPathsByName.get('default'), './Modals');
    equal(localImportPathsByName.get('modalProps'), './Modals');
    equal(localImportPathsByName.get('ModalProps'), './Modals');
  });
});
