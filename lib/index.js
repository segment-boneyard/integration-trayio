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

var Tray = module.exports = integration('tray.io')
  .channels(['server', 'mobile', 'client']);

Tray.ensure(function(msg, settings){
  if (settings.workflows && Array.isArray(settings.workflows)) return; 
  return this.invalid('settings.workflows must be an array');
});

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
  var workflows = self.settings.workflows.slice(0, 10);
  var validWorkflows = workflows.filter(isUrl); // TODO also filter for valid tray workflow urls
  validWorkflows.forEach(function(hook){
    batch.push(function(done){
      var req = self
        .post(hook)
        .type('json')
        .send(body);

      if (digest) req.set('X-Signature', digest);

      req.end(function(err, res) {
        done(null, { res, err });
      });
    });
  });

  batch.end(function(err, responses){
    if (err) return done(err);
    var badResponses = responses.filter((res) => res.err);
    self.debug('%d/%d calls failed', badResponses.length, responses.length);

    if (badResponses.length && badResponses.length === responses.length) {
      return done(badResponses[0].err);
    }
    return done(null, responses);
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
