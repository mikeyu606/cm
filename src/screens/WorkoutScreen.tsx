import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';

const WORKOUT_TYPES = [
  { id: 'run', name: 'Running', icon: 'walk', color: '#FF6B6B', caloriesPerMin: 10 },
  { id: 'cycle', name: 'Cycling', icon: 'bicycle', color: '#4ECDC4', caloriesPerMin: 8 },
  { id: 'swim', name: 'Swimming', icon: 'water', color: '#45B7D1', caloriesPerMin: 9 },
  { id: 'weights', name: 'Weights', icon: 'barbell', color: '#96CEB4', caloriesPerMin: 6 },
  { id: 'yoga', name: 'Yoga', icon: 'body', color: '#DDA0DD', caloriesPerMin: 4 },
  { id: 'hiit', name: 'HIIT', icon: 'flame', color: '#FF8C42', caloriesPerMin: 12 },
];

export default function WorkoutScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [selectedWorkout, setSelectedWorkout] = useState(WORKOUT_TYPES[0]);
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isTracking && !isPaused) {
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          setCaloriesBurned(Math.round((newTime / 60) * selectedWorkout.caloriesPerMin));
          return newTime;
        });
      }, 1000);
    } else {
      pulseAnim.setValue(1);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTracking, isPaused]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    setIsTracking(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  const handleStop = async () => {
    Alert.alert(
      'Finish Workout',
      `Save this ${selectedWorkout.name} workout?\n\nDuration: ${formatTime(elapsedTime)}\nCalories: ${caloriesBurned} kcal`,
      [
        { 
          text: 'Discard', 
          style: 'destructive',
          onPress: () => {
            resetWorkout();
            navigation.goBack();
          }
        },
        { 
          text: 'Save', 
          onPress: async () => {
            try {
              if (user) {
                await addDoc(collection(db, 'workouts'), {
                  userId: user.uid,
                  type: selectedWorkout.id,
                  name: selectedWorkout.name,
                  duration: elapsedTime,
                  caloriesBurned: caloriesBurned,
                  timestamp: Timestamp.now(),
                });
              }
              resetWorkout();
              navigation.goBack();
            } catch (error) {
              console.error('Error saving workout:', error);
              Alert.alert('Error', 'Failed to save workout');
            }
          }
        },
      ]
    );
  };

  const resetWorkout = () => {
    setIsTracking(false);
    setIsPaused(false);
    setElapsedTime(0);
    setCaloriesBurned(0);
  };

  const handleClose = () => {
    if (isTracking) {
      Alert.alert(
        'End Workout?',
        'You have an active workout. Are you sure you want to leave?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Leave', 
            style: 'destructive',
            onPress: () => {
              resetWorkout();
              navigation.goBack();
            }
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Workout</Text>
        <View style={{ width: 44 }} />
      </View>

      {!isTracking ? (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Workout Type Selection */}
          <Text style={styles.sectionTitle}>Select Activity</Text>
          <View style={styles.workoutGrid}>
            {WORKOUT_TYPES.map((workout) => (
              <TouchableOpacity
                key={workout.id}
                style={[
                  styles.workoutCard,
                  selectedWorkout.id === workout.id && styles.workoutCardSelected,
                  { borderColor: selectedWorkout.id === workout.id ? workout.color : '#E8E8E8' }
                ]}
                onPress={() => setSelectedWorkout(workout)}
              >
                <View style={[styles.workoutIconContainer, { backgroundColor: workout.color + '20' }]}>
                  <Ionicons name={workout.icon as any} size={28} color={workout.color} />
                </View>
                <Text style={styles.workoutName}>{workout.name}</Text>
                <Text style={styles.workoutCalories}>{workout.caloriesPerMin} cal/min</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Start Button */}
          <TouchableOpacity 
            style={[styles.startButton, { backgroundColor: selectedWorkout.color }]}
            onPress={handleStart}
          >
            <Ionicons name="play" size={24} color="#fff" />
            <Text style={styles.startButtonText}>Start {selectedWorkout.name}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={styles.trackingContainer}>
          {/* Active Workout Display */}
          <View style={styles.workoutTypeDisplay}>
            <View style={[styles.activeWorkoutIcon, { backgroundColor: selectedWorkout.color + '20' }]}>
              <Ionicons name={selectedWorkout.icon as any} size={32} color={selectedWorkout.color} />
            </View>
            <Text style={styles.activeWorkoutName}>{selectedWorkout.name}</Text>
          </View>

          {/* Timer */}
          <Animated.View style={[styles.timerContainer, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
            {isPaused && <Text style={styles.pausedText}>PAUSED</Text>}
          </Animated.View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Ionicons name="flame" size={24} color="#FF6B6B" />
              <Text style={styles.statValue}>{caloriesBurned}</Text>
              <Text style={styles.statLabel}>Calories</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="time" size={24} color="#4ECDC4" />
              <Text style={styles.statValue}>{Math.floor(elapsedTime / 60)}</Text>
              <Text style={styles.statLabel}>Minutes</Text>
            </View>
          </View>

          {/* Control Buttons */}
          <View style={styles.controlsContainer}>
            <TouchableOpacity 
              style={styles.stopButton}
              onPress={handleStop}
            >
              <Ionicons name="stop" size={28} color="#FF6B6B" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.pauseButton, { backgroundColor: selectedWorkout.color }]}
              onPress={isPaused ? handleResume : handlePause}
            >
              <Ionicons 
                name={isPaused ? "play" : "pause"} 
                size={36} 
                color="#fff" 
              />
            </TouchableOpacity>
            
            <View style={{ width: 60 }} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 16,
  },
  workoutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 30,
  },
  workoutCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E8E8E8',
  },
  workoutCardSelected: {
    borderWidth: 2,
  },
  workoutIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  workoutName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  workoutCalories: {
    fontSize: 12,
    color: '#888',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
    gap: 10,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  trackingContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
  },
  workoutTypeDisplay: {
    alignItems: 'center',
    marginBottom: 30,
  },
  activeWorkoutIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  activeWorkoutName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  timerText: {
    fontSize: 72,
    fontWeight: '200',
    color: '#1A1A2E',
    fontVariant: ['tabular-nums'],
  },
  pausedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
    marginTop: 8,
    letterSpacing: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 30,
    marginBottom: 60,
  },
  statBox: {
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 30,
    borderRadius: 16,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  stopButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  pauseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
});

