import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { BRAND } from '../config/brand';
import { useCastSession } from '../context/CastSessionContext';

interface VoiceCommandModalProps {
  visible: boolean;
  onClose: () => void;
  onSwitchPhoneTab: (tab: 'drive_map' | 'parked_lounge' | 'remote') => void;
}

const VOICE_PRESETS = [
  {
    category: '🧭 Navigation & Units',
    commands: [
      { label: 'Navigate to Airport', phrase: 'Navigate to International Airport' },
      { label: 'Find Nearby Parking', phrase: 'Find nearby parking' },
      { label: 'Find EV Supercharger', phrase: 'Find EV Supercharger' },
      { label: 'Switch to Waze', phrase: 'Use Waze' },
      { label: 'Switch to Google Maps', phrase: 'Use Google Maps' },
      { label: 'Switch to KM/H', phrase: 'Switch to kilometers' },
      { label: 'Switch to MPH', phrase: 'Switch to miles' },
    ],
  },
  {
    category: '🍿 Parked Lounge & Media',
    commands: [
      { label: 'Open Parked Lounge', phrase: 'Navigate to Parked Lounge' },
      { label: 'Play YouTube Scenic Drive', phrase: 'Play YouTube Swiss Alps Scenic Drive' },
      { label: 'Shuffle Live TV Channels', phrase: 'Shuffle Live TV' },
      { label: 'Mirror My iPhone Screen', phrase: 'Mirror my screen' },
      { label: 'Turn On Split-View', phrase: 'Turn on Split View' },
      { label: 'Close Split-View', phrase: 'Close Split View' },
    ],
  },
  {
    category: '🕹️ Playback & Volume',
    commands: [
      { label: 'Pause Playback', phrase: 'Pause' },
      { label: 'Resume Playback', phrase: 'Play' },
      { label: 'Volume Louder (+15%)', phrase: 'Volume up' },
      { label: 'Volume Quieter (-15%)', phrase: 'Volume down' },
      { label: 'Full Screen Aspect', phrase: 'Full screen' },
      { label: 'Widescreen Cinema', phrase: 'Widescreen' },
    ],
  },
];

export const VoiceCommandModal: React.FC<VoiceCommandModalProps> = ({
  visible,
  onClose,
  onSwitchPhoneTab,
}) => {
  const {
    voiceListening,
    lastVoiceTranscript,
    lastVoiceReply,
    setVoiceListening,
    executeVoiceCommand,
  } = useCastSession();

  const [spokenInput, setSpokenInput] = useState('');

  const runVoicePhrase = (phrase: string) => {
    const lower = phrase.toLowerCase();
    executeVoiceCommand(phrase);
    if (lower.includes('lounge') || lower.includes('youtube') || lower.includes('live tv') || lower.includes('shuffle')) {
      onSwitchPhoneTab('parked_lounge');
    } else if (lower.includes('navigate') || lower.includes('parking') || lower.includes('charger') || lower.includes('waze') || lower.includes('map')) {
      onSwitchPhoneTab('drive_map');
    }
  };

  const startBrowserMicIfSupported = () => {
    setVoiceListening(true);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRec =
        (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any })
          .SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;

      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          rec.lang = 'en-US';
          rec.interimResults = false;
          rec.onresult = (event: any) => {
            const transcript = event?.results?.[0]?.[0]?.transcript || '';
            if (transcript) {
              setSpokenInput(transcript);
              runVoicePhrase(transcript);
            }
          };
          rec.onerror = () => setVoiceListening(false);
          rec.onend = () => setVoiceListening(false);
          rec.start();
          return;
        } catch {
          // Fall back to manual or 1-tap voice command
        }
      }
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.topRow}>
            <View style={styles.titleRow}>
              <View
                style={[
                  styles.micCircle,
                  voiceListening && { backgroundColor: '#EF4444' },
                ]}
              >
                <Text style={styles.micIcon}>🎤</Text>
              </View>
              <View>
                <Text style={styles.title}>ParkCast Voice Control</Text>
                <Text style={styles.sub}>
                  Hands-Free CarPlay Voice Assistant (CPVoiceControlTemplate)
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Live Voice Feedback Banner */}
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>
              {voiceListening ? '● LISTENING NOW — SPEAK ANY COMMAND...' : 'VOICE ASSISTANT READY'}
            </Text>
            {lastVoiceTranscript ? (
              <Text style={styles.transcriptText}>
                You said: "{lastVoiceTranscript}"
              </Text>
            ) : null}
            <Text style={styles.replyText}>{lastVoiceReply}</Text>
          </View>

          {/* Speak / Type Voice Command Bar */}
          <View style={styles.inputRow}>
            <TouchableOpacity
              testID="voice-start-mic-btn"
              style={[
                styles.listenBtn,
                voiceListening && { backgroundColor: '#EF4444' },
              ]}
              onPress={startBrowserMicIfSupported}
            >
              <Text style={styles.listenBtnText}>
                {voiceListening ? 'Listening...' : '🎤 Tap & Speak'}
              </Text>
            </TouchableOpacity>

            <TextInput
              testID="voice-custom-input"
              style={styles.textInput}
              placeholder='Or type command (e.g. "Navigate to Airport")'
              placeholderTextColor="#94A3B8"
              value={spokenInput}
              onChangeText={setSpokenInput}
            />

            <TouchableOpacity
              testID="voice-run-btn"
              style={styles.sendBtn}
              onPress={() => {
                if (spokenInput.trim()) {
                  runVoicePhrase(spokenInput);
                  setSpokenInput('');
                }
              }}
            >
              <Text style={styles.sendBtnText}>Run</Text>
            </TouchableOpacity>
          </View>

          {/* 1-Tap Instant Voice Commands */}
          <ScrollView style={styles.scrollArea}>
            {VOICE_PRESETS.map((group) => (
              <View key={group.category} style={styles.groupBlock}>
                <Text style={styles.groupTitle}>{group.category}</Text>
                <View style={styles.chipWrap}>
                  {group.commands.map((cmd) => (
                    <TouchableOpacity
                      key={cmd.label}
                      style={styles.cmdChip}
                      onPress={() => runVoicePhrase(cmd.phrase)}
                    >
                      <Text style={styles.cmdChipText}>"{cmd.label}"</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    maxHeight: '86%',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  micCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BRAND.colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIcon: {
    fontSize: 20,
  },
  title: {
    color: BRAND.colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  sub: {
    color: BRAND.colors.textSecondary,
    fontSize: 11,
  },
  closeBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  closeBtnText: {
    color: BRAND.colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  statusBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 12,
  },
  statusLabel: {
    color: '#2563EB',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  transcriptText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  replyText: {
    color: '#1E3A8A',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  listenBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 10,
  },
  listenBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    color: BRAND.colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  sendBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 10,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  scrollArea: {
    maxHeight: 340,
  },
  groupBlock: {
    marginBottom: 14,
  },
  groupTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cmdChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  cmdChipText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
});
