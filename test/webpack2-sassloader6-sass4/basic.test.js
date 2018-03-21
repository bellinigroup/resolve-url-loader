'use strict';

const {basename, dirname, join} = require('path');
const {existsSync} = require('fs');
const outdent = require('outdent');
const compose = require('compose-function');
const sequence = require('promise-compose');
const {withFile, withSourceMappingUrl, withSplitCssAssets} = require('../helper');

const NAME = basename(__dirname);

const {init, test, layer, unlayer, fs, env, cwd, exec, assert} = require('../test-my-cli')({
  directory: [join(__dirname, '..'), 'tmp', NAME],
  ttl: '1s',
  debug: false,
  env: {append: ['PATH']},
  unlayer: {inhibit: false}
});

const assertCss = compose(
  assert,
  withFile({ext: 'css', subdir: 'build'}),
  withSourceMappingUrl,
  withSplitCssAssets
);

const npmInstall = sequence(
  layer(
    env({PATH: dirname(process.execPath)}),
    fs({
      'package.json': require.resolve('./package.json'),
      'webpack.config.js': require.resolve('./webpack.config.js')
    }),
    cwd('.'),
    exec('npm install'),
    fs({
      'node_modules/resolve-url-loader': join(__dirname, '..', '..')
    })
  ),
  assert(({pass, fail}, {code, stderr}) => (code === 0) ? pass('npm install') : fail(stderr))
);

const layerImmediatePath = layer(
  fs({
    'src/index.scss': outdent`
      @import "feature/index.scss";
      `,
    'src/feature/index.scss': outdent`
      .someclassname {
        single-quoted: url('./a.jpg');
        double-quoted: url("./a.jpg");
        unquoted: url(./a.jpg);
        query: url(./a.jpg?query);
        hash: url(./a.jpg#hash);
      }
      `,
    'src/feature/a.jpg': require.resolve('../assets/blank.jpg'),
    'src/feature/images/b.jpg': require.resolve('../assets/blank.jpg'),
    'build': null
  }),
  env({
    ENTRY: 'src/index.scss',
    OUTPUT: 'build/[name].js'
  }),
  cwd('.')
);

const layerDeepPath = layer(
  fs({
    'src/index.scss': outdent`
      @import "feature/index.scss";
      `,
    'src/feature/index.scss': outdent`
      .someclassname {
        single-quoted: url('./images/b.jpg');
        double-quoted: url("./images/b.jpg");
        unquoted: url(./images/b.jpg);
        query: url(./images/b.jpg?query);
        hash: url(./images/b.jpg#hash);
      }
      `,
    'src/feature/a.jpg': require.resolve('../assets/blank.jpg'),
    'src/feature/images/b.jpg': require.resolve('../assets/blank.jpg'),
    'build': null
  }),
  env({
    ENTRY: 'src/index.scss',
    OUTPUT: 'build/[name].js'
  }),
  cwd('.')
);

const runDefaultConfiguration = sequence(
  layer(
    env({
      QUERY: '',
      OPTIONS: JSON.stringify({}),
      OUTPUT: 'build/[name].js'
    }),
    exec('npm run webpack')
  ),
  assert(({pass, fail}, {code, stderr}) => (code === 0) ? pass('webpack') : fail(stderr)),
  assertCss(
    ({equal}, {content}) => equal(
      content,
      outdent`
        .someclassname {
          single-quoted: url($0);
          double-quoted: url($1);
          unquoted: url($2);
          query: url($3);
          hash: url($4);
        }
        `,
      'should yield expected CSS'
    ),
    ({equal, ok}, {base, assets}) => {
      equal(assets.length, 5, 'should yield expected number of assets');
      ok(assets.every((v, i, a) => (v === a[0])), 'should be the one asset');
      ok(existsSync(join(base, assets[0])), 'should output the asse');
    }
  ),
  unlayer
);

require('blue-tape')(
  NAME,
  sequence(
    init,
    npmInstall,
    test(
      'immediate path',
      sequence(
        layerImmediatePath,
        test(
          'default configuration',
          runDefaultConfiguration
        ),
        unlayer
      )
    ),
    test(
      'deep path',
      sequence(
        layerDeepPath,
        test(
          'default configuration',
          runDefaultConfiguration
        ),
        unlayer
      )
    ),
    unlayer
  )
);
