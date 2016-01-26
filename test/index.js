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
  var server;
  var test;
  var app;

  before(function(done){
    app = express();
    app.use(express.bodyParser());
    server = app.listen(4000, done);
  });

  after(function(done){
    server.close(done);
  });

  beforeEach(function(){
    settings = {
      workflows: [
        'http://localhost:4000'
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

      it('should have a real, living API endpoint (a health check workflow)', function (done) {
        var data = 
          test
          .set({
            workflows: [
              'https://507f1352-cbc7-4abb-8dd2-538d3c09787d.trayapp.io'
            ]
          })
          [type](json.input)
          .expects(200)
          .end(done);
      });


      it('should succeed on valid call', function(done){
        var route = '/' + type + '/success';
        settings.workflows = settings.workflows.map(function(workflow){
           return workflow + route;
        });

        app.post(route, function(req, res){
          assert.deepEqual(req.body, json.output);
          res.send(200);
        });

        test
          .set(settings)
          [type](json.input)
          .expects(200)
          .end(done);
      });

      it('should send to multiple workflow urls', function(done){
        var path1 = '/' + type + '/success';
        var path2 = '/' + type + '/error';

        var route1 = 'http://localhost:4000' + path1;
        var route2 = 'http://localhost:4000' + path2;

        // route1 is explicitly twice to test when there is a bad workflow.
        settings.workflows = [route1, route2, route1];

        app.post(path1, function(req, res){
          assert.deepEqual(req.body, json.output);
          res.send(200);
        });
        app.post(path2, function(req, res){
          assert.deepEqual(req.body, json.output);
          res.send(503);
        });

        test
          .set(settings)
          .requests(3)
          [type](json.input);

        test
          .request(0)
          .expects(200);

        test
          .request(1)
          .expects(503);

        test
          .request(2)
          .expects(200);

        test.end(done);
      });

      it('should send to just the one workflow', function(done){
        var path = '/' + type + '/success';
        var route = 'http://localhost:4000' + path;

        settings.workflows = [route];

        app.post(path, function(req, res){
          assert.deepEqual(req.body, json.output);
          res.send(200);
        });

        test
          .set(settings)
          .requests(1)
          [type](json.input);

        test.end(done);
      });

      it('should send to max 10 workflows', function(done){
        var path = '/' + type + '/success';
        var route = 'http://localhost:4000' + path;

        settings.workflows = [route, route, route, route, route, route, route, route, route, route, route, route];

        app.post(path, function(req, res){
          assert.deepEqual(req.body, json.output);
          res.send(200);
        });

        test
          .set(settings)
          .requests(10)
          [type](json.input);

        test.end(done);
      });

      it('should fail when all workflows are down', function(done){
        var path1 = '/' + type + '/down'; // not mounted
        var path2 = '/' + type + '/error';

        var route1 = 'http://localhost:4000' + path1;
        var route2 = 'http://localhost:4000' + path2;

        settings.workflows = [route1, route2];

        app.post(path2, function(req, res){
          assert.deepEqual(req.body, json.output);
          res.send(503);
        });

        test
          .set(settings)
          .requests(2)
          [type](json.input);

        test
          .request(0)
          .expects(404);

        test
          .request(1)
          .expects(503);

        test.error(done);
      });

      it('should error on invalid calls', function(done){
        var route = '/' + type + '/error';
        settings.workflows = settings.workflows.map(function(workflow){
           return workflow + route;
        });

        app.post(route, function(req, res){
          assert.deepEqual(req.body, json.output);
          res.send(503);
        });

        test
          .set(settings)
          [type](json.input)
          .expects(503)
          .error(done);
      });

      it('should ignore bad reply', function(done){
        var route = '/bad';
        settings.workflows = settings.workflows.map(function(workflow){
           return workflow + route;
        });

        app.post(route, function(req, res){
          res.set('Content-Type', 'application/json');
          res.send(200, 'I lied, this is not JSON');
        });

        test
          .set(settings)
          [type](json.input)
          .expects(200)
          .end(done);
      });

      it('should attach an HMAC digest when options.sharedSecret is present', function(done){
        var route = '/' + type;
        settings.workflows = settings.workflows.map(function(workflow){
           return workflow + route;
        });
        settings.sharedSecret = 'teehee';

        app.post(route, function(req, res){
          var signature = req.headers['x-signature'];
          var digest = crypto
            .createHmac('sha1', settings.sharedSecret)
            .update(JSON.stringify(req.body))
            .digest('hex');

          assert(signature);
          assert(signature === digest);

          res.send(200);
        });

        test
          .set(settings)
          [type](json.input)
          .expects(200)
          .end(done);
      });

      // TODO: test limit
    });
  });
});
