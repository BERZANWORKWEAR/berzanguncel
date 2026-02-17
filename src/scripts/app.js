
function removeProductExampleNavLink(){
  try{
    document.querySelectorAll('.nav-links a').forEach(a=>{
      const t=(a.textContent||'').trim().toLowerCase();
      const h=(a.getAttribute('href')||'').toLowerCase();
      if (t.includes('ürün örneği') || h.endsWith('/urun.html') || h.includes('urun.html')){
        a.remove();
      }
    });
  }catch(e){}
}


// Runtime config (config.js)
const BERZAN_CFG = Object.assign({
  notifyWebhook: '',
  notifyTo: '9054210055649'
}, window.BERZAN_CFG || {});

function berzanNotifyLead(kind, data){
  const url = (BERZAN_CFG.notifyWebhook || '').trim();
  if (!url) return; // webhook yoksa sessiz geç
  try {
    const payload = JSON.stringify({
      kind,
      to: BERZAN_CFG.notifyTo,
      page: location.href,
      ts: new Date().toISOString(),
      ...data
    });

    // sayfa yönlenirken bile çalışsın
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(()=>{});
    }
  } catch(e){}
}

/* =========================
   BERZAN CATALOG (tek kaynak)
========================= */
const BERZAN_SECTOR_MAP = {
  insaat: 'İnşaat',
  lojistik: 'Lojistik',
  isletme: 'İşletme',
  marine: 'Marine',
  fabrika: 'Fabrika',
  diger: 'Diğer'
};

const BERZAN_CATEGORIES = {
  mont: 'Mont & Dış giyim',
  ust: 'Üst giyim',
  pantolon: 'Alt giyim',
  yelek: 'Yelek & Görünürlük',
  tulum: 'Tulum',
  kkd: 'KKD / Ekipman',
  ayakkabi: 'İş Ayakkabısı',
  aksesuar: 'Aksesuar'
};

