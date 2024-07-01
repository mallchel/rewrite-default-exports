import test, { describe, it, mock } from 'node:test';
// import { equal, throws } from 'node:assert/strict';
import { equal } from 'node:assert';
import j, { type Collection, type JSCodeshift } from 'jscodeshift';

import { getFullPathFromRelative } from '../__mocks__/utils';
import * as utils from '../utils';
import transform from '../transform';
import type { DefaultImportsArr, ExportsNamesArr, ProxyExportsArr } from '../types';

const buildCodeFromLines = <const T>(...lines: T[]) => {
  return lines.join('\n') as T;
};

describe('transform', () => {
  mock.method(utils, 'getFullPathFromRelative', getFullPathFromRelative);
  const _extensions = [''];
  const stats = () => {};
  const report = () => {};
  const filePath = 'app/Root.js';
  const targetFilePath = '../Test';
  const proxyExportsArr = [[filePath, targetFilePath]] satisfies ProxyExportsArr;

  // TODO: add tests for non proxy files
  /**
   * @note
   * all of them might be:
   * 1. imported default or proxy file to apply transformation
   * 2. file with preservedExport
   */
  const namedImportExportAsDefault = buildCodeFromLines(
    `import { anythingElse, Test } from '${targetFilePath}';`,
    'export { anythingElse, Test as default };',
  );
  const namedImportExportDefault = buildCodeFromLines(
    `import { anythingElse, Test } from '${targetFilePath}';`,
    'export { anythingElse };',
    'export default Test;',
  );
  const namedImportAliasedExportDefault = buildCodeFromLines(
    `import { anythingElse, Test as Test1 } from '${targetFilePath}';`,
    'export { anythingElse };',
    'export default Test1;',
  );
  const namedImportAliasedExportAsDefault = buildCodeFromLines(
    `import { anythingElse, Test as Test1 } from '${targetFilePath}';`,
    'export { anythingElse, Test1 as default };',
  );
  const defaultImportExportDefault = buildCodeFromLines(
    `import Test1, { anythingElse } from '${targetFilePath}';`,
    'export { anythingElse };',
    'export default Test1;',
  );
  const defaultImportExportAsDefault = buildCodeFromLines(
    `import Test1, { anythingElse } from '${targetFilePath}';`,
    'export { anythingElse, Test1 as default };',
  );
  const exportDefault = buildCodeFromLines(
    `console.log('exportDefault');`,
    'const anythingElse = 123;',
    `const Test1 = 123;`,
    'export { anythingElse };',
    'export default Test1;',
  );
  const exportFromSomethingAsDefault = buildCodeFromLines(
    `export { anythingElse, Test1 as default } from '${targetFilePath}';`,
  );
  const exportFromSomethingDefaultAsDefault = buildCodeFromLines(
    `export { anythingElse, default } from '${targetFilePath}';`,
  );
  const exportFromSomethingDefaultAsNamed = buildCodeFromLines(
    `export { anythingElse, default as Test1 } from '${targetFilePath}';`,
  );

  test('should not change anything', () => {
    const result1 = transform(
      { path: filePath, source: namedImportExportAsDefault },
      { jscodeshift: j, j, stats, report },
      {
        exportsNamesArr: [],
        preservedDefaultExportsArr: [],
        _extensions,
        proxyExportsArr: [],
        defaultImportsArr: [],
      },
    );

    equal(result1, namedImportExportAsDefault);

    const result2 = transform(
      { path: filePath, source: namedImportExportDefault },
      { jscodeshift: j, j, stats, report },
      {
        exportsNamesArr: [],
        preservedDefaultExportsArr: [],
        _extensions,
        proxyExportsArr: [],
        defaultImportsArr: [],
      },
    );

    equal(result2, namedImportExportDefault);

    const result3 = transform(
      { path: filePath, source: namedImportAliasedExportDefault },
      { jscodeshift: j, j, stats, report },
      {
        exportsNamesArr: [],
        preservedDefaultExportsArr: [],
        _extensions,
        proxyExportsArr: [],
        defaultImportsArr: [],
      },
    );

    equal(result3, namedImportAliasedExportDefault);

    const result4 = transform(
      { path: filePath, source: defaultImportExportDefault },
      { jscodeshift: j, j, stats, report },
      {
        exportsNamesArr: [],
        preservedDefaultExportsArr: [],
        _extensions,
        proxyExportsArr: [],
        defaultImportsArr: [],
      },
    );

    equal(result4, defaultImportExportDefault);

    const result5 = transform(
      { path: filePath, source: defaultImportExportAsDefault },
      { jscodeshift: j, j, stats, report },
      {
        exportsNamesArr: [],
        preservedDefaultExportsArr: [],
        _extensions,
        proxyExportsArr: [],
        defaultImportsArr: [],
      },
    );

    equal(result5, defaultImportExportAsDefault);
  });

  describe('should transform: namedImportExportAsDefault', () => {
    test('preserved', () => {
      const resultCode = buildCodeFromLines(
        `import { anythingElse, Test } from '${targetFilePath}';`,
        'export { anythingElse, Test as default, Test };',
      );

      const result = transform(
        { path: filePath, source: namedImportExportAsDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr: [],
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyExportsArr,
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });

    test('not preserved', () => {
      const resultCode = buildCodeFromLines(
        `import { anythingElse, Test } from '${targetFilePath}';`,
        'export { anythingElse, Test };',
      );

      const result = transform(
        { path: filePath, source: namedImportExportAsDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr: [],
          preservedDefaultExportsArr: [],
          _extensions,
          proxyExportsArr,
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });
  });

  describe('should transform: namedImportExportDefault', () => {
    test('preserved', () => {
      const resultCode = buildCodeFromLines(
        `import { anythingElse, Test } from '${targetFilePath}';`,
        'export { anythingElse };',
        'export default Test;',
        'export { Test };',
      );

      const result = transform(
        { path: filePath, source: namedImportExportDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr: [],
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyExportsArr,
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });

    test('not preserved', () => {
      const resultCode = buildCodeFromLines(
        `import { anythingElse, Test } from '${targetFilePath}';`,
        'export { anythingElse };',
        'export { Test };',
      );

      const result = transform(
        { path: filePath, source: namedImportExportDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr: [],
          preservedDefaultExportsArr: [],
          _extensions,
          proxyExportsArr,
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });
  });

  describe('should transform: namedImportAliasedExportDefault', () => {
    test('preserved', () => {
      const resultCode = buildCodeFromLines(
        `import { anythingElse, Test as Test1 } from '${targetFilePath}';`,
        'export { anythingElse };',
        'export default Test1;',
        'export { Test1 as Test };',
      );

      const result = transform(
        { path: filePath, source: namedImportAliasedExportDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr: [],
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyExportsArr,
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });

    test('not preserved', () => {
      const resultCode = buildCodeFromLines(
        `import { anythingElse, Test as Test1 } from '${targetFilePath}';`,
        'export { anythingElse };',
        'export { Test1 as Test };',
      );

      const result = transform(
        { path: filePath, source: namedImportAliasedExportDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr: [],
          preservedDefaultExportsArr: [],
          _extensions,
          proxyExportsArr,
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });
  });

  describe('should transform: namedImportAliasedExportAsDefault', () => {
    test('preserved', () => {
      const resultCode = buildCodeFromLines(
        `import { anythingElse, Test as Test1 } from '${targetFilePath}';`,
        'export { anythingElse, Test1 as default, Test1 as Test };',
      );

      const result = transform(
        { path: filePath, source: namedImportAliasedExportAsDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr: [],
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyExportsArr,
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });

    test('not preserved', () => {
      const resultCode = buildCodeFromLines(
        `import { anythingElse, Test as Test1 } from '${targetFilePath}';`,
        'export { anythingElse, Test1 as Test };',
      );

      const result = transform(
        { path: filePath, source: namedImportAliasedExportAsDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr: [],
          preservedDefaultExportsArr: [],
          _extensions,
          proxyExportsArr,
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });
  });

  describe('should transform: defaultImportExportDefault', () => {
    const newName = 'NameTest';
    const exportsNamesArr = [[targetFilePath, newName]] satisfies ExportsNamesArr;
    const defaultImportsArr = [[filePath, [targetFilePath]]] satisfies DefaultImportsArr;

    test('preserved', () => {
      const resultCode = buildCodeFromLines(
        `import { ${newName}, anythingElse } from '${targetFilePath}';`,
        'export { anythingElse };',
        `export default ${newName};`,
        `export { ${newName} };`,
      );

      const result = transform(
        { path: filePath, source: defaultImportExportDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyExportsArr,
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });

    test('not preserved', () => {
      const resultCode = buildCodeFromLines(
        `import { ${newName}, anythingElse } from '${targetFilePath}';`,
        'export { anythingElse };',
        `export { ${newName} };`,
      );

      const result = transform(
        { path: filePath, source: defaultImportExportDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyExportsArr,
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });
  });

  describe('should transform: defaultImportExportAsDefault', () => {
    const newName = 'NameTest';
    const exportsNamesArr = [[targetFilePath, newName]] satisfies ExportsNamesArr;
    const defaultImportsArr = [[filePath, [targetFilePath]]] satisfies DefaultImportsArr;

    test('preserved', () => {
      const resultCode = buildCodeFromLines(
        `import { ${newName}, anythingElse } from '${targetFilePath}';`,
        `export { anythingElse, ${newName} as default, ${newName} };`,
      );

      const result = transform(
        { path: filePath, source: defaultImportExportAsDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyExportsArr,
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });

    test('not preserved', () => {
      const resultCode = buildCodeFromLines(
        `import { ${newName}, anythingElse } from '${targetFilePath}';`,
        `export { anythingElse, ${newName} };`,
      );

      const result = transform(
        { path: filePath, source: defaultImportExportAsDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyExportsArr,
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });
  });

  describe('should transform: exportDefault', () => {
    const newName = 'Test1';
    const exportsNamesArr = [[filePath, newName]] satisfies ExportsNamesArr;

    test('preserved', () => {
      const resultCode = buildCodeFromLines(
        `console.log('exportDefault');`,
        'const anythingElse = 123;',
        `const Test1 = 123;`,
        'export { anythingElse };',
        `export default Test1;`,
        `export { Test1 };`,
      );

      const result = transform(
        { path: filePath, source: exportDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyExportsArr: [],
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });

    test('not preserved', () => {
      const resultCode = buildCodeFromLines(
        `console.log('exportDefault');`,
        'const anythingElse = 123;',
        `const Test1 = 123;`,
        'export { anythingElse };',
        'export { Test1 };'
      );

      const result = transform(
        { path: filePath, source: exportDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyExportsArr: [],
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });
  });

  describe('should transform: exportFromSomethingAsDefault', () => {
    const newName = 'Test1';
    const exportsNamesArr = [[targetFilePath, newName]] satisfies ExportsNamesArr;

    test('preserved', () => {
      const resultCode = buildCodeFromLines(
        `export { anythingElse, Test1 as default, Test1 } from '${targetFilePath}';`,
      );

      const result = transform(
        { path: filePath, source: exportFromSomethingAsDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyExportsArr,
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });

    test('not preserved', () => {
      const resultCode = buildCodeFromLines(
        `export { anythingElse, Test1 } from '${targetFilePath}';`,
      );

      const result = transform(
        { path: filePath, source: exportFromSomethingAsDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyExportsArr,
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });
  });

  describe('should transform: exportFromSomethingDefaultAsDefault', () => {
    const newName = 'Test1';
    const exportsNamesArr = [[targetFilePath, newName]] satisfies ExportsNamesArr;

    test('preserved', () => {
      const resultCode = buildCodeFromLines(
        `export { anythingElse, Test1 as default, Test1 } from '${targetFilePath}';`,
      );

      const result = transform(
        { path: filePath, source: exportFromSomethingDefaultAsDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyExportsArr,
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });

    test('not preserved', () => {
      const resultCode = buildCodeFromLines(
        `export { anythingElse, Test1 } from '${targetFilePath}';`,
      );

      const result = transform(
        { path: filePath, source: exportFromSomethingDefaultAsDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyExportsArr,
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });
  });

  describe('should transform: exportFromSomethingDefaultAsNamed', () => {
    const newName = 'Test1';
    const exportsNamesArr = [[targetFilePath, newName]] satisfies ExportsNamesArr;

    test('preserved', () => {
      const resultCode = buildCodeFromLines(
        `export { anythingElse, Test1 as default, Test1 } from '${targetFilePath}';`,
      );

      const result = transform(
        { path: filePath, source: exportFromSomethingDefaultAsNamed },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyExportsArr,
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });

    test('not preserved', () => {
      const resultCode = buildCodeFromLines(
        `export { anythingElse, Test1 } from '${targetFilePath}';`,
      );

      const result = transform(
        { path: filePath, source: exportFromSomethingDefaultAsNamed },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyExportsArr,
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });
  });

  // describe('should transform: import * as all => all.default', () => {
  //   const newName = 'NameTest';
  //   const exportsNamesArr = [[targetFilePath, newName]] satisfies ExportsNamesArr;
  //   // const defaultImportsArr = [[filePath, [targetFilePath]]] satisfies DefaultImportsArr;

  //   test('should transform in direct import', () => {
  //     const resultCode = buildCodeFromLines(
  //       `import * as all from '${targetFilePath}';`,
  //       `console.log(all.${newName})`,
  //     );

  //     const result = transform(
  //       {
  //         path: filePath,
  //         source: buildCodeFromLines(
  //           `import * as all from '${targetFilePath}';`,
  //           'console.log(all.default);',
  //         ),
  //       },
  //       { jscodeshift: j, j, stats, report },
  //       {
  //         exportsNamesArr,
  //         preservedDefaultExportsArr: [filePath],
  //         _extensions,
  //         proxyExportsArr: [],
  //         defaultImportsArr: [],
  //       },
  //     );

  //     equal(result, resultCode);
  //   });

  //   // test('should transform in proxy file', () => {
  //   //   const resultCode = buildCodeFromLines(
  //   //     `import * as all from '${targetFilePath}';`,
  //   //     `console.log(all.${newName})`,
  //   //   );

  //   //   const result = transform(
  //   //     {
  //   //       path: filePath,
  //   //       source: buildCodeFromLines(
  //   //         `import * as all from '${targetFilePath}';`,
  //   //         'console.log(all.default);',
  //   //       ),
  //   //     },
  //   //     { jscodeshift: j, j, stats, report },
  //   //     {
  //   //       exportsNamesArr,
  //   //       preservedDefaultExportsArr: [filePath],
  //   //       _extensions,
  //   //       // TODO: how to test two nested proxy files?
  //   //       proxyExportsArr: [[filePath, '../Test/index.ts'], ['../Test/index.ts', '../targetFile.ts']],
  //   //       defaultImportsArr: [],
  //   //     },
  //   //   );

  //   //   equal(result, resultCode);
  //   // });

  //   // test('should not transform: does not have new name', () => {
  //   //   const code = buildCodeFromLines(
  //   //     `import * as all from '${targetFilePath}';`,
  //   //     'console.log(all.default);',
  //   //   );

  //   //   const result = transform(
  //   //     {
  //   //       path: filePath,
  //   //       source: code,
  //   //     },
  //   //     { jscodeshift: j, j, stats, report },
  //   //     {
  //   //       exportsNamesArr: [],
  //   //       preservedDefaultExportsArr: [filePath],
  //   //       _extensions,
  //   //       proxyExportsArr: [],
  //   //       defaultImportsArr: [],
  //   //     },
  //   //   );

  //   //   equal(result, code);
  //   // });
  // });
});
