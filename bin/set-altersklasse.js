var fs = require('fs');
var change = require('../lib/index');

var year = (new Date()).getFullYear();

var opts = require('nomnom')
   .option('input', {
      abbr: 'i',
      flag: false,
      help: 'SWT file',
      required: true
   })
   .option('output', {
      abbr: 'o',
      flag: false,
      help: 'SWT file output',
      required: true
   })
   .option('year', {
      help: 'Year to calculate with',
      default: year
   })
   .option('field', {
      help: 'field number to use (see SWT-structure-files; e.g. 2002=Titel, 2006=Land, 2035=Info 1)',
      default: 2035
   })
   .option('version', {
      flag: true,
      help: 'print version and exit',
      callback: function() {
         return require('../package.json').version;
      }
   })
   .parse();

change(opts.input, opts.to, opts, function(err, out) {
  if (err)
    throw err;

  fs.writeFileSync(opts.output, out);
});