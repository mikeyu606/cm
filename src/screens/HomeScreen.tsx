import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Circle, G } from 'react-native-svg';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { FoodEntry } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const RING_SIZE = width * 0.65;
const OUTER_STROKE_WIDTH = 10;
const INNER_STROKE_WIDTH = 12;
const RING_GAP = 18;

// Dual Circular Progress Ring Component
function CircularProgress({ 
  consumed, 
  goal,
  burned,
  burnGoal,
  netCalories,
}: { 
  consumed: number; 
  goal: number;
  burned: number;
  burnGoal: number;
  netCalories: number;
}) {
  // Outer ring (exercise/burned calories) - purple
  const outerRadius = (RING_SIZE - OUTER_STROKE_WIDTH) / 2;
  const outerCircumference = 2 * Math.PI * outerRadius;
  const burnProgress = Math.min(burned / burnGoal, 1);
  const burnOffset = outerCircumference * (1 - burnProgress);
  
  // Inner ring (consumed calories) - green segments
  const innerRadius = outerRadius - RING_GAP;
  const innerCircumference = 2 * Math.PI * innerRadius;
  
  const totalProgress = Math.min(consumed / goal, 1);
  const carbsProgress = totalProgress * 0.4;
  const fatProgress = totalProgress * 0.3;
  const proteinProgress = totalProgress * 0.3;
  
  const carbsOffset = innerCircumference * (1 - carbsProgress);
  const fatOffset = innerCircumference * (1 - fatProgress);
  const proteinOffset = innerCircumference * (1 - proteinProgress);
  
  const carbsRotation = -90;
  const fatRotation = -90 + (carbsProgress * 360);
  const proteinRotation = -90 + ((carbsProgress + fatProgress) * 360);
  
  const isNegative = netCalories < 0;

  return (
    <View style={styles.ringContainer}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        {/* Outer ring background (exercise) */}
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={outerRadius}
          stroke="#E8E8E8"
          strokeWidth={OUTER_STROKE_WIDTH}
          fill="transparent"
        />
        
        {/* Outer ring progress (exercise - purple) */}
        <G rotation={-90} origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={outerRadius}
            stroke="#B8A9C9"
            strokeWidth={OUTER_STROKE_WIDTH}
            fill="transparent"
            strokeDasharray={outerCircumference}
            strokeDashoffset={burnOffset}
            strokeLinecap="round"
          />
        </G>
        
        {/* Inner ring background (calories) */}
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={innerRadius}
          stroke="#E8E8E8"
          strokeWidth={INNER_STROKE_WIDTH}
          fill="transparent"
        />
        
        {/* Carbs (green) */}
        <G rotation={carbsRotation} origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={innerRadius}
            stroke="#A8E6CF"
            strokeWidth={INNER_STROKE_WIDTH}
            fill="transparent"
            strokeDasharray={innerCircumference}
            strokeDashoffset={carbsOffset}
            strokeLinecap="round"
          />
        </G>
        
        {/* Fat (purple) */}
        <G rotation={fatRotation} origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={innerRadius}
            stroke="#B8A9C9"
            strokeWidth={INNER_STROKE_WIDTH}
            fill="transparent"
            strokeDasharray={innerCircumference}
            strokeDashoffset={fatOffset}
            strokeLinecap="round"
          />
        </G>
        
        {/* Protein (light green) */}
        <G rotation={proteinRotation} origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={innerRadius}
            stroke="#C5E8B7"
            strokeWidth={INNER_STROKE_WIDTH}
            fill="transparent"
            strokeDasharray={innerCircumference}
            strokeDashoffset={proteinOffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      
      {/* Center content */}
      <View style={styles.ringCenter}>
        <View style={[styles.ringIcon, isNegative && styles.ringIconNegative]}>
          <Text style={styles.ringIconText}>{isNegative ? '🔥' : '🌿'}</Text>
        </View>
        <Text style={styles.ringGoalText}>Of {goal.toLocaleString()} Kcal</Text>
        <Text style={[styles.ringConsumedText, isNegative && styles.ringConsumedNegative]}>
          {netCalories.toLocaleString()}
        </Text>
      </View>
      
      {/* Bottom dot indicator */}
      <View style={styles.dotIndicator} />
      
      {/* Legend */}
      <View style={styles.ringLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#A8E6CF' }]} />
          <Text style={styles.legendText}>Eaten</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#B8A9C9' }]} />
          <Text style={styles.legendText}>Burned</Text>
        </View>
      </View>
    </View>
  );
}

// Streak Counter Component
function StreakCounter({ streak }: { streak: number }) {
  return (
    <View style={styles.streakContainer}>
      <Text style={styles.streakEmoji}>🔥</Text>
      <Text style={styles.streakNumber}>{streak}</Text>
    </View>
  );
}

// Macro Card Component
function MacroCard({ 
  title, 
  icon, 
  value, 
  max, 
  color,
  bgColor,
}: { 
  title: string; 
  icon: string;
  value: number; 
  max: number; 
  color: string;
  bgColor: string;
}) {
  const progress = Math.min(value / max, 1);
  
  return (
    <View style={[styles.macroCard, { backgroundColor: bgColor }]}>
      <View style={styles.macroHeader}>
        <Text style={styles.macroIcon}>{icon}</Text>
        <Text style={styles.macroTitle}>{title}</Text>
      </View>
      <View style={styles.macroSliderContainer}>
        <View style={styles.macroSliderTrack}>
          <View style={[styles.macroSliderFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
          <View style={[styles.macroSliderThumb, { left: `${progress * 100}%` }]} />
        </View>
      </View>
      <View style={styles.macroValues}>
        <Text style={styles.macroValue}>{value}</Text>
        <Text style={styles.macroMax}>{max} g</Text>
      </View>
    </View>
  );
}

// Meal Category Card Component
function MealCard({ 
  title, 
  description, 
  icon,
  bgColor,
  onPress,
  calories,
}: { 
  title: string; 
  description: string;
  icon: string;
  bgColor: string;
  onPress: () => void;
  calories: number;
}) {
  return (
    <TouchableOpacity style={styles.mealCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.mealIconContainer, { backgroundColor: bgColor }]}>
        <Text style={styles.mealIcon}>{icon}</Text>
      </View>
      <View style={styles.mealInfo}>
        <Text style={styles.mealTitle}>{title}</Text>
        <Text style={styles.mealDescription}>{description}</Text>
      </View>
      {calories > 0 && (
        <Text style={styles.mealCalories}>{calories} kcal</Text>
      )}
      <TouchableOpacity style={styles.mealAddButton} onPress={onPress}>
        <Text style={styles.mealAddButtonText}>+</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

interface WorkoutEntry {
  id: string;
  name: string;
  caloriesBurned: number;
  duration: number;
  timestamp: Date;
  workoutType: string;
}

export default function HomeScreen() {
  const { user, userProfile } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [totalCalories, setTotalCalories] = useState(0);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [streak, setStreak] = useState(7); // Mock streak - you can calculate from logged days

  const getTodayRange = () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { startOfDay, endOfDay };
  };

  const fetchTodayEntries = async () => {
    if (!user) return;

    try {
      const { startOfDay, endOfDay } = getTodayRange();
      
      // Fetch food entries
      const entriesRef = collection(db, 'foodEntries');
      const foodQuery = query(
        entriesRef,
        where('userId', '==', user.uid)
      );

      const snapshot = await getDocs(foodQuery);
      const fetchedEntries: FoodEntry[] = [];
      let totalEaten = 0;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const timestamp = data.timestamp?.toDate?.() || new Date(data.timestamp);
        
        if (timestamp >= startOfDay && timestamp < endOfDay) {
          const entry: FoodEntry = {
            id: docSnap.id,
            userId: data.userId,
            name: data.name,
            calories: data.calories,
            photoUrl: data.photoUrl,
            timestamp: timestamp,
            notes: data.notes,
          };
          fetchedEntries.push(entry);
          totalEaten += data.calories;
        }
      });

      fetchedEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setEntries(fetchedEntries);
      setTotalCalories(totalEaten);

      // Fetch workouts
      const workoutsRef = collection(db, 'workouts');
      const workoutQuery = query(
        workoutsRef,
        where('userId', '==', user.uid)
      );

      const workoutSnapshot = await getDocs(workoutQuery);
      const fetchedWorkouts: WorkoutEntry[] = [];
      let totalBurned = 0;

      workoutSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const timestamp = data.timestamp?.toDate?.() || new Date(data.timestamp);
        
        if (timestamp >= startOfDay && timestamp < endOfDay) {
          fetchedWorkouts.push({
            id: docSnap.id,
            name: data.name,
            caloriesBurned: data.caloriesBurned,
            duration: data.duration,
            timestamp: timestamp,
            workoutType: data.type,
          });
          totalBurned += data.caloriesBurned;
        }
      });

      fetchedWorkouts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setWorkouts(fetchedWorkouts);
      setCaloriesBurned(totalBurned);
    } catch (error) {
      console.error('Error fetching entries:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTodayEntries();
    }, [user])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTodayEntries();
    setRefreshing(false);
  };

  const handleAddMeal = () => {
    navigation.navigate('Scanner');
  };

  const dailyGoal = userProfile?.dailyGoal || 2000;
  const burnGoal = 500; // Daily burn goal
  const netCalories = totalCalories - caloriesBurned;
  
  // Calculate mock macro values based on calories
  const carbsValue = Math.round((totalCalories * 0.4) / 4);
  const fatValue = Math.round((totalCalories * 0.3) / 9);
  const proteinValue = Math.round((totalCalories * 0.3) / 4);

  // Calculate meal calories
  const breakfastCals = entries
    .filter(e => e.timestamp.getHours() < 11)
    .reduce((sum, e) => sum + e.calories, 0);
  const lunchCals = entries
    .filter(e => e.timestamp.getHours() >= 11 && e.timestamp.getHours() < 16)
    .reduce((sum, e) => sum + e.calories, 0);
  const dinnerCals = entries
    .filter(e => e.timestamp.getHours() >= 16)
    .reduce((sum, e) => sum + e.calories, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 10) + 70 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#333" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Tracker</Text>
          <StreakCounter streak={streak} />
        </View>

        {/* Circular Progress with dual rings */}
        <CircularProgress 
          consumed={totalCalories} 
          goal={dailyGoal}
          burned={caloriesBurned}
          burnGoal={burnGoal}
          netCalories={netCalories}
        />

        {/* Macro Cards */}
        <View style={styles.macroContainer}>
          <MacroCard 
            title="Carbs" 
            icon="💚"
            value={carbsValue} 
            max={285} 
            color="#2D5A3D"
            bgColor="#D4EDDA"
          />
          <MacroCard 
            title="Fat" 
            icon="😊"
            value={fatValue} 
            max={285} 
            color="#6B7B8C"
            bgColor="#E8EEF2"
          />
          <MacroCard 
            title="Protein" 
            icon="🌾"
            value={proteinValue} 
            max={285} 
            color="#8B6914"
            bgColor="#F5D98E"
          />
        </View>

        {/* Daily Meals */}
        <View style={styles.mealsSection}>
          <Text style={styles.mealsTitle}>Daily meals</Text>
          
          <MealCard
            title="Breakfast"
            description="Breakfast fuels your body and day"
            icon="🍳"
            bgColor="#FFF3E0"
            onPress={handleAddMeal}
            calories={breakfastCals}
          />
          
          <MealCard
            title="Lunch"
            description="Lunch fuels your goals"
            icon="🍕"
            bgColor="#FCE4EC"
            onPress={handleAddMeal}
            calories={lunchCals}
          />
          
          <MealCard
            title="Dinner"
            description="Dinner supports recovery and rest"
            icon="🥗"
            bgColor="#E8F5E9"
            onPress={handleAddMeal}
            calories={dinnerCals}
          />
        </View>

        {/* Today's Entries (if any) */}
        {(entries.length > 0 || workouts.length > 0) && (
          <View style={styles.entriesSection}>
            <Text style={styles.mealsTitle}>Today's Log</Text>
            
            {/* Workouts */}
            {workouts.map((workout) => (
              <TouchableOpacity 
                key={workout.id} 
                style={styles.entryItem}
                onLongPress={() => {
                  Alert.alert('Delete', 'Delete this workout?', [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Delete', 
                      style: 'destructive',
                      onPress: async () => {
                        await deleteDoc(doc(db, 'workouts', workout.id));
                        fetchTodayEntries();
                      }
                    },
                  ]);
                }}
              >
                <View style={[styles.entryDot, styles.workoutDot]} />
                <View style={styles.entryInfo}>
                  <Text style={styles.entryName}>{workout.name}</Text>
                  <Text style={styles.entryTime}>
                    {Math.floor(workout.duration / 60)} min • {workout.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.workoutCalories}>-{workout.caloriesBurned} kcal</Text>
              </TouchableOpacity>
            ))}
            
            {/* Food entries */}
            {entries.map((entry) => (
              <TouchableOpacity 
                key={entry.id} 
                style={styles.entryItem}
                onLongPress={() => {
                  Alert.alert('Delete', 'Delete this entry?', [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Delete', 
                      style: 'destructive',
                      onPress: async () => {
                        await deleteDoc(doc(db, 'foodEntries', entry.id));
                        fetchTodayEntries();
                      }
                    },
                  ]);
                }}
              >
                <View style={styles.entryDot} />
                <View style={styles.entryInfo}>
                  <Text style={styles.entryName}>{entry.name}</Text>
                  <Text style={styles.entryTime}>
                    {entry.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.entryCalories}>{entry.calories} kcal</Text>
              </TouchableOpacity>
            ))}
          </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  streakEmoji: {
    fontSize: 18,
  },
  streakNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E65100',
  },
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    position: 'relative',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1A1A2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  ringIconText: {
    fontSize: 24,
  },
  ringGoalText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  ringConsumedText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  ringConsumedNegative: {
    color: '#22C55E',
  },
  ringIconNegative: {
    backgroundColor: '#FF6B6B',
  },
  dotIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1A1A2E',
    position: 'absolute',
    bottom: 25,
  },
  ringLegend: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 15,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  macroContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 30,
    marginTop: 10,
  },
  macroCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
  },
  macroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  macroIcon: {
    fontSize: 16,
  },
  macroTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  macroSliderContainer: {
    marginBottom: 10,
  },
  macroSliderTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 3,
    position: 'relative',
  },
  macroSliderFill: {
    height: '100%',
    borderRadius: 3,
  },
  macroSliderThumb: {
    position: 'absolute',
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#1A1A2E',
    marginLeft: -8,
  },
  macroValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  macroMax: {
    fontSize: 12,
    color: '#666',
  },
  mealsSection: {
    marginBottom: 20,
  },
  mealsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 16,
  },
  mealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  mealIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealIcon: {
    fontSize: 24,
  },
  mealInfo: {
    flex: 1,
    marginLeft: 14,
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  mealDescription: {
    fontSize: 13,
    color: '#888',
  },
  mealCalories: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F97316',
    marginRight: 12,
  },
  mealAddButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealAddButtonText: {
    fontSize: 20,
    color: '#666',
    fontWeight: '400',
  },
  entriesSection: {
    marginTop: 10,
  },
  entryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  entryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#A8E6CF',
    marginRight: 12,
  },
  entryInfo: {
    flex: 1,
  },
  entryName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A2E',
  },
  entryTime: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  entryCalories: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  workoutDot: {
    backgroundColor: '#FF6B6B',
  },
  workoutCalories: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },
});
