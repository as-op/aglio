/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS201: Simplify complex destructure assignments
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const crypto = require('crypto');
const fs = require('fs');
const hljs = require('highlight.js');
const os = require('os');
const pug = require('pug');
const less = require('less');
const markdownIt = require('markdown-it');
const moment = require('moment');
const path = require('path');
const querystring = require('querystring');
const equal = require('deep-equal');
const query = require('@gasolwu/refract-query');

// The root directory of this project
const ROOT = path.dirname(__dirname);

let cache = {};

// Utility for benchmarking
const benchmark = {
	start (message) {
		if (process.env.BENCHMARK) {
			return console.time(message);
		}
	},
	end (message) {
		if (process.env.BENCHMARK) {
			return console.timeEnd(message);
		}
	}
};

// Extend an error's message. Returns the modified error.
const errMsg = function (message, err) {
	err.message = `${message}: ${err.message}`;
	return err;
};

// Generate a SHA1 hash
const sha1 = value => crypto.createHash('sha1').update(value.toString()).digest('hex');

// A function to create ID-safe slugs. If `unique` is passed, then
// unique slugs are returned for the same input. The cache is just
// a plain object where the keys are the sluggified name.
const slug = function (cache, value, unique) {
	if (cache == null) {
		cache = {};
	}
	if (value == null) {
		value = '';
	}
	if (unique == null) {
		unique = false;
	}
	let sluggified = value.toLowerCase()
		.replace(/[ \t\n\\<>"'=:/]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-/, '');

	if (unique) {
		while (cache[sluggified]) {
			// Already exists, so let's try to make it unique.
			if (sluggified.match(/\d+$/)) {
				sluggified = sluggified.replace(/\d+$/, value => parseInt(value) + 1);
			} else {
				sluggified = sluggified + '-1';
			}
		}
	}

	cache[sluggified] = true;

	return sluggified;
};

// A function to highlight snippets of code. lang is optional and
// if given, is used to set the code language. If lang is no-highlight
// then no highlighting is performed.
const highlight = function (code, lang, subset) {
	benchmark.start(`highlight ${lang}`);
	const response = (() => {
		switch (lang) {
			case 'no-highlight':
				return code;
			case undefined:
			case null:
			case '':
				return hljs.highlightAuto(code, subset).value;
			default:
				return hljs.highlight(code, {language: lang}).value;
		}
	})();
	benchmark.end(`highlight ${lang}`);
	return response.trim();
};

const getCached = function (key, compiledPath, sources, load, done) {
	// Disable the template/css caching?
	if (process.env.NOCACHE) {
		return done(null);
	}

	// Already loaded? Just return it!
	if (cache[key]) {
		return done(null, cache[key]);
	}

	// Next, try to check if the compiled path exists and is newer than all of
	// the sources. If so, load the compiled path into the in-memory cache.
	try {
		if (fs.existsSync(compiledPath)) {
			const compiledStats = fs.statSync(compiledPath);

			for (const source of Array.from(sources)) {
				const sourceStats = fs.statSync(source);
				if (sourceStats.mtime > compiledStats.mtime) {
					// There is a newer source file, so we ignore the compiled
					// version on disk. It'll be regenerated later.
					return done(null);
				}
			}

			try {
				return load(compiledPath, function (err, item) {
					if (err) {
						return done(errMsg('Error loading cached resource', err));
					}

					cache[key] = item;
					return done(null, cache[key]);
				});
			} catch (loadErr) {
				return done(errMsg('Error loading cached resource', loadErr));
			}
		} else {
			return done(null);
		}
	} catch (error) {
		const err = error;
		return done(err);
	}
};

const getCss = function (variables, styles, verbose, done) {
	// Get the CSS for the given variables and style. This method caches
	// its output, so subsequent calls will be extremely fast but will
	// not reload potentially changed data from disk.
	// The CSS is generated via a dummy LESS file with imports to the
	// default variables, any custom override variables, and the given
	// layout style. Both variables and style support special values,
	// for example `flatly` might load `styles/variables-flatly.less`.
	// See the `styles` directory for available options.
	let customPath, item;
	const key = `css-${variables}-${styles}`;
	if (cache[key]) {
		return done(null, cache[key]);
	}

	// Not cached in memory, but maybe it's already compiled on disk?
	const compiledPath = path.join(os.tmpdir(), 'olio-cache', `${sha1(key)}.css`);

	const defaultVariablePath = path.join(ROOT, 'styles', 'variables-default.less');
	const sources = [defaultVariablePath];

	if (!Array.isArray(variables)) {
		variables = [variables];
	}
	if (!Array.isArray(styles)) {
		styles = [styles];
	}

	const variablePaths = [defaultVariablePath];
	for (item of Array.from(variables)) {
		if (item !== 'default') {
			customPath = path.join(ROOT, 'styles', `variables-${item}.less`);
			if (!fs.existsSync(customPath)) {
				customPath = path.join(ROOT, item);
				if (!fs.existsSync(customPath)) {
					return done(new Error(`${customPath} does not exist!`));
				}
			}
			variablePaths.push(customPath);
			sources.push(customPath);
		}
	}

	const stylePaths = [];
	for (item of Array.from(styles)) {
		customPath = path.join(ROOT, 'styles', `layout-${item}.less`);
		if (!fs.existsSync(customPath)) {
			customPath = path.join(ROOT, item);
			if (!fs.existsSync(customPath)) {
				customPath = item;
				if (!fs.existsSync(customPath)) {
					return done(new Error(`${customPath} does not exist!`));
				}
			}
		}
		stylePaths.push(customPath);
		sources.push(customPath);
	}

	const load = (filename, loadDone) => fs.readFile(filename, 'utf-8', loadDone);

	if (verbose) {
		console.log(`Using variables ${variablePaths}`);
		console.log(`Using styles ${stylePaths}`);
		console.log(`Checking cache ${compiledPath}`);
	}

	return getCached(key, compiledPath, sources, load, function (err, css) {
		if (err) {
			return done(err);
		}
		if (css) {
			if (verbose) {
				console.log('Cached version loaded');
			}
			return done(null, css);
		}

		// Not cached, so let's create the file.
		if (verbose) {
			console.log('Not cached or out of date. Generating CSS...');
		}

		let tmp = '';

		for (customPath of Array.from(variablePaths)) {
			tmp += `@import "${customPath}";\n`;
		}

		for (customPath of Array.from(stylePaths)) {
			tmp += `@import "${customPath}";\n`;
		}

		benchmark.start('less-compile');
		return less.render(tmp, {compress: true}, function (err, result) {
			if (err) {
				return done(errMsg('Error processing LESS -> CSS', err));
			}

			try {
				({css} = result);
				if (!fs.existsSync(path.dirname(compiledPath))) {
					fs.mkdirSync(path.dirname(compiledPath));
				}
				fs.writeFileSync(compiledPath, css, 'utf-8');
			} catch (writeErr) {
				return done(errMsg('Error writing cached CSS to file', writeErr));
			}

			benchmark.end('less-compile');

			cache[key] = css;
			return done(null, cache[key]);
		});
	});
};

const compileTemplate = function (filename, options) {
	return `\
${pug.compileFileClient(filename, options)}
module.exports = compiledFunc;\
`;
};

const getTemplate = function (name, verbose, done) {
	// Check if this is a built-in template name
	const builtin = path.join(ROOT, 'templates', `${name}.pug`);
	if (!fs.existsSync(name) && fs.existsSync(builtin)) {
		name = builtin;
	}

	// Get the template function for the given path. This will load and
	// compile the template if necessary, and cache it for future use.
	const key = `template-${name}`;

	// Check if it is cached in memory. If not, then we'll check the disk.
	if (cache[key]) {
		return done(null, cache[key]);
	}

	// Check if it is compiled on disk and not older than the template file.
	// If not present or outdated, then we'll need to compile it.
	const compiledPath = path.join(os.tmpdir(), 'olio-cache', `${sha1(key)}.js`);

	const load = function (filename, loadDone) {
		try {
			require(filename);
		} catch (loadErr) {
			return loadDone(errMsg('Unable to load template', loadErr));
		}

		return loadDone(null, require(filename));
	};

	if (verbose) {
		console.log(`Using template ${name}`);
		console.log(`Checking cache ${compiledPath}`);
	}

	return getCached(key, compiledPath, [name], load, function (err, template) {
		let compiled, compileErr;
		if (err) {
			return done(err);
		}
		if (template) {
			if (verbose) {
				console.log('Cached version loaded');
			}
			return done(null, template);
		}

		if (verbose) {
			console.log('Not cached or out of date. Generating template JS...');
		}

		// We need to compile the template, then cache it. This is interesting
		// because we are compiling to a client-side template, then adding some
		// module-specific code to make it work here. This allows us to save time
		// in the future by just loading the generated javascript function.
		benchmark.start('pug-compile');
		const compileOptions = {
			filename: name,
			name: 'compiledFunc',
			self: true,
			compileDebug: false
		};

		try {
			compiled = compileTemplate(name, compileOptions);
		} catch (error) {
			compileErr = error;
			return done(errMsg('Error compiling template', compileErr));
		}

		if (compiled.indexOf('self.') === -1) {
			// Not using self, so we probably need to recompile into compatibility
			// mode. This is slower, but keeps things working with Pug files
			// designed for Aglio 1.x.
			compileOptions.self = false;

			try {
				compiled = compileTemplate(name, compileOptions);
			} catch (error1) {
				compileErr = error1;
				return done(errMsg('Error compiling template', compileErr));
			}
		}

		try {
			if (!fs.existsSync(path.dirname(compiledPath))) {
				fs.mkdirSync(path.dirname(compiledPath));
			}
			fs.writeFileSync(compiledPath, compiled, 'utf-8');
		} catch (writeErr) {
			return done(errMsg('Error writing cached template file', writeErr));
		}

		benchmark.end('pug-compile');

		cache[key] = require(compiledPath);
		return done(null, cache[key]);
	});
};

const modifyUriTemplate = function (templateUri, parameters, colorize) {
	// Modify a URI template to only include the parameter names from
	// the given parameters. For example:
	// URI template: /pages/{id}{?verbose}
	// Parameters contains a single `id` parameter
	// Output: /pages/{id}
	let index;
	let param;
	const parameterValidator = b => // Compare the names, removing the special `*` operator
		parameterNames.indexOf(querystring.unescape(b.replace(/^\*|\*$/, ''))) !== -1;
	const parameterNames = parameters.map(param => param.name);
	const parameterBlocks = [];
	let lastIndex = (index = 0);
	while ((index = templateUri.indexOf('{', index)) !== -1) {
		parameterBlocks.push(templateUri.substring(lastIndex, index));
		const block = {};
		const closeIndex = templateUri.indexOf('}', index);
		block.querySet = templateUri.indexOf('{?', index) === index;
		block.formSet = templateUri.indexOf('{&', index) === index;
		block.reservedSet = templateUri.indexOf('{+', index) === index;
		lastIndex = closeIndex + 1;
		index++;
		if (block.querySet || block.formSet || block.reservedSet) {
			index++;
		}
		const parameterSet = templateUri.substring(index, closeIndex);
		block.parameters = parameterSet.split(',').filter(parameterValidator);
		if (block.parameters.length) {
			parameterBlocks.push(block);
		}
	}
	parameterBlocks.push(templateUri.substring(lastIndex, templateUri.length));
	return parameterBlocks.reduce(function (uri, v) {
		if (typeof v === 'string') {
			uri.push(v);
		} else {
			const segment = !colorize ? ['{'] : [];
			if (v.querySet) {
				segment.push('?');
			}
			if (v.formSet) {
				segment.push('&');
			}
			if (v.reservedSet && !colorize) {
				segment.push('+');
			}
			segment.push(v.parameters.map(function (name) {
				if (!colorize) {
					return name;
				} else {
					// TODO: handle errors here?
					name = name.replace(/^\*|\*$/, '');
					param = parameters[parameterNames.indexOf(querystring.unescape(name))];
					if (v.querySet || v.formSet) {
						return `<span class="hljs-attribute">${name}=</span><span class="hljs-literal">${param.example || ''}</span>`;
					} else {
						return `<span class="hljs-attribute" title="${name}">${param.example || name}</span>`;
					}
				}
			}).join(colorize ? '&' : ',')
			);
			if (!colorize) {
				segment.push('}');
			}
			uri.push(segment.join(''));
		}
		return uri;
	}
	, []).join('').replace(/\/+/g, '/');
};

const getTitle = function (parseResult) {
	const [category] = Array.from(query(parseResult, {
		element: 'category',
		meta: {
			classes: {
				content: [
					{
						content: 'api'
					}
				]
			}
		}
	}));
	return __guard__(category != null ? category.meta.title : undefined, x => x.content) || '';
};

const getDataStructures = function (parseResult) {
	const results = query(parseResult, {
		element: 'dataStructure',
		content: {
			meta: {
				id: {
					element: 'string'
				}
			}
		}
	});
	return new function () {
		for (const result of Array.from(results)) {
			this[result.content.meta.id.content] = result;
		}
		return this;
	}();
};

const getApiDescription = function (parseResult) {
	const [category] = Array.from(query(parseResult, {
		element: 'category',
		meta: {
			classes: {
				content: [
					{
						content: 'api'
					}
				]
			}
		}
	}));
	if ((category != null ? category.content.length : undefined) > 0) {
		const content = category.content[0];
		if (content.element === 'copy') {
			return content.content;
		}
	}
	return '';
};

const getHost = function (parseResult) {
	const [category] = Array.from(query(parseResult, {
		element: 'category',
		meta: {
			classes: {
				content: [
					{
						content: 'api'
					}
				]
			}
		}
	}));

	const [member] = Array.from(query(__guard__(category != null ? category.attributes : undefined, x => x.metadata) || [], {
		element: 'member',
		content: {
			key: {
				content: 'HOST'
			}
		}
	}));
	return (member != null ? member.content.value.content : undefined) || '';
};

const getResourceGroups = function (parseResult, slugCache, md) {
	const results = query(parseResult, {
		element: 'category',
		meta: {
			classes: {
				content: [
					{
						content: 'resourceGroup'
					}
				]
			}
		}
	});
	return (Array.from(results).map((result) => getResourceGroup(result, slugCache, md)));
};

const getResourceGroup = function (resourceGroupElement, slugCache, md) {
	let description;
	const slugify = slug.bind(slug, slugCache);
	const title = resourceGroupElement.meta.title.content;
	const titleSlug = slugify(title, true);
	if ((resourceGroupElement.content.length > 0) &&
			(resourceGroupElement.content[0].element === 'copy')) {
		description = md.render(resourceGroupElement.content[0].content);
	}

	const resourceGroup = {
		name: title,
		elementId: titleSlug,
		elementLink: `#${titleSlug}`,
		descriptionHtml: description || '',
		resources: []
	};
	if (description) {
		resourceGroup.navItems = slugCache._nav;
		slugCache._nav = [];
	}

	const resourceElements = query(resourceGroupElement, {element: 'resource'});
	resourceGroup.resources = getResources(resourceElements, slugCache,
		resourceGroup.elementId);
	return resourceGroup;
};

const getResourceDescription = function (resourceElement) {
	if ((resourceElement.content[0] != null ? resourceElement.content[0].element : undefined) === 'copy') {
		return resourceElement.content[0].content;
	}
	return '';
};

const getResources = (resourceElements, slugCache, parentId) => Array.from(resourceElements).map((resourceElement) => getResource(resourceElement, slugCache, parentId));

const getResource = function (resourceElement, slugCache, parentId) {
	const slugify = slug.bind(slug, slugCache);
	const title = resourceElement.meta.title.content;
	const titleSlug = slugify(`${parentId}-${title}`, true);
	const description = getResourceDescription(resourceElement);
	const resource = {
		name: title,
		elementId: titleSlug,
		elementLink: `#${titleSlug}`,
		description,
		actions: [],
		uriTemplate: (resourceElement.attributes != null ? resourceElement.attributes.href.content : undefined) || ''
	};
	resource.actions = getActions(resourceElement, slugCache,
		`${parentId}-${title}-${resource.name}`);
	return resource;
};

const getHeaders = headersElement => Array.from(headersElement || []).map((element) => ({
	name: element.content.key.content,
	value: element.content.value.content
}));

const getRequest = function (requestElement) {
	const name = requestElement.meta != null ? requestElement.meta.title.content : undefined;
	const method = requestElement.attributes.method.content;

	const [copy] = Array.from(query(requestElement, {element: 'copy'}));
	const [schema] = Array.from(query(requestElement, {
		element: 'asset',
		meta: {
			classes: {
				content: [
					{
						content: 'messageBodySchema'
					}
				]
			}
		}
	}));
	const [body] = Array.from(query(requestElement, {
		element: 'asset',
		meta: {
			classes: {
				content: [
					{
						content: 'messageBody'
					}
				]
			}
		}
	}));
	const headers = getHeaders(requestElement.attributes.headers != null ? requestElement.attributes.headers.content : undefined);

	return {
		name: name || '',
		description: (copy != null ? copy.content : undefined) || '',
		schema: (schema != null ? schema.content : undefined) || '',
		body: (body != null ? body.content : undefined) || '',
		headers,
		content: [],
		method,
		hasContent: ((copy != null ? copy.content : undefined) != null) ||
				(headers.length > 0) ||
				((body != null ? body.content : undefined) != null) ||
				((schema != null ? schema.content : undefined) != null)
	};
};

const getResponse = function (responseElement) {
	const name = responseElement.attributes.statusCode.content;
	const [schema] = Array.from(query(responseElement, {
		element: 'asset',
		meta: {
			classes: {
				content: [
					{
						content: 'messageBodySchema'
					}
				]
			}
		}
	}));
	const [body] = Array.from(query(responseElement, {
		element: 'asset',
		meta: {
			classes: {
				content: [
					{
						content: 'messageBody'
					}
				]
			}
		}
	}));
	const [copy] = Array.from(query(responseElement, {element: 'copy'}));
	const headers = getHeaders(responseElement.attributes.headers != null ? responseElement.attributes.headers.content : undefined);

	return {
		name: name || '',
		description: (copy != null ? copy.content : undefined) || '',
		headers,
		body: (body != null ? body.content : undefined) || '',
		schema: (schema != null ? schema.content : undefined) || '',
		content: [],
		hasContent: ((copy != null ? copy.content : undefined) != null) ||
				(headers.length > 0) ||
				((body != null ? body.content : undefined) != null) ||
				((schema != null ? schema.content : undefined) != null)
	};
};

const isEmptyMessage = message => (message.name != null) &&
		(message.headers.length === 0) &&
		(message.description != null) &&
		(message.body != null) &&
		(message.schema != null) &&
		(message.content.length === 0);

const getExamples = function (actionElement) {
	let example = {
		name: '',
		description: '',
		requests: [],
		responses: []
	};
	const examples = [example];

	for (const httpTransaction of query(actionElement, {element: 'httpTransaction'})) {
		let request;
		let response;
		for (const requestElement of query(httpTransaction, {element: 'httpRequest'})) {
			request = getRequest(requestElement);
		}
		for (const responseElement of query(httpTransaction, {element: 'httpResponse'})) {
			response = getResponse(responseElement);
		}
		const array = example.requests || [];
		const prevRequest = array[array.length - 1];
		const array1 = example.responses || [];
		const prevResponse = array1[array1.length - 1];
		const sameRequest = equal(prevRequest, request);
		const sameResponse = equal(prevResponse, response);
		if (sameRequest) {
			if (!sameResponse) {
				example.responses.push(response);
			}
		} else {
			if (prevRequest) {
				example = {
					name: '',
					description: '',
					requests: [],
					responses: []
				};
				examples.push(example);
			}
			if (!isEmptyMessage(request)) {
				example.requests.push(request);
			}
			if (!sameResponse) {
				example.responses.push(response);
			}
		}
	}

	return examples;
};

const getRequestMethod = function (actionElement) {
	for (const requestElement of Array.from(query(actionElement, {element: 'httpRequest'}))) {
		const method = requestElement.attributes.method.content;
		if (method) {
			return method;
		}
	}
	return '';
};

const getActions = function (resourceElement, slugCache, parentId) {
	const slugify = slug.bind(slug, slugCache);
	const actions = [];

	for (const actionElement of query(resourceElement, {element: 'transition'})) {
		let hasRequest = false;
		const title = actionElement.meta.title.content;
		const method = getRequestMethod(actionElement);
		const examples = getExamples(actionElement);
		for (const example of examples) {
			hasRequest = example.requests.length > 0;
			if (hasRequest) {
				break;
			}
		}

		const array = query(actionElement, {element: 'copy'});
		const copy = array[array.length - 1];
		const id = slugify(`${parentId}-${method}`, true);
		const action = {
			name: title,
			description: (copy != null ? copy.content : undefined),
			elementId: id,
			elementLink: `#${id}`,
			method,
			methodLower: method.toLowerCase(),
			hasRequest: hasRequest,
			examples
		};

		action.parameters = getParameters(actionElement, resourceElement);

		const href = (actionElement.attributes != null ? actionElement.attributes.href : undefined) || resourceElement.attributes.href || {};
		const uriTemplate = href.content || '';
		action.uriTemplate = modifyUriTemplate(uriTemplate, action.parameters);
		action.attributes = {urlTemplate: action.uriTemplate};
		action.colorizedUriTemplate = modifyUriTemplate(uriTemplate, action.parameters, true);

		actions.push(action);
	}

	return actions;
};

const getParameters = function (actionElement, resourceElement) {
	const parameters = [];
	const resourceParams = __guard__(resourceElement.attributes != null ? resourceElement.attributes.hrefVariables : undefined, x => x.content) || [];
	const actionParams = __guard__(actionElement.attributes != null ? actionElement.attributes.hrefVariables : undefined, x1 => x1.content) || [];
	const hrefVariables = resourceParams.concat(actionParams);

	for (const hrefVariable of hrefVariables) {
		let example, values;
		const requiredElement = query(hrefVariable.attributes.typeAttributes, {content: 'required'});

		const valueElement = hrefVariable.content.value;
		switch (valueElement.element) {
			case 'enum':
				values = (Array.from(valueElement.attributes.enumerations.content).map((enumValue) => ({value: enumValue.content})));
				example = valueElement.content.content;
				break;
			default:
				values = [];
				example = valueElement.content;
		}

		const parameter = {
			name: hrefVariable.content.key.content,
			description: (hrefVariable.meta.description != null ? hrefVariable.meta.description.content : undefined) || '',
			type: (hrefVariable.meta.title != null ? hrefVariable.meta.title.content : undefined),
			required: requiredElement.length > 0,
			example,
			values
		};
		parameters.push(parameter);
	}

	return parameters;
};

const getMetadata = function (parseResult) {
	const [category] = Array.from(query(parseResult, {
		element: 'category',
		meta: {
			classes: {
				content: [
					{
						content: 'api'
					}
				]
			}
		}
	}));
	return (Array.from(__guard__(__guard__(category != null ? category.attributes : undefined, x1 => x1.metadata), x => x.content) || []).map((meta) => ({
		name: meta.content.key.content,
		value: meta.content.value.content
	})));
};

const getDefaultResourceGroup = function (parseResult, slugCache) {
	const [result] = Array.from(query(parseResult, {
		element: 'category',
		meta: {
			classes: {
				content: [
					{
						content: 'api'
					}
				]
			}
		},
		content: [
			{
				element: 'resource'
			}
		]
	}));
	const resourceElements = (result ? query(result, {element: 'resource'}) : undefined) || [];
	const resources = getResources(resourceElements, slugCache, '');
	if (resources.length > 0) {
		return {
			name: '',
			elementId: '',
			elementLink: '',
			descriptionHtml: '',
			resources
		};
	} else {
		return null;
	}
};

const decorate = function (api, md, slugCache, verbose) {
	// Decorate an API Blueprint AST with various pieces of information that
	// will be useful for the theme. Anything that would significantly
	// complicate the Pug template should probably live here instead!

	// Use the slug caching mechanism
	// const slugify = slug.bind(slug, slugCache)

	// Find data structures. This is a temporary workaround until Drafter is
	// updated to support JSON Schema again.
	api.name = getTitle(api);
	api.metadata = getMetadata(api);

	const dataStructures = getDataStructures(api);
	if (verbose) {
		console.log(`Known data structures: ${Object.keys(dataStructures)}`);
	}

	api.descriptionHtml = md.render(getApiDescription(api));
	if (api.descriptionHtml) {
		api.navItems = slugCache._nav;
		slugCache._nav = [];
	}

	api.host = getHost(api);
	api.resourceGroups = getResourceGroups(api, slugCache, md);
	const defaultResourceGroup = getDefaultResourceGroup(api, slugCache);
	if (defaultResourceGroup) {
		return api.resourceGroups.unshift(defaultResourceGroup);
	}
};

// Get the theme's configuration, used by Aglio to present available
// options and confirm that the input blueprint is a supported
// version.
exports.getConfig = () => ({
	formats: ['1A'],

	options: [
		{
			name: 'variables',
			description: 'Color scheme name or path to custom variables',
			default: 'default'
		},
		{
			name: 'condense-nav',
			description: 'Condense navigation links',
			boolean: true,
			default: true
		},
		{
			name: 'full-width',
			description: 'Use full window width',
			boolean: true,
			default: false
		},
		{
			name: 'template',
			description: 'Template name or path to custom template',
			default: 'default'
		},
		{
			name: 'style',
			description: 'Layout style name or path to custom stylesheet'
		},
		{
			name: 'emoji',
			description: 'Enable support for emoticons',
			boolean: true,
			default: true
		}
	]
});

// Render the blueprint with the given options using Pug and LESS
exports.render = function (input, options, done) {
	if ((done == null)) {
		done = options;
		options = {};
	}

	// Disable the template/css caching?
	if (process.env.NOCACHE) {
		cache = {};
	}

	// This is purely for backward-compatibility
	if (options.condenseNav) {
		options.themeCondenseNav = options.condenseNav;
	}
	if (options.fullWidth) {
		options.themeFullWidth = options.fullWidth;
	}

	// Setup defaults
	if (options.themeVariables == null) {
		options.themeVariables = 'default';
	}
	if (options.themeStyle == null) {
		options.themeStyle = 'default';
	}
	if (options.themeTemplate == null) {
		options.themeTemplate = 'default';
	}
	if (options.themeCondenseNav == null) {
		options.themeCondenseNav = true;
	}
	if (options.themeFullWidth == null) {
		options.themeFullWidth = false;
	}

	// Transform built-in layout names to paths
	if (options.themeTemplate === 'default') {
		options.themeTemplate = path.join(ROOT, 'templates', 'index.pug');
	}

	// Setup markdown with code highlighting and smartypants. This also enables
	// automatically inserting permalinks for headers.
	const slugCache =
			{_nav: []};
	const md = markdownIt({
		html: true,
		linkify: true,
		typographer: true,
		highlight
	}).use(require('markdown-it-anchor'), {
		slugify (value) {
			const output = `header-${slug(slugCache, value, true)}`;
			slugCache._nav.push([value, `#${output}`]);
			return output;
		},
		permalink: true,
		permalinkClass: 'permalink'
	}
	).use(require('markdown-it-checkbox')
	).use(require('markdown-it-container'), 'note'
	).use(require('markdown-it-container'), 'warning');

	if (options.themeEmoji) {
		md.use(require('markdown-it-emoji'));
	}

	// Enable code highlighting for unfenced code blocks
	md.renderer.rules.code_block = md.renderer.rules.fence;

	benchmark.start('decorate');
	decorate(input, md, slugCache, options.verbose);
	benchmark.end('decorate');

	benchmark.start('css-total');
	const {themeVariables, themeStyle, verbose} = options;
	return getCss(themeVariables, themeStyle, verbose, function (err, css) {
		if (err) {
			return done(errMsg('Could not get CSS', err));
		}
		benchmark.end('css-total');

		const locals = {
			api: input,
			condenseNav: options.themeCondenseNav,
			css,
			fullWidth: options.themeFullWidth,
			date: moment,
			hash (value) {
				return crypto.createHash('md5').update(value.toString()).digest('hex');
			},
			highlight,
			markdown (content) {
				return md.render(content);
			},
			slug: slug.bind(slug, slugCache),
			urldec (value) {
				return querystring.unescape(value);
			}
		};

		const object = options.locals || {};
		for (const key in object) {
			const value = object[key];
			locals[key] = value;
		}

		benchmark.start('get-template');
		return getTemplate(options.themeTemplate, verbose, function (getTemplateErr, renderer) {
			let html;
			if (getTemplateErr) {
				return done(errMsg('Could not get template', getTemplateErr));
			}
			benchmark.end('get-template');

			benchmark.start('call-template');
			try {
				html = renderer(locals);
			} catch (err) {
				return done(errMsg('Error calling template during rendering', err));
			}
			benchmark.end('call-template');
			return done(null, html);
		});
	});
};

function __guard__ (value, transform) {
	return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}
