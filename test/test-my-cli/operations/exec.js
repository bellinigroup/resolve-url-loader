'use strict';

const spawn = require('cross-spawn');
const compose = require('compose-function');
const sequence = require('promise-compose');
const {assign} = Object;

const {joi, getLog} = require('../lib/options');
const {assertContext} = require('../lib/types/assert');
const {indent} = require('../lib/string');
const {withLog, withTime, lens} = require('../lib/promise');

exports.schema = {
  debug: joi.debug().optional()
};

exports.create = (options) => {
  joi.assert(
    options,
    joi.object(assign({}, exports.schema, {
      root: joi.path().absolute().required(),
      onActivity: joi.func().required()
    })).unknown(true).required(),
    'options'
  );

  const {debug, root, onActivity} = options;
  const log = getLog(debug);
  const labelled = withLog(log);
  const logIndented = compose(log, indent(2));
  const timed = withTime(logIndented);

  /**
   * Given a command the method will execute in shell and resolve the results, discarding layers.
   *
   * @param {string} command A shell command
   * @return {function(Array):Array} A pure function of layers
   */
  return (command) => {
    joi.assert(
      command,
      joi.string().min(2).required(),
      'single shell command'
    );

    return compose(labelled('exec'), sequence)(
      onActivity,
      assertContext('exec() needs a preceding init or is otherwise without context'),
      compose(lens('layers', 'exec'), timed)((layers) => {

        // locate cwd (required) and env (optional)
        const {cwd: cwdGetter} = layers.find(({cwd}) => !!cwd) || {};
        const {env: envGetter} = layers.find(({env}) => !!env) || {};
        if (!cwdGetter) {
          throw new Error('There must be a preceding cwd() element before exec()');
        }

        // resolve cwd and env
        const cwd = cwdGetter();
        const env = envGetter ? envGetter() : {};

        logIndented(
          `layer ${layers.length}`,
          `cmd ${JSON.stringify(command)}`,
          `cwd ${JSON.stringify(cwd)}`,
          `env ${JSON.stringify(env)}`
        );

        return new Promise((resolve) => {
          const [cmd, ...args] = command.split(' ');

          const interval = setInterval(onActivity, 50);

          const child = spawn(cmd, args, {cwd, env, shell: true, stdio: 'pipe'});

          let stdout = '';
          child.stdout.on('data', (data) => stdout += data);

          let stderr = '';
          child.stderr.on('data', (data) => stderr += data);

          child.once('close', (code) => {
            clearInterval(interval);
            resolve({root, code, stdout, stderr});
          });

          child.once('error', (error) => {
            clearInterval(interval);
            resolve({root, code: 1, stdout, stderr: error.toString()});
          });
        });
      })
    );
  };
};
