const aglio = require('../lib/main');
const assert = require('assert');
const bin = require('../lib/bin');
const fs = require('fs');
const http = require('http');
const path = require('path');
const sinon = require('sinon');

const root = path.dirname(__dirname);

describe('Executable', function () {
	it('Should print a version', function (done) {
		sinon.stub(console, 'log');
		bin.run({version: true}, function (err) {
			assert(console.log.args[0][0].match(/aglio \d+/));
			console.log.restore();
			done(err);
		});
	});

	it('Should render a file', function (done) {
		sinon.stub(console, 'error');
		sinon
			.stub(aglio, 'renderFile')
			.callsFake(function (i, o, t, callback) {
				const warnings = [
					{
						code: 1,
						message: 'Test message',
						location: [
							{
								index: 0,
								length: 1
							}
						]
					}
				];
				warnings.input = 'test';
				callback(null, warnings);
			});

		bin.run({}, err => assert(err));

		bin.run({i: path.join(root, 'example.apib'), o: '-'}, function () {
			console.error.restore();
			aglio.renderFile.restore();
			done();
		});
	});

	it('Should compile a file', function (done) {
		sinon
			.stub(aglio, 'compileFile')
			.callsFake((i, o, callback) => callback(null));

		bin.run({c: 1, i: path.join(root, 'example.apib'), o: '-'}, function () {
			aglio.compileFile.restore();
			done();
		});
	});

	it('Should start a live preview server', function (done) {
		this.timeout(process.env.npm_package_config_coverage_timeout || 5000);

		sinon
			.stub(aglio, 'render')
			.callsFake((i, t, callback) => callback(null, 'foo'));

		sinon
			.stub(http, 'createServer')
			.callsFake(handler => ({
				listen (port, host, cb) {
					console.log('calling listen');
					// Simulate requests
					let req = {url: '/favicon.ico'};
					let res = {
						end (data) {
							return assert(!data);
						}
					};
					handler(req, res);
					req = {url: '/'};
					res = {
						writeHead (status, headers) {
							return false;
						},
						end (data) {
							aglio.render.restore();
							cb();
							const file = fs.readFileSync('example.apib', 'utf8');
							return setTimeout(function () {
								fs.writeFileSync('example.apib', file, 'utf8');
								return setTimeout(function () {
									console.log.restore();
									return done();
								}
								, 500);
							}
							, 500);
						}
					};
					return handler(req, res);
				}
			}));

		sinon.stub(console, 'log');
		sinon.stub(console, 'error');

		bin.run({s: true}, function (err) {
			console.error.restore();
			assert(err);

			bin.run({i: path.join(root, 'example.apib'), s: true, p: 3000, h: 'localhost'}, function (err) {
				assert.equal(err, null);
				if (bin.live.watcher) {
					bin.live.watcher.close(); // TODO: close is async
				}
				http.createServer.restore();
			});
		});
	});

	it('Should support custom Jade template shortcut', function (done) {
		sinon.stub(console, 'log');
		bin.run({i: path.join(root, 'example.apib'), t: 'test.jade', o: '-'}, function (err) {
			console.log.restore();
			done(err);
		});
	});

	it('Should handle theme load errors', function (done) {
		sinon.stub(console, 'error');
		sinon
			.stub(aglio, 'getTheme')
			.callsFake(function () {
				throw new Error('Could not load theme');
			});

		bin.run({template: 'invalid'}, function (err) {
			console.error.restore();
			aglio.getTheme.restore();
			assert(err);
			done();
		});
	});

	return it('Should handle rendering errors', function (done) {
		sinon
			.stub(aglio, 'renderFile')
			.callsFake((i, o, t, callback) => callback({
				code: 1,
				message: 'foo',
				input: 'foo bar baz',
				location: [
					{index: 1, length: 1}
				]
			}));

		sinon.stub(console, 'error');

		bin.run({i: path.join(root, 'example.apib'), o: '-'}, function () {
			assert(console.error.called);
			console.error.restore();
			aglio.renderFile.restore();
			done();
		});
	});
});
