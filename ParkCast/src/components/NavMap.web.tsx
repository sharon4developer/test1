import React, { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NavMapHandle, NavMapProps } from './NavMap';
import { colors } from '../ui/theme';

export type { NavMapHandle, NavMapProps } from './NavMap';

export const NavMap = forwardRef<NavMapHandle, NavMapProps>(function NavMap({ destination, places }, ref) {
  useImperativeHandle(ref, () => ({ recenter: () => {} }));
  return (
    <View style={[StyleSheet.absoluteFill, styles.box]}>
      <Text style={styles.text}>
        {destination ? destination.name : places.length ? `${places.length} places` : 'The map shows on the iPhone app.'}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  box: { backgroundColor: '#DDE7F3', alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.textSecondary, fontWeight: '700' },
});
