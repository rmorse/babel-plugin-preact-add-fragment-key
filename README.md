# Preact Add Keys to Fragments

This plugin is used to add a key attribute to all top level `<Fragment>` elements in a Preact component.

This is to workaround a bug with Preact & Prefresh where updates in nested fragments are not triggering HMR properly.

This plugin:
- finds any top level JSX Fragments in a components return (ie when a component returns <>...</>)
- if the fragment doesn't already have a key, adds a key attribute
- supports functional components only

## Prefresh Issue Link
https://github.com/preactjs/prefresh/issues/569


## Usage

Import the plugin via `require.resolve` - `require.resolve('./babel-plugin-preact-add-fragment-key.js'),`

Example `babel.config.js` - add this before your JSX transform.


```
module.exports = (api) => {

	const isDevelopment = api.env() === 'development'; 
	api.cache(false);
	
	return {
		plugins: [
			isDevelopment && require.resolve('./babel-plugin-preact-add-fragment-key.js'),
			[
				'@babel/plugin-transform-react-jsx',
				{
					runtime: 'automatic',
					importSource: 'preact',
				},
			],
		].filter(Boolean),
	};
};
```

