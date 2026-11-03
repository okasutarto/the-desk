# Rencana bangun ulang room 3D

[← Back to README](../README.md)

Per 3 November 2026. Rencana ini untuk branch terpisah, bukan perubahan langsung ke `master`.

## Ringkasan

Targetnya room 3D dengan tampilan yang sama, tapi GPU per frame turun dari sekitar 17–27 ms
ke sekitar 5–8 ms di laptop, dan nol saat ruangan diam. Caranya dengan memindahkan kerja berat
dari browser pengunjung ke tahap build: bayangan dan AO statis di-bake, geometri dan tekstur
disiapkan sebelum dikirim, dan render hanya terjadi saat ada yang bergerak.

Angka target masih estimasi dan harus dibuktikan dulu lewat spike pertama.

## Kondisi sekarang

Bayangan dan AO memakan kira-kira setengah waktu GPU, dan ruangan yang diam tetap dirender
sekitar 50 fps. Semua geometri (sekitar 25 ribu baris JS) dan tekstur kanvas dibuat di browser
pengunjung. Setiap frame menjalankan N8AO, bayangan PCSS dan beberapa shadow map (matahari,
jendela, lampu, lightbar).

Pengukuran 3 November 2026: build produksi, Chromium lewat Playwright, Apple M5 Pro,
1440×900 @2x, ruangan diam. Setiap mode diukur dua kali. Waktu GPU dari headless naik-turun
sekitar ±5 ms, jadi pegang polanya, bukan angka pastinya.

| Mode `?perf&bench=` | FPS | GPU (ms) | Draw call | Segitiga (ribu) |
| --- | --- | --- | --- | --- |
| `none` (semua aktif) | 45–47 | 17–27 | ~600 | 1.150 |
| `no-ao` | 53–60 | 14–18 | ~540 | 1.080 |
| `no-shadows` | 52–60 | 13,5–14 | 440 | 835 |
| `no-pcss` | 39–45 | 15–24 | ~610 | 1.160 |
| `no-batch` | 46–60 | 18–21 | 1.500–1.640 | 490–550 |

Temuan:

- **Bayangan paling mahal.** Tanpa bayangan, GPU turun ke ~14 ms dan ~320 ribu segitiga hilang.
  PCSS sendiri tidak jelas lebih mahal. Yang mahal adalah jumlah pass shadow map.
