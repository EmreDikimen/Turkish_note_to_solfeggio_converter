import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useFonts } from 'expo-font';
import { EBGaramond_500Medium, EBGaramond_500Medium_Italic } from '@expo-google-fonts/eb-garamond';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { groupMeasures } from '@turkish-omr/core';
import { readPage, ReadError, warmServer, type PageRead } from './src/readPage';
import { fonts, useTheme, type Theme } from './src/theme';

/**
 * Where the decode server is. `EXPO_PUBLIC_DECODE_URL` is baked in when Metro bundles; set it in
 * `apps/mobile/.env.local` (see docs/COMMANDS.md). ⚠ It must be a server that has `POST /page` — the
 * live revision does not yet, so this points at the tagged TEST revision until that ships.
 */
const DECODE_URL = (process.env.EXPO_PUBLIC_DECODE_URL ?? '').replace(/\/$/, '');

// M1: photo → server → notes on screen, in the web app's Tezhip look. No staff drawing yet (M2).
export default function App() {
  const [fontsReady] = useFonts({
    EBGaramond_500Medium,
    EBGaramond_500Medium_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const [busySince, setBusySince] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<PageRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reading = useRef(false);

  useEffect(() => {
    if (DECODE_URL) warmServer(DECODE_URL);
  }, []);
  useEffect(() => {
    if (busySince == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [busySince]);

  async function pick(from: 'library' | 'camera') {
    if (reading.current) return;
    setError(null);
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.9 };
    if (from === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setError('Kamera izni verilmedi.');
    }
    const picked = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset?.base64) return;

    reading.current = true;
    setResult(null);
    setBusySince(Date.now());
    setNow(Date.now());
    try {
      const name = (asset.fileName ?? 'sayfa').replace(/\.[^.]+$/, '');
      setResult(await readPage(DECODE_URL, asset.base64, name));
    } catch (e) {
      setError(e instanceof ReadError ? e.message : 'Beklenmeyen bir hata oldu.');
    } finally {
      reading.current = false;
      setBusySince(null);
    }
  }

  const measures = useMemo(() => (result ? groupMeasures(result.doc) : []), [result]);
  const busy = busySince != null;
  const off = busy || !DECODE_URL;

  // Hold the first paint until the fonts are in, so the page never flashes the system font.
  if (!fontsReady) return <View style={s.screen} />;

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.header}>
          <Text style={s.title}>MakamVision</Text>
          <Text style={s.subtitle}>Türk müziği notalarını fotoğraftan okur</Text>
          <View style={s.ornament}>
            <View style={s.ornamentLine} />
            <Text style={s.ornamentMark}>◆</Text>
            <View style={s.ornamentLine} />
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Sayfa oku</Text>
          <Text style={s.cardText}>Bir nota sayfasının fotoğrafını seçin veya çekin.</Text>
          {!DECODE_URL && <Text style={s.error}>Sunucu adresi ayarlanmamış (EXPO_PUBLIC_DECODE_URL).</Text>}
          <View style={s.row}>
            <Pressable
              style={({ pressed }) => [s.button, s.buttonPrimary, off && s.disabled, pressed && s.pressed]}
              disabled={off}
              onPress={() => void pick('library')}
            >
              <Text style={[s.buttonText, s.buttonTextPrimary]}>Galeriden seç</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.button, s.buttonSecondary, off && s.disabled, pressed && s.pressed]}
              disabled={off}
              onPress={() => void pick('camera')}
            >
              <Text style={[s.buttonText, s.buttonTextSecondary]}>Fotoğraf çek</Text>
            </Pressable>
          </View>
          {busy && (
            <View style={s.statusRow}>
              <ActivityIndicator color={t.accent} />
              <Text style={s.status}>Sayfa okunuyor… {Math.round((now - busySince!) / 1000)} sn</Text>
            </View>
          )}
          {error && <Text style={s.error}>{error}</Text>}
        </View>

        {result && (
          <View style={s.score}>
            <Text style={s.scoreTitle}>{result.doc.title || result.doc.name || 'Okunan sayfa'}</Text>
            <Text style={s.scoreMeta}>
              {result.staves} porte · {result.notes} nota · {result.measures} ölçü · {Math.round(result.totalMs / 1000)} sn
            </Text>
            <View style={s.scoreRule} />
            {measures.map((m, i) => (
              <View key={i} style={s.measure}>
                <Text style={s.bar}>{i + 1}</Text>
                <Text style={s.notes}>
                  {m.events
                    .filter((e) => e.kind === 'note' || e.kind === 'rest')
                    .map((e) => (e.kind === 'rest' ? 'Es' : e.noteName))
                    .join('  ')}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.paper },
    content: { padding: 16, paddingTop: 56, paddingBottom: 48, gap: 16 },
    header: { alignItems: 'center', gap: 4, marginBottom: 4 },
    title: { fontFamily: fonts.display, fontSize: 38, color: t.ink, letterSpacing: 0.5 },
    subtitle: { fontFamily: fonts.displayItalic, fontSize: 17, color: t.inkSoft },
    ornament: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, width: '60%' },
    ornamentLine: { flex: 1, height: 1, backgroundColor: t.gold, opacity: 0.6 },
    ornamentMark: { color: t.gold, fontSize: 10 },
    card: {
      backgroundColor: t.paperRaised,
      borderColor: t.rule,
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      gap: 10,
    },
    cardTitle: { fontFamily: fonts.display, fontSize: 22, color: t.ink },
    cardText: { fontFamily: fonts.ui, fontSize: 15, color: t.inkSoft, lineHeight: 22 },
    row: { flexDirection: 'row', gap: 10, marginTop: 4 },
    button: { flex: 1, minHeight: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
    buttonPrimary: { backgroundColor: t.accent },
    buttonSecondary: { borderWidth: 1, borderColor: t.accent, backgroundColor: 'transparent' },
    buttonText: { fontFamily: fonts.uiSemiBold, fontSize: 15 },
    buttonTextPrimary: { color: t.accentOn },
    buttonTextSecondary: { color: t.accent },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.8 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    status: { fontFamily: fonts.ui, fontSize: 15, color: t.inkSoft },
    error: { fontFamily: fonts.uiMedium, fontSize: 15, color: t.danger },
    // The score's paper: light in both themes, as on the web.
    score: { backgroundColor: t.scorePaper, borderRadius: 12, padding: 16, gap: 6 },
    scoreTitle: { fontFamily: fonts.displayItalic, fontSize: 22, color: t.scoreInk, textAlign: 'center' },
    scoreMeta: { fontFamily: fonts.ui, fontSize: 13, color: t.scoreInkFaint, textAlign: 'center' },
    scoreRule: { height: 1, backgroundColor: '#c9c0ab', marginVertical: 8 },
    measure: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
    bar: { fontFamily: fonts.uiMedium, fontSize: 12, color: '#8c6a2a', width: 22, textAlign: 'right', paddingTop: 3 },
    notes: { flex: 1, fontFamily: fonts.display, fontSize: 17, color: t.scoreInk, lineHeight: 24 },
  });
}
