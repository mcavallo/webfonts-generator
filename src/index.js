var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')
var _ = require('lodash/fp')
var glob = require('glob')
var hash = require('./hash.js')
var utils = require('./utils.js')

var generateFonts = require('./generateFonts')
var renderCss = require('./renderCss')
var renderHtml = require('./renderHtml')

var TEMPLATES_DIR = path.join(__dirname, '..', 'templates')
var TEMPLATES = {
	css: path.join(TEMPLATES_DIR, 'css.hbs'),
	scss: path.join(TEMPLATES_DIR, 'scss.hbs'),
	html: path.join(TEMPLATES_DIR, 'html.hbs')
}

var DEFAULT_TEMPLATE_OPTIONS = {
	baseSelector: '.icon',
	classPrefix: 'icon-'
}

var DEFAULT_OPTIONS = {
	writeFiles: true,
	fontName: 'iconfont',
	css: true,
	cssTemplate: TEMPLATES.css,
	html: false,
	htmlTemplate: TEMPLATES.html,
	types: ['eot', 'woff', 'woff2'],
	order: ['eot', 'woff2', 'woff', 'ttf', 'svg'],
	rename: function(file) {
		return path.basename(file, path.extname(file))
	},
	formatOptions: {},
	/**
	 * Unicode Private Use Area start.
	 * http://en.wikipedia.org/wiki/Private_Use_(Unicode)
	 */
	startCodepoint: 0xF101,
	normalize: true
}


// ensureArray :: a -> Array
var ensureArray = function(files) {
	return _.isString(files)
		? [files]
		: files
}


// parseGlob :: String -> Array
var parseGlob = function(acc, item) {
	return _.concat(acc, glob.sync(item))
}


// prepareFiles :: Array -> Array
var prepareFiles = _.compose(
	_.reduce(parseGlob, []),
	ensureArray
)


// prepareNames :: Array -> Array
var prepareNames = function(renameFn, files) {
	return _.compose(
		_.uniq,
		_.map(renameFn)
	)(files)
}


// prepareCodepoints :: (Int, Array) -> Object
var prepareCodepoints = function(startCodepoint, names) {
	return _.compose(
		_.fromPairs,
		_.reduce(function(acc, name) {
			return _.concat(acc, [[name, startCodepoint + acc.length]])
		}, [])
	)(names)
}


var webfont = function(userOptions, done) {
	var options = _.defaults(DEFAULT_OPTIONS, userOptions)

	if (options.dest === undefined) {
		return done(new Error('"options.dest" is undefined.'))
	}

	if (_.isUndefined(options.files)) {
		 return done(new Error('"options.files" is undefined.'))
	}

	options.files = prepareFiles(options.files)

	console.log(`${options.files.length} icons found`)

	options.checksum = hash.calculate(options.files)

	// Did change?
	// Proceed or Stop here

	options.names = prepareNames(options.rename, options.files)

	if (options.cssDest === undefined) {
		options.cssDest = path.join(options.dest, options.fontName + '.css')
	}

	if (options.htmlDest === undefined) {
		options.htmlDest = path.join(options.dest, options.fontName + '.html')
	}

	options.templateOptions = _.defaults(DEFAULT_TEMPLATE_OPTIONS, options.templateOptions)

	options.codepoints = prepareCodepoints(options.startCodepoint, options.names);


	// TODO output
	generateFonts(options)
		.then(function(result) {
			if (options.writeFiles) {
				writeResult(result, options)
			}

			result.generateCss = function(urls) {
				return renderCss(options, urls)
			}

			done(null, result)
		})
		.catch(function(err) { done(err) })
}


// writeFile :: String -> String -> ()
function writeFile(dest, content) {
	mkdirp.sync(path.dirname(dest))
	fs.writeFileSync(dest, content)
}


function writeResult(fonts, options) {
	_.each(function(pair) {
		var filepath = path.join(options.dest, utils.fileName(options, _.first(pair)))
		writeFile(filepath, _.last(pair))
	}, fonts)

	if (options.css) {
		var css = renderCss(options)
		writeFile(options.cssDest, css)
	}

	if (options.html) {
		var html = renderHtml(options)
		writeFile(options.htmlDest, html)
	}
}


webfont.templates = TEMPLATES

module.exports = webfont
