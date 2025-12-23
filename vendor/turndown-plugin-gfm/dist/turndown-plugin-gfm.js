var turndownPluginGfm = (function (exports) {
'use strict';

var highlightRegExp = /highlight-(?:text|source)-([a-z0-9]+)/;

function highlightedCodeBlock (turndownService) {
  turndownService.addRule('highlightedCodeBlock', {
    filter: function (node) {
      var firstChild = node.firstChild;
      return (
        node.nodeName === 'DIV' &&
        highlightRegExp.test(node.className) &&
        firstChild &&
        firstChild.nodeName === 'PRE'
      )
    },
    replacement: function (content, node, options) {
      var className = node.className || '';
      var language = (className.match(highlightRegExp) || [null, ''])[1];

      return (
        '\n\n' + options.fence + language + '\n' +
        node.firstChild.textContent +
        '\n' + options.fence + '\n\n'
      )
    }
  });
}

function strikethrough (turndownService) {
  turndownService.addRule('strikethrough', {
    filter: ['del', 's', 'strike'],
    replacement: function (content) {
      return '~' + content + '~'
    }
  });
}

var indexOf = Array.prototype.indexOf;
var every = Array.prototype.every;
var rules = {};

rules.tableCell = {
  filter: ['th', 'td'],
  replacement: function (content, node) {
    return cell(content, node)
  }
};

rules.tableRow = {
  filter: 'tr',
  replacement: function (content, node) {
    var borderCells = '';
    var alignMap = { left: ':--', right: '--:', center: ':-:' };

    if (isHeadingRow(node)) {
      for (var i = 0; i < node.childNodes.length; i++) {
        var border = '---';
        var align = (
          node.childNodes[i].getAttribute('align') || ''
        ).toLowerCase();

        if (align) border = alignMap[align] || border;

        borderCells += cell(border, node.childNodes[i]);
      }
    }
    return '\n' + content + (borderCells ? '\n' + borderCells : '')
  }
};

rules.table = {
  // Only convert tables with a heading row.
  // Tables with no heading row are kept using `keep` (see below).
  filter: function (node) {
    return node.nodeName === 'TABLE' && isHeadingRow(node.rows[0])
  },

  replacement: function (content) {
    // Ensure there are no blank lines
    content = content.replace(/\n\n/g, '\n');
    return '\n\n' + content + '\n\n'
  }
};

rules.tableSection = {
  filter: ['thead', 'tbody', 'tfoot'],
  replacement: function (content) {
    return content
  }
};

// A tr is a heading row if:
// - the parent is a THEAD
// - or if its the first child of the TABLE or the first TBODY (possibly
//   following a blank THEAD)
//   - Excel compatibility: Always treat first row as header for Excel tables
//     which use TD instead of TH for headers
function isHeadingRow (tr) {
  var NODE_ELEMENT_NODE = 1;
  var parentNode = tr.parentNode;
  
  // Find first element child (skip text nodes)
  var firstElementChild = parentNode.firstChild;
  while (firstElementChild && firstElementChild.nodeType !== NODE_ELEMENT_NODE) {
    firstElementChild = firstElementChild.nextSibling;
  }
  
  var isFirstRowInTableOrFirstTbody = firstElementChild === tr &&
    (parentNode.nodeName === 'TABLE' || isFirstTbody(parentNode));
  
  return (
    parentNode.nodeName === 'THEAD' ||
    // Treat first row as header for standard tables (with TH) and Excel tables (with TD)
    isFirstRowInTableOrFirstTbody
  )
}

function isFirstTbody (element) {
  var NODE_TEXT_NODE = 3;
  
  if (element.nodeName !== 'TBODY') return false;
  
  var previousSibling = element.previousSibling;
  
  // Skip text nodes and COLGROUP elements
  while (previousSibling && (previousSibling.nodeType === NODE_TEXT_NODE || previousSibling.nodeName === 'COLGROUP' || previousSibling.nodeName === 'COL')) {
    previousSibling = previousSibling.previousSibling;
  }
  
  return (
    !previousSibling ||
    (
      previousSibling.nodeName === 'THEAD' &&
      /^\s*$/i.test(previousSibling.textContent)
    )
  )
}

function cell (content, node) {
  var index = indexOf.call(node.parentNode.childNodes, node);
  var prefix = ' ';
  if (index === 0) prefix = '| ';
  // Trim and remove newlines from cell content
  content = content.trim().replace(/\s*\n\s*/g, ' ');
  return prefix + content + ' |'
}

function tables (turndownService) {
  turndownService.keep(function (node) {
    return node.nodeName === 'TABLE' && !isHeadingRow(node.rows[0])
  });
  for (var key in rules) turndownService.addRule(key, rules[key]);
}

function taskListItems (turndownService) {
  turndownService.addRule('taskListItems', {
    filter: function (node) {
      return node.type === 'checkbox' && node.parentNode.nodeName === 'LI'
    },
    replacement: function (content, node) {
      return (node.checked ? '[x]' : '[ ]') + ' '
    }
  });
}

function gfm (turndownService) {
  turndownService.use([
    highlightedCodeBlock,
    strikethrough,
    tables,
    taskListItems
  ]);
}

exports.gfm = gfm;
exports.highlightedCodeBlock = highlightedCodeBlock;
exports.strikethrough = strikethrough;
exports.tables = tables;
exports.taskListItems = taskListItems;

return exports;

}({}));