- **Shadow map matahari dan jendela digambar ulang ~12×/detik walaupun ruangan diam**
  ([animation.js:472](../src/features/desk3d/scene/animation.js#L472)). Tujuannya supaya gerakan
  kecil seperti lanyard dan jarum jam ikut punya bayangan.
- **Ruangan diam tetap dirender ~50 fps**, jadi laptop pengunjung terus bekerja walaupun mereka
  cuma membaca.
- **Batching menggandakan jumlah segitiga.** `perObjectFrustumCulled = false` di
  [toonBatch.js:130](../src/features/desk3d/toonBatch.js#L130) membuat semua bagian selalu
  digambar, termasuk yang di luar layar. Default di three.js adalah `true`
  ([docs BatchedMesh](https://threejs.org/docs/pages/BatchedMesh.html)). Jumlah draw memang turun,
  tapi GPU tidak jadi lebih cepat.
- **AO berbiaya sekitar 3–10 ms.** Probe otomatis sudah mematikannya di perangkat yang lambat.
- **Startup** sekitar 10 detik saat pertama dibuka (shader belum di-cache), lalu 2–3,5 detik
  setelahnya.

## Opsi arsitektur

Pilihan yang disarankan adalah **B, Blender lewat script**. Geometri dan bake dibuat oleh script
Python yang dijalankan otomatis, sedangkan interaksi tetap di three.js. Dengan cara ini kita dapat
manfaat bake tanpa harus belajar memodelkan di Blender, dan seluruh pipeline bisa dikerjakan
bersama Claude.

| Opsi | Cara kerja | Performa | Dikerjakan bersama Claude | Kelemahan utama |
| --- | --- | --- | --- | --- |
| A. Kode three.js (sekarang) + cache shadow | Tetap seperti sekarang; shadow map statis cuma digambar ulang saat cahaya berubah | Sedang: shadow pass dan render saat diam hilang, AO tetap di runtime | Penuh | Geometri dan tekstur tetap dibuat di browser, startup tetap berat |
| **B. Blender lewat script (`bpy`)** | Script membangun model, unwrap UV, bake per sumber cahaya, export `.glb` + KTX2 | Tinggi: bayangan dan AO statis tidak ada biaya runtime-nya | Penuh: script masuk git, preview dirender ke PNG untuk dicek | Bentuk organik tetap sekualitas sekarang; iterasi lebih lambat karena harus bake ulang |
| C. Blender manual | Dimodelkan dengan mouse di Blender | Tinggi, sama seperti B | Terbatas: Claude tidak bisa memodelkan secara visual | Butuh belajar Blender; `.blend` itu file biner, diff-nya tidak terbaca |
| D. Bake di browser saat runtime | Pathtracer menghitung lightmap di browser pengunjung, lalu disimpan di cache | Tinggi setelah bake pertama | Penuh | Masih eksperimental; kunjungan pertama jadi lambat |

B dan C bisa digabung: benda kotak dan mekanis (meja, rak, monitor) dibuat lewat script, dan
satu atau dua bentuk organik (kucing, tanaman) dimodelkan manual kalau memang perlu.

Opsi A tetap layak dikerjakan di `master` selama rebuild berjalan, karena tiga temuan di atas
(cache shadow statis, berhenti render saat diam, culling per objek) bisa diperbaiki tanpa
menulis ulang.

## Referensi

| Referensi | Isinya | Pelajaran untuk The Desk |
| --- | --- | --- |
| [Bruno Simon, studi kasus folio 2025 (Awwwards)](https://www.awwwards.com/brunos-portfolio-case-study.html) | Seluruh dunia dibangun di Blender, dipilih karena salah satunya bisa di-script dengan Python. Nama objek dipakai sebagai penanda perilaku. Shader ditulis dengan TSL dan otomatis jalan di WebGPU. Instancing, frustum culling, faces tersembunyi dihapus, satu tekstur palet bersama, tekstur ETC1S/UASTC, Draco, preset mobile | Pola yang sama dengan opsi B. Konvensi nama objek di Blender bisa menggantikan wiring manual di JS. TSL layak dipertimbangkan supaya siap WebGPU |
| [Three.js Journey, Baking and exporting the scene](https://www.threejs-journey.com/lessons/baking-and-exporting-the-scene) | Persiapan bake: hapus faces tersembunyi, jadikan duplikat single-user, perbaiki arah normal (faces terbalik di-bake hitam), apply scale sebelum unwrap. Untuk Blender 4+: margin "Extend" | Semua langkah ini perlu ada di script generator, bukan dikerjakan manual |
| [three.js `MeshToonMaterial` (source r183)](https://app.unpkg.com/three@0.183.2/files/src/materials/MeshToonMaterial.js) | `lightMap` dan `aoMap` didukung, keduanya butuh set UV kedua. `gradientMap` harus memakai filter nearest | Toon + lightmap didukung bawaan, jadi tidak perlu shader dari nol. Mungkin tetap perlu patch supaya lightmap masuk ke ramp, bukan sekadar ditambahkan |
| [OmarShehata/webgl-outlines](https://github.com/OmarShehata/webgl-outlines) | Outline sebagai post-process dari buffer depth + normal, lalu FXAA. Ada versi three.js. Repo ini juga menautkan artikel lanjutan soal outline berbasis surface ID | Pengganti inverted hull: satu pass layar penuh, bukan geometri ganda |
| [glTF Transform CLI](https://gltf-transform.dev/cli) | `optimize`, `meshopt`, `etc1s`/`uastc` (KTX2), `instance`, `join` | Langkah kompresi setelah export dari Blender |
| [gonnavis/three-lightmap-baker](https://github.com/gonnavis/three-lightmap-baker) | Demo bake di browser: UV2 lewat xatlas-three, raycast dengan three-mesh-bvh, kode cahaya diambil dari three-gpu-pathtracer. Belum ada bounce, cuma satu lampu | Bahan untuk opsi D. Belum siap produksi |
| [pmndrs/react-three-lightmap](https://github.com/pmndrs/react-three-lightmap) | Bake lightmap dan AO di browser untuk R3F. Hanya cahaya tidak langsung; denoise dan simpan/muat hasil bake belum selesai | Sama, belum siap untuk opsi D |


## Rencana yang direkomendasikan

### Pipeline build

```text
bake/*.py (bpy, headless)
  ├─ bangun geometri statis (meja, rak, dinding, monitor, props diam)
  ├─ hapus faces tersembunyi, apply scale, perbaiki normal
  ├─ UV0 untuk tekstur, UV1 untuk lightmap (Lightmap Pack)
  ├─ bake cahaya saja (tanpa warna permukaan), per sumber cahaya
  └─ export room.glb + lightmap
        ↓
gltf-transform: meshopt + KTX2
        ↓
public/desk/ → dimuat three.js
```

Dijalankan dengan satu perintah, misalnya `npm run bake`. Versi Blender dikunci seperti `three`.

### Bake per sumber cahaya, bukan per kombinasi

| Lightmap | Jumlah | Dipakai saat |
| --- | --- | --- |
| Matahari/jendela | 4 (pagi, siang, sore, malam) | Sesuai bagian hari; transisi = blend dua lightmap |
| Lampu meja | 1 | Dikalikan intensitas lampu (on/off, animasi) |
| Neon + lightbar | 1–2 | Dikalikan intensitas masing-masing |
| AO | 1 | Selalu, karena tidak bergantung pada cahaya |

Di shader: `cahaya = Σ intensitas_i × lightmap_i`, lalu hasilnya masuk ke ramp toon. Hujan
cukup memakai versi lightmap yang di-blur, atau dikalikan redup.

Yang di-bake **hanya cahaya**, tanpa warna permukaan. Warna tetap diatur di runtime, jadi
pilihan finishing kayu ([woods.js](../src/features/desk3d/woods.js)) dan tema masih bisa diganti
tanpa bake ulang.

### Yang tetap di runtime

- **Bayangan dinamis:** satu shadow map kecil, hanya untuk props yang bergerak (kucing, kursi,
  kertas, lanyard, barang yang di-drag).
- **Outline:** post-process dari depth + normal (+ surface ID), menggantikan inverted hull.
- **Render on-demand:** tidak ada frame yang dirender saat tidak ada yang bergerak.
- **Culling per objek** di setiap batch.
- **Layar yang berubah** (desktop monitor, Times Gate, chat) tetap kanvas runtime, tapi hanya
  bagian yang berubah yang di-upload.
- **Tekstur statis** (serat kayu, label, cetakan) tetap ditulis sebagai kode, tapi dirender saat
  build ke KTX2. Aturan "Textures are painted in code" di AGENTS.md diubah sesuai ini.

### Yang dipertahankan dari project sekarang

Pemisahan bundle 2D ↔ 3D, probe kualitas, `?perf` dan benchmark, disiplin teardown lewat
`runtime.core.track`, skala 1 unit = 10 cm, dan seluruh logika interaksi di `scene/`.

### Tahapan

1. **Spike:** buktikan pipeline dan angka performanya (lihat bawah).
2. **Pipeline:** `npm run bake` lengkap untuk ruangan kosong, meja dan rak.
3. **Port props statis**, satu per satu, dengan screenshot pembanding di tiap waktu.
4. **Port interaksi dan props bergerak**, bersama bayangan dinamisnya.
5. **Paritas dan peralihan:** `check:desk`, `check:browser`, screenshot pagi/siang/sore/malam/hujan,
   pengukuran ulang dengan setup yang sama, lalu PR ke `master`.

## Spike pertama

Branch `feat/baked-room-spike`. Isinya meja, riser, monitor, satu rak dan dinding belakang.
Bake untuk AO dan matahari siang + malam, lalu tampilkan dengan `MeshToonMaterial` + lightmap.

Spike ini membuktikan pipeline dan performanya. Kecocokan dengan gaya toon belum dinilai di
tahap ini.

Syarat lolos:

- `npm run bake` jalan dari awal sampai akhir tanpa langkah manual, dan hasilnya tampil di
  three.js dengan bayangan dan AO di posisi yang benar (screenshot siang dan malam).
- GPU ≤ 10 ms untuk bagian yang sama, dengan setup pengukuran yang sama seperti di atas.
- Satu putaran bake (ubah script → hasil terlihat) di bawah 5 menit.
- Ukuran lightmap total untuk bagian ini ≤ 1 MB.

Butuh Blender terpasang di Mac (`brew install --cask blender`, sekitar 1 GB).

## Risiko dan pertanyaan terbuka

- **Banding.** Lightmap 8-bit bisa menampilkan garis-garis di gradasi gelap. Mungkin perlu UASTC
  atau format HDR, dan itu menambah ukuran.
- **Ukuran download.** 4–8 lightmap untuk seluruh ruangan bisa mencapai beberapa MB, jadi perlu
  dimuat bertahap.
- **CI.** Menjalankan Blender di CI itu berat. Pertanyaannya: hasil bake di-commit (perlu Git LFS?)
  atau di-build di CI?
- **Bentuk organik** (kucing, tanaman, gitar) tetap sekualitas sekarang kalau dibuat lewat script.
- **Transisi waktu dan hujan** harus tetap semulus sekarang dengan blend lightmap.
- **WebGPU/TSL.** Ambil sekarang sekalian (perlu melepas pin `three` r161, `postprocessing` dan
  `n8ao`), atau tetap WebGL dulu?

### Ditunda

- **Kecocokan dengan gaya toon.** Lightmap cenderung memberi gradasi halus, sementara ramp
  sekarang bertingkat ([Toon RP](https://github.com/Delt06/toon-rp/wiki/Baked-Lighting) juga
  mengingatkan soal ini). Dinilai setelah pipeline dan performa terbukti.
