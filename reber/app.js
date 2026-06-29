/* ==========================================================================
   BERZAN İç Yönetim Paneli — Uygulama Mantığı
   - Supabase Auth (kullanıcı adı + şifre), 30 dk işlemsizlikte otomatik çıkış
   - 5 modül: Gösterge, Talepler, Tedarikçiler, Teklif & Fiyat, Siparişler
   - Tüm veri RLS arkasında: giriş yapılmadan hiçbir kayıt görünmez/yazılamaz
   ========================================================================== */

(function () {
  "use strict";

  const CFG = window.REBER_CONFIG || {};
  const configured =
    CFG.SUPABASE_URL && CFG.SUPABASE_URL.startsWith("http") &&
    CFG.SUPABASE_ANON_KEY && CFG.SUPABASE_ANON_KEY.length > 20;

  let sb = null;
  if (configured) {
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }

  /* --------------------------- Oturum & roller (Faz 2) --------------------------- */
  let currentUser = null;      // {id, email, ad, rol}
  let profilMap = {};          // id -> {ad, rol}
  const isAdmin = () => !!(currentUser && currentUser.rol === "yonetici");
  const adFromId = (id) => (id && profilMap[id]) ? profilMap[id].ad : "—";
  const PIPELINE = ["Yeni","Fiyat Bekleniyor","Teklif Sunuldu","Takipte","Kazanıldı"];
  const nextDurum = (d) => { const i = PIPELINE.indexOf(d); return (i >= 0 && i < PIPELINE.length - 1) ? PIPELINE[i+1] : null; };
  const nextAsama = (a) => { const i = ASAMALAR.indexOf(a); return (i >= 0 && i < ASAMALAR.length - 1) ? ASAMALAR[i+1] : null; };
  const BASVURU_DURUM_RENK = { "Yeni":"bg-amber-100 text-amber-800", "İşlendi":"bg-emerald-100 text-emerald-800", "Kapandı":"bg-slate-100 text-slate-600" };
  let talepBenim = false;      // "Benim işlerim" filtresi

  /* --------------------------- Sabitler --------------------------- */
  const DURUMLAR = ["Yeni","Fiyat Bekleniyor","Teklif Sunuldu","Takipte","Kazanıldı","Kaybedildi"];
  const KAYIP_NEDENLERI = ["İletişim","Fiyat","Zamanlama","Diğer"];
  const KATEGORILER = ["Matbaa/Kağıt","İş Kıyafeti/Atölye","Promosyon","Ambalaj/Poşet","İş Güvenliği-KKD","Diğer"];
  const ASAMALAR = ["Sipariş verildi","Üretimde","Kalite kontrol","Sevkiyatta","Teslim edildi"];
  const ODEME_DURUM = ["Bekliyor","Kısmi","Ödendi"];

  const DURUM_RENK = {
    "Yeni":"bg-slate-100 text-slate-700",
    "Fiyat Bekleniyor":"bg-amber-100 text-amber-800",
    "Teklif Sunuldu":"bg-blue-100 text-blue-800",
    "Takipte":"bg-indigo-100 text-indigo-800",
    "Kazanıldı":"bg-emerald-100 text-emerald-800",
    "Kaybedildi":"bg-red-100 text-red-700",
  };
  const ASAMA_RENK = {
    "Sipariş verildi":"bg-slate-100 text-slate-700",
    "Üretimde":"bg-amber-100 text-amber-800",
    "Kalite kontrol":"bg-blue-100 text-blue-800",
    "Sevkiyatta":"bg-indigo-100 text-indigo-800",
    "Teslim edildi":"bg-emerald-100 text-emerald-800",
  };
  const ODEME_RENK = { "Bekliyor":"bg-red-100 text-red-700","Kısmi":"bg-amber-100 text-amber-800","Ödendi":"bg-emerald-100 text-emerald-800" };

  /* --------------------------- Yardımcılar --------------------------- */
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const el = (id) => document.getElementById(id);
  const esc = (s) => (s==null?"":String(s)).replace(/[&<>"']/g, c => (
    {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  const fmtTL = (n) => (n==null||isNaN(n)) ? "—" :
    new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:2}).format(Number(n));
  const fmtNum = (n) => (n==null||isNaN(n)) ? "—" : new Intl.NumberFormat("tr-TR").format(Number(n));
  const fmtDate = (d) => { if(!d) return "—"; const x=new Date(d); return isNaN(x)?"—":x.toLocaleDateString("tr-TR"); };
  const today0 = () => { const t=new Date(); t.setHours(0,0,0,0); return t; };
  const isDue = (d) => { if(!d) return false; const x=new Date(d); x.setHours(0,0,0,0); return x<=today0(); };
  const isOpen = (durum) => durum!=="Kazanıldı" && durum!=="Kaybedildi";
  const yildiz = (k) => k ? "★".repeat(k)+"☆".repeat(5-k) : "—";

  /* --- Stitch görsel yardımcıları --- */
  const pill = (t, cls) => `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${cls||"bg-slate-100 text-slate-700"}">${esc(t)}</span>`;
  function atananHTML(id){
    const ad = adFromId(id);
    if(!id || ad==="—") return '<span class="text-on-surface-variant/50">—</span>';
    const benim = currentUser && id===currentUser.id;
    const ini = (ad||"").trim().slice(0,2).toLocaleUpperCase("tr");
    return `<div class="flex items-center gap-2"><div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${benim?'bg-secondary text-white':'bg-surface-container-high text-on-surface'}">${benim?'BEN':esc(ini)}</div><span class="text-xs ${benim?'font-semibold text-primary':''}">${esc(ad)}</span></div>`;
  }
  function statCard(ikon, renkChip, etiket, deger, altHTML){
    return `<div class="glass-card rounded-xl p-5">
      <div class="flex items-center gap-3 mb-3"><span class="w-10 h-10 rounded-full ${renkChip} flex items-center justify-center"><span class="ms">${ikon}</span></span>
        <span class="text-on-surface-variant text-sm">${etiket}</span></div>
      <div class="text-2xl font-bold text-primary">${deger}</div>
      ${altHTML?`<div class="text-[11px] mt-1">${altHTML}</div>`:""}
    </div>`;
  }
  const sayfaBaslik = (baslik, alt) => `<div class="mb-6"><h2 class="text-2xl font-bold text-primary">${baslik}</h2><p class="text-on-surface-variant text-sm">${alt}</p></div>`;

  function toast(msg, hata=false){
    const t = el("toast");
    t.textContent = msg;
    t.className = "fixed bottom-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm text-white " + (hata?"bg-red-600":"bg-navy");
    t.classList.remove("hide");
    clearTimeout(t._t); t._t = setTimeout(()=>t.classList.add("hide"), 3200);
  }

  /* --------------------------- Modal --------------------------- */
  function openModal(title, bodyHTML){
    el("modal-title").textContent = title;
    el("modal-body").innerHTML = bodyHTML;
    el("modal").classList.remove("hide");
  }
  function closeModal(){ el("modal").classList.add("hide"); el("modal-body").innerHTML=""; }
  el("modal-close").addEventListener("click", closeModal);
  el("modal").addEventListener("click", (e)=>{ if(e.target.id==="modal") closeModal(); });

  // form alanı üreticileri
  const fInput = (name,label,val="",type="text",extra="") =>
    `<div><label class="block text-sm font-medium text-slate-700 mb-1">${label}</label>
     <input name="${name}" type="${type}" value="${esc(val)}" ${extra}
       class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal"/></div>`;
  const fArea = (name,label,val="") =>
    `<div class="sm:col-span-2"><label class="block text-sm font-medium text-slate-700 mb-1">${label}</label>
     <textarea name="${name}" rows="2"
       class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal">${esc(val)}</textarea></div>`;
  const fSelect = (name,label,opts,val="") =>
    `<div><label class="block text-sm font-medium text-slate-700 mb-1">${label}</label>
     <select name="${name}" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal">
       ${opts.map(o=>`<option value="${esc(o)}" ${String(o)===String(val)?"selected":""}>${esc(o)}</option>`).join("")}
     </select></div>`;
  const formData = (form) => { const o={}; new FormData(form).forEach((v,k)=>o[k]= v===""?null:v); return o; };

  /* ======================================================================
     KİMLİK DOĞRULAMA
     ====================================================================== */
  async function doLogin(e){
    e.preventDefault();
    const err = el("login-error"); err.classList.add("hide");
    if(!configured){ el("config-warn").classList.remove("hide"); return; }
    const user = el("login-user").value.trim();
    const pass = el("login-pass").value;
    const email = user.includes("@") ? user : user + (CFG.USERNAME_DOMAIN||"@reber.berzan.local");
    el("login-btn-text").textContent = "Giriş yapılıyor…";
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    el("login-btn-text").textContent = "Giriş Yap";
    if(error){ err.textContent = "Kullanıcı adı veya şifre hatalı."; err.classList.remove("hide"); return; }
    await onAuthed();
  }

  async function doLogout(){
    if(sb) await sb.auth.signOut();
    stopInactivity();
    el("app-view").classList.add("hide");
    el("login-view").classList.remove("hide");
    el("login-pass").value = "";
  }

  async function onAuthed(){
    const { data:{ user } } = await sb.auth.getUser();
    // profilleri çek (rol + isimler)
    profilMap = {};
    const { data: profs } = await sb.from("profiles").select("*");
    (profs||[]).forEach(p => profilMap[p.id] = { ad: p.ad || "—", rol: p.rol });
    const me = (profs||[]).find(p => p.id === user.id);
    currentUser = {
      id: user.id, email: user.email,
      ad: me ? (me.ad || (user.email||"").split("@")[0]) : (user.email||"").split("@")[0],
      rol: me ? me.rol : "calisan"
    };
    el("current-user").textContent = currentUser.ad + " · " + (isAdmin() ? "Yönetici" : "Çalışan");
    el("login-view").classList.add("hide");
    el("app-view").classList.remove("hide");
    startInactivity();
    switchTab("dashboard");
  }

  /* ---- İşlemsizlik zamanlayıcı (otomatik çıkış) ---- */
  let inacTimer = null;
  const INAC_MS = (Number(CFG.INACTIVITY_MINUTES)||30) * 60 * 1000;
  function resetInactivity(){ if(inacTimer) clearTimeout(inacTimer);
    inacTimer = setTimeout(async ()=>{ await doLogout(); toast("Oturum işlemsizlik nedeniyle kapatıldı.", true); }, INAC_MS); }
  function startInactivity(){ ["click","keydown","mousemove","touchstart"].forEach(ev=>
    document.addEventListener(ev, resetInactivity, {passive:true})); resetInactivity(); }
  function stopInactivity(){ if(inacTimer) clearTimeout(inacTimer);
    ["click","keydown","mousemove","touchstart"].forEach(ev=>document.removeEventListener(ev, resetInactivity)); }

  /* ======================================================================
     VERİ KATMANI
     ====================================================================== */
  const api = {
    list: (t, order="created_at") => sb.from(t).select("*").order(order, {ascending:false}),
    insert: (t, row) => sb.from(t).insert(row).select().single(),
    update: (t, id, row) => sb.from(t).update(row).eq("id", id).select().single(),
    remove: (t, id) => sb.from(t).delete().eq("id", id),
  };
  async function fetchAll(t, order){ const {data,error}=await api.list(t,order); if(error){toast("Veri okunamadı: "+error.message,true); return [];} return data||[]; }

  /* ======================================================================
     SEKME YÖNETİMİ
     ====================================================================== */
  let cache = { talepler:[], tedarikciler:[], teklifler:[], siparisler:[] };

  function switchTab(tab){
    $$(".tab-btn").forEach(b=>{
      const on = b.dataset.tab===tab;
      b.classList.toggle("border-secondary", on);
      b.classList.toggle("border-transparent", !on);
      b.classList.toggle("text-on-primary", on);
      b.classList.toggle("bg-white/5", on);
      b.classList.toggle("text-on-primary/70", !on);
    });
    $$(".panel").forEach(p=>p.classList.add("hide"));
    el("panel-"+tab).classList.remove("hide");
    closeSidebar();
    renderers[tab]();
  }
  function openSidebar(){ const s=el("sidebar"); if(s){ s.classList.remove("-translate-x-full"); } const o=el("sidebar-overlay"); if(o) o.classList.remove("hide"); }
  function closeSidebar(){ const s=el("sidebar"); if(s){ s.classList.add("-translate-x-full"); } const o=el("sidebar-overlay"); if(o) o.classList.add("hide"); }

  /* ======================================================================
     1) GÖSTERGE PANELİ
     ====================================================================== */
  async function renderDashboard(){
    const host = el("panel-dashboard");
    host.innerHTML = `<p class="text-slate-400">Yükleniyor…</p>`;
    const [talepler, siparisler, basvurular] = await Promise.all([fetchAll("talepler"), fetchAll("siparisler"), fetchAll("basvurular")]);
    cache.talepler = talepler; cache.siparisler = siparisler;

    const acik = talepler.filter(t=>isOpen(t.durum)).length;
    const ay = new Date(); const ayBasi = new Date(ay.getFullYear(), ay.getMonth(), 1);
    const buAyKazanilan = talepler.filter(t=>t.durum==="Kazanıldı" && new Date(t.updated_at||t.created_at)>=ayBasi).length;
    const toplamKar = siparisler.reduce((s,o)=>s+(Number(o.kar)||0),0);
    const odemeBekleyen = siparisler.filter(o=>o.musteri_odeme!=="Ödendi").reduce((s,o)=>s+(Number(o.satis)||0),0);
    const vadesiGelen = talepler.filter(t=>isOpen(t.durum) && isDue(t.sonraki_adim_tarihi));
    const banaAtanan = currentUser ? talepler.filter(t=>isOpen(t.durum) && t.atanan===currentUser.id).length : 0;
    const yeniBasvuru = basvurular.filter(b=>b.durum==="Yeni").length;

    const card = (renk,ikon,etiket,deger) => `
      <div class="glass-card rounded-xl p-5 shadow-sm">
        <div class="flex items-center gap-3">
          <span class="w-10 h-10 rounded-xl ${renk} flex items-center justify-center"><span class="ms">${ikon}</span></span>
          <div><div class="text-2xl font-bold text-primary">${deger}</div>
          <div class="text-sm text-slate-500">${etiket}</div></div>
        </div>
      </div>`;

    host.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        ${card("bg-blue-100 text-blue-700","inbox","Açık talep", fmtNum(acik))}
        ${card("bg-teal-100 text-teal-700","assignment_ind","Bana atanan açık", fmtNum(banaAtanan))}
        ${card("bg-emerald-100 text-emerald-700","emoji_events","Bu ay kazanılan", fmtNum(buAyKazanilan))}
        ${card("bg-teal-100 text-teal-700","payments","Toplam kâr", fmtTL(toplamKar))}
        ${card("bg-amber-100 text-amber-700","schedule","Ödeme bekleyen", fmtTL(odemeBekleyen))}
        ${card("bg-indigo-100 text-indigo-700","mark_email_unread","Yeni web başvurusu", fmtNum(yeniBasvuru))}
      </div>
      <div class="glass-card rounded-xl shadow-sm">
        <div class="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
          <span class="ms text-amber-600">notification_important</span>
          <h3 class="font-semibold text-primary">Sonraki adım tarihi gelmiş talepler</h3>
          <span class="ml-auto text-sm text-slate-500">${vadesiGelen.length} kayıt</span>
        </div>
        <div class="tbl-wrap">
        ${vadesiGelen.length===0 ? `<p class="p-5 text-slate-400 text-sm">Bekleyen adım yok. 👍</p>` : `
          <table class="tbl w-full text-sm">
            <thead class="bg-surface-container-low text-on-surface-variant uppercase text-[11px] text-left">
              <tr><th class="px-4 py-2">Talep No</th><th class="px-4 py-2">Müşteri</th>
                  <th class="px-4 py-2">Sonraki adım</th><th class="px-4 py-2">Tarih</th><th class="px-4 py-2">Durum</th></tr>
            </thead>
            <tbody>${vadesiGelen.map(t=>`
              <tr class="border-t border-slate-100 bg-amber-50/60">
                <td class="px-4 py-2 font-medium">${esc(t.talep_no)}</td>
                <td class="px-4 py-2">${esc(t.musteri)}</td>
                <td class="px-4 py-2">${esc(t.sonraki_adim)||"—"}</td>
                <td class="px-4 py-2 text-red-600 font-medium">${fmtDate(t.sonraki_adim_tarihi)}</td>
                <td class="px-4 py-2"><span class="px-2 py-0.5 rounded text-xs ${DURUM_RENK[t.durum]||""}">${esc(t.durum)}</span></td>
              </tr>`).join("")}</tbody>
          </table>`}
        </div>
      </div>`;
  }

  /* ======================================================================
     2) TALEP TAKİP
     ====================================================================== */
  async function renderTalepler(){
    const host = el("panel-talepler");
    host.innerHTML = `<p class="text-slate-400">Yükleniyor…</p>`;
    const talepler = await fetchAll("talepler"); cache.talepler = talepler;

    // kayıp nedenleri sayımı
    const kayipSay = {}; KAYIP_NEDENLERI.forEach(k=>kayipSay[k]=0);
    talepler.filter(t=>t.durum==="Kaybedildi" && t.kayip_nedeni).forEach(t=>kayipSay[t.kayip_nedeni]++);
    const kayipVar = Object.values(kayipSay).some(v=>v>0);

    const liste = (talepBenim && currentUser) ? talepler.filter(t=>t.atanan===currentUser.id) : talepler;

    host.innerHTML = `
      <div class="flex flex-wrap items-center gap-3 mb-6">
        <div><h2 class="text-2xl font-bold text-primary">Talep Takip Havuzu</h2>
          <p class="text-on-surface-variant text-sm">Tüm aktif talepler; atanan kişi ve süreç durumu.</p></div>
        <button id="benim-isler" class="ml-auto px-4 py-2 rounded-lg text-sm border flex items-center gap-1 ${talepBenim?'bg-primary text-white border-primary':'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'}">
          <span class="ms text-base">assignment_ind</span> Benim işlerim</button>
        <button id="yeni-talep" class="bg-secondary hover:brightness-110 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1">
          <span class="ms text-base">add</span> Yeni Talep</button>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 glass-card rounded-xl overflow-hidden tbl-wrap">
          <table class="tbl w-full text-sm text-left">
            <thead class="bg-surface-container-low text-on-surface-variant uppercase text-[11px]">
              <tr><th class="px-4 py-3">Talep No</th><th class="px-4 py-3">Müşteri</th>
                <th class="px-4 py-3">Ürün (Adet)</th><th class="px-4 py-3">Durum</th>
                <th class="px-4 py-3">Atanan</th><th class="px-4 py-3">Sonraki adım</th>
                <th class="px-4 py-3 text-right">Aksiyonlar</th></tr>
            </thead>
            <tbody id="talep-rows"></tbody>
          </table>
          ${liste.length===0?`<p class="p-5 text-on-surface-variant text-sm">Kayıt yok.</p>`:""}
        </div>
        <div class="glass-card rounded-xl p-5 h-fit">
          <h3 class="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-4">Kayıp Nedenleri</h3>
          ${kayipVar?`<canvas id="kayip-chart" height="220"></canvas>`:`<p class="text-on-surface-variant text-sm">Henüz kayıp kaydı yok.</p>`}
        </div>
      </div>`;

    const tb = el("talep-rows");
    tb.innerHTML = liste.map(t=>{
      const due = isOpen(t.durum) && isDue(t.sonraki_adim_tarihi);
      const benim = currentUser && t.atanan===currentUser.id;
      const ileri = isOpen(t.durum) ? nextDurum(t.durum) : null;
      return `<tr class="border-t border-outline-variant/60 hover:bg-surface-container-low ${benim?"bg-secondary/5":due?"bg-amber-50/60":""}">
        <td class="px-4 py-3"><div class="font-bold text-primary">${esc(t.talep_no)}</div>
          <div class="text-[11px] text-on-surface-variant">${fmtDate(t.tarih)} · ${esc(adFromId(t.ekleyen))}</div></td>
        <td class="px-4 py-3 font-medium">${esc(t.musteri)}</td>
        <td class="px-4 py-3">${esc(t.urun_kategori)||"—"} <span class="text-on-surface-variant">(${fmtNum(t.adet)})</span></td>
        <td class="px-4 py-3">${pill((t.durum||"").toLocaleUpperCase("tr"), DURUM_RENK[t.durum])}</td>
        <td class="px-4 py-3">${atananHTML(t.atanan)}</td>
        <td class="px-4 py-3">${due?`<span class="ms text-amber-600 text-base align-middle">warning</span> `:""}${esc(t.sonraki_adim)||"—"}
            <div class="text-[11px] ${due?"text-red-600 font-medium":"text-on-surface-variant"}">${fmtDate(t.sonraki_adim_tarihi)}</div></td>
        <td class="px-4 py-3 text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-1.5">
          ${ileri?`<button class="ileri-al bg-secondary text-white text-[11px] font-bold px-3 py-1.5 rounded inline-flex items-center gap-1 hover:brightness-110" data-id="${t.id}" title="Sonraki aşamaya al">İleri Al <span class="ms text-[14px]">arrow_forward</span></button>`:""}
          ${isOpen(t.durum)?`<button class="kaybet p-1.5 text-on-surface-variant hover:text-red-600" data-id="${t.id}" title="Kaybedildi"><span class="ms text-[20px]">cancel</span></button>`:""}
          <button class="duzenle p-1.5 text-on-surface-variant hover:text-primary" data-id="${t.id}" title="Düzenle"><span class="ms text-[20px]">edit</span></button>
          ${isAdmin()?`<button class="sil p-1.5 text-on-surface-variant hover:text-red-600" data-id="${t.id}" title="Sil"><span class="ms text-[20px]">delete</span></button>`:""}
          </div>
        </td></tr>`;
    }).join("");

    el("benim-isler").addEventListener("click", ()=>{ talepBenim=!talepBenim; renderTalepler(); });
    el("yeni-talep").addEventListener("click", ()=>talepForm());
    $$(".duzenle", tb).forEach(b=>b.addEventListener("click", ()=>talepForm(talepler.find(x=>x.id===b.dataset.id))));
    $$(".sil", tb).forEach(b=>b.addEventListener("click", ()=>silKayit("talepler", b.dataset.id, renderTalepler)));
    $$(".ileri-al", tb).forEach(b=>b.addEventListener("click", ()=>ileriAlTalep(talepler.find(x=>x.id===b.dataset.id))));
    $$(".kaybet", tb).forEach(b=>b.addEventListener("click", ()=>kaybetTalep(b.dataset.id)));

    if(kayipVar){
      new Chart(el("kayip-chart"), {
        type:"doughnut",
        data:{ labels:Object.keys(kayipSay), datasets:[{ data:Object.values(kayipSay),
          backgroundColor:["#0d9488","#f59e0b","#6366f1","#94a3b8"] }] },
        options:{ plugins:{ legend:{ position:"bottom" } } }
      });
    }
  }

  async function ileriAlTalep(t){
    if(!t) return;
    const next = nextDurum(t.durum); if(!next) return;
    const { error } = await api.update("talepler", t.id, { durum: next });
    if(error){ toast("Güncellenemedi: "+error.message, true); return; }
    toast(next==="Kazanıldı" ? "Kazanıldı → Sipariş Takibi'ne taşındı." : "Durum: "+next);
    renderTalepler();
  }

  function kaybetTalep(id){
    openModal("Talebi Kaybet", `
      <form id="kaybet-f" class="space-y-3">
        <p class="text-sm text-slate-600">Bu talep neden kaybedildi?</p>
        ${fSelect("kayip_nedeni","Kayıp nedeni", KAYIP_NEDENLERI, KAYIP_NEDENLERI[0])}
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="iptalK" class="px-4 py-2 rounded-lg border border-slate-300 text-slate-600">İptal</button>
          <button type="submit" class="px-4 py-2 rounded-lg bg-red-600 text-white">Kaybedildi işaretle</button>
        </div>
      </form>`);
    el("iptalK").addEventListener("click", closeModal);
    el("kaybet-f").addEventListener("submit", async (e)=>{
      e.preventDefault();
      const row = formData(e.target);
      const { error } = await api.update("talepler", id, { durum:"Kaybedildi", kayip_nedeni: row.kayip_nedeni });
      if(error){ toast("Güncellenemedi: "+error.message, true); return; }
      closeModal(); toast("Talep kaybedildi olarak işaretlendi."); renderTalepler();
    });
  }

  function talepForm(t){
    const d = t||{};
    openModal(t?"Talep Düzenle":"Yeni Talep", `
      <form id="talep-f" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${fInput("tarih","Tarih", d.tarih||new Date().toISOString().slice(0,10),"date")}
        ${fInput("musteri","Müşteri", d.musteri,"text","required")}
        ${fInput("iletisim_kisi","İletişim kişisi", d.iletisim_kisi)}
        ${fInput("urun_kategori","Ürün / kategori", d.urun_kategori)}
        ${fInput("adet","Adet", d.adet??1,"number","min=0 step=1")}
        ${fInput("istenen_teslim","İstenen teslim", d.istenen_teslim,"date")}
        ${fArea("spesifikasyon","Spesifikasyon", d.spesifikasyon)}
        ${fSelect("durum","Durum", DURUMLAR, d.durum||"Yeni")}
        <div><label class="block text-sm font-medium text-slate-700 mb-1">Atanan kişi</label>
          <select name="atanan" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal">
            <option value="">— Atanmadı —</option>
            ${Object.entries(profilMap).map(([id,p])=>`<option value="${id}" ${id===(d.atanan||"")?"selected":""}>${esc(p.ad)}</option>`).join("")}
          </select></div>
        ${fInput("sonraki_adim","Sonraki adım", d.sonraki_adim)}
        ${fInput("sonraki_adim_tarihi","Sonraki adım tarihi", d.sonraki_adim_tarihi,"date")}
        ${fSelect("kayip_nedeni","Kayıp nedeni (kaybedildiyse)", ["", ...KAYIP_NEDENLERI], d.kayip_nedeni||"")}
        ${fArea("notlar","Not", d.notlar)}
        <div class="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" id="iptal" class="px-4 py-2 rounded-lg border border-slate-300 text-slate-600">İptal</button>
          <button type="submit" class="px-4 py-2 rounded-lg bg-navy text-white">Kaydet</button>
        </div>
      </form>`);
    el("iptal").addEventListener("click", closeModal);
    el("talep-f").addEventListener("submit", async (e)=>{
      e.preventDefault();
      const row = formData(e.target);
      row.adet = row.adet?Number(row.adet):1;
      const wasKazanildi = d.durum==="Kazanıldı";
      const { error } = t ? await api.update("talepler", t.id, row) : await api.insert("talepler", row);
      if(error){ toast("Kaydedilemedi: "+error.message, true); return; }
      closeModal();
      if(!wasKazanildi && row.durum==="Kazanıldı") toast("Talep kazanıldı → Sipariş Takibi'ne taşındı.");
      else toast("Kaydedildi.");
      renderTalepler();
    });
  }

  /* ======================================================================
     3) TEDARİKÇİLER
     ====================================================================== */
  let tedFiltre = "";
  async function renderTedarikciler(){
    const host = el("panel-tedarikciler");
    host.innerHTML = `<p class="text-slate-400">Yükleniyor…</p>`;
    const ted = await fetchAll("tedarikciler"); cache.tedarikciler = ted;
    const liste = tedFiltre ? ted.filter(x=>x.kategori===tedFiltre) : ted;

    const kArr = ted.map(x=>Number(x.kalite)).filter(n=>n>0);
    const ortKalite = kArr.length ? kArr.reduce((a,b)=>a+b,0)/kArr.length : 0;
    host.innerHTML = `
      <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
        <div><h2 class="text-2xl font-bold text-primary">Tedarikçi Yönetimi</h2>
          <p class="text-on-surface-variant text-sm">Kayıtlı tedarikçilerin listesi ve performans verileri.</p></div>
        <div class="flex items-center gap-3">
          <select id="kat-filtre" class="bg-white border border-outline-variant rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-secondary/30">
            <option value="">Tüm Kategoriler</option>
            ${KATEGORILER.map(k=>`<option value="${esc(k)}" ${k===tedFiltre?"selected":""}>${esc(k)}</option>`).join("")}
          </select>
          <button id="yeni-ted" class="bg-primary hover:brightness-125 text-white px-5 py-2.5 rounded-lg text-sm flex items-center gap-1"><span class="ms text-base">add</span> Yeni Tedarikçi</button>
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        ${statCard("groups","bg-secondary/15 text-secondary","Toplam Tedarikçi", fmtNum(ted.length), "")}
        ${statCard("star","bg-amber-100 text-amber-500","Ort. Kalite Skoru", ortKalite?ortKalite.toFixed(1):"—", "")}
        ${statCard("category","bg-primary/10 text-primary","Kategori Sayısı", fmtNum(new Set(ted.map(x=>x.kategori).filter(Boolean)).size), "")}
      </div>
      <div class="glass-card rounded-xl overflow-hidden tbl-wrap">
        <table class="tbl w-full text-sm text-left">
          <thead class="bg-surface-container-low text-on-surface-variant uppercase text-[11px]">
            <tr><th class="px-4 py-3">Firma</th><th class="px-4 py-3">Kategori</th><th class="px-4 py-3">İletişim</th>
              <th class="px-4 py-3">Min. Sip.</th><th class="px-4 py-3">Ort. Teslim</th><th class="px-4 py-3">Vade</th>
              <th class="px-4 py-3">Kalite</th><th class="px-4 py-3 text-right">Aksiyon</th></tr>
          </thead>
          <tbody id="ted-rows"></tbody>
        </table>
        ${liste.length===0?`<p class="p-5 text-on-surface-variant text-sm">Kayıt yok.</p>`:""}
      </div>`;

    el("ted-rows").innerHTML = liste.map(x=>`
      <tr class="border-t border-outline-variant/60 hover:bg-surface-container-low">
        <td class="px-4 py-3 font-semibold text-primary">${esc(x.firma)}</td>
        <td class="px-4 py-3">${x.kategori?pill(x.kategori,"bg-slate-100 text-slate-700"):"—"}</td>
        <td class="px-4 py-3"><div>${esc(x.iletisim_kisi)||"—"}</div><div class="text-[11px] text-on-surface-variant">${esc(x.telefon)||""}</div></td>
        <td class="px-4 py-3">${x.min_siparis?fmtNum(x.min_siparis):"—"}</td>
        <td class="px-4 py-3">${x.ort_teslim_gun?x.ort_teslim_gun+" gün":"—"}</td>
        <td class="px-4 py-3">${esc(x.odeme_vadesi)||"—"}</td>
        <td class="px-4 py-3 text-amber-500">${yildiz(x.kalite)}</td>
        <td class="px-4 py-3 text-right whitespace-nowrap">
          <button class="ted-edit p-1.5 text-on-surface-variant hover:text-primary" data-id="${x.id}"><span class="ms text-[20px]">edit</span></button>
          ${isAdmin()?`<button class="ted-sil p-1.5 text-on-surface-variant hover:text-red-600" data-id="${x.id}"><span class="ms text-[20px]">delete</span></button>`:""}
        </td></tr>`).join("");

    el("kat-filtre").addEventListener("change", e=>{ tedFiltre=e.target.value; renderTedarikciler(); });
    el("yeni-ted").addEventListener("click", ()=>tedForm());
    $$(".ted-edit").forEach(b=>b.addEventListener("click", ()=>tedForm(ted.find(x=>x.id===b.dataset.id))));
    $$(".ted-sil").forEach(b=>b.addEventListener("click", ()=>silKayit("tedarikciler", b.dataset.id, renderTedarikciler)));
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
        <div class="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" id="iptal2" class="px-4 py-2 rounded-lg border border-slate-300 text-slate-600">İptal</button>
          <button type="submit" class="px-4 py-2 rounded-lg bg-navy text-white">Kaydet</button>
        </div>
      </form>`);
    el("iptal2").addEventListener("click", closeModal);
    el("ted-f").addEventListener("submit", async (e)=>{
      e.preventDefault();
      const row = formData(e.target);
      ["min_siparis","ort_teslim_gun","kalite"].forEach(k=>{ if(row[k]!=null) row[k]=Number(row[k]); });
      const { error } = x ? await api.update("tedarikciler", x.id, row) : await api.insert("tedarikciler", row);
      if(error){ toast("Kaydedilemedi: "+error.message, true); return; }
      closeModal(); toast("Kaydedildi."); renderTedarikciler();
    });
  }

  /* ======================================================================
     4) TEKLİF & FİYATLANDIRMA
     ====================================================================== */
  let seciliTalepId = "";
  async function renderTeklifler(){
    const host = el("panel-teklifler");
    host.innerHTML = `<p class="text-slate-400">Yükleniyor…</p>`;
    const [talepler, ted] = await Promise.all([fetchAll("talepler"), fetchAll("tedarikciler")]);
    cache.talepler = talepler; cache.tedarikciler = ted;

    host.innerHTML = `
      ${sayfaBaslik("Teklif & Fiyatlandırma","Bir talep seçin, tedarikçi tekliflerini girin ve en uygununu fiyatlandırın.")}
      <div class="glass-card rounded-xl p-4 mb-6 flex flex-wrap items-center gap-3">
        <label class="text-sm font-medium text-on-surface-variant">Talep:</label>
        <select id="teklif-talep" class="rounded-lg border border-outline-variant px-3 py-2 text-sm bg-white min-w-[280px] outline-none focus:ring-2 focus:ring-secondary/30">
          <option value="">— Talep seçin —</option>
          ${talepler.map(t=>`<option value="${t.id}" ${t.id===seciliTalepId?"selected":""}>${esc(t.talep_no)} · ${esc(t.musteri)} · ${esc(t.urun_kategori||"")}</option>`).join("")}
        </select>
      </div>
      <div id="teklif-icerik"></div>`;

    el("teklif-talep").addEventListener("change", e=>{ seciliTalepId=e.target.value; renderTeklifDetay(); });
    if(seciliTalepId) renderTeklifDetay();
  }

  async function renderTeklifDetay(){
    const box = el("teklif-icerik");
    const talep = cache.talepler.find(t=>t.id===seciliTalepId);
    if(!talep){ box.innerHTML=""; return; }
    box.innerHTML = `<p class="text-slate-400">Teklifler yükleniyor…</p>`;
    const { data:teklifler, error } = await sb.from("teklifler").select("*").eq("talep_id", seciliTalepId).order("birim_fiyat",{ascending:true});
    if(error){ toast("Teklifler okunamadı: "+error.message, true); return; }

    const adet = Number(talep.adet)||1;
    const enDusuk = teklifler.length ? Math.min(...teklifler.map(t=>Number(t.birim_fiyat)||Infinity)) : null;
    const secili = teklifler.find(t=>t.secildi);

    let satis=null, kar=null, maliyet=null;
    if(secili){ maliyet = (Number(secili.birim_fiyat)||0)*adet;
      if(secili.kar_marji!=null){ satis = maliyet*(1+Number(secili.kar_marji)/100); kar = satis-maliyet; } }

    box.innerHTML = `
      <div class="glass-card rounded-xl shadow-sm p-4 mb-4">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><div class="text-slate-400">Talep</div><div class="font-medium">${esc(talep.talep_no)}</div></div>
          <div><div class="text-slate-400">Müşteri</div><div class="font-medium">${esc(talep.musteri)}</div></div>
          <div><div class="text-slate-400">Ürün</div><div class="font-medium">${esc(talep.urun_kategori)||"—"}</div></div>
          <div><div class="text-slate-400">Adet</div><div class="font-medium">${fmtNum(adet)}</div></div>
        </div>
      </div>

      <div class="flex items-center gap-3 mb-3">
        <h3 class="font-semibold text-primary">Teklifler (${teklifler.length})</h3>
        <button id="yeni-teklif" class="ml-auto bg-secondary hover:brightness-110 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1">
          <span class="ms text-base">add</span> Teklif Ekle</button>
        <button id="musteriye-sun" class="bg-navy hover:bg-navy-2 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1">
          <span class="ms text-base">send</span> Müşteriye Sun</button>
      </div>

      <div class="glass-card rounded-xl shadow-sm tbl-wrap mb-4">
        <table class="tbl w-full text-sm">
          <thead class="bg-surface-container-low text-on-surface-variant uppercase text-[11px] text-left">
            <tr><th class="px-3 py-2">Tedarikçi</th><th class="px-3 py-2">Birim ₺</th>
              <th class="px-3 py-2">Toplam ₺</th><th class="px-3 py-2">Teslim</th>
              <th class="px-3 py-2">Vade</th><th class="px-3 py-2">Kalite</th>
              <th class="px-3 py-2">Seçim</th><th class="px-3 py-2"></th></tr>
          </thead>
          <tbody id="teklif-rows">
            ${teklifler.length===0?`<tr><td colspan="8" class="px-3 py-4 text-slate-400">Henüz teklif yok.</td></tr>`:
            teklifler.map(t=>{
              const dusukMu = Number(t.birim_fiyat)===enDusuk;
              return `<tr class="border-t border-slate-100 ${t.secildi?"bg-emerald-50":""}">
                <td class="px-3 py-2 font-medium">${esc(t.tedarikci_adi)||"—"}</td>
                <td class="px-3 py-2 ${dusukMu?"text-emerald-700 font-bold":""}">${fmtTL(t.birim_fiyat)} ${dusukMu?'<span class="ms text-emerald-600 text-sm">trending_down</span>':""}</td>
                <td class="px-3 py-2">${fmtTL((Number(t.birim_fiyat)||0)*adet)}</td>
                <td class="px-3 py-2">${t.teslim_gun?t.teslim_gun+" gün":"—"}</td>
                <td class="px-3 py-2">${esc(t.vade)||"—"}</td>
                <td class="px-3 py-2 text-amber-500">${yildiz(t.kalite)}</td>
                <td class="px-3 py-2">
                  <button class="sec-teklif px-2 py-1 rounded text-xs ${t.secildi?"bg-emerald-600 text-white":"border border-slate-300 text-slate-600"}" data-id="${t.id}">
                    ${t.secildi?"✓ Seçildi":"Seç"}</button></td>
                <td class="px-3 py-2 text-right">
                  ${isAdmin()?`<button class="teklif-sil text-slate-400 hover:text-red-600" data-id="${t.id}"><span class="ms text-base">delete</span></button>`:`<span class="text-slate-300 text-xs">—</span>`}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>

      <div class="glass-card rounded-xl shadow-sm p-4">
        <h3 class="font-semibold text-primary mb-3">Fiyatlandırma (seçilen teklif)</h3>
        ${!secili?`<p class="text-slate-400 text-sm">Bir teklifi "Seç" ile işaretleyin, sonra kâr marjı girin.</p>`:`
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div><div class="text-slate-400 text-sm">Maliyet</div><div class="text-lg font-bold">${fmtTL(maliyet)}</div></div>
            <div>
              <label class="block text-sm text-slate-600 mb-1">Kâr marjı (%)</label>
              <input id="marj" type="number" min="0" step="any" value="${secili.kar_marji??""}"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal"/>
            </div>
            <div><div class="text-slate-400 text-sm">Satış fiyatı</div><div class="text-lg font-bold text-teal">${satis!=null?fmtTL(satis):"—"}</div></div>
            <div><div class="text-slate-400 text-sm">Kâr</div><div class="text-lg font-bold text-emerald-600">${kar!=null?fmtTL(kar):"—"}</div></div>
          </div>
          <div class="mt-3"><button id="marj-kaydet" class="bg-navy text-white px-4 py-2 rounded-lg text-sm">Marjı Kaydet</button></div>`}
      </div>`;

    // teklif ekle formu
    el("yeni-teklif").addEventListener("click", ()=>teklifForm());
    // müşteriye sun (3 teklif kontrolü)
    el("musteriye-sun").addEventListener("click", async ()=>{
      if(teklifler.length<3){ toast(`Uyarı: Müşteriye sunmadan önce en az 3 teklif girin. (Şu an ${teklifler.length})`, true); return; }
      if(!secili){ toast("Önce bir teklif seçin.", true); return; }
      await api.update("talepler", talep.id, { durum:"Teklif Sunuldu" });
      toast("Durum 'Teklif Sunuldu' olarak güncellendi.");
    });
    // seç
    $$(".sec-teklif").forEach(b=>b.addEventListener("click", async ()=>{
      // önce hepsini sıfırla, sonra seçileni işaretle
      await sb.from("teklifler").update({secildi:false}).eq("talep_id", seciliTalepId);
      await sb.from("teklifler").update({secildi:true}).eq("id", b.dataset.id);
      renderTeklifDetay();
    }));
    $$(".teklif-sil").forEach(b=>b.addEventListener("click", async ()=>{
      if(!confirm("Bu teklif silinsin mi?")) return;
      await api.remove("teklifler", b.dataset.id); renderTeklifDetay();
    }));
    if(secili){
      el("marj-kaydet").addEventListener("click", async ()=>{
        const m = el("marj").value;
        await api.update("teklifler", secili.id, { kar_marji: m===""?null:Number(m) });
        toast("Marj kaydedildi."); renderTeklifDetay();
      });
    }
  }

  function teklifForm(){
    const ted = cache.tedarikciler;
    openModal("Teklif Ekle", `
      <form id="teklif-f" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">
          <label class="block text-sm font-medium text-slate-700 mb-1">Tedarikçi</label>
          <select name="tedarikci_id" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal">
            <option value="">— Seçin —</option>
            ${ted.map(x=>`<option value="${x.id}">${esc(x.firma)} (${esc(x.kategori||"")})</option>`).join("")}
          </select>
        </div>
        ${fInput("birim_fiyat","Birim fiyat (₺)", "", "number","required min=0 step=any")}
        ${fInput("teslim_gun","Teslim (gün)", "", "number","min=0 step=1")}
        ${fInput("vade","Ödeme vadesi", "")}
        ${fSelect("kalite","Kalite (1-5)", [1,2,3,4,5], 3)}
        <div class="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" id="iptal3" class="px-4 py-2 rounded-lg border border-slate-300 text-slate-600">İptal</button>
          <button type="submit" class="px-4 py-2 rounded-lg bg-navy text-white">Ekle</button>
        </div>
      </form>`);
    el("iptal3").addEventListener("click", closeModal);
    el("teklif-f").addEventListener("submit", async (e)=>{
      e.preventDefault();
      const row = formData(e.target);
      row.talep_id = seciliTalepId;
      row.birim_fiyat = Number(row.birim_fiyat)||0;
      if(row.teslim_gun) row.teslim_gun = Number(row.teslim_gun);
      if(row.kalite) row.kalite = Number(row.kalite);
      const tx = cache.tedarikciler.find(x=>x.id===row.tedarikci_id);
      row.tedarikci_adi = tx?tx.firma:null;
      const { error } = await api.insert("teklifler", row);
      if(error){ toast("Eklenemedi: "+error.message, true); return; }
      closeModal(); toast("Teklif eklendi."); renderTeklifDetay();
    });
  }

  /* ======================================================================
     5) SİPARİŞ TAKİBİ
     ====================================================================== */
  async function renderSiparisler(){
    const host = el("panel-siparisler");
    host.innerHTML = `<p class="text-slate-400">Yükleniyor…</p>`;
    const sip = await fetchAll("siparisler"); cache.siparisler = sip;

    const aktif = sip.filter(o=>o.asama!=="Teslim edildi").length;
    const geciken = sip.filter(o=>o.asama!=="Teslim edildi" && o.teslim_tarihi && new Date(o.teslim_tarihi)<today0()).length;
    const bekleyenOdeme = sip.filter(o=>o.musteri_odeme!=="Ödendi").reduce((s,o)=>s+(Number(o.satis)||0),0);
    const teslim = sip.filter(o=>o.asama==="Teslim edildi").length;

    host.innerHTML = `
      ${sayfaBaslik("Sipariş Takibi","Kazanılan talepler otomatik buraya düşer; aşama ve ödemeleri buradan yönetin.")}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        ${statCard("package_2","bg-primary/10 text-primary","Aktif Siparişler", fmtNum(aktif), "")}
        ${statCard("warning","bg-red-100 text-red-600","Geciken", `<span class="text-red-600">${fmtNum(geciken)}</span>`, geciken?`<span class="text-on-surface-variant">Acil müdahale bekliyor</span>`:"")}
        ${statCard("payments","bg-secondary/10 text-secondary","Bekleyen Ödeme", `<span class="text-secondary">${fmtTL(bekleyenOdeme)}</span>`, `<span class="text-on-surface-variant">Müşteri ödemesi bekleniyor</span>`)}
        ${statCard("done_all","bg-emerald-100 text-emerald-600","Teslim Edilen", fmtNum(teslim), "")}
      </div>
      <div class="glass-card rounded-xl overflow-hidden">
        <div class="tbl-wrap"><table class="tbl w-full text-sm text-left">
          <thead class="bg-surface-container-low text-on-surface-variant uppercase text-[11px]">
            <tr><th class="px-4 py-3">Sipariş No</th><th class="px-4 py-3">Müşteri</th><th class="px-4 py-3">Tedarikçi</th>
              <th class="px-4 py-3">Ürün</th><th class="px-4 py-3 text-right">Finansal</th><th class="px-4 py-3 text-center">Aşama</th>
              <th class="px-4 py-3 text-center">Ödemeler</th><th class="px-4 py-3">Teslim</th><th class="px-4 py-3 text-right">Aksiyon</th></tr>
          </thead>
          <tbody id="sip-rows"></tbody>
        </table>
        ${sip.length===0?`<p class="p-5 text-on-surface-variant text-sm">Henüz sipariş yok.</p>`:""}
        </div>
      </div>`;

    el("sip-rows").innerHTML = sip.map(o=>{
      const gecikme = o.asama!=="Teslim edildi" && o.teslim_tarihi && new Date(o.teslim_tarihi)<today0();
      const ileri = nextAsama(o.asama);
      return `<tr class="border-t border-outline-variant/60 hover:bg-surface-container-low ${gecikme?"bg-red-50/60":""}">
        <td class="px-4 py-3 font-bold text-primary">${esc(o.siparis_no)}</td>
        <td class="px-4 py-3">${esc(o.musteri)||"—"}</td>
        <td class="px-4 py-3 text-on-surface-variant">${esc(o.tedarikci)||"—"}</td>
        <td class="px-4 py-3"><div class="font-medium">${esc(o.urun)||"—"}</div><div class="text-[11px] text-on-surface-variant">${fmtNum(o.adet)} adet</div></td>
        <td class="px-4 py-3 text-right"><div class="font-bold text-primary">${fmtTL(o.satis)}</div><div class="text-[11px] text-secondary font-bold">${o.kar_yuzde!=null?('%'+fmtNum(o.kar_yuzde)+' kâr'):''}</div></td>
        <td class="px-4 py-3 text-center">${pill(o.asama, ASAMA_RENK[o.asama])}</td>
        <td class="px-4 py-3 text-center"><div class="space-y-1 inline-flex flex-col items-center">
          <div>${pill("Müş: "+o.musteri_odeme, ODEME_RENK[o.musteri_odeme])}</div>
          <div>${pill("Ted: "+o.tedarikci_odeme, ODEME_RENK[o.tedarikci_odeme])}</div></div></td>
        <td class="px-4 py-3 whitespace-nowrap ${gecikme?"text-red-600 font-medium":""}">${fmtDate(o.teslim_tarihi)}${gecikme?'<div class="text-[10px] text-red-600">Gecikti</div>':""}</td>
        <td class="px-4 py-3 text-right whitespace-nowrap">
          ${ileri?`<button class="sip-ileri bg-secondary text-white text-[11px] font-bold px-3 py-1.5 rounded inline-flex items-center gap-1 hover:brightness-110 mr-1" data-id="${o.id}">İleri Al <span class="ms text-[14px]">arrow_forward</span></button>`:""}
          <button class="sip-edit p-1.5 text-on-surface-variant hover:text-primary" data-id="${o.id}" title="Düzenle"><span class="ms text-[20px]">edit</span></button></td>
      </tr>`;
    }).join("");

    $$(".sip-edit").forEach(b=>b.addEventListener("click", ()=>sipForm(sip.find(x=>x.id===b.dataset.id))));
    $$(".sip-ileri").forEach(b=>b.addEventListener("click", ()=>ileriAlSiparis(sip.find(x=>x.id===b.dataset.id))));
  }

  async function ileriAlSiparis(o){
    if(!o) return;
    const next = nextAsama(o.asama); if(!next) return;
    const { error } = await api.update("siparisler", o.id, { asama: next });
    if(error){ toast("Güncellenemedi: "+error.message, true); return; }
    toast("Aşama: "+next); renderSiparisler();
  }

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
        <div class="sm:col-span-2 text-sm text-slate-500">Kâr ve kâr% otomatik hesaplanır (Satış − Maliyet).</div>
        <div class="sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" id="iptal4" class="px-4 py-2 rounded-lg border border-slate-300 text-slate-600">İptal</button>
          <button type="submit" class="px-4 py-2 rounded-lg bg-navy text-white">Kaydet</button>
        </div>
      </form>`);
    el("iptal4").addEventListener("click", closeModal);
    el("sip-f").addEventListener("submit", async (e)=>{
      e.preventDefault();
      const row = formData(e.target);
      ["adet","maliyet","satis"].forEach(k=>{ if(row[k]!=null) row[k]=Number(row[k]); });
      const { error } = await api.update("siparisler", o.id, row);
      if(error){ toast("Kaydedilemedi: "+error.message, true); return; }
      closeModal(); toast("Kaydedildi."); renderSiparisler();
    });
  }

  /* ======================================================================
     6) WEB BAŞVURULARI (site formundan gelenler)
     ====================================================================== */
  let basvuruList = [];
  let seciliBasvuruId = "";
  const TIP_RENK = { "Müşteri":"bg-teal-100 text-teal-800", "Tedarikçi":"bg-indigo-100 text-indigo-800", "Genel":"bg-slate-100 text-slate-700" };

  async function renderWebbasvuru(){
    const host = el("panel-webbasvuru");
    host.innerHTML = `<p class="text-on-surface-variant">Yükleniyor…</p>`;
    basvuruList = await fetchAll("basvurular");
    if(!basvuruList.find(b=>b.id===seciliBasvuruId)) seciliBasvuruId = basvuruList[0] ? basvuruList[0].id : "";
    paintWebbasvuru();
  }

  function haftalikBars(){
    const gunler=[]; const t=today0();
    for(let i=6;i>=0;i--){ const d=new Date(t); d.setDate(d.getDate()-i); gunler.push(d.getTime()); }
    const say = gunler.map(g=> basvuruList.filter(b=>{ const c=new Date(b.created_at); c.setHours(0,0,0,0); return c.getTime()===g; }).length);
    const max = Math.max(1, ...say);
    return say.map(n=>{ const h=Math.round(8 + (n/max)*88); return `<div class="w-full ${n?'bg-secondary':'bg-secondary/20'} rounded-t" style="height:${h}%"></div>`; }).join("");
  }

  function paintWebbasvuru(){
    const host = el("panel-webbasvuru");
    const list = basvuruList;
    const bekleyen = list.filter(b=>b.durum==='Yeni').length;
    const islenen  = list.filter(b=>b.durum!=='Yeni').length;
    const secili = list.find(b=>b.id===seciliBasvuruId);

    host.innerHTML = `
      <div class="flex flex-wrap justify-between items-end gap-4 mb-6">
        <div>
          <h2 class="text-2xl font-bold text-primary">Web Başvuruları</h2>
          <p class="text-on-surface-variant text-sm">berzan.com.tr formundan gelen müşteri ve tedarikçi talepleri.</p>
        </div>
        <div class="flex gap-3">
          <div class="glass-card rounded-xl p-4 flex items-center gap-3">
            <span class="w-10 h-10 rounded-full bg-secondary/15 text-secondary flex items-center justify-center"><span class="ms">inbox</span></span>
            <div><p class="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Bekleyen</p><p class="text-xl font-bold text-primary">${bekleyen}</p></div>
          </div>
          <div class="glass-card rounded-xl p-4 flex items-center gap-3">
            <span class="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center"><span class="ms">done_all</span></span>
            <div><p class="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">İşlenen</p><p class="text-xl font-bold text-primary">${islenen}</p></div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-12 gap-6">
        <div class="col-span-12 lg:col-span-8 glass-card rounded-xl overflow-hidden">
          <div class="tbl-wrap">
            <table class="tbl w-full text-sm text-left">
              <thead class="bg-surface-container-low text-on-surface-variant">
                <tr><th class="px-4 py-3">TARİH</th><th class="px-4 py-3">TÜR</th><th class="px-4 py-3">AD SOYAD / FİRMA</th>
                  <th class="px-4 py-3">İLETİŞİM</th><th class="px-4 py-3">DURUM</th></tr>
              </thead>
              <tbody>
                ${list.length===0?`<tr><td colspan="5" class="px-4 py-6 text-on-surface-variant">Henüz başvuru yok.</td></tr>`:
                list.map(b=>{
                  const sec = b.id===seciliBasvuruId;
                  return `<tr class="bsv-row cursor-pointer border-t border-outline-variant/60 hover:bg-surface-container-low ${sec?'bg-secondary/10':''} ${b.durum==='Yeni'?'border-l-4 border-l-secondary':'border-l-4 border-l-transparent'}" data-id="${b.id}">
                    <td class="px-4 py-3 whitespace-nowrap">${fmtDate(b.created_at)}</td>
                    <td class="px-4 py-3"><span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${TIP_RENK[b.tip]||TIP_RENK['Genel']}">${esc(b.tip)}</span></td>
                    <td class="px-4 py-3"><div class="font-semibold text-primary">${esc(b.ad_soyad)||"—"}</div><div class="text-xs text-on-surface-variant">${esc(b.firma)||""}</div></td>
                    <td class="px-4 py-3 text-on-surface-variant">
                      ${b.eposta?`<div class="flex items-center gap-1 text-xs"><span class="ms text-[14px]">mail</span>${esc(b.eposta)}</div>`:""}
                      ${b.telefon?`<div class="flex items-center gap-1 text-xs"><span class="ms text-[14px]">call</span>${esc(b.telefon)}</div>`:""}
                    </td>
                    <td class="px-4 py-3">${b.durum==='Yeni'
                      ? `<span class="flex items-center gap-1.5 text-secondary font-semibold text-xs whitespace-nowrap"><span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>Yeni</span>`
                      : `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">${esc(b.durum)}</span>`}</td>
                  </tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="col-span-12 lg:col-span-4 space-y-6">
          <div class="glass-card rounded-xl p-5">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-semibold text-primary">Seçili Başvuru</h3>
              <span class="ms text-secondary">info</span>
            </div>
            ${!secili?`<p class="text-on-surface-variant text-sm">Detay için soldan bir başvuru seçin.</p>`:`
              <div class="space-y-4">
                <div>
                  <div class="font-semibold text-primary">${esc(secili.ad_soyad)||"—"}</div>
                  <div class="text-xs text-on-surface-variant">${esc(secili.firma)||""}</div>
                </div>
                <div class="p-3 bg-surface-container-low rounded-lg border border-outline-variant/60">
                  <p class="text-[10px] uppercase font-bold text-on-surface-variant mb-1">MESAJ İÇERİĞİ</p>
                  <p class="text-sm text-on-surface italic">${secili.mesaj?('“'+esc(secili.mesaj)+'”'):'(mesaj yok)'}</p>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="p-3 bg-surface rounded-lg border border-outline-variant/40"><p class="text-[10px] font-bold text-on-surface-variant">TÜR</p><p class="font-bold text-primary">${esc(secili.tip)}</p></div>
                  <div class="p-3 bg-surface rounded-lg border border-outline-variant/40"><p class="text-[10px] font-bold text-on-surface-variant">KAYNAK</p><p class="font-bold text-primary">Web Form</p></div>
                </div>
                <div><p class="text-[10px] font-bold text-on-surface-variant mb-0.5">İLETİŞİM</p>
                  <p class="text-sm break-all">${esc(secili.eposta)||""}${secili.telefon?(' · '+esc(secili.telefon)):''}</p></div>
                ${secili.durum!=='İşlendi'?`
                  ${secili.tip==='Tedarikçi'
                    ? `<button id="sec-tedarikci" class="w-full py-2.5 bg-primary text-white font-semibold rounded-lg hover:brightness-125 transition">Tedarikçi Olarak Ekle</button>`
                    : `<button id="sec-cevir" class="w-full py-2.5 bg-secondary text-white font-semibold rounded-lg hover:brightness-110 transition">Talebe Çevir</button>`}
                  <button id="sec-arsivle" class="w-full py-2.5 border-2 border-secondary text-secondary font-semibold rounded-lg hover:bg-secondary/5 transition">Arşivle</button>
                ` : `<div class="text-center text-sm text-emerald-600 font-semibold py-2">✓ İşlendi</div>`}
                ${isAdmin()?`<button id="sec-sil" class="w-full py-1.5 text-red-600 text-sm hover:underline">Sil</button>`:""}
              </div>`}
          </div>

          <div class="rounded-xl p-6 text-white relative overflow-hidden" style="background:#131d2e">
            <h3 class="font-semibold mb-1">Haftalık Performans</h3>
            <p class="text-white/60 text-sm mb-5">Son 7 günde gelen başvurular.</p>
            <div class="flex items-end gap-2 h-24">${haftalikBars()}</div>
            <p class="text-[10px] text-white/50 text-center mt-3">SON 7 GÜN</p>
          </div>
        </div>
      </div>`;

    $$(".bsv-row").forEach(r=>r.addEventListener("click", ()=>{ seciliBasvuruId=r.dataset.id; paintWebbasvuru(); }));
    const cevirBtn = el("sec-cevir");    if(cevirBtn) cevirBtn.addEventListener("click", ()=>talebeCevir(secili));
    const tedBtn   = el("sec-tedarikci"); if(tedBtn)   tedBtn.addEventListener("click", ()=>tedarikciyeCevir(secili));
    const arsivBtn = el("sec-arsivle");  if(arsivBtn) arsivBtn.addEventListener("click", ()=>arsivleBasvuru(secili));
    const silBtn   = el("sec-sil");      if(silBtn)   silBtn.addEventListener("click", ()=>silKayit("basvurular", secili.id, renderWebbasvuru));
  }

  async function arsivleBasvuru(b){
    if(!b) return;
    const { error } = await api.update("basvurular", b.id, { durum:"Kapandı" });
    if(error){ toast("Güncellenemedi: "+error.message, true); return; }
    toast("Başvuru arşivlendi."); renderWebbasvuru();
  }

  async function tedarikciyeCevir(b){
    if(!b) return;
    if(!confirm("Bu başvuru Tedarikçiler listesine eklensin mi?")) return;
    const row = {
      firma: b.firma || b.ad_soyad || "Web tedarikçi",
      kategori: "Diğer",
      iletisim_kisi: b.ad_soyad || null,
      telefon: b.telefon || null,
      eposta: b.eposta || null,
      notlar: b.mesaj || null
    };
    const { error } = await api.insert("tedarikciler", row);
    if(error){ toast("Eklenemedi: "+error.message, true); return; }
    await api.update("basvurular", b.id, { durum:"İşlendi" });
    toast("Tedarikçiler listesine eklendi."); renderWebbasvuru();
  }

  async function talebeCevir(b){
    if(!b) return;
    if(!confirm("Bu başvuru Talep Takip'e aktarılsın mı?")) return;
    const notParcalari = [
      b.tip ? "Tür: "+b.tip : "",
      b.eposta ? "E-posta: "+b.eposta : "",
      b.telefon ? "Tel: "+b.telefon : "",
      b.mesaj || ""
    ].filter(Boolean);
    const row = {
      musteri: b.firma || b.ad_soyad || "Web başvurusu",
      iletisim_kisi: b.ad_soyad || null,
      notlar: notParcalari.join(" | "),
      durum: "Yeni"
    };
    const { error } = await api.insert("talepler", row);
    if(error){ toast("Aktarılamadı: "+error.message, true); return; }
    await api.update("basvurular", b.id, { durum:"İşlendi" });
    toast("Talep Takip'e aktarıldı."); renderWebbasvuru();
  }

  /* --------------------------- Ortak silme --------------------------- */
  async function silKayit(tablo, id, after){
    if(!confirm("Bu kayıt silinsin mi?")) return;
    const { error } = await api.remove(tablo, id);
    if(error){ toast("Silinemedi: "+error.message, true); return; }
    toast("Silindi."); after();
  }

  /* --------------------------- Renderer haritası --------------------------- */
  const renderers = {
    dashboard: renderDashboard, talepler: renderTalepler,
    tedarikciler: renderTedarikciler, teklifler: renderTeklifler, siparisler: renderSiparisler,
    webbasvuru: renderWebbasvuru,
  };

  /* ======================================================================
     BAŞLATMA
     ====================================================================== */
  function init(){
    el("login-form").addEventListener("submit", doLogin);
    el("logout-btn").addEventListener("click", doLogout);
    $$(".tab-btn").forEach(b=>b.addEventListener("click", ()=>switchTab(b.dataset.tab)));
    const sbToggle = el("sidebar-toggle"); if(sbToggle) sbToggle.addEventListener("click", openSidebar);
    const sbOverlay = el("sidebar-overlay"); if(sbOverlay) sbOverlay.addEventListener("click", closeSidebar);
    const topYeni = el("topbar-yeni"); if(topYeni) topYeni.addEventListener("click", ()=>{ switchTab("talepler"); talepForm(); });
    if(!configured){ el("config-warn").classList.remove("hide"); return; }
    // mevcut oturum var mı?
    sb.auth.getSession().then(({data})=>{ if(data.session) onAuthed(); });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
