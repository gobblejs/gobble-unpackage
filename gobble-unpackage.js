
var sander = require('sander');
var path = require('path');
var _ = require('underscore');

var sourceMapRegExp = new RegExp(/(?:\/\/#|\/\/@|\/\*#)\s*sourceMappingURL=(.*)\s*(?:\*\/\s*)?$/);


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
				if (contents.match(sourceMapRegExp)) {
					contents = contents.replace(sourceMapRegExp, '');
					return sander.writeFile(outputdir, filename, contents);
				} else {
		// 		console.log('Linking file: ', inputdir, filename, outputdir);
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
			// See spmjs.io. Some stuff (e.g. jQuery) uses this.
			pending.push(linkFile(options.spm.main));
		}

	} else {
		// If no package.json file is present, just passthru all the files
		pending.push(sander.readdir(inputdir).then(linkFile));
	}

// 	console.log('Pending ops:', pending);

	return sander.Promise.all(pending);

}


module.exports = unpackage;

