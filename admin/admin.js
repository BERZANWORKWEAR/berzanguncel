const cfg = window.BERZAN_CFG || {};
const apiBase = String(cfg.apiBaseUrl || "").replace(/\/$/, "");
const authTokenKey = "berzan_admin_token";

const state = {
  username: "",
  dashboard: null,
  categories: [],
  products: [],
  leads: [],
  customers: [],
  orders: [],
  tasks: [],
  inventoryMovements: [],
  financeAccounts: [],
  financeEntries: [],
  financeLiabilities: [],
  settings: {},
};

const viewTitles = {
  dashboard: "Kontrol Merkezi",
  catalog: "Katalog",
  leads: "Teklif Havuzu",
  customers: "Müşteriler",
  orders: "Siparişler",
  inventory: "Stok",
  finance: "Finans",
  tasks: "Görevler",
  settings: "Ayarlar",
};

const resourceMeta = {
  categories: {
    label: "Kategori",
    endpoint: "/api/admin/categories",
    fields: [
      { name: "name", label: "Kategori Adı", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text" },
      { name: "description", label: "Açıklama", type: "textarea" },
      { name: "active", label: "Aktif", type: "checkbox", default: true },
    ],
  },
  products: {
    label: "Ürün",
    endpoint: "/api/admin/products",
    fields: [
      { name: "name", label: "Ürün Adı", type: "text", required: true },
      { name: "sku", label: "SKU", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text" },
      { name: "category_id", label: "Kategori", type: "select", options: () => state.categories.map((item) => ({ value: item.id, label: item.name })), required: true },
      { name: "price_try", label: "Perakende Fiyat", type: "number", required: true },
      { name: "quote_price_try", label: "Teklif Fiyatı", type: "number" },
      { name: "stock", label: "Stok", type: "number" },
      { name: "reorder_point", label: "Reorder Eşiği", type: "number" },
      { name: "sort", label: "Sıra", type: "number" },
      { name: "cover_image_url", label: "Görsel URL", type: "text" },
      { name: "short_desc", label: "Kısa Açıklama", type: "textarea" },
      { name: "description", label: "Detay Açıklama", type: "textarea" },
      { name: "badges", label: "Rozetler", type: "tags", placeholder: "EN/CE, Reflektör" },
      { name: "sectors", label: "Sektörler", type: "tags", placeholder: "insaat, lojistik" },
      { name: "seasons", label: "Sezonlar", type: "tags", placeholder: "kislik, sezonluk" },
      { name: "featured", label: "Öne Çıkan", type: "checkbox", default: false },
      { name: "is_active", label: "Satışta", type: "checkbox", default: true },
    ],
  },
  leads: {
    label: "Teklif",
    endpoint: "/api/admin/leads",
    fields: [
      { name: "name", label: "Ad Soyad", type: "text", required: true },
      { name: "company", label: "Firma", type: "text" },
      { name: "phone", label: "Telefon", type: "text", required: true },
      { name: "email", label: "E-posta", type: "email" },
      { name: "stage", label: "Aşama", type: "select", options: ["Yeni", "İletişim Kuruldu", "Teklif Hazırlanıyor", "Teklif Gönderildi", "Kazanıldı", "Kapandı"] },
      { name: "priority", label: "Öncelik", type: "select", options: ["Düşük", "Orta", "Yüksek"] },
      { name: "source", label: "Kaynak", type: "text" },
      { name: "owner", label: "Sorumlu", type: "text" },
      { name: "retail_total", label: "Liste Toplamı", type: "number" },
      { name: "quote_total", label: "Teklif Toplamı", type: "number" },
      { name: "note", label: "Not", type: "textarea" },
    ],
  },
  customers: {
    label: "Müşteri",
    endpoint: "/api/admin/customers",
    fields: [
      { name: "name", label: "Ad Soyad", type: "text", required: true },
      { name: "company", label: "Firma", type: "text" },
      { name: "phone", label: "Telefon", type: "text" },
      { name: "email", label: "E-posta", type: "email" },
      { name: "city", label: "Şehir", type: "text" },
      { name: "segment", label: "Segment", type: "select", options: ["Kurumsal", "Perakende", "Distribütör"] },
      { name: "status", label: "Durum", type: "select", options: ["Aktif", "Pasif", "Aday"] },
      { name: "assigned_to", label: "Sorumlu", type: "text" },
      { name: "notes", label: "Notlar", type: "textarea" },
    ],
  },
  orders: {
    label: "Sipariş",
    endpoint: "/api/admin/orders",
    fields: [
      { name: "customer_id", label: "Müşteri", type: "select", options: () => state.customers.map((item) => ({ value: item.id, label: item.company || item.name })) },
      { name: "status", label: "Durum", type: "select", options: ["Taslak", "Onay Bekliyor", "Operasyonda", "Sevkte", "Tamamlandı", "İptal"] },
      { name: "payment_status", label: "Ödeme", type: "select", options: ["Teklif", "Bekleniyor", "Kısmi", "Tamamlandı"] },
      { name: "total_try", label: "Tutar", type: "number", required: true },
      { name: "channel", label: "Kanal", type: "text" },
      { name: "due_date", label: "Termin", type: "date" },
    ],
  },
  tasks: {
    label: "Görev",
    endpoint: "/api/admin/tasks",
    fields: [
      { name: "title", label: "Görev", type: "text", required: true },
      { name: "assignee", label: "Sorumlu", type: "text" },
      { name: "due_date", label: "Bitiş", type: "date" },
      { name: "status", label: "Durum", type: "select", options: ["Açık", "Planlandı", "Beklemede", "Tamamlandı"] },
      { name: "priority", label: "Öncelik", type: "select", options: ["Düşük", "Orta", "Yüksek"] },
      { name: "notes", label: "Notlar", type: "textarea" },
    ],
  },
  financeAccounts: {
    label: "Finans Hesabı",
    endpoint: "/api/admin/financeAccounts",
    fields: [
      { name: "name", label: "Hesap Adı", type: "text", required: true },
      { name: "type", label: "Tür", type: "select", options: ["Kasa", "Banka", "Kredi Karti", "Kredi", "KMH", "E-Cuzdan"] },
      { name: "institution", label: "Kurum", type: "text" },
      { name: "currency", label: "Para Birimi", type: "select", options: ["TRY", "USD", "EUR"] },
      { name: "current_balance_try", label: "Güncel Bakiye / Kullanım", type: "number", required: true },
      { name: "credit_limit_try", label: "Kredi Limiti", type: "number" },
      { name: "due_day", label: "Son Ödeme Günü", type: "number" },
      { name: "notes", label: "Notlar", type: "textarea" },
      { name: "is_active", label: "Aktif", type: "checkbox", default: true },
    ],
  },
  financeEntries: {
    label: "Finans Hareketi",
    endpoint: "/api/admin/financeEntries",
    fields: [
      { name: "title", label: "Hareket Başlığı", type: "text", required: true },
      { name: "account_id", label: "Hesap", type: "select", options: () => state.financeAccounts.map((item) => ({ value: item.id, label: item.name })) },
      { name: "type", label: "Tip", type: "select", options: ["Gelir", "Tahsilat", "Gider", "Ödeme", "Borç Ödemesi"] },
      { name: "category", label: "Kategori", type: "text" },
      { name: "amount_try", label: "Tutar", type: "number", required: true },
      { name: "status", label: "Durum", type: "select", options: ["Gerçekleşti", "Planlandı"] },
      { name: "transaction_date", label: "Tarih", type: "date" },
      { name: "counterparty", label: "Karşı Taraf", type: "text" },
      { name: "notes", label: "Notlar", type: "textarea" },
    ],
  },
  financeLiabilities: {
    label: "Borç Kaydı",
    endpoint: "/api/admin/financeLiabilities",
    fields: [
      { name: "title", label: "Borç Başlığı", type: "text", required: true },
      { name: "lender", label: "Kurum / Kişi", type: "text" },
      { name: "type", label: "Tür", type: "select", options: ["Tedarikçi Borcu", "Banka Kredisi", "Kredi Kartı", "Vergi", "Maaş", "Diğer"] },
      { name: "remaining_try", label: "Kalan Tutar", type: "number", required: true },
      { name: "monthly_payment_try", label: "Aylık Ödeme", type: "number" },
      { name: "due_date", label: "Vade Tarihi", type: "date" },
      { name: "status", label: "Durum", type: "select", options: ["Açık", "Yeniden Yapılandırıldı", "Kapandı"] },
      { name: "notes", label: "Notlar", type: "textarea" },
    ],
  },
};

function apiUrl(path) {
  return `${apiBase}${path}`;
}

function getToken() {
  return localStorage.getItem(authTokenKey) || "";
}

async function apiFetch(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || "İstek başarısız");
    error.status = response.status;
    throw error;
  }

  return data;
}

