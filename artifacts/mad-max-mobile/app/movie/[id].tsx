import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAddToWatchlist, useGetMovieDetails, useGetMovieStats, useUpsertRating } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

const image = (path?: string | null, size = 'w780') => path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;
export default function MovieScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const movieId = Number(id);
  const query = useGetMovieDetails(movieId);
  const stats = useGetMovieStats(movieId, {
    query: {
      queryKey: ['filmio-movie-stats', movieId],
      enabled: Number.isInteger(movieId) && movieId > 0,
    },
  });
  const add = useAddToWatchlist();
  const rate = useUpsertRating();
  const [rated, setRated] = useState<number>();
  const movie = query.data;
  if (query.isLoading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  if (query.error || !movie) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={[styles.error, { color: colors.mutedForeground }]}>This film could not be loaded.</Text><Pressable onPress={() => router.back()}><Text style={{ color: colors.primary }}>Go back</Text></Pressable></View>;
  const filmioScore = stats.data?.totalRatings ? stats.data.weightedScore : null;
  return <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 45 }}><View style={styles.backdrop}>{movie.backdropPath ? <Image source={{ uri: image(movie.backdropPath) }} style={styles.backdropImage} /> : <View style={[styles.backdropImage, { backgroundColor: colors.card }]} />}<View style={styles.backdropShade} /><Pressable style={[styles.back, { top: insets.top + 14 }]} onPress={() => router.back()}><Feather name="arrow-left" size={22} color="#fff" /></Pressable></View>
    <View style={styles.body}><Text style={[styles.title, { color: colors.foreground }]}>{movie.title}</Text>{movie.tagline ? <Text style={[styles.tagline, { color: colors.mutedForeground }]}>{movie.tagline}</Text> : null}<View style={styles.meta}><View><Text style={[styles.score, { color: colors.primary }]}>FILMIO {filmioScore ? filmioScore.toFixed(1) : '—'}</Text><Text style={[styles.reference, { color: colors.mutedForeground }]}>TMDB reference {movie.voteAverage.toFixed(1)}</Text></View><Text style={[styles.metaText, { color: colors.mutedForeground }]}>{movie.releaseDate?.slice(0, 4)}  ·  {movie.runtime ? `${movie.runtime} min` : 'Runtime unavailable'}</Text></View><Text style={[styles.scoreNote, { color: colors.mutedForeground }]}>{filmioScore ? `Bayesian audience score from ${stats.data?.totalRatings} FILMIO rating${stats.data?.totalRatings === 1 ? '' : 's'}.` : 'FILMIO audience score appears after members rate this film.'}</Text><View style={styles.genres}>{movie.genres.map(g => <Text key={g.id} style={[styles.genre, { color: colors.accentForeground, backgroundColor: colors.accent }]}>{g.name}</Text>)}</View><Text style={[styles.heading, { color: colors.foreground }]}>The story</Text><Text style={[styles.overview, { color: colors.mutedForeground }]}>{movie.overview || 'No synopsis is available for this film.'}</Text><Pressable disabled={add.isPending} style={[styles.watchlist, { borderColor: colors.primary }]} onPress={() => add.mutate({ data: { movieId: movie.id, movieTitle: movie.title, moviePosterPath: movie.posterPath, movieReleaseDate: movie.releaseDate } })}><Feather name="bookmark" size={17} color={colors.primary} /><Text style={[styles.watchlistText, { color: colors.primary }]}>{add.isPending ? 'Saving…' : 'Add to watchlist'}</Text></Pressable>{add.isError ? <Text style={[styles.rateError, { color: colors.destructive }]}>Sign in to sync your watchlist.</Text> : null}<Text style={[styles.heading, { color: colors.foreground }]}>Your rating</Text><Text style={[styles.rateHint, { color: colors.mutedForeground }]}>How would you score it?</Text><View style={styles.ratings}>{Array.from({ length: 10 }, (_, i) => i + 1).map(score => <Pressable key={score} disabled={rate.isPending} onPress={() => { setRated(score); rate.mutate({ data: { movieId: movie.id, score } }); }} style={[styles.rating, { borderColor: rated === score ? colors.primary : colors.border, backgroundColor: rated === score ? colors.primary : colors.card }]}><Text style={{ color: rated === score ? colors.primaryForeground : colors.foreground, fontWeight: '700' }}>{score}</Text></Pressable>)}</View>{rate.isError ? <Text style={[styles.rateError, { color: colors.destructive }]}>Sign in to save your rating, then try again.</Text> : null}</View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 }, error: { fontSize: 15 }, backdrop: { height: 330, position: 'relative' }, backdropImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' }, backdropShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.35)' }, back: { position: 'absolute', left: 18, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,.45)', justifyContent: 'center', alignItems: 'center' }, body: { padding: 22 }, title: { fontSize: 30, lineHeight: 36, fontWeight: '700' }, tagline: { fontSize: 14, fontStyle: 'italic', marginTop: 7 }, meta: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 }, score: { fontWeight: '700', fontSize: 15 }, reference: { fontSize: 11, marginTop: 3 }, scoreNote: { fontSize: 12, lineHeight: 18, marginTop: 10 }, metaText: { fontSize: 13, flexShrink: 1 }, genres: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 16 }, genre: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 13, fontSize: 12 }, heading: { fontSize: 18, fontWeight: '700', marginTop: 27, marginBottom: 9 }, overview: { fontSize: 15, lineHeight: 23 }, watchlist: { height: 48, borderWidth: 1, borderRadius: 12, marginTop: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, watchlistText: { fontWeight: '700' }, rateHint: { fontSize: 13 }, ratings: { flexDirection: 'row', gap: 6, marginTop: 14, flexWrap: 'wrap' }, rating: { width: 31, height: 36, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, rateError: { fontSize: 13, marginTop: 10 },
});