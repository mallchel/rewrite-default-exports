import 'dotenv/config';
// @ts-expect-error
import resolve from 'resolve/sync';
import { run as jscodeshiftRun } from 'jscodeshift/src/Runner';
// @ts-expect-error
import tsOptions from 'jscodeshift/parser/tsOptions';
import { debugLog, readFrom, writeTo } from './utils';
import { writeFileSync } from 'node:fs';
import type {
  DefaultImportsArr,
  ExportsNamesArr,
  PreservedDefaultExportsArr,
  ProxyExportsArr,
} from './types';

// ENTRY="./packages/app/client" EXTENSIONS=".js,.ts,.tsx,.jsx" yarn replace-watch

// TODO: patch, waiting for babel-parser 8 with default true for this option
tsOptions.createImportExpressions = true;

const gatherInfoPath = resolve('./gatherInfo', {
  extensions: ['.ts'],
});
const transformPath = resolve('./transform', {
  extensions: ['.ts'],
});

// TODO: move to const
const defaultImportsFileName = 'dump/defaultImports.json';
const proxyExportsFileName = 'dump/proxyExports.json';
const exportsNamesFileName = 'dump/exportsNames.json';
const preservedDefaultExportsFileName = 'dump/preservedDefaultExports.json';

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
  const proxyExports = new Map<string, string>();

  await jscodeshiftRun(gatherInfoPath, [entryFile], {
    print: true,
    verbose: true,
    // we should gather all imports from entry points
    // so we don't have to use multithreading
    runInBand: true,
    defaultImports,
    exportsNames,
    preservedDefaultExports,
    proxyExports,
    _extensions: extensions,
    parser: 'tsx',
  });

  debugLog('before transform', {
    preservedDefaultExports,
    defaultImports,
    proxyExports,
    exportsNames,
  });

  writeTo({
    fileName: defaultImportsFileName,
    data: defaultImports,
  });
  writeTo({ fileName: proxyExportsFileName, data: proxyExports });
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
  const proxyExportsArr: ProxyExportsArr = readFrom({
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
    proxyExportsArr,
    _extensions: extensions,
    parser: 'tsx',
  };

  await jscodeshiftRun(
    transformPath,
    [
      ...new Set([
        ...exportsNamesArr.map(([filename]) => filename).flat(),
        ...defaultImportsArr.map((item) => item[0]),
        ...proxyExportsArr.map((item) => item[0]),
      ]),
    ],
    jsCodeShiftOptions,
  );
};

// runGatherInfo();

runTransform();

// TODO: write script to transform other directories with only known default exports
