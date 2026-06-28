/* BERZAN — ortak davranışlar (tüm sayfalarda) */
(function () {
  "use strict";

  // ---- Ayarlar ----
  const SB_URL = "https://ibenluhsxkyaijaqqioc.supabase.co";
  const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliZW5sdWhzeGt5YWlqYXFxaW9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1Njk4NjksImV4cCI6MjA5ODE0NTg2OX0.KTCaADKE-M0-vBX06htW9XEaYbazcWWLa-xcVVxlRts";
  const WEB3FORMS_KEY = "";   // web3forms.com ücretsiz anahtarı (e-posta bildirimi için)
  const WHATSAPP_NUMBER = "905421005649"; // +90 542 100 56 49

  const $ = (s) => document.querySelector(s);

  // ---- WhatsApp linkleri ----
  const waLinks = document.querySelectorAll('.wa-link');
  if (waLinks.length) {
    if (WHATSAPP_NUMBER) {
      const url = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent("Merhaba, BERZAN'dan teklif almak istiyorum.");
      waLinks.forEach(a => a.setAttribute('href', url));
    } else {
      waLinks.forEach(a => { a.setAttribute('href', '/iletisim/'); a.removeAttribute('target'); });
    }
  }

  // ---- Mobil menü ----
  const navToggle = $('#navToggle');
  const mobileMenu = $('#mobileMenu');
  if (navToggle && mobileMenu) {
    navToggle.addEventListener('click', () => mobileMenu.classList.toggle('hide'));
    mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobileMenu.classList.add('hide')));
  }

  // ---- Header scroll efekti ----
  const header = $('#main-nav');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) header.classList.add('h-16', 'bg-primary/95', 'backdrop-blur-md');
      else header.classList.remove('h-16', 'bg-primary/95', 'backdrop-blur-md');
    });
  }

  // ---- Toast ----
  function toast(msg, hata) {
    let t = $('#toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = "fixed bottom-28 right-8 z-[110] px-5 py-3.5 rounded-xl shadow-lg text-sm text-white max-w-xs " + (hata ? "bg-error" : "bg-primary");
    t.classList.remove('hide');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.add('hide'), 4500);
  }

  // ---- Talep türü: ?tip=Müşteri|Tedarikçi varsa ön-seç ----
  const tipSel = $('#tipSelect');
  if (tipSel) {
    const params = new URLSearchParams(location.search);
    const tip = params.get('tip');
    if (tip && [...tipSel.options].some(o => o.value === tip)) tipSel.value = tip;
  }

  // ---- İletişim formu: (1) Supabase'e kaydet (2) e-posta (anahtar varsa) ----
  const form = $('#contactForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const payload = {
        tip: f.tip.value,
        ad_soyad: f.ad_soyad.value.trim(),
        firma: f.firma.value.trim() || null,
        eposta: f.eposta.value.trim(),
        telefon: f.telefon.value.trim() || null,
        mesaj: f.mesaj.value.trim() || null
      };
      const btn = $('#submitBtn'); const txt = $('#submitText');
      if (btn) btn.disabled = true; if (txt) txt.textContent = "Gönderiliyor…";

      let ok = false;
      try {
        const r = await fetch(SB_URL + "/rest/v1/basvurular", {
          method: 'POST',
          headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify(payload)
        });
        ok = r.ok;
      } catch (err) { ok = false; }

      if (WEB3FORMS_KEY) {
        try {
          await fetch('https://api.web3forms.com/submit', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ access_key: WEB3FORMS_KEY, subject: "BERZAN Web Başvuru: " + payload.tip, from_name: "BERZAN Web Sitesi", ...payload })
          });
        } catch (err) {}
      }

      if (btn) btn.disabled = false; if (txt) txt.textContent = "Talebi Gönder";
      if (ok) { f.reset(); if (tipSel) { const t = new URLSearchParams(location.search).get('tip'); if (t) tipSel.value = t; } toast("Talebiniz alındı. En kısa sürede dönüş yapacağız. ✓"); }
      else { toast("Gönderilemedi. Lütfen tekrar deneyin veya info@berzan.com.tr yazın.", true); }
    });
  }

  // ---- Bölüm görünürlük animasyonu ----
  const sections = document.querySelectorAll('main section');
  if (sections.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100', 'translate-y-0');
          entry.target.classList.remove('opacity-0', 'translate-y-10');
        }
      });
    }, { threshold: 0.08 });
    sections.forEach(s => { s.classList.add('transition-all', 'duration-700', 'opacity-0', 'translate-y-10'); observer.observe(s); });
  }
})();
