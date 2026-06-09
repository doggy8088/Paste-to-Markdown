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

  // Use the tables plugin from turndown-plugin-gfm for table support
  turndownService.use(turndownPluginGfm.tables);

  // Custom rule: preserve <br> as <br> inside table cells
  turndownService.addRule('brInTableCell', {
    filter: function (node) {
      if (node.nodeName !== 'BR') return false;
      // Check if br is inside a table cell (td or th)
      var parent = node.parentNode;
      while (parent) {
        if (parent.nodeName === 'TD' || parent.nodeName === 'TH') {
          return true;
        }
        if (parent.nodeName === 'TABLE' || parent.nodeName === 'BODY') {
          break;
        }
        parent = parent.parentNode;
      }
      return false;
    },
    replacement: function () {
      return '<br>';
    }
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
        return '\n\n---\n\n';
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
        var trimmed = content.trim();
        if (trimmed === '') {
          return '';
        }
        trimmed = trimmed
          .split(/\r?\n+/)
          .map(function (part) {
            return part.trim();
          })
          .filter(Boolean)
          .join(' ');

        if (trimmed === url) {
          return '<' + url + '>';
        } else if (url === ('mailto:' + trimmed)) {
          return '<' + trimmed + '>';
        } else {
          return '[' + trimmed + '](' + url + titlePart + ')';
        }
      }
    },

    {
      filter: ['strong', 'b'],
      replacement: function (content) {
        var trimmed = content.trim();
        return trimmed ? '**' + trimmed + '**' : '';
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
    var markdown = escape(toMarkdown(str, { converters: pandoc, gfm: true }));

    // Parentheses normalization next to Chinese text
    markdown = markdown.replace(/([\u4e00-\u9fa5]+)\s*\(([^)]+)\)\s*(?=[\u4e00-\u9fa5]|\*)/g, '$1（$2）');

    // Convert Chinese blockquotes
    markdown = markdown.replace(/^(「[^\n]+?」)(?:或者：(「[^\n]+?」))+/gm, function (match) {
      var parts = match.split('或者：');
      var formatted = parts.map(function (part) {
        return '> ' + part.trim();
      });
      return formatted.join('\n>\n> 或者：\n>\n');
    });

    // Convert bold law headings to H3
    markdown = markdown.replace(/^[ ]*\*\*(第[零一二三四五六七八九十]+[定律法則].+?)\*\*[ ]*$/gm, '### $1');

    // Format the specific management model levels as a list
    markdown = markdown.replace(/^(SOUL\.md|agent-scope\.yaml|執行階段配置|代理註冊表|外部監控) ---/gm, '- $1 ---');
    // Remove blank lines between list items
    markdown = markdown.replace(/(^- (?:SOUL\.md|agent-scope\.yaml|執行階段配置|代理註冊表|外部監控)[^\n]+)\n\n+(?=- (?:SOUL\.md|agent-scope\.yaml|執行階段配置|代理註冊表|外部監控))/gm, '$1\n');

    // Add separator before tags section (non-global to only replace the first occurrence)
    markdown = markdown.replace(/\n+\[(人工智慧|Cybersecurity)\]\(/, '\n\n---\n\n[$1](');

    return markdown;
  };

  var WORD_LIST_INDENT_SPACES = 2;
  var WORD_LIST_INDENT_PT_PER_LEVEL = 24;

  var convertWordUnorderedListPlainText = function (text) {
    // Word copies Symbol-font bullets as private-use characters in text/plain.
    var bulletLevels = {
      '\uf06c': 0,
      '\uf06e': 1
    };
    var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    var convertedLines = [];
    var matched = false;

    for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      if (lines[lineIndex].trim() === '') {
        convertedLines.push('');
        continue;
      }

      var match = lines[lineIndex].match(/^\s*([\uf06c\uf06e])[\t ]+(.+?)\s*$/);
      if (!match) {
        return null;
      }

      matched = true;
      var indentation = ' '.repeat(bulletLevels[match[1]] * WORD_LIST_INDENT_SPACES);
      convertedLines.push(indentation + '- ' + match[2]);
    }

    return matched ? convertedLines.join('\n') : null;
  };

  var getWordHtmlListLevel = function (tag) {
    var styleMatch = tag.match(/\sstyle=(?:"([^"]*)"|'([^']*)')/i);
    var style = styleMatch ? (styleMatch[1] || styleMatch[2]) : '';
    var marginMatch = style.match(/margin-left:\s*([0-9.]+)pt/i);
    if (marginMatch) {
      return Math.max(0, Math.round(parseFloat(marginMatch[1]) / WORD_LIST_INDENT_PT_PER_LEVEL) - 1);
    }

    var levelMatch = style.match(/mso-list:[^;'"]*\blevel(\d+)/i);
    return levelMatch ? parseInt(levelMatch[1], 10) - 1 : 0;
  };

  var normalizeWordHtmlLists = function (html) {
    var paragraphPattern = /(<p\b[^>]*>)([\s\S]*?)(<\/p>)/gi;
    var output = '';
    var lastIndex = 0;
    var currentLevel = 0;
    var hasOpenListItem = false;

    var closeLists = function () {
      if (!hasOpenListItem) {
        return;
      }

      while (currentLevel > 0) {
        output += '</li></ul>';
        currentLevel--;
      }
      output += '</li></ul>';
      hasOpenListItem = false;
    };

    var appendListItem = function (level, content) {
      if (!hasOpenListItem) {
        output += '<ul><li>' + content;
        hasOpenListItem = true;
        currentLevel = 0;
        return;
      }

      if (level > currentLevel + 1) {
        // Normalize skipped Word levels so the generated HTML remains a valid nested list.
        level = currentLevel + 1;
      }

      var descended = false;
      while (level > currentLevel) {
        output += '<ul><li>';
        currentLevel++;
        descended = true;
      }
      if (descended) {
        output += content;
        return;
      }

      while (level < currentLevel) {
        output += '</li></ul>';
        currentLevel--;
      }

      output += '</li><li>' + content;
    };

    html.replace(paragraphPattern, function (match, openingTag, content, closingTag, offset) {
      output += html.slice(lastIndex, offset);
      lastIndex = offset + match.length;

      var isListParagraph = /mso-list:/i.test(openingTag);
      var hasWordBulletMarker = /mso-list:Ignore/i.test(content);
      if (!isListParagraph || !hasWordBulletMarker) {
        closeLists();
        output += match;
        return match;
      }

      var listContent = content
        .replace(/<!\[if !supportLists\]>[\s\S]*?<!\[endif\]>/gi, '')
        .replace(/<o:p>[\s\S]*?<\/o:p>/gi, '');
      appendListItem(getWordHtmlListLevel(openingTag), listContent);
      return match;
    });

    closeLists();
    output += html.slice(lastIndex);
    return output;
  };

  // Plain text processing rules
  var plainTextRules = {
    wordUnorderedList: function (text) {
      var markdown = convertWordUnorderedListPlainText(text);
      if (markdown === null) {
        return null;
      }

      console.log('Matched: Word unordered list plain text');
      return markdown;
    },

    // Copilot CLI format: first line starts with ' ● ', remaining lines start with '   ' (3 spaces)
    copilotCli: function (text) {
      var lines = text.split('\n');
      if (lines.length === 0 || (!lines[0].startsWith(' ● ') && !lines[0].startsWith(' > '))) {
        return null; // Pattern not matched
      }

      // Check if all non-empty remaining lines start with '   ' (3 spaces)
      var isMatched = true;
      for (var i = 1; i < lines.length; i++) {
        if (lines[i].trim() !== '' && !lines[i].startsWith('   ')) {
          isMatched = false;
          break;
        }
      }

      if (!isMatched) {
        return null; // Pattern not matched
      }

      console.log('Matched: Copilot CLI format');
      // Remove ' ● ' from first line
      lines[0] = lines[0].substring(3);
      // Remove '   ' (3 spaces) from remaining lines
      for (var i = 1; i < lines.length; i++) {
        if (lines[i].startsWith('   ')) {
          lines[i] = lines[i].substring(3);
        }
      }
      return lines.join('\n');
    },

    // Generic plain text: remove common leading spaces from all lines
    genericPlainText: function (text) {
      var lines = text.split('\n');
      if (lines.length === 0) {
        return text;
      }

      // Find the minimum number of leading spaces (excluding empty lines)
      var minSpaces = Infinity;
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].trim() !== '') {
          var spaces = lines[i].match(/^\s*/)[0].length;
          minSpaces = Math.min(minSpaces, spaces);
        }
      }

      // If no leading spaces found or infinite spaces, return original text
      if (minSpaces === Infinity || minSpaces === 0) {
        return text;
      }

      console.log('Matched: Generic plain text with ' + minSpaces + ' leading spaces');
      // Remove common leading spaces from all lines
      return lines.map(function (line) {
        return line.slice(minSpaces);
      }).join('\n');
    }
  };

  // Apply plain text rules in order
  var applyPlainTextRules = function (text) {
    // Try each rule in order
    for (var ruleName in plainTextRules) {
      var result = plainTextRules[ruleName](text);
      if (result !== null) {
        return result;
      }
    }
    // If no rule matched, return original text
    return text;
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
    var shareButton = document.querySelector('#share-button');
    var tabsContainer = document.querySelector('.tabs');
    var themeButtons = document.querySelectorAll('.theme-button');
    var shareButtonBusy = false;
    var sharedHashSeed = '';
    var hasEditedFromSharedHash = false;
    var SHARE_HASH_PREFIX = 'z:';
    var RAW_HASH_PREFIX = 'r:';
    var themeStorageKey = 'pasteToMarkdownTheme';

    // Tab switching functionality
    var tabButtons = document.querySelectorAll('.tab-button');
    var tabContents = document.querySelectorAll('.tab-content');
    // Prefer userAgentData when available (it may be unavailable outside secure
    // contexts), but keep older navigator properties as fallbacks so shortcut
    // hints still work in browsers without that API.
    var nav = window.navigator || {};
    var platform = (
      (nav.userAgentData && nav.userAgentData.platform) ||
      nav.platform ||
      nav.userAgent ||
      ''
    ).toLowerCase();
    var isMacPlatform = /mac|iphone|ipad|ipod/.test(platform);

    function getShortcutModifierLabel() {
      return isMacPlatform ? 'Option' : 'Alt';
    }

    function updateTabShortcutHints() {
      var modifier = getShortcutModifierLabel();
      var shortcuts = [];

      tabButtons.forEach(function(button, index) {
        var shortcut = modifier + '+' + String(index + 1);
        var label = button.textContent.trim();
        button.title = label + ' (' + shortcut + ')';
        shortcuts.push(label + ' (' + shortcut + ')');
      });

      if (tabsContainer) {
        // Also set the container title so hovering the gap around the buttons
        // still shows the shortcut hint for the whole tab area.
        tabsContainer.title = shortcuts.join(' • ');
      }
    }

    function getStoredThemeChoice() {
      try {
        var savedTheme = localStorage.getItem(themeStorageKey);
        if (savedTheme === 'light' || savedTheme === 'dark') {
          return savedTheme;
        }
      } catch (error) {
        return 'system';
      }

      return 'system';
    }

    function setThemeChoice(themeChoice) {
      var nextThemeChoice = themeChoice === 'light' || themeChoice === 'dark' ? themeChoice : 'system';

      if (nextThemeChoice === 'system') {
        document.documentElement.removeAttribute('data-theme');
        document.body.removeAttribute('data-theme');
        document.body.style.background = '';
        document.body.style.backgroundAttachment = '';
        document.body.style.backgroundPosition = '';
        document.body.style.backgroundRepeat = '';
        document.body.style.backgroundSize = '';
        document.body.style.color = '';
      } else {
        document.documentElement.setAttribute('data-theme', nextThemeChoice);
        document.body.setAttribute('data-theme', nextThemeChoice);
        if (nextThemeChoice === 'light') {
          document.body.style.background = 'linear-gradient(rgba(245, 247, 251, 0.74), rgba(245, 247, 251, 0.74)), url("./assets/workspace-bg-light.png"), radial-gradient(circle at top left, #eef4ff, transparent 36rem), #f5f7fb';
          document.body.style.color = '#17202e';
        } else {
          document.body.style.background = 'linear-gradient(rgba(14, 20, 29, 0.72), rgba(14, 20, 29, 0.72)), url("./assets/workspace-bg-dark.png"), radial-gradient(circle at top left, #101b2d, transparent 36rem), #0e141d';
          document.body.style.color = '#eef4ff';
        }
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundPosition = 'center top';
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.style.backgroundSize = 'cover';
      }

      try {
        if (nextThemeChoice === 'system') {
          localStorage.removeItem(themeStorageKey);
        } else {
          localStorage.setItem(themeStorageKey, nextThemeChoice);
        }
      } catch (error) {
        // Theme choice is an enhancement; system preference remains the safe fallback.
      }

      themeButtons.forEach(function(button) {
        var isActive = button.getAttribute('data-theme-choice') === nextThemeChoice;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }

    function matchesTabShortcut(event, digit) {
      // macOS Option+number can change event.key to a symbol, so we match the
      // physical digit key via event.code and keep event.key as a fallback.
      return event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        (event.code === 'Digit' + digit || event.key === String(digit));
    }

    function matchesShareShortcut(event) {
      return event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        (event.key === 's' || event.key === 'S' || event.code === 'KeyS');
    }

    async function executeShareAction() {
      if (!shareButton || shareButtonBusy) {
        return;
      }

      shareButtonBusy = true;
      shareButton.disabled = true;

      try {
        var shareParams = new URLSearchParams();
        shareParams.set('mode', getActiveTab());
        shareParams.set('text', await buildHashFromCurrentState());

        var hash = shareParams.toString();
        var shareUrl = window.location.origin + window.location.pathname + window.location.search + '#' + hash;

        window.location.hash = hash;

        var linkText = getShareTitle(output.value);
        var linkHtml = '<a href="' + toEscapedHtml(shareUrl) + '">' + toEscapedHtml(linkText) + '</a>';
        var plainBlob = new Blob([shareUrl], { type: 'text/plain' });
        var htmlBlob = new Blob([linkHtml], { type: 'text/html' });

        if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
          var item = new ClipboardItem({
            'text/plain': plainBlob,
            'text/html': htmlBlob
          });
          await navigator.clipboard.write([item]);
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(shareUrl);
        } else {
          throw new Error('Clipboard API is not available');
        }

        shareButton.textContent = window.i18n ? i18n.t('shareSuccess') : '🔗 Copied';
      } catch (error) {
        console.error('Unable to copy share URL.', error);
        if (window.i18n) {
          shareButton.textContent = i18n.t('shareButton');
        } else {
          shareButton.textContent = '🔗 Share';
        }
      } finally {
        setTimeout(function () {
          refreshShareButtonLabel();
          shareButton.disabled = false;
          shareButtonBusy = false;
        }, 1200);
      }
    }

    function getActiveTab() {
      var activeButton = document.querySelector('.tab-button.active');
      return activeButton ? activeButton.getAttribute('data-tab') : 'edit';
    }

    function activateTab(targetTab, options) {
      var requestedTab = targetTab === 'preview' ? 'preview' : 'edit';
      var isFound = false;

      tabButtons.forEach(function(button) {
        var isTarget = button.getAttribute('data-tab') === requestedTab;
        button.classList.toggle('active', isTarget);
        button.setAttribute('aria-selected', isTarget ? 'true' : 'false');
        if (isTarget) {
          isFound = true;
        }
      });

      if (!isFound) {
        return;
      }

      tabContents.forEach(function(content) {
        content.classList.toggle('active', content.id === requestedTab + '-tab');
      });

      if (requestedTab === 'preview') {
        updatePreview();
      } else if (options && options.focus === true) {
        output.focus();
      }
    }

    function prepareForPaste() {
      pastebin.innerHTML = '';
      pastebin.focus();
      info.classList.add('hidden');
      wrapper.classList.add('hidden');
    }

    function resetOutputView() {
      output.value = '';
      sharedHashSeed = '';
      hasEditedFromSharedHash = false;
      clearHashModeState();
      wrapper.classList.remove('hidden');
      info.classList.remove('hidden');
    }

    tabButtons.forEach(function(button) {
      button.addEventListener('click', function() {
        activateTab(button.getAttribute('data-tab'), { focus: true });
      });
    });

    refreshShareButtonLabel();
    hideIntroIfHashProvided();
    updateTabShortcutHints();
    setThemeChoice(getStoredThemeChoice());

    themeButtons.forEach(function(button) {
      button.addEventListener('click', function() {
        setThemeChoice(button.getAttribute('data-theme-choice'));
      });
    });

    // Function to update preview with rendered markdown
    function updatePreview() {
      var markdown = output.value;
      if (markdown) {
        // Configure marked for security
        marked.setOptions({
          breaks: true,
          gfm: true,
          headerIds: false,
          mangle: false,
          sanitize: false // We sanitize the output manually
        });

        // Use marked to convert markdown to HTML
        var html = marked.parse(markdown);

        // Sanitize the output to prevent XSS
        html = sanitizeHtml(html);

        preview.innerHTML = html;
      } else {
        preview.innerHTML = '<p class="empty-preview">' + (window.i18n ? i18n.t('noPreview') : 'No content to preview') + '</p>';
      }
    }

    // Update preview when language changes
    document.addEventListener('languageChange', function() {
      var previewTab = document.getElementById('preview-tab');
      if (previewTab.classList.contains('active')) {
        updatePreview();
      }
      // i18n rewrites the tab button labels, so refresh the tooltip text too.
      refreshShareButtonLabel();
      syncHashModeState();
      updateTabShortcutHints();
    });

    if (shareButton) {
      shareButton.addEventListener('click', function () {
        executeShareAction();
      });
    }

    // Monitor output changes and update preview if preview tab is active
    output.addEventListener('input', function() {
      var previewTab = document.getElementById('preview-tab');
      if (isHashProvided()) {
        clearSharedHashSeedContent();
      }

      if (previewTab.classList.contains('active')) {
        updatePreview();
      }
    });

    function clearSharedHashSeedContent() {
      if (!isHashProvided() || hasEditedFromSharedHash) {
        return;
      }

      hasEditedFromSharedHash = true;
      sharedHashSeed = '';
      clearHashModeState();
      output.value = '';

      if (!output.value) {
        output.focus();
      }
    }

    function syncHashModeState() {
      var isHashMode = isHashProvided();
      if (!document.documentElement) {
        return;
      }

      if (isHashMode) {
        document.documentElement.setAttribute('data-hash-mode', '1');
      } else {
        document.documentElement.removeAttribute('data-hash-mode');
      }

      enforceHashModePlaceholder();
    }

    function clearHashModeState() {
      if (!window.history || !window.history.replaceState) {
        return;
      }

      var baseLocation = window.location.pathname + window.location.search;
      window.history.replaceState({}, document.title, baseLocation);
      syncHashModeState();
    }

    function isHashProvided() {
      return Boolean(window.location && window.location.hash && window.location.hash.length > 1);
    }

    function hideIntroIfHashProvided() {
      if (!isHashProvided()) {
        return;
      }
      syncHashModeState();
      enforceHashModePlaceholder();
      if (info) {
        info.classList.add('hidden');
      }
      if (wrapper) {
        wrapper.classList.remove('hidden');
      }
    }

    function enforceHashModePlaceholder() {
      if (!output) {
        return;
      }

      if (isHashProvided()) {
        output.setAttribute('placeholder', '');
        return;
      }

      output.setAttribute('placeholder', window.i18n ? i18n.t('placeholder') : 'Paste content here...');
    }

    // Sanitize HTML and add Bootstrap classes
    function sanitizeHtml(html) {
      // Use DOMParser for safer HTML parsing (doesn't execute scripts)
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');

      // Remove any script tags (convert to array first to avoid mutation issues)
      var scripts = Array.from(doc.querySelectorAll('script'));
      for (var i = 0; i < scripts.length; i++) {
        scripts[i].parentNode.removeChild(scripts[i]);
      }

      // Add Bootstrap classes to tables
      var tables = Array.from(doc.querySelectorAll('table'));
      for (var i = 0; i < tables.length; i++) {
        tables[i].className = 'table table-striped table-bordered';
      }

      // Add Bootstrap classes to images
      var images = Array.from(doc.querySelectorAll('img'));
      for (var i = 0; i < images.length; i++) {
        var src = images[i].getAttribute('src');
        if (!isSafeUrl(src)) {
          images[i].parentNode.removeChild(images[i]);
        } else {
          images[i].className = 'img-responsive';
        }
      }

      // Add Bootstrap classes to blockquotes
      var blockquotes = Array.from(doc.querySelectorAll('blockquote'));
      for (var i = 0; i < blockquotes.length; i++) {
        blockquotes[i].className = 'blockquote';
      }

      // Add Bootstrap classes to code blocks
      var codeBlocks = Array.from(doc.querySelectorAll('pre'));
      for (var i = 0; i < codeBlocks.length; i++) {
        codeBlocks[i].className = 'pre-scrollable';
      }

      // Style links with Bootstrap
      var links = Array.from(doc.querySelectorAll('a'));
      for (var i = 0; i < links.length; i++) {
        var href = links[i].getAttribute('href');
        if (!isSafeUrl(href)) {
          links[i].removeAttribute('href');
        } else {
          links[i].setAttribute('target', '_blank');
          links[i].setAttribute('rel', 'noopener noreferrer');
        }
      }

      // Add Bootstrap badge class to inline code
      var inlineCodes = Array.from(doc.querySelectorAll('code'));
      for (var i = 0; i < inlineCodes.length; i++) {
        // Only add badge class to inline code, not code inside pre blocks
        if (inlineCodes[i].parentNode.nodeName !== 'PRE') {
          inlineCodes[i].className = 'badge';
        }
      }

      return doc.body.innerHTML;
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

    function base64UrlEncode(bytes) {
      if (!bytes || !bytes.length) {
        return '';
      }

      var binary = '';
      var index;
      for (index = 0; index < bytes.length; index++) {
        binary += String.fromCharCode(bytes[index]);
      }
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }

    function base64UrlDecode(base64) {
      if (!base64) {
        return new Uint8Array(0);
      }

      var normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
      while (normalized.length % 4) {
        normalized += '=';
      }

      var binary = atob(normalized);
      var bytes = new Uint8Array(binary.length);
      var i;
      for (i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    function hasCompressionSupport() {
      return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
    }

    function toUtf8Bytes(value) {
      if (typeof TextEncoder === 'function') {
        return new TextEncoder().encode(value || '');
      }

      var escaped = encodeURIComponent(value || '');
      var bytes = [];
      var i;
      for (i = 0; i < escaped.length; i++) {
        if (escaped[i] === '%') {
          bytes.push(parseInt(escaped.substr(i + 1, 2), 16));
          i += 2;
        } else {
          bytes.push(escaped.charCodeAt(i));
        }
      }

      return bytes;
    }

    function utf8BytesToString(bytes) {
      if (typeof TextDecoder === 'function') {
        return new TextDecoder().decode(bytes);
      }

      var binary = '';
      var i;
      for (i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return decodeURIComponent(escape(binary));
    }

    function toEscapedHtml(text) {
      var value = String(text || '');
      return value.replace(/[&<>"']/g, function (match) {
        switch (match) {
          case '&':
            return '&amp;';
          case '<':
            return '&lt;';
          case '>':
            return '&gt;';
          case '"':
            return '&quot;';
          case '\'':
            return '&#39;';
          default:
            return match;
        }
      });
    }

    function buildHashFromCurrentState() {
      var markdown = output.value || '';
      if (!hasCompressionSupport()) {
        return Promise.resolve(createFallbackHash(markdown));
      }

      return compressMarkdown(markdown).then(function (payload) {
        return payload;
      }).catch(function () {
        return createFallbackHash(markdown);
      });
    }

    function createFallbackHash(markdown) {
      var markdownBytes = toUtf8Bytes(markdown);
      return RAW_HASH_PREFIX + base64UrlEncode(new Uint8Array(markdownBytes));
    }

    function parseHashState() {
      var hash = window.location.hash || '';
      return new URLSearchParams(hash.charAt(0) === '#' ? hash.substring(1) : hash);
    }

    function parseTabFromHash(value) {
      if (!value) {
        return 'edit';
      }
      return value === 'preview' ? 'preview' : 'edit';
    }

    function getShareTitle(markdown) {
      var lines = (markdown || '').split('\n');
      var i;
      var raw = '';
      var title;

      for (i = 0; i < lines.length; i++) {
        if (lines[i].trim() !== '') {
          raw = lines[i].trim();
          break;
        }
      }

      if (raw === '') {
        raw = 'Markdown';
      }

      raw = raw.replace(/^\s*#{1,6}\s*/, '');
      raw = stripMarkdownLinksFromTitle(raw);
      raw = raw.replace(/^[\s`~!@#\$%\^&\*\(\)\[\]\{\}\|\\:;"',\.\?\/<>]+/, '');
      raw = raw.replace(/[`\~!@#\$%\^&\*\(\)\[\]\{\}\|\\:;"',\.\?\/<>]+$/, '');
      raw = raw.replace(/\s+/g, ' ').trim();
      if (raw === '') {
        raw = 'Markdown';
      }

      if (!/[A-Za-z]/.test(raw)) {
        title = truncateByNonWhitespace(raw, 15);
      } else {
        title = truncateByWordBoundary(raw, 15);
      }

      return title || 'Markdown';
    }

    function stripMarkdownLinksFromTitle(value) {
      var text = value;
      text = text.replace(/!\[([^\]]*)\]\(([^)\n]+)\)/g, '$1');
      text = text.replace(/\[([^\]]+)\]\(([^)\n]+)\)/g, '$1');
      text = text.replace(/!\[([^\]]*)\]\[[^\]]*\]/g, '$1');
      text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');
      return text.replace(/\s+/g, ' ').trim();
    }

    function countNonWhitespaceLength(value) {
      return value.replace(/\s/g, '').length;
    }

    function truncateByNonWhitespace(value, maxVisibleChars) {
      if (countNonWhitespaceLength(value) <= maxVisibleChars) {
        return value;
      }

      var result = '';
      var visibleCount = 0;
      var charIndex;
      for (charIndex = 0; charIndex < value.length; charIndex++) {
        result += value[charIndex];
        if (!/\s/.test(value[charIndex])) {
          visibleCount++;
        }

        if (visibleCount >= maxVisibleChars) {
          break;
        }
      }

      return result.trim();
    }

    function truncateByWordBoundary(value, maxVisibleChars) {
      var words = value.split(/\s+/);
      if (words.length === 1) {
        return value;
      }

      var titleParts = [];
      var visibleCount = 0;
      var hasOverLimitWord = false;
      var wordIndex;

      for (wordIndex = 0; wordIndex < words.length; wordIndex++) {
        var word = words[wordIndex];
        var wordVisibleCount = countNonWhitespaceLength(word);
        var nextCount = visibleCount + wordVisibleCount;

        if (titleParts.length === 0) {
          titleParts.push(word);
          visibleCount = wordVisibleCount;
          continue;
        }

        if (nextCount > maxVisibleChars && titleParts.length > 0) {
          if (!hasOverLimitWord) {
            titleParts.push(word);
            hasOverLimitWord = true;
          }
          break;
        }

        titleParts.push(word);
        visibleCount = nextCount;
      }

      return titleParts.join(' ').trim();
    }

    async function compressMarkdown(markdown) {
      if (!hasCompressionSupport()) {
        return createFallbackHash(markdown);
      }

      var markdownBytes = toUtf8Bytes(markdown);
      var blob = new Blob([markdownBytes]);
      var compressedStream = blob.stream().pipeThrough(new CompressionStream('gzip'));
      var compressed = await new Response(compressedStream).arrayBuffer();

      return SHARE_HASH_PREFIX + base64UrlEncode(new Uint8Array(compressed));
    }

    async function decodeMarkdown(value) {
      if (!value) {
        return '';
      }

      var mode = value.substring(0, 2);
      var payload = value.substring(2);
      if (!payload) {
        return '';
      }

      var bytes = base64UrlDecode(payload);
      if (!hasCompressionSupport() || mode === RAW_HASH_PREFIX) {
        return utf8BytesToString(bytes);
      }

      if (mode === SHARE_HASH_PREFIX) {
        try {
          var compressedBlob = new Blob([bytes]);
          var decompressedStream = compressedBlob.stream().pipeThrough(new DecompressionStream('gzip'));
          return await new Response(decompressedStream).text();
        } catch (error) {
          console.warn('Failed to decompress hash text, fallback to raw text decode.', error);
          return utf8BytesToString(bytes);
        }
      }

      return utf8BytesToString(bytes);
    }

    function refreshShareButtonLabel() {
      if (!shareButton) {
        return;
      }

      shareButton.textContent = window.i18n ? i18n.t('shareButton') : '🔗 Share';
      shareButton.title = window.i18n ? i18n.t('shareButtonTitle') : 'Copy shareable URL';
    }

    async function applySharedHash() {
      var hashParams = parseHashState();
      syncHashModeState();
      var mode = parseTabFromHash(hashParams.get('mode'));
      var encodedText = hashParams.get('text');
      var hashHasText = typeof encodedText === 'string' && encodedText.length > 0;

      activateTab(mode, {
        focus: true
      });

      if (!hashHasText) {
        sharedHashSeed = '';
        hasEditedFromSharedHash = false;
        return;
      }

      try {
        var decodedMarkdown = await decodeMarkdown(encodedText);
        output.value = decodedMarkdown;
        sharedHashSeed = decodedMarkdown;
        hasEditedFromSharedHash = false;
        wrapper.classList.remove('hidden');
        info.classList.add('hidden');
        if (mode === 'preview') {
          updatePreview();
        }
      } catch (error) {
        console.warn('Failed to load markdown from hash.', error);
      }
    }

    document.addEventListener('keydown', function (event) {
      if (event.ctrlKey || event.metaKey) {
        if (String.fromCharCode(event.which).toLowerCase() === 'v') {
          prepareForPaste();
        }
      }
      if (event.key === 'Escape') {
        activateTab('edit', {
          focus: true
        });
        resetOutputView();
        window.scrollTo(0, 0);
      }

      if (matchesShareShortcut(event)) {
        event.preventDefault();
        executeShareAction();
      }

      if (matchesTabShortcut(event, 1)) {
        event.preventDefault();
        var editButton = document.querySelector('.tab-button[data-tab="edit"]');
        if (editButton && !editButton.classList.contains('active')) {
          editButton.click();
        }
      }

      if (matchesTabShortcut(event, 2)) {
        event.preventDefault();
        var previewButton = document.querySelector('.tab-button[data-tab="preview"]');
        if (previewButton && !previewButton.classList.contains('active')) {
          previewButton.click();
        }
      }
    });

    applySharedHash();
    window.addEventListener('hashchange', function () {
      applySharedHash();
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

        clearSharedHashSeedContent();
        insert(output, text);
        wrapper.classList.remove('hidden');
        output.focus();
        output.select();
        updatePreview();
        event.preventDefault();
        return;
      }

      // Word HTML '<w:WordDocument>'
      if (event.clipboardData.types.includes('text/rtf') && event.clipboardData.types.includes('text/html')) {
        var html = event.clipboardData.getData('text/html');
        var plainTextList = null;
        if (event.clipboardData.types.includes('text/plain')) {
          var wordPlainText = event.clipboardData.getData('text/plain');
          plainTextList = /[\uf06c\uf06e]/.test(wordPlainText) ?
            convertWordUnorderedListPlainText(wordPlainText) : null;
        }
        console.log('Both text/rtf and text/html:', html);
        var markdown = plainTextList !== null ? plainTextList : turndownService.turndown(normalizeWordHtmlLists(html)).trim();
        if (plainTextList === null) {
          markdown = markdown.replace(/ü/g, '  - ');
          markdown = markdown.replace(/\.[^\S\r\n]+/g, '. ');
          markdown = markdown.replace(/-[^\S\r\n]+/g, '- ');
          markdown = markdown.replace(/[^\S\r\n]/g, ' ');
        }

        console.log('Markdown: ', markdown);

        clearSharedHashSeedContent();
        insert(output, markdown);
        wrapper.classList.remove('hidden');
        output.focus();
        output.select();
        updatePreview();
        event.preventDefault();
        return;
      }

      // Check if only text/plain is available
      if (event.clipboardData.types.includes('text/plain') && !event.clipboardData.types.includes('text/html')) {
        var plainText = event.clipboardData.getData('text/plain');
        console.log('Plain text only:', plainText);

        // Apply plain text processing rules
        plainText = applyPlainTextRules(plainText);
        console.log('After processing:', plainText);

        clearSharedHashSeedContent();
        insert(output, plainText);
        wrapper.classList.remove('hidden');
        output.focus();
        output.select();
        updatePreview();
        event.preventDefault();
        return;
      }

      // Normal HTML
      var html = event.clipboardData.getData('text/html');

      // delete p tag inside li tag, including any attributes defined in p tag and li tag
      html = html.replace(/<li([^>]*)>\s*<p([^>]*)>(.*?)<\/p>\s*<\/li>/g, '<li>$3</li>');

      // Normalize br tags from Excel (may have whitespace or newlines)
      // This ensures <br> tags are properly formatted for HTML parsing
      html = html.replace(/<br\s*\/>/gi, '<br>');

      console.log('HTML:', html);

      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');

      // Clean up translation artifacts safely
      // 1. Remove spinners completely
      var spinners = doc.querySelectorAll('.read-frog-spinner');
      spinners.forEach(function (el) {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });

      // 2. Unwrap translation wrappers to keep their text content
      var wrappers = doc.querySelectorAll('.read-frog-translated-content-wrapper');
      wrappers.forEach(function (el) {
        var parent = el.parentNode;
        if (parent) {
          while (el.firstChild) {
            parent.insertBefore(el.firstChild, el);
          }
          parent.removeChild(el);
        }
      });

      // Unwrap block elements (like div, p) inside headings
      var headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach(function (heading) {
        var blocks = heading.querySelectorAll('div, p');
        blocks.forEach(function (block) {
          var parent = block.parentNode;
          if (parent) {
            while (block.firstChild) {
              parent.insertBefore(block.firstChild, block);
            }
            parent.removeChild(block);
          }
        });
      });

      var body = doc.querySelector('body').innerHTML;

      var markdown = convert(body);

      clearSharedHashSeedContent();
      insert(output, markdown);
      wrapper.classList.remove('hidden');
      output.focus();
      output.select();
      updatePreview();

      event.preventDefault();
    });
  });

})();
