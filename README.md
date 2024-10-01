<p align="center">
  <a href="https://www.npmjs.com/package/rewrite-default-exports"><img src="https://img.shields.io/npm/v/rewrite-default-exports?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/rewrite-default-exports"><img src="https://img.shields.io/npm/dm/rewrite-default-exports?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/rewrite-default-exports"><img src="https://img.shields.io/github/stars/mallchel/rewrite-default-exports?style=flat-square"></a>
</p>

## Motivation
One day you might think about using named import and named export instead of default import and default export because it is a well-known best practice.

## How it works
It is divided into two stages:
1. Gather all default imports and exports from entry file
2. Transform all default imports and exports to named exports

It uses jscodeshift (with babel inside) to transform files and the `resolve` package to resolve all imports. It will collect all relations between files and will transform all default imports and exports to named exports.

## How to use it
1. Go to your product
2. `IS_GATHER_INFO=true ENTRY="./path/to/your/entry.js" npx rewrite-default-exports`
3. `IS_TRANSFORM=true ENTRY="./path/to/your/entry.js" npx rewrite-default-exports`

## How to run and see the result as an example
1. download this repo
2. run `yarn`
3. add `.env` file to the root with:
```
DEBUG_APP=true - to see debug logs, by default it is false
ENTRY=./packages/app/client.js - entry file to gather info from
IS_GATHER_INFO=true - to gather info
IS_TRANSFORM=false - to transform files
```
4. run `yarn transform`
5. you will see generated files in src/dump folder
```
defaultImports.json - info about files having used default import
exportsNames.json - info about files having used default export
preservedDefaultExports.json - info about files having been imported via dynamic import
proxyDefaultExports.json - info about files having used default import and having re-exported them with default export
```
6. change in your `.env` file:
```
IS_GATHER_INFO=false
IS_TRANSFORM=true
```
7. run `yarn transform`
8. you will see transformed files in packages folder


### Links
[jscodeshift](https://github.com/facebook/jscodeshift/wiki/jscodeshift-Documentation)
[astexplorer](https://astexplorer.net/)
