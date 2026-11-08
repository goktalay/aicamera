# aicamera web arayüzü

CPDD075CCT üç ışıklı AI takip modülünü tarayıcıdan kontrol eden uygulama: canlı görüntü, gimbal yönlendirme, AI takip, kayıt ve fotoğraf, cihaz ayarları ve kalibrasyon. Arayüz [Tracklight tasarım sistemi](design-system/README.md) ile yapıldı.

## Gereksinimler

- Node.js 18 veya üstü
- ffmpeg (canlı görüntü için; `PATH` üzerinde olmalı)
- Bilgisayar ile kamera aynı ağda: kameranın fabrika adresi `192.168.144.108`, bilgisayara `192.168.144.x` aralığında bir adres verin.

## Çalıştırma

Bağımlılıkları bir kez kurun:

```bash
npm install
```

Gerçek kamerayla:

```bash
npm start
```

Kamera olmadan, dahili simülatör ve test görüntüsüyle:

```bash
npm run sim
```

Sonra tarayıcıda `http://127.0.0.1:8080/` adresini açın.

Uygulamayı ağdaki bir tablet veya başka bir bilgisayardan açmak için sunucuyu tüm arayüzlerde dinletin. Kimlik doğrulama olmadığı için bunu yalnızca güvendiğiniz bir ağda yapın:

```bash
node server/server.js --host=0.0.0.0
```

> Üreticinin Remote Control programı da 7001 numaralı yerel portu kullanır. İkisini aynı anda açmayın; protokol de UDP ile seri portun aynı anda kullanılmasına izin vermez.

## Ne yapabilir

| Ekran | İşlevler |
| --- | --- |
| Kontrol | Canlı görüntü ve HUD; fotoğraf, kayıt, kare alma, görüntü kaynağı, IR palet, OSD, lazer mesafe; basılı tutarak zoom; AI takip (yeşil kutu) ve videoda tıklayarak noktadan takip; yön tuşları veya klavye oklarıyla gimbal; merkeze alma, aşağı bakma, yön kilidi ve yön takibi; self-test, TF kart ve sürüm bilgisi |
| Ayarlar | Cihaz IP'si, UDP portları ve RTSP adresleri (kalıcı); ekran kaynağı, bit hızı, fotoğraf ve video çözünürlüğü, takip şablonu; cihaz IP sorgulama ve değiştirme, video kodlaması, montaj açısı, AI tespitini duraklatma; eksen çevirme; cihaz yanıtları günlüğü |
| Kalibrasyon | Servo ön hazırlığı, ivmeölçer, jiroskop ve sıfır noktası kalibrasyonu, eski duruma dönme; kızılötesi perde ve sahne telafisi |

Ayarlar `server/config.local.json` dosyasına kaydedilir. Bu dosya git'e girmez.

## Nasıl çalışır

```
Tarayıcı ──WebSocket──► Node sunucusu ──UDP 9554──► Gimbal
   ▲                        │  ◄──UDP 7001 (64 bayt, 20 ms)──┘
   └──MJPEG (HTTP)──────── ffmpeg ◄──RTSP── rtsp://192.168.144.108/live/0
```

- `server/protocol.js`: Seri haberleşme protokolü V2.14. 44 baytlık komut ve 64 baytlık geri bildirim çerçeveleri, JSON uzantı komutları. Doküman örnekleriyle test edilmiştir.
- `server/link.js`: Protokolün istediği gibi her 40 ms'de bir komut çerçevesi gönderir. Düğmeye basmak, kodu yaklaşık 200 ms boyunca göndermek demektir. Joystick 500 ms mesaj almazsa durur. Yalnızca ayarlı cihaz IP'sinden gelen çerçeveler kabul edilir; başka bir adresten veri gelirse arayüz bunu gösterir.
- `server/video.js`: Tarayıcı RTSP oynatamadığı için ffmpeg akışı JPEG karelerine çevirir. Akış başına tek ffmpeg süreci çalışır, tüm izleyiciler onu paylaşır.
- `server/sim.js`: Cihaz simülatörü (`--sim`).
- `web/`: Derleme gerektirmeyen React arayüzü. React ve yazı tipleri yerelden sunulur, sahada internet gerekmez.
- Renkler ve ölçüler `design-system/tokens.json` dosyasından `/tokens.css` olarak üretilir.

## Cihazda doğrulanması gerekenler

Dokümanda açık olmayan birkaç noktada varsayım yapıldı. İlk gerçek denemede kontrol edin:

- **Joystick yönleri:** Sağ ve yukarı pozitif kabul edildi. Ters dönerse Ayarlar → Kumanda yönü'nden ekseni çevirin.
- **Noktadan takip:** Ofsetin işareti sağ ve aşağı pozitif kabul edildi. Kutu tıkladığınız yerin tersine giderse `server/protocol.js` içindeki `trackPoint` eylemini düzeltin.
- **Takip kutusu konumu:** Cihaz kutunun yalnızca boyutunu (piksel) ve merkezden sapmasını (derece) bildirir. Ekrandaki konum, kameraların görüş açısından hesaplanan yaklaşık bir değerdir.
- **Kayıt ve fotoğraflar:** Bunlar cihazdaki TF karta yazılır, bilgisayara değil. Dosyalara FTP ile (`192.168.144.108`) erişilir.
- **Görüntü gecikmesi:** MJPEG dönüşümü birkaç yüz milisaniye gecikme ekler. En düşük gecikme için cihazın analog çıkışını kullanın.

## Test

```bash
npm test
```
