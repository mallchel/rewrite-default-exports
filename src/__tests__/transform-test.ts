import test, { describe, it, mock } from 'node:test';
import { equal } from 'node:assert';
import j from 'jscodeshift';

import { getFullPathFromRelative, getIsAcceptableModule } from '../__mocks__/utils';
import * as utils from '../utils';
import transform from '../transform';
import type { DefaultImportsArr, ExportsNamesArr, ProxyDefaultExportsArr } from '../types';
import { buildCodeFromLines } from './helpers';

// TODO: downsides with namespaces
// 1. export default Wrapper;
// 2. import Wrapper from './Wrapper';
//    export { Wrapper };
// 3. import * as PortalParts from './'
// 4. PortalParts.Wrapper
// 5. point 1 -> export const PortalWrapper
// 6. PortalParts.Wrapper is left

describe('transform', () => {
  mock.method(utils, 'getFullPathFromRelative', getFullPathFromRelative);
  getIsAcceptableModule.mock.mockImplementation(() => {
    return true;
  });
  mock.method(utils, 'getIsAcceptableModule', getIsAcceptableModule);

  const _extensions = [''];
  const stats = () => {};
  const report = () => {};
  const filePath = 'app/Root.js';
  const targetFilePath = '../Test';
  const targetFilePath2 = '../Test2';
  const targetFilePath3 = '../Test3';
  const proxyDefaultExportsArrFilePathToTarget = [
    [filePath, targetFilePath],
  ] satisfies ProxyDefaultExportsArr;

  /**
   * @note
   * all of them might be:
   * 1. file with preservedExport
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
    'import React from "react";',
    'import curry from "lodash/curry";',
    `import Test1, { anythingElse } from '${targetFilePath}';`,
    'export { anythingElse };',
    'export default Test1;',
    'console.log(Test1);',
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
  const importDefaultExportAsNamed = buildCodeFromLines(
    `import Test1, { anythingElse } from '${targetFilePath}';`,
    'export { anythingElse, Test1 };',
  );

  test('should not change anything', () => {
    const result1 = transform(
      { path: filePath, source: namedImportExportAsDefault },
      { jscodeshift: j, j, stats, report },
      {
        exportsNamesArr: [],
        preservedDefaultExportsArr: [],
        _extensions,
        proxyDefaultExportsArr: [],
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
        proxyDefaultExportsArr: [],
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
        proxyDefaultExportsArr: [],
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
        proxyDefaultExportsArr: [],
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
        proxyDefaultExportsArr: [],
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
          exportsNamesArr: [[filePath, 'Test']] satisfies ExportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyDefaultExportsArr: [],
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
          exportsNamesArr: [[filePath, 'Test']] satisfies ExportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: [],
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
        'export { Test };',
        'export default Test;',
      );

      const result = transform(
        { path: filePath, source: namedImportExportDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr: [[filePath, 'Test']] satisfies ExportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyDefaultExportsArr: [],
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
          exportsNamesArr: [[filePath, 'Test']] satisfies ExportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: [],
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
        'export { Test1 };',
        'export default Test1;',
      );

      const result = transform(
        { path: filePath, source: namedImportAliasedExportDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr: [[filePath, 'Test1']] satisfies ExportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });

    test('not preserved', () => {
      const resultCode = buildCodeFromLines(
        `import { anythingElse, Test as Test1 } from '${targetFilePath}';`,
        'export { anythingElse };',
        'export { Test1 };',
      );

      const result = transform(
        { path: filePath, source: namedImportAliasedExportDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr: [[filePath, 'Test1']] satisfies ExportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: [],
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
        'export { anythingElse, Test1 as default, Test1 };',
      );

      const result = transform(
        { path: filePath, source: namedImportAliasedExportAsDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr: [[filePath, 'Test1']] satisfies ExportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });

    test('not preserved', () => {
      const resultCode = buildCodeFromLines(
        `import { anythingElse, Test as Test1 } from '${targetFilePath}';`,
        'export { anythingElse, Test1 };',
      );

      const result = transform(
        { path: filePath, source: namedImportAliasedExportAsDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr: [[filePath, 'Test1']] satisfies ExportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: [],
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
        'import React from "react";',
        'import curry from "lodash/curry";',
        `import { ${newName} as Test1, anythingElse } from '${targetFilePath}';`,
        'export { anythingElse };',
        `export { Test1 as ${newName} };`,
        `export default Test1;`,
        `console.log(Test1);`,
      );

      const result = transform(
        { path: filePath, source: defaultImportExportDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyDefaultExportsArr: proxyDefaultExportsArrFilePathToTarget,
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });

    test('not preserved', () => {
      const resultCode = buildCodeFromLines(
        'import React from "react";',
        'import curry from "lodash/curry";',
        `import { ${newName} as Test1, anythingElse } from '${targetFilePath}';`,
        'export { anythingElse };',
        `export { Test1 as ${newName} };`,
        `console.log(Test1);`,
      );

      const result = transform(
        { path: filePath, source: defaultImportExportDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: proxyDefaultExportsArrFilePathToTarget,
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
        `import { ${newName} as Test1, anythingElse } from '${targetFilePath}';`,
        `export { anythingElse, Test1 as default, Test1 as ${newName} };`,
      );

      const result = transform(
        { path: filePath, source: defaultImportExportAsDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyDefaultExportsArr: proxyDefaultExportsArrFilePathToTarget,
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });

    test('not preserved', () => {
      const resultCode = buildCodeFromLines(
        `import { ${newName} as Test1, anythingElse } from '${targetFilePath}';`,
        `export { anythingElse, Test1 as ${newName} };`,
      );

      const result = transform(
        { path: filePath, source: defaultImportExportAsDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: proxyDefaultExportsArrFilePathToTarget,
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
        `export { Test1 };`,
        `export default Test1;`,
      );

      const result = transform(
        { path: filePath, source: exportDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyDefaultExportsArr: [],
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
        'export { Test1 };',
      );

      const result = transform(
        { path: filePath, source: exportDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });
  });

  describe('should transform: exportFromSomethingAsDefault', () => {
    const newName = 'Test1';
    const exportsNamesArr = [[filePath, newName]] satisfies ExportsNamesArr;

    test('preserved', () => {
      const resultCode = buildCodeFromLines(
        `export { anythingElse, ${newName} as default, ${newName} } from '${targetFilePath}';`,
      );

      const result = transform(
        { path: filePath, source: exportFromSomethingAsDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });

    test('not preserved', () => {
      const resultCode = buildCodeFromLines(
        `export { anythingElse, ${newName} } from '${targetFilePath}';`,
      );

      const result = transform(
        { path: filePath, source: exportFromSomethingAsDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr: [],
        },
      );

      equal(result, resultCode);
    });
  });

  describe('should transform: exportFromSomethingDefaultAsDefault', () => {
    const newName = 'Test1';
    const defaultImportsArr = [[filePath, [targetFilePath]]] satisfies DefaultImportsArr;
    const exportsNamesArr = [[targetFilePath, newName]] satisfies ExportsNamesArr;

    test('preserved', () => {
      const resultCode = buildCodeFromLines(
        `export { anythingElse, ${newName} as default, ${newName} } from '${targetFilePath}';`,
      );

      const result = transform(
        { path: filePath, source: exportFromSomethingDefaultAsDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyDefaultExportsArr: proxyDefaultExportsArrFilePathToTarget,
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });

    test('not preserved', () => {
      const resultCode = buildCodeFromLines(
        `export { anythingElse, ${newName} } from '${targetFilePath}';`,
      );

      const result = transform(
        { path: filePath, source: exportFromSomethingDefaultAsDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: proxyDefaultExportsArrFilePathToTarget,
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });
  });

  describe('should transform: exportFromSomethingDefaultAsNamed', () => {
    const newName = 'Test2';
    const exportsNamesArr = [[targetFilePath, newName]] satisfies ExportsNamesArr;
    const defaultImportsArr = [[filePath, [targetFilePath]]] satisfies DefaultImportsArr;

    test('preserved', () => {
      const resultCode = buildCodeFromLines(
        `export { anythingElse, Test2 as Test1 } from '${targetFilePath}';`,
      );

      const result = transform(
        { path: filePath, source: exportFromSomethingDefaultAsNamed },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });

    test('not preserved', () => {
      const resultCode = buildCodeFromLines(
        `export { anythingElse, Test2 as Test1 } from '${targetFilePath}';`,
      );

      const result = transform(
        { path: filePath, source: exportFromSomethingDefaultAsNamed },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });
  });

  describe('should transform: default import specifier to named identifier', () => {
    const newName = 'NameTest';
    const exportsNamesArr = [[targetFilePath, newName]] satisfies ExportsNamesArr;
    const defaultImportsArr = [[filePath, [targetFilePath]]] satisfies DefaultImportsArr;

    test('preserved', () => {
      const resultCode = buildCodeFromLines(
        'import React from "react";',
        'import curry from "lodash/curry";',
        `import { ${newName} as Test1, anythingElse } from '${targetFilePath}';`,
        'export { anythingElse };',
        `export { Test1 as ${newName} };`,
        `export default Test1;`,
        `console.log(Test1);`,
      );

      const result = transform(
        { path: filePath, source: defaultImportExportDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyDefaultExportsArr: proxyDefaultExportsArrFilePathToTarget,
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });

    test('not preserved', () => {
      const resultCode = buildCodeFromLines(
        'import React from "react";',
        'import curry from "lodash/curry";',
        `import { ${newName} as Test1, anythingElse } from '${targetFilePath}';`,
        'export { anythingElse };',
        `export { Test1 as ${newName} };`,
        `console.log(Test1);`,
      );

      const result = transform(
        { path: filePath, source: defaultImportExportDefault },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: proxyDefaultExportsArrFilePathToTarget,
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });
  });

  // import defaultExport from './index';
  // export { defaultExport };
  // should not be transformed to:
  // import { newName } from './index';
  // export { newName };
  // it should be transformed to:
  // import { newName } from './index';
  // export { newName as defaultExport };
  // to not break the rest of the code
  describe('should transform: importDefaultExportAsNamed', () => {
    const newName = 'NameTest';
    const exportsNamesArr = [[targetFilePath, newName]] satisfies ExportsNamesArr;
    const defaultImportsArr = [[filePath, [targetFilePath]]] satisfies DefaultImportsArr;

    test('preserved', () => {
      const resultCode = buildCodeFromLines(
        `import { ${newName} as Test1, anythingElse } from '${targetFilePath}';`,
        `export { anythingElse, Test1 };`,
      );

      const result = transform(
        { path: filePath, source: importDefaultExportAsNamed },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });

    test('not preserved', () => {
      const resultCode = buildCodeFromLines(
        `import { ${newName} as Test1, anythingElse } from '${targetFilePath}';`,
        `export { anythingElse, Test1 };`,
      );

      const result = transform(
        { path: filePath, source: importDefaultExportAsNamed },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });
  });

  describe('transform with already used new name', () => {
    const newName = 'NameTest';
    const newName2 = 'OldDefaultName2';
    const filePathNewName = 'customComponents';
    const exportsNamesArr = [
      [targetFilePath, newName],
      [filePath, 'customComponents'],
      [targetFilePath2, newName2],
    ] satisfies ExportsNamesArr;
    const defaultImportsArr = [[filePath, [targetFilePath]]] satisfies DefaultImportsArr;

    test('should transform named import', () => {
      const resultCode = buildCodeFromLines(
        `import { ${newName} as Test1, anythingElse } from '${targetFilePath}';`,
        `const ${newName} = 123;`,
        `console.log("newName is already used: ${newName}, but it is new: ", Test1);`,
      );

      const result = transform(
        {
          path: filePath,
          source: buildCodeFromLines(
            `import Test1, { anythingElse } from '${targetFilePath}';`,
            `const ${newName} = 123;`,
            `console.log("newName is already used: ${newName}, but it is new: ", Test1);`,
          ),
        },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });

    test('should transform default import and export without alias', () => {
      const resultCode = buildCodeFromLines(
        `import { ${newName} as OldDefaultName } from '${targetFilePath}';`,
        '',
        `export const customComponents = {`,
        `  OldDefaultName`,
        `};`,
      );

      const result = transform(
        {
          path: filePath,
          source: buildCodeFromLines(
            `import OldDefaultName from '${targetFilePath}';`,
            `export default {`,
            `OldDefaultName,`,
            `};`,
          ),
        },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });

    test('should transform default import and export with alias', () => {
      const exportsNamesArr = [
        [targetFilePath, newName],
        [filePath, newName],
      ] satisfies ExportsNamesArr;

      const resultCode = buildCodeFromLines(
        `import { ${newName} as OldDefaultName } from '${targetFilePath}';`,
        '',
        `export const ${newName} = {`,
        `  OldDefaultName`,
        `};`,
      );

      const result = transform(
        {
          path: filePath,
          source: buildCodeFromLines(
            `import OldDefaultName from '${targetFilePath}';`,
            `export default {`,
            `OldDefaultName,`,
            `};`,
          ),
        },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });

    test('should transform to old names', () => {
      const exportsNamesArr = [
        [targetFilePath, newName],
        [targetFilePath2, newName],
        [targetFilePath3, newName],
      ] satisfies ExportsNamesArr;

      const resultCode = buildCodeFromLines(
        `import { ${newName} as OldDefaultName } from '${targetFilePath}';`,
        `import { ${newName} as OldDefaultName2 } from '${targetFilePath2}';`,
        `import { ${newName} as OldDefaultName3 } from '${targetFilePath3}';`,
      );

      const result = transform(
        {
          path: filePath,
          source: buildCodeFromLines(
            `import OldDefaultName from '${targetFilePath}';`,
            `import OldDefaultName2 from '${targetFilePath2}';`,
            `import OldDefaultName3 from '${targetFilePath3}';`,
          ),
        },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });

    test('should transform default import and export with alias var2', () => {
      const resultCode = buildCodeFromLines(
        `import { ${newName} as OldDefaultName } from '${targetFilePath}';`,
        `import { ${newName2} } from '${targetFilePath2}';`,

        `const ${newName} = 123;`,

        `console.log(${newName2});`,

        '',

        `export const ${filePathNewName} = {`,
        `  OldDefaultName,`,
        `  ${newName2},`,
        `  ${newName}: 123`,
        `};`,
      );

      const result = transform(
        {
          path: filePath,
          source: buildCodeFromLines(
            `import OldDefaultName from '${targetFilePath}';`,
            `import ${newName2} from '${targetFilePath2}';`,

            `const ${newName} = 123;`,

            `console.log(${newName2});`,

            `export default {`,
            `OldDefaultName,`,
            `${newName2},`,
            `${newName}: 123`,
            `};`,
          ),
        },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });

    test('should transform aliases in another object', () => {
      const resultCode = buildCodeFromLines(
        `import { ${newName2} as OldDefaultName } from '${targetFilePath2}';`,

        `const ${newName2} = 123;`,

        `const something = useMemo(() => {`,
        ` return {`,
        `   OldDefaultName,`,
        `   Menu,`,
        `   MenuList,`,
        ` };`,
        `}, [OldDefaultName]);`,
      );

      const result = transform(
        {
          path: filePath,
          source: buildCodeFromLines(
            `import OldDefaultName from '${targetFilePath2}';`,

            `const ${newName2} = 123;`,

            `const something = useMemo(() => {`,
            ` return {`,
            `   OldDefaultName,`,
            `   Menu,`,
            `   MenuList,`,
            ` };`,
            `}, [OldDefaultName]);`,
          ),
        },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });

    test('should transform without aliases when it used only as values', () => {
      const resultCode = buildCodeFromLines(
        `import { ${newName2} } from '${targetFilePath2}';`,

        `const something = useMemo(() => {`,
        ` return {`,
        `   ${newName2},`,
        `   Test: ${newName2},`,
        ` };`,
        `}, []);`,
      );

      const result = transform(
        {
          path: filePath,
          source: buildCodeFromLines(
            `import ${newName2} from '${targetFilePath2}';`,

            `const something = useMemo(() => {`,
            ` return {`,
            `   ${newName2},`,
            `   Test: ${newName2},`,
            ` };`,
            `}, []);`,
          ),
        },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });

    test('should transform default export', () => {
      const resultCode = buildCodeFromLines(
        `const ${filePathNewName} = () => {}`,

        `const ${filePathNewName + 'Alias'} = connect()();`,

        `export { ${filePathNewName + 'Alias'} as ${filePathNewName} };`,
      );

      const result = transform(
        {
          path: filePath,
          source: buildCodeFromLines(
            `const ${filePathNewName} = () => {}`,

            `export default connect()();`,
          ),
        },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });

    test('should transform default export for class', () => {
      const resultCode = buildCodeFromLines(
        `class ${filePathNewName} {}`,

        `const ${filePathNewName + 'Alias'} = connect()(${filePathNewName});`,

        `export { ${filePathNewName + 'Alias'} as ${filePathNewName} };`,
      );

      const result = transform(
        {
          path: filePath,
          source: buildCodeFromLines(
            `class ${filePathNewName} {}`,

            `export default connect()(${filePathNewName});`,
          ),
        },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });

    test('should transform default export for class with HOCs and preservedDefaultExport', () => {
      const resultCode = buildCodeFromLines(
        `class ${filePathNewName} {}`,
        '',
        `const ${filePathNewName + 'Alias'} = connect(`,
        `{},`,
        `{},`,
        `)(withHOC(${filePathNewName}));`,
        '',
        `export { ${filePathNewName + 'Alias'} as ${filePathNewName} };`,
        `export default ${filePathNewName + 'Alias'};`,
      );

      const result = transform(
        {
          path: filePath,
          source: buildCodeFromLines(
            `class ${filePathNewName} {}`,
            `export default connect(`,
            `{},`,
            `{},`,
            `)(withHOC(${filePathNewName}));`,
          ),
        },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });

    test('should transform default export with preservedDefaultExport: literal', () => {
      const resultCode = buildCodeFromLines(
        `export const ${filePathNewName} = 123;`,
        `export default ${filePathNewName};`,
      );

      const result = transform(
        {
          path: filePath,
          source: buildCodeFromLines(`export default 123;`),
        },
        { jscodeshift: j, j, stats, report },
        {
          exportsNamesArr,
          preservedDefaultExportsArr: [filePath],
          _extensions,
          proxyDefaultExportsArr: [],
          defaultImportsArr,
        },
      );

      equal(result, resultCode);
    });
  });

  // TODO: cover this case
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
  //         proxyDefaultExportsArr: [],
  //         defaultImportsArr: [],
  //       },
  //     );

  //     equal(result, resultCode);
  //   });

  // test('should transform in proxy file', () => {
  //   const resultCode = buildCodeFromLines(
  //     `import * as all from '${targetFilePath}';`,
  //     `console.log(all.${newName})`,
  //   );

  //   const result = transform(
  //     {
  //       path: filePath,
  //       source: buildCodeFromLines(
  //         `import * as all from '${targetFilePath}';`,
  //         'console.log(all.default);',
  //       ),
  //     },
  //     { jscodeshift: j, j, stats, report },
  //     {
  //       exportsNamesArr,
  //       preservedDefaultExportsArr: [filePath],
  //       _extensions,
  //       proxyDefaultExportsArr: [[filePath, '../Test/index.ts'], ['../Test/index.ts', '../targetFile.ts']],
  //       defaultImportsArr: [],
  //     },
  //   );

  //   equal(result, resultCode);
  // });

  // test('should not transform: does not have new name', () => {
  //   const code = buildCodeFromLines(
  //     `import * as all from '${targetFilePath}';`,
  //     'console.log(all.default);',
  //   );

  //   const result = transform(
  //     {
  //       path: filePath,
  //       source: code,
  //     },
  //     { jscodeshift: j, j, stats, report },
  //     {
  //       exportsNamesArr: [],
  //       preservedDefaultExportsArr: [filePath],
  //       _extensions,
  //       proxyDefaultExportsArr: [],
  //       defaultImportsArr: [],
  //     },
  //   );

  //   equal(result, code);
  // });
  // });
});
