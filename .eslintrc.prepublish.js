/**
 * @type {import('@types/eslint').ESLint.ConfigData}
 */
module.exports = {
	extends: "./.eslintrc.js",
	rules: {
        // Disable rules that don't apply to community nodes
        'n8n-nodes-base/node-dirname-against-convention': 'off',
        'n8n-nodes-base/node-filename-against-convention': 'off',
        'n8n-nodes-base/node-class-description-display-name-unsuffixed-trigger-node': 'off',
        'n8n-nodes-base/node-class-description-name-miscased': 'off',
        'n8n-nodes-base/node-param-operation-option-action-miscased': 'off',
        'n8n-nodes-base/node-param-display-name-miscased': 'off',
        'n8n-nodes-base/node-execute-block-wrong-error-thrown': 'off',
    },
	overrides: [
		{
			files: ['package.json'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			rules: {
				'n8n-nodes-base/community-package-json-name-still-default': 'error',
			},
		},
	],
};
