// Simple backend for sending request PDF via email
// Usage:
//   cd api
//   npm i
//   cp .env.example .env  (fill SMTP)
//   node server.js
//
// Then in frontend, requests go to /api/quote/send and /api/quote/pdf

import express from "express";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 8787;

function moneyTRY(n){
  const v = Number(n || 0);
  return new Intl.NumberFormat("tr-TR", { style:"currency", currency:"TRY", maximumFractionDigits:0 }).format(v);
}

function buildLines(items=[]){
  return items.map(i => {
    const adet = Number(i.qty || 1);
    const kod = (i.sku || i.code || i.id || "").toString().trim() || "-";
    const ad = (i.name || i.title || "").toString().trim() || "Ürün";
    const birim = Number(i.price || 0);
    const toplam = birim * adet;
    return { adet, kod, ad, birim, toplam };
  });
}

function makePdfBuffer(payload){
  return new Promise((resolve, reject) => {
    try{
      const doc = new PDFDocument({ size: "A4", margin: 48 });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const lines = buildLines(payload.items || []);
      const total = lines.reduce((a,b)=>a+b.toplam,0);

      doc.fontSize(18).text("BERZAN — Sipariş Talebi", { align:"left" });
      doc.moveDown(0.6);

      doc.fontSize(11).fillColor("#333");
      doc.text(`Talep Eden: ${payload.name || "-"}`);
      doc.text(`Telefon: ${payload.phone || "-"}`);
      doc.text(`E-posta: ${payload.email || "-"}`);
      doc.text(`Tarih: ${new Date().toLocaleString("tr-TR")}`);
      doc.moveDown(0.8);

      doc.fontSize(12).fillColor("#111").text("Kalemler", { underline: true });
      doc.moveDown(0.4);

      lines.forEach((l, idx) => {
        doc.fontSize(11).fillColor("#111").text(
          `${idx+1}. ${l.adet} × ${l.kod} — ${l.ad} — ${moneyTRY(l.birim)} = ${moneyTRY(l.toplam)}`
        );
        doc.moveDown(0.15);
      });

      doc.moveDown(0.8);
      doc.fontSize(12).text(`Genel Toplam: ${moneyTRY(total)}`, { align:"right" });

      doc.end();
    }catch(err){ reject(err); }
  });
}

function getTransport(){
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || "false") === "true";

  if(!host || !user || !pass){
    throw new Error("SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env");
  }

  return nodemailer.createTransport({
    host, port, secure,
    auth: { user, pass }
  });
}

app.post("/api/quote/pdf", async (req, res) => {
  try{
    const buf = await makePdfBuffer(req.body || {});
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=berzan-talep.pdf");
    res.status(200).send(buf);
  }catch(e){
    res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
});

app.post("/api/quote/send", async (req, res) => {
  try{
    const payload = req.body || {};
    const to = payload.to || "siparis@berzan.com.tr";
    const from = process.env.MAIL_FROM || process.env.SMTP_USER;

    const pdf = await makePdfBuffer(payload);
    const lines = buildLines(payload.items || []);
    const bodyText = (payload.text || lines.map(l => `${l.adet} × ${l.kod} & ${l.ad} & ${moneyTRY(l.birim)} = ${moneyTRY(l.toplam)}`).join("\n"));

    const transporter = getTransport();
    await transporter.sendMail({
      from,
      to,
      subject: "BERZAN — Sipariş Talebi",
      text: bodyText,
      attachments: [{ filename:"berzan-talep.pdf", content: pdf }]
    });

    res.json({ ok:true });
  }catch(e){
    res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
});

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));