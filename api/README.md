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

## Outlook / Microsoft 365 entegrasyonu
Admin panelden Outlook gelen kutusunu okumak ve mail göndermek için `.env` içine şunları ekle:

```env
OUTLOOK_TENANT_ID=common
OUTLOOK_CLIENT_ID=your-app-client-id
OUTLOOK_CLIENT_SECRET=your-app-client-secret
OUTLOOK_REDIRECT_URI=http://localhost:8787/api/admin/integrations/outlook/callback
OUTLOOK_SCOPES=openid profile offline_access User.Read Mail.Read Mail.Send
```

Sonra:
1) Azure / Entra tarafında bir uygulama kaydı aç
2) Redirect URI olarak yukarıdaki callback adresini ekle
3) Delegated permissions olarak `User.Read`, `Mail.Read`, `Mail.Send` ver
4) Bir client secret üret
5) API'yi yeniden başlat ve admin panelde `Ayarlar > Outlook Entegrasyonu` kartından bağlan