function formatMoney(value) {
  return `₺ ${new Intl.NumberFormat("tr-TR").format(Number(value || 0))}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(message, kind = "success") {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.dataset.kind = kind;
  el.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => el.classList.remove("is-visible"), 2400);
}

function setBootVisible(visible) {
  document.getElementById("bootState").style.display = visible ? "grid" : "none";
}

function setActiveView(view) {
  document.getElementById("viewTitle").textContent = viewTitles[view] || "ERP";
  document.querySelectorAll(".erp-nav-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
  document.querySelectorAll(".erp-view").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.viewPanel === view);
  });
}

function customerLabel(customerId) {
  const customer = state.customers.find((item) => item.id === customerId);
  return customer ? customer.company || customer.name : "Bağlı değil";
}

function accountLabel(accountId) {
  const account = state.financeAccounts.find((item) => item.id === accountId);
  return account ? account.name : "Hesap yok";
}

function badgeClass(kind, value) {
  const key = `${kind}-${String(value || "")
    .toLowerCase()
    .replace(/[ğ]/g, "g")
    .replace(/[ü]/g, "u")
    .replace(/[ş]/g, "s")
    .replace(/[ı]/g, "i")
    .replace(/[ö]/g, "o")
    .replace(/[ç]/g, "c")
    .replace(/\s+/g, "-")}`;
  return `erp-badge ${key}`;
}

function renderList(containerId, items, formatter, emptyText) {
  const container = document.getElementById(containerId);
  if (!items.length) {
    container.innerHTML = `<div class="erp-empty">${escapeHtml(emptyText)}</div>`;
    return;
  }
  container.innerHTML = items.map(formatter).join("");
}

function renderDashboard() {
  const totals = state.dashboard?.totals || {};
  document.getElementById("metricOpenLeads").textContent = String(totals.openLeads || 0);
  document.getElementById("metricPotentialRevenue").textContent = formatMoney(totals.potentialRevenue || 0);
  document.getElementById("metricOrders").textContent = String(totals.orders || 0);
  document.getElementById("metricLowStock").textContent = String(totals.lowStock || 0);
  document.getElementById("metricCashOnHand").textContent = formatMoney(totals.cashOnHand || 0);
  document.getElementById("metricCurrentDebt").textContent = formatMoney(totals.currentDebt || 0);
  document.getElementById("metricMonthlyIncome").textContent = formatMoney(totals.monthlyIncome || 0);
  document.getElementById("metricMonthlyExpense").textContent = formatMoney(totals.monthlyExpense || 0);
  document.getElementById("metricAvailableCredit").textContent = formatMoney(totals.availableCredit || 0);

  const funnelGrid = document.getElementById("funnelGrid");
  funnelGrid.innerHTML = (state.dashboard?.funnel || [])
    .map(
      (item) => `
        <article class="erp-stage-card">
          <span>${escapeHtml(item.stage)}</span>
          <strong>${item.count}</strong>
        </article>
      `
    )
    .join("");

  renderList(
    "urgentTasksList",
    state.dashboard?.urgentTasks || [],
    (task) => `
      <article class="erp-list-item">
        <div>
          <strong>${escapeHtml(task.title)}</strong>
          <p>${escapeHtml(task.assignee || "Atanmadı")} • ${formatDate(task.due_date)}</p>
        </div>
        <span class="${badgeClass("priority", task.priority)}">${escapeHtml(task.priority)}</span>
      </article>
    `,
    "Acil görev bulunmuyor."
  );

  renderList(
    "recentLeadsList",
    state.dashboard?.recentLeads || [],
    (lead) => `
      <article class="erp-list-item">
        <div>
          <strong>${escapeHtml(lead.company || lead.name)}</strong>
          <p>${escapeHtml(lead.note || "Talep notu yok")}</p>
        </div>
        <span class="${badgeClass("stage", lead.stage)}">${escapeHtml(lead.stage)}</span>
      </article>
    `,
    "Henüz talep kaydı yok."
  );

  renderList(
    "upcomingLiabilitiesList",
    state.dashboard?.finance?.upcomingLiabilities || [],
    (item) => `
      <article class="erp-list-item">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.lender || "Kurum yok")} • ${formatDate(item.due_date)}</p>
        </div>
        <span class="${badgeClass("debt", item.status)}">${formatMoney(item.remaining_try)}</span>
      </article>
    `,
    "Yaklaşan borç görünmüyor."
  );

  renderList(
    "recentFinanceList",
    state.dashboard?.finance?.recentEntries || [],
    (item) => `
      <article class="erp-list-item">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(accountLabel(item.account_id))} • ${formatDate(item.transaction_date)}</p>
        </div>
        <span class="${badgeClass("entry", item.type)}">${formatMoney(item.amount_try)}</span>
      </article>
    `,
    "Finans hareketi yok."
  );

  renderList(
    "lowStockList",
    state.dashboard?.lowStock || [],
    (product) => `
      <article class="erp-list-item">
        <div>
          <strong>${escapeHtml(product.name)}</strong>
          <p>${escapeHtml(product.category_name)} • Reorder ${product.reorder_point}</p>
        </div>
        <span class="${badgeClass("stock", Number(product.stock) <= Number(product.reorder_point) ? "risk" : "ok")}">${product.stock} adet</span>
      </article>
    `,
    "Stok alarmı yok."
  );
}

function renderProducts() {
  const tbody = document.getElementById("productsTableBody");
  tbody.innerHTML = state.products
    .map(
      (product) => `
        <tr>
          <td>
            <div class="erp-cell-stack">
              <strong>${escapeHtml(product.name)}</strong>
              <span>${escapeHtml(product.sku)} • /urun/?urun=${escapeHtml(product.slug)}</span>
            </div>
          </td>
          <td>${escapeHtml(product.category_name || "—")}</td>
          <td>
            <div class="erp-cell-stack">
              <strong>${formatMoney(product.price_try)}</strong>
              <span>Teklif: ${formatMoney(product.quote_price_try || product.price_try)}</span>
            </div>
          </td>
          <td>
            <div class="erp-cell-stack">
              <strong>${product.stock} adet</strong>
              <span>Reorder: ${product.reorder_point}</span>
            </div>
          </td>
          <td><span class="${badgeClass("product", product.is_active ? "active" : "passive")}">${product.is_active ? "Aktif" : "Pasif"}</span></td>
          <td class="erp-actions">
            <button class="erp-table-btn js-edit" data-resource="products" data-id="${product.id}" type="button">Düzenle</button>
            <button class="erp-table-btn danger js-delete" data-resource="products" data-id="${product.id}" type="button">Sil</button>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderLeads() {
  const stages = ["Yeni", "İletişim Kuruldu", "Teklif Hazırlanıyor", "Teklif Gönderildi", "Kazanıldı", "Kapandı"];
  document.getElementById("leadStageGrid").innerHTML = stages
    .map((stage) => {
      const count = state.leads.filter((item) => item.stage === stage).length;
      return `
        <article class="erp-stage-card">
          <span>${escapeHtml(stage)}</span>
          <strong>${count}</strong>
        </article>
      `;
    })
    .join("");

  document.getElementById("leadsTableBody").innerHTML = state.leads
    .map(
      (lead) => `
        <tr>
          <td>
            <div class="erp-cell-stack">
              <strong>${escapeHtml(lead.lead_no || lead.id)}</strong>
              <span>${formatDate(lead.created_at)}</span>
            </div>
          </td>
          <td>
            <div class="erp-cell-stack">
              <strong>${escapeHtml(lead.company || lead.name)}</strong>
              <span>${escapeHtml(lead.phone || "Telefon yok")}</span>
            </div>
          </td>
          <td>
            <div class="erp-cell-stack">
              <strong>${formatMoney(lead.totals?.quote || 0)}</strong>
              <span>Liste: ${formatMoney(lead.totals?.retail || 0)}</span>
            </div>
          </td>
          <td><span class="${badgeClass("stage", lead.stage)}">${escapeHtml(lead.stage)}</span></td>
          <td><span class="${badgeClass("priority", lead.priority)}">${escapeHtml(lead.priority)}</span></td>
          <td class="erp-actions">
            <button class="erp-table-btn js-convert" data-id="${lead.id}" type="button">Siparişe Çevir</button>
            <button class="erp-table-btn js-edit" data-resource="leads" data-id="${lead.id}" type="button">Düzenle</button>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderCustomers() {
  document.getElementById("customersTableBody").innerHTML = state.customers
    .map(
      (customer) => `
        <tr>
          <td>
            <div class="erp-cell-stack">
              <strong>${escapeHtml(customer.company || customer.name)}</strong>
              <span>${escapeHtml(customer.email || customer.phone || "İletişim yok")}</span>
            </div>
          </td>
          <td><span class="${badgeClass("segment", customer.segment)}">${escapeHtml(customer.segment || "—")}</span></td>
          <td>${formatDate(customer.last_contact_at)}</td>
          <td>${formatMoney(customer.total_spend_try || 0)}</td>
          <td class="erp-actions">
            <button class="erp-table-btn js-edit" data-resource="customers" data-id="${customer.id}" type="button">Düzenle</button>
            <button class="erp-table-btn danger js-delete" data-resource="customers" data-id="${customer.id}" type="button">Sil</button>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderOrders() {
  document.getElementById("ordersTableBody").innerHTML = state.orders
    .map(
      (order) => `
        <tr>
          <td>
            <div class="erp-cell-stack">
              <strong>${escapeHtml(order.order_no || order.id)}</strong>
              <span>${formatDate(order.created_at)}</span>
            </div>
          </td>
          <td>${escapeHtml(customerLabel(order.customer_id))}</td>
          <td>${formatMoney(order.total_try || 0)}</td>
          <td><span class="${badgeClass("order", order.status)}">${escapeHtml(order.status)}</span></td>
          <td><span class="${badgeClass("payment", order.payment_status)}">${escapeHtml(order.payment_status)}</span></td>
          <td class="erp-actions">
            <button class="erp-table-btn js-edit" data-resource="orders" data-id="${order.id}" type="button">Düzenle</button>
            <button class="erp-table-btn danger js-delete" data-resource="orders" data-id="${order.id}" type="button">Sil</button>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderInventory() {
  document.getElementById("inventoryProduct").innerHTML = state.products
    .map((product) => `<option value="${product.id}">${escapeHtml(product.name)} (${product.stock})</option>`)
    .join("");

  document.getElementById("inventoryTableBody").innerHTML = state.products
    .map(
      (product) => `
        <tr>
          <td>${escapeHtml(product.name)}</td>
          <td>${escapeHtml(product.category_name || "—")}</td>
          <td>${product.stock}</td>
          <td>${product.reorder_point}</td>
          <td><span class="${badgeClass("stock", Number(product.stock) <= Number(product.reorder_point) ? "risk" : "healthy")}">${Number(product.stock) <= Number(product.reorder_point) ? "Risk" : "Normal"}</span></td>
        </tr>
      `
    )
    .join("");

  renderList(
    "movementList",
    state.inventoryMovements.slice(0, 8),
    (movement) => `
      <article class="erp-list-item">
        <div>
          <strong>${escapeHtml(movement.product_name)}</strong>
          <p>${escapeHtml(movement.reason || "Açıklama yok")} • ${formatDate(movement.created_at)}</p>
        </div>
        <span class="${badgeClass("movement", movement.type)}">${escapeHtml(movement.type)} ${movement.quantity}</span>
      </article>
    `,
    "Hareket bulunmuyor."
  );
}

function renderFinance() {
  const totals = state.dashboard?.finance || {};
  document.getElementById("financeCashOnHand").textContent = formatMoney(totals.cashOnHand || 0);
  document.getElementById("financeCurrentDebt").textContent = formatMoney(totals.currentDebt || 0);
  document.getElementById("financeMonthlyIncome").textContent = formatMoney(totals.monthlyIncome || 0);
  document.getElementById("financeMonthlyExpense").textContent = formatMoney(totals.monthlyExpense || 0);
  document.getElementById("financeTotalCreditLimit").textContent = formatMoney(totals.totalCreditLimit || 0);
  document.getElementById("financeAvailableCredit").textContent = formatMoney(totals.availableCredit || 0);

  document.getElementById("financeAccountsTableBody").innerHTML = state.financeAccounts
    .map(
      (account) => `
        <tr>
          <td>
            <div class="erp-cell-stack">
              <strong>${escapeHtml(account.name)}</strong>
              <span>${escapeHtml(account.institution || "Kurum yok")}</span>
            </div>
          </td>
          <td><span class="${badgeClass("account", account.type)}">${escapeHtml(account.type)}</span></td>
          <td>${formatMoney(account.current_balance_try || 0)}</td>
          <td>${formatMoney(account.credit_limit_try || 0)}</td>
          <td class="erp-actions">
            <button class="erp-table-btn js-edit" data-resource="financeAccounts" data-id="${account.id}" type="button">Düzenle</button>
            <button class="erp-table-btn danger js-delete" data-resource="financeAccounts" data-id="${account.id}" type="button">Sil</button>
          </td>
        </tr>
      `
    )
    .join("");

  document.getElementById("financeLiabilitiesTableBody").innerHTML = state.financeLiabilities
    .map(
      (item) => `
        <tr>
          <td>
            <div class="erp-cell-stack">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.type)}</span>
            </div>
          </td>
          <td>${escapeHtml(item.lender || "Kurum yok")}</td>
          <td>${formatMoney(item.remaining_try || 0)}</td>
          <td>${formatDate(item.due_date)}</td>
          <td class="erp-actions">
            <button class="erp-table-btn js-edit" data-resource="financeLiabilities" data-id="${item.id}" type="button">Düzenle</button>
            <button class="erp-table-btn danger js-delete" data-resource="financeLiabilities" data-id="${item.id}" type="button">Sil</button>
          </td>
        </tr>
      `
    )
    .join("");

  document.getElementById("financeEntriesTableBody").innerHTML = state.financeEntries
    .map(
      (entry) => `
        <tr>
          <td>
            <div class="erp-cell-stack">
              <strong>${escapeHtml(entry.title)}</strong>
              <span>${escapeHtml(entry.category || "Kategori yok")}</span>
            </div>
          </td>
          <td>${escapeHtml(accountLabel(entry.account_id))}</td>
          <td><span class="${badgeClass("entry", entry.type)}">${escapeHtml(entry.type)}</span></td>
          <td>${formatMoney(entry.amount_try || 0)}</td>
          <td>${formatDate(entry.transaction_date)}</td>
          <td class="erp-actions">
            <button class="erp-table-btn js-edit" data-resource="financeEntries" data-id="${entry.id}" type="button">Düzenle</button>
            <button class="erp-table-btn danger js-delete" data-resource="financeEntries" data-id="${entry.id}" type="button">Sil</button>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderTasks() {
  document.getElementById("tasksTableBody").innerHTML = state.tasks
    .map(
      (task) => `
        <tr>
          <td>
            <div class="erp-cell-stack">
              <strong>${escapeHtml(task.title)}</strong>
              <span>${escapeHtml(task.notes || "Not yok")}</span>
            </div>
          </td>
          <td>${escapeHtml(task.assignee || "Atanmadı")}</td>
          <td>${formatDate(task.due_date)}</td>
          <td><span class="${badgeClass("task", task.status)}">${escapeHtml(task.status)}</span></td>
          <td><span class="${badgeClass("priority", task.priority)}">${escapeHtml(task.priority)}</span></td>
          <td class="erp-actions">
            <button class="erp-table-btn js-edit" data-resource="tasks" data-id="${task.id}" type="button">Düzenle</button>
            <button class="erp-table-btn danger js-delete" data-resource="tasks" data-id="${task.id}" type="button">Sil</button>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderSettings() {
  document.getElementById("settingCompanyName").value = state.settings.companyName || "";
  document.getElementById("settingSupportPhone").value = state.settings.supportPhone || "";
  document.getElementById("settingSupportEmail").value = state.settings.supportEmail || "";
  document.getElementById("settingHeroBadge").value = state.settings.heroBadge || "";
  document.getElementById("settingAnnouncement").value = state.settings.announcement || "";
  document.getElementById("settingSalesOwner").value = state.settings.salesOwner || "";
}

function renderAll() {
  document.getElementById("userBadge").textContent = state.username || localStorage.getItem("berzan_admin_user") || "Admin";
  renderDashboard();
  renderProducts();
  renderLeads();
  renderCustomers();
  renderOrders();
  renderInventory();
  renderFinance();
  renderTasks();
  renderSettings();
}

function findRecord(resource, id) {
  const collections = {
    categories: state.categories,
    products: state.products,
    leads: state.leads,
    customers: state.customers,
    orders: state.orders,
    tasks: state.tasks,
    financeAccounts: state.financeAccounts,
    financeEntries: state.financeEntries,
    financeLiabilities: state.financeLiabilities,
  };
  return (collections[resource] || []).find((item) => item.id === id) || null;
}

function inputValue(record, field) {
  if (!record && typeof field.default !== "undefined") return field.default;
  if (field.name === "badges" || field.name === "sectors" || field.name === "seasons") {
    return Array.isArray(record?.[field.name]) ? record[field.name].join(", ") : "";
  }
  if (field.name === "retail_total") return record?.totals?.retail || "";
  if (field.name === "quote_total") return record?.totals?.quote || "";
  if (field.type === "date" && record?.[field.name]) return String(record[field.name]).slice(0, 10);
  return record?.[field.name] ?? "";
}

function createFieldHtml(field, record) {
  const rawValue = inputValue(record, field);
  const value = field.type === "checkbox" ? Boolean(rawValue) : escapeHtml(rawValue);
  const fullClass = field.type === "textarea" ? "full" : "";

  if (field.type === "textarea") {
    return `
      <label class="${fullClass}">
        <span>${field.label}</span>
        <textarea name="${field.name}" rows="4" placeholder="${escapeHtml(field.placeholder || "")}">${value}</textarea>
      </label>
    `;
  }

  if (field.type === "select") {
    const options = typeof field.options === "function" ? field.options() : field.options;
    const normalizedOptions = options.map((item) =>
      typeof item === "string" ? { value: item, label: item } : item
    );
    return `
      <label>
        <span>${field.label}</span>
        <select name="${field.name}">
          ${normalizedOptions
            .map(
              (option) => `
                <option value="${escapeHtml(option.value)}" ${String(option.value) === String(rawValue) ? "selected" : ""}>
                  ${escapeHtml(option.label)}
                </option>
              `
            )
            .join("")}
        </select>
      </label>
    `;
  }

  if (field.type === "checkbox") {
    return `
      <label class="erp-check-row">
        <input name="${field.name}" type="checkbox" ${value ? "checked" : ""} />
        <span>${field.label}</span>
      </label>
    `;
  }

  return `
    <label class="${field.type === "tags" ? "full" : ""}">
      <span>${field.label}</span>
      <input
        name="${field.name}"
        type="${field.type === "tags" ? "text" : field.type}"
        value="${value}"
        placeholder="${escapeHtml(field.placeholder || "")}"
        ${field.required ? "required" : ""}
      />
    </label>
  `;
}

function openModal(resource, id = "") {
  const meta = resourceMeta[resource];
  const record = id ? findRecord(resource, id) : null;
  document.getElementById("entityResource").value = resource;
  document.getElementById("entityId").value = record?.id || "";
  document.getElementById("modalKicker").textContent = meta.label;
  document.getElementById("modalTitle").textContent = record ? `${meta.label} Düzenle` : `Yeni ${meta.label}`;
  document.getElementById("entityFormFields").innerHTML = meta.fields.map((field) => createFieldHtml(field, record)).join("");
  document.getElementById("entityModal").classList.add("is-open");
}

function closeModal() {
  document.getElementById("entityModal").classList.remove("is-open");
}

function formToPayload(resource, form) {
  const values = Object.fromEntries(new FormData(form).entries());
  const payload = { ...values };

  form.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    payload[input.name] = input.checked;
  });

  if (resource === "products") {
    payload.price_try = Number(payload.price_try || 0);
    payload.quote_price_try = Number(payload.quote_price_try || 0);
    payload.stock = Number(payload.stock || 0);
    payload.reorder_point = Number(payload.reorder_point || 0);
    payload.sort = Number(payload.sort || 0);
  }

  if (resource === "leads") {
    const existing = findRecord(resource, document.getElementById("entityId").value);
    payload.items = existing?.items || [];
    payload.totals = {
      retail: Number(payload.retail_total || existing?.totals?.retail || 0),
      quote: Number(payload.quote_total || existing?.totals?.quote || 0),
    };
    delete payload.retail_total;
    delete payload.quote_total;
  }

  if (resource === "orders") {
    const existing = findRecord(resource, document.getElementById("entityId").value);
    payload.total_try = Number(payload.total_try || 0);
    payload.items = existing?.items || [];
    payload.lead_id = existing?.lead_id || null;
  }

  if (resource === "financeAccounts") {
    payload.current_balance_try = Number(payload.current_balance_try || 0);
    payload.credit_limit_try = Number(payload.credit_limit_try || 0);
    payload.due_day = payload.due_day === "" ? "" : Number(payload.due_day || 0);
  }

  if (resource === "financeEntries") {
    payload.amount_try = Number(payload.amount_try || 0);
  }

  if (resource === "financeLiabilities") {
    payload.remaining_try = Number(payload.remaining_try || 0);
    payload.monthly_payment_try = Number(payload.monthly_payment_try || 0);
  }

  ["badges", "sectors", "seasons"].forEach((key) => {
    if (key in payload) {
      payload[key] = String(payload[key] || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  });

  return payload;
}

async function refreshData() {
  const data = await apiFetch("/api/admin/bootstrap");
  state.username = data.username || "";
  state.dashboard = data.dashboard || null;
  state.categories = data.categories || [];
  state.products = data.products || [];
  state.leads = data.leads || [];
  state.customers = data.customers || [];
  state.orders = data.orders || [];
  state.tasks = data.tasks || [];
  state.inventoryMovements = data.inventoryMovements || [];
  state.financeAccounts = data.financeAccounts || [];
  state.financeEntries = data.financeEntries || [];
  state.financeLiabilities = data.financeLiabilities || [];
  state.settings = data.settings || {};
  renderAll();
}

async function saveEntity(resource, payload, id = "") {
  const meta = resourceMeta[resource];
  const path = id ? `${meta.endpoint}/${id}` : meta.endpoint;
  const method = id ? "PUT" : "POST";
  await apiFetch(path, {
    method,
    body: JSON.stringify(payload),
  });
  await refreshData();
  closeModal();
  showToast(`${meta.label} kaydedildi.`);
}

async function deleteEntity(resource, id) {
  const meta = resourceMeta[resource];
  await apiFetch(`${meta.endpoint}/${id}`, { method: "DELETE" });
  await refreshData();
  showToast(`${meta.label} silindi.`);
}

async function convertLead(id) {
  await apiFetch(`/api/admin/leads/${id}/convert`, { method: "POST" });
  await refreshData();
  showToast("Teklif siparişe dönüştürüldü.");
}

async function saveSettingsForm() {
  await apiFetch("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify({
      companyName: document.getElementById("settingCompanyName").value.trim(),
      supportPhone: document.getElementById("settingSupportPhone").value.trim(),
      supportEmail: document.getElementById("settingSupportEmail").value.trim(),
      heroBadge: document.getElementById("settingHeroBadge").value.trim(),
      announcement: document.getElementById("settingAnnouncement").value.trim(),
      salesOwner: document.getElementById("settingSalesOwner").value.trim(),
    }),
  });
  await refreshData();
  showToast("Site ayarları kaydedildi.");
}

async function logout() {
  try {
    await apiFetch("/api/admin/auth/logout", { method: "POST" });
  } catch {}
  localStorage.removeItem(authTokenKey);
  localStorage.removeItem("berzan_admin_user");
  window.location.href = "/admin/login.html";
}

function attachEvents() {
  document.querySelectorAll(".erp-nav-btn").forEach((button) => {
    button.addEventListener("click", () => setActiveView(button.dataset.view));
  });

  document.querySelectorAll(".js-create").forEach((button) => {
    button.addEventListener("click", () => openModal(button.dataset.resource));
  });

  document.getElementById("refreshBtn").addEventListener("click", async () => {
    setBootVisible(true);
    try {
      await refreshData();
      showToast("Panel yenilendi.");
    } finally {
      setBootVisible(false);
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("closeModalBtn").addEventListener("click", closeModal);
  document.getElementById("cancelModalBtn").addEventListener("click", closeModal);
  document.getElementById("entityModal").addEventListener("click", (event) => {
    if (event.target.id === "entityModal") closeModal();
  });

  document.getElementById("entityForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const resource = document.getElementById("entityResource").value;
    const id = document.getElementById("entityId").value;
    try {
      await saveEntity(resource, formToPayload(resource, event.currentTarget), id);
    } catch (error) {
      showToast(error.message || "Kayıt kaydedilemedi.", "error");
    }
  });

  document.getElementById("inventoryForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await apiFetch("/api/admin/inventory/movements", {
        method: "POST",
        body: JSON.stringify({
          product_id: document.getElementById("inventoryProduct").value,
          type: document.getElementById("inventoryType").value,
          quantity: Number(document.getElementById("inventoryQty").value || 1),
          reason: document.getElementById("inventoryReason").value.trim(),
        }),
      });
      event.currentTarget.reset();
      await refreshData();
      showToast("Stok hareketi işlendi.");
    } catch (error) {
      showToast(error.message || "Stok hareketi işlenemedi.", "error");
    }
  });

  document.getElementById("settingsForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await saveSettingsForm();
    } catch (error) {
      showToast(error.message || "Ayarlar kaydedilemedi.", "error");
    }
  });

  document.body.addEventListener("click", async (event) => {
    const editBtn = event.target.closest(".js-edit");
    if (editBtn) {
      openModal(editBtn.dataset.resource, editBtn.dataset.id);
      return;
    }

    const deleteBtn = event.target.closest(".js-delete");
    if (deleteBtn) {
      const meta = resourceMeta[deleteBtn.dataset.resource];
      const approved = window.confirm(`${meta.label} kaydını silmek istediğine emin misin?`);
      if (!approved) return;
      try {
        await deleteEntity(deleteBtn.dataset.resource, deleteBtn.dataset.id);
      } catch (error) {
        showToast(error.message || "Silme işlemi başarısız.", "error");
      }
      return;
    }

    const convertBtn = event.target.closest(".js-convert");
    if (convertBtn) {
      try {
        await convertLead(convertBtn.dataset.id);
      } catch (error) {
        showToast(error.message || "Teklif çevrilemedi.", "error");
      }
    }
  });
}

async function init() {
  const token = getToken();
  if (!token || token === "public-bypass") {
    localStorage.removeItem(authTokenKey);
    localStorage.removeItem("berzan_admin_user");
    window.location.href = "/admin/login.html";
    return;
  }

  attachEvents();
  try {
    await refreshData();
    setActiveView("dashboard");
    setBootVisible(false);
  } catch (error) {
    if (error.status === 401) {
      await logout();
      return;
    }
    showToast(error.message || "Panel yüklenemedi.", "error");
    setBootVisible(false);
  }
}

init();
