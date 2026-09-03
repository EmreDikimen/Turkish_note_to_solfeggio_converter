/**
 * Every word the app says, in one place.
 *
 * No i18n framework: there is one language, and one module means the whole voice of the product
 * is reviewable in a single diff. It is also why this file can be edited freely — since
 * ui/status.ts moved the deploy checks onto data attributes, nothing asserts on this copy.
 *
 * Terminology follows what a Turkish musician actually says: porte (stave), şerit (strip), ölçü
 * (measure), donanım (key signature), karar (final), koma, perde, güfte (lyrics), usul, makam.
 */

export const TR = {
  brand: "KomaVision",
  tagline:
    "Notanın fotoğrafını yükleyin: perdeler okunur, nota dizilir ve 53 komalı sesiyle çalınır.",

  // The legal footer (added 2026-08-08, the copyright pass). Three separate promises, and each one
  // is a statement of fact about the code, not a disclaimer:
  //   - uploads are not stored: apps/server/src/index.ts never writes an image to disk;
  //   - the user owns what they upload: the app bundles no score of its own any more;
  //   - there is a way to reach a human: the repo's issue tracker, so no personal address is
  //     published (owner's choice, 2026-08-08).
  // ⚠ If the server ever starts persisting an upload, the first line becomes false — change it
  // there and here in the same commit.
  footer: {
    privacy: "Yüklediğiniz görüntüler sunucuda saklanmaz; okunur ve silinir.",
    rights:
      "Yüklediğiniz notanın haklarından siz sorumlusunuz. Uygulama kendi içinde hiçbir eser barındırmaz.",
    contactLabel: "Hak sahibiyseniz ve itirazınız varsa:",
    contactText: "bildirin",
    contactHref: "https://github.com/EmreDikimen/Turkish_note_to_solfeggio_converter/issues",
    noticesText: "Kullanılan açık kaynak bileşenler",
    noticesHref: "/THIRD-PARTY.txt",
  },

  hero: {
    title: "Nota sayfasını yükleyin",
    lead: "Notanın fotoğrafını buraya sürükleyin",
    leadCompact: "Yeni nota yükle",
    pick: "Dosya seç",
    // ⚠ Keep this in step with `status.expectServer` below — they are the same promise, said twice
    // (before the upload and during it). 35–55 sn is the measured range for a page, docs/METRICS.md;
    // the "20 saniye" this replaced on 2026-08-08 was never measured and undersold it by half.
    hint: "JPG veya PNG · tek sayfa · yaklaşık 35–55 saniye",
    hintPaste: "Sürükleyin, yapıştırın (⌘/Ctrl+V) ya da seçin",
  },

  transport: {
    play: "▶ Çal",
    pause: "⏸ Duraklat",
    resume: "▶ Devam",
    stop: "■ Dur",
    tempo: "♩ =",
    tempoTitle: (n: number) => `doğal tempo ≈ ${n} BPM`,
    tempoReset: "⟲",
    tempoResetTitle: (n: number) => `doğal tempoya dön (${n} BPM)`,
    metronome: "Metronom",
    percussion: "Usul vuruşu",
    percussionTitle:
      "Metronom yerine usulün kendi düm-tek-ke vuruşlarını çalar. İkisi birlikte de açılabilir.",
    percussionUnavailable: "Bu usulün vuruş kalıbı henüz tanımlı değil",
    percussionVolume: "Vuruş sesi",
    percussionVolumeTitle: "Usul vuruşlarının notalara göre ne kadar yüksek çalacağı",
    percussionKit: "Vurmalı çalgı",
    percussionKitTitle: "Usul vuruşlarının hangi davulda çalınacağı",
    voice: "Çalgı sesi",
    voiceTitle:
      "Notaların hangi çalgıyla seslendirileceği. Gerçek kayıtlar ilk seçtiğinizde indirilir " +
      "(çalgı başına 10–35 MB); inene kadar varsayılan sesle çalar.",
    voiceLoading: (done: number, total: number) => `ses indiriliyor… ${done}/${total}`,
    voiceFailed: "ses indirilemedi — varsayılan sesle çalıyor",
    usul: "Usul",
    usulTitle: "Metronomun vuruş kalıbı. Okuma yanılabilir; buradan düzeltebilirsiniz.",
    makam: "Makam",
    makamNone: "yok (yazıldığı gibi)",
    makamTitle:
      "Eserin nasıl ÇALINDIĞI. ♪ işaretli makamlarda bazı perdeler yazıldığı yerden farklı " +
      "seslenir; portedeki notalar değişmez.",
    transpose: "Transpozisyon",
    transposeTitle: "Eserin tamamını seçtiğiniz kadar tizleştirir ya da pesleştirir",
    keepSheet: "Porte değişmesin (yalnızca ses)",
    keepSheetTitle:
      "Göçürücü sazlar için — kız/mansur ney aynı notayı okur, farklı seslendirir. Ses kayar, " +
      "yazı olduğu gibi kalır.",
    accidentals: "Arıza işaretleri",
    accidentalsTitle: "Arıza işaretlerinin portede nasıl gösterileceği",
    accidentalsEvery: "Her notada",
    accidentalsKeysig: "Donanım (satır başında)",
    accidentalsMeasure: "Standart (ölçü boyunca)",
  },

  card: {
    viewSheet: "Nota",
    viewInstrument: "Enstrüman üzerinde",
    lyrics: "Güfte",
    lyricsTitle: "Notaların altına güfte hecelerini yaz",
    edit: "✎ Düzenle",
    editing: "✓ Düzenleniyor",
    undo: "↶ Geri al",
    undoTitle: "Son değişikliği geri al (Ctrl/⌘+Z)",
    redo: "↷ Yinele",
    redoTitle: "Geri alınan değişikliği yinele (Ctrl/⌘+Shift+Z)",
    meta: (makam: string, usul: string, composer: string | undefined, notes: number, dur: string) =>
      `makam ${makam} · usul ${usul}${composer ? ` · ${composer}` : ""} · ${notes} nota · ${dur}`,
    hintSheet: "Bir ölçüye tıklayın, eser oradan çalar.",
    hintSheetEditing:
      "Düzenleme açık — bir notaya tıklayın: seçilir, ✕ ile silinir, yukarı/aşağı sürükleyince " +
      "perdesi değişir. Alet çantasından bir süre ya da değiştirme işareti seçip notaya " +
      "tıklarsanız o nota değişir. Bir süre seçiliyken boşluğa tıklarsanız oraya yeni nota " +
      "eklenir — perdesini tıkladığınız yükseklik belirler. Üçleme aracıyla bir notaya, sonra iki " +
      "sonrakine tıklayın: üçü üçleme olur. Ölçü usulden uzun ya da kısa kalırsa sağ üst köşesinde " +
      "bir işaret belirir. Tekrar ve yön işaretlerini (‖: :‖ 1./2. 𝄋 ⊕ D.C. Son) alet çantasından " +
      "seçip bir ölçüye tıklayarak koyabilirsiniz; kaldırmak için Seçim'e geçip işaretin üstüne " +
      "tıklayın. Alet çantasını başlığından tutup istediğiniz yere sürükleyebilir, sağ üstteki " +
      "düğmeyle küçültüp büyütebilirsiniz.",
    hintInstrument:
      "Çalın: eserin o anda çaldığı yer, seçtiğiniz enstrümanın üzerinde gösterilir. Enstrümanı " +
      "yukarıdaki listeden değiştirebilirsiniz — ses de ona göre ayarlanır.",
  },

  sheet: {
    deleteNote: "Notayı sil",
    pickTuplet: "Üçleme işareti — tıklayın, üçleme seçilir",
    pickBrokenTuplet:
      "Eksik üçleme işareti — üç notayı kapsamıyor, model yanlış okumuş olabilir. " +
      "Tıklayın: uçlarından sürükleyip tamamlayabilir veya ✕ ile kaldırabilirsiniz",
    removeTuplet: "Üçlemeyi kaldır — notalar kalır, süreleri eski hâline döner",
    tupletHandle: "Sürükleyerek üçlemeyi kaydır",
    tupletHandleFix: "Sürükleyerek üçlemeyi tamamla veya daralt",
    removeSign: "İşareti kaldır — tıklayın",
    repeatFrom: "Tekrar buradan başlasın",
    repeatTo: "Tekrar burada bitsin",
    repeatCancel: "Vazgeç — tekrar konmadı",
    openRepeat:
      "Tamamlanmamış tekrar başı ‖: — kapatacak bir :‖ yok, o yüzden portede çizilmiyor ve eser " +
      "düz çalıyor. Bir :‖ koyun ya da tıklayıp bunu kaldırın",
  },

  palette: {
    title: "Alet çantası",
    dragTitle: "Başlığından tutup istediğiniz yere sürükleyin",
    collapse: "Küçült",
    expand: "Büyüt",
    playback: "Dinle",
    play: "▶ Çal",
    stop: "■ Dur",
    playFromTitle: (measure: number) =>
      `Son düzenlenen ölçüden (${measure}. ölçü) çal — düzeltmeyi duymak için`,
    playFromTopTitle: "Baştan çal — henüz bir düzenleme yapılmadı",
    stopTitle: "Çalmayı durdur",
    durations: "Süre",
    rests: "Es",
    accidentals: "Değiştirme",
    durationTitle: (frac: string) =>
      `${frac} — seçip bir notaya tıklayın, süresi bu olur; boşluğa tıklayın, oraya eklenir`,
    restTitle: (frac: string) =>
      `${frac} es — seçip boşluğa tıklayın, oraya es girer; bir notaya tıklarsanız o nota es olur`,
    accidentalTitle: (name: string) => `${name} — seçip bir notaya tıklayın`,
    tuplets: "Üçleme",
    tupletTitle:
      "Üçleme — ilk notaya, sonra iki sonrakine tıklayın: üçü üçleme olur. Var olan bir üçlemeyi " +
      "seçmek için notalarına değil, üstündeki 3 işaretine tıklayın: sonra uçlarından sürükleyerek " +
      "kaydırabilir, ✕ ile kaldırabilirsiniz",
    repeats: "Tekrar",
    repeatTitle:
      "Tekrar — seçin, sonra iki çizgiye tıklayın: önce tekrarın başlayacağı ölçü çizgisi, sonra " +
      "biteceği çizgi. ‖: ve :‖ birlikte konur",
    hintRepeatStart: "Tekrar nerede BAŞLASIN? Başlangıç ölçü çizgisine tıklayın. Bırakmak için Esc.",
    hintRepeatEnd: (bar: number) =>
      `Tekrar ${bar}. ölçüden başlıyor. Şimdi nerede BİTSİN? Bitiş ölçü çizgisine tıklayın — ` +
      `soluk çizgilere konamaz. Vazgeçmek için kesik çizgiye ya da Esc.`,
    voltaTitle:
      "1./2. volta — bir tekrarın içindeki ölçüye tıklayın: o ölçü \"1.\" olur, :‖ işaretinden " +
      "sonraki ölçü de \"2.\". İkinci dönüşte 1. atlanır. İkisi birlikte konur, birlikte kalkar",
    navigation: "Yön",
    segnoTitle:
      "𝄋 — ilk koyduğunuz 𝄋 bir bölümün başını işaretler; sonraki her 𝄋 o bölümü yeniden çalıp " +
      "geri döner. Bölümün nerede bittiğini sayfanın söylemesi gerekir: bir \"Son\" ya da bir :‖",
    codaTitle: "⊕ — birincisi atlama noktası, ikincisi varış noktası. İkiden fazlası konmaz",
    dc: "D.C.",
    dcTitle: "D.C. — eserin sonuna konur, baştan bir kez daha çalınır (tekrarlar alınmaz)",
    fine: "Son",
    fineTitle: "Son — parçanın bittiği yer. D.C. dönüşü burada durur, 𝄋 bölümü burada biter",
    hintArmedSign:
      "Bir ölçüye tıklayın: işaret o ölçüye konur. Konmuş bir işareti kaldırmak için Seçim'e " +
      "geçip işaretin üstüne tıklayın. Bırakmak için Esc.",
    // ⚠ Every one of these is a REFUSAL, and each says what would have gone wrong — a sign that
    // draws one thing and sounds another. The gate is in structure-edit.ts; this is its voice.
    refused: {
      offScore: "Burası eserin dışında — işaret konamaz.",
      backwards: "Tekrar geriye doğru olmaz: bitiş, başlangıçtan önceki bir çizgi olamaz.",
      voltaOutside: "Volta ancak bir tekrarın içine konur. Önce Tekrar aracıyla bir tekrar çizin.",
      voltaFar:
        "Bu ölçü :‖ işaretinden fazla uzakta. Bir volta en çok dört ölçüdür; :‖ işaretine daha " +
        "yakın bir ölçüye tıklayın.",
      voltaLast: "\"2.\" için :‖ işaretinden sonra ölçü kalmıyor.",
      codaFull: "Zaten iki ⊕ var: biri atlama, biri varış. Üçüncüsü bir şey ifade etmez.",
      conflict:
        "Bu işaret buraya konursa çizildiği gibi çalmaz. Örneğin: açık bir tekrarın içine ikinci " +
        "bir ‖:, bölümünün nerede bittiği belli olmayan bir 𝄋, ya da eserin ortasında bir D.C.",
    },
    select: "↖ Seçim",
    selectTitle: "Aracı bırak: tıklamak seçer, sürüklemek perdeyi değiştirir (Esc)",
    hintIdle: "Bir araç seçin, sonra notaya tıklayın.",
    hintArmedDuration:
      "Notaya tıklayın: süresi değişir. Boşluğa tıklayın: oraya yeni nota eklenir — perdesini " +
      "tıkladığınız yükseklik belirler. Bir ese tıklarsanız o es, tıkladığınız yükseklikteki " +
      "notaya döner. Bırakmak için Esc.",
    hintArmedRest:
      "Boşluğa tıklayın: oraya es girer. Bir notaya tıklarsanız o nota es olur. Bırakmak için Esc.",
    hintArmedAccidental: "Şimdi bir notaya tıklayın. Bırakmak için Esc.",
    hintTupletStart:
      "Üçlemenin ilk notasına tıklayın. Soluk notalar üçleme yapamaz. Var olan bir üçlemenin " +
      "notasına tıklarsanız üçleme kalkar. Bırakmak için Esc.",
    hintTupletEnd: "Şimdi üçlemenin son notasına tıklayın. Vazgeçmek için ilk notaya ya da Esc.",
  },

  bar: {
    over: (beats: string, meter: string) => `Bu ölçü ${meter} usulünden uzun (${beats})`,
    under: (beats: string, meter: string) => `Bu ölçü ${meter} usulünden kısa (${beats})`,
  },

  instrument: {
    pick: "Enstrüman",
    hintViolin:
      "Nokta, parmağın kemanda basacağı yeri gösterir. Renkli çizgiler standart keman " +
      "notalarıdır — birinci pozisyonda dört parmağın normalde bastığı yedi yer, her eserde " +
      "aynı; renk, o çizgiyi hangi parmağın bastığını gösterir. Kemanda perde yoktur: koma " +
      "sesler iki çizginin arasına düşer, koma farkı da buradan görülür. Çizgileri " +
      "kapatabilirsiniz. Açık Sol telinin altına düşen sesler kemanda çıkmaz; o notada nokta " +
      "görünmez.",
    hintKanun:
      "Kırmızı olan perde, o an çalınan perdedir — üç teli birden yanar, çünkü kanunda bir " +
      "perde üç teldir. Soldaki kutucuklar mandallardır: her perde için 12 tane, her biri bir " +
      "koma. Açık renk olan kalkık mandaldır, koyu olanlar inik; sarı kesik çerçeve natürelin " +
      "yeridir. Bir mandal yeni değiştiyse çerçevesi kırmızı yanar ve sonra söner — kutucuğun " +
      "rengi değişmez, çünkü renk mandalın durumunu taşır. Eserin başında kurulacak mandallar " +
      "yukarıda yazılıdır: kanuncu çalmaya başlamadan önce onları kurar. Kanunun sesinin " +
      "dışındaki notalarda hiçbir perde yanmaz.",
    hintClarinet:
      "Kırmızı olan delikler ve tuşlar, o notada basılacak olanlardır — dolu daire kapalı " +
      "delik, boş daire açık deliktir. Baş parmak deliği ve register tuşu solda çizilir, " +
      "çünkü onlar enstrümanın arkasındadır. Soldaki çubuk dudak çubuğudur: klarnette koma " +
      "sesler dudağı bir miktar salarak verilir, çubuk da ne kadar salınacağını gösterir. " +
      "Her çizgi bir komadır, en fazla beş koma. Çubuk boşsa nota parmağın kendi sesidir, " +
      "dudak salınmaz. Klarnetin sesinin dışındaki notalarda hiçbir şey yanmaz.",
    clarinetBack: "arka",
    hintClarinetAlt: "Sol klarnet fotoğrafı — basılan delikler ve dudak çubuğu",
  },

  fingerboard: {
    // The tuning picker only appears once there is more than one tuning to pick — see Fingerboard.tsx.
    tuning: "Akort",
    alt: "Keman klavyesi — çalınan sesin parmak yeri",
    lines: "Perde çizgileri",
    linesTitle:
      "Çizgiler, kemanda birinci pozisyonda parmakların normalde bastığı yedi standart yerdir — " +
      "her eserde aynıdır. Kemanda perde yoktur; koma sesler iki çizginin arasına düşer. " +
      "İsterseniz kapatabilirsiniz.",
    zoom: "Klavyeyi yakınlaştır",
    zoomTitle:
      "Yalnızca klavyeyi gösterir. Yakınlık bu esere göre ayarlanır: en yukarıda çalınan " +
      "perdeye kadar iner, böylece hiçbir nota çerçevenin dışında kalmaz.",
  },

  kanun: {
    alt: "Kanun — çalınan telin ve mandalların yeri",
    zoom: "Mandallara yaklaş",
    zoomTitle:
      "Mandalları büyütür. Yakınlık bu esere göre ayarlanır: yalnızca eserin kullandığı tel " +
      "gruplarını gösterir, böylece kutucuklar telefonda da okunur.",
    opening: "Çalmadan önce kurulacak mandallar:",
    openingNone: "hepsi natürel",
  },

  advanced: {
    summary: "Gelişmiş",
    note: "geliştirici ayarları",
    sample: "Örnek eser",
    sampleLoaded: "(yüklenen dosya)",
    loadJson: "JSON yükle",
    readStrips: "Şeritleri oku",
    readStripsTitle:
      "Bir sayfanın *_sNN_wNN.png kırpımlarını seçin — model bunları okur ve sonucu yükler",
    sliceInspector: "🔍 Dilim denetçisi",
    sliceInspectorTitle: "Dilimleyicinin bir sayfadan kestiği şeritleri gösterir — model yok, eser yok",
    hyphens: "Hece çizgisi",
    hyphensTitle: "Bir kelimenin heceleri arasına çizgi koyar (Gam-ze-de). Çoğu nota koymaz.",
    repeats: "Tekrarlar",
    repeatsTitle:
      "Bulunan tekrar çizgilerini ve volta parantezlerini çizer. Yalnızca görsel — eser, " +
      "yerleşim ve çalma değişmez.",
    writeOut: "Tekrarları açık yaz",
    writeOutTitle:
      "Okunan sayfa normal nota gibi yazılır: tekrar edilen kısım bir kez, başında ‖: sonunda :‖ " +
      "ile. Bu kutu onu eskisi gibi uzun uzun yazar — her tekrar açılır, işaretler çizilmez. " +
      "Yalnızca bakmak için: açıkken düzenleme kapanır, çalma iki durumda da aynıdır.",
    pitchRange: (lo: number, hi: number, cents: number) =>
      `ses alanı: koma ${lo}–${hi} (${cents} sent)`,
  },

  // The raw decode inspector: what the MODEL said, before the stitcher and the editor touched it.
  // Deliberately not the same thing as `strips` below, which re-serializes the score on screen.
  decode: {
    title: "Modelin ham çıktısı",
    subtitle:
      "Son okunan sayfanın her şeridi için modelin ürettiği bütün jetonlar — birleştirmeden ve " +
      "düzenlemeden önce. Portede göremediğiniz bir şey burada görünür. Notalar do–re–mi olarak " +
      "yazılır (do''4 = c''4); indirilen JSON harflerle kalır — ham hâli için jetonun üstüne gelin.",
    empty: "Henüz bir sayfa okunmadı. Bir görsel yükleyin, sonra buraya bakın.",
    summary: (strips: number, tokens: number, where: string) =>
      `${strips} şerit · ${tokens} jeton · ${where}`,
    whereServer: "sunucuda okundu",
    whereBrowser: "bu bilgisayarda okundu",
    stripLine: (system: number, window: number) => `porte ${system} · pencere ${window}`,
    tokenCount: (n: number) => `${n} jeton`,
    confidence: (mean: string, min: string) => `güven: ort ${mean} · en düşük ${min}`,
    hitCap: "⚠ jeton sınırına dayandı — bu şerit yarım okunmuş olabilir",
    text: "okunan satır:",
    tokenList: "jetonlar (sırayla, her birinin güveniyle):",
    warnings: (n: number) => `${n} birleştirme uyarısı`,
    warningsNote: "Modelin ürettiği ama birleştiricinin kullanamadığı yerler:",
    download: "Ham çıktıyı indir (JSON)",
    downloadTitle: "Bütün şeritlerin jetonları, id'leri ve güven değerleri tek dosyada",
    empty2: "Bir şerit seçin: modelin o şeritte ürettiği jetonlar burada görünsün.",
  },

  strips: {
    title: "Şerit dışa aktarımı (Adım 2c)",
    modeEvery: "her nota",
    modeKeysig: "donanım",
    count: (n: number) => `${n} şerit · birini seçin, kırpım alanı portede işaretlensin`,
    label: "etiket:",
    decoded: "çözümlenen:",
    empty: "Bir şerit seçin: etiketi ve çözümlenen notaları burada görünsün.",
  },

  status: {
    loadingModel: "model hazırlanıyor…",
    slicing: "sayfa dilimleniyor…",
    readingStrips: (n: number) => `${n} şerit okunuyor…`,
    readingOnServer: (n: number) => `${n} şerit sunucuda okunuyor…`,
    wakingServer: "sunucu uyanıyor…",
    readingStrip: (i: number, n: number) => `şerit ${i} / ${n} okunuyor…`,
    stitching: "birleştiriliyor…",
    stripsDone: (strips: number, notes: number, measures: number, secs: string, perStrip: string) =>
      `${strips} şerit okundu → ${notes} nota, ${measures} ölçü · ${secs} sn ` +
      `(şerit başına ${perStrip} ms)`,
    pageDone: (
      staves: number,
      strips: number,
      notes: number,
      measures: number,
      sliceS: string,
      readS: string
    ) =>
      `Sayfa okundu: ${staves} porte → ${strips} şerit → ${notes} nota, ${measures} ölçü · ` +
      `dilimleme ${sliceS} sn · okuma ${readS} sn`,
    deskewed: (deg: string) => ` (${deg}° düzeltildi)`,
    makam: (name: string) => ` · makam: ${name}`,
    makamUnknown: " · makam: tanınmadı",
    onServer: " · sunucuda okundu",
    onDeviceFallback: " · kendi cihazınızda okundu (sunucu yanıt vermedi)",
    onDevice: " · kendi cihazınızda okundu",
    warnings: (n: number) => ` — ${n} uyarı`,
    elapsed: (s: number) => `${s} sn`,
    expectServer: "genelde 35–55 sn sürer",
    expectLocal: "bu okuma sizin cihazınızda yapılıyor, biraz uzun sürebilir",
    // True as of the 2026-08-08 retry fix: a sleeping server is now WAITED for (~10 s, docs/METRICS.md)
    // instead of the page silently being read on the user's own machine.
    coldStart: "Sunucu uykudaysa ilk okuma 10–15 sn daha uzun sürebilir.",
  },

  /** The slicer's own phase names (apps/web/src/omr/page.ts reports these keys). */
  phases: {
    "reading the image": "görüntü okunuyor",
    "checking the page angle": "sayfa açısı ölçülüyor",
    "finding the staves": "porteler bulunuyor",
    "cutting the strips": "şeritler kesiliyor",
  } as Record<string, string>,

  errors: {
    lead: "Hata:",
    detail: "Teknik ayrıntı",
    retry: "Tekrar deneyin",
    noStaves: "Bu sayfada porte bulunamadı.",
    noStavesTips: [
      "Tek sayfa olsun — iki sayfalık açılım okunmuyor.",
      "Notayı düz ve tam çekin; kenarları kesilmesin.",
      "Gölge, buruşukluk ve eğim okumayı zorlaştırır.",
    ],
    nothingRead: "Bu sayfadan hiçbir nota okunamadı.",
    nothingReadStrips: "Bu görüntülerden hiçbir nota okunamadı.",
    readFailed: "Nota okunamadı — bağlantınızı kontrol edip tekrar deneyin.",
    badSchema: (v: unknown) => `Desteklenmeyen dosya sürümü (schemaVersion ${v}).`,
    couldNotLoad: (f: string) => `${f} yüklenemedi.`,
  },

  makamModal: {
    titleGuess: (name: string) => `Bu eser ${name} gibi görünüyor`,
    titleUnknown: "Hangi makam?",
    leadGuess:
      "Makam, eserin nasıl ÇALINDIĞINI belirler — bazı perdeler yazıldığı yerden farklı seslenir. " +
      "Portedeki notalar değişmez.",
    leadUnknown:
      "Bu donanımı basan bir makam bulunamadı; eser yazıldığı gibi çalınacak. Biliyorsanız siz seçin.",
    signature: "okunan donanım",
    signatureNone: "yok (değiştirme işareti yok)",
    karar: "karar perdesi",
    kararNone: "okunamadı",
    kararNoHelp: "— tahmini daraltmadı",
    alternatives: "aynı donanım",
    makam: "Makam:",
    none: "yok — tam yazıldığı gibi çal",
    noDeviation: "Bu makam için kayıtlı bir icra sapması yok — yazıldığı gibi çalınır.",
    asWritten: "Notalar sayfada yazıldığı gibi seslendirilecek.",
    rule: (delta: string, letter: string, alter: string) =>
      `yazılı ${letter}${alter} perdesinde ${delta} koma`,
    playAsWritten: "Yazıldığı gibi çal",
    useThis: "Bunu kullan",
  },

} as const;

/** Turkish decimal comma, for the numbers shown in the status line. */
export function num(n: number, digits = 1): string {
  return n.toFixed(digits).replace(".", ",");
}
