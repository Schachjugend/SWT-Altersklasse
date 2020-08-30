module.exports = which;

var swtparser = require('swtparser');

function which(swt, to, opts, callback) {
  if (typeof swt === 'object') {
    if (require('buffer').Buffer.isBuffer(swt)) {
      fromBuffer(swt, to, opts, callback);
    }
    else if (swt instanceof DataView) {
      fromDataView(swt, to, opts, callback);
    }
  }
  else if (typeof swt === 'string') {
    fromFile(swt, to, opts, callback);
  }
}

function fromFile(filename, to, opts, callback) {
  require('fs').readFile(filename, function(err, buffer) {
    if (err) return callback(err);
    fromBuffer(buffer, to, opts, callback);
  });
}

function fromBuffer(buffer, to, opts, callback) {
  var arrayBuffer = bufferToArrayBuffer(buffer);
  var view = new DataView(arrayBuffer);

  fromDataView(view, to, opts, callback);
}

function bufferToArrayBuffer(buffer) {
  // see http://stackoverflow.com/questions/8609289/convert-a-binary-nodejs-buffer-to-javascript-arraybuffer
  var ab = new ArrayBuffer(buffer.length);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buffer.length; ++i) {
      view[i] = buffer[i];
  }
  return ab;
}

function arrayBufferToBuffer(ab) {
  var buffer = new Buffer(ab.byteLength);
  for (var i = 0; i < buffer.length; ++i) {
      buffer[i] = ab[i];
  }
  return buffer;
}

function getNearestStructure (version, Structure) {
  var currStructure

  for (var currVersion in Structure.versions) {
    if (parseInt(currVersion) > parseInt(version)) {
      break
    }

    currStructure = Structure.versions[currVersion]
  }

  return currStructure
}


function fromDataView(dataView, to, opts, callback) {
  var tnmt = swtparser(dataView, function(err, tnmt) {
    if (err)
      return callback(err);

    var Structure = require('swtparser/lib/structure.json');

    var version = parseCard(false, dataView, 0, {
      version: {
        type: 'inb',
        from: 609,
        to: 610
      }
    }, Structure)
    version = version.version
    var structure = getNearestStructure(version, Structure)

    var playerOffset = parseInt(structure.parameters['start:fixtures_players']);
    if (tnmt.general[3] !== 0) {
      playerOffset += (tnmt.general[4] * tnmt.general[1] * parseInt(structure.parameters['length:pairing']))
                        + (tnmt.general[80] * tnmt.general[1] * parseInt(structure.parameters['length:pairing']));
    }
    var infoOffset = structure.structures.player[ opts.field ];
    var geburtOffset = structure.structures.player[2008];
    var attributeOffset = structure.structures.player[2013];

    // loop through players
    for (var i = 0; i < tnmt.general[4]; i++, playerOffset += parseInt(structure.parameters['length:player'])) {
      // manipulate 'info X' field
      var birth = getString(dataView, playerOffset+geburtOffset.from, playerOffset+geburtOffset.to);
      var birthYear = birth.slice(0,4);

      var attribute = getString(dataView, playerOffset+attributeOffset.where, playerOffset+attributeOffset.where);

      var ak = getAltersklasse(birthYear, opts.year, attribute);
      if (infoOffset.to - infoOffset.from + 1 === 3 && ak.length === 4) {
        // convert "U12w" to "W12"
        ak = "W" + ak.slice(1,3)
      }
      setString(dataView, playerOffset+infoOffset.from, playerOffset+infoOffset.to, ak);
    }

    var buffer = arrayBufferToBuffer(dataView);
    callback(null, buffer);
  });
}


function getString(view, from, to) {
  value = '';
  for (var i = 0; i <= to-from; i++) {
    var char = view.getUint8(from + i);
    if (char === 0)
      break;
    value += String.fromCharCode(char);
  }
  return value;
}


function setString(view, from, to, value) {
  for (var i = 0; i <= to-from, i < value.length; i++) {
    var code = value.charCodeAt(i);
    view.setUint8(from+i, code);
  }
}


function getAltersklasse(birthYear, year, gender) {
  var under = year - birthYear;
  under += under % 2;

  var res = 'U'+under;
  if (gender === 'w' || gender === 'W') {
    res = res+"w";
  }

  return res;
}

