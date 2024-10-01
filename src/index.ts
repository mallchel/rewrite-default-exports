import 'dotenv/config';
// @ts-expect-error
import resolve from 'resolve/sync';
import { run as jscodeshiftRun } from 'jscodeshift/src/Runner';
// @ts-expect-error
import tsOptions from 'jscodeshift/parser/tsOptions';
import { debugLog, readFrom, writeTo } from './utils';
import type {
  DefaultImportsArr,
  ExportsNamesArr,
  PreservedDefaultExportsArr,
  ProxyDefaultExportsArr,
} from './types';
import {
  defaultImportsFileName,
  exportsNamesFileName,
  preservedDefaultExportsFileName,
  proxyExportsFileName,
} from './const';

// TODO: patch, waiting for babel-parser 8 with default true for this option
tsOptions.createImportExpressions = true;

const gatherInfoPath = resolve('./gatherInfo', {
  extensions: ['.ts', '.js'],
});
const transformPath = resolve('./transform', {
  extensions: ['.ts', '.js'],
});

const { ENTRY, EXTENSIONS = '.js,.jsx,.ts,.tsx' } = process.env;
const extensions = EXTENSIONS.split(',');

debugLog('entryFile', { ENTRY, extensions });

export const runGatherInfo = async () => {
  const entryFile = resolve(ENTRY!, {
    basedir: process.cwd(),
    extensions,
    includeCoreModules: false,
    preserveSymlinks: false,
  });

  // data set 1
  // current filename: [filenames (with default export)]
  const defaultImports = new Map<string, Set<string>>();
  // data set 2
  // filename: new name of export
  const exportsNames = new Map<string, string>();
  // data set 3
  // files where we have to leave default export next to named export
  // because it might be dynamically imported with some tools that require default export
  const preservedDefaultExports = new Set<string>();
  // data set 4
  // current file -> to file
  const proxyDefaultExports = new Map<string, string>();

  await jscodeshiftRun(gatherInfoPath, [entryFile], {
    print: true,
    verbose: true,
    // we should gather all imports from entry points
    // so we don't have to use multithreading
    runInBand: true,
    defaultImports,
    exportsNames,
    preservedDefaultExports,
    proxyDefaultExports,
    _extensions: extensions,
    parser: 'tsx',
  });

  debugLog('before transform', {
    preservedDefaultExports,
    defaultImports,
    proxyDefaultExports,
    exportsNames,
  });

  writeTo({
    fileName: defaultImportsFileName,
    data: defaultImports,
  });
  writeTo({ fileName: proxyExportsFileName, data: proxyDefaultExports });
  writeTo({ fileName: exportsNamesFileName, data: exportsNames });
  writeTo({
    fileName: preservedDefaultExportsFileName,
    data: preservedDefaultExports,
  });
};

export const runTransform = async () => {
  const defaultImportsArr: DefaultImportsArr = readFrom({ fileName: defaultImportsFileName });
  const exportsNamesArr: ExportsNamesArr = readFrom({ fileName: exportsNamesFileName });
  const preservedDefaultExportsArr: PreservedDefaultExportsArr = readFrom({
    fileName: preservedDefaultExportsFileName,
  });
  const proxyDefaultExportsArr: ProxyDefaultExportsArr = readFrom({
    fileName: proxyExportsFileName,
  });

  debugLog('runTransform', {
    exportsNamesArr,
    preservedDefaultExportsArr,
    defaultImportsArr,
  });

  const jsCodeShiftOptions = {
    print: true,
    verbose: true,
    exportsNamesArr,
    preservedDefaultExportsArr,
    defaultImportsArr,
    proxyDefaultExportsArr,
    _extensions: extensions,
    parser: 'tsx',
    dry: false,
  };

  await jscodeshiftRun(
    transformPath,
    [
      ...new Set([
        ...exportsNamesArr.map(([filename]) => filename).flat(),
        ...defaultImportsArr.map((item) => item[0]),
        ...proxyDefaultExportsArr.map((item) => item[0]),
      ]),
    ],
    jsCodeShiftOptions,
  );
};

if (process.env.IS_GATHER_INFO) {
  runGatherInfo();
}

if (process.env.IS_TRANSFORM) {
  runTransform();
}

// TODO: write script to transform other directories with already known default exports
