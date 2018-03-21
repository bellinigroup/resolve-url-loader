'use strict';

const path = require('path');
const sassLoader = require.resolve('sass-loader');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const extractSass = new ExtractTextPlugin({
  filename: '[name].[contenthash].css',
  disable: false
});

module.exports = {
  entry: path.join(__dirname, process.env.ENTRY),
  output: {
    path: path.join(__dirname, path.dirname(process.env.OUTPUT)),
    filename: path.basename(process.env.OUTPUT)
  },
  devtool: 'source-map',
  module: {
    rules: [{
      test: /\.scss$/,
      use: extractSass.extract({
        use: [{
          loader: 'css-loader',
          options: {
            sourceMap: true
          }
        }, {
          loader: 'resolve-url-loader',
          options: JSON.parse(process.env.OPTIONS)
        }, {
          loader: sassLoader,
          options: {
            sourceMap: true,
            sourceMapContents: false
          }
        }]
      })
    }, {
      test: /\.woff2?$|\.ttf$|\.eot$|\.svg|\.jpg$/,
      use: [{
        loader: 'file-loader'
      }]
    }]
  },
  plugins: [
    extractSass
  ]
};