function parseCard (version, view, offset, structure, Structure) {
  if (typeof structure === 'string') {
    // select structure by version first
    var newStructure = selectStructure(version, structure, Structure)
    if (!structure) {
      throw new Error('Missing structure for "' + structure + '" in version ' + version)
    }

    return parseCard(version, view, offset, newStructure, Structure)
  }

  var pos
  var bin

  var object = {}
  var selections = getSelections(version, Structure)
  for (var field in structure) {
    if (structure[field].type === 'int' || structure[field].type === 'inb') {
      // content is integer value, little endian

      // int: little endian; inb: big endian
      var littleEndian = !(structure[field].type === 'int')
      if (structure[field].hasOwnProperty('where')) {
        object[field] = view.getUint8(offset + structure[field].where)
      } else if (structure[field].hasOwnProperty('from') && structure[field].hasOwnProperty('to')) {
        var diff = structure[field].to - structure[field].from
        if (diff === 0) { object[field] = view.getInt8(offset + structure[field].from) } else if (diff === 1) { object[field] = view.getInt16(offset + structure[field].from, littleEndian) } else if (diff === 2) { object[field] = view.getInt32(offset + structure[field].from, littleEndian) }
      }
    } else if (structure[field].type === 'boo') {
      // content is boolean
      if (structure[field].hasOwnProperty('where')) {
        object[field] = view.getUint8(offset + structure[field].where) === 255
      }
    } else if (structure[field].type === 'asc') {
      // content is in ASCII format
      if (structure[field].hasOwnProperty('from') && structure[field].hasOwnProperty('to')) {
        object[field] = getString(view, offset + structure[field].from, offset + structure[field].to)
      } else if (structure[field].hasOwnProperty('where')) {
        pos = offset + structure[field].where
        object[field] = getString(view, pos, pos)
      }
    } else if (structure[field].type === 'dat') {
      var days = 0
      if (structure[field].hasOwnProperty('from') && structure[field].hasOwnProperty('to')) {
        if (structure[field].to === structure[field].from + 1) {
          days = view.getUint16(structure[field].from, true)
        }
      }
      if (days > 0) {
        var date = new Date('12/30/1899')
        date.setTime(date.getTime() + 1000 * 60 * 60 * 24 * days)
        object[field] = date.toDateString()
      }
    } else if (structure[field].type === 'tim') {
      if (structure[field].hasOwnProperty('from') && structure[field].hasOwnProperty('to')) {
        if (structure[field].to === structure[field].from + 1) {
          var d = new Date()
          d.setHours(view.getUint8(structure[field].from))
          d.setMinutes(view.getUint8(structure[field].to))
          if (d.toTimeString().slice(0, 5) !== '00:00') { object[field] = d.toTimeString().slice(0, 5) }
        }
      }
    } else if (structure[field].type === 'bin') {
      // content is binary value
      if (structure[field].hasOwnProperty('where')) {
        bin = view.getUint8(offset + structure[field].where).toString(16)
        if (bin.length === 1) { bin = '0' + bin }
        object[field] = bin
      } else if (structure[field].hasOwnProperty('from') && structure[field].hasOwnProperty('to')) {
        object[field] = ''
        for (pos = structure[field].from; pos <= structure[field].to; pos++) {
          bin = view.getUint8(offset + structure[field].where).toString(16)
          if (bin.length === 1) { bin = '0' + bin }
          object[field] += bin
        }
      }
    } else if (structure[field].type === 'bib') {
      // Content is binary value, big endian

      bin = view.getInt16(offset + structure[field].from, true).toString(16)
      object[field] = bin
    } else if (structure[field].type === 'sel' &&
      structure[field].selection &&
      selections.hasOwnProperty(structure[field].selection)) {
      if (structure[field].hasOwnProperty('where')) {
        var sel = view.getInt8(offset + structure[field].where).toString(16)
        if (sel.length === 1) { sel = '0' + sel }
        sel = sel.toUpperCase()

        if (selections[structure[field].selection].hasOwnProperty(sel)) {
          object[field] = structure[field].selection + '-' + selections[structure[field].selection][sel]
        }
      }
    }
  }

  return object
}

function getSelections (version, Structure) {
  return Structure.selections
}