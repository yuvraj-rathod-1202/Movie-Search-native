import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator, 
  StyleSheet, 
  Alert,
  ScrollView
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStackNavigator } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import debounce from 'lodash.debounce';
// Uncomment NavigationContainer if you are NOT using expo-router
// import { NavigationContainer } from '@react-navigation/native';

const API_KEY = '4c3965c5';
const API_URL = 'https://www.omdbapi.com/';
const FAVORITES_KEY = 'favorites';

function MovieSearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Debounced search to limit API calls while typing
  const debouncedSearch = useRef(
    debounce(() => {
      searchMovies(true);
    }, 500)
  ).current;

  const searchMovies = async (newSearch = false) => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const response = await axios.get(
        `${API_URL}?apikey=${API_KEY}&s=${query}&page=${newSearch ? 1 : page}`
      );
      if (response.data.Response === 'True' && response.data.Search) {
        const newMovies = response.data.Search;
        setMovies(newSearch ? newMovies : [...movies, ...newMovies]);
        setHasMore(newMovies.length > 0);
        setPage(newSearch ? 2 : page + 1);
      } else {
        // API returned an error message (could be "Movie not found!" or rate limit error)
        setMovies([]);
        Alert.alert('Notice', response.data.Error || 'No movies found.');
      }
    } catch (error) {
      console.error('Error fetching movies:', error);
      Alert.alert('Error', 'An error occurred while fetching movies.');
    }
    setLoading(false);
  };

  const renderMovieItem = ({ item }) => (
    <TouchableOpacity onPress={() => navigation.navigate('Details', { imdbID: item.imdbID })}>
      <View style={styles.movieItem}>
        {item.Poster !== 'N/A' ? (
          <Image source={{ uri: item.Poster }} style={styles.poster} />
        ) : (
          <View style={[styles.poster, styles.placeholder]}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
        <Text style={styles.movieTitle}>{item.Title} ({item.Year})</Text>
      </View>
    </TouchableOpacity>
  );

  // Add a header button to navigate to Bookmarks
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Bookmarks')}>
          <Text style={styles.headerButtonText}>Bookmarks</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Movie Search</Text>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.input}
          placeholder="Search for movies..."
          placeholderTextColor="#ccc"
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            debouncedSearch();
          }}
          onSubmitEditing={() => searchMovies(true)}
        />
        <TouchableOpacity 
          style={[styles.searchButton, { opacity: query.trim() ? 1 : 0.5 }]} 
          onPress={() => searchMovies(true)}
          disabled={!query.trim()}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>
      {(!loading && movies.length === 0 && query.trim()) && (
        <Text style={styles.emptyText}>No movies found.</Text>
      )}
      <FlatList
        data={movies}
        keyExtractor={(item) => item.imdbID}
        renderItem={renderMovieItem}
        onEndReached={() => hasMore && searchMovies()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loading ? <ActivityIndicator size="large" color="#1E90FF" /> : null}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

