(function () {
  'use strict';

  const turndownService = new TurndownService({
    bulletListMarker: "-",
    linkReferenceStyle: 'shortcut'
  });

  turndownService.remove('style');

  // http://pandoc.org/README.html#pandocs-markdown
  var pandoc = [
    {
      filter: 'h1',
      replacement: function (content, node) {
        return '# ' + content + '\n\n';
      }
    },

    {
      filter: 'h2',
      replacement: function (content, node) {
        return '## ' + content + '\n\n';
      }
    },

    {
      filter: 'sup',
      replacement: function (content) {
        return '^' + content + '^';
      }
    },

    {
      filter: 'sub',
      replacement: function (content) {
        return '~' + content + '~';
      }
    },

    {
      filter: 'br',
      replacement: function () {
        return '\\\n';
      }
    },

    {
      filter: 'hr',
      replacement: function () {
        return '\n\n* * * * *\n\n';
      }
    },

    {
      filter: ['em', 'i', 'cite', 'var'],
      replacement: function (content) {
        return '*' + content + '*';
      }
    },

    {
      filter: function (node) {
        var hasSiblings = node.previousSibling || node.nextSibling;
        var isCodeBlock = node.parentNode.nodeName === 'PRE' && !hasSiblings;
        var isCodeElem = node.nodeName === 'CODE' ||
          node.nodeName === 'KBD' ||
          node.nodeName === 'SAMP' ||
          node.nodeName === 'TT';

        return isCodeElem && !isCodeBlock;
      },
      replacement: function (content) {
        return '`' + content + '`';
      }
    },

    {
      filter: function (node) {
        return node.nodeName === 'A' && node.getAttribute('href');
      },
      replacement: function (content, node) {
        var url = node.getAttribute('href');
        var titlePart = node.title ? ' "' + node.title + '"' : '';
        if (content === '') {
          return '';
        } else if (content === url) {
          return '<' + url + '>';
        } else if (url === ('mailto:' + content)) {
          return '<' + content + '>';
        } else {
          return '[' + content + '](' + url + titlePart + ')';
        }
      }
    },

    {
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
    }
  ];

  // http://pandoc.org/README.html#smart-punctuation
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
      // ZERO WIDTH SPACE: https://jkorpela.fi/chars/spaces.html
      .replace(/[\u200B\uFEFF]/g, '');
  };

  var convert = function (str) {
    return escape(toMarkdown(str, { converters: pandoc, gfm: true }));
  }

  var insert = function (myField, myValue) {
    if (document.selection) {
      myField.focus();
      sel = document.selection.createRange();
      sel.text = myValue;
      sel.select()
    } else {
      if (myField.selectionStart || myField.selectionStart == "0") {
        var startPos = myField.selectionStart;
        var endPos = myField.selectionEnd;
        var beforeValue = myField.value.substring(0, startPos);
        var afterValue = myField.value.substring(endPos, myField.value.length);
        myField.value = beforeValue + myValue + afterValue;
        myField.selectionStart = startPos + myValue.length;
        myField.selectionEnd = startPos + myValue.length;
        myField.focus()
      } else {
        myField.value += myValue;
        myField.focus()
      }
    }
  };

  // http://stackoverflow.com/questions/2176861/javascript-get-clipboard-data-on-paste-event-cross-browser
  document.addEventListener('DOMContentLoaded', function () {
    var info = document.querySelector('#info');
    var pastebin = document.querySelector('#pastebin');
    var output = document.querySelector('#output');
    var wrapper = document.querySelector('#wrapper');

    document.addEventListener('keydown', function (event) {
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

      // list all clipboardData types
      console.log('clipboardData types', event.clipboardData.types);

      // Check if 'vscode-editor-data' is available in the clipboard
      if (event.clipboardData.types.includes('vscode-editor-data') && event.clipboardData.types.includes('text/plain')) {
        var text = event.clipboardData.getData('text/plain');
        console.log('Both vscode-editor-data and text/plain:', text);
        // 找到每一行中最少的前綴空白字元，然後將每一行的這幾個空白字元刪除
        var lines = text.split('\n');
        var minSpaces = lines.reduce((min, line) => {
          if (line.trim() === '') return min;
          const spaces = line.match(/^\s*/)[0].length;
          return (spaces < min) ? spaces : min;
        }, Infinity);
        text = lines.map(line => line.slice(minSpaces)).join('\n');

        console.log('Plain Text: ', text);

        insert(output, text);
        wrapper.classList.remove('hidden');
        output.focus();
        output.select();
        event.preventDefault();
        return;
      }

      // Word HTML '<w:WordDocument>'
      if (event.clipboardData.types.includes('text/rtf') && event.clipboardData.types.includes('text/html')) {
        var html = event.clipboardData.getData('text/html');
        console.log('Both text/rtf and text/html:', html);
        var markdown = turndownService.turndown(html).trim();
        markdown = markdown.replace(/ü/g, '  - ');
        markdown = markdown.replace(/\.[^\S\r\n]+/g, '. ');
        markdown = markdown.replace(/-[^\S\r\n]+/g, '- ');
        markdown = markdown.replace(/[^\S\r\n]/g, ' ');

        console.log('Markdown: ', markdown);

        insert(output, markdown);
        wrapper.classList.remove('hidden');
        output.focus();
        output.select();
        event.preventDefault();
        return;
      }

      // Normal HTML

      var parser = new DOMParser()
      var doc = parser.parseFromString(html, 'text/html')

      var body = doc.querySelector('body').innerHTML;

      var markdown = convert(body);

      insert(output, markdown);
      wrapper.classList.remove('hidden');
      output.focus();
      output.select();

      event.preventDefault();
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      document.getElementById('output').value = '';
      wrapper.classList.add('hidden');
      info.classList.remove('hidden');
    }
  });

})();
