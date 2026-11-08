# DirPad

Gimbal yunuslama (pitch) ve sapma (yaw) için basılı tutulan yön tuşları; ortadaki tuş merkeze alır. Basılı tutulduğu sürece `onMove(dir)`, bırakılınca `onStop(dir)` çağrılır; hareket hızı uygulamada belirlenir.

- Klavye: uygulama ok tuşlarını da aynı işleve bağlamalıdır.
- Kullanan sağlar: `onMove`, `onStop`, `onCenter` ve yanında güncel açıları gösteren `Readout`.
