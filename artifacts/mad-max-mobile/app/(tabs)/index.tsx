import React from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGetCatalogMovies, useGetTrendingMovies, useAddToWatchlist, type MovieSummary } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

const image = (path?: string | null, size = 'w500') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;

function MovieCard({ movie }: { movie: MovieSummary }) {
  const colors = useColors();
  const router = useRouter();
  const add = useAddToWatchlist();
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/movie/${movie.id}`)}>
      {movie.posterPath ? <Image source={{ uri: image(movie.posterPath) }} style={styles.poster} /> :
        <View style={[styles.poster, styles.posterEmpty]}><Feather name="film" size={28} color={colors.mutedForeground} /></View>}
      <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{movie.title}</Text>
      <View style={styles.meta}><Text style={[styles.year, { color: colors.mutedForeground }]}>{movie.releaseDate?.slice(0, 4) || '—'}</Text>
        <Text style={[styles.score, { color: colors.primary }]}>TMDB {movie.voteAverage?.toFixed?.(1) || '—'}</Text></View>
      <Pressable accessibilityLabel={`Add ${movie.title} to watchlist`} style={styles.save} onPress={() => add.mutate({ data: { movieId: movie.id, movieTitle: movie.title, moviePosterPath: movie.posterPath, movieReleaseDate: movie.releaseDate } })}>
        <Feather name="bookmark" size={15} color={colors.foreground} />
      </Pressable>
    </Pressable>
  );
}

function Row({ title, movies, loading, error }: { title: string; movies?: MovieSummary[]; loading: boolean; error: boolean }) {
  const colors = useColors();
  return <View style={styles.section}>
    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
    {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> :
      error ? <Text style={[styles.state, { color: colors.mutedForeground }]}>Couldn’t load this shelf. Pull to try again.</Text> :
      !movies?.length ? <Text style={[styles.state, { color: colors.mutedForeground }]}>No movies here yet.</Text> :
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{movies.map(m => <MovieCard movie={m} key={m.id} />)}</ScrollView>}
  </View>;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const trending = useGetTrendingMovies({ page: 1 });
  const popular = useGetCatalogMovies({ collection: 'popular', page: 1, limit: 12 });
  const hero = trending.data?.results?.[0];
  return <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
    <View style={styles.header}><View><Text style={styles.kicker}>FILMIO</Text><Text style={[styles.greeting, { color: colors.foreground }]}>Find your next<br />favorite film.</Text></View>
      <Pressable accessibilityLabel="Open search" style={[styles.iconButton, { backgroundColor: colors.card }]} onPress={() => router.push('/search')}><Feather name="search" size={21} color={colors.foreground} /></Pressable>
    </View>
    {hero ? <Pressable style={styles.hero} onPress={() => router.push(`/movie/${hero.id}`)}>
      {hero.backdropPath ? <Image source={{ uri: image(hero.backdropPath, 'w780') }} style={styles.heroImage} /> : <View style={[styles.heroImage, { backgroundColor: colors.card }]} />}
      <View style={styles.heroShade} /><View style={styles.heroCopy}><Text style={styles.heroLabel}>TRENDING THIS WEEK</Text><Text style={styles.heroTitle}>{hero.title}</Text><Text style={styles.heroOverview} numberOfLines={2}>{hero.overview || 'A film worth making time for.'}</Text><View style={styles.watch}><Feather name="play" size={14} color="#17120b" /><Text style={styles.watchText}>View film</Text></View></View>
    </Pressable> : trending.isLoading ? <View style={[styles.heroLoading, { backgroundColor: colors.card }]}><ActivityIndicator color={colors.primary} /></View> : <Text style={[styles.state, { color: colors.mutedForeground }]}>Trending films are unavailable right now.</Text>}
    <Pressable style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push('/search')}><Feather name="search" size={18} color={colors.mutedForeground} /><Text style={[styles.searchPlaceholder, { color: colors.mutedForeground }]}>Search movies, people, genres</Text></Pressable>
    <Row title="Trending now" movies={trending.data?.results} loading={trending.isLoading} error={!!trending.error} />
    <Row title="Popular with film lovers" movies={popular.data?.results} loading={popular.isLoading} error={!!popular.error} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, marginBottom: 22 },
  kicker: { color: '#e7b45d', fontSize: 13, fontWeight: '700', letterSpacing: 3 }, greeting: { fontSize: 30, lineHeight: 35, fontWeight: '700', marginTop: 10 }, iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  hero: { height: 350, marginHorizontal: 16, borderRadius: 20, overflow: 'hidden', backgroundColor: '#171518' }, heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' }, heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.48)' }, heroCopy: { position: 'absolute', left: 20, right: 20, bottom: 20 }, heroLabel: { color: '#e7b45d', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }, heroTitle: { color: '#fff', fontSize: 30, fontWeight: '700', marginVertical: 7 }, heroOverview: { color: '#ddd8d3', fontSize: 13, lineHeight: 19 }, watch: { alignSelf: 'flex-start', marginTop: 15, backgroundColor: '#e7b45d', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 18, flexDirection: 'row', gap: 7, alignItems: 'center' }, watchText: { color: '#17120b', fontWeight: '700', fontSize: 13 },
  heroLoading: { height: 350, marginHorizontal: 16, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }, searchBar: { margin: 20, marginBottom: 3, height: 50, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 10 }, searchPlaceholder: { fontSize: 14 }, section: { marginTop: 25 }, sectionTitle: { fontSize: 20, fontWeight: '700', paddingHorizontal: 20, marginBottom: 14 }, row: { paddingHorizontal: 20, gap: 14 }, card: { width: 132, position: 'relative' }, poster: { width: 132, height: 190, borderRadius: 10, backgroundColor: '#201d20' }, posterEmpty: { alignItems: 'center', justifyContent: 'center' }, cardTitle: { fontWeight: '600', fontSize: 14, marginTop: 9 }, meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }, year: { fontSize: 12 }, score: { fontSize: 12, color: '#e7b45d', fontWeight: '600' }, save: { position: 'absolute', right: 8, top: 8, backgroundColor: 'rgba(10,10,10,.75)', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, loader: { marginVertical: 38 }, state: { paddingHorizontal: 20, paddingVertical: 15, fontSize: 14 },
});