import test, { afterEach, describe, mock } from 'node:test';
import { equal, deepEqual } from 'node:assert/strict';
import j from 'jscodeshift';
import {
  getFullPathFromRelative,
  getIsAcceptableModule,
  getIsVisitedPath,
} from '../__mocks__/utils';
import * as utils from '../utils';
import { buildCodeFromLines } from './helpers';

import gatherInfo from '../gatherInfo';
import { mockFs } from '../mockFs';

describe('gatherInfo', () => {
  getIsAcceptableModule.mock.mockImplementation(() => {
    return true;
  });
  mock.method(utils, 'getFullPathFromRelative', getFullPathFromRelative);
  mock.method(utils, 'getIsAcceptableModule', getIsAcceptableModule);
  mock.method(utils, 'getIsVisitedPath', getIsVisitedPath);

  const _extensions = [''];
  const stats = () => {};
  const report = () => {};
  const gatherInfoApi = { jscodeshift: j, j, stats, report };
  const currentFilePath = '/current-file-path';
  const targetFilePath = './relative-path';
  const targetFilePath2 = './relative-path-2';

  afterEach(() => {
    mockFs.restore();
  });

  test('should find "export { default } from"', () => {
    const code = buildCodeFromLines(
      `export { default } from '${targetFilePath}';`,
      `export { default as Test1 } from '${targetFilePath2}';`,
    );

    const defaultImports = new Map();
    const exportsNames = new Map();
    const proxyDefaultExports = new Map();
    const preservedDefaultExports = new Set<string>();

    mockFs({ [targetFilePath]: '', [targetFilePath2]: '' });

    gatherInfo(
      {
        path: currentFilePath,
        source: code,
      },
      gatherInfoApi,
      {
        defaultImports,
        exportsNames,
        proxyDefaultExports,
        _extensions,
        preservedDefaultExports,
      },
    );

    equal(exportsNames.size, 0);
    deepEqual(defaultImports.get(currentFilePath), new Set([targetFilePath, targetFilePath2]));
    equal(proxyDefaultExports.get(currentFilePath), targetFilePath);
  });

  test('should find "export { Something as default } from"', () => {
    const targetExportName = 'Something';
    const code = `export { default as ${targetExportName}, SomethingElse, ${targetExportName} as default } from '${targetFilePath}';`;

    const defaultImports = new Map();
    const exportsNames = new Map();
    const proxyDefaultExports = new Map();
    const preservedDefaultExports = new Set<string>();

    mockFs({ [targetFilePath]: '' });

    gatherInfo(
      {
        path: currentFilePath,
        source: code,
      },
      gatherInfoApi,
      {
        defaultImports,
        exportsNames,
        proxyDefaultExports,
        _extensions,
        preservedDefaultExports,
      },
    );

    deepEqual(defaultImports.get(currentFilePath), new Set([targetFilePath]));
    equal(exportsNames.get(currentFilePath), targetExportName);
    equal(proxyDefaultExports.get(currentFilePath), undefined);
  });

  test('should find "import { Something }...export { Something as default }"', () => {
    const importedName = 'Something';
    const code = `
      import { ${importedName} } from '${targetFilePath}';
      export { ${importedName} as default };
    `;
    const defaultImports = new Map();
    const exportsNames = new Map();
    const proxyDefaultExports = new Map();
    const preservedDefaultExports = new Set<string>();

    mockFs({ [targetFilePath]: '' });

    gatherInfo(
      {
        path: currentFilePath,
        source: code,
      },
      gatherInfoApi,
      {
        defaultImports,
        exportsNames,
        proxyDefaultExports,
        _extensions,
        preservedDefaultExports,
      },
    );

    equal(defaultImports.get(currentFilePath), undefined);
    equal(exportsNames.get(currentFilePath), importedName);
    equal(proxyDefaultExports.get(currentFilePath), undefined);
  });

  test('should find "import Something...export default Something"', () => {
    const code = `
      import Something from '${targetFilePath}';
      export default Something;
      `;
    const defaultImports = new Map();
    const exportsNames = new Map();
    const proxyDefaultExports = new Map();
    const preservedDefaultExports = new Set<string>();

    mockFs({ [targetFilePath]: '' });

    gatherInfo(
      {
        path: currentFilePath,
        source: code,
      },
      gatherInfoApi,
      {
        defaultImports,
        exportsNames,
        proxyDefaultExports,
        _extensions,
        preservedDefaultExports,
      },
    );

    deepEqual(defaultImports.get(currentFilePath), new Set([targetFilePath]));
    equal(exportsNames.get(currentFilePath), undefined);
    equal(proxyDefaultExports.get(currentFilePath), targetFilePath);
  });

  test('should find "const Something...export default Something"', () => {
    const targetExportName = 'Something';
    const code = `
      const ${targetExportName} = () => {};
      export default ${targetExportName};
      `;
    const defaultImports = new Map();
    const exportsNames = new Map();
    const proxyDefaultExports = new Map();
    const preservedDefaultExports = new Set<string>();

    mockFs({ [targetFilePath]: '' });

    gatherInfo(
      {
        path: currentFilePath,
        source: code,
      },
      gatherInfoApi,
      {
        defaultImports,
        exportsNames,
        proxyDefaultExports,
        _extensions,
        preservedDefaultExports,
      },
    );

    deepEqual(defaultImports.get(currentFilePath), undefined);
    equal(exportsNames.get(currentFilePath), targetExportName);
    equal(proxyDefaultExports.get(currentFilePath), undefined);
  });

  test('should find local const', () => {
    const targetExportName = 'Test1';
    const code = `
      console.log('exportDefault');
      const anythingElse = 123;
      const ${targetExportName} = 123;
      export { anythingElse };
      export default ${targetExportName};
      `;
    const defaultImports = new Map();
    const exportsNames = new Map();
    const proxyDefaultExports = new Map();
    const preservedDefaultExports = new Set<string>();

    mockFs({ [targetFilePath]: '' });

    gatherInfo(
      {
        path: currentFilePath,
        source: code,
      },
      gatherInfoApi,
      {
        defaultImports,
        exportsNames,
        proxyDefaultExports,
        _extensions,
        preservedDefaultExports,
      },
    );

    deepEqual(defaultImports.get(currentFilePath), undefined);
    equal(exportsNames.get(currentFilePath), targetExportName);
    equal(proxyDefaultExports.get(currentFilePath), undefined);
  });

  test('should find default export in named declaration', () => {
    const code = buildCodeFromLines(
      `import React from '${targetFilePath}';`,
      'export { React as default };',
    );

    const defaultImports = new Map();
    const exportsNames = new Map();
    const proxyDefaultExports = new Map();
    const preservedDefaultExports = new Set<string>();

    mockFs({ [targetFilePath]: '' });

    gatherInfo(
      {
        path: currentFilePath,
        source: code,
      },
      gatherInfoApi,
      {
        defaultImports,
        exportsNames,
        proxyDefaultExports,
        _extensions,
        preservedDefaultExports,
      },
    );

    deepEqual(defaultImports.get(currentFilePath), new Set([targetFilePath]));
    equal(exportsNames.get(currentFilePath), undefined);
    equal(proxyDefaultExports.get(currentFilePath), targetFilePath);
  });

  test('should find default export default 123', () => {
    const code = buildCodeFromLines('export default 123;');
    const defaultImports = new Map();
    const exportsNames = new Map();
    const proxyDefaultExports = new Map();
    const preservedDefaultExports = new Set<string>();

    mockFs({ [targetFilePath]: '' });

    gatherInfo(
      {
        path: currentFilePath,
        source: code,
      },
      gatherInfoApi,
      {
        defaultImports,
        exportsNames,
        proxyDefaultExports,
        _extensions,
        preservedDefaultExports,
      },
    );

    deepEqual(defaultImports.get(currentFilePath), undefined);
    equal(exportsNames.get(currentFilePath), currentFilePath.replace('/', ''));
    equal(proxyDefaultExports.get(currentFilePath), undefined);
  });

  test('should find original imported in default export', () => {
    const code = buildCodeFromLines(
      `import { anythingElse, Test as Test1 } from '${targetFilePath}';`,
      'export { anythingElse };',
      'export default Test1;',
    );
    const defaultImports = new Map();
    const exportsNames = new Map();
    const proxyDefaultExports = new Map();
    const preservedDefaultExports = new Set<string>();

    mockFs({ [targetFilePath]: '' });

    gatherInfo(
      {
        path: currentFilePath,
        source: code,
      },
      gatherInfoApi,
      {
        defaultImports,
        exportsNames,
        proxyDefaultExports,
        _extensions,
        preservedDefaultExports,
      },
    );

    deepEqual(defaultImports.get(currentFilePath), undefined);
    equal(exportsNames.get(currentFilePath), 'Test1');
    equal(proxyDefaultExports.get(currentFilePath), undefined);
  });

  test('should find original imported in default named export', () => {
    const code = buildCodeFromLines(
      `import { anythingElse, Test as Test1 } from '${targetFilePath}';`,
      'export { anythingElse };',
      'export { Test1 as default };',
    );
    const defaultImports = new Map();
    const exportsNames = new Map();
    const proxyDefaultExports = new Map();
    const preservedDefaultExports = new Set<string>();

    mockFs({ [targetFilePath]: '' });

    gatherInfo(
      {
        path: currentFilePath,
        source: code,
      },
      gatherInfoApi,
      {
        defaultImports,
        exportsNames,
        proxyDefaultExports,
        _extensions,
        preservedDefaultExports,
      },
    );

    deepEqual(defaultImports.get(currentFilePath), undefined);
    equal(exportsNames.get(currentFilePath), 'Test1');
    equal(proxyDefaultExports.get(currentFilePath), undefined);
  });

  test('should find default AND export in named declaration', () => {
    const code = buildCodeFromLines(
      `export { default as Modals, modalProps } from '${targetFilePath}';`,
    );
    const defaultImports = new Map();
    const exportsNames = new Map();
    const proxyDefaultExports = new Map();
    const preservedDefaultExports = new Set<string>();

    mockFs({
      [targetFilePath]: buildCodeFromLines(
        'function Test() {console.log(123)}',
        `export default Test;`,
      ),
    });

    gatherInfo(
      {
        path: currentFilePath,
        source: code,
      },
      gatherInfoApi,
      {
        defaultImports,
        exportsNames,
        proxyDefaultExports,
        _extensions,
        preservedDefaultExports,
      },
    );

    deepEqual(defaultImports.get(currentFilePath), new Set([targetFilePath]));
    equal(exportsNames.get(targetFilePath), 'Test');
    equal(proxyDefaultExports.get(currentFilePath), undefined);
  });

  test('should find all default imports in named declaration', () => {
    const code = buildCodeFromLines(
      `export { default as Test } from '${targetFilePath}';`,
      `export { default as Test1 } from '${targetFilePath2}';`,
    );
    const defaultImports = new Map();
    const exportsNames = new Map();
    const proxyDefaultExports = new Map();
    const preservedDefaultExports = new Set<string>();

    mockFs({
      [targetFilePath]: buildCodeFromLines(
        'function Test() {console.log(123)}',
        `export default Test;`,
      ),
      [targetFilePath2]: buildCodeFromLines(
        'function Test1() {console.log(123)}',
        `export default Test1;`,
      ),
    });

    gatherInfo(
      {
        path: currentFilePath,
        source: code,
      },
      gatherInfoApi,
      {
        defaultImports,
        exportsNames,
        proxyDefaultExports,
        _extensions,
        preservedDefaultExports,
      },
    );

    deepEqual(defaultImports.get(currentFilePath), new Set([targetFilePath, targetFilePath2]));
    equal(exportsNames.get(targetFilePath), 'Test');
    equal(exportsNames.get(targetFilePath2), 'Test1');
    equal(proxyDefaultExports.get(currentFilePath), undefined);
  });

  test('should find default import and export in preservedDefaultExports', () => {
    const code = buildCodeFromLines(`import('${targetFilePath}');`);
    const defaultImports = new Map();
    const exportsNames = new Map();
    const proxyDefaultExports = new Map();
    const preservedDefaultExports = new Set<string>();

    mockFs({
      [targetFilePath]: buildCodeFromLines(
        `import Num from '${targetFilePath2}';`,

        `console.log(Num);`,

        `export default 'test';`,
      ),
      [targetFilePath2]: buildCodeFromLines(`export default 123;`),
    });

    gatherInfo(
      {
        path: currentFilePath,
        source: code,
      },
      gatherInfoApi,
      {
        defaultImports,
        exportsNames,
        proxyDefaultExports,
        _extensions,
        preservedDefaultExports,
      },
    );

    // currently we don't save the default import from current file to targetFilePath
    deepEqual(defaultImports.get(targetFilePath), new Set([targetFilePath2]));
    equal(exportsNames.get(targetFilePath), 'relative-path');
    equal(exportsNames.get(targetFilePath2), 'relative-path-2');
    equal(preservedDefaultExports.has(targetFilePath), true);
  });
});
