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
    el("login-view").classList.add("hide"); el("app-view").classList.remove("hide");
    startInactivity(); switchTab("dashboard");
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
  let cache = { talepler:[], tedarikciler:[], teklifler:[], siparisler:[], basvurular:[] };
  function switchTab(tab){
    $$(".tab-btn").forEach(b=>{ const on=b.dataset.tab===tab;
      b.classList.toggle("border-secondary", on); b.classList.toggle("border-transparent", !on);
      b.classList.toggle("text-on-primary", on); b.classList.toggle("bg-white/5", on); b.classList.toggle("text-on-primary/70", !on); });
    $$(".panel").forEach(p=>p.classList.add("hide"));
    el("panel-"+tab).classList.remove("hide"); closeSidebar(); renderers[tab]();
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
    const talepler = await fetchAll("talepler"); cache.talepler = talepler;
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
          ${isAdmin()?`<button class="sil p-1.5 text-on-surface-variant hover:text-error" data-id="${t.id}" title="Sil"><span class="ms text-[20px]">delete</span></button>`:""}
        </div></td></tr>`;
    }).join("");

    el("benim-isler").addEventListener("click", ()=>{ talepBenim=!talepBenim; renderTalepler(); });
    el("yeni-talep").addEventListener("click", ()=>talepForm());
    $$(".duzenle").forEach(b=>b.addEventListener("click", ()=>talepForm(talepler.find(x=>x.id===b.dataset.id))));
    $$(".sil").forEach(b=>b.addEventListener("click", ()=>silKayit("talepler", b.dataset.id, renderTalepler)));
    $$(".ileri-al").forEach(b=>b.addEventListener("click", ()=>ileriAlTalep(talepler.find(x=>x.id===b.dataset.id))));
    $$(".kaybet").forEach(b=>b.addEventListener("click", ()=>kaybetTalep(b.dataset.id)));
    if(kayipVar) new Chart(el("kayip-chart"), { type:"doughnut", data:{ labels:Object.keys(kayipSay), datasets:[{ data:Object.values(kayipSay), backgroundColor:["#006a61","#f59e0b","#3b82f6","#94a3b8"] }] }, options:{ plugins:{ legend:{ position:"bottom" } } } });
  }
  async function ileriAlTalep(t){ if(!t) return; const next=nextDurum(t.durum); if(!next) return;
    const { error } = await api.update("talepler", t.id, { durum: next }); if(error){ toast("Güncellenemedi: "+error.message, true); return; }
    toast(next==="Kazanıldı" ? "Kazanıldı → Sipariş Takibi'ne taşındı." : "Durum: "+next); renderTalepler(); }
  function kaybetTalep(id){
    openModal("Talebi Kaybet", `<form id="kaybet-f" class="space-y-3"><p class="text-sm text-on-surface-variant">Bu talep neden kaybedildi?</p>
      ${fSelect("kayip_nedeni","Kayıp nedeni", KAYIP_NEDENLERI, KAYIP_NEDENLERI[0])}
      <div class="flex justify-end gap-2 pt-2"><button type="button" id="iptalK" class="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant">İptal</button><button type="submit" class="px-4 py-2 rounded-lg bg-error text-white">Kaybedildi işaretle</button></div></form>`);
    el("iptalK").addEventListener("click", closeModal);
    el("kaybet-f").addEventListener("submit", async (e)=>{ e.preventDefault(); const row=formData(e.target);
      const { error } = await api.update("talepler", id, { durum:"Kaybedildi", kayip_nedeni: row.kayip_nedeni });
      if(error){ toast("Güncellenemedi: "+error.message, true); return; } closeModal(); toast("Talep kaybedildi olarak işaretlendi."); renderTalepler(); });
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
        <div><label class="block text-sm font-medium text-on-surface mb-1">Atanan kişi</label>
          <select name="atanan" class="w-full rounded-lg border border-outline-variant px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-secondary">
            <option value="">— Atanmadı —</option>
            ${Object.entries(profilMap).map(([id,p])=>`<option value="${id}" ${id===(d.atanan||"")?"selected":""}>${esc(p.ad)}</option>`).join("")}
          </select></div>
        ${fInput("sonraki_adim","Sonraki adım", d.sonraki_adim)}
        ${fInput("sonraki_adim_tarihi","Sonraki adım tarihi", d.sonraki_adim_tarihi,"date")}
        ${fSelect("kayip_nedeni","Kayıp nedeni (kaybedildiyse)", ["", ...KAYIP_NEDENLERI], d.kayip_nedeni||"")}
        ${fArea("notlar","Not", d.notlar)}
        <div class="sm:col-span-2 flex justify-end gap-2 pt-2"><button type="button" id="iptal" class="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant">İptal</button><button type="submit" class="px-4 py-2 rounded-lg bg-primary text-white">Kaydet</button></div>
      </form>`);
    el("iptal").addEventListener("click", closeModal);
    el("talep-f").addEventListener("submit", async (e)=>{ e.preventDefault(); const row=formData(e.target); row.adet=row.adet?Number(row.adet):1;
      const wasKazanildi = d.durum==="Kazanıldı";
      const { error } = t ? await api.update("talepler", t.id, row) : await api.insert("talepler", row);
      if(error){ toast("Kaydedilemedi: "+error.message, true); return; }
      closeModal(); toast((!wasKazanildi && row.durum==="Kazanıldı") ? "Talep kazanıldı → Sipariş Takibi'ne taşındı." : "Kaydedildi."); renderTalepler(); });
  }

  /* ======================================================================
     3) TEDARİKÇİLER  (Stitch)
     ====================================================================== */
  let tedFiltre = "";
  async function renderTedarikciler(){
    const host = el("panel-tedarikciler");
    host.innerHTML = `<p class="text-on-surface-variant">Yükleniyor…</p>`;
    const ted = await fetchAll("tedarikciler"); cache.tedarikciler = ted;
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
          ${isAdmin()?`<button class="ted-sil p-1.5 hover:bg-error/10 text-error rounded-lg" data-id="${x.id}"><span class="ms">delete</span></button>`:""}
        </div></td></tr>`).join("");

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
    const sip = await fetchAll("siparisler"); cache.siparisler = sip;
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
          <button class="sip-edit p-2 text-on-surface-variant hover:bg-surface-container rounded-lg" data-id="${o.id}"><span class="ms">edit</span></button>
        </div></td></tr>`;
    }).join("");

    $$(".sip-edit").forEach(b=>b.addEventListener("click", ()=>sipForm(sip.find(x=>x.id===b.dataset.id))));
    $$(".sip-ileri").forEach(b=>b.addEventListener("click", ()=>ileriAlSiparis(sip.find(x=>x.id===b.dataset.id))));
  }
  async function ileriAlSiparis(o){ if(!o) return; const next=nextAsama(o.asama); if(!next) return;
    const { error } = await api.update("siparisler", o.id, { asama: next }); if(error){ toast("Güncellenemedi: "+error.message, true); return; }
    toast("Aşama: "+next); renderSiparisler(); }
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
  let basvuruList = []; let seciliBasvuruId = "";
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
    const host=el("panel-webbasvuru"); const list=basvuruList;
    const bekleyen=list.filter(b=>b.durum==='Yeni').length; const islenen=list.filter(b=>b.durum!=='Yeni').length;
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
  const renderers = { dashboard:renderDashboard, talepler:renderTalepler, tedarikciler:renderTedarikciler, teklifler:renderTeklifler, siparisler:renderSiparisler, webbasvuru:renderWebbasvuru };

  /* ---- Başlatma ---- */
  function init(){
    el("login-form").addEventListener("submit", doLogin);
    el("logout-btn").addEventListener("click", doLogout);
    $$(".tab-btn").forEach(b=>b.addEventListener("click", ()=>switchTab(b.dataset.tab)));
    const st=el("sidebar-toggle"); if(st) st.addEventListener("click", openSidebar);
    const so=el("sidebar-overlay"); if(so) so.addEventListener("click", closeSidebar);
    const ty=el("topbar-yeni"); if(ty) ty.addEventListener("click", ()=>{ switchTab("talepler"); talepForm(); });
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
