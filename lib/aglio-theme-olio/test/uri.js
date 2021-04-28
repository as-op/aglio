/* eslint-disable mocha/no-setup-in-describe */
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { assert } = require('chai');
const theme = require('../lib/main');

const examples = [
	{
		uriTemplate: '/resource/{path}',
		parameters: [
			{
				name: 'path'
			}
		],
		exampleURI: [
			'/resource/',
			{ attribute: 'path' }
		]
	},

	{
		uriTemplate: '/resource/{+reserved}',
		parameters: [
			{
				name: 'reserved',
				example: 'this/that'
			}
		],
		exampleURI: [
			'/resource/',
			{ attribute: 'this/that', title: 'reserved' }
		]
	},

	{
		uriTemplate: '/resource{?greeting,name*}',
		parameters: [
			{
				name: 'greeting',
				example: 'hello'
			},
			{
				name: 'name',
				example: 'world'
			}
		],
		exampleURI: [
			'/resource',
			{ operator: '?', attribute: 'greeting', literal: 'hello' },
			{ operator: '&', attribute: 'name', literal: 'world' }
		]
	},

	{
		uriTemplate: '/resource{?greeting}{&name}',
		parameters: [
			{
				name: 'greeting',
				example: 'hello'
			},
			{
				name: 'name',
				example: 'world'
			}
		],
		exampleURI: [
			'/resource',
			{ operator: '?', attribute: 'greeting', literal: 'hello' },
			{ operator: '&', attribute: 'name', literal: 'world' }
		]
	},

	{
		uriTemplate: '/resource{?greeting}{+something}',
		parameters: [
			{
				name: 'greeting',
				example: 'hello'
			},
			{
				name: 'something',
				example: 'with/slash'
			}
		],
		exampleURI: [
			'/resource',
			{ operator: '?', attribute: 'greeting', literal: 'hello' },
			{ title: 'something', attribute: 'with/slash' }
		]
	},

	{
		uriTemplate: '/resource/',
		parameters: [],
		exampleURI: [
			'/resource/'
		]
	},

	{
		uriTemplate: '/resource/{path}/',
		parameters: [
			{
				name: 'path'
			}
		],
		exampleURI: [
			'/resource/',
			{ attribute: 'path' },
			'/'
		]
	},

	{
		uriTemplate: '/resource',
		parameters: [],
		exampleURI: [
			'/resource'
		]
	}

];

const addParameterDefaults = example => {
	example.parameters = example.parameters.map((parameter) => {
		return {
			name: parameter.name,
			description: parameter.description || '',
			type: parameter.type || 'string',
			required: parameter.required || false,
			values: parameter.values || [],
			example: parameter.example || '',
			defaultValue: parameter.defaultValue || ''
		};
	});
};

const generateRefract = function (example) {
	const hrefMembers = [];
	for (const param of Array.from(example.parameters)) {
		let types, value, valueContent;
		if (param.required) {
			types = [
				{
					element: 'string',
					content: 'required'
				}
			];
		}

		if (param.values.length > 0) {
			const values = [];
			for (value of Array.from(param.values)) {
				values.push({
					element: 'string',
					content: value.value
				});
			}
			valueContent = {
				element: 'enum',
				attributes: {
					enumerations: {
						element: 'array',
						content: values
					}
				},
				content: {
					element: 'string',
					content: param.example
				}
			};
		} else {
			valueContent = {
				element: 'string',
				content: param.example
			};
		}

		hrefMembers.push({
			element: 'member',
			meta: {
				title: {
					element: 'string',
					content: param.type
				},
				description: {
					element: 'string',
					content: param.description
				}
			},
			attributes: {
				typeAttributes: {
					element: 'array',
					content: types || []
				}
			},
			content: {
				key: {
					element: 'string',
					content: param.name
				},
				value: valueContent
			}
		});
	}

	example.parseResult = {
		element: 'parseResult',
		content: [
			{
				element: 'category',
				meta: {
					classes: {
						element: 'array',
						content: [
							{
								element: 'string',
								content: 'api'
							}
						]
					},
					title: {
						element: 'string',
						content: 'Test API'
					}
				},
				content: [
					{
						element: 'category',
						meta: {
							classes: {
								element: 'array',
								content: [
									{
										element: 'string',
										content: 'resourceGroup'
									}
								]
							},
							title: {
								element: 'string',
								content: 'Frobs'
							}
						},
						content: [
							{
								element: 'category',
								meta: {
									classes: {
										element: 'array',
										content: [
											{
												element: 'string',
												content: 'resourceGroup'
											}
										]
									},
									title: {
										element: 'string',
										content: 'TestGroup'
									}
								},
								content: [
									{
										element: 'resource',
										meta: {
											title: {
												element: 'string',
												content: 'TestResource'
											}
										},
										attributes: {
											href: {
												element: 'string',
												content: example.uriTemplate
											}
										},
										content: [
											{
												element: 'transition',
												meta: {
													title: {
														element: 'string',
														content: 'Test Action'
													}
												},
												attributes: {
													hrefVariables: {
														element: 'hrefVariables',
														content: hrefMembers
													}
												},
												content: [
													{
														element: 'copy',
														content: 'Test *description*'
													},
													{
														element: 'httpTransaction',
														content: [
															{
																element: 'httpRequest',
																attributes: {
																	method: {
																		element: 'string',
																		content: 'GET'
																	}
																},
																content: []
															},
															{
																element: 'httpResponse',
																attributes: {
																	statusCode: {
																		element: 'string',
																		content: '200'
																	}
																},
																content: [
																	{
																		element: 'asset',
																		meta: {
																			classes: {
																				element: 'array',
																				content: [
																					{
																						element: 'string',
																						content: 'messageBody'
																					}
																				]
																			}
																		},
																		content: '{"error": true}'
																	}
																]
															}
														]
													}
												]
											}
										]
									}
								]
							}
						]
					}
				]
			}
		]
	};
};

const createExampleURI = function (example) {
	let exampleURI = '';
	for (const segment of Array.from(example.exampleURI)) {
		if (typeof segment === 'string') {
			exampleURI += segment;
		} else {
			if (segment.operator) {
				exampleURI += segment.operator;
			}
			if (segment.literal) {
				exampleURI += `<span class="hljs-attribute">${segment.attribute}=</span><span class="hljs-literal">${segment.literal}</span>`;
			} else {
				exampleURI += `<span class="hljs-attribute" title="${segment.title || segment.attribute}">${segment.attribute}</span>`;
			}
		}
	}
	example.exampleURI = exampleURI;
};

describe('URI Rendering', function () {
	return examples.forEach(function (example) {
		addParameterDefaults(example);
		generateRefract(example);
		createExampleURI(example);

		return it(`Should render ${example.uriTemplate}`, function (done) {
			theme.render(example.parseResult, function (err, html) {
				if (err) {
					return done(err);
				}
				assert.include(html, example.uriTemplate.replace(/&/g, '&amp;'));
				assert.include(html, example.exampleURI);
				return done();
			});
		});
	});
});
