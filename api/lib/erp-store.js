import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../data");
const DB_PATH = path.join(DATA_DIR, "erp-db.json");

const CATEGORY_SEED = [
  { id: "cat_mont", slug: "mont", name: "Mont & Dış Giyim", description: "Saha ve kış şartları için dış giyim", active: true },
  { id: "cat_ust", slug: "ust", name: "Üst Giyim", description: "Tişört, sweatshirt ve katman ürünleri", active: true },
  { id: "cat_pantolon", slug: "pantolon", name: "Alt Giyim", description: "İş pantolonu ve şortlar", active: true },
  { id: "cat_yelek", slug: "yelek", name: "Yelek & Görünürlük", description: "Reflektif ve hafif yelek çözümleri", active: true },
  { id: "cat_tulum", slug: "tulum", name: "Tulum", description: "Endüstriyel tulum serisi", active: true },
  { id: "cat_kkd", slug: "kkd", name: "KKD / Ekipman", description: "Kişisel koruyucu donanım", active: true },
  { id: "cat_ayakkabi", slug: "ayakkabi", name: "İş Ayakkabısı", description: "S3 ve saha tipi ayakkabılar", active: true },
  { id: "cat_aksesuar", slug: "aksesuar", name: "Aksesuar", description: "Tamamlayıcı saha ekipmanları", active: true },
];

const PRODUCT_SEED = [
  {
    id: "prd_mont_hv",
    sku: "BZ-MNT-001",
    slug: "mont",
    name: "High Visibility Mont",
    category_id: "cat_mont",
    short_desc: "Reflektör bantlı, EN/CE odaklı saha montu.",
    description: "Düşük ışık koşullarında görünürlük sağlayan, soğuğa ve yoğun kullanıma uygun premium saha montu.",
    cover_image_url: "/img/home-product.webp",
    price_try: 1990,
    quote_price_try: 1890,
    stock: 72,
    reorder_point: 18,
    badges: ["EN/CE", "Reflektör"],
    sectors: ["insaat", "lojistik", "fabrika", "marine"],
    seasons: ["kislik", "sezonluk"],
    sort: 10,
    featured: true,
    is_active: true,
  },
  {
    id: "prd_mont_hd",
    sku: "BZ-MNT-002",
    slug: "heavy-duty-mont",
    name: "Heavy Duty Mont",
    category_id: "cat_mont",
    short_desc: "Yoğun saha kullanımı için güçlendirilmiş mont.",
    description: "Ağır hizmet koşulları için tasarlanan güçlendirilmiş dikiş ve kumaş yapısına sahip mont.",
    cover_image_url: "/img/monthero.webp",
    price_try: 2190,
    quote_price_try: 2050,
    stock: 31,
    reorder_point: 10,
    badges: ["Dayanım", "Saha"],
    sectors: ["insaat", "fabrika", "marine"],
    seasons: ["kislik", "sezonluk"],
    sort: 20,
    featured: true,
    is_active: true,
  },
  {
    id: "prd_softshell",
    sku: "BZ-MNT-004",
    slug: "softshell-flex",
    name: "Softshell Flex",
    category_id: "cat_mont",
    short_desc: "Esnek ve konforlu günlük vardiya ceketi.",
    description: "Yüksek hareket özgürlüğü ve hafiflik sunan, günlük operasyonlar için tasarlanmış softshell ceket.",
    cover_image_url: "/img/kkd.webp",
    price_try: 1890,
    quote_price_try: 1750,
    stock: 15,
    reorder_point: 14,
    badges: ["Esnek", "Konfor"],
    sectors: ["lojistik", "isletme", "insaat"],
    seasons: ["sezonluk", "kislik"],
    sort: 30,
    featured: true,
    is_active: true,
  },
  {
    id: "prd_polo",
    sku: "BZ-UST-001",
    slug: "polo-tisort",
    name: "Kurumsal Polo Tişört",
    category_id: "cat_ust",
    short_desc: "Logolu kurumsal görünüme uygun polo tişört.",
    description: "Sıcak çalışma ortamlarında nefes alabilen kumaşıyla kurumsal görünüm sunan polo tişört.",
    cover_image_url: "/img/sektor-sec.webp",
    price_try: 690,
    quote_price_try: 620,
    stock: 138,
    reorder_point: 40,
    badges: ["Kurumsal", "Nefes alır"],
    sectors: ["isletme", "lojistik", "fabrika"],
    seasons: ["yazlik", "sezonluk"],
    sort: 40,
    featured: false,
    is_active: true,
  },
  {
    id: "prd_pantolon",
    sku: "BZ-PNT-001",
    slug: "is-pantolonu",
    name: "İş Pantolonu",
    category_id: "cat_pantolon",
    short_desc: "Gün boyu rahat, güçlendirilmiş saha pantolonu.",
    description: "Ergonomik kesimi ve güçlendirilmiş bölgeleriyle uzun vardiyalar için tasarlanmış iş pantolonu.",
    cover_image_url: "/img/toplu-alim.webp",
    price_try: 1190,
    quote_price_try: 1090,
    stock: 64,
    reorder_point: 20,
    badges: ["Ergonomi", "Dayanım"],
    sectors: ["insaat", "lojistik", "isletme", "fabrika"],
    seasons: ["yazlik", "sezonluk"],
    sort: 50,
    featured: false,
    is_active: true,
  },
  {
    id: "prd_yelek",
    sku: "BZ-YLK-001",
    slug: "reflektor-yelek",
    name: "Yüksek Görünürlüklü Yelek",
    category_id: "cat_yelek",
    short_desc: "Hızlı giy-çık kullanımına uygun reflektif yelek.",
    description: "Görünürlüğü artıran hafif yapı ve hızlı kullanım avantajı sunan reflektif yelek.",
    cover_image_url: "/img/kkd.webp",
    price_try: 590,
    quote_price_try: 520,
    stock: 210,
    reorder_point: 48,
    badges: ["Reflektör", "EN/CE"],
    sectors: ["lojistik", "insaat", "fabrika"],
    seasons: ["yazlik", "sezonluk"],
    sort: 60,
    featured: false,
    is_active: true,
  },
  {
    id: "prd_ayakkabi",
    sku: "BZ-AYK-001",
    slug: "ayakkabi-s3",
    name: "İş Ayakkabısı S3",
    category_id: "cat_ayakkabi",
    short_desc: "S3 sertifikalı saha ayakkabısı.",
    description: "Çelik burunlu, kaymaz tabanlı ve uzun vardiya konforuna uygun S3 saha ayakkabısı.",
    cover_image_url: "/img/mainpg.webp",
    price_try: 2290,
    quote_price_try: 2090,
    stock: 22,
    reorder_point: 16,
    badges: ["S3", "Çelik burun"],
    sectors: ["insaat", "lojistik", "fabrika"],
    seasons: ["yazlik", "kislik", "sezonluk"],
    sort: 70,
    featured: true,
    is_active: true,
  },
  {
    id: "prd_bere",
    sku: "BZ-AKS-004",
    slug: "bere",
    name: "İş Beresi",
    category_id: "cat_aksesuar",
    short_desc: "Kış vardiyalarında sıcak tutan saha beresi.",
    description: "Soğuk hava koşullarında temel sıcaklık katmanı sağlayan dayanıklı iş beresi.",
    cover_image_url: "/img/monthero.webp",
    price_try: 190,
    quote_price_try: 170,
    stock: 9,
    reorder_point: 12,
    badges: ["Sıcak"],
    sectors: ["insaat", "lojistik", "marine", "fabrika"],
    seasons: ["kislik"],
    sort: 80,
    featured: false,
    is_active: true,
  },
];

