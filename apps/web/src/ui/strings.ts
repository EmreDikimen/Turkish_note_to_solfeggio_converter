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

  hero: {
    title: "Nota sayfasını yükleyin",
    lead: "Notanın fotoğrafını buraya sürükleyin",
    leadCompact: "Yeni nota yükle",
    pick: "Dosya seç",
    hint: "JPG veya PNG · tek sayfa · yaklaşık 20 saniye",
    hintPaste: "Sürükleyin, yapıştırın (⌘/Ctrl+V) ya da seçin",
    sampleNudge: "Ya da hazır bir örneği dinleyin",
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
    viewRoll: "Piyano rulosu",
    lyrics: "Güfte",
    lyricsTitle: "Notaların altına güfte hecelerini yaz",
    edit: "✎ Düzenle",
    editing: "✓ Düzenleniyor",
    undo: "↶ Geri al",
    undoTitle: "Son değişikliği geri al (Ctrl/⌘+Z)",
    redo: "↷ Yinele",
    redoTitle: "Geri alınan değişikliği yinele (Ctrl/⌘+Shift+Z)",
    save: "⬇ JSON indir",
    saveTitle: "Düzelttiğiniz eseri nota-modeli JSON dosyası olarak indirin",
    meta: (makam: string, usul: string, composer: string | undefined, notes: number, dur: string) =>
      `makam ${makam} · usul ${usul}${composer ? ` · ${composer}` : ""} · ${notes} nota · ${dur}`,
    hintSheet: "Bir ölçüye tıklayın, eser oradan çalar.",
    hintSheetEditing:
      "Düzenleme açık — bir notaya tıklayın: seçilir, ✕ ile silinir, yukarı/aşağı sürükleyince " +
      "perdesi değişir. Soldaki paletten bir süre ya da değiştirme işareti seçip notaya " +
      "tıklarsanız o nota değişir. Bir süre seçiliyken boşluğa tıklarsanız oraya yeni nota " +
      "eklenir — perdesini tıkladığınız yükseklik belirler. Üçleme aracıyla bir notaya, sonra iki " +
      "sonrakine tıklayın: üçü üçleme olur. Ölçü usulden uzun ya da kısa kalırsa sağ üst köşesinde " +
      "bir işaret belirir.",
    hintRoll:
      "Dikey eksen 53 koma. Notayı yukarı/aşağı sürükleyin: perde değişir. Sağ kenarından " +
      "çekin: süresi değişir.",
  },

  sheet: {
    deleteNote: "Notayı sil",
  },

  palette: {
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
      "Üçleme — ilk notaya, sonra iki sonrakine tıklayın: üçü üçleme olur. Var olan bir " +
      "üçlemenin herhangi bir notasına tıklarsanız üçleme kalkar",
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
    pitchRange: (lo: number, hi: number, cents: number) =>
      `ses alanı: koma ${lo}–${hi} (${cents} sent)`,
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
    coldStart: "Sunucu uykudaysa ilk okuma 10–30 sn daha uzun sürebilir.",
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
