# Tracklight

Tracklight, CPDD075CCT üç ışıklı AI takip modülü (uzun odaklı ve kısa odaklı görünür ışık kameraları, uzun dalga soğutmasız kızılötesi kamera, gimbal) için yazılacak web tabanlı kontrol uygulamasının tasarım sistemidir. Bir operatör bu arayüzle videoyu izler, gimbali yönlendirir, hedefi kilitler, kayıt alır ve cihazı yapılandırır.

## Nereden çıkarıldı

Klasörde web kaynak kodu yok; sistem üreticinin verdiği programlardan ve dokümanlardan çıkarıldı:

| Kaynak | Bulunan | Tracklight'taki karşılığı |
| --- | --- | --- |
| `Remote Control/RemoteControlPanel.exe` içindeki `:/Skin/stylesheet/dark.qss` | `background: #262626`, `border: 1px solid #282828`, `rgba(83,83,83)`, `color: #51ACFA`, `selection-background-color: #0F7DBE` | `surface-100`, `line`, `surface-300`, `accent` (koyu), `selection` |
| Aynı programın ikon seti `dark/*_normal.png` ve `*_down.png` | Fotoğraf, kayıt, PIP, SBS, kaynak değiştir, senkron, manuel; her biri normal/basılı | `ControlButton` ve `pressed` hâli |
| `blue/ok`, `info`, `error`, `question` ve `CustomMessageBox` (Enter / Cancel) | Mesaj kutusu türleri | `Dialog` `kind` değerleri |
| `PodAssistant…sbus.exe` | `background-color: green / red / white` durum etiketleri, ilerleme çubuğu, IP oktet girişi | `ok`, `danger`, `StatusChip`, `ProgressBar`, `IpField` |
| Üretici dokümanları (.docx) | Tablo zeminleri F1F1F1 / D7D7D7, uyarı kırmızısı C00000, turuncu F79646, yeşil 00B050; Times New Roman | Açık tema yüzeyleri, `danger`, `thermal`, `ok` |
| `System.ini`, `Settings.ini` | RTSP adresleri, 115200 baud, IP:port çiftleri | İçerik örnekleri ve `telemetry` yazı stili |

Orijinal PNG ikonlar programın sıkıştırılmış Qt kaynaklarında kilitli; sisteme kopyalanamadı. Bileşenlerdeki çizgi ikonlar Tracklight için yeni çizildi ve aynı yedi işlevi karşılar.

## İlkeler

- **Görüntü önce gelir.** Video bölmesi ekranın en büyük öğesidir; arayüz koyu ve sessizdir, renk durum bildirmek için harcanır.
- **Durum biçimle de okunur.** Bağlantı, kayıt ve takip durumu bir nokta, bir çip ya da basılı bir tuşla gösterilir, yalnızca renkle değil.
- **Sayılar sabit genişlikte.** Açılar, sıcaklık, IP ve portlar `mono` ailesiyle ve tabular rakamlarla yazılır; değer değişince düzen kaymaz.
- **Kaynak bir renge sahiptir.** Kızılötesi (IR) ile ilgili her etiket `thermal`, görünür ışık (TV) kaynağı `accent` rengindedir.
- **Geri dönüşü olmayan işlem açıkça uyarır.** Yükseltme, kalibrasyon ve IP değiştirme "gücü kesmeyin" notu ve onay diyaloğu ister.

## İçerik ve dil

- Arayüz dili Türkçedir. Düğmeler fiille başlar: "Bağlan", "Kaydı başlat", "Yükselt". Cümle düzeni kullanılır, her kelime büyük harfle başlamaz.
- Cihaz terimleri dokümandaki gibi kalır: S.BUS, PIP, SBS, IR, TV, RTSP, COM.
- Durum metni kısa ve sonucu söyler: "Bağlı", "Bağlantı hatası", "Kaydediliyor", "Takip ediliyor".
- Hata mesajı neyin yanlış gittiğini ve ne yapılacağını söyler: "IR cihazı bulunamadı. Adresi ve kabloyu kontrol edin."
- Birimler sayıdan bir boşlukla ayrılır; derece işareti istisnadır: `-20.4°`, `36.5 °C`, `12 mm`, `115200 baud`, `X 640 px`.

## Renk

