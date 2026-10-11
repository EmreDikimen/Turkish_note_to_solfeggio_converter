import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { DEFAULT_REF_KOMA, koma53ToFreq } from '@turkish-omr/core';

// M0: proves the shared core imports and runs on the phone. One koma above the reference pitch.
const komaUp = DEFAULT_REF_KOMA + 1;

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>KomaVision</Text>
      <Text>
        koma {komaUp} = {koma53ToFreq(komaUp).toFixed(2)} Hz
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    marginBottom: 12,
  },
});
