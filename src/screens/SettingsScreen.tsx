import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { user, userProfile, logout, updateDailyGoal } = useAuth();
  const insets = useSafeAreaInsets();
  const [goalInput, setGoalInput] = useState(userProfile?.dailyGoal?.toString() || '2000');
  const [saving, setSaving] = useState(false);

  const handleUpdateGoal = async () => {
    const newGoal = parseInt(goalInput);
    if (isNaN(newGoal) || newGoal < 500 || newGoal > 10000) {
      Alert.alert('Invalid Goal', 'Please enter a value between 500 and 10,000 kcal');
      return;
    }

    setSaving(true);
    try {
      await updateDailyGoal(newGoal);
      Alert.alert('Success', 'Daily calorie goal updated!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update goal');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 10) + 70 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.card}>
            <View style={styles.profileItem}>
              <Text style={styles.profileLabel}>Name</Text>
              <Text style={styles.profileValue}>
                {userProfile?.displayName || 'Not set'}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.profileItem}>
              <Text style={styles.profileLabel}>Email</Text>
              <Text style={styles.profileValue}>{user?.email}</Text>
            </View>
          </View>
        </View>

        {/* Daily Goal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Calorie Goal</Text>
          <View style={styles.card}>
            <View style={styles.goalContainer}>
              <TextInput
                style={styles.goalInput}
                value={goalInput}
                onChangeText={setGoalInput}
                keyboardType="numeric"
                placeholder="2000"
                placeholderTextColor="#999"
              />
              <Text style={styles.goalUnit}>kcal</Text>
            </View>
            <TouchableOpacity
              style={[styles.updateButton, saving && styles.updateButtonDisabled]}
              onPress={handleUpdateGoal}
              disabled={saving}
            >
              <Text style={styles.updateButtonText}>
                {saving ? 'Saving...' : 'Update Goal'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Preset Goals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Presets</Text>
          <View style={styles.presetsContainer}>
            {[
              { label: 'Weight Loss', cal: '1500', emoji: '🏃' },
              { label: 'Maintain', cal: '2000', emoji: '⚖️' },
              { label: 'Muscle Gain', cal: '2500', emoji: '💪' },
              { label: 'Bulk', cal: '3000', emoji: '🏋️' },
            ].map((preset) => (
              <TouchableOpacity
                key={preset.label}
                style={[
                  styles.presetCard,
                  goalInput === preset.cal && styles.presetCardActive,
                ]}
                onPress={() => setGoalInput(preset.cal)}
              >
                <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                <Text style={[
                  styles.presetLabel,
                  goalInput === preset.cal && styles.presetLabelActive,
                ]}>
                  {preset.label}
                </Text>
                <Text style={[
                  styles.presetCal,
                  goalInput === preset.cal && styles.presetCalActive,
                ]}>
                  {preset.cal} kcal
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <View style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>App Version</Text>
              <Text style={styles.aboutValue}>1.0.0</Text>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 0,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  profileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  profileLabel: {
    fontSize: 15,
    color: '#888',
  },
  profileValue: {
    fontSize: 15,
    color: '#1A1A2E',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 8,
  },
  goalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  goalInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: '700',
    color: '#F97316',
    textAlign: 'center',
  },
  goalUnit: {
    fontSize: 18,
    color: '#888',
    marginLeft: 12,
    fontWeight: '600',
  },
  updateButton: {
    backgroundColor: '#F97316',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  updateButtonDisabled: {
    opacity: 0.7,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  presetCardActive: {
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: '#F97316',
  },
  presetEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  presetLabel: {
    fontSize: 14,
    color: '#1A1A2E',
    fontWeight: '600',
    marginBottom: 2,
  },
  presetLabelActive: {
    color: '#F97316',
  },
  presetCal: {
    fontSize: 13,
    color: '#888',
  },
  presetCalActive: {
    color: '#F97316',
  },
  aboutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  aboutLabel: {
    fontSize: 15,
    color: '#888',
  },
  aboutValue: {
    fontSize: 15,
    color: '#1A1A2E',
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EF4444',
    marginTop: 8,
  },
  logoutButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '700',
  },
});
