import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCar } from '../context/CarContext';
import { useLibrary, type LibraryItem, type PlaylistSource } from '../context/LibraryContext';
import { useMediaPicker } from '../hooks/useMediaPicker';
import { Button, Card, EmptyState, ListRow, ScreenTitle, Section, type IconName } from '../ui/components';
import { colors, radius, space, text } from '../ui/theme';

const KIND_ICON: Record<LibraryItem['kind'], IconName> = {
  video: 'film-outline',
  photo: 'image-outline',
  slideshow: 'images-outline',
  web: 'globe-outline',
};

const CHANNEL_PAGE = 60;

export const LibraryScreen: React.FC<{ onOpenBrowser: (url?: string) => void }> = ({ onOpenBrowser }) => {
  const { recents, sources, removeRecent, clearRecents, addSource, refreshSource, removeSource } = useLibrary();
  const { play } = useCar();
  const { pickAndPlay, pickMemories } = useMediaPicker();

  const [openSource, setOpenSource] = useState<PlaylistSource | null>(null);
  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const visibleChannels = useMemo(() => {
    if (!openSource) return [];
    const needle = filter.trim().toLowerCase();
    const list = needle
      ? openSource.channels.filter(
          (channel) => channel.name.toLowerCase().includes(needle) || channel.group.toLowerCase().includes(needle)
        )
      : openSource.channels;
    return list.slice(0, CHANNEL_PAGE);
  }, [openSource, filter]);

  const playRecent = (item: LibraryItem) => {
    if (item.kind === 'web') {
      onOpenBrowser(item.uri);
      return;
    }
    play(item);
  };

  const saveSource = async () => {
    setSaving(true);
    try {
      const source = await addSource(newName, newUrl);
      setAdding(false);
      setNewName('');
      setNewUrl('');
      setOpenSource(source);
    } catch (error: any) {
      Alert.alert("Couldn't add this playlist", error?.message ?? 'Check the link and try again.');
    } finally {
      setSaving(false);
    }
  };

  const sourceActions = (source: PlaylistSource) =>
    Alert.alert(source.name, `${source.channels.length} channels`, [
      {
        text: 'Refresh',
        onPress: () => refreshSource(source.id).catch((error) => Alert.alert('Refresh failed', error?.message ?? '')),
      },
      { text: 'Remove', style: 'destructive', onPress: () => removeSource(source.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenTitle title="Library" subtitle="Everything you can show on the car" />

      <View style={styles.pickRow}>
        <Button title="Photo or video" icon="add-circle" onPress={() => pickAndPlay().catch(() => {})} style={{ flex: 1 }} />
        <Button
          title="Memories"
          icon="sparkles"
          variant="secondary"
          onPress={() => pickMemories().catch(() => {})}
          style={{ flex: 1 }}
        />
      </View>

      <Section title="Recent">
        {recents.length ? (
          <>
            {recents.map((item) => (
              <ListRow
                key={item.id}
                icon={KIND_ICON[item.kind]}
                title={item.title}
                subtitle={item.subtitle}
                onPress={() => playRecent(item)}
                right={
                  <Pressable hitSlop={10} onPress={() => removeRecent(item.id)} accessibilityLabel="Remove">
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                }
              />
            ))}
            <ListRow icon="trash-outline" title="Clear recent" destructive onPress={clearRecents} last />
          </>
        ) : (
          <EmptyState
            icon="images-outline"
            title="Nothing here yet"
            message="Pick a photo or video and it appears on your car screen right away."
          />
        )}
      </Section>

      <Section
        title="TV and playlists"
        footer="Add your own M3U / IPTV playlist link. ParkCast does not include or sell any channels."
      >
        {sources.map((source) => (
          <ListRow
            key={source.id}
            icon="tv-outline"
            title={source.name}
            subtitle={`${source.channels.length} channels`}
            onPress={() => {
              setFilter('');
              setOpenSource(source);
            }}
            right={
              <Pressable hitSlop={10} onPress={() => sourceActions(source)} accessibilityLabel="Playlist options">
                <Text style={styles.remove}>Edit</Text>
              </Pressable>
            }
          />
        ))}
        <ListRow icon="add" title="Add a playlist" onPress={() => setAdding(true)} last chevron />
      </Section>

      <Modal visible={adding} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAdding(false)}>
        <View style={styles.sheet}>
          <ScreenTitle title="Add a playlist" subtitle="Paste the M3U link from your TV provider" />
          <TextInput
            style={styles.input}
            placeholder="Name (optional)"
            placeholderTextColor={colors.textMuted}
            value={newName}
            onChangeText={setNewName}
          />
          <TextInput
            style={styles.input}
            placeholder="https://…/playlist.m3u"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={newUrl}
            onChangeText={setNewUrl}
          />
          <Button title="Add playlist" onPress={saveSource} loading={saving} disabled={!/^https?:\/\//i.test(newUrl.trim())} />
          <Button title="Cancel" variant="ghost" onPress={() => setAdding(false)} />
        </View>
      </Modal>

      <Modal
        visible={openSource !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpenSource(null)}
      >
        <View style={styles.sheet}>
          <ScreenTitle
            title={openSource?.name ?? ''}
            subtitle={`${openSource?.channels.length ?? 0} channels`}
            right={<Button title="Done" variant="secondary" onPress={() => setOpenSource(null)} />}
          />
          <TextInput
            style={styles.input}
            placeholder="Find a channel"
            placeholderTextColor={colors.textMuted}
            value={filter}
            onChangeText={setFilter}
          />
          <ScrollView>
            <Card padded={false}>
              {visibleChannels.map((channel, index) => (
                <ListRow
                  key={channel.id}
                  icon="radio-outline"
                  title={channel.name}
                  subtitle={channel.group}
                  last={index === visibleChannels.length - 1}
                  onPress={() => {
                    if (play({ kind: 'video', uri: channel.url, title: channel.name, subtitle: channel.group })) {
                      setOpenSource(null);
                    }
                  }}
                />
              ))}
            </Card>
            {openSource && openSource.channels.length > CHANNEL_PAGE && !filter ? (
              <Text style={[text.caption, { textAlign: 'center', marginTop: space(3) }]}>
                Showing {CHANNEL_PAGE} of {openSource.channels.length}. Search to find more.
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(5), paddingBottom: space(10) },
  pickRow: { flexDirection: 'row', gap: space(3), marginBottom: space(6) },
  remove: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  sheet: { flex: 1, padding: space(5), gap: space(3), backgroundColor: colors.bg },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
    fontSize: 16,
    color: colors.text,
  },
});
