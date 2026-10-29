import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { groupMeasures } from '@turkish-omr/core';
import { readPage, ReadError, warmServer, type PageRead } from './src/readPage';

/**
 * Where the decode server is. `EXPO_PUBLIC_DECODE_URL` is baked in when Metro bundles; set it in
 * `apps/mobile/.env` (see docs/COMMANDS.md). ⚠ It must be a server that has `POST /page` — the
 * live revision does not yet, so this points at the tagged TEST revision until that ships.
 */
const DECODE_URL = (process.env.EXPO_PUBLIC_DECODE_URL ?? '').replace(/\/$/, '');

// M1: photo → server → notes on screen. No staff drawing yet (that is M2).
export default function App() {
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
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
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

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>KomaVision</Text>
        {!DECODE_URL && <Text style={styles.error}>Sunucu adresi ayarlanmamış (EXPO_PUBLIC_DECODE_URL).</Text>}

        <View style={styles.row}>
          <Pressable style={[styles.button, busy && styles.disabled]} disabled={busy || !DECODE_URL} onPress={() => void pick('library')}>
            <Text style={styles.buttonText}>Galeriden seç</Text>
          </Pressable>
          <Pressable style={[styles.button, busy && styles.disabled]} disabled={busy || !DECODE_URL} onPress={() => void pick('camera')}>
            <Text style={styles.buttonText}>Fotoğraf çek</Text>
          </Pressable>
        </View>

        {busy && <Text style={styles.status}>Sayfa okunuyor… {Math.round((now - busySince!) / 1000)} sn</Text>}
        {error && <Text style={styles.error}>{error}</Text>}

        {result && (
          <>
            <Text style={styles.status}>
              {result.staves} porte → {result.strips} şerit → {result.notes} nota, {result.measures} ölçü ·{' '}
              {Math.round(result.totalMs / 1000)} sn
            </Text>
            {measures.map((m, i) => (
              <Text key={i} style={styles.measure}>
                <Text style={styles.bar}>{i + 1}. </Text>
                {m.events
                  .filter((e) => e.kind === 'note' || e.kind === 'rest')
                  .map((e) => (e.kind === 'rest' ? 'Es' : e.noteName))
                  .join('  ')}
              </Text>
            ))}
          </>
        )}
      </ScrollView>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f6f1e4' },
  content: { padding: 20, paddingTop: 48, gap: 12 },
  title: { fontSize: 28, color: '#1b1f2e', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, backgroundColor: '#1f3a8a', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16 },
  status: { fontSize: 15, color: '#1b1f2e' },
  error: { fontSize: 15, color: '#b3261e' },
  measure: { fontSize: 15, color: '#1b1f2e', lineHeight: 22 },
  bar: { color: '#7a6a3a' },
});
