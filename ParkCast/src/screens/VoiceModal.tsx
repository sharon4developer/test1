import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCar } from '../context/CarContext';
import { Button } from '../ui/components';
import { colors, radius, space, text } from '../ui/theme';

const EXAMPLES = ['"Navigate to the nearest Starbucks"', '"Mirror my phone"', '"Where did I park?"', '"YouTube lofi music"'];

export const VoiceModal: React.FC<{ visible: boolean; onClose: () => void; onResult: (transcript: string) => void }> = ({
  visible,
  onClose,
  onResult,
}) => {
  const { startVoice, stopVoice, voiceListening, voiceTranscript, nativeAvailable } = useCar();
  const [error, setError] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const resultRef = useRef(onResult);
  resultRef.current = onResult;

  const listen = () => {
    setError(null);
    startVoice((transcript) => resultRef.current(transcript)).catch((reason: any) => {
      setError(reason?.message ?? 'Voice input is unavailable.');
    });
  };

  useEffect(() => {
    if (!visible) return;
    if (nativeAvailable) listen();
    else setError('Voice search needs the ParkCast iPhone app.');
    return () => stopVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!voiceListening) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [voiceListening, pulse]);

  const permissionError = error && /permission|denied|allow/i.test(error);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.transcript} numberOfLines={3}>
            {voiceTranscript || (voiceListening ? 'Listening…' : error ? '' : 'Tap the mic and speak')}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={voiceListening ? 'Stop listening' : 'Start listening'}
            onPress={voiceListening ? stopVoice : listen}
            style={styles.micWrap}
          >
            <Animated.View
              style={[
                styles.ring,
                {
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                  transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
                },
              ]}
            />
            <View style={[styles.mic, voiceListening && { backgroundColor: colors.danger }]}>
              <Ionicons name={voiceListening ? 'stop' : 'mic'} size={34} color={colors.white} />
            </View>
          </Pressable>

          {error ? (
            <View style={{ alignItems: 'center', gap: space(3) }}>
              <Text style={[text.secondary, { textAlign: 'center' }]}>{error}</Text>
              {permissionError ? (
                <Button title="Open Settings" variant="secondary" onPress={() => Linking.openSettings()} />
              ) : null}
            </View>
          ) : (
            <View style={styles.examples}>
              <Text style={text.caption}>TRY SAYING</Text>
              {EXAMPLES.map((example) => (
                <Text key={example} style={styles.example}>
                  {example}
                </Text>
              ))}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(14,21,37,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space(6),
    paddingBottom: space(12),
    alignItems: 'center',
    gap: space(6),
  },
  transcript: { fontSize: 24, fontWeight: '700', color: colors.text, textAlign: 'center', minHeight: 64 },
  micWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary },
  mic: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  examples: { alignItems: 'center', gap: space(1.5) },
  example: { fontSize: 15, color: colors.textSecondary, fontWeight: '500' },
});
