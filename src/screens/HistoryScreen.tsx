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

interface DayGroup {
  date: string;
  displayDate: string;
  entries: FoodEntry[];
  totalCalories: number;
}

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

      const entriesRef = collection(db, 'foodEntries');
      const q = query(
        entriesRef,
        where('userId', '==', user.uid)
      );

      const snapshot = await getDocs(q);
      const entries: FoodEntry[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const timestamp = data.timestamp?.toDate?.() || new Date(data.timestamp);
        
        if (timestamp >= thirtyDaysAgo) {
          entries.push({
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

      entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Group entries by date
      const groups: Map<string, DayGroup> = new Map();

      entries.forEach((entry) => {
        const dateKey = entry.timestamp.toISOString().split('T')[0];
        const existing = groups.get(dateKey);

        if (existing) {
          existing.entries.push(entry);
          existing.totalCalories += entry.calories;
        } else {
          groups.set(dateKey, {
            date: dateKey,
            displayDate: formatDisplayDate(entry.timestamp),
            entries: [entry],
            totalCalories: entry.calories,
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

  const handleDeleteEntry = async (entryId: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this food entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'foodEntries', entryId));
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

  const totalDays = dayGroups.length;
  const totalCalories = dayGroups.reduce((sum, day) => sum + day.totalCalories, 0);
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
            <Text style={styles.statValue}>
              {dayGroups.reduce((sum, day) => sum + day.entries.length, 0)}
            </Text>
            <Text style={styles.statLabel}>Total meals</Text>
          </View>
        </View>

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
                <View style={styles.dayCalories}>
                  <Text style={styles.dayCaloriesValue}>{dayGroup.totalCalories}</Text>
                  <Text style={styles.dayCaloriesUnit}> kcal</Text>
                </View>
              </View>

              {dayGroup.entries.map((entry) => (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.entryCard}
                  onLongPress={() => handleDeleteEntry(entry.id)}
                >
                  {entry.photoUrl ? (
                    <Image source={{ uri: entry.photoUrl }} style={styles.entryImage} />
                  ) : (
                    <View style={[styles.entryImage, styles.entryImagePlaceholder]}>
                      <Text style={styles.entryImagePlaceholderText}>🍽️</Text>
                    </View>
                  )}
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryName}>{entry.name}</Text>
                    <Text style={styles.entryTime}>{formatTime(entry.timestamp)}</Text>
                  </View>
                  <Text style={styles.entryCalories}>{entry.calories} kcal</Text>
                </TouchableOpacity>
              ))}
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
