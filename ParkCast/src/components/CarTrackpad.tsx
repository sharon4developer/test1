import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ParkCastNative } from '../native/ParkCastNative';
import { IconButton, tap } from '../ui/components';
import { colors, radius, space } from '../ui/theme';

const POINTER_SPEED = 1.7;
const SCROLL_SPEED = 2.2;
const TAP_SLOP = 8;
const TAP_MAX_MS = 280;

/** The iPhone becomes a trackpad for the web page on the car screen, like a laptop touchpad. */
export const CarTrackpad: React.FC<{ moving: boolean }> = ({ moving }) => {
  const [typed, setTyped] = useState('');
  const [active, setActive] = useState(false);
  const last = useRef({ dx: 0, dy: 0, fingers: 1, startedAt: 0, travelled: 0 });

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          last.current = { dx: 0, dy: 0, fingers: 1, startedAt: Date.now(), travelled: 0 };
          setActive(true);
        },
        onPanResponderMove: (_, gesture) => {
          const state = last.current;
          const stepX = gesture.dx - state.dx;
          const stepY = gesture.dy - state.dy;
          state.dx = gesture.dx;
          state.dy = gesture.dy;
          state.fingers = Math.max(state.fingers, gesture.numberActiveTouches);
          state.travelled += Math.abs(stepX) + Math.abs(stepY);
          if (!stepX && !stepY) return;
          if (gesture.numberActiveTouches >= 2) {
            ParkCastNative.carWebPointer('scroll', -stepX * SCROLL_SPEED, -stepY * SCROLL_SPEED);
          } else {
            ParkCastNative.carWebPointer('move', stepX * POINTER_SPEED, stepY * POINTER_SPEED);
          }
        },
        onPanResponderRelease: () => {
          const state = last.current;
          setActive(false);
          if (state.fingers === 1 && state.travelled < TAP_SLOP && Date.now() - state.startedAt < TAP_MAX_MS) {
            tap();
            ParkCastNative.carWebPointer('click');
          }
        },
        onPanResponderTerminate: () => setActive(false),
      }),
    []
  );

  return (
    <View style={styles.root}>
      <View style={[styles.pad, active && styles.padActive]} {...pan.panHandlers} testID="car-trackpad">
        <Ionicons name="hand-left-outline" size={30} color="#7C8698" />
        <Text style={styles.padTitle}>{moving ? 'Paused while driving' : 'Car trackpad'}</Text>
        <Text style={styles.padHint}>One finger moves the pointer · tap to click · two fingers scroll</Text>
      </View>

      <View style={styles.keyboardRow}>
        <View style={styles.inputBox}>
          <Ionicons name="keypad-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.input}
            value={typed}
            onChangeText={(value) => {
              setTyped(value);
              ParkCastNative.carWebType(value);
            }}
            onSubmitEditing={() => {
              ParkCastNative.carWebType(typed, true);
              setTyped('');
            }}
            placeholder="Type on the car screen"
            placeholderTextColor={colors.textMuted}
            returnKeyType="go"
            autoCapitalize="none"
            autoCorrect={false}
            blurOnSubmit
          />
        </View>
        <IconButton icon="chevron-back" label="Back on car" size={40} onPress={() => ParkCastNative.carWebNavigate('back')} />
        <IconButton icon="chevron-forward" label="Forward on car" size={40} onPress={() => ParkCastNative.carWebNavigate('forward')} />
        <IconButton icon="refresh" label="Reload on car" size={40} onPress={() => ParkCastNative.carWebNavigate('reload')} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, padding: space(4), gap: space(3), backgroundColor: colors.bg },
  pad: {
    flex: 1,
    borderRadius: radius.xl,
    backgroundColor: '#E6E9EF',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    padding: space(6),
  },
  padActive: { backgroundColor: '#DCE2EC' },
  padTitle: { fontSize: 18, fontWeight: '800', color: '#4A5366' },
  padHint: { fontSize: 13, color: '#7C8698', textAlign: 'center', fontWeight: '600' },
  keyboardRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space(3),
  },
  input: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: space(2.5) },
});
