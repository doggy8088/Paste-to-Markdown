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

    if (langSelect) {
      langSelect.value = currentLang;
      langSelect.addEventListener('change', function() {
        i18n.setLanguage(this.value);
      });
    }
    i18n.updatePage();
  };

  document.addEventListener('DOMContentLoaded', function() {
    if (window.i18n) i18n.init();
  });
})();
