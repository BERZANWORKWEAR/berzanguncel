/* ==========================================================================
   BERZAN ERP — İç Panel (Stitch "industrial" tasarımı, birebir markup)
   Supabase Auth + RLS · roller (yönetici/çalışan) · atama · İleri Al · Web Başvuruları
   ========================================================================== */
(function () {
  "use strict";

  const CFG = window.REBER_CONFIG || {};
  const configured = CFG.SUPABASE_URL && CFG.SUPABASE_URL.startsWith("http") && CFG.SUPABASE_ANON_KEY && CFG.SUPABASE_ANON_KEY.length > 20;
  let sb = null;
  if (configured) sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

  /* ---- Oturum & roller ---- */
  let currentUser = null;            // {id, email, ad, rol}
  let profilMap = {};                // id -> {ad, rol}
  const isAdmin = () => !!(currentUser && currentUser.rol === "yonetici");
  const adFromId = (id) => (id && profilMap[id]) ? profilMap[id].ad : "—";
  const PIPELINE = ["Yeni","Fiyat Bekleniyor","Teklif Sunuldu","Takipte","Kazanıldı"];
  const nextDurum = (d) => { const i = PIPELINE.indexOf(d); return (i>=0 && i<PIPELINE.length-1) ? PIPELINE[i+1] : null; };

  /* ---- Sabitler ---- */
  const DURUMLAR = ["Yeni","Fiyat Bekleniyor","Teklif Sunuldu","Takipte","Kazanıldı","Kaybedildi"];
  const KAYIP_NEDENLERI = ["İletişim","Fiyat","Zamanlama","Diğer"];
  const KATEGORILER = ["Matbaa/Kağıt","İş Kıyafeti/Atölye","Promosyon","Ambalaj/Poşet","İş Güvenliği-KKD","Diğer"];
  const ASAMALAR = ["Sipariş verildi","Üretimde","Kalite kontrol","Sevkiyatta","Teslim edildi"];
  const ODEME_DURUM = ["Bekliyor","Kısmi","Ödendi"];
  const nextAsama = (a) => { const i = ASAMALAR.indexOf(a); return (i>=0 && i<ASAMALAR.length-1) ? ASAMALAR[i+1] : null; };

  const DURUM_RENK = {
    "Yeni":"bg-gray-100 text-gray-800","Fiyat Bekleniyor":"bg-amber-100 text-amber-800",
    "Teklif Sunuldu":"bg-teal-100 text-teal-800","Takipte":"bg-blue-100 text-blue-800",
    "Kazanıldı":"bg-green-100 text-green-800","Kaybedildi":"bg-red-100 text-red-700",
  };
  const ASAMA_RENK = {
    "Sipariş verildi":"bg-primary-fixed text-on-primary-fixed","Üretimde":"bg-secondary-container text-on-secondary-container",
    "Kalite kontrol":"bg-blue-100 text-blue-800","Sevkiyatta":"bg-amber-100 text-amber-800","Teslim edildi":"bg-green-100 text-green-800",
  };
  const ODEME_RENK = { "Bekliyor":"bg-error-container text-on-error-container","Kısmi":"bg-amber-100 text-amber-800","Ödendi":"bg-secondary-fixed text-on-secondary-fixed" };
  const TIP_RENK   = { "Müşteri":"bg-secondary-container text-on-secondary-container","Tedarikçi":"bg-primary-fixed text-on-primary-fixed","Genel":"bg-slate-200 text-slate-700" };
  const BASVURU_DURUM_RENK = { "Yeni":"bg-amber-100 text-amber-800","İşlendi":"bg-surface-container-highest text-on-surface-variant","Kapandı":"bg-slate-100 text-slate-600" };

  /* ---- Yardımcılar ---- */
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const el = (id) => document.getElementById(id);
  const esc = (s) => (s==null?"":String(s)).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtTL = (n) => (n==null||isNaN(n)) ? "—" : new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:2}).format(Number(n));
  const fmtNum = (n) => (n==null||isNaN(n)) ? "—" : new Intl.NumberFormat("tr-TR").format(Number(n));
  const fmtDate = (d) => { if(!d) return "—"; const x=new Date(d); return isNaN(x)?"—":x.toLocaleDateString("tr-TR"); };
  const today0 = () => { const t=new Date(); t.setHours(0,0,0,0); return t; };
  const isDue = (d) => { if(!d) return false; const x=new Date(d); x.setHours(0,0,0,0); return x<=today0(); };
  const isOpen = (durum) => durum!=="Kazanıldı" && durum!=="Kaybedildi";
  const initials = (name) => (name||"").trim().split(/\s+/).map(w=>w[0]||"").slice(0,2).join("").toLocaleUpperCase("tr") || "—";
  const starsHTML = (k) => { k=Number(k)||0; let s=""; for(let i=1;i<=5;i++) s+=`<span class="material-symbols-outlined text-[16px] text-secondary" style="font-variation-settings:'FILL' ${i<=k?1:0}">star</span>`; return `<div class="flex">${s}</div>`; };
  const pill = (t, cls) => `<span class="status-pill ${cls||"bg-slate-100 text-slate-700"}">${esc(t)}</span>`;
  function atananHTML(id){
    const ad = adFromId(id);
    if(!id || ad==="—") return '<span class="text-on-surface-variant/50">—</span>';
    const benim = currentUser && id===currentUser.id;
    return `<div class="flex items-center gap-2"><div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${benim?'bg-secondary-container text-on-secondary-container':'bg-surface-container-high text-on-surface'}">${benim?'BEN':esc(initials(ad))}</div><span class="font-body-md text-body-md ${benim?'font-medium':''}">${esc(ad)}</span></div>`;
  }
  function gecenSure(d){ const s=(Date.now()-new Date(d).getTime())/1000; if(s<60) return "az önce"; if(s<3600) return Math.floor(s/60)+" dk önce"; if(s<86400) return Math.floor(s/3600)+" saat önce"; return Math.floor(s/86400)+" gün önce"; }

  function toast(msg, hata=false){
    const t = el("toast"); t.textContent = msg;
    t.className = "fixed bottom-4 right-4 z-[70] px-4 py-3 rounded-lg shadow-lg text-sm text-white " + (hata?"bg-error":"bg-primary");
    t.classList.remove("hide"); clearTimeout(t._t); t._t = setTimeout(()=>t.classList.add("hide"), 3500);
  }

  /* ---- Modal & form alanları ---- */
  function openModal(title, bodyHTML){ el("modal-title").textContent = title; el("modal-body").innerHTML = bodyHTML; el("modal").classList.remove("hide"); }
  function closeModal(){ el("modal").classList.add("hide"); el("modal-body").innerHTML=""; }
  el("modal-close").addEventListener("click", closeModal);
  el("modal").addEventListener("click", (e)=>{ if(e.target.id==="modal") closeModal(); });
  const fInput = (name,label,val="",type="text",extra="") =>
    `<div><label class="block text-sm font-medium text-on-surface mb-1">${label}</label>
     <input name="${name}" type="${type}" value="${esc(val)}" ${extra} class="w-full rounded-lg border border-outline-variant px-3 py-2 focus:outline-none focus:ring-2 focus:ring-secondary"/></div>`;
  const fArea = (name,label,val="") =>
    `<div class="sm:col-span-2"><label class="block text-sm font-medium text-on-surface mb-1">${label}</label>
     <textarea name="${name}" rows="2" class="w-full rounded-lg border border-outline-variant px-3 py-2 focus:outline-none focus:ring-2 focus:ring-secondary">${esc(val)}</textarea></div>`;
  const fSelect = (name,label,opts,val="") =>
    `<div><label class="block text-sm font-medium text-on-surface mb-1">${label}</label>
     <select name="${name}" class="w-full rounded-lg border border-outline-variant px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-secondary">
       ${opts.map(o=>`<option value="${esc(o)}" ${String(o)===String(val)?"selected":""}>${esc(o)}</option>`).join("")}</select></div>`;
  const formData = (form) => { const o={}; new FormData(form).forEach((v,k)=>o[k]= v===""?null:v); return o; };

  /* ======================================================================
     KİMLİK DOĞRULAMA
     ====================================================================== */
  async function doLogin(e){
    e.preventDefault();
    const err = el("login-error"); err.classList.add("hide");
    if(!configured){ el("config-warn").classList.remove("hide"); return; }
    const user = el("login-user").value.trim(); const pass = el("login-pass").value;
    const email = user.includes("@") ? user : user + (CFG.USERNAME_DOMAIN||"@reber.berzan.local");
    el("login-btn-text").textContent = "Giriş yapılıyor…";
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    el("login-btn-text").textContent = "Giriş Yap";
    if(error){ err.textContent = "Kullanıcı adı veya şifre hatalı."; err.classList.remove("hide"); return; }
    await onAuthed();
  }
  async function doLogout(){ if(sb) await sb.auth.signOut(); stopInactivity(); el("app-view").classList.add("hide"); el("login-view").classList.remove("hide"); el("login-pass").value=""; }
  async function onAuthed(){
    const { data:{ user } } = await sb.auth.getUser();
    profilMap = {};
    const { data: profs } = await sb.from("profiles").select("*");
    (profs||[]).forEach(p => profilMap[p.id] = { ad: p.ad || "—", rol: p.rol });
    const me = (profs||[]).find(p => p.id === user.id);
    currentUser = { id:user.id, email:user.email, ad: me ? (me.ad || (user.email||"").split("@")[0]) : (user.email||"").split("@")[0], rol: me ? me.rol : "calisan" };
    el("current-user").textContent = currentUser.ad + " · " + (isAdmin() ? "Yönetici" : "Çalışan");
    $$(".admin-only").forEach(x=>x.classList.toggle("hide", !isAdmin()));
    el("login-view").classList.add("hide"); el("app-view").classList.remove("hide");
    startInactivity(); switchTab("dashboard");
    refreshBildirim(); if(bildirimTimer) clearInterval(bildirimTimer); bildirimTimer = setInterval(refreshBildirim, 60000);
  }
  let inacTimer = null; const INAC_MS = (Number(CFG.INACTIVITY_MINUTES)||30)*60*1000;
  function resetInactivity(){ if(inacTimer) clearTimeout(inacTimer); inacTimer = setTimeout(async ()=>{ await doLogout(); toast("Oturum işlemsizlik nedeniyle kapatıldı.", true); }, INAC_MS); }
  function startInactivity(){ ["click","keydown","mousemove","touchstart"].forEach(ev=>document.addEventListener(ev, resetInactivity, {passive:true})); resetInactivity(); }
  function stopInactivity(){ if(inacTimer) clearTimeout(inacTimer); ["click","keydown","mousemove","touchstart"].forEach(ev=>document.removeEventListener(ev, resetInactivity)); }

  /* ---- Veri katmanı ---- */
  const api = {
    list: (t, order="created_at") => sb.from(t).select("*").order(order, {ascending:false}),
    insert: (t, row) => sb.from(t).insert(row).select().single(),
    update: (t, id, row) => sb.from(t).update(row).eq("id", id).select().single(),
    remove: (t, id) => sb.from(t).delete().eq("id", id),
  };
  async function fetchAll(t, order){ const {data,error}=await api.list(t,order); if(error){toast("Veri okunamadı: "+error.message,true); return [];} return data||[]; }

  /* ---- Sekme yönetimi ---- */
  let cache = { talepler:[], tedarikciler:[], teklifler:[], siparisler:[], basvurular:[], musteriler:[], urunler:[], odemeler:[] };
  const ODEME_YONTEM = ["Havale/EFT","Nakit","Çek","Kredi Kartı","Diğer"];
  let pendingOpen = null; // {tab, id} — aramadan derin link
  function switchTab(tab){
    $$(".tab-btn").forEach(b=>{ const on=b.dataset.tab===tab;
      b.classList.toggle("border-secondary", on); b.classList.toggle("border-transparent", !on);
      b.classList.toggle("text-on-primary", on); b.classList.toggle("bg-white/5", on); b.classList.toggle("text-on-primary/70", !on); });
    $$(".panel").forEach(p=>p.classList.add("hide"));
    const panel=el("panel-"+tab); if(!panel || !renderers[tab]) return;
    if(tab==="kullanicilar" && !isAdmin()){ toast("Bu bölüm yalnız yöneticilere açık.", true); return; }
    panel.classList.remove("hide"); closeSidebar(); renderers[tab]();
  }
  function openSidebar(){ const s=el("sidebar"); if(s) s.classList.remove("-translate-x-full"); const o=el("sidebar-overlay"); if(o) o.classList.remove("hide"); }
  function closeSidebar(){ const s=el("sidebar"); if(s) s.classList.add("-translate-x-full"); const o=el("sidebar-overlay"); if(o) o.classList.add("hide"); }

  /* ======================================================================
     1) GÖSTERGE PANELİ  (Stitch)
     ====================================================================== */
  async function renderDashboard(){
    const host = el("panel-dashboard");
    host.innerHTML = `<p class="text-on-surface-variant">Yükleniyor…</p>`;
    const [talepler, siparisler, basvurular] = await Promise.all([fetchAll("talepler"), fetchAll("siparisler"), fetchAll("basvurular")]);
    cache.talepler=talepler; cache.siparisler=siparisler; cache.basvurular=basvurular;
    const acik = talepler.filter(t=>isOpen(t.durum)).length;
    const ay=new Date(); const ayBasi=new Date(ay.getFullYear(),ay.getMonth(),1);
    const buAyKazanilan = talepler.filter(t=>t.durum==="Kazanıldı" && new Date(t.updated_at||t.created_at)>=ayBasi).length;
    const toplamKar = siparisler.reduce((s,o)=>s+(Number(o.kar)||0),0);
    const odemeBekleyen = siparisler.filter(o=>o.musteri_odeme!=="Ödendi").reduce((s,o)=>s+(Number(o.satis)||0),0);
    const vadesiGelen = talepler.filter(t=>isOpen(t.durum) && isDue(t.sonraki_adim_tarihi));
    const banaAtanan = currentUser ? talepler.filter(t=>isOpen(t.durum) && t.atanan===currentUser.id).length : 0;
    const yeniBasvuru = basvurular.filter(b=>b.durum==="Yeni").length;

    const card = (ikon,chip,etiket,deger,extra="") => `
      <div class="glass-card p-5 rounded-xl transition-transform hover:-translate-y-1 ${extra}">
        <div class="w-10 h-10 rounded-full ${chip} flex items-center justify-center mb-4"><span class="ms">${ikon}</span></div>
        <p class="font-label-md text-label-md text-on-surface-variant mb-1">${etiket}</p>
        <h3 class="font-stat-number text-stat-number text-primary">${deger}</h3>
      </div>`;

    const aktiviteler = [
      ...talepler.slice(0,5).map(t=>({ t:t.created_at, ikon:"add_task", chip:"bg-secondary-container text-on-secondary-container", html:`<span class="font-bold">${esc(adFromId(t.ekleyen))}</span> talep oluşturdu: <span class="text-secondary">${esc(t.talep_no)}</span>` })),
      ...basvurular.slice(0,5).map(b=>({ t:b.created_at, ikon:"web", chip:"bg-primary-fixed text-on-primary-fixed", html:`Web başvurusu: <span class="text-secondary">${esc(b.ad_soyad)||esc(b.firma)||"—"}</span>` })),
    ].sort((a,b)=>new Date(b.t)-new Date(a.t)).slice(0,4);

    host.innerHTML = `
      <div class="mb-6"><h2 class="font-headline-lg text-headline-lg text-primary">Gösterge Paneli</h2>
        <p class="font-body-md text-body-md text-on-surface-variant">Sistem genelindeki güncel durum ve aksiyon bekleyen işlemler.</p></div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        ${statCard("assignment","bg-primary/10 text-primary","Açık Talep", fmtNum(acik))}
        ${statCard("person","bg-secondary/10 text-secondary","Bana Atanan Açık", fmtNum(banaAtanan))}
        ${statCard("check_circle","bg-green-50 text-green-600","Bu Ay Kazanılan", fmtNum(buAyKazanilan))}
        ${statCard("payments","bg-secondary/10 text-secondary","Toplam Kâr (₺)", fmtTL(toplamKar))}
        ${statCard("hourglass_empty","bg-error-container/30 text-error","Ödeme Bekleyen", fmtTL(odemeBekleyen))}
        ${statCard("web","bg-blue-50 text-blue-600","Web Başvurusu", fmtNum(yeniBasvuru))}
      </div>

      <section class="glass-card rounded-xl overflow-hidden shadow-ambient mb-8">
        <div class="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded bg-amber-500 flex items-center justify-center text-white"><span class="ms text-[20px]">notification_important</span></div>
            <h4 class="font-headline-md text-headline-md text-amber-900">Sonraki adım tarihi gelmiş talepler</h4>
          </div>
          <span class="bg-amber-200 text-amber-900 px-3 py-1 rounded-full font-label-md text-label-md">${vadesiGelen.length} Kayıt</span>
        </div>
        <div class="tbl-wrap">
          ${vadesiGelen.length===0 ? `<p class="p-6 text-on-surface-variant">Bekleyen adım yok. 👍</p>` : `
          <table class="w-full text-left border-collapse">
            <thead><tr class="bg-surface-container-low border-b border-outline-variant">
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase">Talep No</th>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase">Müşteri</th>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase">Sonraki Adım</th>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase">Tarih</th>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase">Durum</th></tr></thead>
            <tbody class="divide-y divide-outline-variant">
              ${vadesiGelen.map(t=>`<tr class="hover:bg-surface-container-low transition-colors">
                <td class="px-6 py-4 font-body-md font-bold text-primary">${esc(t.talep_no)}</td>
                <td class="px-6 py-4 font-body-md">${esc(t.musteri)}</td>
                <td class="px-6 py-4 font-body-md">${esc(t.sonraki_adim)||"—"}</td>
                <td class="px-6 py-4 font-body-md text-error font-medium">${fmtDate(t.sonraki_adim_tarihi)}</td>
                <td class="px-6 py-4">${pill(t.durum, DURUM_RENK[t.durum])}</td></tr>`).join("")}
            </tbody></table>`}
        </div>
      </section>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div class="glass-card rounded-xl p-6">
          <h5 class="font-headline-md text-headline-md text-primary mb-6">Son Aktiviteler</h5>
          ${aktiviteler.length===0?`<p class="text-on-surface-variant text-sm">Henüz aktivite yok.</p>`:`<div class="space-y-5">
            ${aktiviteler.map(a=>`<div class="flex gap-4">
              <div class="w-10 h-10 rounded-full ${a.chip} flex items-center justify-center shrink-0"><span class="ms text-[20px]">${a.ikon}</span></div>
              <div><p class="font-body-md text-on-surface">${a.html}</p><p class="text-[12px] text-on-surface-variant">${gecenSure(a.t)}</p></div>
            </div>`).join("")}</div>`}
        </div>
        <div class="glass-card rounded-xl p-6 bg-primary text-on-primary relative overflow-hidden">
          <div class="relative z-10">
            <h5 class="font-headline-md text-headline-md text-on-primary mb-2">Web Başvuruları</h5>
            <p class="font-body-md text-on-primary/70 mb-6">Web sitenizden gelen son form doldurma işlemleri.</p>
            <div class="space-y-3">
              ${basvurular.slice(0,3).map(b=>`<div class="bg-on-primary/10 p-3 rounded-lg flex justify-between items-center"><div><p class="font-label-md text-label-md">${esc(b.ad_soyad)||esc(b.firma)||"—"}</p><p class="text-[10px] opacity-70">${esc(b.tip)} · ${esc(b.firma)||""}</p></div><span class="ms">arrow_forward_ios</span></div>`).join("") || `<p class="text-on-primary/60 text-sm">Henüz başvuru yok.</p>`}
            </div>
            <button id="dash-tum-basvuru" class="mt-6 w-full py-2 rounded-lg bg-secondary text-white font-label-md text-label-md hover:brightness-110 transition">Tüm Başvuruları Gör</button>
          </div>
          <div class="absolute -right-10 -bottom-10 w-48 h-48 bg-secondary/20 rounded-full blur-3xl"></div>
        </div>
      </div>`;
    const b1=el("dash-tum-basvuru"); if(b1) b1.addEventListener("click", ()=>switchTab("webbasvuru"));
  }

  /* ======================================================================
     2) TALEP TAKİP  (Stitch)
     ====================================================================== */
  let talepBenim = false;
  async function renderTalepler(){
    const host = el("panel-talepler");
    host.innerHTML = `<p class="text-on-surface-variant">Yükleniyor…</p>`;
    const [taleplerAll, musteriler] = await Promise.all([fetchAll("talepler"), fetchAll("musteriler")]);
    const talepler = taleplerAll.filter(t=>!t.arsiv); cache.talepler = talepler; cache.musteriler = musteriler;
    const kayipSay = {}; KAYIP_NEDENLERI.forEach(k=>kayipSay[k]=0);
    talepler.filter(t=>t.durum==="Kaybedildi" && t.kayip_nedeni).forEach(t=>kayipSay[t.kayip_nedeni]++);
    const kayipVar = Object.values(kayipSay).some(v=>v>0);
    const liste = (talepBenim && currentUser) ? talepler.filter(t=>t.atanan===currentUser.id) : talepler;

    host.innerHTML = `
      <div class="mb-6"><h2 class="font-headline-lg text-headline-lg text-primary">Talep Takip</h2>
        <p class="font-body-md text-body-md text-on-surface-variant">Tüm talepler; atanan kişi, durum ve sonraki adımları buradan yönetin.</p></div>
      <div class="flex flex-col xl:flex-row gap-6">
        <div class="flex-grow glass-card rounded-xl overflow-hidden flex flex-col">
          <div class="p-5 border-b border-outline-variant flex flex-wrap justify-between items-center gap-3">
            <div><h3 class="font-headline-md text-headline-md text-primary">Talep Takip Havuzu</h3>
              <p class="font-body-md text-on-surface-variant">Toplam ${talepler.filter(t=>isOpen(t.durum)).length} aktif talep.</p></div>
            <div class="flex gap-2">
              <button id="benim-isler" class="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-label-md ${talepBenim?'bg-primary text-white border-primary':'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'}"><span class="ms text-[18px]">assignment_ind</span> Benim İşlerim</button>
              <button id="talep-csv" class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface-variant text-label-md hover:bg-surface-container-low"><span class="ms text-[18px]">download</span> CSV</button>
              <button id="yeni-talep" class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-white text-label-md hover:brightness-110"><span class="ms text-[18px]">add</span> Yeni Talep</button>
            </div>
          </div>
          <div class="tbl-wrap flex-grow">
            <table class="w-full text-left border-collapse">
              <thead><tr class="bg-surface-container-low">
                <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase border-b border-outline-variant">Talep No</th>
                <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase border-b border-outline-variant">Müşteri</th>
                <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase border-b border-outline-variant">Ürün (Adet)</th>
                <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase border-b border-outline-variant">Durum</th>
                <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase border-b border-outline-variant">Atanan</th>
                <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase border-b border-outline-variant">Sonraki Adım</th>
                <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase border-b border-outline-variant text-right">Aksiyonlar</th>
              </tr></thead>
              <tbody id="talep-rows" class="divide-y divide-outline-variant"></tbody>
            </table>
            ${liste.length===0?`<p class="p-6 text-on-surface-variant">Kayıt yok.</p>`:""}
          </div>
        </div>
        <aside class="xl:w-72 shrink-0">
          <div class="glass-card rounded-xl p-5">
            <h4 class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-4">Kayıp Nedenleri</h4>
            ${kayipVar?`<canvas id="kayip-chart" height="200"></canvas>`:`<p class="text-on-surface-variant text-sm">Henüz kayıp kaydı yok.</p>`}
          </div>
        </aside>
      </div>`;

    el("talep-rows").innerHTML = liste.map(t=>{
      const due = isOpen(t.durum) && isDue(t.sonraki_adim_tarihi);
      const benim = currentUser && t.atanan===currentUser.id;
      const ileri = isOpen(t.durum) ? nextDurum(t.durum) : null;
      return `<tr class="${benim?'bg-secondary/5':''} hover:bg-surface-container-low transition-colors">
        <td class="px-6 py-4"><div class="font-bold text-primary">${esc(t.talep_no)}</div><div class="text-[11px] text-on-surface-variant">${fmtDate(t.tarih)} · ${esc(adFromId(t.ekleyen))}</div></td>
        <td class="px-6 py-4 font-medium">${esc(t.musteri)}</td>
        <td class="px-6 py-4"><div class="font-body-md">${esc(t.urun_kategori)||"—"} (${fmtNum(t.adet)})</div></td>
        <td class="px-6 py-4">${pill((t.durum||"").toLocaleUpperCase("tr"), DURUM_RENK[t.durum])}</td>
        <td class="px-6 py-4">${atananHTML(t.atanan)}</td>
        <td class="px-6 py-4 ${due?'text-error font-medium':'text-on-surface-variant'}">${esc(t.sonraki_adim)||"—"}<div class="text-[11px]">${fmtDate(t.sonraki_adim_tarihi)}</div></td>
        <td class="px-6 py-4"><div class="flex items-center justify-end gap-2">
          ${ileri?`<button class="ileri-al bg-secondary text-white text-[11px] px-3 py-1.5 rounded flex items-center gap-1 hover:brightness-110" data-id="${t.id}">Sonraki aşama <span class="ms text-[14px]">arrow_forward</span></button>`:`<button class="bg-surface-variant text-on-surface-variant text-[11px] px-3 py-1.5 rounded cursor-default opacity-60">Süreç Bitti</button>`}
          ${isOpen(t.durum)?`<button class="kaybet p-1.5 text-on-surface-variant hover:text-error" data-id="${t.id}" title="Kaybedildi"><span class="ms text-[20px]">cancel</span></button>`:""}
          <button class="duzenle p-1.5 text-on-surface-variant hover:text-primary" data-id="${t.id}" title="Düzenle"><span class="ms text-[20px]">edit</span></button>
          <button class="ars-talep p-1.5 text-on-surface-variant hover:text-amber-600" data-id="${t.id}" title="Arşivle"><span class="ms text-[20px]">archive</span></button>
          ${isAdmin()?`<button class="sil p-1.5 text-on-surface-variant hover:text-error" data-id="${t.id}" title="Sil"><span class="ms text-[20px]">delete</span></button>`:""}
        </div></td></tr>`;
    }).join("");

    el("benim-isler").addEventListener("click", ()=>{ talepBenim=!talepBenim; renderTalepler(); });
    el("yeni-talep").addEventListener("click", ()=>talepForm());
    el("talep-csv").addEventListener("click", ()=>exportCSV("talepler.csv", liste.map(t=>({talep_no:t.talep_no,tarih:t.tarih,musteri:t.musteri,urun:t.urun_kategori,adet:t.adet,durum:t.durum,atanan:adFromId(t.atanan),ekleyen:adFromId(t.ekleyen),sonraki_adim:t.sonraki_adim,sonraki_adim_tarihi:t.sonraki_adim_tarihi}))));
    $$(".duzenle").forEach(b=>b.addEventListener("click", ()=>talepForm(talepler.find(x=>x.id===b.dataset.id))));
    $$(".ars-talep").forEach(b=>b.addEventListener("click", ()=>arsivle("talepler", b.dataset.id, renderTalepler)));
    $$(".sil").forEach(b=>b.addEventListener("click", ()=>silKayit("talepler", b.dataset.id, renderTalepler)));
    $$(".ileri-al").forEach(b=>b.addEventListener("click", ()=>ileriAlTalep(talepler.find(x=>x.id===b.dataset.id))));
    $$(".kaybet").forEach(b=>b.addEventListener("click", ()=>kaybetTalep(b.dataset.id)));
    if(kayipVar) new Chart(el("kayip-chart"), { type:"doughnut", data:{ labels:Object.keys(kayipSay), datasets:[{ data:Object.values(kayipSay), backgroundColor:["#006a61","#f59e0b","#3b82f6","#94a3b8"] }] }, options:{ plugins:{ legend:{ position:"bottom" } } } });
    if(pendingOpen && pendingOpen.tab==="talepler"){ const t=talepler.find(x=>x.id===pendingOpen.id); pendingOpen=null; if(t) talepForm(t); }
  }
  async function ileriAlTalep(t){ if(!t) return; const next=nextDurum(t.durum); if(!next) return;
    const { error } = await api.update("talepler", t.id, { durum: next }); if(error){ toast("Güncellenemedi: "+error.message, true); return; }
    logAktivite("talep", t.id, "durum: "+next, t.talep_no);
    toast(next==="Kazanıldı" ? "Kazanıldı → Sipariş Takibi'ne taşındı." : "Durum: "+next); renderTalepler(); }
  function kaybetTalep(id){
    openModal("Talebi Kaybet", `<form id="kaybet-f" class="space-y-3"><p class="text-sm text-on-surface-variant">Bu talep neden kaybedildi?</p>
      ${fSelect("kayip_nedeni","Kayıp nedeni", KAYIP_NEDENLERI, KAYIP_NEDENLERI[0])}
      <div class="flex justify-end gap-2 pt-2"><button type="button" id="iptalK" class="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant">İptal</button><button type="submit" class="px-4 py-2 rounded-lg bg-error text-white">Kaybedildi işaretle</button></div></form>`);
    el("iptalK").addEventListener("click", closeModal);
    el("kaybet-f").addEventListener("submit", async (e)=>{ e.preventDefault(); const row=formData(e.target);
      const { error } = await api.update("talepler", id, { durum:"Kaybedildi", kayip_nedeni: row.kayip_nedeni });
      if(error){ toast("Güncellenemedi: "+error.message, true); return; } logAktivite("talep", id, "durum: Kaybedildi", row.kayip_nedeni); closeModal(); toast("Talep kaybedildi olarak işaretlendi."); renderTalepler(); });
  }
  function talepForm(t){
    const d = t||{};
    openModal(t?"Talep Düzenle":"Yeni Talep", `
      <form id="talep-f" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${fInput("tarih","Tarih", d.tarih||new Date().toISOString().slice(0,10),"date")}
        <div><label class="block text-sm font-medium text-on-surface mb-1">Müşteri (cari)</label>
          <select name="musteri_id" id="talep-musteri-id" class="w-full rounded-lg border border-outline-variant px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-secondary">
            <option value="">— Serbest / seçilmedi —</option>
            ${(cache.musteriler||[]).filter(m=>!m.arsiv).map(m=>`<option value="${m.id}" ${m.id===(d.musteri_id||"")?"selected":""}>${esc(m.firma)}</option>`).join("")}
          </select></div>
        ${fInput("musteri","Müşteri (serbest metin)", d.musteri,"text","required")}
        ${fInput("iletisim_kisi","İletişim kişisi", d.iletisim_kisi)}
        ${fInput("urun_kategori","Ürün / kategori", d.urun_kategori)}
        ${fInput("adet","Adet", d.adet??1,"number","min=0 step=1")}
        ${fInput("istenen_teslim","İstenen teslim", d.istenen_teslim,"date")}
        ${fArea("spesifikasyon","Spesifikasyon", d.spesifikasyon)}
        ${fSelect("durum","Durum", DURUMLAR, d.durum||"Yeni")}
        <div><label class="block text-sm font-medium text-on-surface mb-1">Atanan kişi</label>
          <select name="atanan" class="w-full rounded-lg border border-outline-variant px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-secondary">
            <option value="">— Atanmadı —</option>
            ${Object.entries(profilMap).map(([id,p])=>`<option value="${id}" ${id===(d.atanan||"")?"selected":""}>${esc(p.ad)}</option>`).join("")}
          </select></div>
        ${fInput("sonraki_adim","Sonraki adım", d.sonraki_adim)}
        ${fInput("sonraki_adim_tarihi","Sonraki adım tarihi", d.sonraki_adim_tarihi,"date")}
        ${fSelect("kayip_nedeni","Kayıp nedeni (kaybedildiyse)", ["", ...KAYIP_NEDENLERI], d.kayip_nedeni||"")}
        ${fArea("notlar","Not", d.notlar)}
        ${t?'<div class="sm:col-span-2 border-t border-outline-variant pt-4" id="talep-form-ekler"></div>':''}
        <div class="sm:col-span-2 flex justify-end gap-2 pt-2"><button type="button" id="iptal" class="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant">İptal</button><button type="submit" class="px-4 py-2 rounded-lg bg-primary text-white">Kaydet</button></div>
      </form>`);
    if(t) renderEklerBox("talep", t.id, "talep-form-ekler");
    const msel=el("talep-musteri-id"); if(msel) msel.addEventListener("change", ()=>{ const m=(cache.musteriler||[]).find(x=>x.id===msel.value); const mi=el("talep-f").querySelector('[name=musteri]'); if(m && mi && !mi.value.trim()) mi.value=m.firma; });
    el("iptal").addEventListener("click", closeModal);
    el("talep-f").addEventListener("submit", async (e)=>{ e.preventDefault(); const row=formData(e.target); row.adet=row.adet?Number(row.adet):1;
      if(!row.musteri_id) delete row.musteri_id;   // schema-v3 yoksa da talep eklenebilsin
      const wasKazanildi = d.durum==="Kazanıldı"; const oncekiAtanan = d.atanan||null;
      const res = t ? await api.update("talepler", t.id, row) : await api.insert("talepler", row);
      if(res.error){ toast("Kaydedilemedi: "+res.error.message, true); return; }
      const savedId = t ? t.id : (res.data && res.data.id);
      if(!t) logAktivite("talep", savedId, "oluşturuldu", row.musteri);
      else if(row.durum && row.durum!==d.durum) logAktivite("talep", savedId, "durum: "+row.durum, row.musteri);
      if(row.atanan && row.atanan!==oncekiAtanan) notifyAtama(row.atanan, "Size talep atandı: "+(row.musteri||row.talep_no||""));
      closeModal(); toast((!wasKazanildi && row.durum==="Kazanıldı") ? "Talep kazanıldı → Sipariş Takibi'ne taşındı." : "Kaydedildi."); renderTalepler(); });
  }

  /* ======================================================================
     3) TEDARİKÇİLER  (Stitch)
     ====================================================================== */
  let tedFiltre = "";
  async function renderTedarikciler(){
    const host = el("panel-tedarikciler");
    host.innerHTML = `<p class="text-on-surface-variant">Yükleniyor…</p>`;
    const ted = (await fetchAll("tedarikciler")).filter(x=>!x.arsiv); cache.tedarikciler = ted;
    const liste = tedFiltre ? ted.filter(x=>x.kategori===tedFiltre) : ted;
    const kArr = ted.map(x=>Number(x.kalite)).filter(n=>n>0);
    const ortKalite = kArr.length ? (kArr.reduce((a,b)=>a+b,0)/kArr.length) : 0;
    const ortTeslim = (()=>{ const a=ted.map(x=>Number(x.ort_teslim_gun)).filter(n=>n>0); return a.length?Math.round(a.reduce((s,n)=>s+n,0)/a.length):0; })();

    host.innerHTML = `
      <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
        <div><h3 class="font-headline-lg text-headline-lg text-primary">Tedarikçi Yönetimi</h3>
          <p class="font-body-md text-on-surface-variant">Sistemde kayıtlı aktif tedarikçilerin listesi ve performans verileri.</p></div>
        <div class="flex items-center gap-3">
          <select id="kat-filtre" class="bg-white border border-outline-variant rounded-lg px-4 py-2.5 text-body-md font-medium outline-none focus:ring-2 focus:ring-secondary/20">
            <option value="">Tüm Kategoriler</option>
            ${KATEGORILER.map(k=>`<option value="${esc(k)}" ${k===tedFiltre?"selected":""}>${esc(k)}</option>`).join("")}
          </select>
          <button id="yeni-ted" class="bg-primary text-on-primary px-5 py-2.5 rounded-lg font-label-md text-label-md flex items-center gap-2 hover:brightness-125 shadow-md"><span class="ms">add</span> Yeni Tedarikçi</button>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        ${statCard("groups","bg-secondary-container/30 text-secondary","Toplam Tedarikçi", fmtNum(ted.length))}
        ${statCard("star","bg-primary-fixed/30 text-primary","Ort. Kalite Skoru", ortKalite?ortKalite.toFixed(1):"—")}
        ${statCard("schedule","bg-secondary/10 text-secondary","Ort. Teslim Süresi", ortTeslim?ortTeslim+" Gün":"—")}
        ${statCard("category","bg-error-container/20 text-error","Kategori Sayısı", fmtNum(new Set(ted.map(x=>x.kategori).filter(Boolean)).size))}
      </div>
      <div class="glass-card rounded-xl overflow-hidden">
        <div class="tbl-wrap"><table class="w-full text-left border-collapse">
          <thead class="bg-surface-container-low border-b border-outline-variant"><tr>
            <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase font-bold">Firma</th>
            <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase font-bold">Kategori</th>
            <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase font-bold">İletişim Kişisi</th>
            <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase font-bold">Telefon</th>
            <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase font-bold text-center">Min. Sipariş</th>
            <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase font-bold text-center">Ort. Teslim</th>
            <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase font-bold">Vade</th>
            <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase font-bold">Kalite</th>
            <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase font-bold text-right">Aksiyonlar</th>
          </tr></thead>
          <tbody id="ted-rows" class="divide-y divide-outline-variant"></tbody>
        </table>
        ${liste.length===0?`<p class="p-6 text-on-surface-variant">Kayıt yok.</p>`:""}
        </div>
      </div>`;

    el("ted-rows").innerHTML = liste.map(x=>`
      <tr class="hover:bg-surface-container-low transition-colors">
        <td class="px-6 py-4"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs">${esc(initials(x.firma))}</div><div><p class="font-semibold text-primary">${esc(x.firma)}</p></div></div></td>
        <td class="px-6 py-4">${x.kategori?`<span class="px-3 py-1 rounded-full bg-secondary-container/30 text-secondary text-[11px] font-bold uppercase">${esc(x.kategori)}</span>`:"—"}</td>
        <td class="px-6 py-4 font-medium">${esc(x.iletisim_kisi)||"—"}</td>
        <td class="px-6 py-4 text-on-surface-variant">${esc(x.telefon)||"—"}</td>
        <td class="px-6 py-4 text-center">${x.min_siparis?fmtNum(x.min_siparis)+" ₺":"—"}</td>
        <td class="px-6 py-4 text-center">${x.ort_teslim_gun?x.ort_teslim_gun+" Gün":"—"}</td>
        <td class="px-6 py-4">${esc(x.odeme_vadesi)||"—"}</td>
        <td class="px-6 py-4 whitespace-nowrap">${starsHTML(x.kalite)}</td>
        <td class="px-6 py-4 text-right"><div class="flex justify-end gap-2">
          <button class="ted-edit p-1.5 hover:bg-primary/10 text-primary rounded-lg" data-id="${x.id}"><span class="ms">edit</span></button>
          <button class="ted-ars p-1.5 hover:bg-amber-500/10 text-amber-600 rounded-lg" data-id="${x.id}" title="Arşivle"><span class="ms">archive</span></button>
          ${isAdmin()?`<button class="ted-sil p-1.5 hover:bg-error/10 text-error rounded-lg" data-id="${x.id}"><span class="ms">delete</span></button>`:""}
        </div></td></tr>`).join("");

    el("kat-filtre").addEventListener("change", e=>{ tedFiltre=e.target.value; renderTedarikciler(); });
    el("yeni-ted").addEventListener("click", ()=>tedForm());
    $$(".ted-edit").forEach(b=>b.addEventListener("click", ()=>tedForm(ted.find(x=>x.id===b.dataset.id))));
    $$(".ted-ars").forEach(b=>b.addEventListener("click", ()=>arsivle("tedarikciler", b.dataset.id, renderTedarikciler)));
    $$(".ted-sil").forEach(b=>b.addEventListener("click", ()=>silKayit("tedarikciler", b.dataset.id, renderTedarikciler)));
    if(pendingOpen && pendingOpen.tab==="tedarikciler"){ const x=ted.find(y=>y.id===pendingOpen.id); pendingOpen=null; if(x) tedForm(x); }
  }
  function tedForm(x){
    const d = x||{};
    openModal(x?"Tedarikçi Düzenle":"Yeni Tedarikçi", `
      <form id="ted-f" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${fInput("firma","Firma", d.firma,"text","required")}
        ${fSelect("kategori","Kategori", KATEGORILER, d.kategori||KATEGORILER[0])}
        ${fInput("iletisim_kisi","İletişim kişisi", d.iletisim_kisi)}
        ${fInput("telefon","Telefon", d.telefon)}
        ${fInput("eposta","E-posta", d.eposta,"email")}
        ${fInput("min_siparis","Min. sipariş", d.min_siparis,"number","min=0 step=any")}
        ${fInput("ort_teslim_gun","Ort. teslim (gün)", d.ort_teslim_gun,"number","min=0 step=1")}
        ${fInput("odeme_vadesi","Ödeme vadesi", d.odeme_vadesi)}
        ${fSelect("kalite","Kalite (1-5)", [1,2,3,4,5], d.kalite||3)}
        ${fArea("notlar","Not", d.notlar)}
        <div class="sm:col-span-2 flex justify-end gap-2 pt-2"><button type="button" id="iptal2" class="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant">İptal</button><button type="submit" class="px-4 py-2 rounded-lg bg-primary text-white">Kaydet</button></div>
      </form>`);
    el("iptal2").addEventListener("click", closeModal);
    el("ted-f").addEventListener("submit", async (e)=>{ e.preventDefault(); const row=formData(e.target);
      ["min_siparis","ort_teslim_gun","kalite"].forEach(k=>{ if(row[k]!=null) row[k]=Number(row[k]); });
      const { error } = x ? await api.update("tedarikciler", x.id, row) : await api.insert("tedarikciler", row);
      if(error){ toast("Kaydedilemedi: "+error.message, true); return; } closeModal(); toast("Kaydedildi."); renderTedarikciler(); });
  }

  /* ======================================================================
     4) TEKLİF & FİYATLANDIRMA  (Stitch)
     ====================================================================== */
  let seciliTalepId = "";
  async function renderTeklifler(){
    const host = el("panel-teklifler");
    host.innerHTML = `<p class="text-on-surface-variant">Yükleniyor…</p>`;
    const [talepler, ted] = await Promise.all([fetchAll("talepler"), fetchAll("tedarikciler")]);
    cache.talepler = talepler; cache.tedarikciler = ted;
    host.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 class="font-headline-lg text-headline-lg text-primary">Teklif &amp; Fiyatlandırma</h2>
        <div class="flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded-lg border border-outline-variant">
          <span class="font-label-md text-label-md text-on-surface-variant">Talep Seç:</span>
          <select id="teklif-talep" class="bg-transparent font-label-md text-label-md font-bold text-on-surface outline-none min-w-[220px]">
            <option value="">— Talep seçin —</option>
            ${talepler.map(t=>`<option value="${t.id}" ${t.id===seciliTalepId?"selected":""}>${esc(t.talep_no)} · ${esc(t.musteri)}</option>`).join("")}
          </select>
        </div>
      </div>
      <div id="teklif-icerik"></div>`;
    el("teklif-talep").addEventListener("change", e=>{ seciliTalepId=e.target.value; renderTeklifDetay(); });
    if(seciliTalepId) renderTeklifDetay();
    else el("teklif-icerik").innerHTML = `<div class="glass-card rounded-xl p-10 text-center text-on-surface-variant">Fiyatlandırma için yukarıdan bir talep seçin.</div>`;
  }
  async function renderTeklifDetay(){
    const box = el("teklif-icerik");
    const talep = cache.talepler.find(t=>t.id===seciliTalepId);
    if(!talep){ box.innerHTML=""; return; }
    box.innerHTML = `<p class="text-on-surface-variant">Teklifler yükleniyor…</p>`;
    const { data:teklifler, error } = await sb.from("teklifler").select("*").eq("talep_id", seciliTalepId).order("birim_fiyat",{ascending:true});
    if(error){ toast("Teklifler okunamadı: "+error.message, true); return; }
    const adet = Number(talep.adet)||1;
    const enDusuk = teklifler.length ? Math.min(...teklifler.map(t=>Number(t.birim_fiyat)||Infinity)) : null;
    const secili = teklifler.find(t=>t.secildi);
    let maliyet=null, satis=null, kar=null;
    if(secili){ maliyet=(Number(secili.birim_fiyat)||0)*adet; if(secili.kar_marji!=null){ satis=maliyet*(1+Number(secili.kar_marji)/100); kar=satis-maliyet; } }

    box.innerHTML = `
      <div class="space-y-6">
        <div class="bg-surface p-6 rounded-xl border border-outline-variant card-shadow flex flex-wrap items-center justify-between gap-6">
          <div class="flex items-center gap-4"><div class="bg-secondary/10 p-3 rounded-full"><span class="ms text-secondary">assignment</span></div>
            <div><p class="font-label-md text-label-md text-on-surface-variant">Talep No</p><h3 class="font-headline-md text-headline-md text-primary">${esc(talep.talep_no)}</h3></div></div>
          <div><p class="font-label-md text-label-md text-on-surface-variant">Müşteri</p><h3 class="font-body-lg text-body-lg font-bold text-on-surface">${esc(talep.musteri)}</h3></div>
          <div><p class="font-label-md text-label-md text-on-surface-variant">Ürün</p><h3 class="font-body-lg text-body-lg font-bold text-on-surface">${esc(talep.urun_kategori)||"—"}</h3></div>
          <div><p class="font-label-md text-label-md text-on-surface-variant">Adet</p><h3 class="font-body-lg text-body-lg font-bold text-on-surface">${fmtNum(adet)}</h3></div>
          <div class="flex gap-2">${pill(talep.durum, DURUM_RENK[talep.durum])}</div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <section class="lg:col-span-2 space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="font-headline-md text-headline-md text-primary">Alınan Teklifler (${teklifler.length})</h3>
              <div class="flex gap-2">
                <button id="yeni-teklif" class="bg-surface border border-primary text-primary px-4 py-2 rounded-lg font-label-md text-label-md hover:bg-primary/5 flex items-center gap-2"><span class="ms text-[20px]">add</span> Teklif Ekle</button>
                <button id="proforma-btn" class="bg-surface border border-secondary text-secondary px-4 py-2 rounded-lg font-label-md text-label-md hover:bg-secondary/5 flex items-center gap-2"><span class="ms text-[20px]">description</span> Proforma</button>
                <button id="musteriye-sun" class="bg-secondary text-on-secondary px-4 py-2 rounded-lg font-label-md text-label-md hover:brightness-95 flex items-center gap-2"><span class="ms text-[20px]">send</span> Müşteriye Sun</button>
              </div>
            </div>
            <div class="bg-surface rounded-xl border border-outline-variant overflow-hidden card-shadow tbl-wrap">
              <table class="w-full text-left border-collapse">
                <thead><tr class="bg-surface-container-low border-b border-outline-variant">
                  <th class="p-4 font-label-md text-label-md text-on-surface-variant uppercase">Tedarikçi</th>
                  <th class="p-4 font-label-md text-label-md text-on-surface-variant uppercase">Birim ₺</th>
                  <th class="p-4 font-label-md text-label-md text-on-surface-variant uppercase">Toplam ₺</th>
                  <th class="p-4 font-label-md text-label-md text-on-surface-variant uppercase">Teslim</th>
                  <th class="p-4 font-label-md text-label-md text-on-surface-variant uppercase">Vade</th>
                  <th class="p-4 font-label-md text-label-md text-on-surface-variant uppercase">Kalite</th>
                  <th class="p-4 font-label-md text-label-md text-on-surface-variant text-center">İşlem</th></tr></thead>
                <tbody class="divide-y divide-outline-variant">
                  ${teklifler.length===0?`<tr><td colspan="7" class="p-6 text-on-surface-variant">Henüz teklif yok.</td></tr>`:
                  teklifler.map(t=>{ const dusuk=Number(t.birim_fiyat)===enDusuk;
                    return `<tr class="hover:bg-surface-container-low transition-colors ${t.secildi?'bg-secondary/5':''}">
                      <td class="p-4 font-body-md font-semibold text-on-surface">${esc(t.tedarikci_adi)||"—"}</td>
                      <td class="p-4 font-body-md">${fmtTL(t.birim_fiyat)}</td>
                      <td class="p-4 font-body-md ${dusuk?'font-bold text-secondary':''}">${fmtTL((Number(t.birim_fiyat)||0)*adet)}</td>
                      <td class="p-4 font-body-md">${t.teslim_gun?t.teslim_gun+" Gün":"—"}</td>
                      <td class="p-4 font-body-md">${esc(t.vade)||"—"}</td>
                      <td class="p-4">${starsHTML(t.kalite)}</td>
                      <td class="p-4 text-center"><button class="sec-teklif px-3 py-1 rounded-md text-[11px] font-bold uppercase ${t.secildi?'bg-secondary text-on-secondary':'bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-low'}" data-id="${t.id}">${t.secildi?'Seçildi':'Seç'}</button></td>
                    </tr>`; }).join("")}
                </tbody></table>
            </div>
          </section>
          <aside class="space-y-4">
            <h3 class="font-headline-md text-headline-md text-primary">Fiyatlandırma</h3>
            <div class="bg-surface p-6 rounded-xl border border-outline-variant card-shadow space-y-6">
              ${!secili?`<p class="text-on-surface-variant text-sm">Önce bir teklifi "Seç" ile işaretleyin.</p>`:`
              <div><label class="block font-label-md text-label-md text-on-surface-variant mb-2">Maliyet (₺)</label>
                <div class="relative"><input id="cost-input" type="text" readonly value="${fmtNum(maliyet)}" class="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 font-body-md"/><span class="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">₺</span></div></div>
              <div><label class="block font-label-md text-label-md text-on-surface-variant mb-2">Kâr Marjı (%)</label>
                <div class="relative"><input id="margin-input" type="number" value="${secili.kar_marji??25}" class="w-full bg-surface-container-low border border-outline-variant rounded-lg p-3 font-body-md focus:ring-2 focus:ring-secondary outline-none"/><span class="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">%</span></div></div>
              <hr class="border-outline-variant"/>
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-surface-container-low p-4 rounded-lg"><p class="font-label-md text-label-md text-on-surface-variant">Kâr</p><p class="font-headline-md text-headline-md text-secondary mt-1" id="profit-display">${kar!=null?fmtTL(kar):"—"}</p></div>
                <div class="bg-primary-container p-4 rounded-lg"><p class="font-label-md text-label-md text-tertiary-fixed-dim">Satış Fiyatı</p><p class="font-headline-md text-headline-md text-on-primary mt-1" id="total-display">${satis!=null?fmtTL(satis):"—"}</p></div>
              </div>
              <div class="pt-2"><button id="save-pricing" class="w-full bg-secondary text-on-secondary py-4 rounded-xl font-body-lg text-body-lg font-bold hover:brightness-95 active:scale-[0.98]">Fiyatı Onayla &amp; İleri Al</button></div>`}
            </div>
          </aside>
        </div>
      </div>`;

    el("yeni-teklif").addEventListener("click", ()=>teklifForm());
    el("proforma-btn").addEventListener("click", ()=>{ if(!secili){ toast("Önce bir teklif seçin (fiyatlandırma için).", true); return; } proformaAc(talep, secili); });
    el("musteriye-sun").addEventListener("click", async ()=>{
      if(teklifler.length<3){ toast(`Uyarı: Müşteriye sunmadan önce en az 3 teklif girin. (Şu an ${teklifler.length})`, true); return; }
      if(!secili){ toast("Önce bir teklif seçin.", true); return; }
      await api.update("talepler", talep.id, { durum:"Teklif Sunuldu" }); toast("Durum 'Teklif Sunuldu' olarak güncellendi.");
    });
    $$(".sec-teklif").forEach(b=>b.addEventListener("click", async ()=>{
      await sb.from("teklifler").update({secildi:false}).eq("talep_id", seciliTalepId);
      await sb.from("teklifler").update({secildi:true}).eq("id", b.dataset.id); renderTeklifDetay();
    }));
    if(secili){
      const mi=el("margin-input");
      const recompute=()=>{ const m=Number(mi.value)||0; const s=maliyet*(1+m/100); el("total-display").textContent=fmtTL(s); el("profit-display").textContent=fmtTL(s-maliyet); };
      mi.addEventListener("input", recompute);
      el("save-pricing").addEventListener("click", async ()=>{
        const m=mi.value; await api.update("teklifler", secili.id, { kar_marji: m===""?null:Number(m) });
        const next=nextDurum(talep.durum); if(next) await api.update("talepler", talep.id, { durum: next });
        toast("Fiyat onaylandı, talep ilerletildi."); renderTeklifDetay();
      });
    }
  }
  function teklifForm(){
    const ted = cache.tedarikciler;
    openModal("Teklif Ekle", `
      <form id="teklif-f" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2"><label class="block text-sm font-medium text-on-surface mb-1">Tedarikçi</label>
          <select name="tedarikci_id" class="w-full rounded-lg border border-outline-variant px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-secondary">
            <option value="">— Seçin —</option>${ted.map(x=>`<option value="${x.id}">${esc(x.firma)} (${esc(x.kategori||"")})</option>`).join("")}</select></div>
        ${fInput("birim_fiyat","Birim fiyat (₺)", "", "number","required min=0 step=any")}
        ${fInput("teslim_gun","Teslim (gün)", "", "number","min=0 step=1")}
        ${fInput("vade","Ödeme vadesi", "")}
        ${fSelect("kalite","Kalite (1-5)", [1,2,3,4,5], 3)}
        <div class="sm:col-span-2 flex justify-end gap-2 pt-2"><button type="button" id="iptal3" class="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant">İptal</button><button type="submit" class="px-4 py-2 rounded-lg bg-primary text-white">Ekle</button></div>
      </form>`);
    el("iptal3").addEventListener("click", closeModal);
    el("teklif-f").addEventListener("submit", async (e)=>{ e.preventDefault(); const row=formData(e.target);
      row.talep_id=seciliTalepId; row.birim_fiyat=Number(row.birim_fiyat)||0; if(row.teslim_gun) row.teslim_gun=Number(row.teslim_gun); if(row.kalite) row.kalite=Number(row.kalite);
      const tx=cache.tedarikciler.find(x=>x.id===row.tedarikci_id); row.tedarikci_adi=tx?tx.firma:null;
      const { error } = await api.insert("teklifler", row); if(error){ toast("Eklenemedi: "+error.message, true); return; }
      closeModal(); toast("Teklif eklendi."); renderTeklifDetay(); });
  }

  /* ======================================================================
     5) SİPARİŞ TAKİBİ  (Stitch)
     ====================================================================== */
  async function renderSiparisler(){
    const host = el("panel-siparisler");
    host.innerHTML = `<p class="text-on-surface-variant">Yükleniyor…</p>`;
    const sip = (await fetchAll("siparisler")).filter(o=>!o.arsiv); cache.siparisler = sip;
    const aktif = sip.filter(o=>o.asama!=="Teslim edildi").length;
    const geciken = sip.filter(o=>o.asama!=="Teslim edildi" && o.teslim_tarihi && new Date(o.teslim_tarihi)<today0()).length;
    const bekleyenOdeme = sip.filter(o=>o.musteri_odeme!=="Ödendi").reduce((s,o)=>s+(Number(o.satis)||0),0);
    const teslim = sip.filter(o=>o.asama==="Teslim edildi").length;

    host.innerHTML = `
      <div class="mb-6"><h2 class="font-headline-lg text-headline-lg text-primary">Sipariş Takibi</h2>
        <p class="font-body-md text-body-md text-on-surface-variant">Kazanılan talepler otomatik buraya düşer; aşama ve ödemeleri buradan yönetin.</p></div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        ${statCard("package_2","bg-primary/10 text-primary","Aktif Siparişler", fmtNum(aktif))}
        ${statCard("warning","bg-error-container/30 text-error","Gecikenler", fmtNum(geciken))}
        ${statCard("payments","bg-secondary-container/40 text-secondary","Bekleyen Ödemeler", fmtTL(bekleyenOdeme))}
        ${statCard("done_all","bg-tertiary-fixed/40 text-on-tertiary-fixed-variant","Teslim Edilenler", fmtNum(teslim))}
      </div>
      <div class="glass-card rounded-xl overflow-hidden">
        <div class="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-bright">
          <h3 class="font-headline-md text-headline-md text-primary">Sipariş Listesi</h3>
          <button id="sip-csv" class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface-variant text-label-md hover:bg-surface-container-low"><span class="ms text-[18px]">download</span> CSV</button>
        </div>
        <div class="tbl-wrap"><table class="w-full text-left border-collapse">
          <thead class="bg-surface-container-low"><tr>
            <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase text-[11px]">Sipariş No</th>
            <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase text-[11px]">Müşteri</th>
            <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase text-[11px]">Tedarikçi</th>
            <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase text-[11px]">Ürün</th>
            <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase text-[11px] text-right">Finansal</th>
            <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase text-[11px] text-center">Aşama</th>
            <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase text-[11px] text-center">Ödemeler</th>
            <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase text-[11px]">Teslim</th>
            <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase text-[11px] text-right">Aksiyonlar</th></tr></thead>
          <tbody id="sip-rows" class="divide-y divide-outline-variant"></tbody>
        </table>
        ${sip.length===0?`<p class="p-6 text-on-surface-variant">Henüz sipariş yok.</p>`:""}
        </div>
      </div>`;

    el("sip-rows").innerHTML = sip.map(o=>{
      const gecikme = o.asama!=="Teslim edildi" && o.teslim_tarihi && new Date(o.teslim_tarihi)<today0();
      const ileri = nextAsama(o.asama);
      return `<tr class="hover:bg-surface-container-low transition-colors ${gecikme?'bg-error-container/10':''}">
        <td class="px-6 py-4 font-bold text-primary relative">${gecikme?'<div class="delay-indicator"></div>':''}${esc(o.siparis_no)}</td>
        <td class="px-6 py-4 font-body-md">${esc(o.musteri)||"—"}</td>
        <td class="px-6 py-4 font-body-md text-on-surface-variant">${esc(o.tedarikci)||"—"}</td>
        <td class="px-6 py-4"><div class="font-body-md font-medium">${esc(o.urun)||"—"}</div><div class="text-[11px] text-on-surface-variant">${fmtNum(o.adet)} Adet</div></td>
        <td class="px-6 py-4 text-right"><div class="font-body-md font-bold text-primary">${fmtTL(o.satis)}</div><div class="text-[11px] text-secondary font-bold">${o.kar_yuzde!=null?('+%'+fmtNum(o.kar_yuzde)+' Kâr'):''}</div></td>
        <td class="px-6 py-4 text-center">${pill(o.asama, ASAMA_RENK[o.asama])}</td>
        <td class="px-6 py-4 text-center space-y-1">
          <div>${pill("Müş: "+o.musteri_odeme, ODEME_RENK[o.musteri_odeme])}</div>
          <div>${pill("Ted: "+o.tedarikci_odeme, ODEME_RENK[o.tedarikci_odeme])}</div></td>
        <td class="px-6 py-4"><div class="font-body-md ${gecikme?'text-error font-bold':''}">${fmtDate(o.teslim_tarihi)}</div>${gecikme?'<div class="text-[10px] text-error">Gecikti</div>':''}</td>
        <td class="px-6 py-4 text-right"><div class="flex justify-end gap-2">
          ${ileri?`<button class="sip-ileri bg-secondary text-on-secondary px-3 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1 hover:brightness-110" data-id="${o.id}">İleri Al <span class="ms text-[16px]">arrow_forward</span></button>`:""}
          <button class="sip-detay p-2 text-on-surface-variant hover:bg-surface-container rounded-lg" data-id="${o.id}" title="Ödeme & detay"><span class="ms">receipt_long</span></button>
          <button class="sip-edit p-2 text-on-surface-variant hover:bg-surface-container rounded-lg" data-id="${o.id}" title="Düzenle"><span class="ms">edit</span></button>
          <button class="sip-ars p-2 text-on-surface-variant hover:bg-surface-container rounded-lg" data-id="${o.id}" title="Arşivle"><span class="ms">archive</span></button>
        </div></td></tr>`;
    }).join("");

    el("sip-csv").addEventListener("click", ()=>exportCSV("siparisler.csv", sip.map(o=>({siparis_no:o.siparis_no,musteri:o.musteri,tedarikci:o.tedarikci,urun:o.urun,adet:o.adet,maliyet:o.maliyet,satis:o.satis,kar:o.kar,asama:o.asama,musteri_odeme:o.musteri_odeme,tedarikci_odeme:o.tedarikci_odeme,teslim_tarihi:o.teslim_tarihi}))));
    $$(".sip-detay").forEach(b=>b.addEventListener("click", ()=>sipDetay(sip.find(x=>x.id===b.dataset.id))));
    $$(".sip-edit").forEach(b=>b.addEventListener("click", ()=>sipForm(sip.find(x=>x.id===b.dataset.id))));
    $$(".sip-ars").forEach(b=>b.addEventListener("click", ()=>arsivle("siparisler", b.dataset.id, renderSiparisler)));
    $$(".sip-ileri").forEach(b=>b.addEventListener("click", ()=>ileriAlSiparis(sip.find(x=>x.id===b.dataset.id))));
    if(pendingOpen && pendingOpen.tab==="siparisler"){ const o=sip.find(x=>x.id===pendingOpen.id); pendingOpen=null; if(o) sipDetay(o); }
  }
  async function ileriAlSiparis(o){ if(!o) return; const next=nextAsama(o.asama); if(!next) return;
    const { error } = await api.update("siparisler", o.id, { asama: next }); if(error){ toast("Güncellenemedi: "+error.message, true); return; }
    logAktivite("siparis", o.id, "aşama: "+next, o.siparis_no); toast("Aşama: "+next); renderSiparisler(); }
  function sipForm(o){
    openModal("Sipariş Düzenle — "+esc(o.siparis_no), `
      <form id="sip-f" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${fInput("tedarikci","Tedarikçi", o.tedarikci)}
        ${fInput("urun","Ürün", o.urun)}
        ${fInput("adet","Adet", o.adet,"number","min=0 step=1")}
        ${fInput("maliyet","Maliyet (₺)", o.maliyet,"number","min=0 step=any")}
        ${fInput("satis","Satış (₺)", o.satis,"number","min=0 step=any")}
        ${fSelect("asama","Aşama", ASAMALAR, o.asama)}
        ${fSelect("musteri_odeme","Müşteri ödeme", ODEME_DURUM, o.musteri_odeme)}
        ${fSelect("tedarikci_odeme","Tedarikçi ödeme", ODEME_DURUM, o.tedarikci_odeme)}
        ${fInput("teslim_tarihi","Teslim tarihi", o.teslim_tarihi,"date")}
        <div class="sm:col-span-2 text-sm text-on-surface-variant">Kâr ve kâr% otomatik hesaplanır (Satış − Maliyet).</div>
        <div class="sm:col-span-2 flex justify-end gap-2 pt-2"><button type="button" id="iptal4" class="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant">İptal</button><button type="submit" class="px-4 py-2 rounded-lg bg-primary text-white">Kaydet</button></div>
      </form>`);
    el("iptal4").addEventListener("click", closeModal);
    el("sip-f").addEventListener("submit", async (e)=>{ e.preventDefault(); const row=formData(e.target);
      ["adet","maliyet","satis"].forEach(k=>{ if(row[k]!=null) row[k]=Number(row[k]); });
      const { error } = await api.update("siparisler", o.id, row); if(error){ toast("Kaydedilemedi: "+error.message, true); return; }
      closeModal(); toast("Kaydedildi."); renderSiparisler(); });
  }

  /* ======================================================================
     6) WEB BAŞVURULARI  (Stitch)
     ====================================================================== */
  let basvuruList = []; let seciliBasvuruId = ""; let bsvFilter = "Tümü";
  async function renderWebbasvuru(){
    const host = el("panel-webbasvuru");
    host.innerHTML = `<p class="text-on-surface-variant">Yükleniyor…</p>`;
    basvuruList = await fetchAll("basvurular");
    if(!basvuruList.find(b=>b.id===seciliBasvuruId)) seciliBasvuruId = basvuruList[0] ? basvuruList[0].id : "";
    paintWebbasvuru();
  }
  function haftalikBars(){
    const t=today0(); const gunler=[]; for(let i=6;i>=0;i--){ const d=new Date(t); d.setDate(d.getDate()-i); gunler.push(d.getTime()); }
    const say=gunler.map(g=>basvuruList.filter(b=>{ const c=new Date(b.created_at); c.setHours(0,0,0,0); return c.getTime()===g; }).length);
    const max=Math.max(1,...say);
    return say.map(n=>{ const h=Math.round(8+(n/max)*88); return `<div class="w-full ${n?'bg-secondary':'bg-secondary/20'} rounded-t" style="height:${h}%"></div>`; }).join("");
  }
  function paintWebbasvuru(){
    const host=el("panel-webbasvuru");
    const list = bsvFilter==="Tümü" ? basvuruList : basvuruList.filter(b=>(b.tip||"Genel")===bsvFilter);
    const bekleyen=list.filter(b=>b.durum==='Yeni').length; const islenen=list.filter(b=>b.durum!=='Yeni').length;
    const tipSay=(tp)=>basvuruList.filter(b=>(b.tip||"Genel")===tp).length;
    const seg=(val,n)=>{ const on=bsvFilter===val; return `<button class="bsv-filter px-4 py-2 rounded-full font-label-md text-label-md font-bold transition ${on?'bg-primary text-on-primary shadow-sm':'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}" data-f="${val}">${val} <span class="opacity-60">(${n})</span></button>`; };
    const secili=list.find(b=>b.id===seciliBasvuruId);
    host.innerHTML = `
      <div class="flex flex-wrap justify-between items-end gap-4 mb-8">
        <div><h2 class="font-headline-lg text-headline-lg text-primary">Web Başvuruları</h2>
          <p class="font-body-md text-on-surface-variant">Web sitemiz üzerinden gelen güncel müşteri ve tedarikçi talepleri.</p></div>
        <div class="flex gap-3">
          <div class="bg-white p-4 rounded-xl card-elevation flex items-center gap-4"><div class="w-10 h-10 bg-secondary-container text-on-secondary-container rounded-full flex items-center justify-center"><span class="ms">inbox</span></div><div><p class="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Bekleyen Başvuru</p><p class="font-stat-number text-stat-number text-primary">${bekleyen}</p></div></div>
          <div class="bg-white p-4 rounded-xl card-elevation flex items-center gap-4"><div class="w-10 h-10 bg-tertiary-fixed text-on-tertiary-fixed rounded-full flex items-center justify-center"><span class="ms">done_all</span></div><div><p class="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">İşlenen</p><p class="font-stat-number text-stat-number text-primary">${islenen}</p></div></div>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 mb-6">
        <span class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mr-1">Tür:</span>
        ${seg('Tümü', basvuruList.length)}
        ${seg('Müşteri', tipSay('Müşteri'))}
        ${seg('Tedarikçi', tipSay('Tedarikçi'))}
        ${seg('Genel', tipSay('Genel'))}
      </div>
      <div class="grid grid-cols-12 gap-6">
        <div class="col-span-12 lg:col-span-8 bg-white rounded-xl card-elevation overflow-hidden">
          <div class="tbl-wrap"><table class="w-full text-left border-collapse">
            <thead class="bg-surface-container-low border-b border-outline-variant"><tr>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant">TARİH</th>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant">TÜR</th>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant">AD SOYAD / FİRMA</th>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant">İLETİŞİM</th>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant">DURUM</th></tr></thead>
            <tbody class="divide-y divide-outline-variant">
              ${list.length===0?`<tr><td colspan="5" class="px-6 py-6 text-on-surface-variant">Henüz başvuru yok.</td></tr>`:
              list.map(b=>{ const sec=b.id===seciliBasvuruId;
                return `<tr class="bsv-row cursor-pointer transition-colors ${sec?'bg-secondary-container/20':''} ${b.durum==='Yeni'?'new-row-highlight':''} hover:bg-surface-container-low" data-id="${b.id}">
                  <td class="px-6 py-5 font-body-md">${fmtDate(b.created_at)}</td>
                  <td class="px-6 py-5">${pill(b.tip, TIP_RENK[b.tip]||TIP_RENK['Genel'])}</td>
                  <td class="px-6 py-5"><p class="font-body-md font-bold text-primary">${esc(b.ad_soyad)||"—"}</p><p class="text-[12px] text-on-surface-variant">${esc(b.firma)||""}</p></td>
                  <td class="px-6 py-5 text-on-surface-variant"><div class="font-body-md text-[13px]">${esc(b.eposta)||""}</div>${b.telefon?`<div class="font-body-md text-[13px]">${esc(b.telefon)}</div>`:""}</td>
                  <td class="px-6 py-5">${b.durum==='Yeni'?`<span class="flex items-center gap-1.5 text-secondary font-bold font-label-md text-label-md"><span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span> Yeni</span>`:`<span class="px-3 py-1 rounded-full bg-surface-container-highest text-on-surface-variant font-label-md text-[11px]">${esc(b.durum)}</span>`}</td>
                </tr>`; }).join("")}
            </tbody></table></div>
        </div>
        <div class="col-span-12 lg:col-span-4 space-y-6">
          <div class="bg-white rounded-xl card-elevation p-6">
            <div class="flex items-center justify-between mb-6"><h3 class="font-headline-md text-headline-md text-primary">Seçili Başvuru</h3><span class="ms text-secondary">info</span></div>
            ${!secili?`<p class="text-on-surface-variant text-sm">Detay için soldan bir başvuru seçin.</p>`:`
            <div class="space-y-4">
              <div><div class="font-bold text-primary">${esc(secili.ad_soyad)||"—"}</div><div class="text-xs text-on-surface-variant">${esc(secili.firma)||""}</div></div>
              <div class="p-4 bg-surface-container-low rounded-lg border border-outline-variant"><p class="text-[10px] uppercase font-bold text-on-surface-variant mb-2">MESAJ İÇERİĞİ</p><p class="font-body-md text-on-surface leading-relaxed italic">${secili.mesaj?('“'+esc(secili.mesaj)+'”'):'(mesaj yok)'}</p></div>
              <div class="grid grid-cols-2 gap-4"><div class="p-3 bg-surface rounded-lg"><p class="text-[10px] font-bold text-on-surface-variant">TÜR</p><p class="text-secondary font-bold">${esc(secili.tip)}</p></div><div class="p-3 bg-surface rounded-lg"><p class="text-[10px] font-bold text-on-surface-variant">KAYNAK</p><p class="text-primary font-bold">Web Form</p></div></div>
              <div><p class="text-[10px] font-bold text-on-surface-variant mb-0.5">İLETİŞİM</p><p class="text-sm break-all">${esc(secili.eposta)||""}${secili.telefon?(' · '+esc(secili.telefon)):''}</p></div>
              ${secili.durum!=='İşlendi'?`
                ${secili.tip==='Tedarikçi'?`<button id="sec-tedarikci" class="w-full py-3 bg-primary text-on-primary font-bold rounded-lg hover:brightness-125 transition">Tedarikçi Olarak Ekle</button>`:`<button id="sec-cevir" class="w-full py-3 bg-secondary text-on-secondary font-bold rounded-lg hover:brightness-95 transition">Talebe Çevir</button>`}
                <button id="sec-arsivle" class="w-full py-3 border-2 border-secondary text-secondary font-bold rounded-lg hover:bg-secondary/5 transition">Arşivle</button>`:`<div class="text-center text-sm text-green-600 font-bold py-2">✓ İşlendi</div>`}
              ${isAdmin()?`<button id="sec-sil" class="w-full py-1.5 text-error text-sm hover:underline">Sil</button>`:""}
            </div>`}
          </div>
          <div class="bg-primary-container rounded-xl card-elevation p-6 text-white relative overflow-hidden">
            <div class="relative z-10"><h3 class="font-headline-md text-headline-md mb-2">Haftalık Performans</h3><p class="text-on-primary-container text-body-md mb-6">Son 7 günde gelen başvurular.</p>
              <div class="flex items-end gap-2 h-24 mb-4">${haftalikBars()}</div><p class="text-[10px] text-on-primary-container text-center">SON 7 GÜN</p></div>
            <div class="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl"></div>
          </div>
        </div>
      </div>`;
    $$(".bsv-filter").forEach(b=>b.addEventListener("click", ()=>{ bsvFilter=b.dataset.f; paintWebbasvuru(); }));
    $$(".bsv-row").forEach(r=>r.addEventListener("click", ()=>{ seciliBasvuruId=r.dataset.id; paintWebbasvuru(); }));
    const c=el("sec-cevir"); if(c) c.addEventListener("click", ()=>talebeCevir(secili));
    const td=el("sec-tedarikci"); if(td) td.addEventListener("click", ()=>tedarikciyeCevir(secili));
    const ar=el("sec-arsivle"); if(ar) ar.addEventListener("click", ()=>arsivleBasvuru(secili));
    const si=el("sec-sil"); if(si) si.addEventListener("click", ()=>silKayit("basvurular", secili.id, renderWebbasvuru));
  }
  async function talebeCevir(b){ if(!b) return; if(!confirm("Bu başvuru Talep Takip'e aktarılsın mı?")) return;
    const not=[b.tip?("Tür: "+b.tip):"", b.eposta?("E-posta: "+b.eposta):"", b.telefon?("Tel: "+b.telefon):"", b.mesaj||""].filter(Boolean).join(" | ");
    const { error } = await api.insert("talepler", { musteri: b.firma||b.ad_soyad||"Web başvurusu", iletisim_kisi: b.ad_soyad||null, notlar: not, durum:"Yeni" });
    if(error){ toast("Aktarılamadı: "+error.message, true); return; } await api.update("basvurular", b.id, { durum:"İşlendi" }); toast("Talep Takip'e aktarıldı."); renderWebbasvuru(); }
  async function tedarikciyeCevir(b){ if(!b) return; if(!confirm("Bu başvuru Tedarikçiler listesine eklensin mi?")) return;
    const { error } = await api.insert("tedarikciler", { firma: b.firma||b.ad_soyad||"Web tedarikçi", kategori:"Diğer", iletisim_kisi: b.ad_soyad||null, telefon: b.telefon||null, eposta: b.eposta||null, notlar: b.mesaj||null });
    if(error){ toast("Eklenemedi: "+error.message, true); return; } await api.update("basvurular", b.id, { durum:"İşlendi" }); toast("Tedarikçiler listesine eklendi."); renderWebbasvuru(); }
  async function arsivleBasvuru(b){ if(!b) return; const { error } = await api.update("basvurular", b.id, { durum:"Kapandı" }); if(error){ toast("Güncellenemedi: "+error.message, true); return; } toast("Başvuru arşivlendi."); renderWebbasvuru(); }

  /* ---- Ortak silme & renderer haritası ---- */
  async function silKayit(tablo, id, after){ if(!confirm("Bu kayıt silinsin mi?")) return; const { error } = await api.remove(tablo, id); if(error){ toast("Silinemedi: "+error.message, true); return; } toast("Silindi."); after(); }
  const renderers = { dashboard:renderDashboard, talepler:renderTalepler, tedarikciler:renderTedarikciler, teklifler:renderTeklifler, siparisler:renderSiparisler, webbasvuru:renderWebbasvuru, musteriler:renderMusteriler, raporlar:renderRaporlar, urunler:renderUrunler, kullanicilar:renderKullanicilar };

  /* ======================================================================
     GLOBAL HIZLI ARAMA  (tüm panel: talep · tedarikçi · ürün · sipariş · teklif · başvuru)
     ====================================================================== */
  let searchTimer = null;
  async function doGlobalSearch(q){
    const box = el("search-results"); if(!box) return;
    q = (q||"").trim();
    if(q.length < 2){ box.classList.add("hide"); box.innerHTML=""; return; }
    box.classList.remove("hide");
    box.innerHTML = `<div class="px-4 py-3 font-body-md text-on-surface-variant flex items-center gap-2"><span class="ms text-[18px] animate-spin">progress_activity</span> Aranıyor…</div>`;
    const [tl, td, sp, bv, tk, ms] = await Promise.all([
      fetchAll("talepler"), fetchAll("tedarikciler"), fetchAll("siparisler"), fetchAll("basvurular"), fetchAll("teklifler"), fetchAll("musteriler")
    ]);
    const ql = q.toLocaleLowerCase("tr");
    const hit = (...vals) => vals.some(v => v!=null && String(v).toLocaleLowerCase("tr").includes(ql));
    const R = [];
    tl.forEach(t=>{ if(!t.arsiv && hit(t.talep_no,t.musteri,t.iletisim_kisi,t.urun_kategori,t.spesifikasyon,t.notlar,t.durum,adFromId(t.atanan)))
      R.push({tab:"talepler",id:t.id,ikon:"assignment",renk:"bg-secondary-container text-on-secondary-container",tur:"Talep",
        baslik:(t.talep_no?("#"+t.talep_no+" · "):"")+(t.musteri||t.iletisim_kisi||"—"),alt:[t.urun_kategori,t.durum].filter(Boolean).join(" · ")}); });
    ms.forEach(m=>{ if(!m.arsiv && hit(m.firma,m.yetkili,m.telefon,m.eposta,m.vergi_no))
      R.push({tab:"musteriler",id:m.id,ikon:"groups",renk:"bg-secondary/15 text-secondary",tur:"Müşteri",
        baslik:m.firma||"—",alt:[m.yetkili,m.telefon].filter(Boolean).join(" · ")}); });
    td.forEach(x=>{ if(!x.arsiv && hit(x.firma,x.kategori,x.iletisim_kisi,x.telefon,x.eposta,x.notlar))
      R.push({tab:"tedarikciler",id:x.id,ikon:"inventory_2",renk:"bg-primary-fixed text-on-primary-fixed",tur:"Tedarikçi",
        baslik:x.firma||x.iletisim_kisi||"—",alt:[x.kategori,x.iletisim_kisi].filter(Boolean).join(" · ")}); });
    sp.forEach(o=>{ if(!o.arsiv && hit(o.siparis_no,o.musteri,o.tedarikci,o.urun,o.asama,o.musteri_odeme))
      R.push({tab:"siparisler",id:o.id,ikon:"local_shipping",renk:"bg-tertiary-fixed text-on-tertiary-fixed",tur:"Sipariş",
        baslik:(o.siparis_no?("#"+o.siparis_no+" · "):"")+(o.musteri||"—"),alt:[o.urun,o.asama].filter(Boolean).join(" · ")}); });
    tk.forEach(t=>{ if(hit(t.tedarikci_adi,t.vade,t.notlar))
      R.push({tab:"teklifler",id:t.talep_id,ikon:"request_quote",renk:"bg-secondary-container text-on-secondary-container",tur:"Teklif",
        baslik:t.tedarikci_adi||"Teklif",alt:[t.birim_fiyat!=null?fmtTL(t.birim_fiyat):null,t.vade].filter(Boolean).join(" · ")}); });
    bv.forEach(b=>{ if(hit(b.ad_soyad,b.firma,b.eposta,b.telefon,b.mesaj,b.tip,b.durum))
      R.push({tab:"webbasvuru",id:b.id,ikon:"web",renk:"bg-slate-200 text-slate-700",tur:"Başvuru · "+(b.tip||"?"),
        baslik:b.ad_soyad||b.firma||"—",alt:[(b.ad_soyad&&b.firma)?b.firma:null,b.eposta].filter(Boolean).join(" · ")}); });

    if(R.length===0){ box.innerHTML = `<div class="px-4 py-4 font-body-md text-on-surface-variant">“<b>${esc(q)}</b>” için panelde sonuç bulunamadı.</div>`; return; }
    box.innerHTML =
      `<div class="px-4 py-2 font-label-md text-[11px] uppercase tracking-wider text-on-surface-variant border-b border-outline-variant bg-surface-container-low sticky top-0">${R.length} sonuç</div>` +
      R.slice(0,40).map((r,i)=>`
        <button class="search-hit w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface-container-low transition border-b border-outline-variant/40" data-i="${i}">
          <div class="w-9 h-9 rounded-full ${r.renk} flex items-center justify-center shrink-0"><span class="ms text-[18px]">${r.ikon}</span></div>
          <div class="min-w-0 flex-1"><p class="font-body-md text-primary font-medium truncate">${esc(r.baslik)}</p>${r.alt?`<p class="text-[12px] text-on-surface-variant truncate">${esc(r.alt)}</p>`:""}</div>
          <span class="font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant shrink-0">${esc(r.tur)}</span>
        </button>`).join("") +
      (R.length>40?`<div class="px-4 py-2 text-[11px] text-on-surface-variant text-center">…ilk 40 sonuç gösteriliyor</div>`:"");
    $$(".search-hit", box).forEach(btn=>btn.addEventListener("click", ()=>{
      const r = R[Number(btn.dataset.i)]; if(!r) return;
      box.classList.add("hide"); const gi=el("global-search"); if(gi) gi.value="";
      if(r.tab==="teklifler") seciliTalepId = r.id;
      else if(r.tab==="webbasvuru") seciliBasvuruId = r.id;
      else pendingOpen = { tab:r.tab, id:r.id };
      switchTab(r.tab);
    }));
  }
  function wireSearch(){
    const gs = el("global-search"); const box = el("search-results"); if(!gs||!box) return;
    gs.addEventListener("input", ()=>{ const v=gs.value; clearTimeout(searchTimer); searchTimer=setTimeout(()=>doGlobalSearch(v), 280); });
    gs.addEventListener("focus", ()=>{ if(gs.value.trim().length>=2) doGlobalSearch(gs.value); });
    gs.addEventListener("keydown", (e)=>{ if(e.key==="Escape"){ box.classList.add("hide"); gs.blur(); } });
    document.addEventListener("click", (e)=>{ if(!box.contains(e.target) && e.target!==gs) box.classList.add("hide"); });
  }

  /* ======================================================================
     ORTAK: audit geçmişi, dosya ekleri, bildirim, arşiv, CSV
     ====================================================================== */
  async function logAktivite(kayit_tipi, kayit_id, islem, detay){
    try{ await sb.from("aktiviteler").insert({ kayit_tipi, kayit_id, islem, detay:detay||null, kullanici_ad: currentUser?currentUser.ad:null }); }catch(e){}
  }
  async function gecmisHTML(kayit_tipi, kayit_id){
    const { data } = await sb.from("aktiviteler").select("*").eq("kayit_tipi",kayit_tipi).eq("kayit_id",kayit_id).order("created_at",{ascending:false});
    if(!data||data.length===0) return '<p class="text-sm text-on-surface-variant">Geçmiş kaydı yok.</p>';
    return `<ol class="space-y-2">${data.map(a=>`<li class="flex gap-2 text-sm"><span class="ms text-[16px] text-secondary mt-0.5">history</span><div><span class="font-medium">${esc(a.islem)}</span>${a.detay?` · <span class="text-on-surface-variant">${esc(a.detay)}</span>`:''}<div class="text-[11px] text-on-surface-variant">${esc(a.kullanici_ad||adFromId(a.kullanici))} · ${fmtDate(a.created_at)} ${new Date(a.created_at).toLocaleTimeString("tr-TR",{hour:'2-digit',minute:'2-digit'})}</div></div></li>`).join("")}</ol>`;
  }
  async function renderEklerBox(tipi, id, mountId){
    const box = el(mountId); if(!box) return;
    box.innerHTML = `<p class="text-sm text-on-surface-variant">Ekler yükleniyor…</p>`;
    const { data, error } = await sb.from("ekler").select("*").eq("kayit_tipi",tipi).eq("kayit_id",id).order("created_at",{ascending:false});
    if(error){ box.innerHTML=`<p class="text-sm text-error">Ekler okunamadı (schema-v3 çalıştırıldı mı?).</p>`; return; }
    box.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <h4 class="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Ekler (${data.length})</h4>
        <label class="cursor-pointer text-secondary text-sm font-bold flex items-center gap-1 hover:underline"><span class="ms text-[18px]">upload_file</span> Dosya ekle<input type="file" id="ek-file-${id}" class="hidden"/></label>
      </div>
      <div class="space-y-1">${data.length===0?'<p class="text-sm text-on-surface-variant">Henüz dosya yok.</p>':data.map(f=>`
        <div class="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface-container-low">
          <button class="ek-ac flex items-center gap-2 min-w-0 text-left" data-yol="${esc(f.yol)}"><span class="ms text-[18px] text-secondary">description</span><span class="text-sm truncate">${esc(f.dosya_adi)}</span></button>
          <button class="ek-sil text-on-surface-variant hover:text-error shrink-0" data-id="${f.id}" data-yol="${esc(f.yol)}"><span class="ms text-[18px]">delete</span></button>
        </div>`).join("")}</div>`;
    const inp = el(`ek-file-${id}`);
    inp.addEventListener("change", async ()=>{ const file=inp.files[0]; if(!file) return;
      if(file.size > 25*1024*1024){ toast("Dosya 25MB'den küçük olmalı.", true); return; }
      const safe = file.name.replace(/[^\w.\-]+/g,"_");
      const yol = `${tipi}/${id}/${Date.now()}_${safe}`;
      toast("Yükleniyor…");
      const { error:upErr } = await sb.storage.from("ekler").upload(yol, file);
      if(upErr){ toast("Yüklenemedi: "+upErr.message, true); return; }
      const { error:insErr } = await sb.from("ekler").insert({ kayit_tipi:tipi, kayit_id:id, dosya_adi:file.name, yol, mime:file.type, boyut:file.size });
      if(insErr){ toast("Kayıt hatası: "+insErr.message, true); return; }
      toast("Dosya eklendi."); renderEklerBox(tipi,id,mountId);
    });
    $$(".ek-ac", box).forEach(b=>b.addEventListener("click", async ()=>{
      const { data:sig, error } = await sb.storage.from("ekler").createSignedUrl(b.dataset.yol, 3600);
      if(error||!sig){ toast("Dosya açılamadı.", true); return; } window.open(sig.signedUrl, "_blank");
    }));
    $$(".ek-sil", box).forEach(b=>b.addEventListener("click", async ()=>{ if(!confirm("Dosya silinsin mi?")) return;
      await sb.storage.from("ekler").remove([b.dataset.yol]); await sb.from("ekler").delete().eq("id", b.dataset.id); renderEklerBox(tipi,id,mountId);
    }));
  }
  async function arsivle(tablo, id, after){ if(!confirm("Bu kayıt arşivlensin mi? (Listeden gizlenir, silinmez)")) return;
    const { error } = await api.update(tablo, id, { arsiv:true }); if(error){ toast("İşlem başarısız: "+error.message, true); return; } toast("Arşivlendi."); after(); }
  function exportCSV(filename, rows){
    if(!rows || !rows.length){ toast("Aktarılacak veri yok.", true); return; }
    const cols = Object.keys(rows[0]);
    const q = v => '"'+String(v==null?"":v).replace(/"/g,'""')+'"';
    const csv = [cols.join(",")].concat(rows.map(r=>cols.map(c=>q(r[c])).join(","))).join("\n");
    const blob = new Blob(["﻿"+csv], {type:"text/csv;charset=utf-8;"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  }
  async function notifyAtama(atananId, mesaj){
    if(!atananId || (currentUser && atananId===currentUser.id)) return;
    try{ await sb.from("bildirimler").insert({ kullanici_id: atananId, tip:"atama", mesaj, link:"talepler" }); }catch(e){}
  }

  /* ---- Bildirimler ---- */
  let bildirimTimer = null; let bildirimListe = [];
  async function refreshBildirim(){
    if(!currentUser) return;
    const { data, error } = await sb.from("bildirimler").select("*").order("created_at",{ascending:false}).limit(30);
    if(error) return; bildirimListe = data||[];
    const okunmamis = bildirimListe.filter(b=>!b.okundu).length;
    const badge = el("bell-badge");
    if(badge){ if(okunmamis>0){ badge.textContent=okunmamis>9?"9+":okunmamis; badge.classList.remove("hide"); } else badge.classList.add("hide"); }
    paintBildirim();
  }
  function paintBildirim(){
    const p=el("bell-panel"); if(!p) return;
    p.innerHTML = `<div class="flex items-center justify-between px-4 py-3 border-b border-outline-variant sticky top-0 bg-white"><h4 class="font-bold text-primary">Bildirimler</h4>${bildirimListe.some(b=>!b.okundu)?'<button id="bell-hepsi" class="text-xs text-secondary font-bold hover:underline">Tümünü okundu yap</button>':''}</div>`+
      (bildirimListe.length===0?'<div class="px-4 py-6 text-sm text-on-surface-variant text-center">Bildirim yok.</div>':
      bildirimListe.map(b=>`<button class="bell-item w-full text-left px-4 py-3 flex gap-3 border-b border-outline-variant/40 hover:bg-surface-container-low ${b.okundu?'':'bg-secondary/5'}" data-id="${b.id}" data-link="${esc(b.link||'')}">
        <span class="ms text-[20px] ${b.okundu?'text-on-surface-variant':'text-secondary'}">${b.tip==='basvuru'?'web':b.tip==='atama'?'assignment_ind':'notifications'}</span>
        <div class="min-w-0"><p class="text-sm ${b.okundu?'text-on-surface-variant':'text-on-surface font-medium'}">${esc(b.mesaj)}</p><p class="text-[11px] text-on-surface-variant">${gecenSure(b.created_at)}</p></div>
      </button>`).join(""));
    const h=el("bell-hepsi"); if(h) h.addEventListener("click", async ()=>{ await sb.from("bildirimler").update({okundu:true}).eq("okundu",false); refreshBildirim(); });
    $$(".bell-item", p).forEach(it=>it.addEventListener("click", async ()=>{
      await sb.from("bildirimler").update({okundu:true}).eq("id", it.dataset.id);
      const link=it.dataset.link; el("bell-panel").classList.add("hide");
      if(link) switchTab(link); refreshBildirim();
    }));
  }

  /* ======================================================================
     7) MÜŞTERİLER (cari)
     ====================================================================== */
  async function renderMusteriler(){
    const host=el("panel-musteriler");
    host.innerHTML=`<p class="text-on-surface-variant">Yükleniyor…</p>`;
    const [musAll, talepler, sip] = await Promise.all([fetchAll("musteriler"),fetchAll("talepler"),fetchAll("siparisler")]);
    const mus=musAll.filter(m=>!m.arsiv);
    cache.musteriler=musAll; cache.talepler=talepler; cache.siparisler=sip;
    const ciroToplam=sip.reduce((a,s)=>a+(Number(s.satis)||0),0);
    const ay=new Date(),ayBasi=new Date(ay.getFullYear(),ay.getMonth(),1);
    const buAy=mus.filter(m=>new Date(m.created_at)>=ayBasi).length;
    const ciroOf=mid=>sip.filter(s=>s.musteri_id===mid).reduce((a,s)=>a+(Number(s.satis)||0),0);
    const talepOf=mid=>talepler.filter(t=>t.musteri_id===mid).length;
    host.innerHTML=`
      <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
        <div><h2 class="font-headline-lg text-headline-lg text-primary">Müşteriler (Cari)</h2>
          <p class="font-body-md text-on-surface-variant">Müşteri kartları, geçmiş talepleri ve toplam ciroları.</p></div>
        <div class="flex items-center gap-2 flex-wrap">
          <input id="mus-ara" placeholder="Ara…" class="bg-white border border-outline-variant rounded-lg px-4 py-2.5 text-body-md outline-none focus:ring-2 focus:ring-secondary/20"/>
          <button id="mus-csv" class="bg-surface border border-outline-variant text-on-surface-variant px-4 py-2.5 rounded-lg font-label-md text-label-md flex items-center gap-2 hover:bg-surface-container-low"><span class="ms text-[18px]">download</span> CSV</button>
          <button id="mus-yeni" class="bg-primary text-on-primary px-5 py-2.5 rounded-lg font-label-md text-label-md flex items-center gap-2 hover:brightness-125 shadow-md"><span class="ms">add</span> Yeni Müşteri</button>
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        ${statCard("groups","bg-secondary/10 text-secondary","Toplam Müşteri", fmtNum(mus.length))}
        ${statCard("person_add","bg-primary/10 text-primary","Bu Ay Eklenen", fmtNum(buAy))}
        ${statCard("payments","bg-green-50 text-green-600","Toplam Ciro (₺)", fmtTL(ciroToplam))}
      </div>
      <div class="glass-card rounded-xl overflow-hidden"><div class="tbl-wrap"><table class="w-full text-left border-collapse">
        <thead class="bg-surface-container-low border-b border-outline-variant"><tr>
          <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase">Firma</th>
          <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase">Yetkili</th>
          <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase">İletişim</th>
          <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase text-center">Talep</th>
          <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase text-right">Ciro</th>
          <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase text-right">Aksiyon</th></tr></thead>
        <tbody id="mus-tbody" class="divide-y divide-outline-variant">
          ${mus.length===0?`<tr><td colspan="6" class="px-6 py-6 text-on-surface-variant">Kayıt yok.</td></tr>`:
          mus.map(m=>`<tr class="hover:bg-surface-container-low transition-colors" data-s="${esc([m.firma,m.yetkili,m.telefon,m.eposta].filter(Boolean).join(' ').toLocaleLowerCase('tr'))}">
            <td class="px-6 py-4"><button class="mus-detay font-bold text-primary hover:underline text-left" data-id="${m.id}">${esc(m.firma)}</button>${m.vergi_no?`<div class="text-[11px] text-on-surface-variant">VKN: ${esc(m.vergi_no)}</div>`:''}</td>
            <td class="px-6 py-4 font-body-md">${esc(m.yetkili)||"—"}</td>
            <td class="px-6 py-4 text-on-surface-variant"><div class="text-[13px]">${esc(m.eposta)||""}</div><div class="text-[13px]">${esc(m.telefon)||""}</div></td>
            <td class="px-6 py-4 text-center font-body-md">${fmtNum(talepOf(m.id))}</td>
            <td class="px-6 py-4 text-right font-body-md font-bold text-primary">${fmtTL(ciroOf(m.id))}</td>
            <td class="px-6 py-4 text-right"><div class="flex justify-end gap-1">
              <button class="mus-edit p-1.5 text-on-surface-variant hover:text-primary" data-id="${m.id}"><span class="ms text-[20px]">edit</span></button>
              <button class="mus-ars p-1.5 text-on-surface-variant hover:text-amber-600" data-id="${m.id}" title="Arşivle"><span class="ms text-[20px]">archive</span></button>
              ${isAdmin()?`<button class="mus-sil p-1.5 text-on-surface-variant hover:text-error" data-id="${m.id}"><span class="ms text-[20px]">delete</span></button>`:""}
            </div></td></tr>`).join("")}
        </tbody></table></div></div>`;
    el("mus-ara").addEventListener("input", e=>{ const q=e.target.value.toLocaleLowerCase("tr"); $$("#mus-tbody tr").forEach(r=>{ if(r.dataset.s!=null) r.classList.toggle("hide", q && !r.dataset.s.includes(q)); }); });
    el("mus-yeni").addEventListener("click", ()=>musteriForm());
    el("mus-csv").addEventListener("click", ()=>exportCSV("musteriler.csv", mus.map(m=>({firma:m.firma,yetkili:m.yetkili,telefon:m.telefon,eposta:m.eposta,vergi_no:m.vergi_no,talep:talepOf(m.id),ciro:ciroOf(m.id)}))));
    $$(".mus-detay").forEach(b=>b.addEventListener("click", ()=>musteriDetay(mus.find(x=>x.id===b.dataset.id))));
    $$(".mus-edit").forEach(b=>b.addEventListener("click", ()=>musteriForm(mus.find(x=>x.id===b.dataset.id))));
    $$(".mus-ars").forEach(b=>b.addEventListener("click", ()=>arsivle("musteriler", b.dataset.id, renderMusteriler)));
    $$(".mus-sil").forEach(b=>b.addEventListener("click", ()=>silKayit("musteriler", b.dataset.id, renderMusteriler)));
    if(pendingOpen && pendingOpen.tab==="musteriler"){ const m=mus.find(x=>x.id===pendingOpen.id); pendingOpen=null; if(m) musteriDetay(m); }
  }
  function musteriForm(m){
    const d=m||{};
    openModal(m?"Müşteri Düzenle":"Yeni Müşteri", `<form id="mus-f" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      ${fInput("firma","Firma / Ünvan", d.firma,"text","required")}
      ${fInput("yetkili","Yetkili kişi", d.yetkili)}
      ${fInput("telefon","Telefon", d.telefon)}
      ${fInput("eposta","E-posta", d.eposta,"email")}
      ${fInput("vergi_no","Vergi / TC No", d.vergi_no)}
      ${fInput("adres","Adres", d.adres)}
      ${fArea("notlar","Not", d.notlar)}
      ${m?'<div class="sm:col-span-2 border-t border-outline-variant pt-4" id="mus-form-ekler"></div>':''}
      <div class="sm:col-span-2 flex justify-end gap-2 pt-2"><button type="button" id="mus-iptal" class="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant">İptal</button><button type="submit" class="px-4 py-2 rounded-lg bg-primary text-white">Kaydet</button></div>
    </form>`);
    if(m) renderEklerBox("musteri", m.id, "mus-form-ekler");
    el("mus-iptal").addEventListener("click", closeModal);
    el("mus-f").addEventListener("submit", async e=>{ e.preventDefault(); const row=formData(e.target);
      const res = m ? await api.update("musteriler", m.id, row) : await api.insert("musteriler", row);
      if(res.error){ toast("Kaydedilemedi: "+res.error.message, true); return; }
      logAktivite("musteri", (res.data&&res.data.id)||(m&&m.id), m?"güncellendi":"oluşturuldu", row.firma);
      closeModal(); toast("Kaydedildi."); renderMusteriler(); });
  }
  async function musteriDetay(m){
    if(!m) return;
    openModal("Müşteri · "+m.firma, `<div id="mus-detay-body"><p class="text-on-surface-variant">Yükleniyor…</p></div>`);
    const [tRes, sRes, oRes] = await Promise.all([
      sb.from("talepler").select("*").eq("musteri_id", m.id).order("created_at",{ascending:false}),
      sb.from("siparisler").select("*").eq("musteri_id", m.id).order("created_at",{ascending:false}),
      sb.from("odemeler").select("*").eq("yon","musteri")
    ]);
    const talepler=tRes.data||[], sip=sRes.data||[];
    const sipIds=new Set(sip.map(s=>s.id));
    const tahsil=(oRes.data||[]).filter(o=>sipIds.has(o.siparis_id)).reduce((a,o)=>a+(Number(o.tutar)||0),0);
    const ciro=sip.reduce((a,s)=>a+(Number(s.satis)||0),0);
    const kar=sip.reduce((a,s)=>a+(Number(s.kar)||0),0);
    const bakiye=ciro-tahsil;
    const body=el("mus-detay-body"); if(!body) return;
    body.innerHTML=`
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div class="p-3 rounded-lg bg-surface-container-low"><p class="text-[10px] uppercase font-bold text-on-surface-variant">Ciro</p><p class="font-bold text-primary">${fmtTL(ciro)}</p></div>
        <div class="p-3 rounded-lg bg-surface-container-low"><p class="text-[10px] uppercase font-bold text-on-surface-variant">Kâr</p><p class="font-bold text-secondary">${fmtTL(kar)}</p></div>
        <div class="p-3 rounded-lg bg-surface-container-low"><p class="text-[10px] uppercase font-bold text-on-surface-variant">Tahsilat</p><p class="font-bold text-green-600">${fmtTL(tahsil)}</p></div>
        <div class="p-3 rounded-lg ${bakiye>0?'bg-error-container/40':'bg-surface-container-low'}"><p class="text-[10px] uppercase font-bold text-on-surface-variant">Alacak</p><p class="font-bold ${bakiye>0?'text-error':'text-primary'}">${fmtTL(bakiye)}</p></div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5 text-sm">
        <div><span class="text-on-surface-variant">Yetkili:</span> ${esc(m.yetkili)||"—"}</div>
        <div><span class="text-on-surface-variant">Telefon:</span> ${esc(m.telefon)||"—"}</div>
        <div><span class="text-on-surface-variant">E-posta:</span> ${esc(m.eposta)||"—"}</div>
      </div>
      <h4 class="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant mb-2">Talepler (${talepler.length})</h4>
      <div class="border border-outline-variant rounded-lg divide-y divide-outline-variant mb-5 max-h-40 overflow-y-auto">
        ${talepler.length===0?'<p class="p-3 text-sm text-on-surface-variant">Talep yok.</p>':talepler.map(t=>`<div class="flex justify-between items-center p-2.5 text-sm"><span>${esc(t.talep_no)} · ${esc(t.urun_kategori)||"—"}</span>${pill(t.durum, DURUM_RENK[t.durum])}</div>`).join("")}
      </div>
      <h4 class="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant mb-2">Siparişler (${sip.length})</h4>
      <div class="border border-outline-variant rounded-lg divide-y divide-outline-variant mb-5 max-h-40 overflow-y-auto">
        ${sip.length===0?'<p class="p-3 text-sm text-on-surface-variant">Sipariş yok.</p>':sip.map(s=>`<div class="flex justify-between items-center p-2.5 text-sm"><span>${esc(s.siparis_no)} · ${esc(s.urun)||"—"}</span><span class="font-bold">${fmtTL(s.satis)}</span></div>`).join("")}
      </div>
      <div id="mus-ekler" class="border-t border-outline-variant pt-4"></div>`;
    renderEklerBox("musteri", m.id, "mus-ekler");
  }

  /* ======================================================================
     8) ÜRÜN KATALOĞU
     ====================================================================== */
  async function renderUrunler(){
    const host=el("panel-urunler");
    host.innerHTML=`<p class="text-on-surface-variant">Yükleniyor…</p>`;
    const ur=await fetchAll("urunler"); cache.urunler=ur;
    host.innerHTML=`
      <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
        <div><h2 class="font-headline-lg text-headline-lg text-primary">Ürün Kataloğu</h2><p class="font-body-md text-on-surface-variant">Sık alınan ürünler ve son alış/satış fiyatları — teklif verirken referans.</p></div>
        <button id="ur-yeni" class="bg-primary text-on-primary px-5 py-2.5 rounded-lg font-label-md text-label-md flex items-center gap-2 hover:brightness-125 shadow-md"><span class="ms">add</span> Yeni Ürün</button>
      </div>
      <div class="glass-card rounded-xl overflow-hidden"><div class="tbl-wrap"><table class="w-full text-left border-collapse">
        <thead class="bg-surface-container-low border-b border-outline-variant"><tr>
          <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase">Ürün</th>
          <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase">Kategori</th>
          <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase">Birim</th>
          <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase text-right">Son Alış</th>
          <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase text-right">Son Satış</th>
          <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase text-right">Aksiyon</th></tr></thead>
        <tbody class="divide-y divide-outline-variant">
          ${ur.length===0?`<tr><td colspan="6" class="px-6 py-6 text-on-surface-variant">Kayıt yok. İlk ürünü ekleyin.</td></tr>`:ur.map(u=>`<tr class="hover:bg-surface-container-low">
            <td class="px-6 py-4 font-bold text-primary">${esc(u.ad)}</td>
            <td class="px-6 py-4 font-body-md">${esc(u.kategori)||"—"}</td>
            <td class="px-6 py-4 font-body-md">${esc(u.birim)||"—"}</td>
            <td class="px-6 py-4 text-right font-body-md">${u.son_alis!=null?fmtTL(u.son_alis):"—"}</td>
            <td class="px-6 py-4 text-right font-body-md font-bold text-secondary">${u.son_satis!=null?fmtTL(u.son_satis):"—"}</td>
            <td class="px-6 py-4 text-right"><div class="flex justify-end gap-1"><button class="ur-edit p-1.5 text-on-surface-variant hover:text-primary" data-id="${u.id}"><span class="ms text-[20px]">edit</span></button>${isAdmin()?`<button class="ur-sil p-1.5 text-on-surface-variant hover:text-error" data-id="${u.id}"><span class="ms text-[20px]">delete</span></button>`:""}</div></td></tr>`).join("")}
        </tbody></table></div></div>`;
    el("ur-yeni").addEventListener("click", ()=>urunForm());
    $$(".ur-edit").forEach(b=>b.addEventListener("click", ()=>urunForm(ur.find(x=>x.id===b.dataset.id))));
    $$(".ur-sil").forEach(b=>b.addEventListener("click", ()=>silKayit("urunler", b.dataset.id, renderUrunler)));
  }
  function urunForm(u){
    const d=u||{};
    openModal(u?"Ürün Düzenle":"Yeni Ürün", `<form id="ur-f" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      ${fInput("ad","Ürün adı", d.ad,"text","required")}
      ${fSelect("kategori","Kategori", KATEGORILER, d.kategori||KATEGORILER[0])}
      ${fInput("birim","Birim (adet/kg/m…)", d.birim)}
      ${fInput("son_alis","Son alış (₺)", d.son_alis??"","number","min=0 step=any")}
      ${fInput("son_satis","Son satış (₺)", d.son_satis??"","number","min=0 step=any")}
      ${fArea("notlar","Not", d.notlar)}
      <div class="sm:col-span-2 flex justify-end gap-2 pt-2"><button type="button" id="ur-iptal" class="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant">İptal</button><button type="submit" class="px-4 py-2 rounded-lg bg-primary text-white">Kaydet</button></div>
    </form>`);
    el("ur-iptal").addEventListener("click", closeModal);
    el("ur-f").addEventListener("submit", async e=>{ e.preventDefault(); const row=formData(e.target);
      ["son_alis","son_satis"].forEach(k=>{ row[k]=row[k]==null?null:Number(row[k]); });
      const { error } = u ? await api.update("urunler", u.id, row) : await api.insert("urunler", row);
      if(error){ toast("Kaydedilemedi: "+error.message, true); return; } closeModal(); toast("Kaydedildi."); renderUrunler(); });
  }

  /* ======================================================================
     9) RAPORLAR & ANALİTİK
     ====================================================================== */
  let raporCharts=[];
  async function renderRaporlar(){
    const host=el("panel-raporlar");
    host.innerHTML=`<p class="text-on-surface-variant">Yükleniyor…</p>`;
    const [talepler, sip, teklifler] = await Promise.all([fetchAll("talepler"),fetchAll("siparisler"),fetchAll("teklifler")]);
    raporCharts.forEach(c=>{try{c.destroy();}catch(e){}}); raporCharts=[];
    const now=new Date(); const aylar=[];
    for(let i=5;i>=0;i--){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); aylar.push({key:d.getFullYear()+"-"+d.getMonth(), lbl:d.toLocaleDateString("tr-TR",{month:"short",year:"2-digit"}), ciro:0, kar:0}); }
    sip.forEach(s=>{ const d=new Date(s.created_at); const k=d.getFullYear()+"-"+d.getMonth(); const a=aylar.find(x=>x.key===k); if(a){ a.ciro+=Number(s.satis)||0; a.kar+=Number(s.kar)||0; } });
    const kazanildi=talepler.filter(t=>t.durum==="Kazanıldı").length;
    const kaybedildi=talepler.filter(t=>t.durum==="Kaybedildi").length;
    const acik=talepler.filter(t=>isOpen(t.durum)).length;
    const oran=(kazanildi+kaybedildi)?Math.round(kazanildi/(kazanildi+kaybedildi)*100):0;
    const tedSay={}; teklifler.filter(t=>t.secildi).forEach(t=>{ const k=t.tedarikci_adi||"—"; tedSay[k]=(tedSay[k]||0)+1; });
    const tedTop=Object.entries(tedSay).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const calSay={}; talepler.forEach(t=>{ const ad=adFromId(t.ekleyen); if(ad!=="—") calSay[ad]=(calSay[ad]||0)+1; });
    const calArr=Object.entries(calSay);
    host.innerHTML=`
      <div class="mb-6"><h2 class="font-headline-lg text-headline-lg text-primary">Raporlar & Analitik</h2><p class="font-body-md text-on-surface-variant">Ciro/kâr trendi, kazanma oranı ve ekip performansı.</p></div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        ${statCard("trending_up","bg-secondary/10 text-secondary","Kazanma Oranı", "%"+oran)}
        ${statCard("emoji_events","bg-green-50 text-green-600","Kazanılan", fmtNum(kazanildi))}
        ${statCard("cancel","bg-error-container/30 text-error","Kaybedilen", fmtNum(kaybedildi))}
        ${statCard("pending_actions","bg-primary/10 text-primary","Açık Talep", fmtNum(acik))}
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="glass-card rounded-xl p-6"><h3 class="font-headline-md text-headline-md text-primary mb-4">Aylık Ciro & Kâr</h3><canvas id="rap-ciro" height="150"></canvas></div>
        <div class="glass-card rounded-xl p-6"><h3 class="font-headline-md text-headline-md text-primary mb-4">Talep Sonuçları</h3><canvas id="rap-oran" height="150"></canvas></div>
        <div class="glass-card rounded-xl p-6"><h3 class="font-headline-md text-headline-md text-primary mb-4">En Çok Tercih Edilen Tedarikçiler</h3>${tedTop.length?`<canvas id="rap-ted" height="150"></canvas>`:'<p class="text-sm text-on-surface-variant py-8 text-center">Henüz seçilmiş teklif yok.</p>'}</div>
        <div class="glass-card rounded-xl p-6"><h3 class="font-headline-md text-headline-md text-primary mb-4">Çalışan Talep Sayısı</h3>${calArr.length?`<canvas id="rap-cal" height="150"></canvas>`:'<p class="text-sm text-on-surface-variant py-8 text-center">Veri yok.</p>'}</div>
      </div>`;
    raporCharts.push(new Chart(el("rap-ciro"),{type:"bar",data:{labels:aylar.map(a=>a.lbl),datasets:[{label:"Ciro",data:aylar.map(a=>Math.round(a.ciro)),backgroundColor:"#131d2e"},{label:"Kâr",data:aylar.map(a=>Math.round(a.kar)),backgroundColor:"#006a61"}]},options:{responsive:true,plugins:{legend:{position:"bottom"}},scales:{y:{beginAtZero:true}}}}));
    raporCharts.push(new Chart(el("rap-oran"),{type:"doughnut",data:{labels:["Kazanıldı","Kaybedildi","Açık"],datasets:[{data:[kazanildi,kaybedildi,acik],backgroundColor:["#16a34a","#ba1a1a","#f59e0b"]}]},options:{plugins:{legend:{position:"bottom"}}}}));
    if(tedTop.length) raporCharts.push(new Chart(el("rap-ted"),{type:"bar",data:{labels:tedTop.map(x=>x[0]),datasets:[{label:"Seçilen teklif",data:tedTop.map(x=>x[1]),backgroundColor:"#006a61"}]},options:{indexAxis:"y",plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{precision:0}}}}}));
    if(calArr.length) raporCharts.push(new Chart(el("rap-cal"),{type:"bar",data:{labels:calArr.map(x=>x[0]),datasets:[{label:"Talep",data:calArr.map(x=>x[1]),backgroundColor:"#131d2e"}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}}));
  }

  /* ======================================================================
     10) KULLANICILAR & ROLLER (yalnız yönetici)
     ====================================================================== */
  async function renderKullanicilar(){
    const host=el("panel-kullanicilar");
    if(!isAdmin()){ host.innerHTML=`<p class="text-error p-6">Bu bölüm yalnız yöneticilere açıktır.</p>`; return; }
    host.innerHTML=`<p class="text-on-surface-variant">Yükleniyor…</p>`;
    const { data:profs } = await sb.from("profiles").select("*").order("created_at",{ascending:true});
    host.innerHTML=`
      <div class="mb-6"><h2 class="font-headline-lg text-headline-lg text-primary">Kullanıcılar & Roller</h2>
        <p class="font-body-md text-on-surface-variant">Ekip üyelerinin rollerini yönetin. Yeni kullanıcı Supabase → Authentication'dan eklenir.</p></div>
      <div class="glass-card rounded-xl overflow-hidden"><div class="tbl-wrap"><table class="w-full text-left border-collapse">
        <thead class="bg-surface-container-low border-b border-outline-variant"><tr>
          <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase">Kullanıcı</th>
          <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase">E-posta</th>
          <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase">Rol</th>
          <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase text-right">İşlem</th></tr></thead>
        <tbody class="divide-y divide-outline-variant">
          ${(profs||[]).map(p=>`<tr class="hover:bg-surface-container-low">
            <td class="px-6 py-4"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-[11px] font-bold">${esc(initials(p.ad))}</div><span class="font-bold text-primary">${esc(p.ad)||"—"}</span>${p.id===currentUser.id?'<span class="text-[10px] px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">Siz</span>':''}</div></td>
            <td class="px-6 py-4 font-body-md text-on-surface-variant">${esc(p.email)||"—"}</td>
            <td class="px-6 py-4"><select class="kul-rol bg-white border border-outline-variant rounded-lg px-3 py-1.5 text-sm" data-id="${p.id}"><option value="calisan" ${p.rol==='calisan'?'selected':''}>Çalışan</option><option value="yonetici" ${p.rol==='yonetici'?'selected':''}>Yönetici</option></select></td>
            <td class="px-6 py-4 text-right">${p.email?`<button class="kul-sifre text-secondary text-sm font-bold hover:underline" data-email="${esc(p.email)}">Şifre sıfırlama maili</button>`:'<span class="text-xs text-on-surface-variant">e-posta yok</span>'}</td>
          </tr>`).join("")}
        </tbody></table></div></div>
      <p class="text-xs text-on-surface-variant mt-4">Not: Şifreyi doğrudan değiştirmek Supabase yönetici yetkisi gerektirir; buradan yalnızca kullanıcının e-postasına sıfırlama bağlantısı gönderebilirsiniz.</p>`;
    $$(".kul-rol").forEach(s=>s.addEventListener("change", async ()=>{
      const { error } = await sb.from("profiles").update({rol:s.value}).eq("id", s.dataset.id);
      if(error){ toast("Güncellenemedi: "+error.message, true); return; }
      if(s.dataset.id===currentUser.id){ currentUser.rol=s.value; $$(".admin-only").forEach(x=>x.classList.toggle("hide", !isAdmin())); }
      if(profilMap[s.dataset.id]) profilMap[s.dataset.id].rol=s.value; toast("Rol güncellendi.");
    }));
    $$(".kul-sifre").forEach(b=>b.addEventListener("click", async ()=>{ if(!confirm(b.dataset.email+" adresine şifre sıfırlama maili gönderilsin mi?")) return;
      const { error } = await sb.auth.resetPasswordForEmail(b.dataset.email);
      if(error){ toast("Gönderilemedi: "+error.message, true); return; } toast("Sıfırlama maili gönderildi."); }));
  }

  /* ======================================================================
     SİPARİŞ DETAY — ödeme/tahsilat hareketleri + ekler + geçmiş
     ====================================================================== */
  async function sipDetay(o){ if(!o) return; openModal("Sipariş · "+o.siparis_no, `<div id="sip-detay-body"><p class="text-on-surface-variant">Yükleniyor…</p></div>`); await paintSipDetay(o.id); }
  async function paintSipDetay(id){
    const { data:o } = await sb.from("siparisler").select("*").eq("id",id).single();
    const { data:odm } = await sb.from("odemeler").select("*").eq("siparis_id",id).order("tarih",{ascending:false});
    const body=el("sip-detay-body"); if(!body||!o) return;
    const list=odm||[];
    const tahMus=list.filter(x=>x.yon==="musteri").reduce((a,x)=>a+(Number(x.tutar)||0),0);
    const odTed=list.filter(x=>x.yon==="tedarikci").reduce((a,x)=>a+(Number(x.tutar)||0),0);
    const alacak=(Number(o.satis)||0)-tahMus; const borc=(Number(o.maliyet)||0)-odTed;
    body.innerHTML=`
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div class="p-3 rounded-lg bg-surface-container-low"><p class="text-[10px] uppercase font-bold text-on-surface-variant">Satış</p><p class="font-bold text-primary">${fmtTL(o.satis)}</p></div>
        <div class="p-3 rounded-lg bg-surface-container-low"><p class="text-[10px] uppercase font-bold text-on-surface-variant">Maliyet</p><p class="font-bold">${fmtTL(o.maliyet)}</p></div>
        <div class="p-3 rounded-lg ${alacak>0?'bg-error-container/40':'bg-green-50'}"><p class="text-[10px] uppercase font-bold text-on-surface-variant">Müşteriden Alacak</p><p class="font-bold ${alacak>0?'text-error':'text-green-600'}">${fmtTL(alacak)}</p></div>
        <div class="p-3 rounded-lg ${borc>0?'bg-amber-50':'bg-green-50'}"><p class="text-[10px] uppercase font-bold text-on-surface-variant">Tedarikçiye Borç</p><p class="font-bold ${borc>0?'text-amber-700':'text-green-600'}">${fmtTL(borc)}</p></div>
      </div>
      <div class="flex items-center justify-between mb-2"><h4 class="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Ödeme Hareketleri (${list.length})</h4>
        <button id="sip-odeme-ekle" class="text-secondary text-sm font-bold flex items-center gap-1 hover:underline"><span class="ms text-[18px]">add</span> Hareket ekle</button></div>
      <div class="border border-outline-variant rounded-lg divide-y divide-outline-variant mb-5 max-h-48 overflow-y-auto">
        ${list.length===0?'<p class="p-3 text-sm text-on-surface-variant">Kayıt yok.</p>':list.map(x=>`<div class="flex items-center justify-between p-2.5 text-sm gap-2">
          <div class="flex items-center gap-2"><span class="ms text-[18px] ${x.yon==='musteri'?'text-green-600':'text-amber-600'}">${x.yon==='musteri'?'south_west':'north_east'}</span><div><div class="font-medium">${x.yon==='musteri'?'Müşteriden tahsilat':'Tedarikçiye ödeme'}</div><div class="text-[11px] text-on-surface-variant">${fmtDate(x.tarih)}${x.yontem?' · '+esc(x.yontem):''}${x.notlar?' · '+esc(x.notlar):''}</div></div></div>
          <div class="flex items-center gap-2"><span class="font-bold ${x.yon==='musteri'?'text-green-600':'text-amber-700'}">${fmtTL(x.tutar)}</span><button class="odm-sil text-on-surface-variant hover:text-error" data-id="${x.id}"><span class="ms text-[18px]">delete</span></button></div>
        </div>`).join("")}
      </div>
      <div id="sip-ekler" class="border-t border-outline-variant pt-4 mb-4"></div>
      <div class="border-t border-outline-variant pt-4"><h4 class="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant mb-2">Geçmiş</h4><div id="sip-gecmis"></div></div>`;
    renderEklerBox("siparis", id, "sip-ekler");
    el("sip-gecmis").innerHTML = await gecmisHTML("siparis", id);
    el("sip-odeme-ekle").addEventListener("click", ()=>odemeForm(o));
    $$(".odm-sil").forEach(b=>b.addEventListener("click", async ()=>{ if(!confirm("Hareket silinsin mi?")) return; await api.remove("odemeler", b.dataset.id); paintSipDetay(id); }));
  }
  function odemeForm(o){
    openModal("Ödeme Hareketi — "+o.siparis_no, `<form id="odm-f" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      ${fSelect("yon","Yön", ["Müşteriden tahsilat","Tedarikçiye ödeme"], "Müşteriden tahsilat")}
      ${fInput("tutar","Tutar (₺)","","number","required min=0 step=any")}
      ${fInput("tarih","Tarih", new Date().toISOString().slice(0,10),"date")}
      ${fSelect("yontem","Yöntem", ODEME_YONTEM, ODEME_YONTEM[0])}
      ${fArea("notlar","Not","")}
      <div class="sm:col-span-2 flex justify-end gap-2 pt-2"><button type="button" id="odm-iptal" class="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant">İptal</button><button type="submit" class="px-4 py-2 rounded-lg bg-primary text-white">Kaydet</button></div>
    </form>`);
    el("odm-iptal").addEventListener("click", ()=>sipDetay(o));
    el("odm-f").addEventListener("submit", async e=>{ e.preventDefault(); const row=formData(e.target);
      const yon = row.yon==="Tedarikçiye ödeme" ? "tedarikci" : "musteri";
      const ins = { siparis_id:o.id, yon, tutar:Number(row.tutar)||0, tarih:row.tarih, yontem:row.yontem, notlar:row.notlar };
      const { error } = await api.insert("odemeler", ins);
      if(error){ toast("Kaydedilemedi: "+error.message, true); return; }
      logAktivite("siparis", o.id, "ödeme eklendi", (yon==='musteri'?'Tahsilat ':'Ödeme ')+fmtTL(ins.tutar));
      toast("Hareket eklendi."); sipDetay(o); });
  }

  /* ======================================================================
     PROFORMA çıktısı (yazdırılabilir)
     ====================================================================== */
  function proformaAc(talep, teklif){
    const adet=Number(talep.adet)||1;
    const birim = teklif && teklif.kar_marji!=null ? (Number(teklif.birim_fiyat)||0)*(1+Number(teklif.kar_marji)/100) : (teklif?Number(teklif.birim_fiyat)||0:0);
    const araToplam=birim*adet; const kdv=araToplam*0.20; const genel=araToplam+kdv;
    const w=window.open("","_blank","width=820,height=920"); if(!w){ toast("Açılır pencere engellendi.", true); return; }
    const bugun=new Date().toLocaleDateString("tr-TR");
    w.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Proforma ${esc(talep.talep_no)}</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;color:#131d2e;padding:40px;max-width:720px;margin:auto}h1{color:#131d2e;margin:0;letter-spacing:1px}.muted{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:10px;border-bottom:1px solid #e2e8f0;text-align:left}th{background:#f0f4f8;text-transform:uppercase;font-size:11px}.right{text-align:right}.tot{font-weight:bold;font-size:16px}.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #006a61;padding-bottom:16px}@media print{.noprint{display:none}}</style></head>
      <body><div class="hdr"><div><h1>BERZAN</h1><div class="muted">Kurumsal Tedarik Çözümleri</div></div>
      <div class="right"><div style="font-size:20px;font-weight:bold">PROFORMA</div><div class="muted">${esc(talep.talep_no)||""}</div><div class="muted">Tarih: ${bugun}</div></div></div>
      <div style="margin-top:20px"><strong>Müşteri:</strong> ${esc(talep.musteri)||"—"}${talep.iletisim_kisi?('<br>İlgili: '+esc(talep.iletisim_kisi)):''}</div>
      <table><thead><tr><th>Açıklama</th><th class="right">Adet</th><th class="right">Birim Fiyat</th><th class="right">Tutar</th></tr></thead>
      <tbody><tr><td>${esc(talep.urun_kategori)||"Ürün / Hizmet"}${talep.spesifikasyon?('<br><span style="color:#64748b;font-size:12px">'+esc(talep.spesifikasyon)+'</span>'):''}</td><td class="right">${fmtNum(adet)}</td><td class="right">${fmtTL(birim)}</td><td class="right">${fmtTL(araToplam)}</td></tr></tbody>
      <tfoot><tr><td colspan="3" class="right">Ara Toplam</td><td class="right">${fmtTL(araToplam)}</td></tr>
      <tr><td colspan="3" class="right">KDV %20</td><td class="right">${fmtTL(kdv)}</td></tr>
      <tr class="tot"><td colspan="3" class="right">GENEL TOPLAM</td><td class="right">${fmtTL(genel)}</td></tr></tfoot></table>
      <p class="muted" style="margin-top:24px;font-size:12px">Bu bir proforma teklifidir. Fiyatlar ${bugun} tarihi için geçerlidir.</p>
      <button class="noprint" onclick="window.print()" style="margin-top:20px;background:#006a61;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer">Yazdır / PDF</button>
      </body></html>`);
    w.document.close();
  }

  /* ---- Başlatma ---- */
  function init(){
    el("login-form").addEventListener("submit", doLogin);
    el("logout-btn").addEventListener("click", doLogout);
    $$(".tab-btn").forEach(b=>b.addEventListener("click", ()=>switchTab(b.dataset.tab)));
    const st=el("sidebar-toggle"); if(st) st.addEventListener("click", openSidebar);
    const so=el("sidebar-overlay"); if(so) so.addEventListener("click", closeSidebar);
    const ty=el("topbar-yeni"); if(ty) ty.addEventListener("click", ()=>{ switchTab("talepler"); talepForm(); });
    const bb=el("bell-btn"); const bp=el("bell-panel");
    if(bb&&bp){ bb.addEventListener("click", (e)=>{ e.stopPropagation(); bp.classList.toggle("hide"); if(!bp.classList.contains("hide")) refreshBildirim(); });
      document.addEventListener("click", (e)=>{ if(!bp.contains(e.target) && e.target!==bb && !bb.contains(e.target)) bp.classList.add("hide"); }); }
    wireSearch();
    if(!configured){ el("config-warn").classList.remove("hide"); return; }
    sb.auth.getSession().then(({data})=>{ if(data.session) onAuthed(); });
  }

  /* statCard yardımcı (Tedarikçiler) */
  function statCard(ikon, renkChip, etiket, deger){
    return `<div class="bg-white p-6 rounded-xl border border-outline-variant shadow-ambient flex items-center gap-4">
      <div class="w-12 h-12 rounded-full ${renkChip} flex items-center justify-center shrink-0"><span class="ms">${ikon}</span></div>
      <div class="min-w-0"><p class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">${etiket}</p>
      <p class="font-stat-number text-stat-number text-primary">${deger}</p></div></div>`;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