// retail: bireysel mağaza fiyatı (şimdilik "liste" fiyatı)
// quote: kurumsal teklif için "ortalama" tahmin (genelde retail'den biraz aşağı)
const BERZAN_CATALOG = [
  {
    id: 'mont',
    name: 'High Visibility Mont',
    cat: 'mont',
    sectors: ['insaat','lojistik','fabrika','marine'],
    seasons: ['kislik','sezonluk'],
    retail: 1990,
    quote: 1890,
    badges: ['EN/CE','Reflektör'],
    desc: 'Saha koşulları için net görünürlük + sağlam kumaş.'
  },
  {
    id: 'heavy-duty-mont',
    name: 'Heavy Duty Mont',
    cat: 'mont',
    sectors: ['insaat','fabrika','marine'],
    seasons: ['kislik','sezonluk'],
    retail: 2190,
    quote: 2050,
    badges: ['Dayanım','Saha'],
    desc: 'Yoğun kullanım için güçlendirilmiş yapı.'
  },
  {
    id: 'parka-pro',
    name: 'Parka Pro',
    cat: 'mont',
    sectors: ['insaat','lojistik','marine','fabrika'],
    seasons: ['kislik'],
    retail: 2790,
    quote: 2590,
    badges: ['Isı','Su itici'],
    desc: 'Soğuk + rüzgar için premium koruma.'
  },
  {
    id: 'softshell-flex',
    name: 'Softshell Flex',
    cat: 'mont',
    sectors: ['lojistik','isletme','insaat'],
    seasons: ['sezonluk','kislik'],
    retail: 1890,
    quote: 1750,
    badges: ['Esnek','Konfor'],
    desc: 'Hareket alanı geniş, günlük vardiya dostu.'
  },
  {
    id: 'yagmurluk-set',
    name: 'Su Geçirmez Yağmurluk Set',
    cat: 'mont',
    sectors: ['marine','insaat','lojistik'],
    seasons: ['yazlik','sezonluk'],
    retail: 1690,
    quote: 1550,
    badges: ['Su geçirmez','Rüzgar'],
    desc: 'Islak ortamda “tam kapat” çözümü.'
  },

  { id:'polo-tisort', name:'Kurumsal Polo Tişört', cat:'ust', sectors:['isletme','lojistik','fabrika'], seasons:['yazlik','sezonluk'], retail:690, quote:620, badges:['Kurumsal','Nefes alır'], desc:'Logolu kurumsal görünüm, günlük kullanım.' },
  { id:'pamuk-tisort', name:'Pamuk Tişört', cat:'ust', sectors:['isletme','lojistik','insaat','fabrika'], seasons:['yazlik','sezonluk'], retail:490, quote:440, badges:['Konfor'], desc:'Sade, temiz, dayanıklı.' },
  { id:'sweatshirt', name:'İş Sweatshirt', cat:'ust', sectors:['lojistik','insaat','fabrika'], seasons:['kislik','sezonluk'], retail:990, quote:910, badges:['Sıcak'], desc:'Soğuk vardiyada katman olarak iyi.' },
  { id:'polar', name:'Polar Katman', cat:'ust', sectors:['marine','lojistik','insaat'], seasons:['kislik'], retail:1090, quote:990, badges:['Isı'], desc:'Hafif, sıcak, sahada rahat.' },

  { id:'is-pantolonu', name:'İş Pantolonu', cat:'pantolon', sectors:['insaat','lojistik','isletme','fabrika'], seasons:['yazlik','sezonluk'], retail:1190, quote:1090, badges:['Ergonomi','Dayanım'], desc:'Gün boyu rahat kesim + güçlendirilmiş bölgeler.' },
  { id:'stretch-pantolon', name:'Stretch İş Pantolonu', cat:'pantolon', sectors:['lojistik','isletme','fabrika'], seasons:['sezonluk'], retail:1390, quote:1270, badges:['Esnek'], desc:'Hareketin bol olduğu işlerde fark ettirir.' },
  { id:'is-sortu', name:'İş Şortu', cat:'pantolon', sectors:['lojistik','insaat'], seasons:['yazlik'], retail:890, quote:820, badges:['Hafif'], desc:'Sıcak günlerde performans.' },

  { id:'reflektor-yelek', name:'Yüksek Görünürlüklü Yelek', cat:'yelek', sectors:['lojistik','insaat','fabrika'], seasons:['yazlik','sezonluk'], retail:590, quote:520, badges:['Reflektör','EN/CE'], desc:'Görünürlük odaklı, hızlı giy-çık.' },
  { id:'fileli-yelek', name:'Fileli Yelek', cat:'yelek', sectors:['lojistik','insaat'], seasons:['yazlik','sezonluk'], retail:490, quote:450, badges:['Nefes alır'], desc:'Sıcak vardiyada terletmeyen yapı.' },

  { id:'is-tulumu', name:'İş Tulumu', cat:'tulum', sectors:['fabrika','insaat'], seasons:['kislik','sezonluk'], retail:2490, quote:2290, badges:['Kurumsal'], desc:'Tek parça: hızlı, pratik, standart.' },
  { id:'yazlik-tulum', name:'Yazlık Tulum', cat:'tulum', sectors:['fabrika','insaat'], seasons:['yazlik','sezonluk'], retail:2190, quote:2050, badges:['Hafif'], desc:'Sıcak ortamda rahat tulum.' },
  { id:'reflektorlu-tulum', name:'Reflektörlü Tulum', cat:'tulum', sectors:['lojistik','insaat','fabrika'], seasons:['sezonluk','kislik'], retail:2890, quote:2690, badges:['Reflektör'], desc:'Görünürlük + tek parça çözüm.' },

  { id:'baret', name:'Baret (EN 397)', cat:'kkd', sectors:['insaat','fabrika','marine'], seasons:['yazlik','kislik','sezonluk'], retail:390, quote:340, badges:['Standart'], desc:'Darbe koruması için temel ekipman.' },
  { id:'gozluk', name:'Koruyucu Gözlük', cat:'kkd', sectors:['insaat','fabrika','marine'], seasons:['yazlik','kislik','sezonluk'], retail:290, quote:260, badges:['Anti-sis'], desc:'Toz ve parçacığa karşı koruma.' },
  { id:'eldiven-kesilme', name:'Kesilme Dirençli Eldiven', cat:'kkd', sectors:['fabrika','lojistik'], seasons:['yazlik','kislik','sezonluk'], retail:220, quote:190, badges:['Seviye A'], desc:'Keskin kenarlara karşı ekstra güven.' },
  { id:'eldiven-nitril', name:'Nitril Kaplamalı Eldiven', cat:'kkd', sectors:['lojistik','insaat','fabrika'], seasons:['yazlik','kislik','sezonluk'], retail:160, quote:140, badges:['Tutuş'], desc:'Tutuş + dayanım dengesi.' },
  { id:'ffp2', name:'FFP2 Toz Maskesi', cat:'kkd', sectors:['insaat','fabrika'], seasons:['yazlik','kislik','sezonluk'], retail:150, quote:120, badges:['FFP2'], desc:'Tozlu ortamlar için filtre.' },
  { id:'kulaklik', name:'Kulak Koruyucu', cat:'kkd', sectors:['fabrika'], seasons:['yazlik','kislik','sezonluk'], retail:320, quote:290, badges:['SNR'], desc:'Gürültülü üretimde konforlu kullanım.' },
  { id:'emniyet-kemeri', name:'Emniyet Kemeri', cat:'kkd', sectors:['insaat'], seasons:['yazlik','kislik','sezonluk'], retail:1490, quote:1390, badges:['Yüksekte çalışma'], desc:'Yüksekte çalışma için temel sistem.' },
  { id:'lanyard', name:'Şok Emicili Lanyard', cat:'kkd', sectors:['insaat'], seasons:['yazlik','kislik','sezonluk'], retail:690, quote:640, badges:['Şok emici'], desc:'Emniyet kemeri tamamlayıcısı.' },

  { id:'ayakkabi-s3', name:'İş Ayakkabısı S3', cat:'ayakkabi', sectors:['insaat','lojistik','fabrika'], seasons:['yazlik','kislik','sezonluk'], retail:2290, quote:2090, badges:['S3','Çelik burun'], desc:'Sahada güven + konfor.' },
  { id:'bot-s3', name:'İş Botu S3', cat:'ayakkabi', sectors:['insaat','marine'], seasons:['kislik','sezonluk'], retail:2590, quote:2390, badges:['S3','Su itici'], desc:'Soğuk/ıslak şartlara uygun.' },
  { id:'cizme', name:'Su Geçirmez Çizme', cat:'ayakkabi', sectors:['marine','insaat'], seasons:['yazlik','sezonluk'], retail:1790, quote:1650, badges:['Su geçirmez'], desc:'Islak zemin için.' },

  { id:'reflektor-bant', name:'Reflektör Bant', cat:'aksesuar', sectors:['insaat','lojistik','fabrika','marine','isletme'], seasons:['yazlik','kislik','sezonluk'], retail:190, quote:170, badges:['Görünürlük'], desc:'Kıyafete/ekipmana hızlı görünürlük ekler.' },
  { id:'dizlik', name:'Dizlik', cat:'aksesuar', sectors:['insaat'], seasons:['yazlik','kislik','sezonluk'], retail:390, quote:350, badges:['Konfor'], desc:'Diz üstü çalışma için rahatlık.' },
  { id:'kafafeneri', name:'Kafa Feneri', cat:'aksesuar', sectors:['insaat','marine','lojistik'], seasons:['yazlik','kislik','sezonluk'], retail:450, quote:410, badges:['LED'], desc:'Gece vardiyası için net görüş.' },
  { id:'bere', name:'İş Beresi', cat:'aksesuar', sectors:['insaat','lojistik','marine','fabrika'], seasons:['kislik'], retail:190, quote:170, badges:['Sıcak'], desc:'Soğukta basit ama etkili.' },
];

// Görsel eşlemesi: boş. (Görsel yoksa asla başka ürün görseli gösterme.)
const BERZAN_IMG_MAP = {};

function berzanImgFor(product){
  return (product && BERZAN_IMG_MAP[product.id]) ? BERZAN_IMG_MAP[product.id] : '';
}


function berzanFormatTRY(n){
  try{
    return '₺ ' + new Intl.NumberFormat('tr-TR').format(Math.round(n));
  }catch(e){
    return '₺ ' + (Math.round(n)).toString();
  }
}
function berzanFindProduct(id){
  return BERZAN_CATALOG.find(p => p.id === id) || null;
}

