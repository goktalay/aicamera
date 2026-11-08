# ControlButton

Kamera ve gimbal için ikonlu, basılı kalabilen tuş; kaynak programdaki `*_normal` / `*_down` ikon çiftlerinin karşılığıdır. Basılı hâl `aria-pressed` ile duyurulur ve `accent-fill` zeminle görünür; kayıt tuşu (`tone="record"`) basılıyken `danger-fill` olur.

- Tek seferlik eylemler (Fotoğraf) basılı kalmaz: `pressed={false}` verip yalnızca `onClick` kullanın.
- Açık/kapalı durumlar (Kayıt, PIP, SBS, AI takip, Lazer) basılı kalır; `pressedLabel` ile "Durdur" gibi ikinci bir etiket verin.
- Kullanan sağlar: cihazdan gelen gerçek durumu `pressed` olarak; tuş durumu tahmin etmez.
