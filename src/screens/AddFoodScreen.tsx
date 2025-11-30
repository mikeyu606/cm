import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { analyzeFoodImage, FoodAnalysisResult } from '../config/openai';

const { width } = Dimensions.get('window');

type RouteParams = {
  AddFoodModal: {
    photoUri?: string;
  };
};

export default function AddFoodScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'AddFoodModal'>>();
  const insets = useSafeAreaInsets();
  
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<FoodAnalysisResult | null>(null);

  // Analyze photo with AI
  const analyzePhoto = async (uri: string) => {
    setAnalyzing(true);
    try {
      // Convert image to base64 for OpenAI Vision API
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      
      // Call AI vision API
      const result = await analyzeFoodImage(base64);
      setAnalysisResult(result);
      
      // Pre-fill the form with AI results
      if (result.foodName && result.foodName !== 'Unknown Food') {
        setFoodName(result.foodName);
      }
      if (result.calories > 0) {
        setCalories(result.calories.toString());
      }
      if (result.description) {
        setNotes(result.description);
      }
    } catch (error) {
      console.error('Error analyzing photo:', error);
      // Don't show error - user can still manually enter
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (route.params?.photoUri) {
      setPhotoUri(route.params.photoUri);
      // Auto-analyze the photo
      analyzePhoto(route.params.photoUri);
    }
  }, [route.params?.photoUri]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setPhotoUri(uri);
      // Analyze the picked image
      analyzePhoto(uri);
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `food_${user?.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, `foodPhotos/${filename}`);
      
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const handleSave = async () => {
    if (!foodName.trim()) {
      Alert.alert('Error', 'Please enter a food name');
      return;
    }

    if (!calories.trim() || isNaN(parseInt(calories))) {
      Alert.alert('Error', 'Please enter valid calories');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }

    setSaving(true);

    try {
      let photoUrl = null;
      if (photoUri) {
        photoUrl = await uploadImage(photoUri);
      }

      await addDoc(collection(db, 'foodEntries'), {
        userId: user.uid,
        name: foodName.trim(),
        calories: parseInt(calories),
        photoUrl,
        notes: notes.trim() || null,
        timestamp: Timestamp.now(),
      });

      Alert.alert('Success', 'Food entry saved!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error saving entry:', error);
      Alert.alert('Error', 'Failed to save food entry');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {/* Header - Instagram style */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New post</Text>
        <TouchableOpacity 
          onPress={handleSave} 
          disabled={saving}
          style={styles.nextButton}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#0095F6" />
          ) : (
            <Text style={styles.nextButtonText}>Share</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Photo Section - Edge to edge like Instagram */}
          {photoUri ? (
            <View style={styles.photoContainer}>
              <Image 
                source={{ uri: photoUri }} 
                style={styles.photo}
                resizeMode="cover"
              />
              {analyzing && (
                <View style={styles.analyzingOverlay}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.analyzingText}>Analyzing food...</Text>
                </View>
              )}
              {analysisResult && !analyzing && (
                <View style={styles.aiResultBadge}>
                  <Ionicons name="sparkles" size={14} color="#fff" />
                  <Text style={styles.aiResultText}>
                    AI Estimated • {analysisResult.confidence} confidence
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={() => {
                  setPhotoUri(null);
                  setAnalysisResult(null);
                  setFoodName('');
                  setCalories('');
                  setNotes('');
                }}
              >
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <TouchableOpacity 
                style={styles.photoButton} 
                onPress={handleBack}
              >
                <Ionicons name="camera-outline" size={40} color="#999" />
                <Text style={styles.photoButtonText}>Take Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
                <Ionicons name="images-outline" size={40} color="#999" />
                <Text style={styles.photoButtonText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.form}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Food</Text>
              <TextInput
                style={styles.input}
                value={foodName}
                onChangeText={setFoodName}
                placeholder="What did you eat?"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Calories</Text>
              <TextInput
                style={styles.input}
                value={calories}
                onChangeText={setCalories}
                placeholder="Enter calories"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={styles.input}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes (optional)"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.divider} />
          </View>

          {/* Quick Add Suggestions */}
          <View style={styles.suggestionsSection}>
            <Text style={styles.suggestionsTitle}>Quick Add</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsScroll}
            >
              {[
                { name: 'Apple', cal: '95', emoji: '🍎' },
                { name: 'Banana', cal: '105', emoji: '🍌' },
                { name: 'Coffee', cal: '5', emoji: '☕' },
                { name: 'Egg', cal: '78', emoji: '🥚' },
                { name: 'Toast', cal: '80', emoji: '🍞' },
                { name: 'Salad', cal: '150', emoji: '🥗' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.name}
                  style={styles.suggestionChip}
                  onPress={() => {
                    setFoodName(item.name);
                    setCalories(item.cal);
                  }}
                >
                  <Text style={styles.suggestionEmoji}>{item.emoji}</Text>
                  <Text style={styles.suggestionText}>{item.name}</Text>
                  <Text style={styles.suggestionCal}>{item.cal} cal</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#DBDBDB',
  },
  backButton: {
    width: 50,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  nextButton: {
    paddingHorizontal: 16,
    height: 44,
    justifyContent: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0095F6',
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  photoContainer: {
    width: width,
    aspectRatio: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  aiResultBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiResultText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholder: {
    width: width,
    aspectRatio: 1,
    backgroundColor: '#FAFAFA',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
  },
  photoButton: {
    alignItems: 'center',
    gap: 8,
  },
  photoButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  form: {
    paddingTop: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputLabel: {
    width: 70,
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#000',
  },
  divider: {
    height: 0.5,
    backgroundColor: '#EFEFEF',
    marginLeft: 16,
  },
  suggestionsSection: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  suggestionsScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  suggestionChip: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginRight: 10,
    minWidth: 80,
  },
  suggestionEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  suggestionText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '500',
  },
  suggestionCal: {
    color: '#999',
    fontSize: 11,
    marginTop: 2,
  },
});
