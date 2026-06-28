/* BERZAN — Dil seçici (Google Çeviri motoru, 19 dil) */
(function () {
  "use strict";

  // [kod, görünen ad] — Google Çeviri dil kodları
  var LANGS = [
    ["tr", "Türkçe"], ["en", "English"], ["fr", "Français"], ["fi", "Suomi"],
    ["zh-TW", "繁體中文"], ["ru", "Русский"], ["pt", "Português"], ["ar", "العربية"],
    ["fa", "فارسی"], ["ku", "Kurdî"], ["es", "Español"], ["uk", "Українська"],
    ["az", "Azərbaycan"], ["cs", "Čeština"], ["sr", "Српски"], ["de", "Deutsch"],
    ["nl", "Nederlands"], ["it", "Italiano"]
  ];
  var INCLUDED = LANGS.map(function (l) { return l[0]; }).join(",");

  // Gizli Google Çeviri kabı
  var gEl = document.createElement("div");
  gEl.id = "google_translate_element";
  gEl.style.display = "none";
  gEl.className = "notranslate";
  document.body.appendChild(gEl);

  window.googleTranslateElementInit = function () {
    new google.translate.TranslateElement(
      { pageLanguage: "tr", includedLanguages: INCLUDED, autoDisplay: false },
      "google_translate_element"
    );
  };

  var s = document.createElement("script");
  s.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  document.body.appendChild(s);

  // googtrans çerezinden mevcut dil
  function currentLang() {
    var m = document.cookie.match(/googtrans=\/[^/]*\/([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "tr";
  }

  // dili değiştir: çerezi ayarla + sayfayı yenile (alt sayfalarda da kalıcı)
  function setLang(code) {
    var host = location.hostname, base = host.replace(/^www\./, "");
    if (code === "tr") {
      ["", ";domain=" + host, ";domain=." + base].forEach(function (d) {
        document.cookie = "googtrans=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/" + d;
      });
    } else {
      var v = "/tr/" + code;
      document.cookie = "googtrans=" + v + ";path=/";
      document.cookie = "googtrans=" + v + ";path=/;domain=" + host;
      document.cookie = "googtrans=" + v + ";path=/;domain=." + base;
    }
    location.reload();
  }

  function buildSelect(cls) {
    var sel = document.createElement("select");
    sel.className = "langSelect notranslate " + cls;
    sel.setAttribute("translate", "no");
    sel.setAttribute("aria-label", "Dil seçimi");
    sel.innerHTML = LANGS.map(function (l) {
      return '<option value="' + l[0] + '">' + l[1] + "</option>";
    }).join("");
    return sel;
  }

  function iconWrap(extra) {
    var w = document.createElement("div");
    w.className = "notranslate " + extra;
    w.innerHTML = '<span class="material-symbols-outlined text-xl">language</span>';
    return w;
  }

  // Masaüstü: navbar'a enjekte et
  var nav = document.getElementById("main-nav");
  if (nav) {
    var toggle = document.getElementById("navToggle");
    var w = iconWrap("hidden md:flex items-center gap-1 text-on-primary mr-1");
    w.appendChild(buildSelect("bg-primary-container text-on-primary text-sm rounded-md pl-1 pr-2 py-1.5 border border-white/15 cursor-pointer focus:outline-none"));
    if (toggle && toggle.parentNode) toggle.parentNode.insertBefore(w, toggle);
    else nav.appendChild(w);
  }

  // Mobil menü
  var mm = document.getElementById("mobileMenu");
  if (mm) {
    var navc = mm.querySelector("nav") || mm;
    var mw = iconWrap("flex items-center gap-2 mt-3 pt-3 border-t border-white/10 text-on-primary");
    mw.appendChild(buildSelect("flex-1 bg-primary-container text-on-primary rounded-md px-3 py-2.5 border border-white/15"));
    navc.appendChild(mw);
  }

  // Tüm seçicileri bağla
  var cur = currentLang();
  document.querySelectorAll(".langSelect").forEach(function (sel) {
    sel.value = cur;
    sel.addEventListener("change", function () { setLang(this.value); });
  });
})();
