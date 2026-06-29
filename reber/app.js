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
      <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div class="flex items-center gap-3">
          <span class="w-10 h-10 rounded-xl ${renk} flex items-center justify-center"><span class="ms">${ikon}</span></span>
          <div><div class="text-2xl font-bold text-navy">${deger}</div>
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
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div class="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
          <span class="ms text-amber-600">notification_important</span>
          <h3 class="font-semibold text-navy">Sonraki adım tarihi gelmiş talepler</h3>
          <span class="ml-auto text-sm text-slate-500">${vadesiGelen.length} kayıt</span>
        </div>
        <div class="tbl-wrap">
        ${vadesiGelen.length===0 ? `<p class="p-5 text-slate-400 text-sm">Bekleyen adım yok. 👍</p>` : `
          <table class="tbl w-full text-sm">
            <thead class="bg-slate-50 text-slate-500 text-left">
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
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <h2 class="text-lg font-bold text-navy">Talep Takip</h2>
        <button id="benim-isler" class="px-3 py-2 rounded-lg text-sm border flex items-center gap-1 ${talepBenim?'bg-navy text-white border-navy':'border-slate-300 text-slate-600'}">
          <span class="ms text-base">assignment_ind</span> Benim işlerim</button>
        <button id="yeni-talep" class="ml-auto bg-teal hover:bg-teal-2 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1">
          <span class="ms text-base">add</span> Yeni Talep</button>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm tbl-wrap">
          <table class="tbl w-full text-sm">
            <thead class="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th class="px-3 py-2">Talep No</th><th class="px-3 py-2">Müşteri</th>
                <th class="px-3 py-2">Ürün</th><th class="px-3 py-2">Durum</th>
                <th class="px-3 py-2">Atanan</th><th class="px-3 py-2">Sonraki adım</th>
                <th class="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody id="talep-rows"></tbody>
          </table>
          ${liste.length===0?`<p class="p-5 text-slate-400 text-sm">Kayıt yok.</p>`:""}
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <h3 class="font-semibold text-navy mb-3 text-sm">Kayıp Nedenleri</h3>
          ${kayipVar?`<canvas id="kayip-chart" height="220"></canvas>`:`<p class="text-slate-400 text-sm">Henüz kayıp kaydı yok.</p>`}
        </div>
      </div>`;

    const tb = el("talep-rows");
    tb.innerHTML = liste.map(t=>{
      const due = isOpen(t.durum) && isDue(t.sonraki_adim_tarihi);
      const benim = currentUser && t.atanan===currentUser.id;
      const ileri = isOpen(t.durum) ? nextDurum(t.durum) : null;
      return `<tr class="border-t border-slate-100 ${benim?"bg-teal-50":due?"bg-amber-50":""}">
        <td class="px-3 py-2"><div class="font-medium">${esc(t.talep_no)}</div>
          <div class="text-xs text-slate-400">${fmtDate(t.tarih)} · ekleyen: ${esc(adFromId(t.ekleyen))}</div></td>
        <td class="px-3 py-2">${esc(t.musteri)}</td>
        <td class="px-3 py-2">${esc(t.urun_kategori)||"—"}<div class="text-xs text-slate-400">${fmtNum(t.adet)} adet</div></td>
        <td class="px-3 py-2"><span class="px-2 py-0.5 rounded text-xs ${DURUM_RENK[t.durum]||""}">${esc(t.durum)}</span></td>
        <td class="px-3 py-2">${t.atanan?`<span class="px-2 py-0.5 rounded text-xs ${benim?'bg-teal text-white':'bg-slate-100 text-slate-700'}">${esc(adFromId(t.atanan))}</span>`:'<span class="text-slate-300">—</span>'}</td>
        <td class="px-3 py-2">${due?`<span class="ms text-amber-600 text-base">warning</span> `:""}${esc(t.sonraki_adim)||"—"}<br>
            <span class="text-xs ${due?"text-red-600 font-medium":"text-slate-400"}">${fmtDate(t.sonraki_adim_tarihi)}</span></td>
        <td class="px-3 py-2 text-right whitespace-nowrap">
          ${ileri?`<button class="ileri-al text-xs bg-teal hover:bg-teal-2 text-white px-2 py-1 rounded mr-1" data-id="${t.id}" title="Sonraki aşamaya al">${esc(ileri)} →</button>`:""}
          ${isOpen(t.durum)?`<button class="kaybet text-slate-400 hover:text-red-600" data-id="${t.id}" title="Kaybedildi"><span class="ms text-base">cancel</span></button>`:""}
          <button class="duzenle text-slate-400 hover:text-teal" data-id="${t.id}" title="Düzenle"><span class="ms text-base">edit</span></button>
          ${isAdmin()?`<button class="sil text-slate-400 hover:text-red-600" data-id="${t.id}" title="Sil"><span class="ms text-base">delete</span></button>`:""}
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

    host.innerHTML = `
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <h2 class="text-lg font-bold text-navy">Tedarikçiler</h2>
        <select id="kat-filtre" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
          <option value="">Tüm kategoriler</option>
          ${KATEGORILER.map(k=>`<option value="${esc(k)}" ${k===tedFiltre?"selected":""}>${esc(k)}</option>`).join("")}
        </select>
        <button id="yeni-ted" class="ml-auto bg-teal hover:bg-teal-2 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1">
          <span class="ms text-base">add</span> Yeni Tedarikçi</button>
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm tbl-wrap">
        <table class="tbl w-full text-sm">
          <thead class="bg-slate-50 text-slate-500 text-left">
            <tr><th class="px-3 py-2">Firma</th><th class="px-3 py-2">Kategori</th>
              <th class="px-3 py-2">İletişim</th><th class="px-3 py-2">Telefon</th>
              <th class="px-3 py-2">Min. sip.</th><th class="px-3 py-2">Ort. teslim</th>
              <th class="px-3 py-2">Vade</th><th class="px-3 py-2">Kalite</th><th class="px-3 py-2"></th></tr>
          </thead>
          <tbody id="ted-rows"></tbody>
        </table>
        ${liste.length===0?`<p class="p-5 text-slate-400 text-sm">Kayıt yok.</p>`:""}
      </div>`;

    el("ted-rows").innerHTML = liste.map(x=>`
      <tr class="border-t border-slate-100">
        <td class="px-3 py-2 font-medium">${esc(x.firma)}</td>
        <td class="px-3 py-2">${esc(x.kategori)||"—"}</td>
        <td class="px-3 py-2">${esc(x.iletisim_kisi)||"—"}</td>
        <td class="px-3 py-2">${esc(x.telefon)||"—"}</td>
        <td class="px-3 py-2">${x.min_siparis?fmtNum(x.min_siparis):"—"}</td>
        <td class="px-3 py-2">${x.ort_teslim_gun?x.ort_teslim_gun+" gün":"—"}</td>
        <td class="px-3 py-2">${esc(x.odeme_vadesi)||"—"}</td>
        <td class="px-3 py-2 text-amber-500">${yildiz(x.kalite)}</td>
        <td class="px-3 py-2 text-right">
          <button class="ted-edit text-slate-400 hover:text-teal" data-id="${x.id}"><span class="ms text-base">edit</span></button>
          ${isAdmin()?`<button class="ted-sil text-slate-400 hover:text-red-600" data-id="${x.id}"><span class="ms text-base">delete</span></button>`:""}
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
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <h2 class="text-lg font-bold text-navy">Teklif & Fiyatlandırma</h2>
        <select id="teklif-talep" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white min-w-[260px]">
          <option value="">— Talep seçin —</option>
          ${talepler.map(t=>`<option value="${t.id}" ${t.id===seciliTalepId?"selected":""}>
            ${esc(t.talep_no)} · ${esc(t.musteri)} · ${esc(t.urun_kategori||"")}</option>`).join("")}
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
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><div class="text-slate-400">Talep</div><div class="font-medium">${esc(talep.talep_no)}</div></div>
          <div><div class="text-slate-400">Müşteri</div><div class="font-medium">${esc(talep.musteri)}</div></div>
          <div><div class="text-slate-400">Ürün</div><div class="font-medium">${esc(talep.urun_kategori)||"—"}</div></div>
          <div><div class="text-slate-400">Adet</div><div class="font-medium">${fmtNum(adet)}</div></div>
        </div>
      </div>

      <div class="flex items-center gap-3 mb-3">
        <h3 class="font-semibold text-navy">Teklifler (${teklifler.length})</h3>
        <button id="yeni-teklif" class="ml-auto bg-teal hover:bg-teal-2 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1">
          <span class="ms text-base">add</span> Teklif Ekle</button>
        <button id="musteriye-sun" class="bg-navy hover:bg-navy-2 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1">
          <span class="ms text-base">send</span> Müşteriye Sun</button>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm tbl-wrap mb-4">
        <table class="tbl w-full text-sm">
          <thead class="bg-slate-50 text-slate-500 text-left">
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

      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h3 class="font-semibold text-navy mb-3">Fiyatlandırma (seçilen teklif)</h3>
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

    host.innerHTML = `
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <h2 class="text-lg font-bold text-navy">Sipariş Takibi</h2>
        <span class="text-sm text-slate-500">Kazanılan talepler otomatik buraya düşer.</span>
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm tbl-wrap">
        <table class="tbl w-full text-sm">
          <thead class="bg-slate-50 text-slate-500 text-left">
            <tr><th class="px-3 py-2">Sipariş No</th><th class="px-3 py-2">Müşteri</th>
              <th class="px-3 py-2">Tedarikçi</th><th class="px-3 py-2">Ürün</th>
              <th class="px-3 py-2">Maliyet</th><th class="px-3 py-2">Satış</th>
              <th class="px-3 py-2">Kâr</th><th class="px-3 py-2">Aşama</th>
              <th class="px-3 py-2">Müş. öd.</th><th class="px-3 py-2">Ted. öd.</th>
              <th class="px-3 py-2">Teslim</th><th class="px-3 py-2"></th></tr>
          </thead>
          <tbody id="sip-rows"></tbody>
        </table>
        ${sip.length===0?`<p class="p-5 text-slate-400 text-sm">Henüz sipariş yok.</p>`:""}
      </div>`;

    el("sip-rows").innerHTML = sip.map(o=>{
      const gecikme = o.asama!=="Teslim edildi" && o.teslim_tarihi && new Date(o.teslim_tarihi)<today0();
      const odenmedi = o.musteri_odeme!=="Ödendi";
      return `<tr class="border-t border-slate-100 ${gecikme?"bg-red-50":""}">
        <td class="px-3 py-2 font-medium">${esc(o.siparis_no)}</td>
        <td class="px-3 py-2">${esc(o.musteri)||"—"}</td>
        <td class="px-3 py-2">${esc(o.tedarikci)||"—"}</td>
        <td class="px-3 py-2">${esc(o.urun)||"—"}</td>
        <td class="px-3 py-2">${fmtTL(o.maliyet)}</td>
        <td class="px-3 py-2">${fmtTL(o.satis)}</td>
        <td class="px-3 py-2 text-emerald-700 font-medium">${fmtTL(o.kar)}<br><span class="text-xs text-slate-400">%${fmtNum(o.kar_yuzde)}</span></td>
        <td class="px-3 py-2"><span class="px-2 py-0.5 rounded text-xs ${ASAMA_RENK[o.asama]||""}">${esc(o.asama)}</span></td>
        <td class="px-3 py-2"><span class="px-2 py-0.5 rounded text-xs ${ODEME_RENK[o.musteri_odeme]||""}">${esc(o.musteri_odeme)}</span></td>
        <td class="px-3 py-2"><span class="px-2 py-0.5 rounded text-xs ${ODEME_RENK[o.tedarikci_odeme]||""}">${esc(o.tedarikci_odeme)}</span></td>
        <td class="px-3 py-2 ${gecikme?"text-red-600 font-medium":""}">${gecikme?'<span class="ms text-red-600 text-base">warning</span> ':""}${fmtDate(o.teslim_tarihi)}</td>
        <td class="px-3 py-2 text-right whitespace-nowrap">
          ${nextAsama(o.asama)?`<button class="sip-ileri text-xs bg-teal hover:bg-teal-2 text-white px-2 py-1 rounded mr-1" data-id="${o.id}" title="Sonraki aşama">${esc(nextAsama(o.asama))} →</button>`:""}
          <button class="sip-edit text-slate-400 hover:text-teal" data-id="${o.id}" title="Düzenle"><span class="ms text-base">edit</span></button></td>
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
  async function renderWebbasvuru(){
    const host = el("panel-webbasvuru");
    host.innerHTML = `<p class="text-slate-400">Yükleniyor…</p>`;
    const list = await fetchAll("basvurular");

    host.innerHTML = `
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <h2 class="text-lg font-bold text-navy">Web Başvuruları</h2>
        <span class="text-sm text-slate-500">berzan.com.tr formundan gelen talepler.</span>
      </div>
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm tbl-wrap">
        <table class="tbl w-full text-sm">
          <thead class="bg-slate-50 text-slate-500 text-left">
            <tr><th class="px-3 py-2">Tarih</th><th class="px-3 py-2">Tür</th><th class="px-3 py-2">Ad Soyad</th>
              <th class="px-3 py-2">Firma</th><th class="px-3 py-2">İletişim</th><th class="px-3 py-2">Mesaj</th>
              <th class="px-3 py-2">Durum</th><th class="px-3 py-2"></th></tr>
          </thead>
          <tbody id="bsv-rows"></tbody>
        </table>
        ${list.length===0?`<p class="p-5 text-slate-400 text-sm">Henüz başvuru yok.</p>`:""}
      </div>`;

    el("bsv-rows").innerHTML = list.map(b=>`
      <tr class="border-t border-slate-100 ${b.durum==='Yeni'?'bg-amber-50/40':''}">
        <td class="px-3 py-2 whitespace-nowrap">${fmtDate(b.created_at)}</td>
        <td class="px-3 py-2">${esc(b.tip)}</td>
        <td class="px-3 py-2 font-medium">${esc(b.ad_soyad)||"—"}</td>
        <td class="px-3 py-2">${esc(b.firma)||"—"}</td>
        <td class="px-3 py-2 text-xs">${esc(b.eposta)||""}${b.telefon?`<br>${esc(b.telefon)}`:""}</td>
        <td class="px-3 py-2 max-w-[240px]"><div class="truncate" title="${esc(b.mesaj)||''}">${esc(b.mesaj)||"—"}</div></td>
        <td class="px-3 py-2"><span class="px-2 py-0.5 rounded text-xs ${BASVURU_DURUM_RENK[b.durum]||""}">${esc(b.durum)}</span></td>
        <td class="px-3 py-2 text-right whitespace-nowrap">
          ${b.durum!=='İşlendi' ? (b.tip==='Tedarikçi'
            ? `<button class="bsv-tedarikci text-xs bg-secondary hover:brightness-110 text-white px-2 py-1 rounded mr-1" data-id="${b.id}">Tedarikçi olarak ekle</button>`
            : `<button class="bsv-cevir text-xs bg-secondary hover:brightness-110 text-white px-2 py-1 rounded mr-1" data-id="${b.id}">Talebe çevir</button>`) : ""}
          ${isAdmin()?`<button class="bsv-sil text-slate-400 hover:text-red-600" data-id="${b.id}"><span class="ms text-base">delete</span></button>`:""}
        </td></tr>`).join("");

    $$(".bsv-cevir").forEach(btn=>btn.addEventListener("click", ()=>talebeCevir(list.find(x=>x.id===btn.dataset.id))));
    $$(".bsv-tedarikci").forEach(btn=>btn.addEventListener("click", ()=>tedarikciyeCevir(list.find(x=>x.id===btn.dataset.id))));
    $$(".bsv-sil").forEach(btn=>btn.addEventListener("click", ()=>silKayit("basvurular", btn.dataset.id, renderWebbasvuru)));
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
