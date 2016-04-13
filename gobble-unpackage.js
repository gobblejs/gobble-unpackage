
var sander = require('sander');
var path = require('path');
var _ = require('underscore');
var SourceNode = require( 'source-map' ).SourceNode;


var sourceMapRegExp = new RegExp(/(?:\/\/#|\/\/@|\/\*#)\s*sourceMappingURL=(.*?)\s*(?:\*\/\s*)?$/);
var dataUriRegexp = new RegExp(/^(data:)([\w\/\+]+)(;charset[=:][\w-]+)?(;base64)?,(.*)/);	// From https://github.com/ragingwind/data-uri-regex, modified

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

					if (options.stripSourcemaps) {
						// Generate an inline sourcemap pointing to the original filename (node_modules/../...)
						contents = contents.replace(sourceMapRegExp, '');
						var lines = contents.split('\n');
						var lineCount = lines.length;
						var identNode = new SourceNode(null, null, null, '');
						var realFilename = sander.realpathSync(inputdir, filename);

						identNode.setSourceContent(realFilename, contents);

						for (var i=0; i<lineCount; i++) {
							var lineNode = new SourceNode(i+1, 0, realFilename, lines[i] + '\n');
							// 							if (i) { identNode.add(newLineNode); }
							identNode.add(lineNode);
						}
						var generated = identNode.toStringWithSourceMap();
						var encodedMap = 'data:application/json;charset=utf-8;base64,' + new Buffer(generated.map.toString()).toString('base64');
						var sourceMapLocation;
						if (filename.match(/\.css$/)) {
							sourceMapLocation = '\n\n/*# sourceMappingURL=' + encodedMap + ' */\n';
						} else {
							sourceMapLocation = '\n\n//# sourceMappingURL=' + encodedMap + '\n'
						}
// 						return sander.writeFile(outputdir, filename, contents);
						return sander.Promise.all([
							sander.writeFile( outputdir, filename, generated.code + sourceMapLocation ),
						]);
					}


					var dataUriMatch = dataUriRegexp.exec(match[1]);
					if (dataUriMatch) {
						// The sourcemap is inlined: just link the file.
// 						console.log('Inline sourcemap at ', filename);
						return sander.symlink(inputdir, filename).to(outputdir, filename);
					} else {
						// Link the file and the sourcemap file
// 						console.log('Explicit sourcemap at ', inputdir, path.dirname(filename), match[1]);

						var sourcemapFilename = match[1];
						return sander.readFile( inputdir, path.dirname(filename), sourcemapFilename ).then( function ( mapContents ) {

							var inlined;
 							contents = contents.replace(sourceMapRegExp, '');

							// Replace reference to sourcemap with inlined sourcemap
							if (filename.substr(-4) === '.css') {
								inlined = '/*# sourceMappi' + 'ngURL=data:application/json;charset=utf-8;base64,' +
									mapContents.toString('base64') + ' */\n';
							} else {
								inlined = '//# sourceMappi' + 'ngURL=data:application/json;charset=utf-8;base64,' +
									mapContents.toString('base64') + '\n';
							}

							return sander.writeFile(outputdir, filename, contents + inlined);
						});
					}

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