Koyu tema birincildir (sahada, karanlıkta, ekran parlaklığı düşükken kullanılır); açık tema ofis ve kurulum ekranları içindir.

- Yüzeyler `surface-000` → `surface-300` sırasıyla yükselir. Paneller gölge değil `line` kenarıyla ayrılır.
- `accent` metin ve odak içindir; dolgulu birincil eylemler `accent-fill` kullanır. Ekranda en fazla bir birincil düğme olur.
- `selection` kaynaktan birebir alındı; beyaz metinle 4.4:1 olduğu için 14px altı metinde kullanmayın.
- Durum renkleri: `ok` (bağlı, tamam), `warn` (bekliyor, yeniden bağlanıyor), `danger` (hata, kayıt). Kayıt göstergesi `danger` noktası ve "REC" yazısıdır, renk tek başına bırakılmaz.
- Video bölmesi `video-bg`, `hud-ink`, `hud-track`, `hud-scrim` ile çizilir ve iki temada aynıdır.

## Tipografi

- `sans`: IBM Plex Sans; arayüz metni. `mono`: IBM Plex Mono; telemetri. İkisi de Türkçe karakterleri tam destekler ve Google Fonts'tan yüklenir.
- Stil ölçeği: `display` 28, `title` 16, `body` 14, `caption` 12, `label` 11 (büyük harf, 0.06em aralık); telemetri için `readout` 22 ve `telemetry` 13.
- Okuma değerleri `font-variant-numeric: tabular-nums` ile yazılır.

## Boşluk ve köşeler

4px ızgara: `space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 16 · `space-6` 24 · `space-8` 32. Köşeler kaynaktaki Qt arayüzü gibi neredeyse keskindir: `radius-sm` 2, `radius-md` 4, `radius-lg` 8 (yalnızca diyalog ve video bölmesi).

## İkonografi

24×24 ızgarada 1.75 çizgi kalınlığında, yuvarlak uçlu çizgi ikonlar; renk `currentColor`. Kayıt ikonu tek dolu ikondur. Set: `photo`, `record`, `stop`, `pip`, `sbs`, `swap`, `track`, `laser`, `zoomIn`, `zoomOut`, `focus`, `center`, `thermal`, yön okları ve diyalog işaretleri (`ok`, `info`, `error`, `question`). `Tracklight.Icon` ile kullanılır.

## Bileşenler

| Grup | Bileşen | Ne için |
| --- | --- | --- |
| Eylemler | `Button` | Formlar ve diyaloglar: Bağlan, Kaydet, Yükselt |
| Eylemler | `ControlButton` | İkonlu, basılı kalabilen kamera tuşları: Fotoğraf, Kayıt, PIP, AI takip |
| Eylemler | `DirPad` | Gimbal yön kontrolü ve merkezleme |
| Durum | `StatusChip` | Bağlantı / kayıt / takip durumu |
| Durum | `Readout` | Açı, sıcaklık, odak uzaklığı, hedef konumu |
| Durum | `ProgressBar` | Yazılım yükseltme, kalibrasyon ilerlemesi |
| Formlar | `Field` | Etiketli giriş veya seçim kutusu |
| Formlar | `IpField` | Dört oktetli IP girişi |
| Yapı | `Panel` | Başlıklı ayar grubu |
| Yapı | `Tabs` | Video / Gimbal / S.BUS / Yükseltme sekmeleri |
| Yapı | `Dialog` | Onay, bilgi ve hata mesajları |
| Video | `VideoPane` | RTSP akışı, HUD, takip kutusu |

## Web uygulamasında kullanım (`codes/`)

1. `tokens.css` dosyasını, IBM Plex Sans ve Mono'yu yükleyin; köke `data-theme="dark"` verin.
2. React 18 ile `components/bundle.css` ve `components/bundle.js` dosyalarını yükleyin; bileşenler `window.Tracklight` altındadır.
3. Video akışı tarayıcıda doğrudan RTSP olarak oynatılamaz (`rtsp://192.168.8.102/live/0`); sunucu tarafında WebRTC veya HLS'e çevrilip `VideoPane` içine `<video>` olarak verilir.
4. Gimbal komutları seri protokol (V2.14) üzerinden gider; tarayıcı bunları bir arka uç servisi (UDP/TCP köprüsü) aracılığıyla gönderir.
