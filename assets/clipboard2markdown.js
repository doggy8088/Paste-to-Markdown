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

  // Custom rules: preserve math placeholder blocks and inlines.
  // Use the raw textContent: Turndown has already escaped `content`
  // (e.g. "%%P2M\_MATH\_INLINE\_0%%"), which restoreMathPlaceholders cannot match.
  turndownService.addRule('p2mMathBlock', {
    filter: function (node) {
      return node.classList && node.classList.contains('p2m-math-block');
    },
    replacement: function (content, node) {
      return '\n\n' + node.textContent.trim() + '\n\n';
    }
  });

  turndownService.addRule('p2mMathInline', {
    filter: function (node) {
      return node.classList && node.classList.contains('p2m-math-inline');
    },
    replacement: function (content, node) {
      return node.textContent.trim();
    }
  });

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Marked extensions for LaTeX math expressions ($...$ and $$...$$)
  var blockMath = {
    name: 'blockMath',
    level: 'block',
    start: function (src) {
      var idx = src.indexOf('$$');
      return idx === -1 ? undefined : idx;
    },
    tokenizer: function (src) {
      var match = /^(?:[ \t]*\n)?\$\$([\s\S]+?)\$\$(?:[ \t]*(?:\n|$))/.exec(src);
      if (match) {
        return {
          type: 'blockMath',
          raw: match[0],
          text: match[1].trim()
        };
      }
    },
    renderer: function (token) {
      if (window.katex) {
        try {
          return '<div class="katex-display">' + window.katex.renderToString(token.text, {
            displayMode: true,
            throwOnError: false
          }) + '</div>\n';
        } catch (e) {
          console.error('KaTeX block rendering error:', e);
        }
      }
      return '<div class="katex-display katex-error"><code>' + escapeHtml(token.text) + '</code></div>\n';
    }
  };

  var inlineMath = {
    name: 'inlineMath',
    level: 'inline',
    start: function (src) {
      var index = -1;
      while ((index = src.indexOf('$', index + 1)) !== -1) {
        if (src[index + 1] === '$') {
          index++;
          continue;
        }
        if (index > 0 && src[index - 1] === '\\') {
          continue;
        }
        return index;
      }
      return -1;
    },
    tokenizer: function (src) {
      var match = /^\$([^\s$](?:[\s\S]*?[^\s$])?)\$(?!\d)/.exec(src);
      if (match) {
        return {
          type: 'inlineMath',
          raw: match[0],
          text: match[1].trim()
        };
      }
    },
    renderer: function (token) {
      if (window.katex) {
        try {
          return window.katex.renderToString(token.text, {
            displayMode: false,
            throwOnError: false
          });
        } catch (e) {
          console.error('KaTeX inline rendering error:', e);
        }
      }
      return '<span class="katex-inline katex-error"><code>' + escapeHtml(token.text) + '</code></span>';
    }
  };

  if (typeof marked !== 'undefined' && marked.use) {
    marked.use({
      extensions: [blockMath, inlineMath],
      renderer: {
        code: function (code, infostring) {
          if (infostring === 'math') {
            if (window.katex) {
              try {
                return '<div class="katex-display">' + window.katex.renderToString(code.trim(), {
                  displayMode: true,
                  throwOnError: false
                }) + '</div>\n';
              } catch (e) {
                console.error('KaTeX code block rendering error:', e);
              }
            }
            return '<div class="katex-display katex-error"><code>' + escapeHtml(code) + '</code></div>\n';
          }
          return false;
        }
      }
    });
  }

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
    },

    {
      filter: function (node) {
        return node.classList && node.classList.contains('p2m-math-block');
      },
      replacement: function (content) {
        return '\n\n' + content.trim() + '\n\n';
      }
    },

    {
      filter: function (node) {
        return node.classList && node.classList.contains('p2m-math-inline');
      },
      replacement: function (content) {
        return content.trim();
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

  function convertMathMLToLatex(node) {
    if (!node) return '';
    var tag = node.nodeName.toLowerCase();
    if (tag === 'mn' || tag === 'mi' || tag === 'mo') {
      return node.textContent.trim();
    }
    if (tag === 'mtext') {
      return '\\text{' + node.textContent + '}';
    }
    if (tag === 'mfrac') {
      var fChildren = Array.from(node.children);
      if (fChildren.length >= 2) {
        return '\\frac{' + convertMathMLToLatex(fChildren[0]) + '}{' + convertMathMLToLatex(fChildren[1]) + '}';
      }
    }
    if (tag === 'msup') {
      var supChildren = Array.from(node.children);
      if (supChildren.length >= 2) {
        return convertMathMLToLatex(supChildren[0]) + '^{' + convertMathMLToLatex(supChildren[1]) + '}';
      }
    }
    if (tag === 'msub') {
      var subChildren = Array.from(node.children);
      if (subChildren.length >= 2) {
        return convertMathMLToLatex(subChildren[0]) + '_{' + convertMathMLToLatex(subChildren[1]) + '}';
      }
    }
    if (tag === 'msubsup') {
      var subSupChildren = Array.from(node.children);
      if (subSupChildren.length >= 3) {
        return convertMathMLToLatex(subSupChildren[0]) + '_{' + convertMathMLToLatex(subSupChildren[1]) + '}^{' + convertMathMLToLatex(subSupChildren[2]) + '}';
      }
    }
    if (tag === 'msqrt') {
      return '\\sqrt{' + Array.from(node.children).map(convertMathMLToLatex).join(' ') + '}';
    }
    if (tag === 'mroot') {
      var rootChildren = Array.from(node.children);
      if (rootChildren.length >= 2) {
        return '\\sqrt[' + convertMathMLToLatex(rootChildren[1]) + ']{' + convertMathMLToLatex(rootChildren[0]) + '}';
      }
    }
    return Array.from(node.childNodes).map(function (child) {
      if (child.nodeType === 1) return convertMathMLToLatex(child);
      if (child.nodeType === 3) return child.textContent.trim();
      return '';
    }).filter(Boolean).join(' ').trim();
  }

  function preprocessMathInDom(doc, mathRegistry) {
    if (!doc || !mathRegistry) return;

    function registerMath(tex, isBlock) {
      var cleanTex = (tex || '').trim();
      if (!cleanTex) return null;
      cleanTex = cleanTex.replace(/^\$\$([\s\S]*)\$\$$/, '$1')
                         .replace(/^\$([\s\S]*)\$$/, '$1')
                         .replace(/^\{\\displaystyle\s*([\s\S]*)\}$/, '$1')
                         .replace(/^\\displaystyle\s*/, '')
                         .trim();
      if (!cleanTex) return null;

      var id = mathRegistry.length;
      mathRegistry.push({
        id: id,
        type: isBlock ? 'block' : 'inline',
        tex: cleanTex
      });
      return {
        id: id,
        token: isBlock ? ('%%P2M_MATH_BLOCK_' + id + '%%') : ('%%P2M_MATH_INLINE_' + id + '%%')
      };
    }

    function replaceWithPlaceholder(el, tex, isBlock) {
      var item = registerMath(tex, isBlock);
      if (!item) {
        if (el.parentNode) el.parentNode.removeChild(el);
        return;
      }
      var replacementNode;
      if (isBlock) {
        replacementNode = doc.createElement('div');
        replacementNode.className = 'p2m-math-block';
        replacementNode.textContent = item.token;
      } else {
        replacementNode = doc.createElement('span');
        replacementNode.className = 'p2m-math-inline';
        replacementNode.textContent = item.token;
      }
      if (el.parentNode) {
        el.parentNode.replaceChild(replacementNode, el);
      }
    }

    // 1. KaTeX display math: .katex-display
    var katexDisplays = Array.from(doc.querySelectorAll('.katex-display'));
    for (var i = 0; i < katexDisplays.length; i++) {
      var kd = katexDisplays[i];
      var ann = kd.querySelector('annotation');
      var tex = ann ? ann.textContent : (kd.getAttribute('data-tex') || kd.getAttribute('data-latex') || '');
      if (tex) {
        replaceWithPlaceholder(kd, tex, true);
      }
    }

    // 2. KaTeX inline math: .katex (that was not inside .katex-display)
    var katexInlines = Array.from(doc.querySelectorAll('.katex'));
    for (var j = 0; j < katexInlines.length; j++) {
      var ki = katexInlines[j];
      if (!ki.parentNode) continue;
      var annInline = ki.querySelector('annotation');
      var texInline = annInline ? annInline.textContent : (ki.getAttribute('data-tex') || ki.getAttribute('data-latex') || '');
      if (texInline) {
        replaceWithPlaceholder(ki, texInline, false);
      }
    }

    // 3. MathJax 3: mjx-container
    var mjxContainers = Array.from(doc.querySelectorAll('mjx-container'));
    for (var m = 0; m < mjxContainers.length; m++) {
      var mjx = mjxContainers[m];
      if (!mjx.parentNode) continue;
      var isDisplay = mjx.hasAttribute('display') && mjx.getAttribute('display') !== 'false';
      var mjxAnn = mjx.querySelector('annotation');
      var mjxTex = mjxAnn ? mjxAnn.textContent : (
        mjx.getAttribute('data-latex') ||
        mjx.getAttribute('data-tex') ||
        mjx.getAttribute('data-formula') ||
        ''
      );
      if (mjxTex) {
        replaceWithPlaceholder(mjx, mjxTex, isDisplay);
      }
    }

    // 4. MathJax 2: script[type^="math/tex"]
    var mathjaxScripts = Array.from(doc.querySelectorAll('script[type^="math/tex"]'));
    for (var s = 0; s < mathjaxScripts.length; s++) {
      var script = mathjaxScripts[s];
      if (!script.parentNode) continue;
      var type = script.getAttribute('type') || '';
      var isDisplayScript = /mode=display/.test(type);
      var scriptTex = script.textContent;

      var prev = script.previousElementSibling;
      if (prev && (prev.classList.contains('MathJax') || prev.classList.contains('MathJax_Preview') || prev.classList.contains('MathJax_Display'))) {
        if (prev.parentNode) prev.parentNode.removeChild(prev);
      }
      var nextEl = script.nextElementSibling;
      if (nextEl && (nextEl.classList.contains('MathJax') || nextEl.classList.contains('MathJax_Preview') || nextEl.classList.contains('MathJax_Display'))) {
        if (nextEl.parentNode) nextEl.parentNode.removeChild(nextEl);
      }

      replaceWithPlaceholder(script, scriptTex, isDisplayScript);
    }

    // 5. Wikipedia Math: .mwe-math-element
    var wikiMaths = Array.from(doc.querySelectorAll('.mwe-math-element'));
    for (var w = 0; w < wikiMaths.length; w++) {
      var wm = wikiMaths[w];
      if (!wm.parentNode) continue;
      var wikiAnn = wm.querySelector('annotation');
      var wikiImg = wm.querySelector('img');
      var wikiTex = '';
      var isWikiDisplay = false;
      if (wikiAnn && wikiAnn.textContent.trim()) {
        wikiTex = wikiAnn.textContent.trim();
        if (/display=block/i.test(wm.innerHTML) || wm.querySelector('math[display="block"]')) {
          isWikiDisplay = true;
        }
      } else if (wikiImg && wikiImg.getAttribute('alt')) {
        var alt = wikiImg.getAttribute('alt').trim();
        if (alt.startsWith('{\\displaystyle') && alt.endsWith('}')) {
          wikiTex = alt.slice(14, -1).trim();
          isWikiDisplay = true;
        } else {
          wikiTex = alt;
          if (wikiImg.classList.contains('mwe-math-fallback-image-display')) {
            isWikiDisplay = true;
          }
        }
      }
      if (wikiTex) {
        replaceWithPlaceholder(wm, wikiTex, isWikiDisplay);
      }
    }

    // 6. Generic MathML: <math> (not already handled)
    var mathElements = Array.from(doc.querySelectorAll('math'));
    for (var k = 0; k < mathElements.length; k++) {
      var mathEl = mathElements[k];
      if (!mathEl.parentNode) continue;
      var mathAnn = mathEl.querySelector('annotation');
      var mTex = mathAnn ? mathAnn.textContent.trim() : '';
      var isMathBlock = (mathEl.getAttribute('display') === 'block') || (mathEl.getAttribute('mode') === 'display');
      if (mTex) {
        replaceWithPlaceholder(mathEl, mTex, isMathBlock);
      } else {
        var fallbackTex = convertMathMLToLatex(mathEl);
        if (fallbackTex) {
          replaceWithPlaceholder(mathEl, fallbackTex, isMathBlock);
        }
      }
    }

    // 7. Elements with data-latex or data-tex or data-math
    var dataTexEls = Array.from(doc.querySelectorAll('[data-latex], [data-tex], [data-math]'));
    for (var d = 0; d < dataTexEls.length; d++) {
      var dtEl = dataTexEls[d];
      if (!dtEl.parentNode) continue;
      if (dtEl.classList.contains('p2m-math-block') || dtEl.classList.contains('p2m-math-inline')) continue;
      var dTex = dtEl.getAttribute('data-latex') || dtEl.getAttribute('data-tex') || dtEl.getAttribute('data-math');
      if (dTex) {
        var isDBlock = (dtEl.tagName.toLowerCase() === 'div') || dtEl.classList.contains('math-display');
        replaceWithPlaceholder(dtEl, dTex, isDBlock);
      }
    }

    // 8. Math images (e.g. codecogs or images with class math/latex)
    var mathImages = Array.from(doc.querySelectorAll('img.math, img.latex, img[src*="latex.codecogs.com"]'));
    for (var mi = 0; mi < mathImages.length; mi++) {
      var mImg = mathImages[mi];
      if (!mImg.parentNode) continue;
      var imgAlt = (mImg.getAttribute('alt') || '').trim();
      if (imgAlt) {
        replaceWithPlaceholder(mImg, imgAlt, false);
      }
    }
  }

  function restoreMathPlaceholders(markdown, mathRegistry) {
    if (!markdown || !mathRegistry || !mathRegistry.length) return markdown;

    var mathMap = {};
    for (var i = 0; i < mathRegistry.length; i++) {
      mathMap[mathRegistry[i].id] = mathRegistry[i];
    }

    markdown = markdown.replace(/%%P2M_MATH_BLOCK_(\d+)%%/g, function (match, id) {
      var item = mathMap[+id];
      if (!item) return match;
      var tex = item.tex.trim();
      if (tex.indexOf('\n') !== -1) {
        return '$$\n' + tex + '\n$$';
      }
      return '$$' + tex + '$$';
    });

    markdown = markdown.replace(/%%P2M_MATH_INLINE_(\d+)%%/g, function (match, id) {
      var item = mathMap[+id];
      if (!item) return match;
      return '$' + item.tex.trim() + '$';
    });

    return markdown;
  }

  var convert = function (str, mathRegistry) {
    mathRegistry = mathRegistry || [];

    // If str appears to be HTML containing math elements and no registry was supplied:
    if ((!mathRegistry.length) && typeof DOMParser !== 'undefined' && /<(?:math|span|div|mjx)[^>]*\b(?:katex|math|mjx)/i.test(str)) {
      try {
        var inlineDoc = new DOMParser().parseFromString(str, 'text/html');
        preprocessMathInDom(inlineDoc, mathRegistry);
        str = inlineDoc.body.innerHTML;
      } catch (e) {
        // Fallback to raw string
      }
    }

    // Protect any literal block math syntax ($$...$$) in str before escape/markdown processing
    var rawMathBlocks = [];
    str = str.replace(/\$\$([\s\S]+?)\$\$/g, function (match) {
      var rawId = rawMathBlocks.length;
      rawMathBlocks.push(match);
      return '%%P2M_RAW_MATH_' + rawId + '%%';
    });

    var markdown = escape(toMarkdown(str, { converters: pandoc, gfm: true }));

    // Restore literal raw math blocks
    markdown = markdown.replace(/%%P2M_RAW_MATH_(\d+)%%/g, function (match, id) {
      return rawMathBlocks[+id] || match;
    });

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

    // Restore DOM-extracted math placeholders at the very end
    markdown = restoreMathPlaceholders(markdown, mathRegistry);

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

    // Auto-correct pasted Markdown syntax (full-width parentheses spacing & GFM table alignment)
    markdownSyntax: function (text) {
      if (
        !/[（）]/.test(text) &&
        !/^[ \t>]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)*(?:\[[ xX]\][ \t]+)?\|?(?:[ \t]*:?-+:?[ \t]*\|)+[ \t]*:?-+:?[ \t]*\|?[ \t]*$/m.test(text)
      ) {
        return null;
      }
      const normalizedInput = text.replace(/\r\n?/g, '\n');
      const usedSpanTags = new Set(normalizedInput.match(/P2MSPAN(?:\d+X)?/g));
      let spanTag = 'P2MSPAN';
      for (let nonce = 1; usedSpanTags.has(spanTag); nonce++) {
        spanTag = 'P2MSPAN' + nonce + 'X';
      }
      const spanTokenRe = new RegExp('[\\uE000\\uE002]' + spanTag + '(\\d+)[BMS][\\uE001\\uE003]', 'g');
      const blockSpanLineRe = new RegExp('^\\uE002' + spanTag + '\\d+B\\uE003$');
      const multilineSpanRe = new RegExp('[\\uE000\\uE002]' + spanTag + '\\d+M[\\uE001\\uE003]');
      const literalE004 = '\uE005' + spanTag + '\uE005';
      const lines = normalizedInput.replace(/\uE004/g, literalE004).split('\n');
      const UNESCAPED_PIPE_RE = /(?<=(?:^|[^\\])(?:\\\\)*)\|/;

      const countIndentCols = function (ws) {
        let cols = 0;
        for (let i = 0; i < ws.length; i++) {
          cols += ws[i] === '\t' ? 4 - (cols % 4) : 1;
        }
        return cols;
      };

      const HTML_RAW_TAG_RE = /^ {0,3}<(script|pre|style|textarea)(?=[\s>])/i;
      const HTML_TYPE6_TAG_RE = /^ {0,3}<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?: +|$|\/?>)/i;
      const HTML_TYPE7_TAG_RE = /^ {0,3}(?:<(?!script|pre|style|textarea)[A-Za-z][\w-]*(?: +[A-Za-z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?)*? *\/?>|<\/(?!script|pre|style|textarea)[A-Za-z][\w-]*\s*>)[ \t]*$/i;
      const HTML_SPECIAL_OPEN_RE = /^ {0,3}(<!--|<\?|<![A-Za-z]|<!\[CDATA\[)/;
      const THEMATIC_BREAK_RE = /^[ \t]{0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;
      const REF_DEF_RE = /^[ \t]{0,3}\[(?:\\.|[^\\\n\]])+\]:[ \t]*(?:\n[ \t]*(?:>[ \t]*)*)?(?:<[^>\r\n]+>|\S+)(?:(?:[ \t]+|[ \t]*\n[ \t]*(?:>[ \t]*)*)(?:"(?:\\.|[^"\n]|\n(?![ \t]*\n))*"|'(?:\\.|[^'\n]|\n(?![ \t]*\n))*'|\((?:\\.|[^()\n]|\n(?![ \t]*\n))*\)))?[ \t]*$/;
      const TABLE_DELIMITER_REST_RE = /^ {0,3}(?:\|[ \t]*)?:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)+(?:\|[ \t]*)?$/;
      const LINK_TAIL_RE = /^(?:[ \t]|\n(?![ \t]*\n))*(?:(?:"(?:\\.|[^"\n\uE004]|\n(?![ \t]*\n))*"|'(?:\\.|[^'\n\uE004]|\n(?![ \t]*\n))*'|(?:\((?:\\.|[^)\n\uE004]|\n(?![ \t]*\n))*\)|[（(](?:\\.|[^)）\n\uE004]|\n(?![ \t]*\n))*[)）]))(?:[ \t]|\n(?![ \t]*\n))*)?(?:(?<=(?:^|[^\\])(?:\\\\)*)\)|\\*）+)/;
      const HTML_SPECIAL_CLOSE_MAP = {
        '<!--': /-->/,
        '<?': /\?>/,
        '<![CDATA[': /\]\]>/
      };

      const getHtmlBlockCloseRe = function (rest, atBlockStart) {
        const rawMatch = rest.match(HTML_RAW_TAG_RE);
        if (rawMatch) {
          return new RegExp('<\\/' + rawMatch[1] + '\\s*>', 'i');
        }
        const specialMatch = rest.match(HTML_SPECIAL_OPEN_RE);
        if (specialMatch) {
          return HTML_SPECIAL_CLOSE_MAP[specialMatch[1]] || />/;
        }
        return (HTML_TYPE6_TAG_RE.test(rest) || (atBlockStart && HTML_TYPE7_TAG_RE.test(rest))) ? /^[ \t]*$/ : null;
      };

      let listContentIndent = 0;
      let outerListIndent = 0;
      let listQuoteDepth = 0;
      let openParaQuoteDepth = -1;
      let quoteCanLazyContinue = false;
      let listIndents = [];
      let listSawBlank = false;
      let listOpenedInPara = false;
      let minLazyIndent = 0;
      let outerMinLazy = 0;
      const getQuotePrefix = function (line) {
        const match = line.match(/^((?:[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+)+)?([ \t]*>(?:[ \t]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)*>)*[ \t]?)(.*)$/);
        if (!match) {
          return { depth: 0, prefix: '', rest: line };
        }
        const firstQuoteWs = match[2].match(/^[ \t]*/)[0];
        const maxQuoteIndent = match[1] ? 3 : listContentIndent + 3;
        if (countIndentCols(firstQuoteWs) > maxQuoteIndent) {
          return { depth: 0, prefix: '', rest: line };
        }
        return {
          depth: match[2].match(/>/g).length,
          prefix: (match[1] || '') + match[2],
          rest: match[3]
        };
      };

      const hasLazyListExitSlice = function (str, indents) {
        let cur = str;
        let prevIndent = 0;
        for (let i = 0; i < indents.length; i++) {
          const h = indents[i] - prevIndent;
          prevIndent = indents[i];
          const s = cur.slice(h);
          if (new RegExp('^ {0,' + Math.min(3, h - 1) + '}(?:`{3,}|~{3,}|#|(?:[-*_] *){3,}$)|^ {4}').test(s)) {
            return true;
          }
          if (cur.search(/[^ ]/) >= h) {
            cur = s;
          }
        }
        return false;
      };

      const updateLazyListSlice = function (line, isProtectedBlock = false) {
        const q = getQuotePrefix(line);
        if (listContentIndent > 0) {
          if (listSawBlank || hasLazyListExitSlice(restoreSpans(q.rest), listIndents)) {
            minLazyIndent = listContentIndent;
          } else if (!isProtectedBlock) {
            minLazyIndent = 0;
          }
        }
        if (listQuoteDepth === 0) {
          outerListIndent = listContentIndent;
          outerMinLazy = minLazyIndent;
        } else {
          const outerListMatch = q.prefix.match(/^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+/);
          if (outerListMatch) {
            outerListIndent = countIndentCols(outerListMatch[0]);
          }
          if (outerListIndent > 0 && hasLazyListExitSlice(restoreSpans(line), [outerListIndent])) {
            outerMinLazy = outerListIndent;
          }
        }
      };

      const updateListIndent = function (line, isProtectedBlock, allowAnyOrdered = true) {
        const q = getQuotePrefix(line);
        const rawLeadCols = countIndentCols((q.prefix + q.rest).match(/^[ \t]*/)[0]);
        const closesOuterSetext =
          !isProtectedBlock &&
          openParaQuoteDepth >= 0 &&
          openParaQuoteDepth < listQuoteDepth &&
          q.depth <= openParaQuoteDepth &&
          (!THEMATIC_BREAK_RE.test(q.rest) || q.depth === openParaQuoteDepth) &&
          /^[ \t]{0,3}(?:=+|-+)[ \t]*$/.test(q.rest);
        const targetQuoteDepth = closesOuterSetext ? openParaQuoteDepth : q.depth;
        if (
          closesOuterSetext ||
          targetQuoteDepth > listQuoteDepth ||
          (targetQuoteDepth > 0 && rawLeadCols < outerMinLazy) ||
          (targetQuoteDepth < listQuoteDepth && (!quoteCanLazyContinue || q.rest.trim() === '' || hasBlockInterrupt(q.rest, outerListIndent) || rawLeadCols < Math.max(outerMinLazy, minLazyIndent)))
        ) {
          if (
            (targetQuoteDepth < listQuoteDepth && !closesOuterSetext && (q.rest.trim() === '' || (rawLeadCols < outerListIndent && hasBlockInterrupt(q.rest, outerListIndent)))) ||
            rawLeadCols < outerMinLazy
          ) {
            outerListIndent = 0;
            outerMinLazy = 0;
          } else if (targetQuoteDepth > listQuoteDepth && listQuoteDepth > 0 && listContentIndent > 0) {
            outerListIndent = listContentIndent;
          }
          const restoredIndent = targetQuoteDepth === 0 ? outerListIndent : 0;
          listIndents = restoredIndent ? [restoredIndent] : [];
          listContentIndent = restoredIndent;
          listSawBlank = targetQuoteDepth === 0 && (outerMinLazy > 0 || q.rest.trim() === '');
          listOpenedInPara = false;
          minLazyIndent = listSawBlank ? outerListIndent : 0;
          listQuoteDepth = targetQuoteDepth;
        }
        const listMatch = !isProtectedBlock && !THEMATIC_BREAK_RE.test(q.rest) && (allowAnyOrdered || /^[ \t]*(?:[-*+]|1[.)]) /.test(q.rest)) && q.rest.match(/^([ \t]*)(?:(?:[-*+]|\d{1,9}[.)])(?: {1,4}(?! )| (?= {4})|\t))+/);
        const isListLine = Boolean(listMatch && countIndentCols(listMatch[1]) <= listContentIndent + 3);
        if (isListLine) {
          const markerIndent = countIndentCols(listMatch[1]);
          const nextIndent = countIndentCols(listMatch[0]);
          listOpenedInPara = (listOpenedInPara || !allowAnyOrdered) && listMatch[1] !== '';
          listIndents = listIndents.filter(function (n) {
            return n <= markerIndent;
          });
          minLazyIndent = listIndents.filter(function (n) {
            return n <= minLazyIndent;
          }).pop() || 0;
          let markerPrefix = '';
          listMatch[0].match(/[ \t]*(?:[-*+]|\d{1,9}[.)])(?: {1,4}(?! )| (?= {4})|\t)/g).forEach(function (m) {
            markerPrefix += m;
            listIndents.push(countIndentCols(markerPrefix));
          });
          listContentIndent = nextIndent;
          listSawBlank = minLazyIndent > 0;
          if (listQuoteDepth === 0) {
            outerListIndent = listContentIndent;
            outerMinLazy = minLazyIndent;
          }
        } else if (q.rest.trim() === '') {
          listOpenedInPara = false;
          if (listContentIndent > 0) {
            listSawBlank = true;
          }
          updateLazyListSlice(line, isProtectedBlock);
        } else if (
          (listOpenedInPara && /^[ \t]{0,3}(?:=+|-+)[ \t]*$/.test(q.rest)) ||
          (
            countIndentCols(q.rest.match(/^[ \t]*/)[0]) < listContentIndent &&
            ((!isProtectedBlock && countIndentCols(q.rest.match(/^[ \t]*/)[0]) < minLazyIndent) || THEMATIC_BREAK_RE.test(q.rest) || /^[ \t]{0,3}(?:`{3,}|~{3,}|#)/.test(q.rest))
          )
        ) {
          const lineIndent = (listOpenedInPara && /^[ \t]{0,3}(?:=+|-+)[ \t]*$/.test(q.rest)) ? 0 : countIndentCols(q.rest.match(/^[ \t]*/)[0]);
          listIndents = listIndents.filter(function (n) {
            return n <= lineIndent;
          });
          listContentIndent = listIndents[listIndents.length - 1] || 0;
          minLazyIndent = Math.min(minLazyIndent, listContentIndent);
          listSawBlank = minLazyIndent > 0;
          listOpenedInPara = false;
          if (listQuoteDepth === 0) {
            outerListIndent = listContentIndent;
            outerMinLazy = minLazyIndent;
          }
        } else {
          updateLazyListSlice(line, isProtectedBlock);
        }
        if (
          closesOuterSetext ||
          listQuoteDepth < openParaQuoteDepth ||
          (listQuoteDepth === openParaQuoteDepth && (
            isProtectedBlock ||
            q.rest.trim() === '' ||
            isListLine ||
            /^[ \t]{0,3}(?:=+|-+)[ \t]*$/.test(q.rest)
          ))
        ) {
          openParaQuoteDepth = -1;
        } else if (
          openParaQuoteDepth < 0 &&
          !isProtectedBlock &&
          q.rest.trim() !== '' &&
          !isListLine &&
          !THEMATIC_BREAK_RE.test(q.rest) &&
          !/^[ \t]{0,3}(?:#{1,6}(?:[ \t]|$)|`{3,}(?=[^`]*$)|~{3,}|(?:=+|-+)[ \t]*$|\$\$.+\$\$[ \t]*$)/.test(restoreSpans(q.rest))
        ) {
          openParaQuoteDepth = listQuoteDepth;
        }
        quoteCanLazyContinue = listQuoteDepth > 0 && q.rest !== '';
      };

      const hasBlockInterrupt = function (rest, activeOuterListIndent = 0) {
        const strippedRest = activeOuterListIndent > 0 ? rest.slice(Math.min(rest.match(/^ */)[0].length, activeOuterListIndent)) : rest;
        return (
          /^ {0,3}(?:#{1,6}(?:[ \t]|$)|>|(?:[-*+]|1[.)])[ \t]|(?:\*[ \t]*){3,}$|(?:-[ \t]*){3,}$|(?:_[ \t]*){3,}$|`{3,}(?=[^`]*$)|~{3,}|<!--|<(?:script|pre|style|textarea)(?=[\s/>]|$))/i.test(strippedRest) ||
          (activeOuterListIndent > 0 && countIndentCols(rest.match(/^[ \t]*/)[0]) < activeOuterListIndent && /^[ \t]{0,3}(?:\d{1,9}[.)][ \t]|`{3,}|~{3,}|#)/.test(rest)) ||
          HTML_TYPE6_TAG_RE.test(strippedRest)
        );
      };

      // Intentionally allow ordinary unquoted continuation lines to stay inside an unclosed
      // blockquote fence/HTML block unless the line is blank or starts a new block interrupt,
      // matching the bundled Marked parser's lazy blockquote continuation behavior.
      const hasContainerEnded = function (line, activeBlock, prevBlank) {
        if (!activeBlock) {
          return false;
        }
        const q = getQuotePrefix(line);
        if (
          (outerMinLazy > 0 && q.rest.trim() !== '' && countIndentCols(line.match(/^[ \t]*/)[0]) < outerMinLazy) ||
          (activeBlock.quoteDepth > 0 && q.depth < activeBlock.quoteDepth && (q.rest.trim() === '' || hasBlockInterrupt(q.rest)))
        ) {
          return true;
        }
        let restAtDepth = line;
        for (let d = 0; d < activeBlock.quoteDepth; d++) {
          restAtDepth = restAtDepth.replace(/^[ \t]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)*>[ \t]?/, '');
        }
        const lineIndent = countIndentCols(restAtDepth.match(/^[ \t]*/)[0]);
        if (
          activeBlock.containerIndent > 0 &&
          restAtDepth.trim() !== '' &&
          lineIndent < activeBlock.containerIndent
        ) {
          return (
            prevBlank ||
            (activeBlock.hasContent === false && lineIndent < activeBlock.minFirstContentIndent) ||
            /^ {0,3}(?:#|(?:[-*+]|\d{1,9}[.)])[ \t]|(?:\*[ \t]*){3,}$|(?:-[ \t]*){3,}$|(?:_[ \t]*){3,}$|`{3,}(?=[^`]*$)|~{3,})/.test(restAtDepth)
          );
        }
        return false;
      };

      const updateFenceState = function (line, activeFence, allowAnyOrdered = true) {
        const q = getQuotePrefix(line);
        if (!activeFence) {
          const openMatch = q.rest.match(/^([ \t]*)(?:((?:(?:[-*+]|\d{1,9}[.)])(?: {1,4}(?! )| (?= {4})|\t))+)(?:\[[ xX]\][ \t]+)?)?(`{3,}|~{3,})(.*)$/);
          if (openMatch && (!openMatch[2] || allowAnyOrdered || /^(?:[-*+]|1[.)]) /.test(openMatch[2])) && !(openMatch[3][0] === '`' && openMatch[4].includes('`'))) {
            const openIndent = countIndentCols(openMatch[1]);
            const listOffset = openMatch[2] ? countIndentCols(openMatch[1] + openMatch[2]) - openIndent : 0;
            const containerIndent = listOffset > 0 ? openIndent + listOffset : listContentIndent;
            const maxOpenIndent = listOffset > 0 ? 3 : listContentIndent + 3;
            if (openIndent > maxOpenIndent) {
              return null;
            }
            const prevListLevelIndent = listIndents.length >= 2 ? listIndents[listIndents.length - 2] : 0;
            return {
              char: openMatch[3][0],
              length: openMatch[3].length,
              quoteDepth: q.depth,
              containerIndent: containerIndent,
              minFirstContentIndent: (!listSawBlank && listOffset === 0 && openIndent - containerIndent >= containerIndent - prevListLevelIndent) ? prevListLevelIndent : containerIndent,
              maxCloseIndent: containerIndent + 3,
              hasContent: false
            };
          }
          return null;
        }
        const closeMatch = q.rest.match(/^([ \t]*)(`{3,}|~{3,})[ \t]*$/);
        if (
          closeMatch &&
          q.depth === activeFence.quoteDepth &&
          countIndentCols(closeMatch[1]) <= activeFence.maxCloseIndent &&
          closeMatch[2][0] === activeFence.char &&
          closeMatch[2].length >= activeFence.length
        ) {
          return null;
        }
        return activeFence;
      };

      const protectedSpans = [];
      const restoreSpans = function (str) {
        return str.replace(spanTokenRe, function (match, idx) {
          return protectedSpans[Number(idx)];
        });
      };
      const maskSpan = function (str, spaceBefore, isBlock, spaceAfter = spaceBefore) {
        const rawStr = restoreSpans(str).replace(/\uE004/g, '|');
        const prefix = spaceBefore ? '\uE000' : '\uE002';
        const suffix = spaceAfter ? '\uE001' : '\uE003';
        const kind = isBlock ? 'B' : (rawStr.includes('\n') ? 'M' : 'S');
        const token = prefix + spanTag + protectedSpans.length + kind + suffix;
        protectedSpans.push(rawStr);
        return token;
      };

      const getTableRowParts = function (line, isDelimCandidate = false, allowAnyOrdered = true) {
        const q = getQuotePrefix(line);
        const maxMarkerIndent = (q.depth === 0 ? (listContentIndent || outerListIndent) : listContentIndent) + 3;
        const listMatch = !THEMATIC_BREAK_RE.test(q.rest) && !(isDelimCandidate && TABLE_DELIMITER_REST_RE.test(q.rest.trimStart())) && (allowAnyOrdered || /^[ \t]*(?:[-*+]|1[.)]) /.test(q.rest)) && q.rest.match(/^([ \t]*(?:(?:[-*+]|\d{1,9}[.)])(?: {1,4}(?! )| (?= {4})|\t))+(?:(?:\[[ xX]\])[ \t]+)?)(.*)$/);
        if (listMatch && countIndentCols(listMatch[1].match(/^[ \t]*/)[0]) <= maxMarkerIndent) {
          return { depth: q.depth, prefix: q.prefix + listMatch[1], rest: listMatch[2], hasList: true };
        }
        return { depth: q.depth, prefix: q.prefix, rest: q.rest, hasList: /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]/.test(q.prefix) };
      };

      const splitTableCells = function (line, isDelimCandidate = false, allowAnyOrdered = true) {
        const t = getTableRowParts(line, isDelimCandidate, allowAnyOrdered);
        const trimmed = t.rest.trim().replace(/^\|/, '').replace(/(?<=(?:^|[^\\])(?:\\\\)*)\|$/, '');
        return trimmed.split(UNESCAPED_PIPE_RE).map(function (cell) {
          return restoreSpans(cell.trim());
        });
      };

      const graphemeSegmenter = new Intl.Segmenter();
      const countCellChars = function (str) {
        return Array.from(graphemeSegmenter.segment(str)).length;
      };

      const getOutdentedCols = function (rest, hasList) {
        let cols = countIndentCols(rest.match(/^[ \t]*/)[0]);
        if (!hasList) {
          let prevIndent = 0;
          for (let i = 0; i < listIndents.length; i++) {
            const h = listIndents[i] - prevIndent;
            prevIndent = listIndents[i];
            if (cols >= h) {
              cols -= h;
            }
          }
        }
        return cols;
      };

      const isTableRowCandidate = function (line, requirePipe = true, isDelimCandidate = false) {
        const t = getTableRowParts(line, isDelimCandidate, requirePipe);
        return (
          !blockSpanLineRe.test(line) &&
          !multilineSpanRe.test(line) &&
          t.rest.trim() !== '' &&
          !THEMATIC_BREAK_RE.test(t.rest) &&
          getOutdentedCols(t.rest, t.hasList) <= 3 &&
          !/^[ \t]*#{1,6}(?:[ \t]|$)/.test(t.rest) &&
          (!requirePipe || (t.rest.trim() !== '|' && UNESCAPED_PIPE_RE.test(t.rest)))
        );
      };

      const isTableDelimiterLine = function (line, minDelimIndent = 0) {
        const q = getQuotePrefix(line);
        const restCols = countIndentCols(q.rest.match(/^[ \t]*/)[0]);
        const allowListDelim = restCols >= minDelimIndent;
        return (
          countIndentCols((q.prefix + q.rest).match(/^[ \t]*/)[0]) >= outerMinLazy &&
          restCols >= minLazyIndent &&
          !getTableRowParts(line, allowListDelim).hasList &&
          isTableRowCandidate(line, true, allowListDelim) &&
          splitTableCells(line, allowListDelim).every(function (cell) {
            return /^:?-+:?$/.test(cell);
          })
        );
      };

      const definedRefLabels = new Set();
      const normalizeRefLabel = function (lbl) {
        return restoreSpans(lbl).replace(/\s+/g, ' ').toLowerCase();
      };

      const compactEmphWithNext = function (str) {
        return str
          .split('\n\n')
          .pop()
          .replace(/(?<=[\p{L}\p{N}])_+(?=[\p{L}\p{N}])/gu, 'a')
          .replace(/(?:^|\s+)(?:[^\s*_~]+\s+)+|\s+/g, ' ')
          .replace(/((?:^|\s)([*_~]+)[^\s*_~]+\s+)(?:\2[^\s*_~]+\s+)+/g, '$1')
          .replace(/((?<=^|[\s\p{P}$+<=>`^|~])\*+(?=[^\s*])|\*+(?=[^\s\p{P}$+<=>`^|~]))[\s\S]*?(?<![\s*])\1/gu, 'a')
          .replace(/(?<=^|[\s\p{P}$+<=>`^|~])(?<!_)(_+)(?=[^\s_])[\s\S]*?(?<![\s_])\1(?=$|[\s\p{P}$+<=>`^|~])(?!_)/gu, 'a')
          .replace(/(?<!~)(~~?)(?=[^\s~])[\s\S]*?(?<![\s~])\1(?!~)/g, 'a')
          .replace(/[*_~]+(?=\s)/g, 'a')
          .replace(/(?:^|\s+)(?:[^\s*_~]+\s+)+|\s+/g, ' ')
          .replace(/((?:^|\s)([*_~]+)[^\s*_~]+\s+)(?:\2[^\s*_~]+\s+)+/g, '$1');
      };

      const closesPreUrlEmphasis = function (compactedWithNext, delimChar) {
        if (delimChar === '*') {
          return /(?<=^|[\s\p{P}$+<=>`^|~])\*+(?=[^\s*])|\*+(?=[^\s\p{P}$+<=>`^|~])/u.test(compactedWithNext);
        }
        if (delimChar === '_') {
          return /(?<=^|[\s\p{P}$+<=>`^|~])(?<!_)_+(?=[^\s_])/u.test(compactedWithNext);
        }
        return /(?<!~)~~?(?=[^\s~])/.test(compactedWithNext);
      };

      const maskLinkDestinations = function (str) {
        const labelOpenByClose = new Map();
        const flatLabelClose = new Set();
        const directClose = new Map();
        const fallbackClose = new Map();
        const runEndBeforeTitle = new Map();
        const bracketStack = [];
        let lastBracketIdx = -1;
        let paraStart = 0;
        let k = 0;
        while (k < str.length) {
          if (/[\s\uE004]/.test(str[k])) {
            let newlines = 0;
            while (k < str.length && /[\s\uE004]/.test(str[k])) {
              if (str[k] === '\n') {
                newlines++;
              } else if (str[k] === '\uE004') {
                newlines += 2;
              }
              k++;
            }
            if (newlines >= 2) {
              bracketStack.length = 0;
              paraStart = k;
            }
            continue;
          }
          const runStart = k;
          const runKey = -k - 1;
          const parenStack = [];
          let hasUnmatchedClose = false;
          let fallbackCloseIdx = -1;
          let lastInsertedSpaceIdx = -1;
          let closesSinceSpace = 0;
          while (k < str.length && !/[\s\uE004]/.test(str[k])) {
            if (str[k] === '\\' && k + 1 < str.length && !/[（）]/.test(str[k + 1])) {
              if (str[k + 1] === ')') {
                fallbackCloseIdx = k + 1;
              }
              k += 2;
              continue;
            }
            const bareUrlBeforeBracket = str[k] === '[' && bracketStack.length === 0
              ? str.slice(runStart, k).match(/^([^\[\]]*?)(?:(?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9-]+\.?)+([^\uE000-\uE003]*)$/i)
              : null;
            if (
              str[k] === '[' &&
              !(
                bareUrlBeforeBracket &&
                !(bareUrlBeforeBracket[2].match(/[*~]|_(?![\p{L}\p{N}_])/gu) || []).some(function (ch) {
                  return closesPreUrlEmphasis(str.slice(paraStart, runStart + bareUrlBeforeBracket[1].length + 1), ch[0]);
                })
              )
            ) {
              bracketStack.push(k);
              lastBracketIdx = k;
            } else if (str[k] === ']' && bracketStack.length > 0) {
              const openB = bracketStack.pop();
              labelOpenByClose.set(k, openB);
              if (lastBracketIdx === openB) {
                flatLabelClose.add(k);
              }
              lastBracketIdx = k;
            } else if (str[k] === '(') {
              parenStack.push(k);
            } else if (str[k] === ')') {
              fallbackCloseIdx = k;
              closesSinceSpace++;
              if (parenStack.length > 0) {
                directClose.set(parenStack.pop(), k);
              } else if (!hasUnmatchedClose) {
                hasUnmatchedClose = true;
                directClose.set(runKey, k);
              }
            } else if (
              str[k] === '（' &&
              k > runStart &&
              /[A-Za-z0-9\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af\uE001]/.test(str[k - 1])
            ) {
              lastInsertedSpaceIdx = k;
              closesSinceSpace = 0;
            } else if (str[k] === '）') {
              closesSinceSpace++;
              if (
                lastInsertedSpaceIdx === -1 ||
                closesSinceSpace >= 2 ||
                (parenStack.length > 0 && parenStack[parenStack.length - 1] > lastInsertedSpaceIdx)
              ) {
                fallbackCloseIdx = k;
              }
            }
            k++;
          }
          for (let p = 0; p < parenStack.length; p++) {
            const openParen = parenStack[p];
            runEndBeforeTitle.set(openParen, k);
            if (fallbackCloseIdx > openParen) {
              fallbackClose.set(openParen, fallbackCloseIdx);
            }
          }
          if (!hasUnmatchedClose) {
            runEndBeforeTitle.set(runKey, k);
            if (fallbackCloseIdx !== -1) {
              fallbackClose.set(runKey, fallbackCloseIdx);
            }
          }
        }

        const titleCloseReMap = {
          '"': /["\uE004]|\n[ \t]*\n/g,
          "'": /['\uE004]|\n[ \t]*\n/g,
          '(': /[)）\uE004]|\n[ \t]*\n/g,
          '（': /[)）\uE004]|\n[ \t]*\n/g
        };
        const noTitleCloseUntil = { '"': -1, "'": -1, '(': -1, '（': -1 };
        const matchLinkTailAt = function (pos) {
          const wsEnd = pos + str.slice(pos).match(/^(?:[ \t]|\n(?![ \t]*\n))*/)[0].length;
          const ch = str[wsEnd];
          if (ch in noTitleCloseUntil && wsEnd < noTitleCloseUntil[ch]) {
            return null;
          }
          const m = str.slice(pos).match(LINK_TAIL_RE);
          if (!m && ch in noTitleCloseUntil) {
            const closeRe = titleCloseReMap[ch];
            closeRe.lastIndex = wsEnd + 1;
            const cm = closeRe.exec(str);
            noTitleCloseUntil[ch] = cm ? cm.index : str.length;
          }
          return m;
        };

        let out = '';
        let i = 0;
        let searchIdx = 0;
        while (i < str.length) {
          const openIdx = str.indexOf(']', searchIdx);
          if (openIdx === -1) {
            out += str.slice(i);
            break;
          }
          if (!labelOpenByClose.has(openIdx)) {
            searchIdx = openIdx + 1;
            continue;
          }
          const bracketOpenIdx = labelOpenByClose.get(openIdx);
          if (str[openIdx + 1] === '[') {
            const refMatch = str.slice(openIdx + 1).match(/^\[((?!\s*\])(?:\\.|[^\[\]\\\n\uE004]|\n(?![ \t]*\n))+)\]/);
            if (refMatch) {
              const hasDef = definedRefLabels.has(normalizeRefLabel(refMatch[1]));
              out += str.slice(i, openIdx + 2) + maskSpan(refMatch[1], false) + (hasDef ? ']' : '');
              i = openIdx + refMatch[0].length + (hasDef ? 1 : 0);
              searchIdx = i;
              continue;
            }
          } else if (str[openIdx + 1] === '(') {
            const parenIdx = openIdx + 1;
            let cursor = openIdx + 2;
            const leadWs = str.slice(cursor).match(/^(?:[ \t]|\n(?![ \t]*\n))+/);
            if (leadWs) {
              cursor += leadWs[0].length;
            }
            const lookupKey = leadWs ? -cursor - 1 : parenIdx;
            let endIdx = -1;
            let tailStart = -1;
            if (str[cursor] === '<') {
              const angleMatch = str.slice(cursor).match(/^<(?:\\.|[^<>\\\r\n\uE004])*>/);
              if (angleMatch) {
                tailStart = cursor + angleMatch[0].length;
              }
            } else if (directClose.has(lookupKey)) {
              endIdx = directClose.get(lookupKey);
            } else if (runEndBeforeTitle.has(lookupKey)) {
              tailStart = runEndBeforeTitle.get(lookupKey);
            }
            if (tailStart !== -1) {
              const attachedOpen = str.slice(cursor, tailStart).search(/^（|(?<=[\]\p{L}\p{N}\uE001])（/u);
              const tailMatch = matchLinkTailAt(tailStart) || (attachedOpen !== -1 && matchLinkTailAt(tailStart = cursor + attachedOpen));
              if (tailMatch) {
                endIdx = tailStart + tailMatch[0].length - 1;
              } else if (fallbackClose.has(lookupKey)) {
                endIdx = fallbackClose.get(lookupKey);
              }
            }
            if (endIdx !== -1) {
              out += str.slice(i, openIdx + 2) + maskSpan(str.slice(openIdx + 2, endIdx), false) + (str[endIdx] === ')' ? ')' : maskSpan('）', false));
              i = endIdx + 1;
              searchIdx = i;
              continue;
            }
          }
          const lbl = flatLabelClose.has(openIdx) ? str.slice(bracketOpenIdx + 1, openIdx) : '';
          if (
            lbl &&
            /^(?!\s*$)(?:\\.|[^\[\]\\\uE004])+$/.test(restoreSpans(lbl)) &&
            definedRefLabels.has(normalizeRefLabel(lbl))
          ) {
            const collapsedSuffix = str.slice(openIdx + 1, openIdx + 3) === '[]' ? '[]' : '';
            out += str.slice(i, bracketOpenIdx + 1) + maskSpan(lbl, false) + ']' + collapsedSuffix;
            i = openIdx + 1 + collapsedSuffix.length;
            searchIdx = i;
            continue;
          }
          out += str.slice(i, openIdx + 1);
          i = openIdx + 1;
          searchIdx = i;
        }
        return out;
      };

      const fmOpen = lines[0].match(/^\uFEFF?(---|\+\+\+)[ \t]*$/);
      const fmCloseRe = fmOpen ? (fmOpen[1] === '---' ? /^(?:---|\.\.\.)[ \t]*$/ : /^\+\+\+[ \t]*$/) : null;
      const fmCloseIdx = fmCloseRe ? lines.slice(1).findIndex(function (l) {
        return fmCloseRe.test(l);
      }) + 1 : 0;
      const fmEndIdx = fmCloseIdx > 0 && (fmOpen[1] === '+++' || /^[ \t]*(?:\?(?:[ \t]+|$)|(?:\{[ \t]*)*(?:[\p{L}\p{N}_.-]+|"(?:\\.|[^"\\])*"|'(?:''|[^'])*')[ \t]*:(?:[ \t\}]|$))/u.test(lines.slice(1, fmCloseIdx).find(function (l) {
        return !/^[ \t]*(?:#|\{[ \t]*$|$)/.test(l);
      }) || '')) ? fmCloseIdx : 0;
      if (fmEndIdx > 0) {
        lines.slice(1, fmEndIdx).join('\n').replace(/^[ \t]{0,3}\[((?:\\.|[^\\\n\]])+)\]:[ \t]*(?:\n[ \t]*)?(?:<[^>\r\n]+>|\S+)(?:(?:[ \t]+|[ \t]*\n[ \t]*)(?:"(?:\\.|[^"\n]|\n(?![ \t]*\n))*"|'(?:\\.|[^'\n]|\n(?![ \t]*\n))*'|\((?:\\.|[^()\n]|\n(?![ \t]*\n))*\)))?[ \t]*(?=\n|$)/gm, function (_m, lbl) {
          definedRefLabels.add(normalizeRefLabel(lbl));
          return '';
        });
      }

      const segments = [];
      let currentProseLines = [];
      let activeFence = null;
      let activeHtml = null;
      let inProseTable = false;
      let tableOpenParaDepth = -1;
      let tableStartIdx = -1;
      const flushProse = function () {
        if (currentProseLines.length > 0) {
          segments.push({ fenced: false, text: currentProseLines.join('\n') });
          currentProseLines = [];
        }
        inProseTable = false;
        tableOpenParaDepth = -1;
        tableStartIdx = -1;
      };
      const headingCache = new WeakMap();
      const paraDepthCache = new WeakMap();
      const isHeadingLineAt = function (arr, idx) {
        let cache = headingCache.get(arr);
        if (!cache) {
          cache = [];
          headingCache.set(arr, cache);
        } else if (idx in cache) {
          return cache[idx].heading;
        }
        for (let m = cache.length; m < idx; m++) {
          isHeadingLineAt(arr, m);
        }
        const isBlockSpan = blockSpanLineRe.test(arr[idx]);
        const rawLine = isBlockSpan ? restoreSpans(arr[idx]) : arr[idx];
        const tk = getTableRowParts(rawLine);
        const qk = getQuotePrefix(rawLine);
        const prev = idx > 0 ? cache[idx - 1] : null;
        const isSetextUnderline = !isBlockSpan && /^[ \t]{0,3}(?:=+|-+)[ \t]*$/.test(tk.rest);
        const nonLazySetext = isSetextUnderline && getOpenSetextParaDepth(arr, idx - 1, tk.depth, false) >= 0;
        const baseHeading = (
          isBlockSpan ||
          /^[ \t]{0,3}#{1,6}(?:[ \t]|$)/.test(tk.rest) ||
          THEMATIC_BREAK_RE.test(tk.rest) ||
          (/^(?:\$\$|[ \t]*\uE002)/.test(tk.rest) && /^[ \t]*\$\$[\s\S]+\$\$[ \t]*$/.test(restoreSpans(tk.rest))) ||
          nonLazySetext ||
          (isSetextUnderline && getOpenSetextParaDepth(arr, idx - 1, tk.depth) >= 0)
        );
        let isDef = false;
        let standaloneDef = false;
        let defCont = false;
        if (!baseHeading && tk.rest.trim() !== '') {
          for (let defStart = Math.max(0, idx - 2); defStart <= idx; defStart++) {
            const startT = getTableRowParts(arr[defStart]);
            if (
              startT.depth === tk.depth &&
              !(defStart < idx && cache[defStart].defCont) &&
              /^[ \t]{0,3}\[/.test(startT.rest) &&
              (defStart === 0 || startT.hasList || tk.depth > cache[defStart - 1].depth || getTableRowParts(arr[defStart - 1]).rest.trim() === '' || cache[defStart - 1].heading) &&
              REF_DEF_RE.test(arr.slice(defStart, idx + 1).map(function (l) {
                return restoreSpans(getTableRowParts(l).rest);
              }).join('\n'))
            ) {
              isDef = true;
              standaloneDef = getOpenSetextParaDepth(arr, defStart - 1, tk.depth) < 0;
              defCont = defStart < idx;
              break;
            }
          }
        }
        const heading = baseHeading || isDef;
        const depth = (
          prev &&
          prev.depth > tk.depth &&
          !prev.heading &&
          !nonLazySetext &&
          getTableRowParts(arr[idx - 1]).rest.trim() !== '' &&
          tk.rest.trim() !== '' &&
          !hasBlockInterrupt(qk.rest)
        ) ? prev.depth : tk.depth;
        const nextLine = idx + 1 < arr.length ? arr[idx + 1] : curForEachLine;
        const noSetext = !heading && tk.rest.trim() !== '' && !listContentIndent && !outerListIndent && (
          (idx > 0 && !prev.heading && getTableRowParts(arr[idx - 1]).rest.trim() !== '' && !/^[ \t]{0,3}(?:[*+-]|\d{1,9}[.)])[ \t]/.test(getQuotePrefix(arr[idx - 1]).rest) && /^(?!1[.)])\d{1,9}[.)][ \t]/.test(qk.rest)) ||
          Boolean(prev && prev.noSetext && tk.depth <= prev.depth && !TABLE_DELIMITER_REST_RE.test(getQuotePrefix(nextLine).rest))
        );
        cache[idx] = { heading: heading, isDef: standaloneDef, depth: depth, noSetext: noSetext, defCont: defCont };
        return heading;
      };
      const getOpenSetextParaDepth = function (arr, endIdx, maxDepth, canLazyQuote = true) {
        if (endIdx >= 0) {
          isHeadingLineAt(arr, endIdx);
        }
        const cache = headingCache.get(arr);
        let pCache = paraDepthCache.get(arr);
        if (!pCache) {
          pCache = new Map();
          paraDepthCache.set(arr, pCache);
        }
        const visitedKeys = [];
        let crossedHeading = false;
        let res = -1;
        for (let k = endIdx; k >= 0; k--) {
          const isBlockSpan = blockSpanLineRe.test(arr[k]);
          const rawK = isBlockSpan ? restoreSpans(arr[k]) : arr[k];
          if ((isBlockSpan && fmEndIdx > 0 && k <= fmEndIdx) || ((isBlockSpan || crossedHeading) && /^[ \t]{0,3}(?:[*+-]|\d{1,9}[.)])[ \t]/.test(getQuotePrefix(rawK).rest))) break;
          const key = k + ':' + maxDepth + ':' + (canLazyQuote ? 1 : 0) + ':' + (crossedHeading ? 1 : 0);
          if (pCache.has(key)) {
            res = pCache.get(key);
            break;
          }
          visitedKeys.push(key);
          const tk = getTableRowParts(rawK);
          const entry = cache[k];
          if (entry.depth > maxDepth) {
            if (canLazyQuote && tk.rest.trim() !== '' && !entry.heading) {
              res = maxDepth;
              break;
            }
            canLazyQuote = false;
            continue;
          }
          if (tk.rest.trim() === '') {
            if (tk.depth === 0) break;
            maxDepth = tk.depth - 1;
            canLazyQuote = false;
            continue;
          }
          maxDepth = entry.depth;
          if (!entry.heading) {
            res = entry.noSetext ? -1 : maxDepth;
            break;
          }
          if (entry.isDef || /^[ \t]{0,3}(?:=+|-+)[ \t]*$/.test(tk.rest)) {
            break;
          }
          if (!/^[ \t]*\$\$[\s\S]+\$\$[ \t]*$/.test(restoreSpans(tk.rest))) {
            crossedHeading = true;
          }
        }
        for (let i = 0; i < visitedKeys.length; i++) {
          pCache.set(visitedKeys[i], res);
        }
        return res;
      };
      let setextLookaheadIdx = -1;
      let setextLookaheadKey = '';
      let setextLookaheadRes = false;
      let setextMinKey = '';
      let setextNextEventIdx = -1;
      const hasFollowingSetextUnderline = function (startIdx, minQuoteDepth, maxQuoteDepth, indentCols) {
        const key = minQuoteDepth + ':' + maxQuoteDepth + ':' + indentCols;
        if (setextLookaheadKey === key && startIdx < setextLookaheadIdx) {
          return setextLookaheadRes;
        }
        const minKey = minQuoteDepth + ':' + indentCols;
        if (setextMinKey !== minKey || startIdx >= setextNextEventIdx) {
          setextMinKey = minKey;
          setextNextEventIdx = startIdx + 1;
        }
        let k = setextNextEventIdx;
        let foundUnderline = false;
        for (; k < lines.length; k++) {
          const mq = getQuotePrefix(lines[k]);
          const mRest = mq.rest.slice(Math.min(mq.rest.match(/^ */)[0].length, indentCols));
          const isStoppingRest = mRest.trim() === '' || /^(?:[*+-]|\d{1,9}[.)])[ \t]/.test(mRest) || /^ {0,3}(?:=+|-+)[ \t]*$/.test(mRest);
          if (mq.depth < minQuoteDepth || (mq.depth <= maxQuoteDepth && isStoppingRest)) {
            foundUnderline = mq.depth >= minQuoteDepth && mq.depth <= maxQuoteDepth && /^ {0,3}(?:=+|-+)[ \t]*$/.test(mRest);
            break;
          }
          if (k === setextNextEventIdx && !isStoppingRest) {
            setextNextEventIdx = k + 1;
          }
        }
        setextLookaheadKey = key;
        setextLookaheadIdx = k;
        setextLookaheadRes = foundUnderline;
        return foundUnderline;
      };
      let proseParaStartIdx = 0;
      let mathCloseLineIdx = -1;
      let curForEachLine = '';
      lines.forEach(function (line, lineIdx) {
        curForEachLine = line;
        if (fmEndIdx > 0 && lineIdx <= fmEndIdx) {
          segments.push({ fenced: true, skipListUpdate: true, line: line });
          return;
        }
        if (lineIdx <= mathCloseLineIdx) {
          currentProseLines.push(line);
          return;
        }
        const qBefore = getQuotePrefix(line);
        const prevLineBlank = lineIdx > 0 && lines[lineIdx - 1].trim() === '';
        if (hasContainerEnded(line, activeHtml, prevLineBlank)) {
          activeHtml = null;
        }
        if (activeHtml) {
          let skipListUpdate = true;
          if (qBefore.depth <= activeHtml.quoteDepth && activeHtml.htmlRe.test(qBefore.rest)) {
            activeHtml = null;
            if (qBefore.rest.trim() === '') {
              updateListIndent(line, true);
              skipListUpdate = false;
            }
          }
          segments.push({ fenced: true, skipListUpdate: skipListUpdate, line: line });
          return;
        }
        if (hasContainerEnded(line, activeFence, prevLineBlank)) {
          activeFence = null;
        }
        const prevT = currentProseLines.length > 0 ? getTableRowParts(currentProseLines[currentProseLines.length - 1]) : null;
        const prevProse = prevT ? prevT.rest : '';
        const prevQuoteDepth = listQuoteDepth;
        const isBlockBoundary =
          !prevT ||
          qBefore.depth > prevQuoteDepth ||
          prevProse.trim() === '' ||
          (!inProseTable && isHeadingLineAt(currentProseLines, currentProseLines.length - 1));
        if (isBlockBoundary) {
          proseParaStartIdx = currentProseLines.length;
        }
        const prevListIndent = prevProse.trim() === '' ? 0 : listContentIndent;
        const prevOuterListIndent = prevProse.trim() === '' ? 0 : outerListIndent;
        const prevMinLazyIndent = minLazyIndent;
        const prevOuterMinLazy = outerMinLazy;
        const allowAnyOrdered = isBlockBoundary || prevListIndent > 0 || (qBefore.depth < prevQuoteDepth && outerListIndent > 0) || (!inProseTable && lineIdx + 1 < lines.length && TABLE_DELIMITER_REST_RE.test(getQuotePrefix(lines[lineIdx + 1]).rest));
        const isTableStartDelim =
          !isBlockBoundary &&
          !inProseTable &&
          qBefore.depth <= prevQuoteDepth &&
          !(/^[ \t]*\$\$.+\$\$[ \t]*$/.test(prevProse) && countIndentCols(prevProse.match(/^[ \t]*/)[0]) <= (prevT.hasList ? 0 : prevListIndent)) &&
          isTableRowCandidate(currentProseLines[currentProseLines.length - 1]) &&
          isTableDelimiterLine(line, qBefore.depth < prevQuoteDepth ? Infinity : (listContentIndent || prevListIndent || (prevT.hasList ? countIndentCols(prevT.prefix) : 0))) &&
          splitTableCells(currentProseLines[currentProseLines.length - 1]).length === splitTableCells(line, true).length;
        const allowRowList = !inProseTable ? allowAnyOrdered : countIndentCols(qBefore.rest.match(/^[ \t]*/)[0]) < (listContentIndent || (qBefore.depth < prevQuoteDepth ? outerListIndent : 0));
        if (!activeFence) {
          if (!isTableStartDelim) {
            updateListIndent(line, false, allowRowList);
          } else {
            updateLazyListSlice(line);
          }
        }
        const t = getTableRowParts(line, isTableStartDelim, allowRowList);
        const prevDepthListIndent = qBefore.depth === prevQuoteDepth ? prevListIndent : prevOuterListIndent;
        const currDepthListIndent = qBefore.depth > prevQuoteDepth ? outerListIndent : listContentIndent;
        const openSetextDepth = (prevT && prevProse.trim() !== '' && currDepthListIndent === prevDepthListIndent && !inProseTable && !t.hasList)
          ? getOpenSetextParaDepth(currentProseLines, currentProseLines.length - 1, qBefore.depth, false)
          : -1;
        const inSetextHeading = openSetextDepth >= 0 && hasFollowingSetextUnderline(lineIdx, openParaQuoteDepth >= 0 && openParaQuoteDepth < openSetextDepth ? openParaQuoteDepth : openSetextDepth, openSetextDepth, prevDepthListIndent);
        const nextFence = updateFenceState(line, activeFence, allowAnyOrdered);
        if (
          nextFence !== activeFence &&
          !(nextFence && inSetextHeading) &&
          !(nextFence && !isBlockBoundary && !inProseTable && nextFence.char === '`' && (lineIdx + 1 >= lines.length || lines[lineIdx + 1].trim() === '') && new RegExp('(?<=(?:^|[^\\\\`])(?:\\\\\\\\|\\\\`)*)' + '`'.repeat(nextFence.length) + '(?!`)').test(
            currentProseLines.slice(proseParaStartIdx).join('\n')
              .replace(/^[ \t]{0,3}`{3,}[^`\n]*`[^\n]*$/gm, '')
              .replace(/(?<=(?:^|[^\\`])(?:\\\\|\\`)*)(`+)(?!`)(?:[\s\S]*?[^`])?\1(?!`)/g, '')
          ))
        ) {
          flushProse();
          const isClosingFence = Boolean(activeFence);
          activeFence = nextFence;
          segments.push({ fenced: true, skipListUpdate: isClosingFence, line: line });
          return;
        }
        if (activeFence) {
          activeFence.hasContent = true;
          const isBlankFenceLine = qBefore.rest.trim() === '';
          if (isBlankFenceLine) {
            updateListIndent(line, true);
          }
          segments.push({ fenced: true, skipListUpdate: !isBlankFenceLine, line: line.replace(/（/g, '(').replace(/）/g, ')') });
          return;
        }
        const atBlockStart = isBlockBoundary || t.hasList;
        if (!inSetextHeading && (atBlockStart || inProseTable) && t.rest.trim() !== '' && getOutdentedCols(t.rest, t.hasList) > 3) {
          flushProse();
          segments.push({ fenced: true, line: line.replace(/（/g, '(').replace(/）/g, ')') });
          return;
        }
        const htmlCloseRe = !inSetextHeading && getHtmlBlockCloseRe(t.rest.slice(Math.min(t.rest.match(/^ */)[0].length, listContentIndent)), atBlockStart || allowAnyOrdered);
        if (htmlCloseRe) {
          flushProse();
          segments.push({ fenced: true, line: line });
          if (!htmlCloseRe.test(t.rest)) {
            activeHtml = {
              htmlRe: htmlCloseRe,
              quoteDepth: t.depth,
              containerIndent: t.depth > 0 ? 0 : listContentIndent
            };
          }
          return;
        }
        if (
          !isTableStartDelim &&
          !inProseTable &&
          !/^[ \t]{0,3}#{1,6}[ \t]/.test(t.rest) &&
          /^[ \t]*\$\$(?![^\n]*\$\$[ \t]*$)/.test(t.rest) &&
          !(prevListIndent > 0 && !t.hasList && countIndentCols(t.rest.match(/^[ \t]*/)[0]) > listContentIndent)
        ) {
          for (let k = lineIdx + 1; k < lines.length; k++) {
            if (/\$\$(?=[ \t]*$)/.test(lines[k])) {
              mathCloseLineIdx = k;
              break;
            }
          }
        }
        if (isTableStartDelim) {
          inProseTable = true;
          tableStartIdx = currentProseLines.length - 1;
          tableOpenParaDepth = getOpenSetextParaDepth(currentProseLines, tableStartIdx - 1, prevT.depth);
          currentProseLines[tableStartIdx] = currentProseLines[tableStartIdx].replace(new RegExp(UNESCAPED_PIPE_RE, 'g'), '\uE004');
          currentProseLines.push(line);
        } else if (!isBlockBoundary && inProseTable && !t.hasList && !((prevListIndent > 0 && listContentIndent < prevListIndent) || (prevOuterListIndent > 0 && outerListIndent < prevOuterListIndent)) && countIndentCols(line.match(/^[ \t]*/)[0]) >= prevOuterMinLazy && countIndentCols(t.prefix.slice(qBefore.prefix.length) + t.rest.match(/^[ \t]*/)[0]) >= ((countIndentCols(getTableRowParts(currentProseLines[tableStartIdx]).prefix.slice(getQuotePrefix(currentProseLines[tableStartIdx]).prefix.length) + getTableRowParts(currentProseLines[tableStartIdx]).rest.match(/^[ \t]*/)[0]) >= listContentIndent && countIndentCols(getQuotePrefix(currentProseLines[tableStartIdx + 1]).rest.match(/^[ \t]*/)[0]) >= listContentIndent) ? listContentIndent : prevMinLazyIndent) && isTableRowCandidate(line, false)) {
          if (t.depth <= tableOpenParaDepth && /^[ \t]*(?:=+|-+)[ \t]*$/.test(t.rest)) {
            for (let i = tableStartIdx; i < currentProseLines.length; i++) {
              currentProseLines[i] = currentProseLines[i].replace(/\uE004/g, '|');
            }
            inProseTable = false;
            currentProseLines.push(line);
          } else {
            currentProseLines.push(line.replace(new RegExp(UNESCAPED_PIPE_RE, 'g'), '\uE004'));
          }
        } else {
          inProseTable = false;
          currentProseLines.push(line);
        }
      });
      flushProse();

      const maskMath = function (str) {
        const openRe = /\$\$|(?<=(?:^|[^\\])(?:\\\\)*)\$(?!\$)[^\s$\uE004]/g;
        const blockCloseRe = /\$\$(?=[ \t]*(?:\n|$))/g;
        const closeRe = /(?<=[^\s$])\$(?!\d)/g;
        const paraBreakRe = /(?<=^[ \t]*(?:>[ \t]*)*#{1,6}[ \t][^\n]*)\n|(?<!^[ \t]*>[^\n]*)\n(?=[ \t]*>)|\n(?=[ \t]*(?:>[ \t]*)*(?:\n|$|#{1,6}(?:[ \t]|$)|(?:[-*+]|\d{1,9}[.)])[ \t]|(?:=+|-+)[ \t]*(?:\n|$)|(?:\*[ \t]*){3,}(?:\n|$)|(?:_[ \t]*){3,}(?:\n|$)|\$\$))/gm;
        const rowBreakRe = /[\n\uE004]/g;
        let blockCloseIdx = -2;
        let inlineCloseIdx = -2;
        let paraBreakIdx = -2;
        let rowBreakIdx = -2;
        listContentIndent = 0;
        outerListIndent = 0;
        listQuoteDepth = 0;
        openParaQuoteDepth = -1;
        quoteCanLazyContinue = false;
        listIndents = [];
        listSawBlank = false;
        listOpenedInPara = false;
        minLazyIndent = 0;
        outerMinLazy = 0;
        let curLineStart = 0;
        let curLineEnd = -1;
        let curLine = '';
        let curFirstPipeIdx = Infinity;
        let curPipeScanIdx = Infinity;
        let curHasHeading = false;
        let curContentStart = 0;
        let curInlineStart = 0;
        let prevInlineBreak = true;
        let prevInlineQuoteDepth = 0;
        let inListPara = false;
        let out = '';
        let lastIdx = 0;
        let m;
        while ((m = openRe.exec(str)) !== null) {
          while (m.index > curLineEnd) {
            curLineStart = curLineEnd + 1;
            const nextNl = str.indexOf('\n', curLineStart);
            curLineEnd = nextNl === -1 ? str.length : nextNl;
            curLine = str.slice(curLineStart, curLineEnd);
            const curT = getTableRowParts(curLine);
            updateListIndent(curLine, false);
            inListPara = curT.rest.trim() !== '' && (listContentIndent > 0 || (inListPara && !hasBlockInterrupt(curT.rest)));
            const pipeOffset = curLine.indexOf('\uE004');
            curFirstPipeIdx = pipeOffset === -1 ? Infinity : curLineStart + pipeOffset;
            curPipeScanIdx = curFirstPipeIdx;
            curHasHeading = /^[ \t]{0,3}#{1,6}[ \t]/.test(curT.rest);
            curContentStart = curLineStart + curT.prefix.length + curT.rest.match(/^[ \t]*/)[0].length;
            if (curLineStart === 0 || prevInlineBreak || curT.depth > prevInlineQuoteDepth || curT.hasList || curHasHeading || curFirstPipeIdx !== Infinity) {
              curInlineStart = curLineStart + curT.prefix.length + curT.rest.match(/^[ \t]*(?:#{1,6}[ \t]+)?/)[0].length;
            }
            prevInlineBreak = curT.rest.trim() === '' || curHasHeading || curFirstPipeIdx !== Infinity || THEMATIC_BREAK_RE.test(curT.rest) || /^[ \t]{0,3}(?:=+|-+)[ \t]*$/.test(curT.rest);
            prevInlineQuoteDepth = curT.depth;
          }
          if (m[0] === '$$') {
            if (!curHasHeading && m.index < curFirstPipeIdx && (!inListPara || m.index <= curContentStart)) {
              if (blockCloseIdx !== -1 && blockCloseIdx < m.index + 3) {
                blockCloseRe.lastIndex = m.index + 3;
                const bm = blockCloseRe.exec(str);
                blockCloseIdx = bm ? bm.index : -1;
              }
              if (blockCloseIdx !== -1) {
                openRe.lastIndex = blockCloseIdx + 2;
                const rawMath = str.slice(m.index, openRe.lastIndex);
                if (!rawMath.includes('\uE004') || rawMath.includes('\n')) {
                  out += str.slice(lastIdx, m.index) + maskSpan(rawMath.replace(/\uE004/g, '|'), false);
                  lastIdx = openRe.lastIndex;
                }
                continue;
              }
            }
            while (curPipeScanIdx < m.index) {
              curInlineStart = curPipeScanIdx + 1 + curLine.slice(curPipeScanIdx - curLineStart + 1).match(/^[ \t]*/)[0].length;
              const nextPipe = curLine.indexOf('\uE004', curPipeScanIdx - curLineStart + 1);
              curPipeScanIdx = nextPipe === -1 ? Infinity : curLineStart + nextPipe;
            }
            if ((m.index !== curInlineStart && str[m.index - 1] !== '\\') || !/[^\s$\uE004]/.test(str[m.index + 2] || '')) {
              continue;
            }
            m.index++;
            openRe.lastIndex = m.index + 2;
          } else if (m.index > lastIdx && str[m.index - 1] === '$') {
            continue;
          }
          {
            let limitIdx;
            if (curFirstPipeIdx !== Infinity) {
              if (rowBreakIdx !== -1 && rowBreakIdx < openRe.lastIndex) {
                rowBreakRe.lastIndex = openRe.lastIndex;
                const rm = rowBreakRe.exec(str);
                rowBreakIdx = rm ? rm.index : -1;
              }
              limitIdx = rowBreakIdx === -1 ? str.length : rowBreakIdx;
            } else {
              if (paraBreakIdx !== -1 && paraBreakIdx < openRe.lastIndex) {
                paraBreakRe.lastIndex = openRe.lastIndex;
                let pm = paraBreakRe.exec(str);
                while (pm && /^\n[ \t]*(?:>[ \t]*)*\$\$/.test(str.slice(pm.index))) {
                  const ddIdx = str.indexOf('$$', pm.index);
                  if (blockCloseIdx !== -1 && blockCloseIdx < ddIdx + 3) {
                    blockCloseRe.lastIndex = ddIdx + 3;
                    const bm = blockCloseRe.exec(str);
                    blockCloseIdx = bm ? bm.index : -1;
                  }
                  if (blockCloseIdx !== -1) break;
                  pm = paraBreakRe.exec(str);
                }
                paraBreakIdx = pm ? pm.index : -1;
              }
              limitIdx = paraBreakIdx === -1 ? str.length : paraBreakIdx;
            }
            if (inlineCloseIdx !== -1 && inlineCloseIdx < openRe.lastIndex) {
              closeRe.lastIndex = openRe.lastIndex;
              const cm = closeRe.exec(str);
              inlineCloseIdx = cm ? cm.index : -1;
            }
            if (inlineCloseIdx === -1 || inlineCloseIdx >= limitIdx) {
              openRe.lastIndex = limitIdx;
              continue;
            }
            let matchCloseIdx = inlineCloseIdx;
            if (matchCloseIdx === openRe.lastIndex) {
              closeRe.lastIndex = matchCloseIdx + 1;
              const cm2 = closeRe.exec(str);
              inlineCloseIdx = cm2 ? cm2.index : -1;
              if (inlineCloseIdx !== -1 && inlineCloseIdx < limitIdx) {
                matchCloseIdx = inlineCloseIdx;
              }
            }
            openRe.lastIndex = matchCloseIdx + 1;
            out += str.slice(lastIdx, m.index) + maskSpan(str.slice(m.index, openRe.lastIndex).replace(/\uE004/g, '|'), true);
            lastIdx = openRe.lastIndex;
          }
        }
        return out + str.slice(lastIdx);
      };

      segments.forEach(function (seg) {
        if (seg.fenced) return;
        let validDefEnd = 0;
        const preDefLines = [];
        let preDefCursor = 0;
        // CommonMark and the bundled Marked parser do not allow inline code spans to cross blank
        // lines or block-interrupting lines, because blocks are split before inline lexing.
        seg.preMasked = maskMath(
          seg.text
            .replace(/(?<=(?:^|[^\\`])(?:\\\\|\\`)*)(`+)(?!`)(?:(?:[^\uE004\n]|(?<!^[ \t]*(?:>[ \t]*)*#{1,6}[ \t][^\n]*)(?:(?<=^[ \t]*>[^\n]*)|(?=[^\n]*\n(?![ \t]*>)))\n(?![ \t]*(?:>[ \t]*)*(?:\n|$|#{1,6}(?:[ \t]|$)|(?:[-*+]|\d{1,9}[.)])[ \t]|(?:=+|-+)[ \t]*(?:\n|$)|(?:\*[ \t]*){3,}(?:\n|$)|(?:_[ \t]*){3,}(?:\n|$))))*?[^\uE004`])?\1(?!`)/gm, function (match) {
              return maskSpan(match, true);
            })
            .replace(/(?<=(?:^|[^\\])(?:\\\\)*)(?:<(script|style|pre|textarea|xmp|noscript|noembed|noframes|plaintext|iframe|code|kbd|samp|tt)\b(?:[^>"'\uE004]|"(?:\\.|[^"\uE004\\\n]|\n(?![ \t]*\n))*"|'(?:\\.|[^'\uE004\\\n]|\n(?![ \t]*\n))*')*>(?:\\.|[^\uE004\\\n]|\n(?![ \t]*\n))*?(?:<\/\1>|(?=\n[ \t]*\n)|$)|<!--(?:\\.|[^\uE004\\\n]|\n(?![ \t]*\n))*?(?:-->|(?=\n[ \t]*\n)|$)|<\?(?:\\.|[^\uE004\\\n]|\n(?![ \t]*\n))*?(?:\?>|(?=\n[ \t]*\n)|$)|<![A-Za-z](?:\\.|[^\uE004\\\n]|\n(?![ \t]*\n))*?(?:>|(?=\n[ \t]*\n)|$)|<!\[CDATA\[(?:\\.|[^\uE004\\\n]|\n(?![ \t]*\n))*?(?:\]\]>|(?=\n[ \t]*\n)|$))/gi, function (match) {
              return maskSpan(match, /^<(?:code|kbd|samp|tt)\b/i.test(match));
            })
        )
          .replace(/(?<=(?:^|[^\\])(?:\\\\)*)(?:<[A-Za-z][\w-]*(?:(?:[ \t]|\n(?![ \t]*\n))+[A-Za-z:_][\w.:-]*(?:(?:[ \t]|\n(?![ \t]*\n))*=(?:[ \t]|\n(?![ \t]*\n))*(?:"(?:\\.|[^"\uE004\\\n]|\n(?![ \t]*\n))*"|'(?:\\.|[^'\uE004\\\n]|\n(?![ \t]*\n))*'|[^\s"'=<>`\uE004]+))?)*(?:[ \t]|\n(?![ \t]*\n))*\/?>|<\/[A-Za-z][\w:-]*(?:[ \t]|\n(?![ \t]*\n))*>|<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s\x00-\x1f<>\uE004]+|[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+)>)/gi, function (match, autolink) {
            const isAutolink = Boolean(autolink);
            return maskSpan(match, isAutolink, false, isAutolink || match.startsWith('</'));
          })
          .replace(/^([ \t]*(?:>[ \t]*|(?:[-*+]|\d{1,9}[.)])[ \t]+)*\[(?:\\.|[^\\\n\]])+\]:[ \t]*)((?:\n[ \t]*(?:>[ \t]*)*)?(?:<[^>\r\n]+>|\S+)(?:(?:[ \t]+|[ \t]*\n[ \t]*(?:>[ \t]*)*)(?:"(?:\\.|[^"\n]|\n(?![ \t]*\n))*"|'(?:\\.|[^'\n]|\n(?![ \t]*\n))*'|\((?:\\.|[^()\n]|\n(?![ \t]*\n))*\)))?[ \t]*(?=\n|$))/gm, function (match, prefix, destAndTitle, offset, fullStr) {
            while (preDefCursor < offset) {
              if (preDefCursor === 0) {
                listContentIndent = 0;
                outerListIndent = 0;
                listQuoteDepth = 0;
                openParaQuoteDepth = -1;
                quoteCanLazyContinue = false;
                listIndents = [];
                listSawBlank = false;
                listOpenedInPara = false;
                minLazyIndent = 0;
                outerMinLazy = 0;
              }
              const nlIdx = fullStr.indexOf('\n', preDefCursor);
              const line = fullStr.slice(preDefCursor, nlIdx);
              updateListIndent(line, false, preDefLines.length === 0 || getQuotePrefix(preDefLines[preDefLines.length - 1]).rest.trim() === '' || listContentIndent > 0);
              preDefLines.push(line);
              preDefCursor = nlIdx + 1;
            }
            const prevQ = getQuotePrefix(preDefLines[preDefLines.length - 1] || '');
            const curQ = getQuotePrefix(prefix);
            if (
              offset > 0 &&
              offset !== validDefEnd &&
              !/[-*+]|\d[.)]/.test(prefix.slice(0, prefix.indexOf('['))) &&
              curQ.depth <= prevQ.depth &&
              countIndentCols(prefix.match(/^[ \t]*/)[0]) >= outerMinLazy &&
              countIndentCols(curQ.rest.match(/^[ \t]*/)[0]) >= minLazyIndent &&
              prevQ.rest.trim() !== '' &&
              !isHeadingLineAt(preDefLines, preDefLines.length - 1)
            ) {
              return match;
            }
            validDefEnd = offset + match.length + 1;
            return prefix.replace(/\[((?:\\.|[^\\\n\]])+)\]/, function (_m, lbl) {
              definedRefLabels.add(normalizeRefLabel(lbl));
              return '[' + maskSpan(lbl, false) + ']';
            }) + maskSpan(destAndTitle, false);
          })
          .replace(/^([ \t]*(?:>[ \t]*|(?:[-*+]|\d{1,9}[.)])[ \t]+)*(?:\d{1,9}|\[(?:\\.|[^\\\n\]])+\]:[ \t]*(?:\n[ \t]*(?:>[ \t]*)*)?(?:<[^>\r\n]+>|\S+?)(?:[ \t]+|[ \t]*\n[ \t]*(?:>[ \t]*)*|(?<=[\]\p{L}\p{N}\uE001]|\uE003\))(?=（(?:\\.|[^()（）\n]|\n(?![ \t]*\n))*?\s))))((?<=\d)）|(?<!\d)[（(](?:\\.|[^()（）\n]|\n(?![ \t]*\n))*[)）](?=[ \t]*(?:\n|$)))/gmu, function (_match, prefix, token) {
            return prefix + maskSpan(token, false);
          });
      });

      const normalizedLines = [];
      const skipListUpdateLines = new Set();
      segments.forEach(function (seg) {
        if (seg.fenced) {
          if (seg.skipListUpdate) {
            skipListUpdateLines.add(normalizedLines.length);
          }
          normalizedLines.push(maskSpan(seg.line, false, true));
          return;
        }
        const codeAndHtmlMaskedBlock = maskLinkDestinations(seg.preMasked);
        let urlScanPos = 0;
        let urlEmphPos = 0;
        let urlEmphPrefix = '';
        let outerFwDepth = 0;
        const maskedBlock = codeAndHtmlMaskedBlock.replace(
          /(?:(?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9-]+\.?)+(?:\\.|(?!\][(\[]\uE002)[^\s<\\\uE000-\uE004])*/gi,
          function (match, offset, fullStr) {
            const hasLeadingParen = offset > 0 && fullStr[offset - 1] === '(';
            for (; urlScanPos < offset; urlScanPos++) {
              if (fullStr[urlScanPos] === '\n') {
                outerFwDepth = 0;
              } else if (fullStr[urlScanPos] === '（') {
                outerFwDepth++;
              } else if (fullStr[urlScanPos] === '）' && outerFwDepth > 0) {
                outerFwDepth--;
              }
            }
            let fwDepth = 0;
            let hwDepth = 0;
            let end = 0;
            while (end < match.length) {
              if (/^(?:[*~]|_(?![\p{L}\p{N}_]))/u.test(match.slice(end))) {
                const urlEmphWithNext = compactEmphWithNext(urlEmphPrefix + fullStr.slice(urlEmphPos, offset + 1));
                urlEmphPrefix = urlEmphWithNext.slice(0, -1);
                urlEmphPos = offset;
                if (closesPreUrlEmphasis(urlEmphWithNext, match[end])) {
                  break;
                }
              }
              if (match[end] === '（') {
                fwDepth++;
              } else if (match[end] === '）') {
                if (fwDepth === 0) {
                  if (outerFwDepth > 0) {
                    break;
                  }
                } else {
                  fwDepth--;
                }
              } else if (match[end] === '(') {
                hwDepth++;
              } else if (match[end] === ')') {
                if (hwDepth === 0) {
                  if (hasLeadingParen) {
                    break;
                  }
                } else {
                  hwDepth--;
                }
              }
              end++;
            }
            let url = match.slice(0, end);
            const unclosedParenIdx = url.indexOf('(', url.lastIndexOf(')') + 1);
            if (unclosedParenIdx !== -1) {
              url = url.slice(0, unclosedParenIdx);
            }
            const lastOpenParen = url.lastIndexOf('(');
            const minEnd = lastOpenParen !== -1 ? url.indexOf(')', lastOpenParen) + 1 : 0;
            let trimEnd = url.length;
            while (trimEnd > minEnd) {
              if (url[trimEnd - 1] === ';') {
                let j = trimEnd - 2;
                while (j >= minEnd && /[a-zA-Z0-9]/.test(url[j])) {
                  j--;
                }
                trimEnd = (j < trimEnd - 2 && j >= minEnd && url[j] === '&') ? j : trimEnd - 1;
              } else if (/[?!.,:*_'"~)]/.test(url[trimEnd - 1])) {
                trimEnd--;
              } else {
                break;
              }
            }
            url = url.slice(0, trimEnd);
            const tail = match.slice(url.length).replace(/^[^（]*\((?:(?![A-Za-z0-9\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af\uE001]（).)*/, function (m) {
              return m.replace(/[（）]+/g, function (parens) {
                return maskSpan(parens, false);
              });
            });
            return maskSpan(url, false) + tail;
          }
        );
        // Intentionally repair CJK emphasis spans whose closing delimiter is preceded by `）` and
        // followed by CJK/word text (e.g. `**交換器（switch）**主要` -> `**交換器 (switch)** 主要`).
        // In CommonMark, `）` before `*`/`**` followed by non-punctuation makes the closing run
        // left-flanking only, so converting `）` to `)` and inserting a space after the closing
        // delimiter is required for the emphasis to render as intended by the golden fixtures.
        let emphPos = 0;
        let emphPrefix = '';
        const normalizedBlock = maskedBlock
          .replace(/(?<!\\)(?:\\\\)*\\(?=[（）])/g, '$&\\')
          .replace(
            /(?<=(?:^|[^\\])(?:\\\\)*)(\*{1,3}(?!\*)|_{1,3}(?!_)|(?<!~)~~(?!~))(?=\S)((?:(?!\1)(?:[^\n]|\n(?![ \t]*(?:\n|$|[-*+>|#]|\d{1,9}[.)]))))+?)(?<=\S)(?!(?=\1(?:\*(?<=\*\*)|_(?<=__)))(?:(\*{2,3}(?!\*)|_{2,3}(?!_))(?=\S)(?:(?!\3).)+?(?<=\S)\3))\1((?<=）\1)(?:\*|_)?[^\s*_~（(、；，。！？：]+?(?<![\s*_~（(、；，。！？：])(?:\*+|_+)(?:[^\n*_~]+?(?<![\s*_~（(、；，。！？：])(?:\*+|_+))?(?=(?![*_])[\s~（）()、；，。！？：]|$)|(?!(?:(\*{1,3}(?!\*)|_{1,3}(?!_)|(?<!~)~~(?!~))(?=\S)(?:(?!\5).)+?(?<=\S)\5))(?:\*{1,3}(?!\*)|_{1,3}(?!_)))?/g,
            function (match, delim, inner, _longerDelim, extraClose, _nextDelim, offset, fullStr) {
              const prevChar = offset > 0 ? fullStr[offset - 1] : '';
              const closeDelim = delim + (extraClose || '');
              const rest = fullStr.slice(offset + match.length);
              if (delim[0] === '_' && (/[\p{L}\p{N}]/u.test(prevChar) || /^[\p{L}\p{N}]/u.test(rest))) {
                return match;
              }
              const innerTrailingMatch = inner.match(/）((?:\*+|_+|~~)*)$/);
              const innerPrefix = innerTrailingMatch ? inner.slice(0, innerTrailingMatch.index) : inner;
              const unmatchedInner = (innerPrefix.replace(/(\*{1,3}|_{1,3}|~~)(?=\S).+?(?<=\S)\1/g, '').match(/(?<=(?:^|[^\\])(?:\\\\)*)(?:\*+|(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])|~~)/gu) || []).join('');
              if ((!innerTrailingMatch && !rest.startsWith('（')) || unmatchedInner !== (innerTrailingMatch ? innerTrailingMatch[1] : '')) {
                return match;
              }
              if ((extraClose && /^[*_]+$/.test(extraClose)) || prevChar === delim[0]) {
                const emphWithNext = compactEmphWithNext(emphPrefix + fullStr.slice(emphPos, offset) + 'a');
                emphPrefix = emphWithNext.slice(0, -1);
                emphPos = offset;
                if (!closesPreUrlEmphasis(emphWithNext, delim[0])) {
                  return match;
                }
              }
              const updatedInner = innerTrailingMatch
                ? inner.slice(0, innerTrailingMatch.index) + ')' + innerTrailingMatch[1]
                : inner;
              const needsSpace = /^(?:[\p{L}\p{N}`*_\[\uE000（]|~~(?=\S))/u.test(rest);
              return delim + updatedInner + closeDelim + (needsSpace ? ' ' : '');
            }
          )
          .replace(/([\]\p{L}\p{N}]|\uE001|\uE003\))（/gu, '$1 (')
          .replace(/（/g, '(')
          .replace(/）(?=[\p{L}\p{N}`\[\uE000]|(\*{1,3}(?!\*)|(?<!~)~~(?!~))(?=\S)(?:(?!\1)(?:[^\n*_~]|\n(?![ \t]*(?:\n|$|[-*+>|#]|\d{1,9}[.)]))))+?(?<=\S)\1|(_{1,3}(?!_))(?=\S)(?:(?!\2)(?:[^\n*_~]|\n(?![ \t]*(?:\n|$|[-*+>|#]|\d{1,9}[.)]))))+?(?<=\S)\2(?![\p{L}\p{N}_(（]))/gu, ') ')
          .replace(/）/g, ')')
          .replace(/\uE004/g, '|');
        const blockLines = normalizedBlock.split('\n');
        for (let bIdx = 0; bIdx < blockLines.length; bIdx++) {
          normalizedLines.push(blockLines[bIdx]);
        }
      });

      const formattedLines = [];
      let lineIndex = 0;
      listContentIndent = 0;
      outerListIndent = 0;
      listQuoteDepth = 0;
      openParaQuoteDepth = -1;
      quoteCanLazyContinue = false;
      listIndents = [];
      listSawBlank = false;
      listOpenedInPara = false;
      minLazyIndent = 0;
      outerMinLazy = 0;
      let noSetextUntilIdx = -1;
      let noSetextDepth = -1;
      let listOpenedViaTableLookahead = false;
      const hasPostTableSetextUnderline = function (tableLines, startIdx, quoteDepth) {
        if (tableLines.slice(2).some(function (l) {
          const rawL = restoreSpans(l);
          return getQuotePrefix(rawL).depth <= quoteDepth && /^[ \t]*(?:=+|-+)[ \t]*$/.test(getTableRowParts(rawL).rest);
        })) {
          return true;
        }
        if (noSetextDepth === quoteDepth && startIdx <= noSetextUntilIdx) {
          return false;
        }
        let k = startIdx;
        for (; k < normalizedLines.length; k++) {
          const rawL = restoreSpans(normalizedLines[k]);
          const q = getQuotePrefix(rawL);
          if (q.depth <= quoteDepth) {
            if (q.rest.trim() === '') break;
            if (/^[ \t]*(?:=+|-+)[ \t]*$/.test(getTableRowParts(rawL).rest)) {
              return true;
            }
          }
        }
        noSetextDepth = quoteDepth;
        noSetextUntilIdx = k;
        return false;
      };
      while (lineIndex < normalizedLines.length) {
        const currentLine = normalizedLines[lineIndex];
        const isBlockLine = blockSpanLineRe.test(currentLine);
        const rawCurrentLine = isBlockLine ? restoreSpans(currentLine) : currentLine;
        const prevLine = lineIndex > 0 ? normalizedLines[lineIndex - 1] : '';
        const prevListIndent = (prevLine && restoreSpans(prevLine).trim() !== '') ? listContentIndent : 0;
        const baseAllowAnyOrdered = !prevLine || blockSpanLineRe.test(prevLine) || prevListIndent > 0 || (getQuotePrefix(rawCurrentLine).depth < listQuoteDepth && outerListIndent > 0) || getQuotePrefix(rawCurrentLine).depth > listQuoteDepth || getTableRowParts(prevLine).rest.trim() === '' || isHeadingLineAt(normalizedLines, lineIndex - 1);
        const allowAnyOrdered = baseAllowAnyOrdered || (lineIndex + 1 < normalizedLines.length && TABLE_DELIMITER_REST_RE.test(getQuotePrefix(normalizedLines[lineIndex + 1]).rest));
        const prevIndentBeforeUpdate = listContentIndent;
        if (!skipListUpdateLines.has(lineIndex)) {
          updateListIndent(rawCurrentLine, isBlockLine, allowAnyOrdered);
        }
        if (listContentIndent === 0) {
          listOpenedViaTableLookahead = false;
        } else if (prevIndentBeforeUpdate === 0) {
          listOpenedViaTableLookahead = !baseAllowAnyOrdered && !/^[ \t]*(?:[-*+]|1[.)]) /.test(getQuotePrefix(rawCurrentLine).rest);
        }
        if (isBlockLine) {
          formattedLines.push(currentLine);
          lineIndex++;
          continue;
        }
        const tableQuoteDepth = listQuoteDepth;
        const headerT = getTableRowParts(currentLine);
        const headerListIndent = listContentIndent || (headerT.hasList ? countIndentCols(headerT.prefix) : 0);
        const baseTableListIndent = Math.min((tableQuoteDepth ? (listContentIndent >= 3 ? listContentIndent : 0) : headerListIndent) || (outerListIndent >= 3 ? outerListIndent : 0), (listIndents[0] || Infinity) + 3);
        const keepLookaheadUnindented = listOpenedViaTableLookahead;
        if (!headerT.hasList) {
          listOpenedViaTableLookahead = false;
        }
        if (
          lineIndex + 1 < normalizedLines.length &&
          isTableRowCandidate(currentLine) &&
          getQuotePrefix(normalizedLines[lineIndex + 1]).depth <= tableQuoteDepth &&
          isTableDelimiterLine(normalizedLines[lineIndex + 1], getQuotePrefix(normalizedLines[lineIndex + 1]).depth < tableQuoteDepth ? Infinity : headerListIndent) &&
          splitTableCells(currentLine).length === splitTableCells(normalizedLines[lineIndex + 1], true).length &&
          splitTableCells(restoreSpans(currentLine)).length === splitTableCells(normalizedLines[lineIndex + 1], true).length
        ) {
          const openParaDepth = getOpenSetextParaDepth(normalizedLines, lineIndex - 1, tableQuoteDepth);
          const minTableRowIndent = (
            countIndentCols(headerT.prefix.slice(getQuotePrefix(currentLine).prefix.length) + headerT.rest.match(/^[ \t]*/)[0]) >= listContentIndent &&
            countIndentCols(getQuotePrefix(normalizedLines[lineIndex + 1]).rest.match(/^[ \t]*/)[0]) >= listContentIndent
          ) ? listContentIndent : minLazyIndent;
          const prevOuterMinLazy = outerMinLazy;
          const tableLines = [currentLine, normalizedLines[lineIndex + 1]];
          updateLazyListSlice(tableLines[1]);
          lineIndex += 2;
          const canContinueTableRow = function (line) {
            const q = getQuotePrefix(line);
            const effListIndent = headerListIndent || (q.depth < tableQuoteDepth ? outerListIndent : 0);
            const restIndent = countIndentCols(q.rest.match(/^[ \t]*/)[0]);
            return (
              !getTableRowParts(line, false, restIndent < effListIndent).hasList &&
              !(effListIndent > 0 && restIndent < effListIndent && /^[ \t]{0,3}(?:`{3,}|~{3,}|#)/.test(q.rest)) &&
              q.depth <= tableQuoteDepth &&
              isTableRowCandidate(line, false)
            );
          };
          // Intentionally allow `depth <= tableQuoteDepth` for blockquoted tables because the bundled
          // Marked parser includes lazy blockquote continuation rows (without repeating `>`) in the
          // same table, while requiring `>= Math.max(minTableRowIndent, minLazyIndent)` so dedented lines exit indented list tables.
          while (
            lineIndex < normalizedLines.length &&
            canContinueTableRow(normalizedLines[lineIndex]) &&
            countIndentCols(normalizedLines[lineIndex].match(/^[ \t]*/)[0]) >= outerMinLazy &&
            countIndentCols(getTableRowParts(normalizedLines[lineIndex], false, false).prefix.slice(getQuotePrefix(normalizedLines[lineIndex]).prefix.length) + getTableRowParts(normalizedLines[lineIndex], false, false).rest.match(/^[ \t]*/)[0]) >= Math.max(minTableRowIndent, minLazyIndent)
          ) {
            tableLines.push(normalizedLines[lineIndex]);
            updateLazyListSlice(normalizedLines[lineIndex]);
            lineIndex++;
          }
          const rows = tableLines.map(function (l, idx) {
            return splitTableCells(l, idx === 1, idx < 2);
          });
          const colCount = rows[0].length;
          // Intentionally align columns by Unicode grapheme cluster count (countCellChars(cell), matching
          // the project's golden table fixtures, where 1 CJK, emoji, or ASCII character = 1 unit of width).
          const colWidths = new Array(colCount).fill(3);
          rows.forEach(function (row, rIdx) {
            if (rIdx === 1) return;
            for (let cIdx = 0; cIdx < colCount; cIdx++) {
              const cellLen = countCellChars(row[cIdx] || '');
              if (cellLen > colWidths[cIdx]) {
                colWidths[cIdx] = cellLen;
              }
            }
          });
          if (
            (((minTableRowIndent === 0 && minLazyIndent > 0) || (prevOuterMinLazy === 0 && outerMinLazy > 0)) && lineIndex < normalizedLines.length && normalizedLines[lineIndex].trim() !== '') ||
            (openParaDepth >= 0 && hasPostTableSetextUnderline(tableLines, lineIndex, openParaDepth)) ||
            rows.length * colWidths.reduce(function (sum, w) { return sum + w; }, 0) > 1000000
          ) {
            for (let tIdx = 0; tIdx < tableLines.length; tIdx++) {
              formattedLines.push(tableLines[tIdx]);
            }
            continue;
          }
          rows.forEach(function (row, rIdx) {
            const t = getTableRowParts(tableLines[rIdx], rIdx === 1, rIdx < 2);
            const rawPrefix = t.prefix + t.rest.match(/^[ \t]*/)[0];
            const tableListIndent = (keepLookaheadUnindented && (rIdx === 0 || (rows.length === 2 && (lineIndex >= normalizedLines.length || normalizedLines[lineIndex].trim() === '')))) ? 0 : baseTableListIndent;
            const rowPrefix = t.depth > 0 && outerListIndent >= 3 && !t.hasList
              ? ' '.repeat(Math.max(0, outerListIndent - countIndentCols(rawPrefix.match(/^[ \t]*/)[0]))) + rawPrefix
              : rawPrefix + ' '.repeat(Math.max(0, tableListIndent - countIndentCols(t.depth > 0 && listContentIndent >= 3 ? rawPrefix.slice(getQuotePrefix(tableLines[rIdx]).prefix.length) : rawPrefix)));
            if (rIdx === 1) {
              formattedLines.push(rowPrefix + '| ' + colWidths.map(function (width, cIdx) {
                const rawSep = row[cIdx] || '';
                const leftColon = rawSep.startsWith(':');
                const rightColon = rawSep.endsWith(':') && rawSep.length > 1;
                if (leftColon && rightColon) {
                  return ':' + '-'.repeat(Math.max(1, width - 2)) + ':';
                }
                if (leftColon) {
                  return ':' + '-'.repeat(Math.max(1, width - 1));
                }
                if (rightColon) {
                  return '-'.repeat(Math.max(1, width - 1)) + ':';
                }
                return '-'.repeat(width);
              }).join(' | ') + ' |');
            } else {
              formattedLines.push(rowPrefix + '| ' + colWidths.map(function (width, cIdx) {
                const cell = row[cIdx] || '';
                return cell + ' '.repeat(width - countCellChars(cell));
              }).concat(row.slice(colCount)).join(' | ') + ' |');
            }
          });
        } else {
          formattedLines.push(currentLine);
          lineIndex++;
        }
      }

      const result = restoreSpans(formattedLines.join('\n')).replaceAll(literalE004, '\uE004');
      if (result === normalizedInput) {
        return null;
      }

      console.log('Matched: Markdown syntax auto-correction');
      return result;
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
      if (ruleName === 'markdownSyntax' || ruleName === 'genericPlainText') {
        continue;
      }
      var result = plainTextRules[ruleName](text);
      if (result !== null) {
        var corrected = plainTextRules.markdownSyntax(result);
        return corrected !== null ? corrected : result;
      }
    }
    var genericResult = plainTextRules.genericPlainText(text);
    var markdownResult = plainTextRules.markdownSyntax(genericResult);
    if (markdownResult !== null) {
      return markdownResult;
    }
    return genericResult;
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
    var copyButton = document.querySelector('#copy-button');
    var tabsContainer = document.querySelector('.tabs');
    var themeButtons = document.querySelectorAll('.theme-button');
    var shareButtonBusy = false;
    var copyButtonBusy = false;
    var sharedHashSeed = '';
    var hasEditedFromSharedHash = false;
    var SHARE_HASH_PREFIX = 'z:';
    var RAW_HASH_PREFIX = 'r:';
    var themeStorageKey = 'pasteToMarkdownTheme';
    var printOutput = document.querySelector('#print-output');

    // A textarea cannot grow or split across pages when printed, so print a <pre> copy instead.
    window.addEventListener('beforeprint', function () {
      if (printOutput) {
        printOutput.textContent = output.value;
      }
    });

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

    function matchesCopyShortcut(event) {
      return event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        (event.key === 'c' || event.key === 'C' || event.code === 'KeyC');
    }

    function getClipboardHtml(markdown) {
      if (!markdown || !markdown.trim()) {
        return '';
      }
      try {
        marked.setOptions({
          breaks: true,
          gfm: true,
          headerIds: false,
          mangle: false,
          sanitize: false
        });
        var rawHtml = marked.parse(markdown);
        return sanitizeHtml(rawHtml);
      } catch (error) {
        console.warn('Failed to render markdown to HTML for clipboard.', error);
        return toEscapedHtml(markdown);
      }
    }

    async function executeCopyAction() {
      if (!copyButton || copyButtonBusy) {
        return;
      }

      copyButtonBusy = true;
      copyButton.disabled = true;

      try {
        var markdown = output ? output.value || '' : '';
        var htmlForClipboard = getClipboardHtml(markdown);
        var htmlBlob = new Blob([htmlForClipboard], { type: 'text/html' });
        var markdownBlob = new Blob([markdown], { type: 'text/markdown' });
        var plainBlob = new Blob([markdown], { type: 'text/plain' });

        if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
          try {
            var clipboardData = {
              'text/html': htmlBlob,
              'text/markdown': markdownBlob,
              'text/plain': plainBlob
            };
            var item = new ClipboardItem(clipboardData);
            await navigator.clipboard.write([item]);
          } catch (clipboardItemError) {
            // Some browsers reject unknown MIME types like text/markdown.
            // Retry with fallback that still satisfies html + markdown intent via plain text.
            console.warn('ClipboardItem with text/markdown failed, retrying with fallback.', clipboardItemError);
            try {
              var fallbackItem = new ClipboardItem({
                'text/html': htmlBlob,
                'text/plain': plainBlob
              });
              await navigator.clipboard.write([fallbackItem]);
              // Also attempt to write markdown via writeText if needed, but primary write already done.
            } catch (fallbackError) {
              throw clipboardItemError;
            }
          }
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(markdown);
        } else {
          throw new Error('Clipboard API is not available');
        }

        copyButton.textContent = window.i18n ? i18n.t('copySuccess') : '📋 Copied';
      } catch (error) {
        console.error('Unable to copy markdown.', error);
        refreshCopyButtonLabel();
      } finally {
        setTimeout(function () {
          refreshCopyButtonLabel();
          if (copyButton) {
            copyButton.disabled = false;
          }
          copyButtonBusy = false;
        }, 1200);
      }
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
    refreshCopyButtonLabel();
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
      refreshCopyButtonLabel();
      syncHashModeState();
      updateTabShortcutHints();
    });

    if (shareButton) {
      shareButton.addEventListener('click', function () {
        executeShareAction();
      });
    }

    if (copyButton) {
      copyButton.addEventListener('click', function () {
        executeCopyAction();
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
    // Elements that can run script, embed other documents, or change how the
    // page loads. Raw-text elements (noscript, noembed, noframes, xmp,
    // plaintext, style, script, iframe) serialize their content unescaped, so
    // text inside them can turn into live markup when parsed again (mutation XSS).
    const BLOCKED_ELEMENTS = [
      'script', 'noscript', 'noembed', 'noframes', 'xmp', 'plaintext', 'style',
      'template', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
      'base', 'link', 'meta', 'animate', 'animatemotion', 'animatetransform',
      'set', 'foreignobject'
    ];

    // Upper bound for the sanitize-until-stable loop in sanitizeHtml.
    const MAX_SANITIZE_PASSES = 10;

    // Attributes whose value is loaded or navigated to as a URL.
    const URL_ATTRIBUTES = [
      'href', 'src', 'xlink:href', 'action', 'formaction', 'poster',
      'background', 'data', 'ping', 'lowsrc', 'dynsrc'
    ];

    function isSafeSrcset(srcset) {
      return srcset.split(',').every(function (candidate) {
        const url = candidate.trim().split(/\s+/)[0];
        return !url || isSafeUrl(url);
      });
    }

    function removeUnsafeMarkup(doc) {
      Array.from(doc.body.querySelectorAll('*')).forEach(function (element) {
        if (BLOCKED_ELEMENTS.indexOf(element.localName.toLowerCase()) !== -1) {
          element.remove();
          return;
        }

        Array.from(element.attributes).forEach(function (attribute) {
          const name = attribute.name.toLowerCase();
          const isEventHandler = name.indexOf('on') === 0;
          const isUnsafeUrl = URL_ATTRIBUTES.indexOf(name) !== -1 && !isSafeUrl(attribute.value);
          const isUnsafeSrcset = name === 'srcset' && !isSafeSrcset(attribute.value);
          if (isEventHandler || isUnsafeUrl || isUnsafeSrcset) {
            element.removeAttribute(attribute.name);
          }
        });
      });
    }

    function sanitizeHtml(html) {
      // Sanitize again until the output is stable, so markup that changes
      // meaning when parsed again is also cleaned in the form the preview
      // finally parses. If it never stabilizes, fail closed and show text only.
      let sanitized = sanitizeHtmlOnce(html);
      for (let pass = 1; pass < MAX_SANITIZE_PASSES; pass++) {
        const resanitized = sanitizeHtmlOnce(sanitized);
        if (resanitized === sanitized) {
          return sanitized;
        }
        sanitized = resanitized;
      }
      return escapeHtml(new DOMParser().parseFromString(sanitized, 'text/html').body.textContent || '');
    }

    function sanitizeHtmlOnce(html) {
      // Use DOMParser for safer HTML parsing (doesn't execute scripts)
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');

      removeUnsafeMarkup(doc);

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

    function refreshCopyButtonLabel() {
      if (!copyButton) {
        return;
      }

      copyButton.textContent = window.i18n ? i18n.t('copyButton') : '📋 Copy';
      copyButton.title = window.i18n ? i18n.t('copyButtonTitle') : 'Copy as Markdown and HTML';
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

      if (matchesCopyShortcut(event)) {
        event.preventDefault();
        executeCopyAction();
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
        let vscodeMode = '';
        try {
          const vscodeMeta = JSON.parse(event.clipboardData.getData('vscode-editor-data'));
          vscodeMode = (vscodeMeta && typeof vscodeMeta.mode === 'string') ? vscodeMeta.mode.toLowerCase() : '';
        } catch (err) {
          vscodeMode = '';
        }
        if (vscodeMode === 'markdown') {
          const markdownCorrected = plainTextRules.markdownSyntax(text);
          if (markdownCorrected !== null) {
            text = markdownCorrected;
          }
        }

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
        var wordMathRegistry = [];
        var wordDoc = new DOMParser().parseFromString(normalizeWordHtmlLists(html), 'text/html');
        preprocessMathInDom(wordDoc, wordMathRegistry);
        var preprocessedWordHtml = wordDoc.querySelector('body').innerHTML;

        var markdown = plainTextList !== null ? plainTextList : turndownService.turndown(preprocessedWordHtml).trim();
        if (plainTextList === null) {
          markdown = restoreMathPlaceholders(markdown, wordMathRegistry);
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

      // Preprocess math elements in DOM (KaTeX, MathJax, MathML, etc.)
      var mathRegistry = [];
      preprocessMathInDom(doc, mathRegistry);

      var body = doc.querySelector('body').innerHTML;

      var markdown = convert(body, mathRegistry);

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
