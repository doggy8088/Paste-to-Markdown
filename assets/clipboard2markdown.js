(function () {
  'use strict';

  var turndownService = new TurndownService({
    headingStyle: 'atx',
    hr: '- - -',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full',
    br: '  ',
    preformattedCode: false,
  });

  turndownService.remove('style');

  // Custom rules
  turndownService.addRule('sup', {
    filter: 'sup',
    replacement: function (content) { return '^' + content + '^'; }
  });

  turndownService.addRule('sub', {
    filter: 'sub',
    replacement: function (content) { return '~' + content + '~'; }
  });

  turndownService.addRule('emItalic', {
    filter: ['em', 'i', 'cite', 'var'],
    replacement: function (content) { return '*' + content + '*'; }
  });

  turndownService.addRule('inlineCode', {
    filter: function (node) {
      var hasSiblings = node.previousSibling || node.nextSibling;
      var isCodeBlock = node.parentNode.nodeName === 'PRE' && !hasSiblings;
      var isCodeElem = node.nodeName === 'CODE' ||
        node.nodeName === 'KBD' ||
        node.nodeName === 'SAMP' ||
        node.nodeName === 'TT';
      return isCodeElem && !isCodeBlock;
    },
    replacement: function (content) { return '`' + content + '`'; }
  });

  turndownService.addRule('anchor', {
    filter: function (node) {
      return node.nodeName === 'A' && node.getAttribute('href');
    },
    replacement: function (content, node) {
      var url = node.getAttribute('href');
      var titlePart = node.title ? ' "' + node.title + '"' : '';
      if (content === '') return '';
      if (content === url) return '<' + url + '>';
      if (url === ('mailto:' + content)) return '<' + content + '>';
      return '[' + content + '](' + url + titlePart + ')';
    }
  });

  turndownService.addRule('listItem', {
    filter: 'li',
    replacement: function (content, node) {
      content = content.replace(/^\s+/, '').replace(/\n/gm, '\n    ');
      var prefix = '- ';
      var parent = node.parentNode;
      if (/ol/i.test(parent.nodeName)) {
        var index = Array.prototype.indexOf.call(parent.children, node) + 1;
        prefix = index + '. ';
      }
      return prefix + content;
    }
  });

  // Smart punctuation escape
  var escape = function (str) {
    return str.replace(/[\u2018\u2019\u00b4]/g, "'")
      .replace(/[\u201c\u201d\u2033]/g, '"')
      .replace(/[\u2212\u2022\u00b7\u25aa]/g, '-')
      .replace(/[\u2013\u2015]/g, '--')
      .replace(/\u2014/g, '---')
      .replace(/\u2026/g, '...')
      .replace(/[ ]+\n/g, '\n')
      .replace(/\s*\\\n/g, '\\\n')
      .replace(/\s*\\\n\s*\\\n/g, '\n\n')
      .replace(/\s*\\\n\n/g, '\n\n')
      .replace(/\n-\n/g, '\n')
      .replace(/\n\n\s*\\\n/g, '\n\n')
      .replace(/\n\n\n*/g, '\n\n')
      .replace(/[ ]+$/gm, '')
      .replace(/^\s+|[\s\\]+$/g, '')
      .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
      .replace(/[\u200B\uFEFF]/g, '');
  };

  var convert = function (html) {
    return escape(turndownService.turndown(html));
  };

  var insert = function (myField, myValue) {
    if (document.selection) {
      myField.focus();
      var sel = document.selection.createRange();
      sel.text = myValue;
      sel.select();
    } else {
      if (myField.selectionStart || myField.selectionStart === '0') {
        var startPos = myField.selectionStart;
        var endPos = myField.selectionEnd;
        var beforeValue = myField.value.substring(0, startPos);
        var afterValue = myField.value.substring(endPos, myField.value.length);
        myField.value = beforeValue + myValue + afterValue;
        myField.selectionStart = startPos + myValue.length;
        myField.selectionEnd = startPos + myValue.length;
        myField.focus();
      } else {
        myField.value += myValue;
        myField.focus();
      }
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var info = document.querySelector('#info');
    var pastebin = document.querySelector('#pastebin');
    var output = document.querySelector('#output');
    var wrapper = document.querySelector('#wrapper');

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        output.value = '';
        wrapper.classList.add('hidden');
        info.classList.remove('hidden');
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        if (String.fromCharCode(event.which).toLowerCase() === 'v') {
          pastebin.innerHTML = '';
          pastebin.focus();
          info.classList.add('hidden');
          wrapper.classList.add('hidden');
        }
      }
    });

    pastebin.addEventListener('paste', function (event) {
      console.log('clipboardData types', event.clipboardData.types);

      // VS Code editor data
      if (event.clipboardData.types.includes('vscode-editor-data') && event.clipboardData.types.includes('text/plain')) {
        var text = event.clipboardData.getData('text/plain');
        var lines = text.split('\n');
        var minSpaces = lines.reduce(function (min, line) {
          if (line.trim() === '') return min;
          var spaces = line.match(/^\s*/)[0].length;
          return (spaces < min) ? spaces : min;
        }, Infinity);
        text = lines.map(function (line) { return line.slice(minSpaces); }).join('\n');

        insert(output, text);
        wrapper.classList.remove('hidden');
        output.focus();
        output.select();
        event.preventDefault();
        return;
      }

      // Word / RTF
      if (event.clipboardData.types.includes('text/rtf') && event.clipboardData.types.includes('text/html')) {
        var html = event.clipboardData.getData('text/html');
        var markdown = turndownService.turndown(html).trim();
        markdown = markdown.replace(/ü/g, '  - ');
        markdown = markdown.replace(/\.[^\S\r\n]+/g, '. ');
        markdown = markdown.replace(/-[^\S\r\n]+/g, '- ');
        markdown = markdown.replace(/[^\S\r\n]/g, ' ');

        insert(output, markdown);
        wrapper.classList.remove('hidden');
        output.focus();
        output.select();
        event.preventDefault();
        return;
      }

      // Normal HTML
      var html = event.clipboardData.getData('text/html');
      html = html.replace(/<li([^>]*)>\s*<p([^>]*)>(.*?)<\/p>\s*<\/li>/g, '<li>$3</li>');

      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');
      var body = doc.querySelector('body').innerHTML;
      var markdown = convert(body);

      insert(output, markdown);
      wrapper.classList.remove('hidden');
      output.focus();
      output.select();
      event.preventDefault();
    });
  });
})();
