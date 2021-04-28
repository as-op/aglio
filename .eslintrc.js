module.exports = {
	'env': {
		browser: false,
		commonjs: true,
		es2021: true
	},
	'plugins': [
		'mocha'
	],
	'extends': [
		'standard',
		'plugin:mocha/recommended'
	],
	'parserOptions': {
		ecmaVersion: 12
	},
	'rules': {
		'no-tabs': 0,
		'indent': ['error', 'tab', { SwitchCase: 1 }],
		'quote-props': ['error', 'consistent'],
		'semi': ['error', 'always'],
		'mocha/no-setup-in-describe': 0,
		'object-curly-spacing': 0,
		'node/no-callback-literal': 0
	}
};
