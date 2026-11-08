# aicamera

CPDD075CCT üç ışıklı AI takip modülü (gimbal, iki görünür ışık kamerası ve bir kızılötesi kamera) için web tabanlı kontrol uygulaması ve üreticinin verdiği dokümanlar ile programlar.

## Klasörler

| Klasör | İçerik |
| --- | --- |
| `codes/` | Web kontrol uygulaması: kurulum ve çalıştırma için [`codes/README.md`](codes/README.md) |
| `codes/design-system/` | Tracklight tasarım sistemi: token'lar, React bileşenleri, kullanım rehberi |
| `documents/` | Üretici dokümanları: teknik şartname, S.BUS kanal tablosu, FPV kullanım kılavuzu, seri haberleşme protokolü V2.14 |
| `design/` | Boyut çizimleri (PDF) ve 3D model (STP) |
| `programs/` | Üreticinin Windows programları: Remote Control paneli, PodAssistant (S.BUS ayarı ve yazılım yükseltme) |

## Tasarım sistemi

Tracklight, üreticinin Remote Control programındaki koyu temadan ve dokümanlarından çıkarıldı. Ayrıntılar ve kullanım: [`codes/design-system/README.md`](codes/design-system/README.md).

## Cihaz bağlantısı (varsayılanlar)

- Video: `rtsp://192.168.8.102/live/0` (TV), `rtsp://192.168.8.102/live/1` (IR)
- Komut: sunucu `192.168.144.108`, komut portu `12350`, paket portu `20002`
- Seri: 115200 baud