function MovieDetailsScreen({ route }) {
  const { imdbID } = route.params;
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);

  // Load movie details on mount
  useEffect(() => {
    axios.get(`${API_URL}?apikey=${API_KEY}&i=${imdbID}`)
      .then(response => {
        setMovie(response.data);
        setLoading(false);
        checkIfBookmarked(response.data);
      })
      .catch(error => {
        console.error('Error fetching movie details:', error);
        setLoading(false);
      });
  }, [imdbID]);

  // Re-check bookmark status every time the screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (movie) {
        checkIfBookmarked(movie);
      }
    }, [movie])
  );

  // Check if current movie is bookmarked
  const checkIfBookmarked = async (movieData) => {
    try {
      const favoritesJSON = await AsyncStorage.getItem(FAVORITES_KEY);
      const favorites = favoritesJSON ? JSON.parse(favoritesJSON) : [];
      const exists = favorites.some(item => item.imdbID === movieData.imdbID);
      setBookmarked(exists);
    } catch (error) {
      console.error('Error checking bookmark:', error);
    }
  };

  // Toggle bookmark state
  const toggleBookmark = async () => {
    try {
      const favoritesJSON = await AsyncStorage.getItem(FAVORITES_KEY);
      let favorites = favoritesJSON ? JSON.parse(favoritesJSON) : [];

      if (bookmarked) {
        // Remove from favorites
        favorites = favorites.filter(item => item.imdbID !== movie.imdbID);
        Alert.alert('Removed from bookmarks');
      } else {
        // Add to favorites
        favorites.push(movie);
        Alert.alert('Added to bookmarks');
      }
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
      setBookmarked(!bookmarked);
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      Alert.alert('Error', 'An error occurred while updating bookmarks.');
    }
  };

  if (loading) 
    return <ActivityIndicator size="large" color="#1E90FF" style={styles.detailsLoading} />;

  return (
    <ScrollView style={styles.detailsContainer} contentContainerStyle={styles.detailsContentContainer}>
      {movie && (
        <>
          {movie.Poster !== 'N/A' ? (
            <Image source={{ uri: movie.Poster }} style={styles.detailsPoster} />
          ) : (
            <View style={[styles.detailsPoster, styles.placeholder]}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
          <Text style={styles.detailsTitle}>{movie.Title} ({movie.Year})</Text>
          <Text style={styles.detailsText}>Genre: {movie.Genre}</Text>
          <Text style={styles.detailsText}>Rating: {movie.imdbRating}</Text>
          <Text style={styles.detailsText}>{movie.Plot}</Text>
          <TouchableOpacity 
            style={[styles.bookmarkButton, { backgroundColor: bookmarked ? '#FF6347' : '#1E90FF' }]}
            onPress={toggleBookmark}
          >
            <Text style={styles.bookmarkButtonText}>{bookmarked ? 'Remove Bookmark' : 'Bookmark'}</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

function BookmarksScreen({ navigation }) {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load favorites from AsyncStorage
  const loadFavorites = async () => {
    setRefreshing(true);
    try {
      const favoritesJSON = await AsyncStorage.getItem(FAVORITES_KEY);
      const favoritesData = favoritesJSON ? JSON.parse(favoritesJSON) : [];
      setFavorites(favoritesData);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
    setRefreshing(false);
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadFavorites();
    });
    return unsubscribe;
  }, [navigation]);

  const renderFavoriteItem = ({ item }) => (
    <TouchableOpacity onPress={() => navigation.navigate('Details', { imdbID: item.imdbID })}>
      <View style={styles.movieItem}>
        {item.Poster !== 'N/A' ? (
          <Image source={{ uri: item.Poster }} style={styles.poster} />
        ) : (
          <View style={[styles.poster, styles.placeholder]}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
        <Text style={styles.movieTitle}>{item.Title} ({item.Year})</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) return <ActivityIndicator size="large" color="#1E90FF" style={styles.detailsLoading} />;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Bookmarked Movies</Text>
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.imdbID}
        renderItem={renderFavoriteItem}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={loadFavorites}
      />
    </View>
  );
}

const Stack = createStackNavigator();

function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1E90FF' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen name="Search" component={MovieSearchScreen} options={{ title: 'Movie Search' }} />
      <Stack.Screen name="Details" component={MovieDetailsScreen} options={{ title: 'Movie Details' }} />
      <Stack.Screen name="Bookmarks" component={BookmarksScreen} options={{ title: 'Bookmarks' }} />
    </Stack.Navigator>
  );
}

// Uncomment NavigationContainer if you are NOT using expo-router
export default function App() {
  return (
    // <NavigationContainer>
      <AppNavigator />
    // </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    alignSelf: 'center',
    color: '#1E90FF',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderColor: '#1E90FF',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
    color: '#000',
    backgroundColor: '#fff',
  },
  searchButton: {
    backgroundColor: '#1E90FF',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  headerButton: {
    marginRight: 15,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  headerButtonText: {
    color: '#1E90FF',
    fontWeight: 'bold',
  },
  movieItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 10,
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    alignItems: 'center',
  },
  poster: {
    width: 50,
    height: 75,
    marginRight: 10,
    borderRadius: 4,
  },
  movieTitle: {
    fontSize: 16,
    color: '#333',
    flexShrink: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#555',
    fontSize: 16,
  },
  detailsContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  detailsContentContainer: {
    padding: 15,
    alignItems: 'center'
  },
  detailsPoster: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 15,
  },
  detailsTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1E90FF',
    textAlign: 'center',
  },
  detailsText: {
    fontSize: 16,
    marginBottom: 8,
    color: '#555',
    textAlign: 'center',
  },
  detailsLoading: {
    marginTop: 50,
  },
  bookmarkButton: {
    marginTop: 15,
    padding: 15,
    borderRadius: 8,
    alignSelf: 'center',
  },
  bookmarkButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  placeholder: {
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#fff',
  },
});
