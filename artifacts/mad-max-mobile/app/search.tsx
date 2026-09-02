import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSearchMovies } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

const poster = (path?: string | null) => path ? `https://image.tmdb.org/t/p/w185${path}` : undefined;

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [term, setTerm] = useState('');
  const query = useSearchMovies({ q: term.trim() }, { query: { queryKey: ['filmio-search', term.trim()], enabled: term.trim().length > 1 } });
  const results = query.data?.results || [];
  return <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + 18 }]}>
    <View style={styles.top}><Pressable onPress={() => router.back()} accessibilityLabel="Go back"><Feather name="arrow-left" size={23} color={colors.foreground} /></Pressable><Text style={[styles.title, { color: colors.foreground }]}>Search films</Text><View style={{ width: 23 }} /></View>
    <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}><Feather name="search" size={18} color={colors.mutedForeground} /><TextInput autoFocus value={term} onChangeText={setTerm} placeholder="Try a title, like Dune" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }]} returnKeyType="search" /></View>
    {term.trim().length < 2 ? <View style={styles.center}><Feather name="film" size={30} color={colors.mutedForeground} /><Text style={[styles.hint, { color: colors.mutedForeground }]}>Search the FILMIO catalog</Text></View> :
      query.isLoading ? <ActivityIndicator color={colors.primary} style={styles.center} /> :
      query.error ? <Text style={[styles.message, { color: colors.mutedForeground }]}>Search is unavailable right now. Please try again.</Text> :
      <FlatList data={results} keyExtractor={item => String(item.id)} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={[styles.message, { color: colors.mutedForeground }]}>No films matched “{term}”.</Text>} renderItem={({ item }) => <Pressable style={styles.result} onPress={() => router.push(`/movie/${item.id}`)}>{item.posterPath ? <Image source={{ uri: poster(item.posterPath) }} style={styles.resultPoster} /> : <View style={[styles.resultPoster, styles.posterEmpty]}><Feather name="film" size={20} color={colors.mutedForeground} /></View>}<View style={styles.resultCopy}><Text style={[styles.resultTitle, { color: colors.foreground }]}>{item.title}</Text><Text style={[styles.resultMeta, { color: colors.mutedForeground }]}>{item.releaseDate?.slice(0, 4) || 'Release date unknown'}  ·  ★ {item.voteAverage?.toFixed?.(1) || '—'}</Text><Text style={[styles.overview, { color: colors.mutedForeground }]} numberOfLines={2}>{item.overview}</Text></View><Feather name="chevron-right" size={18} color={colors.mutedForeground} /></Pressable>} />}
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 58 }, top: { paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }, title: { fontSize: 19, fontWeight: '700' }, inputWrap: { marginHorizontal: 20, borderRadius: 12, borderWidth: 1, height: 52, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 }, input: { flex: 1, fontSize: 15 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }, hint: { fontSize: 15 }, message: { textAlign: 'center', margin: 35, lineHeight: 21 }, list: { padding: 20, gap: 4 }, result: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 13 }, resultPoster: { width: 58, height: 82, borderRadius: 7, backgroundColor: '#201d20' }, posterEmpty: { alignItems: 'center', justifyContent: 'center' }, resultCopy: { flex: 1 }, resultTitle: { fontSize: 16, fontWeight: '600' }, resultMeta: { fontSize: 12, marginTop: 5 }, overview: { fontSize: 12, lineHeight: 17, marginTop: 7 },
});