document.addEventListener('DOMContentLoaded', () => {
  // JS aktif bayrağı (CSS ile uyumlu)
  document.documentElement.classList.add('js');

  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =========================
     1) REVEAL ON SCROLL
  ========================= */

  const els = Array.from(document.querySelectorAll('.reveal'));

  // Reduce motion: premium davranış — direkt göster
  if (prefersReduced) {
    els.forEach(el => el.classList.add('is-visible'));
  } else {
    // failsafe: observer takılırsa (ya da hiç tetiklenmezse) sayfa boş kalmasın
    if (els.length) {
      setTimeout(() => {
        els.forEach(el => el.classList.add('is-visible'));
      }, 1200);
    }

    if (els.length && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('is-visible');
              io.unobserve(e.target);
            }
          });
        },
        { threshold: 0.15 }
      );

      els.forEach((el, i) => {
        el.style.setProperty('--reveal-delay', `${Math.min(i * 110, 520)}ms`);
        io.observe(el);
      });
    } else {
      els.forEach((el) => el.classList.add('is-visible'));
    }
  }

  /* =========================
     2) NAVBAR COMPACT ON SCROLL
  ========================= */

  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => {
      if (window.scrollY > 8) nav.classList.add('is-compact');
      else nav.classList.remove('is-compact');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* =========================
     3) SEARCH SHEET (auto-inject)
  ========================= */

  function ensureSearchUI() {
    const openBtn = document.getElementById('openSearch');
    if (!openBtn) return;

    let sheet = document.getElementById('searchSheet');
    let backdrop = document.getElementById('searchBackdrop');

    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'backdrop';
      backdrop.id = 'searchBackdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.appendChild(backdrop);
    }

    if (!sheet) {
      sheet = document.createElement('div');
      sheet.className = 'search-sheet';
      sheet.id = 'searchSheet';
      sheet.setAttribute('aria-hidden', 'true');
      sheet.innerHTML = `
        <div class="search-row">
          <div class="search-input">
            <input id="siteSearchInput" placeholder="Ara: mont, pantolon, yelek…" />
          </div>
          <button class="btn" id="closeSearch" type="button">Kapat</button>
        </div>
      `;
      document.body.appendChild(sheet);
    }

    const closeBtn = document.getElementById('closeSearch');
    const input = document.getElementById('siteSearchInput');

    function openSearch(e) {
      if (!sheet || !backdrop) return;

      const x = e && typeof e.clientX === 'number' ? e.clientX : window.innerWidth * 0.5;
      const y = e && typeof e.clientY === 'number' ? e.clientY : window.innerHeight * 0.28;

      backdrop.style.setProperty('--rx', x + 'px');
      backdrop.style.setProperty('--ry', y + 'px');

      // showy ama temiz: reduce motion'da random/jank yok
      if (!prefersReduced) {
        backdrop.style.setProperty('--rrot', Math.floor(Math.random() * 360) + 'deg');
        backdrop.style.setProperty('--rseg', 14 + Math.floor(Math.random() * 10) + 'deg');
        backdrop.style.setProperty('--rgap', 6 + Math.floor(Math.random() * 6) + 'deg');
        backdrop.style.setProperty('--rskew', (Math.random() * 0.25 - 0.125).toFixed(3));
      }

      document.body.classList.add('search-open');

      sheet.classList.add('open');
      backdrop.classList.add('open');
      sheet.setAttribute('aria-hidden', 'false');

      // ripple sınıfı CSS'te yoksa bile sorun değil
      if (!prefersReduced) {
        backdrop.classList.remove('ripple');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            backdrop.classList.add('ripple');
          });
        });
      }

      setTimeout(() => input?.focus(), 180);
    }

    function closeSearch() {
      if (!sheet || !backdrop) return;

      document.body.classList.remove('search-open');

      sheet.classList.remove('open');
      backdrop.classList.remove('open');
      sheet.setAttribute('aria-hidden', 'true');
    }

    openBtn.addEventListener('click', openSearch);
    closeBtn?.addEventListener('click', closeSearch);
    backdrop.addEventListener('click', closeSearch);


// Enter: aramayı çalıştır (ürünler sayfasında filtreler, diğer sayfalarda mağazaya götürür)
input?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const q = (input.value || '').trim();
  if (!q) return;

  closeSearch();

  if ((document.body.classList.contains('magaza-page') || document.body.classList.contains('urunler-page'))) {
    window.dispatchEvent(new CustomEvent('berzan:search', { detail: { q } }));
  } else {
    location.href = './magaza.html?q=' + encodeURIComponent(q);
  }
});

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSearch();

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
      }
    });
  }

  ensureSearchUI();


/* =========================
   4) CART (Bireysel + Kurumsal)
========================= */

const CART_KEY = 'berzan_cart_v1';
const CART_NOTE_KEY = 'berzan_cart_note_v1';

function safeJSONParse(v, fallback){
  try{ return JSON.parse(v); }catch(e){ return fallback; }
}

function getCart(){
  const raw = localStorage.getItem(CART_KEY);
  const items = safeJSONParse(raw, []);
  if (!Array.isArray(items)) return [];
  return items.filter(x => x && typeof x.id === 'string' && Number.isFinite(Number(x.qty)) && Number(x.qty) > 0);
}

function setCart(items){
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('berzan:cart-updated'));
}

// Bireysel / kurumsal ayrımı kaldırıldı: tek sepet akışı
function getMode(){ return 'tek'; }
function setMode(){ /* noop */ }

function cartCount(){
  return getCart().reduce((s, it) => s + Number(it.qty || 0), 0);
}

function addToCart(id, qty=1){
  const p = berzanFindProduct(id);
  if (!p) return;

  const items = getCart();
  const idx = items.findIndex(x => x.id === id);
  if (idx >= 0) items[idx].qty = Math.min(999, Number(items[idx].qty) + qty);
  else items.push({ id, qty: Math.min(999, qty) });

  setCart(items);
}

function setQty(id, qty){
  qty = Math.max(0, Math.min(999, Number(qty) || 0));
  const items = getCart();
  const idx = items.findIndex(x => x.id === id);
  if (idx < 0) return;
  if (qty <= 0) items.splice(idx, 1);
  else items[idx].qty = qty;
  setCart(items);
}

function clearCart(){
  setCart([]);
}

