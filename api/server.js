import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";

import {
  addInventoryMovement,
  convertLeadToOrder,
  createAdminSession,
  createPublicLead,
  deleteResource,
  getAdminBootstrap,
  getPublicProduct,
  getPublicProducts,
  getPublicSettings,
  getSession,
  revokeSession,
  saveResource,
  saveSettings,
} from "./lib/erp-store.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8787;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "Qazi";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "2+2=1";
const ADMIN_BYPASS = String(process.env.ADMIN_BYPASS || "false") === "true";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function moneyTRY(n) {
  const value = Number(n || 0);
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildLines(items = []) {
  return items.map((item) => {
    const qty = Number(item.qty || 1);
    const code = (item.sku || item.code || item.id || "").toString().trim() || "-";
    const name = (item.name || item.title || "").toString().trim() || "Ürün";
    const price = Number(item.price || 0);
    return {
      qty,
      code,
      name,
      price,
      total: qty * price,
    };
  });
}

function makePdfBuffer(payload) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 48 });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const lines = buildLines(payload.items || []);
      const total = lines.reduce((sum, line) => sum + line.total, 0);

      doc.fontSize(18).text("BERZAN — Sipariş / Teklif Özeti");
      doc.moveDown(0.7);
      doc.fontSize(11).fillColor("#333");
      doc.text(`Ad Soyad: ${payload.name || "-"}`);
      doc.text(`Telefon: ${payload.phone || "-"}`);
      doc.text(`E-posta: ${payload.email || "-"}`);
      doc.text(`Firma: ${payload.company || "-"}`);
      doc.text(`Tarih: ${new Date().toLocaleString("tr-TR")}`);
      doc.moveDown(0.8);

      if (payload.note) {
        doc.fontSize(12).fillColor("#111").text("Talep Notu", { underline: true });
        doc.moveDown(0.2);
        doc.fontSize(11).fillColor("#333").text(String(payload.note));
        doc.moveDown(0.8);
      }

      doc.fontSize(12).fillColor("#111").text("Kalemler", { underline: true });
      doc.moveDown(0.35);
      lines.forEach((line, index) => {
        doc
          .fontSize(11)
          .fillColor("#111")
          .text(
            `${index + 1}. ${line.qty} × ${line.code} — ${line.name} — ${moneyTRY(line.price)} = ${moneyTRY(line.total)}`
          );
        doc.moveDown(0.15);
      });

      doc.moveDown(0.8);
      doc.fontSize(12).fillColor("#111").text(`Toplam: ${moneyTRY(total)}`, { align: "right" });
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || "false") === "true";

  if (!host || !user || !pass) {
    throw new Error("SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function getAdminToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice("Bearer ".length).trim();
  const fallback = req.headers["x-admin-token"];
  return typeof fallback === "string" ? fallback.trim() : "";
}

async function requireAdmin(req, res, next) {
  try {
    if (ADMIN_BYPASS) {
      req.adminSession = { username: "Qazi" };
      return next();
    }

    const token = getAdminToken(req);
    if (!token) return res.status(401).json({ ok: false, error: "Yetkisiz erişim" });

    const session = await getSession(token);
    if (!session) return res.status(401).json({ ok: false, error: "Oturum süresi dolmuş" });

    req.adminSession = session;
    return next();
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
}

app.get("/api/health", async (_req, res) => {
  res.json({ ok: true, service: "berzan-api", version: "erp-1" });
});

app.post("/api/admin/auth/login", async (req, res) => {
  try {
    if (ADMIN_BYPASS) {
      return res.json({ ok: true, token: "public-bypass", username: "Qazi", bypass: true });
    }

    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ ok: false, error: "Kullanıcı adı veya şifre hatalı" });
    }

    const session = await createAdminSession(username);
    return res.json({ ok: true, token: session.token, username: session.username });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.post("/api/admin/auth/logout", requireAdmin, async (req, res) => {
  try {
    await revokeSession(getAdminToken(req));
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.get("/api/admin/bootstrap", requireAdmin, async (req, res) => {
  try {
    const payload = await getAdminBootstrap();
    return res.json({
      ok: true,
      username: req.adminSession.username,
      ...payload,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.post("/api/admin/:resource(products|categories|leads|customers|orders|tasks|financeAccounts|financeEntries|financeLiabilities)", requireAdmin, async (req, res) => {
  try {
    const record = await saveResource(req.params.resource, req.body || {});
    return res.json({ ok: true, record });
  } catch (error) {
    return res.status(400).json({ ok: false, error: String(error.message || error) });
  }
});

app.put("/api/admin/:resource(products|categories|leads|customers|orders|tasks|financeAccounts|financeEntries|financeLiabilities)/:id", requireAdmin, async (req, res) => {
  try {
    const record = await saveResource(req.params.resource, {
      ...(req.body || {}),
      id: req.params.id,
    });
    return res.json({ ok: true, record });
  } catch (error) {
    return res.status(400).json({ ok: false, error: String(error.message || error) });
  }
});

app.delete("/api/admin/:resource(products|categories|leads|customers|orders|tasks|financeAccounts|financeEntries|financeLiabilities)/:id", requireAdmin, async (req, res) => {
  try {
    const result = await deleteResource(req.params.resource, req.params.id);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ ok: false, error: String(error.message || error) });
  }
});

app.put("/api/admin/settings", requireAdmin, async (req, res) => {
  try {
    const settings = await saveSettings(req.body || {});
    return res.json({ ok: true, settings });
  } catch (error) {
    return res.status(400).json({ ok: false, error: String(error.message || error) });
  }
});

app.post("/api/admin/inventory/movements", requireAdmin, async (req, res) => {
  try {
    const result = await addInventoryMovement(req.body || {});
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ ok: false, error: String(error.message || error) });
  }
});

app.post("/api/admin/leads/:id/convert", requireAdmin, async (req, res) => {
  try {
    const order = await convertLeadToOrder(req.params.id);
    return res.json({ ok: true, order });
  } catch (error) {
    return res.status(400).json({ ok: false, error: String(error.message || error) });
  }
});

app.get("/api/public/settings", async (_req, res) => {
  try {
    const settings = await getPublicSettings();
    return res.json({ ok: true, settings });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.get("/api/public/products", async (_req, res) => {
  try {
    const products = await getPublicProducts();
    return res.json({ ok: true, products });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.get("/api/public/products/:idOrSlug", async (req, res) => {
  try {
    const product = await getPublicProduct(req.params.idOrSlug);
    if (!product) return res.status(404).json({ ok: false, error: "Ürün bulunamadı" });
    return res.json({ ok: true, product });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.post("/api/public/leads", async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.name || !payload.phone) {
      return res.status(400).json({ ok: false, error: "Ad ve telefon zorunludur" });
    }

    const result = await createPublicLead(payload);
    return res.status(201).json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ ok: false, error: String(error.message || error) });
  }
});

app.post("/api/quote/pdf", async (req, res) => {
  try {
    const pdf = await makePdfBuffer(req.body || {});
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=berzan-talep.pdf");
    return res.status(200).send(pdf);
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.post("/api/quote/send", async (req, res) => {
  try {
    const payload = req.body || {};
    const to = payload.to || "siparis@berzan.com.tr";
    const from = process.env.MAIL_FROM || process.env.SMTP_USER;
    const pdf = await makePdfBuffer(payload);
    const lines = buildLines(payload.items || []);
    const bodyText =
      payload.text ||
      lines
        .map((line) => `${line.qty} × ${line.code} — ${line.name} — ${moneyTRY(line.price)} = ${moneyTRY(line.total)}`)
        .join("\n");

    const transporter = getTransport();
    await transporter.sendMail({
      from,
      to,
      subject: "BERZAN — Sipariş Talebi",
      text: bodyText,
      attachments: [{ filename: "berzan-talep.pdf", content: pdf }],
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  console.log(`Admin login user: ${ADMIN_USERNAME}`);
  if (ADMIN_BYPASS) console.log("Admin auth bypass is ACTIVE");
});
