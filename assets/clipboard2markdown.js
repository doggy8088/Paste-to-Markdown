(function () {
  'use strict';

  const turndownService = new TurndownService({
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
    var preview = document.querySelector('#preview');

    // Tab switching functionality
    var tabButtons = document.querySelectorAll('.tab-button');
    var tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(function(button) {
      button.addEventListener('click', function() {
        var targetTab = this.getAttribute('data-tab');
        
        // Remove active class from all buttons and contents
        tabButtons.forEach(function(btn) {
          btn.classList.remove('active');
        });
        tabContents.forEach(function(content) {
          content.classList.remove('active');
        });
        
        // Add active class to clicked button and corresponding content
        this.classList.add('active');
        document.getElementById(targetTab + '-tab').classList.add('active');
        
        // Update preview when switching to preview tab
        if (targetTab === 'preview') {
          updatePreview();
        }
      });
    });

    // Function to update preview with rendered markdown
    function updatePreview() {
      var markdown = output.value;
      if (markdown) {
        // Convert markdown to HTML using marked-style approach
        // Since we don't have a markdown-to-HTML library, we'll do basic conversion
        var html = markdownToHtml(markdown);
        preview.innerHTML = html;
      } else {
        preview.innerHTML = '<p style="color: #999;">沒有內容可預覽</p>';
      }
    }

    // Simple markdown to HTML converter
    function markdownToHtml(markdown) {
      var lines = markdown.split('\n');
      var html = '';
      var inUnorderedList = false;
      var inOrderedList = false;
      var inCodeBlock = false;
      var codeBlockContent = '';
      
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var trimmedLine = line.trim();
        
        // Handle code blocks
        if (trimmedLine.startsWith('```')) {
          if (!inCodeBlock) {
            inCodeBlock = true;
            codeBlockContent = '';
            continue;
          } else {
            inCodeBlock = false;
            html += '<pre><code>' + escapeHtml(codeBlockContent.trim()) + '</code></pre>';
            continue;
          }
        }
        
        if (inCodeBlock) {
          codeBlockContent += line + '\n';
          continue;
        }
        
        // Close lists when encountering non-list content
        if (!trimmedLine.match(/^[-*+]\s/) && !trimmedLine.match(/^\d+\.\s/)) {
          if (inUnorderedList) {
            html += '</ul>';
            inUnorderedList = false;
          }
          if (inOrderedList) {
            html += '</ol>';
            inOrderedList = false;
          }
        }
        
        // Skip empty lines outside of content
        if (trimmedLine === '') {
          if (inUnorderedList) {
            html += '</ul>';
            inUnorderedList = false;
          }
          if (inOrderedList) {
            html += '</ol>';
            inOrderedList = false;
          }
          continue;
        }
        
        // Headers
        if (trimmedLine.match(/^####\s/)) {
          html += '<h4>' + processInlineMarkdown(trimmedLine.substring(5)) + '</h4>';
        } else if (trimmedLine.match(/^###\s/)) {
          html += '<h3>' + processInlineMarkdown(trimmedLine.substring(4)) + '</h3>';
        } else if (trimmedLine.match(/^##\s/)) {
          html += '<h2>' + processInlineMarkdown(trimmedLine.substring(3)) + '</h2>';
        } else if (trimmedLine.match(/^#\s/)) {
          html += '<h1>' + processInlineMarkdown(trimmedLine.substring(2)) + '</h1>';
        }
        // Horizontal rule
        else if (trimmedLine.match(/^[\*\-_]{3,}$/)) {
          html += '<hr>';
        }
        // Unordered list
        else if (trimmedLine.match(/^[-*+]\s/)) {
          if (!inUnorderedList) {
            html += '<ul>';
            inUnorderedList = true;
          }
          var listContent = trimmedLine.replace(/^[-*+]\s/, '');
          html += '<li>' + processInlineMarkdown(listContent) + '</li>';
        }
        // Ordered list
        else if (trimmedLine.match(/^\d+\.\s/)) {
          if (!inOrderedList) {
            html += '<ol>';
            inOrderedList = true;
          }
          var listContent = trimmedLine.replace(/^\d+\.\s/, '');
          html += '<li>' + processInlineMarkdown(listContent) + '</li>';
        }
        // Regular paragraph
        else {
          html += '<p>' + processInlineMarkdown(trimmedLine) + '</p>';
        }
      }
      
      // Close any open lists at the end
      if (inUnorderedList) {
        html += '</ul>';
      }
      if (inOrderedList) {
        html += '</ol>';
      }
      
      return html;
    }
    
    // Process inline markdown (bold, italic, links, code, images)
    function processInlineMarkdown(text) {
      // Escape HTML first
      text = escapeHtml(text);
      
      // Images (must be before links)
      text = text.replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, function(match, alt, url) {
        // Validate URL to prevent XSS
        if (isSafeUrl(url)) {
          return '<img src="' + url + '" alt="' + alt + '" style="max-width: 100%;" />';
        }
        return match;
      });
      
      // Links
      text = text.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, function(match, text, url) {
        // Validate URL to prevent XSS
        if (isSafeUrl(url)) {
          return '<a href="' + url + '" target="_blank">' + text + '</a>';
        }
        return match;
      });
      
      // Bold (must be before italic)
      text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
      
      // Italic
      text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
      text = text.replace(/_(.+?)_/g, '<em>$1</em>');
      
      // Inline code
      text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
      
      return text;
    }
    
    // Validate URL to prevent XSS attacks
    function isSafeUrl(url) {
      if (!url) return false;
      var trimmedUrl = url.trim().toLowerCase();
      // Only allow http, https, and relative URLs
      // Block javascript:, data:, vbscript:, file:, etc.
      return trimmedUrl.startsWith('http://') || 
             trimmedUrl.startsWith('https://') || 
             trimmedUrl.startsWith('/') ||
             trimmedUrl.startsWith('./') ||
             trimmedUrl.startsWith('../') ||
             (!trimmedUrl.includes(':'));
    }
    
    // Escape HTML to prevent XSS
    function escapeHtml(text) {
      var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

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
      var html = event.clipboardData.getData('text/html');

      // delete p tag inside li tag, including any attributes defined in p tag and li tag
      html = html.replace(/<li([^>]*)>\s*<p([^>]*)>(.*?)<\/p>\s*<\/li>/g, '<li>$3</li>');

      console.log('HTML:', html);

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
