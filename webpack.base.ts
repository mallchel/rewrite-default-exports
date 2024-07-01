import path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { Configuration } from 'webpack';

import { makePlugins } from './src/makePlugins';

const rootPath = path.resolve(process.cwd());
const packagesPaths = new RegExp(rootPath + '/(packages)');
const entryFileName = rootPath + '/packages/app/client.js';
const gatheredComponentsFileName = `${rootPath}/build/assets/gatheredComponentsByFileName.json`;
const outUmlFileName = `${rootPath}/build/assets/treeComponentsUML.json`;

const { babelPlugin, webpackPlugin } = makePlugins({
  packagesPaths,
  entryFileName,
  gatheredComponentsFileName,
  outUmlFileName,
  isGroupByParentDirNeeded: true,
});

export default {
  entry: './packages/app/client.js',
  plugins: [new HtmlWebpackPlugin({ template: './public/index.html' }), webpackPlugin],
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'build'),
    // clean: true,
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '...'],
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            plugins: [babelPlugin],
            presets: [
              ['@babel/preset-typescript'],
              ['@babel/preset-react', { runtime: 'automatic' }],
              ['@babel/preset-env'],
            ],
          },
        },
      },
    ],
  },
} as Configuration;
