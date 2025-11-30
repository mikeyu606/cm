import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { FoodEntry } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface WorkoutEntry {
  id: string;
  type: 'workout';
  userId: string;
  workoutType: string;
  name: string;
  duration: number;
  caloriesBurned: number;
  timestamp: Date;
}

interface FoodEntryWithType extends FoodEntry {
  type: 'food';
}

type HistoryEntry = FoodEntryWithType | WorkoutEntry;

interface DayGroup {
  date: string;
  displayDate: string;
  entries: HistoryEntry[];
  totalCalories: number;
  totalBurned: number;
}

// Workout type icons and colors
const WORKOUT_STYLES: Record<string, { icon: string; color: string }> = {
  run: { icon: 'walk', color: '#FF6B6B' },
  cycle: { icon: 'bicycle', color: '#4ECDC4' },
  swim: { icon: 'water', color: '#45B7D1' },
  weights: { icon: 'barbell', color: '#96CEB4' },
  yoga: { icon: 'body', color: '#DDA0DD' },
  hiit: { icon: 'flame', color: '#FF8C42' },
};

export default function HistoryScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    if (!user) return;

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Fetch food entries
      const entriesRef = collection(db, 'foodEntries');
      const foodQuery = query(
        entriesRef,
        where('userId', '==', user.uid)
      );

      const foodSnapshot = await getDocs(foodQuery);
      const allEntries: HistoryEntry[] = [];

      foodSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const timestamp = data.timestamp?.toDate?.() || new Date(data.timestamp);
        
        if (timestamp >= thirtyDaysAgo) {
          allEntries.push({
            type: 'food',
            id: docSnap.id,
            userId: data.userId,
            name: data.name,
            calories: data.calories,
            photoUrl: data.photoUrl,
            timestamp: timestamp,
            notes: data.notes,
          });
        }
      });

      // Fetch workouts
      const workoutsRef = collection(db, 'workouts');
      const workoutQuery = query(
        workoutsRef,
        where('userId', '==', user.uid)
      );

      const workoutSnapshot = await getDocs(workoutQuery);

      workoutSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const timestamp = data.timestamp?.toDate?.() || new Date(data.timestamp);
        
        if (timestamp >= thirtyDaysAgo) {
          allEntries.push({
            type: 'workout',
            id: docSnap.id,
            userId: data.userId,
            workoutType: data.type,
            name: data.name,
            duration: data.duration,
            caloriesBurned: data.caloriesBurned,
            timestamp: timestamp,
          });
        }
      });

      // Sort all entries by timestamp
      allEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Group entries by date
      const groups: Map<string, DayGroup> = new Map();

      allEntries.forEach((entry) => {
        const dateKey = entry.timestamp.toISOString().split('T')[0];
        const existing = groups.get(dateKey);

        const isWorkout = entry.type === 'workout';
        const calories = isWorkout ? 0 : (entry as FoodEntryWithType).calories;
        const burned = isWorkout ? (entry as WorkoutEntry).caloriesBurned : 0;

        if (existing) {
          existing.entries.push(entry);
          existing.totalCalories += calories;
          existing.totalBurned += burned;
        } else {
          groups.set(dateKey, {
            date: dateKey,
            displayDate: formatDisplayDate(entry.timestamp),
            entries: [entry],
            totalCalories: calories,
            totalBurned: burned,
          });
        }
      });

      setDayGroups(Array.from(groups.values()));
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  const formatDisplayDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateString = date.toISOString().split('T')[0];
    const todayString = today.toISOString().split('T')[0];
    const yesterdayString = yesterday.toISOString().split('T')[0];

    if (dateString === todayString) return 'Today';
    if (dateString === yesterdayString) return 'Yesterday';

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const handleDeleteEntry = async (entry: HistoryEntry) => {
    const isWorkout = entry.type === 'workout';
    const collectionName = isWorkout ? 'workouts' : 'foodEntries';
    const entryType = isWorkout ? 'workout' : 'food entry';
    
    Alert.alert(
      'Delete Entry',
      `Are you sure you want to delete this ${entryType}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, collectionName, entry.id));
              await fetchHistory();
            } catch (error) {
              console.error('Error deleting entry:', error);
              Alert.alert('Error', 'Failed to delete entry');
            }
          },
        },
      ]
    );
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m`;
  };

  const totalDays = dayGroups.length;
  const totalCalories = dayGroups.reduce((sum, day) => sum + day.totalCalories, 0);
  const totalBurned = dayGroups.reduce((sum, day) => sum + day.totalBurned, 0);
  const totalWorkouts = dayGroups.reduce((sum, day) => 
    sum + day.entries.filter(e => e.type === 'workout').length, 0
  );
  const avgCalories = totalDays > 0 ? Math.round(totalCalories / totalDays) : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>Last 30 days</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 10) + 70 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#333" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Summary */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalDays}</Text>
            <Text style={styles.statLabel}>Days logged</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{avgCalories}</Text>
            <Text style={styles.statLabel}>Avg daily</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalWorkouts}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
        </View>

        {/* Burned calories banner */}
        {totalBurned > 0 && (
          <View style={styles.burnedBanner}>
            <Ionicons name="flame" size={20} color="#FF6B6B" />
            <Text style={styles.burnedText}>
              <Text style={styles.burnedValue}>{totalBurned}</Text> calories burned this month
            </Text>
          </View>
        )}

        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading...</Text>
          </View>
        ) : dayGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyText}>No history yet</Text>
            <Text style={styles.emptySubtext}>
              Start logging your meals to see your history
            </Text>
          </View>
        ) : (
          dayGroups.map((dayGroup) => (
            <View key={dayGroup.date} style={styles.daySection}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>{dayGroup.displayDate}</Text>
                <View style={styles.dayStats}>
                  {dayGroup.totalBurned > 0 && (
                    <View style={styles.dayBurned}>
                      <Ionicons name="flame" size={14} color="#FF6B6B" />
                      <Text style={styles.dayBurnedValue}>-{dayGroup.totalBurned}</Text>
                    </View>
                  )}
                  <View style={styles.dayCalories}>
                    <Text style={styles.dayCaloriesValue}>{dayGroup.totalCalories}</Text>
                    <Text style={styles.dayCaloriesUnit}> kcal</Text>
                  </View>
                </View>
              </View>

              {dayGroup.entries.map((entry) => {
                if (entry.type === 'workout') {
                  const workout = entry as WorkoutEntry;
                  const workoutStyle = WORKOUT_STYLES[workout.workoutType] || { icon: 'fitness', color: '#666' };
                  
                  return (
                    <TouchableOpacity
                      key={entry.id}
                      style={styles.entryCard}
                      onLongPress={() => handleDeleteEntry(entry)}
                    >
                      <View style={[styles.workoutIcon, { backgroundColor: workoutStyle.color + '20' }]}>
                        <Ionicons name={workoutStyle.icon as any} size={24} color={workoutStyle.color} />
                      </View>
                      <View style={styles.entryInfo}>
                        <Text style={styles.entryName}>{workout.name}</Text>
                        <Text style={styles.entryTime}>
                          {formatDuration(workout.duration)} • {formatTime(workout.timestamp)}
                        </Text>
                      </View>
                      <View style={styles.burnedCalories}>
                        <Ionicons name="flame" size={14} color="#FF6B6B" />
                        <Text style={styles.burnedCaloriesText}>-{workout.caloriesBurned}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }
                
                // Food entry
                const food = entry as FoodEntryWithType;
                return (
                  <TouchableOpacity
                    key={entry.id}
                    style={styles.entryCard}
                    onLongPress={() => handleDeleteEntry(entry)}
                  >
                    {food.photoUrl ? (
                      <Image source={{ uri: food.photoUrl }} style={styles.entryImage} />
                    ) : (
                      <View style={[styles.entryImage, styles.entryImagePlaceholder]}>
                        <Text style={styles.entryImagePlaceholderText}>🍽️</Text>
                      </View>
                    )}
                    <View style={styles.entryInfo}>
                      <Text style={styles.entryName}>{food.name}</Text>
                      <Text style={styles.entryTime}>{formatTime(food.timestamp)}</Text>
                    </View>
                    <Text style={styles.entryCalories}>{food.calories} kcal</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 0,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E8E8E8',
    marginHorizontal: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F97316',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  daySection: {
    marginBottom: 24,
  },
  burnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    gap: 8,
  },
  burnedText: {
    fontSize: 14,
    color: '#666',
  },
  burnedValue: {
    fontWeight: '700',
    color: '#FF6B6B',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  dayStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayBurned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dayBurnedValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  dayCalories: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  dayCaloriesValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F97316',
  },
  dayCaloriesUnit: {
    fontSize: 12,
    color: '#888',
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  entryImage: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  entryImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryImagePlaceholderText: {
    fontSize: 24,
  },
  workoutIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burnedCalories: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  burnedCaloriesText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  entryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  entryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  entryTime: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  entryCalories: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },
});
