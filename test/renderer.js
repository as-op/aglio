const aglio = require('../lib/main');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const drafter = require('drafter.js');
const sinon = require('sinon');

const root = path.dirname(__dirname);
const blueprint = fs.readFileSync(path.join(root, 'example.apib'), 'utf-8');

describe('API Blueprint Renderer', function () {
	it('Should load the default theme', function () {
		const theme = aglio.getTheme('default');

		return assert.ok(theme);
	});

	it('Should get a list of included files', function () {
		sinon
			.stub(fs, 'readFileSync')
			.callsFake(() => 'I am a test file');

		const input = `\
# Title
<!-- include(test1.apib) -->
Some content...
<!-- include(test2.apib) -->
More content...\
`;

		const paths = aglio.collectPathsSync(input, '.');

		fs.readFileSync.restore();

		assert.equal(paths.length, 2);
		assert(Array.from(paths).includes('test1.apib'));
		return assert(Array.from(paths).includes('test2.apib'));
	});

	it('Should render blank string', function (done) {
		aglio.render('', {template: 'default', locals: {foo: 1}}, function (err, html) {
			if (err) {
				return done(err);
			}

			assert(html);

			return done();
		});
	});

	it('Should render a complex document', function (done) {
		aglio.render(blueprint, 'default', function (err, html) {
			if (err) {
				return done(err);
			}

			assert(html);

			// Ensure include works
			assert(html.indexOf('This is content that was included'));

			return done();
		});
	});

	it('Should render mixed line endings and tabs properly', function (done) {
		const temp = '# GET /message\r\n+ Response 200 (text/plain)\r\r\t\tHello!\n';
		aglio.render(temp, 'default', done);
	});

	it('Should render a custom template by filename', function (done) {
		const template = path.join(root, 'test', 'test.pug');
		aglio.render('# Blueprint', template, function (err, html) {
			if (err) {
				return done(err);
			}

			assert(html);

			return done();
		});
	});

	it('Should return warnings with filtered input', function (done) {
		const temp = '# GET /message\r\n+ Response 200 (text/plain)\r\r\t\tHello!\n';
		const filteredTemp = temp.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');

		aglio.render(temp, 'default', function (err, html, warnings) {
			if (err) {
				return done(err);
			}

			assert.equal(filteredTemp, warnings.input);

			return done();
		});
	});

	it('Should render from/to files', function (done) {
		const src = path.join(root, 'example.apib');
		const dest = path.join(root, 'example.html');
		aglio.renderFile(src, dest, {}, done);
	});

	it('Should render from stdin', function (done) {
		sinon
			.stub(process.stdin, 'read')
			.callsFake(() => '# Hello\n');

		setTimeout(() => process.stdin.emit('readable', 1));

		aglio.renderFile('-', 'example.html', 'default', function (err) {
			if (err) {
				return done(err);
			}

			assert(process.stdin.read.called);
			process.stdin.read.restore();
			process.stdin.removeAllListeners();

			return done();
		});
	});

	it('Should render to stdout', function (done) {
		sinon.stub(console, 'log');

		aglio.renderFile(path.join(root, 'example.apib'), '-', 'default', function (err) {
			if (err) {
				console.log.restore();
				return done(err);
			}

			assert(console.log.called);
			console.log.restore();

			return done();
		});
	});

	it('Should compile from/to files', function (done) {
		const src = path.join(root, 'example.apib');
		const dest = path.join(root, 'example-compiled.apib');
		aglio.compileFile(src, dest, done);
	});

	it('Should compile from stdin', function (done) {
		sinon
			.stub(process.stdin, 'read')
			.callsFake(() => '# Hello\n');

		setTimeout(() => process.stdin.emit('readable', 1));

		aglio.compileFile('-', 'example-compiled.apib', function (err) {
			if (err) {
				return done(err);
			}

			assert(process.stdin.read.called);
			process.stdin.read.restore();
			process.stdin.removeAllListeners();

			return done();
		});
	});

	it('Should compile to stdout', function (done) {
		sinon.stub(console, 'log');

		aglio.compileFile(path.join(root, 'example.apib'), '-', function (err) {
			if (err) {
				return done(err);
			}

			assert(console.log.called);
			console.log.restore();

			return done();
		});
	});

	it('Should support legacy theme names', function (done) {
		aglio.render('', {template: 'flatly'}, function (err, html) {
			if (err) {
				return done(err);
			}
			assert(html);
			done();
		});
	});

	it('Should error on missing input file', function (done) {
		aglio.renderFile('missing', 'output.html', 'default', function (err, html) {
			assert(err);

			aglio.compileFile('missing', 'output.apib', function (err) {
				assert(err);
				done();
			});
		});
	});

	it('Should error on bad template', function (done) {
		aglio.render(blueprint, 'bad', function (err, html) {
			assert(err);
			done();
		});
	});

	it('Should error on drafter failure', function (done) {
		sinon
			.stub(drafter, 'parse')
			.callsFake((content, options, callback) => callback('error'));

		aglio.render(blueprint, 'default', function (err, html) {
			assert(err);
			drafter.parse.restore();
			done();
		});
	});

	it('Should error on file read failure', function (done) {
		sinon
			.stub(fs, 'readFile')
			.callsFake((filename, options, callback) => callback('error'));

		aglio.renderFile('foo', 'bar', 'default', function (err, html) {
			assert(err);
			fs.readFile.restore();
			done();
		});
	});

	it('Should error on file write failure', function (done) {
		sinon
			.stub(fs, 'writeFile')
			.callsFake((filename, data, callback) => callback('error'));
		aglio.renderFile('foo', 'bar', 'default', function (err, html) {
			assert(err);
			fs.writeFile.restore();
			done();
		});
	});

	return it('Should error on non-file failure', function (done) {
		sinon
			.stub(aglio, 'render')
			.callsFake((content, template, callback) => callback('error'));

		aglio.renderFile(path.join(root, 'example.apib'), 'bar', 'default', function (err, html) {
			assert(err);

			aglio.render.restore();

			return done();
		});
	});
});
