# VideoPane

Canlı video bölmesi ve üzerindeki HUD: kaynak etiketi (TV veya IR ve palet), kayıt göstergesi, artı işareti, takip kutusu ve alt şerit okumaları. Zemin, HUD ve takip renkleri temadan bağımsızdır.

- Görüntüyü `children` olarak verin (`<video>`, `<img>`, `<canvas>`); tarayıcı RTSP oynatamaz, akış sunucuda WebRTC veya HLS'e çevrilir.
- `track` yüzde cinsinden konumdur `{x, y, w, h, label}`; piksel koordinatlarını videonun çözünürlüğüne bölerek çevirin.
- Kayıt sürerken `recording` ve `recTime` verin.
