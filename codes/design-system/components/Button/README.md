# Button

Formlarda ve diyaloglarda bir işlemi başlatır; kamera kontrolleri için `ControlButton` kullanılır. Ekranda en fazla bir `primary` olur: o ekranın asıl işi (Bağlan, Yükselt, Kaydet). Geri dönüşü olmayan işlem (Yeniden başlat, Varsayılana dön) `danger` olur ve bir `Dialog` ile onaylanır. `ghost` ikincil bağlantı benzeri eylemler içindir.

- Etiket fiille başlar, cümle düzeninde: "Cihazı bul", "Sürümü sorgula".
- `icon`, `Tracklight.iconNames` içinden bir ad alır.
- Kullanan sağlar: `onClick`, `disabled` (bağlantı yokken).
