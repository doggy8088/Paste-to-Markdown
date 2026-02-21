'use strict';

(function() {
  const i18n = window.i18n || {};
  window.i18n = i18n;

  i18n.currentLang = function() {
    var saved = localStorage.getItem('preferred-lang');
    if (saved && window.i18nLocales && window.i18nLocales[saved]) return saved;

    var browserLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    var shortLang = browserLang.split('-')[0];

    if (window.i18nLocales && window.i18nLocales[browserLang]) {
      return browserLang;
    }

    if (window.i18nLocales && window.i18nLocales[shortLang]) {
      return shortLang;
    }

    return 'en';
  };

  i18n.setLanguage = function(lang) {
    if (!window.i18nLocales || !window.i18nLocales[lang]) lang = 'en';
    localStorage.setItem('preferred-lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = (lang === 'ar' ? 'rtl' : 'ltr');
    i18n.updatePage();
    document.dispatchEvent(new CustomEvent('languageChange', { detail: { lang: lang } }));
  };

  i18n.t = function(key) {
    var lang = i18n.currentLang();
    var locales = window.i18nLocales || {};
    return (locales[lang] && locales[lang][key]) || (locales.en && locales.en[key]) || key;
  };

  i18n.updatePage = function() {
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      el.innerHTML = i18n.t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
      el.setAttribute('placeholder', i18n.t(el.getAttribute('data-i18n-placeholder')));
    });
  };

  i18n.init = function() {
    var langSelect = document.getElementById('lang-select');
    var currentLang = i18n.currentLang();

    document.documentElement.lang = currentLang;
    document.documentElement.dir = (currentLang === 'ar' ? 'rtl' : 'ltr');

    if (langSelect) {
      // Dynamically generate and sort language options
      i18n.populateLanguageSelector(langSelect, currentLang);
      langSelect.addEventListener('change', function() {
        i18n.setLanguage(this.value);
      });
    }
    i18n.updatePage();
  };

  i18n.populateLanguageSelector = function(selectElement, currentLang) {
    selectElement.innerHTML = '';
    var locales = window.i18nLocales || {};
    var langCodes = Object.keys(locales);

    // Sort by localeName (case-insensitive)
    langCodes.sort(function(a, b) {
      var nameA = (locales[a] && locales[a].localeName) || '';
      var nameB = (locales[b] && locales[b].localeName) || '';
      return nameA.localeCompare(nameB, 'en', { sensitivity: 'base' });
    });

    langCodes.forEach(function(code) {
      var option = document.createElement('option');
      option.value = code;
      option.textContent = locales[code].localeName || code;
      if (code === currentLang) {
        option.selected = true;
      }
      selectElement.appendChild(option);
    });
  };

  document.addEventListener('DOMContentLoaded', function() {
    if (window.i18n) i18n.init();
  });
})();
