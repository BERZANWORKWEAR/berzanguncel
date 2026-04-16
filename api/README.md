# BERZAN API (Email + PDF)
Bu klasör, sepetteki "Talep gönder" butonuna basınca siparis@berzan.com.tr adresine PDF ekli mail göndermek içindir.

## Kurulum
1) Terminal:
   cd api
   npm i

2) .env dosyası:
   cp .env.example .env
   SMTP ayarlarını doldur

3) Çalıştır:
   npm start

Not:
- Frontend, ./api/quote/send ve ./api/quote/pdf endpointlerine istek atar.
- Eğer backend çalışmıyorsa buton PDF yerine TXT indirir ve kullanıcıya uyarı gösterir.

## Kurumsal IMAP / SMTP entegrasyonu
Admin panelden TurkTicaret gelen kutusunu okumak ve kurumsal hesabınla mail göndermek için `.env` içine şunları ekle:

```env
MAILBOX_ADDRESS=mehmetruhi@berzan.com.tr
MAILBOX_PASSWORD=your-mail-password
IMAP_HOST=imap.turkticaret.net
IMAP_PORT=993
IMAP_SECURE=true
SMTP_HOST=smtp.turkticaret.net
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=mehmetruhi@berzan.com.tr
SMTP_PASS=your-mail-password
MAIL_FROM=mehmetruhi@berzan.com.tr
```

Sonra:
1) API'yi yeniden başlat
2) Admin panelde `Ayarlar > Kurumsal Mail Entegrasyonu` kartından `Bağlantıyı Test Et`
3) Ardından `Gelen Kutusunu Yenile` ile son mailleri çek
