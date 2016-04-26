// 🦃namespace unpackage
// Filters files from NPM/SPM/CommonJS modules so only the needed ones (e.g. 'main' in package.json) are used

var sander = require('sander');
var path = require('path');
var _ = require('underscore');
var SourceNode = require( 'source-map' ).SourceNode;
getSourceNode = require( './get-source-node' );


var sourceMapRegExp = new RegExp(/(?:\/\/#|\/\/@|\/\*#)\s*sourceMappingURL=(.*?)\s*(?:\*\/\s*)?$/);

function unpackage ( inputdir, outputdir, options/*, callback */) {

	function linkFile(filename) {
// 		console.log(filename);
		if (filename === undefined) { return true; }

		if (filename instanceof Array) {
// 			console.log('Linking fileS:', filename);
			return sander.Promise.all(filename.map(linkFile));
		}

		return sander.stat(inputdir, filename).then(function(stats) {
			// If there is a reference to that directory, link the whole thing.
			if (stats.isDirectory()) {
				return sander.symlink(inputdir, filename).to(outputdir, filename);
			}

			// If the library *file* refers to a sourcemap, excise it (sourcemaps are
			// not tracked files). If not, it's enough to link it.
			return sander.readFile(inputdir, filename).then(function(contents){;
				contents = contents.toString();

				var match = contents.match(sourceMapRegExp);

				if (match) {

					// 🦃option stripSourcemaps: Boolean = false; Whether to strip any existing sourcemaps. Also strips the sourcemaps reference and creates inline sourcemaps pointing to the original location of the files.
					return getSourceNode(inputdir, filename, options.stripSourcemaps).then(function (node) {
						var generated = node.toStringWithSourceMap();

						var sourcemap = JSON.parse(generated.map.toString());
// 						console.log(sourcemap);
						console.log(sourcemap.sources);

						// Replace paths to make them relative to the CWD
						console.log(inputdir, outputdir, filename);
						var srcDir = path.dirname(filename);
						var cwd = process.cwd();

						sourcemap.sources.forEach(function(sourcepath, i){

							var newSourcepath = path.resolve(path.join(inputdir, srcDir), sourcepath);
							sourcemap.sources[i] = path.relative(cwd, newSourcepath);
						});

// 						console.log(sourcemap.sources);

						var encodedMap = 'data:application/json;charset=utf-8;base64,' + new Buffer(JSON.stringify(sourcemap)).toString('base64');

						var sourceMapLocation;
						if (filename.match(/\.css$/)) {
							sourceMapLocation = '\n\n/*# sourceMappingURL=' + encodedMap + ' */\n';
						} else {
							sourceMapLocation = '\n\n//# sourceMappingURL=' + encodedMap + '\n'
						}

						sander.writeFile( outputdir, filename, generated.code + sourceMapLocation );
					});

				} else {
// 					console.log('No sourcemap at ', filename);
// 				console.log('Linking file: ', inputdir, filename, outputdir);
					return sander.symlink(inputdir, filename).to(outputdir, filename);
				}
			});
		});

	}

	var packageJsonFilename = path.join(inputdir, '/package.json');
	var pending = [];


	if (sander.existsSync(packageJsonFilename) || options) {
		if (!options) { options = {}; }

		var packageJson = JSON.parse(sander.readFileSync(packageJsonFilename));
		options = _.extend(packageJson, options);
// 		console.log(options);
	}

	if (options) {
		if ('style' in options)  {
			// Any npm-css compliant package will have this.
			pending.push(linkFile(options.style));
		} else if ('less' in options) {
			// Some stuff (e.g. bootstrap) use this
			pending.push(linkFile(options.less));
		}

		if ('main' in options)  {
			// This is the most common way of defining stuff
			pending.push(linkFile(options.main));
		} else if ('spm' in options && 'main' in options.spm) {
			// See spmjs.io. Some stuff (e.g. jQuery, es6-promise) uses this.
			pending.push(linkFile(options.spm.main));
		}

		if ('browser' in options && (typeof options.browser === 'string'))  {
			// Becoming more popular as bower dies out, see
			// https://github.com/defunctzombie/package-browser-field-spec
			pending.push(linkFile(options.browser));
		}

	} else {
		// If no package.json file is present, just passthru all the files
		pending.push(sander.readdir(inputdir).then(linkFile));
	}

// 	console.log('Pending ops:', pending);

	return sander.Promise.all(pending);

}


module.exports = unpackage;

