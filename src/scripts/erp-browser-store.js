import seedDb from "../../api/data/erp-db.json";
import { emitAppSync } from "./live-sync.js";

const LOCAL_DB_KEY = "berzan_erp_local_db_v1";
const LOCAL_SESSION_KEY = "berzan_admin_local_session_v1";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function plusDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
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

function dedupeStrings(values) {
  return [...new Set((values || []).map((item) => String(item || "").trim()).filter(Boolean))];
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

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function makeError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
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

function getConfig() {
  return window.BERZAN_CFG || {};
}

function getDefaultAdminUsername() {
  return String(getConfig().adminUsername || "Qazi").trim();
}

function getDefaultAdminPassword() {
  return String(getConfig().adminPassword || "2+2=1");
}

function buildDefaultDb() {
  const db = clone(seedDb);
  db.sessions = [];
  db.meta = db.meta || {};
  db.meta.created_at = db.meta.created_at || nowIso();
  db.meta.updated_at = nowIso();
  return db;
}

function ensureDbShape(db) {
  const fallback = buildDefaultDb();
  db.meta = db.meta || {};
  db.categories = Array.isArray(db.categories) ? db.categories : fallback.categories;
  db.products = Array.isArray(db.products) ? db.products : fallback.products;
  db.leads = Array.isArray(db.leads) ? db.leads : fallback.leads;
  db.customers = Array.isArray(db.customers) ? db.customers : fallback.customers;
  db.orders = Array.isArray(db.orders) ? db.orders : fallback.orders;
  db.tasks = Array.isArray(db.tasks) ? db.tasks : fallback.tasks;
  db.inventoryMovements = Array.isArray(db.inventoryMovements) ? db.inventoryMovements : fallback.inventoryMovements;
  db.financeAccounts = Array.isArray(db.financeAccounts) ? db.financeAccounts : fallback.financeAccounts;
  db.financeEntries = Array.isArray(db.financeEntries) ? db.financeEntries : fallback.financeEntries;
  db.financeLiabilities = Array.isArray(db.financeLiabilities) ? db.financeLiabilities : fallback.financeLiabilities;
  db.settings = db.settings || fallback.settings || {};
  return db;
}

function readDb() {
  try {
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (!raw) {
      const db = buildDefaultDb();
      localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
      return db;
    }
    return ensureDbShape(JSON.parse(raw));
  } catch {
    const db = buildDefaultDb();
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
    return db;
  }
}

function writeDb(db) {
  db.meta = db.meta || {};
  db.meta.updated_at = nowIso();
  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
  emitAppSync("erp:db-updated", "all", {
    updatedAt: db.meta.updated_at,
  });
}

function mutateDb(mutator) {
  const db = readDb();
  const result = mutator(db);
  writeDb(db);
  return result;
}

function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function setStoredSession(session) {
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
  emitAppSync("erp:session-updated", "session", {
    loggedIn: true,
    username: session?.username || "",
  });
}

function clearStoredSession() {
  localStorage.removeItem(LOCAL_SESSION_KEY);
  emitAppSync("erp:session-updated", "session", {
    loggedIn: false,
  });
}

function validateLocalSession(token) {
  const session = getStoredSession();
  if (!session || !token || session.token !== token) {
    throw makeError("Oturum süresi dolmuş", 401);
  }
  return session;
}

function findCategoryName(categoryId, db) {
  return db.categories.find((item) => item.id === categoryId)?.name || "Kategori yok";
}

function findCategorySlug(categoryId, db) {
  return db.categories.find((item) => item.id === categoryId)?.slug || "";
}

function decorateProduct(product, db) {
  return {
    ...product,
    category_name: findCategoryName(product.category_id, db),
    category_slug: findCategorySlug(product.category_id, db),
  };
}

function makeOrderNo(db) {
  return `BZ-${new Date().getFullYear()}-${String((db.orders || []).length + 1).padStart(4, "0")}`;
}

function makeLeadNo(db) {
  return `LD-${new Date().getFullYear()}-${String((db.leads || []).length + 1).padStart(4, "0")}`;
}

function summarizeCustomerOrders(customerId, db) {
  const customerOrders = db.orders.filter((order) => order.customer_id === customerId && order.status !== "İptal");
  const totalSpend = customerOrders.reduce((sum, order) => sum + toNumber(order.total_try), 0);
  const lastOrder = customerOrders
    .map((order) => order.created_at)
    .sort((a, b) => new Date(b || 0).getTime() - new Date(a || 0).getTime())[0];

  return {
    totalSpend,
    lastOrder,
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

function sanitizeProduct(payload, fallback = {}) {
  const name = String(payload.name || fallback.name || "").trim();
  return {
    id: payload.id || fallback.id || makeId("prd"),
    sku: String(payload.sku || fallback.sku || "").trim() || `BZ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    slug: slugify(payload.slug || name || fallback.slug || "urun"),
    name,
    category_id: payload.category_id || fallback.category_id || "",
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

function sanitizeLead(payload, fallback = {}) {
  const fallbackTotals = fallback.totals || {};
  const totals = payload.totals || fallbackTotals || {};
  const items = Array.isArray(payload.items ?? fallback.items)
    ? (payload.items ?? fallback.items).map((item) => ({
        id: String(item.id || item.product_id || "").trim(),
        sku: String(item.sku || "").trim(),
        name: String(item.name || "").trim(),
        qty: Math.max(1, toNumber(item.qty || item.quantity, 1)),
        price: Math.max(0, toNumber(item.price)),
      }))
    : [];

  return {
    id: payload.id || fallback.id || makeId("lead"),
    lead_no: String(payload.lead_no || fallback.lead_no || "").trim(),
    customer_id: payload.customer_id || fallback.customer_id || null,
    name: String(payload.name || fallback.name || "").trim(),
    company: String(payload.company || fallback.company || "").trim(),
    phone: String(payload.phone || fallback.phone || "").trim(),
    email: String(payload.email || fallback.email || "").trim(),
    note: String(payload.note || fallback.note || "").trim(),
    items,
    totals: {
      retail: toNumber(totals.retail, toNumber(fallbackTotals.retail)),
      quote: toNumber(totals.quote, toNumber(fallbackTotals.quote)),
    },
    stage: String(payload.stage || fallback.stage || "Yeni").trim(),
    priority: String(payload.priority || fallback.priority || "Orta").trim(),
    source: String(payload.source || fallback.source || "Web Form").trim(),
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
    email: String(payload.email || fallback.email || "").trim().toLowerCase(),
    city: String(payload.city || fallback.city || "").trim(),
    segment: String(payload.segment || fallback.segment || "Kurumsal").trim(),
    status: String(payload.status || fallback.status || "Aktif").trim(),
    total_spend_try: toNumber(payload.total_spend_try, toNumber(fallback.total_spend_try)),
    last_contact_at: payload.last_contact_at || fallback.last_contact_at || nowIso(),
    last_order_at: payload.last_order_at || fallback.last_order_at || null,
    assigned_to: String(payload.assigned_to || fallback.assigned_to || "Satış Ekibi").trim(),
    notes: String(payload.notes || fallback.notes || "").trim(),
    created_at: fallback.created_at || nowIso(),
    updated_at: nowIso(),
  };
}

function sanitizeOrder(payload, fallback = {}) {
  return {
    id: payload.id || fallback.id || makeId("ord"),
    order_no: String(payload.order_no || fallback.order_no || "").trim(),
    customer_id: payload.customer_id || fallback.customer_id || null,
    lead_id: payload.lead_id || fallback.lead_id || null,
    status: String(payload.status || fallback.status || "Taslak").trim(),
    payment_status: String(payload.payment_status || fallback.payment_status || "Bekleniyor").trim(),
    total_try: toNumber(payload.total_try, toNumber(fallback.total_try)),
    channel: String(payload.channel || fallback.channel || "").trim(),
    due_date: payload.due_date || fallback.due_date || null,
    items: Array.isArray(payload.items ?? fallback.items) ? clone(payload.items ?? fallback.items) : [],
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
  const currentDebt =
    db.financeLiabilities
      .filter((item) => item.status !== "Kapandı")
      .reduce((sum, item) => sum + toNumber(item.remaining_try), 0) +
    db.financeAccounts
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

export function isLocalAdminToken(token) {
  return String(token || "").startsWith("local-");
}

export function loginLocalAdmin(username, password) {
  const cleanUsername = String(username || "").trim();
  const cleanPassword = String(password || "");
  if (cleanUsername !== getDefaultAdminUsername() || cleanPassword !== getDefaultAdminPassword()) {
    throw makeError("Kullanıcı adı veya şifre hatalı", 401);
  }

  const session = {
    token: `local-${crypto.randomUUID()}`,
    username: cleanUsername,
    created_at: nowIso(),
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  };

  setStoredSession(session);
  return { ok: true, token: session.token, username: session.username, mode: "local" };
}

export function logoutLocalAdmin() {
  clearStoredSession();
}

export function getLocalAdminBootstrap(token) {
  const session = validateLocalSession(token);
  const db = readDb();
  return {
    ok: true,
    username: session.username,
    dashboard: buildDashboard(db),
    categories: [...db.categories].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    products: [...db.products].sort((a, b) => toNumber(a.sort) - toNumber(b.sort)).map((item) => decorateProduct(item, db)),
    leads: [...db.leads].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()),
    customers: [...db.customers].sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()),
    orders: [...db.orders].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()),
    tasks: [...db.tasks].sort((a, b) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime()),
    inventoryMovements: [...db.inventoryMovements].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).slice(0, 100),
    financeAccounts: [...db.financeAccounts].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    financeEntries: [...db.financeEntries].sort((a, b) => new Date(b.transaction_date || b.created_at || 0).getTime() - new Date(a.transaction_date || a.created_at || 0).getTime()),
    financeLiabilities: [...db.financeLiabilities].sort((a, b) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime()),
    settings: db.settings,
  };
}

export function saveLocalResource(resource, payload) {
  return mutateDb((db) => {
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

    throw makeError("Bilinmeyen kayıt türü");
  });
}

export function deleteLocalResource(resource, id) {
  return mutateDb((db) => {
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
    if (!key) throw makeError("Bilinmeyen kayıt türü");

    if (resource === "categories" && db.products.some((product) => product.category_id === id)) {
      throw makeError("Bu kategoriye bağlı ürünler var.");
    }

    if (resource === "financeAccounts" && db.financeEntries.some((entry) => entry.account_id === id)) {
      throw makeError("Bu hesaba bağlı finans hareketleri var.");
    }

    db[key] = db[key].filter((item) => item.id !== id);
    return { ok: true };
  });
}

export function saveLocalSettings(payload) {
  return mutateDb((db) => {
    db.settings = sanitizeSettings(payload, db.settings);
    return db.settings;
  });
}

export function addLocalInventoryMovement(payload) {
  return mutateDb((db) => {
    const product = db.products.find((item) => item.id === payload.product_id);
    if (!product) throw makeError("Ürün bulunamadı");

    const quantity = Math.max(1, toNumber(payload.quantity, 1));
    const type = String(payload.type || "Giris").trim();
    const delta = type === "Cikis" ? -quantity : quantity;
    product.stock = Math.max(0, toNumber(product.stock) + delta);
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

export function convertLocalLeadToOrder(leadId) {
  return mutateDb((db) => {
    const lead = db.leads.find((item) => item.id === leadId);
    if (!lead) throw makeError("Teklif bulunamadı");

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
      notes: "Sipariş yerel ERP akışıyla oluşturuldu.",
      created_at: nowIso(),
      updated_at: nowIso(),
    });

    return order;
  });
}

export function getLocalPublicSettings() {
  const settings = readDb().settings || {};
  return {
    companyName: settings.companyName || "BERZAN",
    supportPhone: settings.supportPhone || "",
    supportEmail: settings.supportEmail || "",
    heroBadge: settings.heroBadge || "",
    announcement: settings.announcement || "",
  };
}

export function getLocalPublicProducts() {
  const db = readDb();
  return db.products
    .filter((product) => product.is_active)
    .sort((a, b) => toNumber(a.sort) - toNumber(b.sort))
    .map((product) => decorateProduct(product, db));
}

export function getLocalPublicProduct(idOrSlug) {
  const db = readDb();
  const key = String(idOrSlug || "").trim().toLowerCase();
  const product = db.products.find((item) => item.id === key || String(item.slug || "").toLowerCase() === key);
  return product ? decorateProduct(product, db) : null;
}

export function createLocalPublicLead(payload) {
  return mutateDb((db) => {
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

    return { lead, customer };
  });
}
