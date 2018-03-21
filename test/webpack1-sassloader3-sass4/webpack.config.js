'use strict';

const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = {
  entry: {
    main: path.join(__dirname, process.env.ENTRY)
  },
  output: {
    path: path.join(__dirname, path.dirname(process.env.OUTPUT)),
    filename: path.basename(process.env.OUTPUT)
  },
  devtool: 'source-map',
  module: {
    loaders: [{
      test: /\.scss$/,
      loader: ExtractTextPlugin.extract([
        'css-loader?sourceMap',
        `resolve-url-loader${process.env.QUERY}`,
        'sass-loader?sourceMap&sourceMapContents=false'
      ], {
        id: 'css'
      })
    }, {
      test: /\.(woff2?|ttf|eot|svg|jpg)$/,
      loader: 'file-loader'
    }]
  },
  plugins: [
    new ExtractTextPlugin('css', '[name].[md5:contenthash:hex].css')
  ]
};
