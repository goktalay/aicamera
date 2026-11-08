# IpField

Dört oktetli IP adresi girişi; kaynak programdaki IP değiştirme ekranının karşılığı. Her oktet 0–255 ile sınırlıdır, üç hane yazılınca ya da "." basılınca sonraki okteta geçer. `onChange` birleşik adresi (`192.168.144.108`) verir.

- IP değiştirmek bağlantıyı koparır: kaydetmeden önce `Dialog` ile onay alın.
