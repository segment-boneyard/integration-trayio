'use strict';

/**
 * Module dependencies.
 */

var crypto = require('crypto');
var integration = require('segmentio-integration');
var url = require('url');
var Batch = require('batch');

/**
 * Expose `Tray`
 */

var Tray = module.exports = integration('Tray')
  .channels(['server', 'mobile', 'client'])
  .timeout('5s')
  .retries(5);

/**
 * Expose our methods
 */

Tray.prototype.identify = request;
Tray.prototype.alias = request;
Tray.prototype.group = request;
Tray.prototype.track = request;
Tray.prototype.page = request;
Tray.prototype.screen = request;

/**
 * Request.
 *
 * @param {Facade} message
 * @param {Function} fn
 * @api private
 */

function request(message, done){
  var body = JSON.stringify(message.json());
  var sharedSecret = this.settings.sharedSecret;
  var digest;
  var self = this;

  if (typeof sharedSecret === 'string' && sharedSecret.length) {
    digest = crypto
      .createHmac('sha1', sharedSecret)
      .update(body, 'utf8')
      .digest('hex');
  }

  var batch = new Batch();
  batch.throws(false);

  var workflows = self.settings.workflows.slice(0, 10);
  var validWorkflows = workflows.filter(isUrl); // TODO also filter for valid tray workflow urls
  validWorkflows.forEach(function(hook){
    batch.push(function(done){
      var req = self
        .post(hook)
        .type('json')
        .send(body)
        .parse(ignore);

      if (digest) {
        req.set('X-Signature', digest);
      }

      req.end(self.handle(done));
    });
  });

  batch.end(function(err, results){
    var realErrors = errors.filter(function(error){
      return error !== null;
    });

    // Only fail if all the workflows are down.
    if (realErrors.length === validWorkflows.length) {
      var error = new Error('Batch failed');
      error.errors = realErrors;
      return done(error, results);
    }
    done(null, results);
  });
}

/**
 * Check if the given `value` is a valid url.
 *
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function isUrl(value){
  var parsed = url.parse(String(value));
  return parsed.protocol && parsed.host;
}

/**
 * Ignore is a superagent parser (which segmentio-integration
 * uses under the hood) to just completely ignore the response
 * from the webhook request. This is ideal because we can't
 * rely on content-type header for parsing and more importantly we
 * don't really want to parse an unbound amount of data that
 * the request could respond with.
 */

function ignore(res, fn){
  res.text = '';
  res.on('data', function(){});
  res.on('end', fn);
}
