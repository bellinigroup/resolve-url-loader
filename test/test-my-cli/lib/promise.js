'use strict';

const sequence = require('promise-compose');
const {assign} = Object;

/**
 * Perform a promise with logging at start and completion.
 *
 * @param {function} log A log method
 * @returns {function(label:string):function(next:function):function(*):Promise}
 */
exports.withLog = (log) => (label) => (next) => (v) => {
  log(`${label}: start`);
  return Promise.resolve(next(v))
    .then((vv) => {
      log(`${label}: success`);
      return vv;
    })
    .catch((e) => {
      log(`${label}: failure`);
      throw e;
    });
};

/**
 * Perform a promise with timing.
 *
 * @param {function} log A log method
 * @returns {function(next:function):function(*):Promise}
 */
exports.withTime = (log) => (next) => (v) => {
  const start = process.hrtime();
  return Promise.resolve(next(v))
    .then((obj) => {
      const [sec, nanosec] = process.hrtime(start);
      const time = sec + nanosec * 1e-9;
      if (log) {
        log(`time: ${time}`);
      }
      return assign({}, obj, {time});
    });
};

/**
 * Cause the given function to act only on the given fields when invoked.
 *
 * Getter function is `v => vv`. Setter function is `v => vv => v'`.
 *
 * @param {string|function} get The field to get or a getter function
 * @param {string|function} set The field to set or a setter function
 * @return {function(next:function):function(v:*):Promise}
 */
exports.lens = (get, set) => {
  const getter =
    (typeof get === 'string') && ((v) => (v || {})[get]) ||
    (typeof get === 'function') && get ||
    ((v) => v);

  const setter =
    (typeof set === 'string') && ((v) => (vv) => Object.assign({}, v, {[set]: vv})) ||
    (typeof set === 'function') && set ||
    ((v) => () => v);

  return (next) => (v) =>
    Promise.resolve(v)
      .then(getter)
      .then(next)
      .then(setter(v));
};

/**
 * A higher-order-function where the given functions occur before the enhanced function.
 *
 * @param {...function} fns Any number of functions to perform first
 * @return {function(next:function):function(*):Promise}
 */
exports.doFirst = (...fns) => (next) =>
  sequence(...fns, next);

/**
 * A higher-order-function where the given functions occur after the enhanced function.
 *
 * @param {...function} fns Any number of functions to perform last
 * @return {function(next:function):function(*):Promise}
 */
exports.doLast = (...fns) => (next) =>
  sequence(next, ...fns);

/**
 * A higher-order-function where the given functions occur in sequence and their results are
 * accumulated in an array.
 *
 * Each function operates independently on one of the values of the supplied array and the arguments
 * of the overall function.
 *
 * @param {function} fn Any number of functions to execute in sequence
 * @return {function(Array): Promise}
 */
exports.mapSerial = (fn) => (array) =>
  sequence(
    ...array.map((element) =>
      (results) => Promise.resolve(element)
        .then(fn)
        .then((result) => results.concat(result))
    )
  )([]);

/**
 * A higher-order-function where the given functions occur in parallel and their results are
 * accumulated in an array.
 *
 * Each function operates independently on one of the values of the supplied array.
 * *
 * @param {function} fn Any number of functions to execute in sequence
 * @return {function(Array): Promise}
 */
exports.mapParallel = (fn) => (array) =>
  Promise.all(
    array.map((element) => Promise.resolve(element).then(fn))
  );

/**
 * A higher-order-function that always returns a promise to the given value.
 *
 * @param {*} value The value to return
 * @return {function(): Promise}
 */
exports.constant = (value) => () =>
  Promise.resolve(value);

/**
 * A higher-order-function that runs the given test function on given value and returns the
 * original value if the test function passes.
 *
 * @param {function} fn A test function
 * @return {function(*): Promise}
 */
exports.conditional = (fn) => (value) =>
  Promise.resolve(value)
    .then(fn)
    .then((result) => result && value);
