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
    // ⚠ The touch wording is not a nicety, it is the desktop wording being FALSE on a phone: there
    // is nothing to drag a file from and no ⌘/Ctrl to press. It also names the gesture that is
    // actually best here — the input is `accept="image/*"`, so iOS and Android both open a sheet
    // with the camera at the top of it, and photographing the sheet music in front of you is the
    // whole product. Which pair is shown is decided by `(pointer: coarse)` in UploadHero.
    leadTouch: "Notanın fotoğrafını çekin veya seçin",
    pickTouch: "Fotoğraf çek veya seç",
    // ⚠ Keep this in step with `status.expectServer` below — they are the same promise, said twice
    // (before the upload and during it). 35–55 sn is the measured range for a page, docs/METRICS.md;
    // the "20 saniye" this replaced on 2026-08-08 was never measured and undersold it by half.
    hint: "JPG veya PNG · tek sayfa · yaklaşık 35–55 saniye",
    hintPaste: "Sürükleyin, yapıştırın (⌘/Ctrl+V) ya da seçin",
  },

  // The list of pages this browser has already read (2026-09-05). ⚠ `note` is not filler: the
  // store is a CACHE and the reader has to be told, because "kaydedildi" is a promise no browser
  // storage can keep — see apps/web/src/recentPages.ts. It says the two things that actually
  // surprise people: the browser may clear it, and it does not travel to another device.
  recent: {
    title: "Daha önce okuduklarınız",
    count: (n: number) => `${n} sayfa`,
    show: "Göster",
    hide: "Gizle",
    // The one line under a row: what came out of the read, and when it was last touched.
    summary: (notes: number, measures: number) => `${notes} nota · ${measures} ölçü`,
    openTitle: (name: string) => `${name} sayfasını aç`,
    remove: "✕",
    removeTitle: (name: string) => `${name} sayfasını listeden sil`,
    rename: "✎",
    renameTitle: (name: string) => `${name} sayfasını yeniden adlandır`,
    // ⚠ The makam is drawn BESIDE the name, never inside it — it is re-read from the score on every
    // save, so it survives a rename and follows the reader changing the makam later.
    noMakam: "makamsız",
    clearAll: "Hepsini sil",
    clearConfirm: "Kayıtlı sayfaların hepsi silinecek. Emin misiniz?",
    note:
      "Bu liste yalnızca bu tarayıcıda, bu cihazda tutulur — başka bir cihazda görünmez. " +
      "Tarayıcı yeriniz dolduğunda ya da uzun süre girmediğinizde kendiliğinden silebilir. " +
      "En son okuduğunuz 30 sayfa saklanır; sınıra gelince en eskisi düşer.",
  },

  transport: {
    // The three row captions. They exist because the bar is a panel of twelve controls and a
    // reader needs to know which ones belong together — see the row comment in app.css. Named for
    // what the row DOES, never for the first control in it: "Usul" is a control, "Ritim" is the
    // row it lives in.
    groupPlay: "Çalma",
    groupRhythm: "Ritim",
    groupPitch: "Perde",
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
    // ⚠ These four say what is SOUNDING, not what the picker shows — during a switch made while a
    // piece is playing the two are different on purpose, and that difference is the whole point of
    // the message (`VoiceStatus.sounding`). `heldLabel` is the voice still being heard.
    voiceFailedHeld: (heldLabel: string) =>
      `ses indirilemedi — ${heldLabel} sesiyle devam ediyor`,
    voiceSwitchTitle: (toLabel: string) => `${toLabel} sesine geçiliyor`,
    voiceSwitchHeld: (done: number, total: number, heldLabel: string) =>
      `${total} dosyadan ${done} tanesi indi — şimdilik ${heldLabel} sesiyle çalıyor`,
    voiceSwitchReady: (toLabel: string) => `${toLabel} sesi hazır`,
    voiceSwitchDismiss: "kapat",
    usul: "Usul",
    usulTitle: "Metronomun vuruş kalıbı. Okuma yanılabilir; buradan düzeltebilirsiniz.",
    makam: "Makam",
    makamNone: "yok (yazıldığı gibi)",
    makamTitle:
      "Eserin nasıl ÇALINDIĞI. ♪ işaretli makamlarda bazı perdeler yazıldığı yerden farklı " +
      "seslenir; portedeki notalar değişmez. Hangi perdeler olduğu yanında yazar.",
    transpose: "Transpozisyon",
    transposeTitle: "Eserin tamamını seçtiğiniz kadar tizleştirir ya da pesleştirir",
    // ⚠ Two SEGMENTS of the transposition control, not a loose checkbox beside it (2026-09-03).
    // "Keep the staff" is not an independent setting — it is a MODE of transposing, and it means
    // nothing on its own; notation programs put the same choice inside their transpose dialog
    // (sounding pitch vs written pitch). As a checkbox next to the interval it read as unrelated.
    //
    // ⚠ BOTH LABELS ANSWER ONE QUESTION — "transpozisyon neyi kaydırıyor?" — and they answer it in
    // the same grammar, so the pair can be read as a pair (owner, 2026-09-03: the first attempt,
    // "Porte de kaysın" / "Yalnızca ses", was not explanatory: the two halves were not even the
    // same kind of phrase, so nothing said they were alternatives to each other). `porte` is the
    // word this app already uses for the staff; see the terminology note at the top of this file.
    keepSheetMove: "Porte ve ses",
    keepSheetKeep: "Yalnızca ses",
    keepSheetMoveTitle:
      "Eser olduğu gibi göçer: portedeki notalar da yeni yerine yazılır, ses de oradan çalar. " +
      "Olağan durum.",
    keepSheetKeepTitle:
      "Göçürücü sazlar için — kız ney ile mansur ney aynı notayı okur, farklı seslendirir. " +
      "Yalnızca ses kayar; portede yazan hiçbir şey değişmez.",
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
    follow: "İmleci takip et",
    followTitle:
      "Çalarken imleç ekrandan çıkarsa sayfa kendiliğinden imlece kayar. Kapatırsanız sayfa " +
      "olduğu yerde kalır; seçiminiz bu tarayıcıda hatırlanır.",
    edit: "✎ Düzenle",
    editing: "✓ Düzenleniyor",
    undo: "↶ Geri al",
    undoTitle: "Son değişikliği geri al (Ctrl/⌘+Z)",
    redo: "↷ Yinele",
    redoTitle: "Geri alınan değişikliği yinele (Ctrl/⌘+Shift+Z)",
    meta: (makam: string, usul: string, composer: string | undefined, notes: number, dur: string) =>
      `makam ${makam} · usul ${usul}${composer ? ` · ${composer}` : ""} · ${notes} nota · ${dur}`,
    hintSheet: "Bir ölçüye tıklayın, eser oradan çalar.",
    // ⚠ ONE sentence, then a closed list (2026-09-03). This used to be a single ten-line paragraph
    // under the score, which is the shape nobody reads: the one thing a first-time editor needs —
    // click a note — was buried in the middle of six other rules. The list below says exactly the
    // same things, in the same order, and nothing was dropped; it is simply folded away until
    // asked for.
    hintSheetEditing:
      "Düzenleme açık — bir notaya tıklayın: seçilir, ✕ ile silinir, yukarı/aşağı sürükleyince " +
      "perdesi değişir.",
    // ⚠ Same mode, same toolbox, same document — the sentence only has to say what is different
    // here: you are looking at one bar, and the change is not local to this page.
    hintMeasureEditing:
      "Düzenleme açık — sağdaki ölçüde bir notaya tıklayın: seçilir, ✕ ile silinir, " +
      "yukarı/aşağı sürükleyince perdesi değişir. Oklarla başka bir ölçüye geçebilirsiniz. " +
      "Yaptığınız her değişiklik Nota sayfasında da görünür; geri alma listesi ortaktır.",
    hintSheetEditingMore: "Alet çantasıyla neler yapılır?",
    hintSheetEditingSteps: [
      "Alet çantasından bir süre ya da değiştirme işareti seçip notaya tıklarsanız o nota değişir.",
      "Bir süre seçiliyken boşluğa tıklarsanız oraya yeni nota eklenir — perdesini tıkladığınız " +
        "yükseklik belirler.",
      "Üçleme aracıyla bir notaya, sonra iki sonrakine tıklayın: üçü üçleme olur.",
      "Ölçü usulden uzun ya da kısa kalırsa sağ üst köşesinde bir işaret belirir.",
      "Tekrar ve yön işaretlerini (‖: :‖ 1./2. 𝄋 ⊕ D.C. Son) alet çantasından seçip bir ölçüye " +
        "tıklayarak koyabilirsiniz; kaldırmak için Seçim'e geçip işaretin üstüne tıklayın.",
      "Alet çantasını başlığından tutup istediğiniz yere sürükleyebilir, sağ üstteki düğmeyle " +
        "küçültüp büyütebilirsiniz.",
    ],
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

  /**
   * The single-measure card beside the instrument (owner, 2026-09-04): the bar that is sounding
   * right now, engraved on its own, with its own transport.
   *
   * ⚠ "Ölçüyü çal" says what it does and not more: it plays THAT bar and stops at its barline. The
   * label is deliberately not "Buradan çal" — the sheet's click-to-seek already means that, and the
   * two would be confusable side by side.
   */
  measure: {
    title: (n: number, total: number) => `Ölçü ${n} / ${total}`,
    play: "Ölçüyü çal",
    playTitle: "Sadece bu ölçüyü çalar, sonunda durur. Çalan bir şey varsa durdurulur.",
    edit: "Ölçüyü düzenle",
    editing: "Düzenleniyor",
    editTitle: "Düzenleme kipini burada açar — alet kutusu çıkar, notaya dokunmadan bu ölçüyü düzenlersiniz",
    prev: "Önceki ölçü",
    next: "Sonraki ölçü",
    follow: "Çalınanı izle",
    followTitle: "Açıkken gösterilen ölçü, çalınan ölçüyle birlikte ilerler",
    empty: "Bu eserde gösterilecek ölçü yok.",
    hint:
      "Sağda, o an çalınan ölçünün notası tek başına yazılıdır. Oklarla bir önceki ve bir " +
      "sonraki ölçüye geçebilirsiniz; ok kullandığınızda ölçü olduğu yerde sabitlenir, " +
      "«Çalınanı izle» ile yeniden çalınan ölçüyü takip eder. «Ölçüyü çal» sadece o ölçüyü " +
      "çalar ve ölçü bitince durur. «Ölçüyü düzenle» alet kutusunu açar: ölçüyü buradan " +
      "düzenlersiniz, yaptığınız değişiklik doğrudan Nota sayfasında da görünür — tek bir " +
      "nota, tek bir geri alma listesi.",
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
      "çünkü onlar enstrümanın arkasındadır. Üstteki çubuk dudağı ne kadar sıkacağınızı " +
      "gösterir: normal çalarken dudak orta derecede sıkılır, çubuğun tam ortası odur. Koma " +
      "sesler dudağı oradan gevşeterek verilir; çubuk kısaldıkça dudak gevşer, ortanın " +
      "solundaki her çizgi bir komadır, en fazla beş koma. Ortanın sağı daha sıkı yönüdür ve " +
      "hiç dolmaz — hiçbir koma dudağı normalden fazla sıkarak verilmez. Çubuk tam ortadaysa " +
      "nota parmağın kendi sesidir. Klarnetin sesinin dışındaki notalarda hiçbir şey yanmaz.",
    clarinetBack: "arka",
    hintClarinetAlt: "Sol klarnet fotoğrafı — o notada basılan delikler ve tuşlar",
    // The lip meter's caption and its three positions. ⚠ They name a GRIP, not an action: the meter
    // says how tightly the lip is held, and "normal" is a PLACE on it — the middle — not a word for
    // "no bend" (owner, 2026-09-04). Never write these as "salma" / "gevşetme miktarı" again; that
    // is the reading the owner replaced, and Clarinet.tsx says why.
    lipTitle: "Dudak sıkılığı",
    lipLoose: "gevşek",
    lipNormal: "normal",
    lipTight: "sıkı",
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
    // ⚠ Says the wait is EXPECTED, not that something is wrong: a cold container took 38 s to load
    // its graphs on 2026-09-04, and a silent pause that long reads as a hang. ⚠ No ticking clock —
    // `page-smoke` counts DISTINCT status texts to prove progress moved, so a countdown would forge
    // that signal (ui/status.ts).
    wakingServer: "sunucu uyanıyor — ilk okuma yarım dakika kadar uzun sürebilir…",
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
    // The refused local decode (owner, 2026-09-04). Says what is true — the reading happens on the
    // server, and that server is not answering right now — without asking the visitor to do
    // anything but wait. ⚠ It must not read as "the app is broken": nothing is.
    serverUnavailable: "Okuma sunucusuna şu anda ulaşılamıyor. Lütfen birazdan tekrar deneyin.",
    serverUnavailableTips: [
      "Sunucu uykudaysa uyanması yarım dakika sürebilir.",
      "Notalar her zaman sunucuda okunur, sizin cihazınızda değil.",
    ],
    badSchema: (v: unknown) => `Desteklenmeyen dosya sürümü (schemaVersion ${v}).`,
    couldNotLoad: (f: string) => `${f} yüklenemedi.`,
  },

  // The line beside the makam picker — see apps/web/src/ui/MakamIntonation.tsx. It names the
  // WRITTEN perde and says where the note is really played, then how many notes of this score that
  // reaches. ⚠ **ONE sentence when nothing bends** (owner, 2026-09-05, cutting a first version that
  // split "the sources report no deviation" from "this makam is not in our table"): the reader is
  // choosing a makam, and the only thing that answers their question is whether the piece will
  // sound as it looks. Where that certainty comes from is a note for the table, not for the bar.
  makamHint: {
    lead: "farklı çalınan perdeler:",
    // Turkish for "lower" / "higher" in pitch. The number is already written with a comma.
    down: (koma: string) => `${koma} koma pes`,
    up: (koma: string) => `${koma} koma tiz`,
    count: (n: number) => `bu eserde ${n} nota`,
    countNone: "bu eserde yok",
    why: "neden?",
    perdeTitle: (accidental: string) => `yazılışı: ${accidental}`,
    asWritten: "Bu makam yazıldığı gibi çalınıyor.",
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
    asWritten: "Notalar sayfada yazıldığı gibi seslendirilecek.",
    playAsWritten: "Yazıldığı gibi çal",
    useThis: "Bunu kullan",
  },

} as const;

/** Turkish decimal comma, for the numbers shown in the status line. */
export function num(n: number, digits = 1): string {
  return n.toFixed(digits).replace(".", ",");
}
