'use strict';

const {join, dirname, basename} = require('path');
const {readFile} = require('fs');
const {promisify} = require('util');
const listDir = require('recursive-readdir');
const {assign} = Object;

const Joi = require('joi');

/**
 * A factory for a higher-order-function that enhances an assert() function with a single file
 * of the given extension.
 *
 * @param {string} ext The extention of the file to locate
 * @param {string} [subdir] A subdirectory of the root
 * @return {function(function)} A higher-order-function of the assert function
 */
exports.withFile = ({ext, subdir}) => (next) => {
  Joi.assert(next, Joi.func().arity(2).required(), 'assert function');
  Joi.assert(subdir, Joi.string().optional(), 'optional subdirectory');

  return (test, {root}) => {
    Joi.assert(test, Joi.object().required(), 'Tape test object');
    Joi.assert(root, Joi.string().required(), 'Root directory');

    const directory = join(root, ...(subdir ? [subdir] : []));
    return listDir(directory)
      .then((list) => list.filter((v) => v.endsWith(`.${ext}`)))
      .then(([path]) => promisify(readFile)(path, 'utf8')
        .then((content) => next(test, {
          path,
          base: dirname(path),
          name: basename(path),
          content
        }))
      );
  };
};

/**
 * A higher-order-function that enhances an assert() function by splitting out sourceMappingUrl
 * comment, where present.
 *
 * Both the `content` and the `sourceMappingUrl` are trimmed.
 *
 * @param {function} next An assert function
 * @return {function} A new assert function
 */
exports.withSourceMappingUrl = (next) => {
  Joi.assert(next, Joi.func().arity(2).required(), 'assert function');

  return (test, {content: raw, ...rest}) => {
    Joi.assert(test, Joi.object().required(), 'Tape test object');
    Joi.assert(raw, Joi.string().required(), 'CSS file contents');

    const [content, sourceMappingURL] = raw
      .split(/^\/\*#\s*sourceMappingURL=([^\*]+)\*\/$/m)
      .map((v) => v.trim());

    return Promise.resolve(
      next(test, assign({}, rest, {content, sourceMappingURL}))
    );
  };
};

/**
 * A higher-order-function that enhances functions for assert() of CSS content and CSS url()
 * file references.
 *
 * @param {...function} assertFns Two assert functions, first for content the second for filenames
 * @return {function} A new assert function
 */
exports.withSplitCssAssets = (...assertFns) => {
  Joi.assert(
    assertFns,
    Joi.array().items(Joi.func().arity(2).required()).min(2).required(),
    'assert functions for files and content'
  );
  const [assertContent, assertFiles] = assertFns;

  return (test, {content: raw, ...rest}) => {
    Joi.assert(test, Joi.object().required(), 'Tape test object');
    Joi.assert(raw, Joi.string().required(), 'CSS file contents');

    const [content, assets] = raw.split(/url\(([^)]+)\)/)
      .reduce(
        ([c, a], v, i) => (i % 2 === 0) ? [`${c}${v}`, a] : [`${c}url($${a.length})`, [...a, v]],
        ['', []]
      );

    return Promise.resolve()
      .then(() => assertContent(test, assign({}, rest, {content})))
      .then(() => assertFiles(test, assign({}, rest, {assets})));
  };
};
