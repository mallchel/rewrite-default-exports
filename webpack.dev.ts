import webpackConfig from './webpack.base';

const devConfig = {
  ...webpackConfig,
  devtool: 'inline-source-map',
  mode: 'development',
  devServer: {
    static: './public',
  },
} as const;

export default devConfig;
