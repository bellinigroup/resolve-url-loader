'use strict';

const sequence = require('promise-compose');
const {assign} = Object;

const {joi, getLog} = require('../lib/options');
const {withLog, lens} = require('../lib/promise');

exports.schema = {
  debug: joi.debug().optional()
};

exports.create = (options) => {
  joi.assert(
    options,
    joi.object(assign({}, exports.schema, {
      onActivity: joi.func().required()
    })).unknown(true).required(),
    'options'
  );

  const {debug, onActivity} = options;
  const log = getLog(debug);
  const labelled = withLog(log);

  /**
   * A signature matching Tape tests that will create a test that passes through the context.
   *
   * @param {string} name The name of the test
   * @param {function} fn The test function
   * @return {function(object):Promise} A pure async function of the outer test
   */
  return (name, fn) => labelled(`test: ${name}`)(
    ({test: test0, layers: layers0}) => {

      const innerTestWithOuterLayers = (test1) =>
        ({test: test1, layers: layers0});

      const outerTestWithInnerLayers = () => ({layers: layers2}) =>
        ({test: test0, layers: layers2});

      // keep the instance alive
      onActivity();

      // fix race condition with blue-tape ending the test before next test is defined
      //  (testing shows 5ms should be enough but use 20ms to be sure)
      const waitToEnd = sequence(
        () => log(`test: ${name}: waiting to end`),
        () => new Promise(resolve => setTimeout(resolve, 20)),
        () => log(`test: ${name}: actual end`)
      );

      return new Promise((resolve, reject) => test0.test(
        `${test0.name}/${name}`,
        (t) => Promise.resolve(t)
          .then(onActivity)
          .then(lens(innerTestWithOuterLayers, outerTestWithInnerLayers)(fn))
          .then(resolve)
          .catch(reject)
          .then(waitToEnd)
        )
      );
    });
};