function cartTotals(){
  const items = getCart();
  let retail = 0;
  let quote = 0;
  items.forEach(it => {
    const p = berzanFindProduct(it.id);
    if(!p) return;
    retail += (p.retail || 0) * it.qty;
    quote  += (p.quote  || p.retail || 0) * it.qty;
  });
  return { retail, quote };
}

function cartSummaryText(){
  const items = getCart();
  if(!items.length) return '';
  const lines = [];
  items.forEach(it => {
    const p = berzanFindProduct(it.id);
    if(!p) return;
    lines.push(`• ${it.qty} × ${p.name}`);
  });

  const t = cartTotals();
  return `SEPET\n\n${lines.join('\n')}\n\nToplam: ${berzanFormatTRY(t.retail)}\nTahmini teklif: ${berzanFormatTRY(t.quote)}`;
}

// global erişim (urun sayfası / shop sayfası kullanır)
window.BERZAN = window.BERZAN || {};
window.BERZAN.catalog = BERZAN_CATALOG;
window.BERZAN.categories = BERZAN_CATEGORIES;
window.BERZAN.sectors = BERZAN_SECTOR_MAP;
window.BERZAN.money = berzanFormatTRY;
window.BERZAN.find = berzanFindProduct;
window.BERZAN.cart = { getCart, addToCart, setQty, clearCart, cartTotals };

