'use strict';

var Test = require('segmentio-integration-tester');
var Tray = require('..');
var assert = require('assert');
var crypto = require('crypto');
var express = require('express');

describe('Tray', function(){
  var types = ['track', 'identify', 'alias', 'group', 'page', 'screen'];
  var tray;
  var settings;
  var test;

  beforeEach(function(){
    settings = {
      workflows: [
        'https://dc7f2b63-34f7-4e4e-9359-68bccf1423df.trayapp.io'
      ]
    };
    tray = new Tray(settings);
    test = Test(tray, __dirname);
  });

  it('should have the correct settings', function(){
    test
    .name('Tray')
    .channels(['server', 'mobile', 'client'])
    .timeout('5s')
    .retries(5);
  });

  types.forEach(function(type){
    describe('#' + type, function(){
      var json;

      beforeEach(function(){
        json = test.fixture(type + '-basic');
      });

      it('should successfully send to a workflow', function (done) {
        var data = 
          test[type](json.input)
          .expects(200)
          .end(done);
      });

      it('should send to multiple workflow urls', function(done){
        var goodUrl = 'https://dc7f2b63-34f7-4e4e-9359-68bccf1423df.trayapp.io'
        var badUrl = 'https://507f1352-cbc7-4abb-8dd2-538d3c09787d-12321312.trayapp.io';

        // route1 is explicitly twice to test when there is a bad workflow.
        settings.workflows = [badUrl, goodUrl];

        test
          .set(settings)
          .requests(2)
          [type](json.input);

        test
          .request(0)
          .expects(500);

        test
          .request(1)
          .expects(200);

        test.end(done);
      });

      it('should send to max 10 workflows', function(done){
        var url = 'https://507f1352-cbc7-4abb-8dd2-538d3c09787d.trayapp.io';
        settings.workflows = fill(url, 20);

        test
          .set(settings)
          .requests(10)
          [type](json.input);

        test.end(done);
      });

      it('should fail when all workflows are down', function(done){
        var badUrl = 'https://507f1352-cbc7-4abb-8dd2-538d3c09787d-12321312.trayapp.io';
        settings.workflows = [badUrl, badUrl, badUrl];

        test
          .set(settings)
          [type](json.input);

        test
          .request(0)
          .expects(500);

        test
          .request(1)
          .expects(500);

        test.error(done);
      });

      it('should error on invalid calls', function(done){
        settings.workflows = ['https://507f1352-cbc7-4abb-8dd2-538d3c09787d-123-1231-123.trayapp.io']
        test
          .set(settings)
          [type](json.input)
          .expects(500)
          .error(done);
      });

      it('should attach an HMAC digest when options.sharedSecret is present', function(done){
        var route = '/' + type;
        settings.workflows = settings.workflows.map(function(workflow){
           return workflow + route;
        });
        settings.sharedSecret = 'teehee';

        var digest = crypto
          .createHmac('sha1', settings.sharedSecret)
          .update(JSON.stringify(json.output))
          .digest('hex');

        test
          .set(settings)
          [type](json.input)
          .expects(200)
          .end(function(err, res){
            test
              .request(0)
              .sends('x-signature', digest);
            done();
          });
      });

      // TODO: test limit
    });
  });
});

function fill(item, n){
  var ret = [];
  for (var i = 0; i < n; i++) ret.push(item);
  return ret;
}