import React, { useEffect, useState } from 'react';
import { ActionSheetIOS, Alert, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCar } from '../context/CarContext';
import { ParkCastNative, type ParkedCar } from '../native/ParkCastNative';
import { METER_OPTIONS_MINUTES } from '../config/nearby';
import { loadJson, saveJson } from '../lib/storage';
import { Button, Card, ListRow } from '../ui/components';
import { colors, radius, space, text } from '../ui/theme';

const METER_KEY = 'parkcast.meter.v1';

function timeAgo(timestamp: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - timestamp) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h ${minutes % 60} min ago` : `${Math.floor(hours / 24)} d ago`;
}

function remaining(endsAt: number, now: number): string {
  const minutes = Math.ceil((endsAt - now) / 60000);
  if (minutes <= 0) return 'Meter expired';
  return minutes < 60 ? `${minutes} min left on meter` : `${Math.floor(minutes / 60)} h ${minutes % 60} min left on meter`;
}

const reminderLead = (minutes: number) => (minutes <= 15 ? 5 : 10);

export const ParkedCarCard: React.FC = () => {
  const { nativeAvailable, carConnected, requestLocation, locationStatus } = useCar();
  const [parked, setParked] = useState<ParkedCar | null>(() => ParkCastNative.getParkedCar());
  const [meterEndsAt, setMeterEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    loadJson<{ endsAt: number | null }>(METER_KEY, { endsAt: null }).then(({ endsAt }) => setMeterEndsAt(endsAt));
    const subscription = ParkCastNative.on<Partial<ParkedCar> & { cleared?: boolean }>('onParkedCar', (event) => {
      if (event.cleared) {
        setParked(null);
      } else if (event.latitude != null && event.longitude != null) {
        setParked(event as ParkedCar);
      }
    });
    const timer = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, []);

  const setMeter = (endsAt: number | null) => {
    setMeterEndsAt(endsAt);
    saveJson(METER_KEY, { endsAt });
  };

  if (!nativeAvailable || carConnected) return null;

  const saveHere = async () => {
    if (locationStatus !== 'granted' && !(await requestLocation())) return;
    const saved = await ParkCastNative.saveParkedCarHere();
    if (!saved) Alert.alert('Location not ready', 'Wait a moment for your iPhone to find your location, then try again.');
  };

  if (!parked) {
    return (
      <Card padded={false}>
        <ListRow
          icon="car-outline"
          title="Save where I parked"
          subtitle="ParkCast also saves it automatically when CarPlay disconnects"
          onPress={saveHere}
          last
        />
      </Card>
    );
  }

  const walkBack = () =>
    Linking.openURL(`http://maps.apple.com/?daddr=${parked.latitude},${parked.longitude}&dirflg=w`).catch(() => {});

  const startMeter = async (minutes: number) => {
    const lead = reminderLead(minutes);
    const scheduled = await ParkCastNative.scheduleReminder(
      (minutes - lead) * 60,
      'Parking meter',
      `Your meter runs out in ${lead} minutes.`
    );
    if (!scheduled) {
      Alert.alert('Notifications are off', 'Allow notifications for ParkCast in iPhone Settings to get meter reminders.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    setMeter(Date.now() + minutes * 60 * 1000);
  };

  const chooseMeter = () => {
    const labels = METER_OPTIONS_MINUTES.map((minutes) => (minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hour${minutes > 60 ? 's' : ''}`));
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'Remind me before the meter runs out', options: [...labels, 'Cancel'], cancelButtonIndex: labels.length },
        (index) => {
          if (index < labels.length) startMeter(METER_OPTIONS_MINUTES[index]);
        }
      );
    }
  };

  const stopMeter = () => {
    ParkCastNative.cancelReminder();
    setMeter(null);
  };

  const clear = () => {
    stopMeter();
    ParkCastNative.clearParkedCar();
  };

  const meterActive = meterEndsAt != null && meterEndsAt > now - 60 * 60 * 1000;

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Ionicons name="car" size={22} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={text.heading}>Your car</Text>
          <Text style={text.secondary} numberOfLines={2}>
            {parked.address || 'Parked spot saved'} · {timeAgo(parked.timestamp, now)}
          </Text>
          {meterActive ? (
            <Text style={[styles.meter, meterEndsAt! <= now && { color: colors.danger }]}>{remaining(meterEndsAt!, now)}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.actions}>
        <Button title="Walk there" icon="walk" onPress={walkBack} style={{ flex: 1 }} />
        <Button
          title={meterActive ? 'Stop meter' : 'Meter'}
          icon="timer-outline"
          variant="secondary"
          onPress={meterActive ? stopMeter : chooseMeter}
          style={{ flex: 1 }}
        />
        <Button title="Clear" variant="ghost" onPress={clear} />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: space(3), alignItems: 'center' },
  icon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  meter: { marginTop: 4, fontWeight: '700', color: colors.warning },
  actions: { flexDirection: 'row', gap: space(2), marginTop: space(4) },
});
