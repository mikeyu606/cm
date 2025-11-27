export interface FoodEntry {
  id: string;
  userId: string;
  name: string;
  calories: number;
  photoUrl?: string;
  timestamp: Date;
  notes?: string;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD format
  totalCalories: number;
  entries: FoodEntry[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  dailyGoal: number;
  createdAt: Date;
}