function nowIso() {
  return new Date().toISOString();
}

function plusDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[şŞ]/g, "s")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function findCategoryName(categoryId, db) {
  return db.categories.find((item) => item.id === categoryId)?.name || "Kategori yok";
}

function findCategorySlug(categoryId, db) {
  return db.categories.find((item) => item.id === categoryId)?.slug || "";
}

function makeOrderNo(db) {
  return `BZ-${new Date().getFullYear()}-${String((db.orders || []).length + 1).padStart(4, "0")}`;
}

function makeLeadNo(db) {
  return `LD-${new Date().getFullYear()}-${String((db.leads || []).length + 1).padStart(4, "0")}`;
}

function dedupeStrings(values) {
  return [...new Set((values || []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function isCurrentMonth(value) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function isCreditAccount(account) {
  return ["Kredi Karti", "Kredi", "KMH"].includes(String(account?.type || ""));
}

function isCashLikeAccount(account) {
  return ["Kasa", "Banka", "E-Cuzdan"].includes(String(account?.type || ""));
}

function buildDefaultDb() {
  const createdAt = nowIso();
  const customers = [
    {
      id: "cus_berzan_demo_1",
      name: "Ayşe Demir",
      company: "Demir Lojistik",
      phone: "+90 542 400 12 12",
      email: "ayse@demirlojistik.com",
      city: "İstanbul",
      segment: "Kurumsal",
      status: "Aktif",
      total_spend_try: 18500,
      last_contact_at: createdAt,
      last_order_at: createdAt,
      assigned_to: "Satış Ekibi",
      notes: "Yaz sezonu için toplu polo ve reflektif yelek talebi var.",
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  const leads = [
    {
      id: "lead_demo_1",
      lead_no: "LD-2026-0001",
      customer_id: customers[0].id,
      name: "Ayşe Demir",
      company: "Demir Lojistik",
      phone: "+90 542 400 12 12",
      email: "ayse@demirlojistik.com",
      note: "50 adet polo tişört ve 30 adet reflektörlü yelek için fiyat bekleniyor.",
      items: [
        { id: "prd_polo", name: "Kurumsal Polo Tişört", qty: 50, price: 620 },
        { id: "prd_yelek", name: "Yüksek Görünürlüklü Yelek", qty: 30, price: 520 },
      ],
      totals: { retail: 52200, quote: 46600 },
      stage: "Teklif Hazırlanıyor",
      priority: "Yüksek",
      source: "Web Form",
      owner: "Satış Ekibi",
      page: "/uzman/",
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  const orders = [
    {
      id: "ord_demo_1",
      order_no: "BZ-2026-0001",
      customer_id: customers[0].id,
      lead_id: leads[0].id,
      status: "Onay Bekliyor",
      payment_status: "Teklif",
      total_try: 46600,
      channel: "Kurumsal",
      due_date: plusDays(5),
      items: leads[0].items,
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  const tasks = [
    {
      id: "tsk_demo_1",
      title: "Demir Lojistik teklifini ara",
      status: "Açık",
      priority: "Yüksek",
      assignee: "Satış Ekibi",
      due_date: plusDays(1),
      related_type: "lead",
      related_id: leads[0].id,
      notes: "Sabah vardiya planı çıkmadan önce dönüş bekliyorlar.",
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  const inventoryMovements = [
    {
      id: "mov_demo_1",
      product_id: "prd_softshell",
      product_name: "Softshell Flex",
      type: "Cikis",
      quantity: 8,
      reason: "Numune ve sıcak satış",
      created_at: createdAt,
    },
    {
      id: "mov_demo_2",
      product_id: "prd_bere",
      product_name: "İş Beresi",
      type: "Cikis",
      quantity: 12,
      reason: "Kış sezonu saha paketi",
      created_at: createdAt,
    },
  ];

  const financeAccounts = [
    {
      id: "fin_acc_cash",
      name: "Merkez Kasa",
      type: "Kasa",
      institution: "BERZAN",
      currency: "TRY",
      current_balance_try: 124500,
      credit_limit_try: 0,
      due_day: null,
      notes: "Günlük nakit ve tahsilat kasası.",
      is_active: true,
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: "fin_acc_bank",
      name: "Ticari Vadesiz",
      type: "Banka",
      institution: "VakıfBank",
      currency: "TRY",
      current_balance_try: 286000,
      credit_limit_try: 0,
      due_day: null,
      notes: "Tedarikçi ve maaş ödemeleri ana hesap.",
      is_active: true,
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: "fin_acc_card",
      name: "Ticari Kredi Kartı",
      type: "Kredi Karti",
      institution: "Akbank",
      currency: "TRY",
      current_balance_try: 68500,
      credit_limit_try: 180000,
      due_day: 12,
      notes: "Operasyonel satın alma ve reklam harcamaları.",
      is_active: true,
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: "fin_acc_loan",
      name: "İşletme Kredisi",
      type: "Kredi",
      institution: "QNB",
      currency: "TRY",
      current_balance_try: 420000,
      credit_limit_try: 500000,
      due_day: 18,
      notes: "Makine ve üretim yatırımı için kullanılan limit.",
      is_active: true,
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  const financeEntries = [
    {
      id: "fin_ent_1",
      account_id: "fin_acc_bank",
      title: "Kurumsal sipariş tahsilatı",
      type: "Gelir",
      category: "Satış",
      amount_try: 148000,
      status: "Gerçekleşti",
      transaction_date: createdAt,
      counterparty: "Demir Lojistik",
      notes: "Nisan ayı toplu sipariş tahsilatı.",
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: "fin_ent_2",
      account_id: "fin_acc_card",
      title: "Kumaş ve aksesuar alımı",
      type: "Gider",
      category: "Satın Alma",
      amount_try: 37250,
      status: "Gerçekleşti",
      transaction_date: createdAt,
      counterparty: "Atlas Tekstil",
      notes: "Yeni sezon üretim girdisi.",
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: "fin_ent_3",
      account_id: "fin_acc_cash",
      title: "Mağaza nakit tahsilatı",
      type: "Gelir",
      category: "Perakende",
      amount_try: 12400,
      status: "Gerçekleşti",
      transaction_date: createdAt,
      counterparty: "Mağaza Satışı",
      notes: "",
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: "fin_ent_4",
      account_id: "fin_acc_bank",
      title: "Kira ödemesi",
      type: "Gider",
      category: "Sabit Gider",
      amount_try: 45000,
      status: "Gerçekleşti",
      transaction_date: createdAt,
      counterparty: "İşyeri Sahibi",
      notes: "Aylık depo + showroom gideri.",
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  const financeLiabilities = [
    {
      id: "fin_debt_1",
      title: "Atlas Tekstil açık hesap",
      lender: "Atlas Tekstil",
      type: "Tedarikçi Borcu",
      remaining_try: 96500,
      monthly_payment_try: 32000,
      due_date: plusDays(9),
      status: "Açık",
      notes: "Vade sonunda ödeme planlandı.",
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: "fin_debt_2",
      title: "Vergi ve SGK yükümlülüğü",
      lender: "Gelir İdaresi / SGK",
      type: "Vergi",
      remaining_try: 118000,
      monthly_payment_try: 59000,
      due_date: plusDays(16),
      status: "Açık",
      notes: "Bu ay kapanması gereken vergi ve SGK toplamı.",
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];

  return {
    meta: {
      version: 1,
      created_at: createdAt,
      updated_at: createdAt,
    },
    categories: CATEGORY_SEED.map((item) => ({
      ...item,
      created_at: createdAt,
      updated_at: createdAt,
    })),
    products: PRODUCT_SEED.map((item) => ({
      ...item,
      created_at: createdAt,
      updated_at: createdAt,
    })),
    leads,
    customers,
    orders,
    tasks,
    inventoryMovements,
    financeAccounts,
    financeEntries,
    financeLiabilities,
    sessions: [],
    settings: {
      companyName: "BERZAN",
      supportPhone: "+90 542 100 55 64",
      supportEmail: "destek@berzan.com.tr",
      heroBadge: "2026 Yeni Sezon",
      announcement: "Kurumsal toplu alımlarda aynı gün teklif dönüşü için uzman ekibimize yazın.",
      salesOwner: "Satış Ekibi",
      updated_at: createdAt,
    },
  };
}

async function ensureDbFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    const db = buildDefaultDb();
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
  }
}

async function readDb() {
  await ensureDbFile();
  const raw = await fs.readFile(DB_PATH, "utf8");
  const db = JSON.parse(raw);
  const defaults = buildDefaultDb();

  db.categories = Array.isArray(db.categories) ? db.categories : [];
  db.products = Array.isArray(db.products) ? db.products : [];
  db.leads = Array.isArray(db.leads) ? db.leads : [];
  db.customers = Array.isArray(db.customers) ? db.customers : [];
  db.orders = Array.isArray(db.orders) ? db.orders : [];
  db.tasks = Array.isArray(db.tasks) ? db.tasks : [];
  db.inventoryMovements = Array.isArray(db.inventoryMovements) ? db.inventoryMovements : [];
  db.financeAccounts = Array.isArray(db.financeAccounts) ? db.financeAccounts : defaults.financeAccounts;
  db.financeEntries = Array.isArray(db.financeEntries) ? db.financeEntries : defaults.financeEntries;
  db.financeLiabilities = Array.isArray(db.financeLiabilities) ? db.financeLiabilities : defaults.financeLiabilities;
  db.sessions = Array.isArray(db.sessions)
    ? db.sessions.filter((session) => new Date(session.expires_at).getTime() > Date.now())
    : [];
  db.settings = db.settings || {};

  return db;
}

async function writeDb(db) {
  db.meta = db.meta || {};
  db.meta.updated_at = nowIso();
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

async function mutateDb(mutator) {
  const db = await readDb();
  const result = await mutator(db);
  await writeDb(db);
  return result;
}

function decorateProduct(product, db) {
  return {
    ...product,
    category_name: findCategoryName(product.category_id, db),
    category_slug: findCategorySlug(product.category_id, db),
  };
}

function buildDashboard(db) {
  const openLeadStages = new Set(["Yeni", "İletişim Kuruldu", "Teklif Hazırlanıyor", "Teklif Gönderildi"]);
  const openTaskStatuses = new Set(["Açık", "Planlandı", "Beklemede"]);
  const totalRevenue = db.orders
    .filter((order) => order.status !== "İptal")
    .reduce((sum, order) => sum + toNumber(order.total_try), 0);
  const potentialRevenue = db.leads
    .filter((lead) => openLeadStages.has(lead.stage))
    .reduce((sum, lead) => sum + toNumber(lead.totals?.quote), 0);
  const lowStock = db.products
    .filter((product) => toNumber(product.stock) <= toNumber(product.reorder_point))
    .sort((a, b) => toNumber(a.stock) - toNumber(b.stock))
    .map((product) => decorateProduct(product, db));
  const urgentTasks = db.tasks
    .filter((task) => openTaskStatuses.has(task.status))
    .sort((a, b) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime())
    .slice(0, 5);
  const recentLeads = [...db.leads]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 6);
  const cashOnHand = db.financeAccounts
    .filter((account) => account.is_active !== false && isCashLikeAccount(account))
    .reduce((sum, account) => sum + toNumber(account.current_balance_try), 0);
  const currentDebt = db.financeLiabilities
    .filter((item) => item.status !== "Kapandı")
    .reduce((sum, item) => sum + toNumber(item.remaining_try), 0)
    + db.financeAccounts
      .filter((account) => account.is_active !== false && isCreditAccount(account))
      .reduce((sum, account) => sum + toNumber(account.current_balance_try), 0);
  const totalCreditLimit = db.financeAccounts
    .filter((account) => account.is_active !== false && isCreditAccount(account))
    .reduce((sum, account) => sum + toNumber(account.credit_limit_try), 0);
  const availableCredit = db.financeAccounts
    .filter((account) => account.is_active !== false && isCreditAccount(account))
    .reduce((sum, account) => sum + Math.max(toNumber(account.credit_limit_try) - toNumber(account.current_balance_try), 0), 0);
  const monthlyIncome = db.financeEntries
    .filter((entry) => entry.status === "Gerçekleşti" && isCurrentMonth(entry.transaction_date) && ["Gelir", "Tahsilat"].includes(entry.type))
    .reduce((sum, entry) => sum + toNumber(entry.amount_try), 0);
  const monthlyExpense = db.financeEntries
    .filter((entry) => entry.status === "Gerçekleşti" && isCurrentMonth(entry.transaction_date) && ["Gider", "Ödeme", "Borç Ödemesi"].includes(entry.type))
    .reduce((sum, entry) => sum + toNumber(entry.amount_try), 0);
  const recentFinanceEntries = [...db.financeEntries]
    .sort((a, b) => new Date(b.transaction_date || b.created_at || 0).getTime() - new Date(a.transaction_date || a.created_at || 0).getTime())
    .slice(0, 8);
  const upcomingLiabilities = [...db.financeLiabilities]
    .filter((item) => item.status !== "Kapandı")
    .sort((a, b) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime())
    .slice(0, 6);

  const stages = ["Yeni", "İletişim Kuruldu", "Teklif Hazırlanıyor", "Teklif Gönderildi", "Kazanıldı", "Kapandı"];
  const funnel = stages.map((stage) => ({
    stage,
    count: db.leads.filter((lead) => lead.stage === stage).length,
  }));

  return {
    totals: {
      products: db.products.length,
      activeProducts: db.products.filter((product) => product.is_active).length,
      leads: db.leads.length,
      openLeads: db.leads.filter((lead) => openLeadStages.has(lead.stage)).length,
      customers: db.customers.length,
      orders: db.orders.length,
      pendingTasks: db.tasks.filter((task) => openTaskStatuses.has(task.status)).length,
      lowStock: lowStock.length,
      totalRevenue,
      potentialRevenue,
      cashOnHand,
      currentDebt,
      monthlyIncome,
      monthlyExpense,
      totalCreditLimit,
      availableCredit,
    },
    funnel,
    lowStock: lowStock.slice(0, 6),
    urgentTasks,
    recentLeads,
    finance: {
      cashOnHand,
      currentDebt,
      monthlyIncome,
      monthlyExpense,
      totalCreditLimit,
      availableCredit,
      netCashFlow: monthlyIncome - monthlyExpense,
      recentEntries: recentFinanceEntries,
      upcomingLiabilities,
    },
  };
}

function summarizeCustomerOrders(customerId, db) {
  const customerOrders = db.orders.filter((order) => order.customer_id === customerId && order.status !== "İptal");
  const totalSpend = customerOrders.reduce((sum, order) => sum + toNumber(order.total_try), 0);
  const lastOrder = customerOrders
    .map((order) => order.created_at)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  return {
    totalSpend,
    lastOrder,
  };
}

function upsertCustomerFromLead(db, payload) {
  const email = String(payload.email || "").trim().toLowerCase();
  const phone = String(payload.phone || "").trim();
  const existing = db.customers.find((customer) => {
    const customerEmail = String(customer.email || "").trim().toLowerCase();
    const customerPhone = String(customer.phone || "").trim();
    return (email && customerEmail === email) || (phone && customerPhone === phone);
  });

  const baseData = {
    name: String(payload.name || "").trim(),
    company: String(payload.company || "").trim(),
    phone,
    email,
    city: String(payload.city || "").trim(),
    segment: payload.segment || "Kurumsal",
    status: "Aktif",
    assigned_to: payload.owner || db.settings.salesOwner || "Satış Ekibi",
    notes: String(payload.note || "").trim(),
    last_contact_at: nowIso(),
    updated_at: nowIso(),
  };

  if (existing) {
    Object.assign(existing, baseData);
    const summary = summarizeCustomerOrders(existing.id, db);
    existing.total_spend_try = summary.totalSpend;
    existing.last_order_at = summary.lastOrder || existing.last_order_at || null;
    return existing;
  }

  const created = {
    id: makeId("cus"),
    ...baseData,
    total_spend_try: 0,
    last_order_at: null,
    created_at: nowIso(),
  };

  db.customers.unshift(created);
  return created;
}

function sanitizeProduct(payload, fallback = {}) {
  const name = String(payload.name || fallback.name || "").trim();
  return {
    id: payload.id || fallback.id || makeId("prd"),
    sku: String(payload.sku || fallback.sku || "").trim() || `BZ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    slug: slugify(payload.slug || name || fallback.slug || fallback.name || "urun"),
    name,
    category_id: payload.category_id || fallback.category_id || CATEGORY_SEED[0].id,
    short_desc: String(payload.short_desc || fallback.short_desc || "").trim(),
    description: String(payload.description || fallback.description || payload.short_desc || "").trim(),
    cover_image_url: String(payload.cover_image_url || fallback.cover_image_url || "").trim(),
    price_try: toNumber(payload.price_try, toNumber(fallback.price_try)),
    quote_price_try: toNumber(payload.quote_price_try, toNumber(fallback.quote_price_try || payload.price_try)),
    stock: Math.max(0, toNumber(payload.stock, toNumber(fallback.stock))),
    reorder_point: Math.max(0, toNumber(payload.reorder_point, toNumber(fallback.reorder_point))),
    badges: dedupeStrings(toArray(payload.badges ?? fallback.badges)),
    sectors: dedupeStrings(toArray(payload.sectors ?? fallback.sectors)),
    seasons: dedupeStrings(toArray(payload.seasons ?? fallback.seasons)),
    sort: toNumber(payload.sort, toNumber(fallback.sort)),
    featured: Boolean(payload.featured ?? fallback.featured),
    is_active: Boolean(payload.is_active ?? fallback.is_active ?? true),
    created_at: fallback.created_at || nowIso(),
    updated_at: nowIso(),
  };
}

function sanitizeCategory(payload, fallback = {}) {
  const name = String(payload.name || fallback.name || "").trim();
  return {
    id: payload.id || fallback.id || makeId("cat"),
    slug: slugify(payload.slug || name || fallback.slug || "kategori"),
    name,
    description: String(payload.description || fallback.description || "").trim(),
    active: Boolean(payload.active ?? fallback.active ?? true),
    created_at: fallback.created_at || nowIso(),
    updated_at: nowIso(),
  };
}

function sanitizeLead(payload, fallback = {}) {
  const items = Array.isArray(payload.items ?? fallback.items)
    ? (payload.items ?? fallback.items).map((item) => ({
        id: String(item.id || item.product_id || "").trim(),
        sku: String(item.sku || "").trim(),
        name: String(item.name || "").trim(),
        qty: Math.max(1, toNumber(item.qty || item.quantity, 1)),
        price: Math.max(0, toNumber(item.price, 0)),
      }))
    : [];

  const retail = toNumber(payload.totals?.retail, items.reduce((sum, item) => sum + item.qty * item.price, 0));
  const quote = toNumber(payload.totals?.quote, retail);

  return {
    id: payload.id || fallback.id || makeId("lead"),
    lead_no: fallback.lead_no || payload.lead_no || null,
    customer_id: payload.customer_id || fallback.customer_id || null,
    name: String(payload.name || fallback.name || "").trim(),
    company: String(payload.company || fallback.company || "").trim(),
    phone: String(payload.phone || fallback.phone || "").trim(),
    email: String(payload.email || fallback.email || "").trim(),
    note: String(payload.note || fallback.note || "").trim(),
    items,
    totals: { retail, quote },
    stage: String(payload.stage || fallback.stage || "Yeni").trim(),
    priority: String(payload.priority || fallback.priority || "Orta").trim(),
    source: String(payload.source || fallback.source || "Web").trim(),
    owner: String(payload.owner || fallback.owner || "Satış Ekibi").trim(),
    page: String(payload.page || fallback.page || "").trim(),
    created_at: fallback.created_at || nowIso(),
    updated_at: nowIso(),
  };
}

function sanitizeCustomer(payload, fallback = {}) {
  return {
    id: payload.id || fallback.id || makeId("cus"),
    name: String(payload.name || fallback.name || "").trim(),
    company: String(payload.company || fallback.company || "").trim(),
    phone: String(payload.phone || fallback.phone || "").trim(),
    email: String(payload.email || fallback.email || "").trim(),
    city: String(payload.city || fallback.city || "").trim(),
    segment: String(payload.segment || fallback.segment || "Kurumsal").trim(),
    status: String(payload.status || fallback.status || "Aktif").trim(),
    total_spend_try: toNumber(payload.total_spend_try, toNumber(fallback.total_spend_try)),
    last_contact_at: payload.last_contact_at || fallback.last_contact_at || null,
    last_order_at: payload.last_order_at || fallback.last_order_at || null,
    assigned_to: String(payload.assigned_to || fallback.assigned_to || "Satış Ekibi").trim(),
    notes: String(payload.notes || fallback.notes || "").trim(),
    created_at: fallback.created_at || nowIso(),
    updated_at: nowIso(),
  };
}

function sanitizeOrder(payload, fallback = {}) {
  const items = Array.isArray(payload.items ?? fallback.items) ? payload.items ?? fallback.items : [];
  return {
    id: payload.id || fallback.id || makeId("ord"),
    order_no: payload.order_no || fallback.order_no || null,
    customer_id: payload.customer_id || fallback.customer_id || null,
    lead_id: payload.lead_id || fallback.lead_id || null,
    status: String(payload.status || fallback.status || "Taslak").trim(),
    payment_status: String(payload.payment_status || fallback.payment_status || "Bekleniyor").trim(),
    total_try: toNumber(payload.total_try, toNumber(fallback.total_try)),
    channel: String(payload.channel || fallback.channel || "Kurumsal").trim(),
    due_date: payload.due_date || fallback.due_date || null,
    items,
    created_at: fallback.created_at || nowIso(),
    updated_at: nowIso(),
  };
}

function sanitizeTask(payload, fallback = {}) {
  return {
    id: payload.id || fallback.id || makeId("tsk"),
    title: String(payload.title || fallback.title || "").trim(),
    status: String(payload.status || fallback.status || "Açık").trim(),
    priority: String(payload.priority || fallback.priority || "Orta").trim(),
    assignee: String(payload.assignee || fallback.assignee || "Satış Ekibi").trim(),
    due_date: payload.due_date || fallback.due_date || null,
    related_type: String(payload.related_type || fallback.related_type || "").trim(),
    related_id: String(payload.related_id || fallback.related_id || "").trim(),
    notes: String(payload.notes || fallback.notes || "").trim(),
    created_at: fallback.created_at || nowIso(),
    updated_at: nowIso(),
  };
}

function sanitizeSettings(payload, fallback = {}) {
  return {
    companyName: String(payload.companyName || fallback.companyName || "BERZAN").trim(),
    supportPhone: String(payload.supportPhone || fallback.supportPhone || "").trim(),
    supportEmail: String(payload.supportEmail || fallback.supportEmail || "").trim(),
    heroBadge: String(payload.heroBadge || fallback.heroBadge || "").trim(),
    announcement: String(payload.announcement || fallback.announcement || "").trim(),
    salesOwner: String(payload.salesOwner || fallback.salesOwner || "Satış Ekibi").trim(),
    updated_at: nowIso(),
  };
}

function sanitizeFinanceAccount(payload, fallback = {}) {
  return {
    id: payload.id || fallback.id || makeId("fac"),
    name: String(payload.name || fallback.name || "").trim(),
    type: String(payload.type || fallback.type || "Banka").trim(),
    institution: String(payload.institution || fallback.institution || "").trim(),
    currency: String(payload.currency || fallback.currency || "TRY").trim(),
    current_balance_try: toNumber(payload.current_balance_try, toNumber(fallback.current_balance_try)),
    credit_limit_try: toNumber(payload.credit_limit_try, toNumber(fallback.credit_limit_try)),
    due_day: payload.due_day === "" ? null : toNumber(payload.due_day, fallback.due_day ?? 0),
    notes: String(payload.notes || fallback.notes || "").trim(),
    is_active: Boolean(payload.is_active ?? fallback.is_active ?? true),
    created_at: fallback.created_at || nowIso(),
    updated_at: nowIso(),
  };
}

function sanitizeFinanceEntry(payload, fallback = {}) {
  return {
    id: payload.id || fallback.id || makeId("fen"),
    account_id: String(payload.account_id || fallback.account_id || "").trim(),
    title: String(payload.title || fallback.title || "").trim(),
    type: String(payload.type || fallback.type || "Gider").trim(),
    category: String(payload.category || fallback.category || "").trim(),
    amount_try: toNumber(payload.amount_try, toNumber(fallback.amount_try)),
    status: String(payload.status || fallback.status || "Gerçekleşti").trim(),
    transaction_date: payload.transaction_date || fallback.transaction_date || nowIso(),
    counterparty: String(payload.counterparty || fallback.counterparty || "").trim(),
    notes: String(payload.notes || fallback.notes || "").trim(),
    created_at: fallback.created_at || nowIso(),
    updated_at: nowIso(),
  };
}

function sanitizeFinanceLiability(payload, fallback = {}) {
  return {
    id: payload.id || fallback.id || makeId("fld"),
    title: String(payload.title || fallback.title || "").trim(),
    lender: String(payload.lender || fallback.lender || "").trim(),
    type: String(payload.type || fallback.type || "Borç").trim(),
    remaining_try: toNumber(payload.remaining_try, toNumber(fallback.remaining_try)),
    monthly_payment_try: toNumber(payload.monthly_payment_try, toNumber(fallback.monthly_payment_try)),
    due_date: payload.due_date || fallback.due_date || null,
    status: String(payload.status || fallback.status || "Açık").trim(),
    notes: String(payload.notes || fallback.notes || "").trim(),
    created_at: fallback.created_at || nowIso(),
    updated_at: nowIso(),
  };
}

export async function getAdminBootstrap() {
  const db = await readDb();
  return {
    dashboard: buildDashboard(db),
    categories: [...db.categories].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    products: [...db.products]
      .sort((a, b) => toNumber(a.sort) - toNumber(b.sort))
      .map((product) => decorateProduct(product, db)),
    leads: [...db.leads].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()),
    customers: [...db.customers].sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()),
    orders: [...db.orders].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()),
    tasks: [...db.tasks].sort((a, b) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime()),
    inventoryMovements: [...db.inventoryMovements]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 100),
    financeAccounts: [...db.financeAccounts].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    financeEntries: [...db.financeEntries].sort((a, b) => new Date(b.transaction_date || b.created_at || 0).getTime() - new Date(a.transaction_date || a.created_at || 0).getTime()),
    financeLiabilities: [...db.financeLiabilities].sort((a, b) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime()),
    settings: db.settings,
  };
}

export async function getPublicSettings() {
  const db = await readDb();
  const settings = db.settings || {};
  return {
    companyName: settings.companyName || "BERZAN",
    supportPhone: settings.supportPhone || "",
    supportEmail: settings.supportEmail || "",
    heroBadge: settings.heroBadge || "",
    announcement: settings.announcement || "",
  };
}

export async function getPublicProducts() {
  const db = await readDb();
  return db.products
    .filter((product) => product.is_active)
    .sort((a, b) => toNumber(a.sort) - toNumber(b.sort))
    .map((product) => decorateProduct(product, db));
}

export async function getPublicProduct(idOrSlug) {
  const db = await readDb();
  const key = String(idOrSlug || "").trim().toLowerCase();
  const product = db.products.find((item) => item.id === key || String(item.slug || "").toLowerCase() === key);
  return product ? decorateProduct(product, db) : null;
}

export async function createAdminSession(username) {
  return mutateDb(async (db) => {
    const token = crypto.randomBytes(24).toString("hex");
    db.sessions.push({
      token,
      username,
      created_at: nowIso(),
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(),
    });
    return { token, username };
  });
}

export async function getSession(token) {
  const db = await readDb();
  const session = db.sessions.find((item) => item.token === token);
  return session || null;
}

export async function revokeSession(token) {
  return mutateDb(async (db) => {
    db.sessions = db.sessions.filter((item) => item.token !== token);
    return { ok: true };
  });
}

export async function saveResource(resource, payload) {
  return mutateDb(async (db) => {
    if (resource === "categories") {
      const existing = db.categories.find((item) => item.id === payload.id);
      const category = sanitizeCategory(payload, existing);
      if (existing) Object.assign(existing, category);
      else db.categories.unshift(category);
      return category;
    }

    if (resource === "products") {
      const existing = db.products.find((item) => item.id === payload.id);
      const product = sanitizeProduct(payload, existing);
      if (existing) Object.assign(existing, product);
      else db.products.unshift(product);
      return decorateProduct(product, db);
    }

    if (resource === "leads") {
      const existing = db.leads.find((item) => item.id === payload.id);
      const lead = sanitizeLead(payload, existing);
      if (!lead.lead_no) lead.lead_no = makeLeadNo(db);
      if (existing) Object.assign(existing, lead);
      else db.leads.unshift(lead);
      return lead;
    }

    if (resource === "customers") {
      const existing = db.customers.find((item) => item.id === payload.id);
      const customer = sanitizeCustomer(payload, existing);
      if (existing) Object.assign(existing, customer);
      else db.customers.unshift(customer);
      return customer;
    }

    if (resource === "orders") {
      const existing = db.orders.find((item) => item.id === payload.id);
      const order = sanitizeOrder(payload, existing);
      if (!order.order_no) order.order_no = makeOrderNo(db);
      if (existing) Object.assign(existing, order);
      else db.orders.unshift(order);

      if (order.customer_id) {
        const customer = db.customers.find((item) => item.id === order.customer_id);
        if (customer) {
          const summary = summarizeCustomerOrders(customer.id, db);
          customer.total_spend_try = summary.totalSpend;
          customer.last_order_at = summary.lastOrder || order.created_at;
          customer.updated_at = nowIso();
        }
      }

      return order;
    }

    if (resource === "tasks") {
      const existing = db.tasks.find((item) => item.id === payload.id);
      const task = sanitizeTask(payload, existing);
      if (existing) Object.assign(existing, task);
      else db.tasks.unshift(task);
      return task;
    }

    if (resource === "financeAccounts") {
      const existing = db.financeAccounts.find((item) => item.id === payload.id);
      const account = sanitizeFinanceAccount(payload, existing);
      if (existing) Object.assign(existing, account);
      else db.financeAccounts.unshift(account);
      return account;
    }

    if (resource === "financeEntries") {
      const existing = db.financeEntries.find((item) => item.id === payload.id);
      const entry = sanitizeFinanceEntry(payload, existing);
      if (existing) Object.assign(existing, entry);
      else db.financeEntries.unshift(entry);
      return entry;
    }

    if (resource === "financeLiabilities") {
      const existing = db.financeLiabilities.find((item) => item.id === payload.id);
      const liability = sanitizeFinanceLiability(payload, existing);
      if (existing) Object.assign(existing, liability);
      else db.financeLiabilities.unshift(liability);
      return liability;
    }

    throw new Error("Unknown resource");
  });
}

export async function deleteResource(resource, id) {
  return mutateDb(async (db) => {
    const collections = {
      categories: "categories",
      products: "products",
      leads: "leads",
      customers: "customers",
      orders: "orders",
      tasks: "tasks",
      financeAccounts: "financeAccounts",
      financeEntries: "financeEntries",
      financeLiabilities: "financeLiabilities",
    };

    const key = collections[resource];
    if (!key) throw new Error("Unknown resource");

    if (resource === "categories" && db.products.some((product) => product.category_id === id)) {
      throw new Error("Bu kategoriye bağlı ürünler var.");
    }

    if (resource === "financeAccounts" && db.financeEntries.some((entry) => entry.account_id === id)) {
      throw new Error("Bu hesaba bağlı finans hareketleri var.");
    }

    db[key] = db[key].filter((item) => item.id !== id);
    return { ok: true };
  });
}

export async function saveSettings(payload) {
  return mutateDb(async (db) => {
    db.settings = sanitizeSettings(payload, db.settings);
    return db.settings;
  });
}

export async function addInventoryMovement(payload) {
  return mutateDb(async (db) => {
    const product = db.products.find((item) => item.id === payload.product_id);
    if (!product) throw new Error("Ürün bulunamadı");

    const quantity = Math.max(1, toNumber(payload.quantity, 1));
    const type = String(payload.type || "Giris").trim();
    const delta = type === "Cikis" ? -quantity : quantity;
    const nextStock = Math.max(0, toNumber(product.stock) + delta);

    product.stock = nextStock;
    product.updated_at = nowIso();

    const movement = {
      id: makeId("mov"),
      product_id: product.id,
      product_name: product.name,
      type,
      quantity,
      reason: String(payload.reason || "").trim(),
      created_at: nowIso(),
    };

    db.inventoryMovements.unshift(movement);
    return {
      movement,
      product: decorateProduct(product, db),
    };
  });
}

export async function convertLeadToOrder(leadId) {
  return mutateDb(async (db) => {
    const lead = db.leads.find((item) => item.id === leadId);
    if (!lead) throw new Error("Teklif bulunamadı");

    const existing = db.orders.find((order) => order.lead_id === lead.id);
    if (existing) return existing;

    const order = {
      id: makeId("ord"),
      order_no: makeOrderNo(db),
      customer_id: lead.customer_id || null,
      lead_id: lead.id,
      status: "Operasyonda",
      payment_status: "Teklif",
      total_try: toNumber(lead.totals?.quote),
      channel: "Kurumsal",
      due_date: plusDays(7),
      items: lead.items || [],
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    db.orders.unshift(order);
    lead.stage = "Kazanıldı";
    lead.updated_at = nowIso();

    if (lead.customer_id) {
      const customer = db.customers.find((item) => item.id === lead.customer_id);
      if (customer) {
        const summary = summarizeCustomerOrders(customer.id, db);
        customer.total_spend_try = summary.totalSpend;
        customer.last_order_at = summary.lastOrder || order.created_at;
        customer.updated_at = nowIso();
      }
    }

    db.tasks.unshift({
      id: makeId("tsk"),
      title: `${lead.company || lead.name} sipariş operasyonunu başlat`,
      status: "Planlandı",
      priority: "Yüksek",
      assignee: db.settings.salesOwner || "Satış Ekibi",
      due_date: plusDays(1),
      related_type: "order",
      related_id: order.id,
      notes: "Sipariş ERP panelinden teklif dönüşü ile oluşturuldu.",
      created_at: nowIso(),
      updated_at: nowIso(),
    });

    return order;
  });
}

export async function createPublicLead(payload) {
  return mutateDb(async (db) => {
    const lead = sanitizeLead(
      {
        ...payload,
        source: payload.source || "Web Form",
        stage: "Yeni",
        priority: toNumber(payload.totals?.quote) >= 25000 ? "Yüksek" : "Orta",
        owner: db.settings.salesOwner || "Satış Ekibi",
      },
      {}
    );
    lead.lead_no = makeLeadNo(db);

    const customer = upsertCustomerFromLead(db, lead);
    lead.customer_id = customer.id;

    db.leads.unshift(lead);
    db.tasks.unshift({
      id: makeId("tsk"),
      title: `${lead.company || lead.name} için ilk aramayı yap`,
      status: "Açık",
      priority: lead.priority,
      assignee: db.settings.salesOwner || "Satış Ekibi",
      due_date: plusDays(1),
      related_type: "lead",
      related_id: lead.id,
      notes: "Web sitesi üzerinden yeni talep geldi.",
      created_at: nowIso(),
      updated_at: nowIso(),
    });

    return {
      lead,
      customer,
    };
  });
}
