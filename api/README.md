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