function ensureCartUI(){
  // Nav action alanını garanti et (grid bozulmasın)
  const navInner = document.querySelector('.nav .nav-inner');
  if (!navInner) return;

  removeProductExampleNavLink();

  // actions wrapper yoksa oluştur, aramayı içine taşı
  let actions = navInner.querySelector('.nav-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'nav-actions';
    const searchBtn = navInner.querySelector('#openSearch');
    if (searchBtn) actions.appendChild(searchBtn);
    navInner.appendChild(actions);
  }

  if (!document.getElementById('openCart')) {
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.id = 'openCart';
    btn.type = 'button';
    btn.innerHTML = `Sepet <span class="badge" id="cartCount">0</span>`;
    actions.appendChild(btn);
  }

let drawer = document.getElementById('cartDrawer');
  let backdrop = document.getElementById('cartBackdrop');

  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'backdrop cart-backdrop';
    backdrop.id = 'cartBackdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);
  }

  if (!drawer) {
    drawer = document.createElement('div');
    drawer.className = 'cart-drawer';
    drawer.id = 'cartDrawer';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = `
      <div class="cart-head">
        <div class="cart-title">Sepet</div>
        <button class="icon-btn ghost" id="closeCart" type="button">Kapat</button>
      </div>

      <div class="cart-items" id="cartItems"></div>

      <div class="cart-summary">
        <div class="sum-line">
          <span>Mağaza toplamı</span>
          <strong id="cartTotalRetail">₺ 0</strong>
        </div>
        <div class="sum-line">
          <span>Tahmini teklif (ortalama)</span>
          <strong id="cartTotalQuote">₺ 0</strong>
        </div>
        <div class="cart-note">
          Ödeme altyapısı (iyzico vb.) yakında. Şimdilik sepetteki listeyi <b>talep</b> olarak gönderiyoruz.
        </div>
        <div class="cart-actions">
          <a class="btn primary" id="cartRequest" href="./uzman.html">Talep gönder</a>
        </div>
      </div>
    `;
    document.body.appendChild(drawer);
  }

  const openBtn = document.getElementById('openCart');
  const closeBtn = document.getElementById('closeCart');

  function openCart(){
    document.body.classList.add('cart-open');
    drawer.classList.add('open');
    backdrop.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  }
  function closeCart(){
    document.body.classList.remove('cart-open');
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  openBtn?.addEventListener('click', openCart);
  closeBtn?.addEventListener('click', closeCart);
  backdrop.addEventListener('click', closeCart);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCart();
  });

  // dışarı aç (urun sayfası için)
  window.BERZAN.openCart = openCart;

  function renderCart(){
    const countEl = document.getElementById('cartCount');
    if (countEl) countEl.textContent = String(cartCount());

    const itemsEl = document.getElementById('cartItems');
    const items = getCart();

    if (!items.length) {
      itemsEl.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty-title">Sepet boş.</div>
          <div class="cart-empty-sub">Ürünleri gez, beğendiklerini sepete at.</div>
        </div>
      `;
    } else {
      itemsEl.innerHTML = items.map(it => {
        const p = berzanFindProduct(it.id);
        if (!p) return '';
        return `
          <div class="cart-item">
            <div class="cart-item-main">
              <div class="cart-item-name">${p.name}</div>
              <div class="cart-item-sub">${berzanFormatTRY(p.retail)} <span class="muted">• teklif: ${berzanFormatTRY(p.quote || p.retail)}</span></div>
            </div>
            <div class="cart-item-qty">
              <button class="qty-btn" type="button" data-qty-dec="${p.id}">-</button>
              <input class="qty-input" inputmode="numeric" value="${it.qty}" data-qty-input="${p.id}" />
              <button class="qty-btn" type="button" data-qty-inc="${p.id}">+</button>
            </div>
          </div>
        `;
      }).join('');
    }

    const t = cartTotals();
    document.getElementById('cartTotalRetail').textContent = berzanFormatTRY(t.retail);
    document.getElementById('cartTotalQuote').textContent  = berzanFormatTRY(t.quote);

    // uzman sayfasına not bırak (butonlara tıklanınca)
    const note = cartSummaryText();
    localStorage.setItem(CART_NOTE_KEY, note);
  }

  // qty events
  drawer.addEventListener('click', (e) => {
    const dec = e.target?.getAttribute?.('data-qty-dec');
    const inc = e.target?.getAttribute?.('data-qty-inc');
    if (dec) {
      const it = getCart().find(x => x.id === dec);
      setQty(dec, (it?.qty || 1) - 1);
    }
    if (inc) {
      const it = getCart().find(x => x.id === inc);
      setQty(inc, (it?.qty || 0) + 1);
    }
  });

  drawer.addEventListener('change', (e) => {
    const id = e.target?.getAttribute?.('data-qty-input');
    if (!id) return;
    setQty(id, e.target.value);
  });

  window.addEventListener('berzan:cart-updated', renderCart);
  renderCart();
}

ensureCartUI();

// Sepete ekle (global)
document.addEventListener('click', (e) => {
  const btn = e.target?.closest?.('[data-add-to-cart]');
  if (!btn) return;
  const id = btn.getAttribute('data-add-to-cart');
  if (!id) return;

  addToCart(id, 1);

  // küçük feedback
  btn.classList.add('is-added');
  setTimeout(() => btn.classList.remove('is-added'), 650);
});

/* =========================
   5) SHOP PAGE (Mağaza)
========================= */


// =========================
// Supabase helpers
// =========================
function berzanLooksUUID(v){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
}

async function berzanLoadSupabaseProducts(){
  const sb = window.sb;
  if (!sb || !sb.from) return [];

  const catMap = new Map();
  try{
    const { data: cats, error: catsErr } = await sb.from('categories').select('id,slug');
    if (!catsErr && Array.isArray(cats))
      cats.forEach(c => catMap.set(c.id, (c.slug||'').toLowerCase()));
  }catch(e){}

  const { data: rows, error } = await sb
    .from('products')
    .select('id,slug,name,short_desc,description,price_try,cover_image_url,category_id,is_active,sort')
    .eq('is_active', true)
    .order('sort', { ascending: true })
    .limit(200);

  if (error || !Array.isArray(rows)) return [];

  return rows.map(r => ({
    __source: 'supabase',
    id: r.id,
    slug: (r.slug||'').toLowerCase(),
    name: r.name || 'Ürün',
    mini: r.short_desc || '',
    desc: r.description || r.short_desc || '',
    retail: Number(r.price_try)||0,
    colors: [],
    cover: r.cover_image_url || '',
    cat: catMap.get(r.category_id) || 'mont',
    seasons: [],
    sectors: [],
    badge: null,
    rating: null,
  }));
}

async function berzanLoadSupabaseProduct(idOrSlug){
  const sb = window.sb;
  if (!sb || !sb.from) return null;

  const isId = berzanLooksUUID(idOrSlug);
  const q = sb
    .from('products')
    .select('id,slug,name,short_desc,description,price_try,cover_image_url,category_id,is_active')
    .limit(1);

  const { data: row, error } = isId
    ? await q.eq('id', idOrSlug).maybeSingle()
    : await q.eq('slug', String(idOrSlug||'').toLowerCase()).maybeSingle();

  if (error || !row) return null;

  let catSlug = 'mont';
  try{
    if (row.category_id){
      const { data: cRow } = await sb.from('categories').select('slug').eq('id', row.category_id).maybeSingle();
      if (cRow?.slug) catSlug = String(cRow.slug).toLowerCase();
    }
  }catch(e){}

  return {
    __source: 'supabase',
    id: row.id,
    slug: (row.slug||'').toLowerCase(),
    name: row.name || 'Ürün',
    mini: row.short_desc || '',
    desc: row.description || row.short_desc || '',
    retail: Number(row.price_try)||0,
    colors: [],
    cover: row.cover_image_url || '',
    cat: catSlug,
    seasons: [],
    sectors: [],
    badge: null,
    rating: null,
  };
}

async function initShopPage(){
  if (!(document.body.classList.contains('magaza-page') || document.body.classList.contains('urunler-page'))) return;

  const grid = document.getElementById('productsGrid');
  const catBtns = Array.from(document.querySelectorAll('.cat-item'));

  let PRODUCTS = BERZAN_CATALOG;
  try{
    const live = await berzanLoadSupabaseProducts();
    if (Array.isArray(live) && live.length){
      PRODUCTS = live;
      window.__LIVE_PRODUCTS__ = live;
    }
  }catch(e){
    console.warn("[Supabase] products load failed", e);
  }

  const tabs = Array.from(document.querySelectorAll('.season-tab'));
  const indicator = document.getElementById('seasonIndicator');
  const seasonTabs = document.getElementById('seasonTabs');

  const rightTitle = document.getElementById('rightTitle');
  const rightNote = document.getElementById('rightNote');
  const filtersRow = document.getElementById('productsFilters');
  const sectorChip = document.getElementById('sectorChip');
  const seasonChip = document.getElementById('seasonChip');
  const queryChip  = document.getElementById('queryChip');
  const emptyState = document.getElementById('emptyState');

  const shopSearch = document.getElementById('shopSearchInput');
  const shopSort = document.getElementById('shopSort');

  const params = new URLSearchParams(location.search);
  let sectorParam = (params.get('sektor') || '').toLowerCase();
  let activeSeason = '';
  let activeCat = 'mont';
  let query = (params.get('q') || '').trim().toLowerCase();
  if (shopSearch) shopSearch.value = params.get('q') || '';

  function moveIndicatorTo(btn){
    if (!indicator || !seasonTabs || !btn) return;
    const parentRect = seasonTabs.getBoundingClientRect();
    const rect = btn.getBoundingClientRect();
    // indicator'ın kendi left padding'i var (CSS: left:6px). Hesaptan düş.
    const left = rect.left - parentRect.left - 6;
    indicator.style.width = rect.width + 'px';
    indicator.style.transform = `translateX(${left}px)`;
  }

  function matchSector(p){
    if (!sectorParam) return true;
    return (p.sectors || []).includes(sectorParam);
  }

  /* --- Opsiyonel sektör sorusu (sadece mağaza sayfasında) */
  (function initSectorPrompt(){
    if (!document.body.classList.contains('magaza-page')) return;
    if (sectorParam) return;

    const KEY = 'berzan_sector_prompt_dismissed_v1';
    if (localStorage.getItem(KEY) === '1') return;

    const backdrop = document.getElementById('sectorBackdrop');
    const modal = document.getElementById('sectorModal');
    const pills = document.getElementById('sectorPills');
    const btnSkip = document.getElementById('sectorSkip');
    const btnAll = document.getElementById('sectorAll');
    if (!backdrop || !modal || !pills || !btnSkip || !btnAll) return;

    const entries = Object.entries(BERZAN_SECTOR_MAP || {});
    pills.innerHTML = entries.map(([key, label]) => (
      `<button class="pill" type="button" data-sector="${key}">${label}</button>`
    )).join('');

    function open(){
      backdrop.classList.add('open');
      modal.classList.add('open');
      modal.setAttribute('aria-hidden','false');
    }
    function close(){
      backdrop.classList.remove('open');
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden','true');
    }
    function dismiss(){
      localStorage.setItem(KEY, '1');
      close();
    }
    function setSector(key){
      sectorParam = (key || '').toLowerCase();
      const url = new URL(location.href);
      if (sectorParam) url.searchParams.set('sektor', sectorParam);
      else url.searchParams.delete('sektor');
      history.replaceState({}, '', url.toString());
      pickFirstNonEmptyCat();
      dismiss();
    }

    pills.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-sector]');
      if (!b) return;
      setSector(b.dataset.sector);
    });
    btnAll.addEventListener('click', () => setSector(''));
    btnSkip.addEventListener('click', dismiss);
    backdrop.addEventListener('click', dismiss);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') dismiss(); });

    // biraz gecikmeli aç (ilk paint'te zıplamasın)
    requestAnimationFrame(() => setTimeout(open, 120));
  })();
  function matchSeason(p){
    if (!activeSeason) return true;
    const seasons = p.seasons || [];
    if (!seasons.length) return true;
    return seasons.includes(activeSeason);
  }
function matchQuery(p){
    if (!query) return true;
    const hay = `${p.name} ${p.desc || ''} ${(p.badges||[]).join(' ')} ${(p.sectors||[]).join(' ')} ${(p.seasons||[]).join(' ')}`.toLowerCase();
    return hay.includes(query);
  }

  function seasonLabel(){
    if(!activeSeason) return '';
    return activeSeason === 'yazlik' ? 'Yazlık' : activeSeason === 'kislik' ? 'Kışlık' : 'Sezonluk';
  }

  function updateChips(){
    const show = !!(sectorParam || activeSeason || query);
    filtersRow.style.display = show ? '' : 'none';

    if (sectorParam) {
      sectorChip.style.display = '';
      sectorChip.textContent = `Sektör: ${BERZAN_SECTOR_MAP[sectorParam] || sectorParam}`;
    } else {
      sectorChip.style.display = 'none';
    }

    if (activeSeason) {
      seasonChip.style.display = '';
      seasonChip.textContent = `Sezon: ${seasonLabel()}`;
    } else {
      seasonChip.style.display = 'none';
    }

    if (query) {
      queryChip.style.display = '';
      queryChip.textContent = `Arama: ${query}`;
    } else {
      queryChip.style.display = 'none';
    }
  }

  function sortItems(items){
    const v = shopSort?.value || 'pop';
    if (v === 'price-asc') return items.sort((a,b)=> (a.retail||0)-(b.retail||0));
    if (v === 'price-desc') return items.sort((a,b)=> (b.retail||0)-(a.retail||0));
    if (v === 'name') return items.sort((a,b)=> (a.name||'').localeCompare(b.name||'', 'tr'));
    // önerilen: retail'e göre değil, kataloğun sırası (zaten düzenli)
    return items;
  }

  function render(items){
    if (!grid) return;
  const addBtnClass = document.body.classList.contains('magaza-page') ? 'btn small' : 'btn primary small';

    const list = sortItems(items.slice());
    grid.innerHTML = list.map(p => `
      <div class="shop-card">
        <a class="shop-link" href="./urun.html?urun=${encodeURIComponent(p.id)}">
          <div class="shop-media">${(()=>{const img=berzanImgFor(p); return img ? `<img class=\"shop-img\" src=\"${img}\" alt=\"${p.name}\" loading=\"lazy\" decoding=\"async\">` : `<div class=\"shop-ph\">${(p.cat||'').toUpperCase()}</div>`;})()}</div>
          <div class="shop-body">
            <div class="shop-name">${p.name}</div>
            <div class="shop-desc">${p.desc || ''}</div>
            <div class="shop-badges">
              ${(p.badges||[]).map(b=>`<span class="pill">${b}</span>`).join('')}
            </div>
          </div>
        </a>
        <div class="shop-foot">
          <div class="shop-price">
            <div class="shop-price-main">${berzanFormatTRY(p.retail)}</div>
            <div class="shop-price-sub">Teklif: ${berzanFormatTRY(p.quote || p.retail)}</div>
          </div>
          <button class="${addBtnClass}" type="button" data-add-to-cart="${p.id}">Sepete ekle</button>
        </div>
      </div>
    `).join('');
  }

  function applyAll(){
    const items = PRODUCTS
      .filter(p => (activeCat === 'tümü') ? true : p.cat === activeCat)
      .filter(matchSector)
      .filter(matchSeason)
      .filter(matchQuery);


    // Sort
    const sortMode = shopSort ? shopSort.value : 'pop';
    if (sortMode === 'price-asc') items.sort((a,b)=> (a.retail||0) - (b.retail||0));
    else if (sortMode === 'price-desc') items.sort((a,b)=> (b.retail||0) - (a.retail||0));
    else if (sortMode === 'name') items.sort((a,b)=> (a.name||'').localeCompare((b.name||''), 'tr'));

    render(items);

    const baseTitle = BERZAN_CATEGORIES[activeCat] || 'Ürünler';
  if (rightTitle) rightTitle.textContent = baseTitle;

    const parts = [];
    if (activeSeason) parts.push(`Sezon: ${seasonLabel()}`);
    if (query) parts.push(`Arama: ${query}`);
    rightNote.textContent = parts.length ? parts.join(' • ') : 'Detay için karta tıkla →';
    emptyState.style.display = items.length ? 'none' : '';
    return items.length;
  }

  function setActiveCat(cat){
    activeCat = cat;
    catBtns.forEach(b => b.classList.toggle('is-active', b.dataset.cat === cat));
    applyAll();
  }

  function pickFirstNonEmptyCat(){
    const order = ['mont','ust','pantolon','yelek','tulum','kkd','ayakkabi','aksesuar'];
    for (const cat of order){
      activeCat = cat;
      const cnt = applyAll();
      if (cnt){
        catBtns.forEach(b => b.classList.toggle('is-active', b.dataset.cat === activeCat));
        return;
      }
    }
    activeCat = 'mont';
    catBtns.forEach(b => b.classList.toggle('is-active', b.dataset.cat === activeCat));
    applyAll();
  }

  catBtns.forEach(b => b.addEventListener('click', () => setActiveCat(b.dataset.cat)));

  // Season tabs
  requestAnimationFrame(() => moveIndicatorTo(tabs[0]));
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      activeSeason = btn.dataset.season || '';
      moveIndicatorTo(btn);
    applyAll(); // sezon değişince kategori sabit kalsın
    });
  });

  // Inline search
  let tmr = null;
  function setQuery(q){
    query = (q || '').trim().toLowerCase();
    const url = new URL(location.href);
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    history.replaceState({}, '', url.toString());
    applyAll(); // URL season değişince kategori sabit kalsın
  }

  shopSearch?.addEventListener('input', () => {
    clearTimeout(tmr);
    const v = shopSearch.value;
    tmr = setTimeout(()=> setQuery(v), 120);
  });

  shopSearch?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault();
  });

  shopSort?.addEventListener('change', () => applyAll());

  // Search overlay -> shop sync
  window.addEventListener('berzan:search', (e) => {
    const q = e.detail?.q || '';
    if (shopSearch) {
      shopSearch.value = q;
      shopSearch.focus();
    }
    setQuery(q);
  });

  // Initial render
  pickFirstNonEmptyCat();
}

initShopPage();

/* =========================
   6) PRODUCT PAGE (urun.html)
========================= */
async function initProductPage(){
  if (!document.body.classList.contains('urun-page')) return;

  const params = new URLSearchParams(location.search);
  const id = (params.get('urun') || 'mont').trim().toLowerCase();
  const colorParam = (params.get('renk') || params.get('color') || '').trim().toLowerCase();

  const p = berzanFindProduct(id) || berzanFindProduct('mont') || BERZAN_CATALOG[0];

  // --- product text
  document.getElementById('crumb')?.replaceChildren(document.createTextNode(p.name));
  document.getElementById('productTitle')?.replaceChildren(document.createTextNode(p.name));
  const descEl = document.getElementById('productDesc');
  if (descEl) descEl.textContent = p.desc || 'Premium saha ürünü. Net, dayanıklı, temiz çizgi.';
  const priceEl = document.getElementById('productPrice');
  if (priceEl) priceEl.textContent = berzanFormatTRY(p.retail);

  const sectorText = (p.sectors || []).map(s => BERZAN_SECTOR_MAP[s] || s).join(' / ');
  document.getElementById('specSector')?.replaceChildren(document.createTextNode(sectorText || '—'));
  document.getElementById('specSeason')?.replaceChildren(document.createTextNode((p.seasons || []).map(s => s==='yazlik'?'Yazlık':s==='kislik'?'Kışlık':'Sezonluk').join(' / ') || '—'));
  document.getElementById('specFeature')?.replaceChildren(document.createTextNode((p.badges || [])[0] || '—'));

  // --- tags
  const tagsEl = document.getElementById('productTags');
  if (tagsEl){
    const pills = []
      .concat((p.badges||[]).map(b => ({t:b, active:true})))
      .concat((p.sectors||[]).slice(0,3).map(s => ({t: BERZAN_SECTOR_MAP[s] || s})))
      .concat((p.seasons||[]).slice(0,2).map(s => ({t: s==='yazlik'?'Yazlık':s==='kislik'?'Kışlık':'Sezonluk'})));
    tagsEl.innerHTML = pills.map(x => `<span class="pill ${x.active?'active':''}">${x.active?'<span class="dot"></span>':''}${x.t}</span>`).join('');
  }

  // --- colors (default presets by category)
  const COLORS_APPAREL = [
    { key:'siyah', label:'Siyah', hex:'#0F1115' },
    { key:'lacivert', label:'Lacivert', hex:'#0B1B3A' },
    { key:'gri', label:'Gri', hex:'#6B7280' }
  ];
  const COLORS_HIVIS = [
    { key:'sari', label:'Sarı', hex:'#F6C945' },
    { key:'turuncu', label:'Turuncu', hex:'#F97316' },
    { key:'lacivert', label:'Lacivert', hex:'#0B1B3A' }
  ];
  const PPE = ['baret','gozluk','eldiven','maske','kulaklik','kemer','ayakkabi','aksesuar'];
  const isPPE = PPE.includes(p.cat);

  const colorList = p.colors || (isPPE ? COLORS_HIVIS : COLORS_APPAREL);
  let activeColor = colorParam && colorList.some(c=>c.key===colorParam) ? colorParam : (colorList[0]?.key || '');

  const swatches = document.getElementById('pdpSwatches');
  const colorLabel = document.getElementById('pdpColorLabel');
  function setColor(key){
    activeColor = key;
    const c = colorList.find(x=>x.key===key);
    if (colorLabel) colorLabel.textContent = c ? c.label : '—';
    if (swatches){
      Array.from(swatches.querySelectorAll('button')).forEach(b=>{
        b.classList.toggle('is-active', b.dataset.color === key);
      });
    }
    // url güncelle
    const u = new URL(location.href);
    u.searchParams.set('urun', p.id);
    if (key) u.searchParams.set('renk', key);
    history.replaceState({}, '', u.toString());
    renderMedia();
  }

  if (swatches){
    swatches.innerHTML = colorList.map(c => `
      <button class="swatch" type="button" data-color="${c.key}" aria-label="${c.label}">
        <span class="swatch-dot" style="background:${c.hex}"></span>
      </button>
    `).join('');
    swatches.addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-color]');
      if (!btn) return;
      setColor(btn.dataset.color);
    });
  }
  setColor(activeColor);

  // --- media gallery
  const mainImg = document.getElementById('pdpMainImg');
  const thumbsEl = document.getElementById('pdpThumbs');

  function fallbackMedia(){
    // Görsel yoksa asla başka ürünün görselini gösterme.
    return [];
  }

  function guessedMedia(){
    const urls = [];
    // 1) katalogda tanımlı ise
    if (p.media){
      if (typeof p.media === 'string') urls.push(p.media);
      else if (Array.isArray(p.media)) urls.push(...p.media);
      else if (p.media && typeof p.media === 'object'){
        const byColor = p.media[activeColor] || p.media.default;
        if (Array.isArray(byColor)) urls.push(...byColor);
      }
    }

    // 2) dosya isim kuralı (sen görsel koyunca otomatik yakalasın)
    // ./images/products/<id>/<renk>/1.webp ... 4.webp
    for (let i=1;i<=4;i++){
      urls.push(`./images/products/${p.id}/${activeColor}/${i}.webp`);
    }
    // ./images/products/<id>/1.webp ... 4.webp
    for (let i=1;i<=4;i++){
      urls.push(`./images/products/${p.id}/${i}.webp`);
    }

    // 3) son çare
    urls.push(...fallbackMedia());

    // uniq
    return Array.from(new Set(urls));
  }

  function renderMedia(){
    const list = guessedMedia();
    const mainWrap = mainImg ? mainImg.closest('.pdp-main') : null;

    // hiç görsel yoksa: rastgele placeholder basma
    if (!list || list.length === 0 || !list[0]){
      if (mainImg){
        mainImg.removeAttribute('src');
        mainImg.style.display = 'none';
      }
      if (thumbsEl){
        thumbsEl.innerHTML = '';
        thumbsEl.style.display = 'none';
      }
      mainWrap?.classList.add('is-empty');
      return;
    }

    // görsel var
    mainWrap?.classList.remove('is-empty');
    if (mainImg) mainImg.style.display = '';

    // thumbs (sadece 2+ görsel varsa)
    if (thumbsEl){
      const t = list.slice(0,4);
      thumbsEl.innerHTML = t.map((src, i)=>`
        <button class="thumb" type="button" data-src="${src}" aria-label="Görsel ${i+1}">
          <img src="${src}" alt="" loading="lazy" decoding="async"
               onerror="this.closest('button')?.remove()"/>
        </button>
      `).join('');
      thumbsEl.style.display = t.length > 1 ? '' : 'none';
      thumbsEl.onclick = (e) => {
        const b = e.target.closest('button[data-src]');
        if (!b) return;
        setMain(b.dataset.src);
      };
    }

    // main
    setMain(list[0]);
  }

  function setMain(src){
    if (!mainImg) return;
    const mainWrap = mainImg.closest('.pdp-main');

    if (!src){
      mainImg.removeAttribute('src');
      mainImg.style.display = 'none';
      mainWrap?.classList.add('is-empty');
      return;
    }

    mainImg.style.display = '';
    mainImg.src = src;
    mainImg.onerror = () => {
      // fallback yok: görsel yoksa boş kalsın
      mainImg.removeAttribute('src');
      mainImg.style.display = 'none';
      mainWrap?.classList.add('is-empty');
    };

    if (thumbsEl){
      Array.from(thumbsEl.querySelectorAll('button.thumb')).forEach(b=>{
        b.classList.toggle('is-active', b.dataset.src === src);
      });
    }
  }
  renderMedia();

  // --- actions
  const addBtn = document.getElementById('addToCartBtn');
  const quoteBtn = document.getElementById('quoteBtn');

  addBtn?.addEventListener('click', () => {
    addToCart(p.id, 1);
    window.BERZAN.openCart?.();
  });

  quoteBtn?.addEventListener('click', () => {
    addToCart(p.id, 1);
    window.BERZAN.openCart?.();
  });
}
initProductPage();

/* =========================
   7) UZMAN FORM PREFILL (sepet notu)
========================= */
function initUzmanPrefill(){
  const form = document.querySelector('form');
  const textarea = document.querySelector('textarea[name="ihtiyac"]');
  if (!form || !textarea) return;

  const subj = form.querySelector('input[name="_subject"]');
  const submit = form.querySelector('button[type="submit"]');

  if (subj) subj.value = 'BERZAN | Ürün Talebi';
  if (submit) submit.textContent = 'Talebi Gönder';

  
  // WHATSAPP/WEBHOOK bildirim (uzman + teklif)
  form.addEventListener('submit', () => {
    const name  = (form.querySelector('[name="ad_soyad"]')?.value || '').trim();
    const phone = (form.querySelector('[name="telefon"]')?.value || '').trim();
    const email = (form.querySelector('[name="email"]')?.value || '').trim();
    const msg   = (textarea.value || '').trim();

    const items = getCart?.() || [];
    const totals = cartTotals?.() || { retail: 0, quote: 0 };

    berzanNotifyLead('talep', {
      name, phone, email,
      message: msg,
      cart: items,
      totals
    });
  }, { capture: true });
const note = localStorage.getItem(CART_NOTE_KEY) || '';
  if (note && textarea.value.trim().length === 0){
    textarea.value = note + '\n\nNot: Ödeme altyapısı yakında (iyzico vb.). Şimdilik talep olarak iletiyorum.';
  }
}
initUzmanPrefill();

  /* =========================
     4) COOKIE + ANALYTICS (single source of truth)
  ========================= */

  (function () {
    const COOKIE_NAME = 'berzan_cookie_consent';
    const GA_ID = 'G-DC3CPNQ6ZB';

    function loadGA() {
      if (window.__ga_loaded) return;
      window.__ga_loaded = true;

      const script = document.createElement('script');
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
      script.async = true;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      function gtag() { window.dataLayer.push(arguments); }
      window.gtag = gtag;

      gtag('js', new Date());
      gtag('config', GA_ID, { anonymize_ip: true });
    }

    const consent = localStorage.getItem(COOKIE_NAME);
    if (consent === 'accepted') loadGA();

    function removeBanner() {
      document.getElementById('cookieBanner')?.remove();
    }

    function createBanner() {
      // eğer sayfada zaten varsa dokunma
      if (document.getElementById('cookieBanner')) return;

      const banner = document.createElement('div');
      banner.id = 'cookieBanner';
      banner.className = 'cookie-banner';
      banner.innerHTML = `
        <div class="cookie-content">
          <div class="cookie-text">
            Deneyimi geliştirmek için çerezler kullanıyoruz. İstatistik amaçlı çerezler yalnızca izin verirsen aktif olur.
            <a href="./cerez-politikasi.html" class="cookie-link">Detaylar</a>
          </div>
          <div class="cookie-actions">
            <button class="btn cookie-btn-ghost" type="button" id="cookieReject">Reddet</button>
            <button class="btn primary" type="button" id="cookieAccept">Kabul Et</button>
          </div>
        </div>
      `;

      document.body.appendChild(banner);

      document.getElementById('cookieAccept')?.addEventListener('click', () => {
        localStorage.setItem(COOKIE_NAME, 'accepted');
        removeBanner();
        loadGA();
      });

      document.getElementById('cookieReject')?.addEventListener('click', () => {
        localStorage.setItem(COOKIE_NAME, 'rejected');
        removeBanner();
      });
    }

    if (!consent) createBanner();
    else removeBanner();
  })();
});