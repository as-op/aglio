/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { assert } = require('chai');
const rimraf = require('rimraf');
const theme = require('../lib/main');

// Clear cache before test. This helps make sure the cache builds properly!
rimraf.sync('cache/*');

describe('Library', function () {
	describe('Config', function () {
		it('Should allow getting config', function () {
			const config = theme.getConfig();
			return assert.ok(config);
		});

		it('Should contain supported format version', function () {
			const config = theme.getConfig();
			return assert.ok(config.formats);
		});

		return it('Should contain option information', function () {
			const config = theme.getConfig();
			assert.ok(config.options);

			assert.ok(config.options.length > 1);
			const option = config.options[0];

			assert.ok(option.name);
			return assert.ok(option.description);
		});
	});

	return describe('Render', function () {
		it('Should not require options', function (done) { theme.render({}, (err, html) => done(err)); });

		it('Should accept options', function (done) { theme.render({}, {}, (err, html) => done(err)); });

		it('Should accept custom variables', function (done) { theme.render({}, { themeVariables: 'styles/variables-default.less' }, done); });

		it('Should accept array of custom variables', function (done) {
			theme.render({}, {
				themeVariables: [
					'styles/variables-default.less',
					'styles/variables-flatly.less'
				]
			}, done);
		});

		it('Should error on missing variables', function (done) {
			theme.render({}, { themeVariables: '/bad/path.less' }, function (err, html) {
				assert.ok(err);
				return done();
			});
		});

		it('Should accept a custom style', function (done) { theme.render({}, { themeStyle: 'styles/layout-default.less' }, done); });

		it('Should accept an array of custom styles', function (done) {
			theme.render({}, {
				themeStyle: [
					'styles/layout-default.less',
					'styles/layout-default.less'
				]
			}, done);
		});

		it('Should error on missing style', function (done) {
			theme.render({}, { themeStyle: '/bad/style.less' }, function (err, html) {
				assert.ok(err);
				return done();
			});
		});

		it('Should error on missing template', function (done) {
			theme.render({}, { themeTemplate: '/bad/path.pug' }, function (err, html) {
				assert.ok(err);
				return done();
			});
		});

		return it('Should benchmark', function (done) {
			const old = process.env.BENCHMARK;
			process.env.BENCHMARK = 'true';
			theme.render({}, function (err, html) {
				process.env.BENCHMARK = old;
				return done(err);
			});
		});
	});
});
