# gobble-unpackage

Use only the needed files from NPM/SPM/CommonJS modules in your GobbleJS workflow.

## Why?

There are a myriad of javascript package managers our there: Bower, NPM, JSPM,
SPM, Volo, Meteor, Composer and so on.

The goal of `gobble-unpackage` is allowing you, the web developer, to use any
of these package managers, then use GobbleJS to filter out the files you don't
need, keeping only those specified in the `package.json` definition.

It also does some magic to the existing sourcemaps, so longer paths (including
the module name) will be shown in the final files.


## Installation

I assume you already know the basics of [Gobble](https://github.com/gobblejs/gobble).

```bash
npm i -D gobble-unpackage
```

## Usage

In your `gobblefile`, run the `package` gobble transform, like so:

```javascript
var gobble = require( 'gobble' );
module.exports = gobble( directory_with_a_javascript_package ).transform( 'unpackage' );
```

The output node will contain only the files described by the `main` property of
the `package.json` file in the package. CSS and Less are managed, as well as
the SPM format for `package.json`.

If you want to override any values of the package's `package.json`, specify those
overrides as options to the 'unpackage' transform:

```js
module.exports = gobble( directory_with_a_javascript_package )
.transform( 'unpackage', { main: './build/foobar.js' });
```

The output will include sourcemap files. If these are giving any problems, specify
the option `stripSourcemaps` with a truthy value. This will strip any existing
sourcemaps and replace them with a fake inline sourcemap pointing to the original
file. Use this option if you would like to completely ignore sourcemaps from
the module's author.

```js
module.exports = gobble( directory_with_a_javascript_package )
.transform( 'unpackage', { stripSourcemaps: true });
```

## Example usage

A more ellaborate example, to concatenate some JS libraries:

```bash
npm install jquery
npm install bootstrap
npm install leaflet
```

```javascript
var gobble = require( 'gobble' );

var libs = gobble([
	gobble('node_modules/leaflet'  ).transform('unpackage'),
	gobble('node_modules/jquery'   ).transform('unpackage'),
	gobble('node_modules/bootstrap').transform('unpackage', {
		main: './dist/js/bootstrap.js'
	})
]);

var libJS = libs.transform('concat', { dest: 'libs.js', files: '**/*.js' });
var libCSS = libs.transform('concat', { dest: 'libs.css', files: '**/*.css' });

module.exports = gobble([ libJS, libCSS ]);
```


## Caveats

`gobble-unpackage` will **not**:

* resolve `require()` calls as some CommonJS modules expect
* process packages which do not include `.js` in the filename of for the `main` property


## License

```
"THE BEER-WARE LICENSE":
<ivan@sanchezortega.es> wrote this file. As long as you retain this notice you
can do whatever you want with this stuff. If we meet some day, and you think
this stuff is worth it, you can buy me a beer in return.
```
