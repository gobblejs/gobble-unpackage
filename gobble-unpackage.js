
var sander = require('sander');
var path = require('path');
var _ = require('underscore');



function unpackage ( inputdir, outputdir, options/*, callback */) {

	function linkFile(filename) {
		if (filename === undefined) { return true; }

		if (filename instanceof Array) {
// 			console.log('Linking fileS:', filename);
			return sander.Promise.all(filename.map);
		}

// 		console.log('Linking file: ', inputdir, filename, outputdir);
		return sander.symlink(inputdir, filename).to(outputdir, filename);
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

	return sander.Promise.all(pending)/*.then(callback)*/;

}


module.exports = unpackage;

