import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendChatMessage, AIMode } from '../config/openai';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ModeConfig {
  name: string;
  subtitle: string;
  icon: string;
  avatarBg: string;
  accentColor: string;
  greeting: string;
  quickPrompts: Array<{ text: string }>;
}

const MODE_CONFIGS: Record<AIMode, ModeConfig> = {
  doctor: {
    name: 'Dr. AIVA',
    subtitle: 'Your health advisor',
    icon: 'medkit',
    avatarBg: '#E3F2FD',
    accentColor: '#1976D2',
    greeting: "Hello! I'm Dr. AIVA, your personal health advisor.\n\nI can help you with health concerns, symptoms, wellness tips, and medical information. How can I assist you today?",
    quickPrompts: [
      { text: 'Symptom check' },
      { text: 'Medication info' },
      { text: 'Heart health' },
    ],
  },
  fitness: {
    name: 'AIVA Fitness',
    subtitle: 'Your fitness coach',
    icon: 'fitness',
    avatarBg: '#E8F5E9',
    accentColor: '#2E7D32',
    greeting: "Hi! I'm AIVA, your personal fitness coach.\n\nI can help you with workouts, nutrition for performance, muscle building, and reaching your fitness goals. What would you like to work on?",
    quickPrompts: [
      { text: 'Workout plan' },
      { text: 'Protein goals' },
      { text: 'Burn fat tips' },
    ],
  },
};

interface ModeState {
  messages: Message[];
  chatHistory: ChatHistoryMessage[];
}

export default function AIChatScreen() {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [mode, setMode] = useState<AIMode>('fitness');
  const [showModeSelector, setShowModeSelector] = useState(false);
  const config = MODE_CONFIGS[mode];
  
  // Store messages and history per mode
  const [modeStates, setModeStates] = useState<Record<AIMode, ModeState>>({
    doctor: {
      messages: [{ id: '1', text: MODE_CONFIGS.doctor.greeting, isUser: false, timestamp: new Date() }],
      chatHistory: [],
    },
    fitness: {
      messages: [{ id: '2', text: MODE_CONFIGS.fitness.greeting, isUser: false, timestamp: new Date() }],
      chatHistory: [],
    },
  });
  
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Get current mode's messages and history
  const messages = modeStates[mode].messages;
  const chatHistory = modeStates[mode].chatHistory;
  
  const setMessages = (updater: Message[] | ((prev: Message[]) => Message[])) => {
    setModeStates(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        messages: typeof updater === 'function' ? updater(prev[mode].messages) : updater,
      },
    }));
  };
  
  const setChatHistory = (updater: ChatHistoryMessage[] | ((prev: ChatHistoryMessage[]) => ChatHistoryMessage[])) => {
    setModeStates(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        chatHistory: typeof updater === 'function' ? updater(prev[mode].chatHistory) : updater,
      },
    }));
  };

  const switchMode = (newMode: AIMode) => {
    setMode(newMode);
    setShowModeSelector(false);
    // Messages are preserved per mode - no need to reset
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      // Call OpenAI API
      const response = await sendChatMessage(text.trim(), mode, chatHistory);
      
      // Update chat history with the new exchange
      setChatHistory(prev => [
        ...prev,
        { role: 'user', content: text.trim() },
        { role: 'assistant', content: response },
      ]);

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      Alert.alert(
        'Connection Error',
        'Failed to get a response. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I couldn't process that request. Please try again.",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Mode Selector Modal */}
      <Modal
        visible={showModeSelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModeSelector(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowModeSelector(false)}
        >
          <View style={styles.modeSelectorModal}>
            <Text style={styles.modeSelectorTitle}>Switch Modes</Text>
            
            <TouchableOpacity
              style={[
                styles.modeOption,
                mode === 'doctor' && styles.modeOptionActive,
                mode === 'doctor' && { borderColor: MODE_CONFIGS.doctor.accentColor },
              ]}
              onPress={() => switchMode('doctor')}
            >
              <View style={[styles.modeOptionAvatar, { backgroundColor: MODE_CONFIGS.doctor.avatarBg }]}>
                <Ionicons name={MODE_CONFIGS.doctor.icon as any} size={24} color={MODE_CONFIGS.doctor.accentColor} />
              </View>
              <View style={styles.modeOptionInfo}>
                <Text style={styles.modeOptionName}>{MODE_CONFIGS.doctor.name}</Text>
                <Text style={styles.modeOptionDesc}>{MODE_CONFIGS.doctor.subtitle}</Text>
              </View>
              {mode === 'doctor' && (
                <Ionicons name="checkmark-circle" size={24} color={MODE_CONFIGS.doctor.accentColor} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeOption,
                mode === 'fitness' && styles.modeOptionActive,
                mode === 'fitness' && { borderColor: MODE_CONFIGS.fitness.accentColor },
              ]}
              onPress={() => switchMode('fitness')}
            >
              <View style={[styles.modeOptionAvatar, { backgroundColor: MODE_CONFIGS.fitness.avatarBg }]}>
                <Ionicons name={MODE_CONFIGS.fitness.icon as any} size={24} color={MODE_CONFIGS.fitness.accentColor} />
              </View>
              <View style={styles.modeOptionInfo}>
                <Text style={styles.modeOptionName}>{MODE_CONFIGS.fitness.name}</Text>
                <Text style={styles.modeOptionDesc}>{MODE_CONFIGS.fitness.subtitle}</Text>
              </View>
              {mode === 'fitness' && (
                <Ionicons name="checkmark-circle" size={24} color={MODE_CONFIGS.fitness.accentColor} />
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerLeft} onPress={() => setShowModeSelector(true)}>
          <View style={[styles.aiAvatar, { backgroundColor: config.avatarBg }]}>
            <Ionicons name={config.icon as any} size={20} color={config.accentColor} />
          </View>
          <View>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>{config.name}</Text>
              <Ionicons name="chevron-down" size={16} color="#8E8E93" style={{ marginLeft: 4 }} />
            </View>
            <Text style={styles.headerSubtitle}>{config.subtitle}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton} onPress={() => setShowModeSelector(true)}>
          <Ionicons name="swap-horizontal" size={24} color={config.accentColor} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.isUser ? styles.userBubble : styles.aiBubble,
            ]}
          >
            {!message.isUser && (
              <View style={[styles.aiMessageAvatar, { backgroundColor: config.avatarBg }]}>
                <Ionicons name={config.icon as any} size={16} color={config.accentColor} />
              </View>
            )}
            <View style={[
              styles.messageContent,
              message.isUser ? styles.userMessageContent : styles.aiMessageContent,
            ]}>
              <Text style={[
                styles.messageText,
                message.isUser ? styles.userMessageText : styles.aiMessageText,
              ]}>
                {message.text}
              </Text>
            </View>
          </View>
        ))}
        
        {isTyping && (
          <View style={[styles.messageBubble, styles.aiBubble]}>
            <View style={[styles.aiMessageAvatar, { backgroundColor: config.avatarBg }]}>
              <Ionicons name={config.icon as any} size={16} color={config.accentColor} />
            </View>
            <View style={[styles.messageContent, styles.aiMessageContent, styles.typingBubble]}>
              <View style={styles.typingDots}>
                <View style={[styles.dot, styles.dot1]} />
                <View style={[styles.dot, styles.dot2]} />
                <View style={[styles.dot, styles.dot3]} />
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Quick Actions - Only show when few messages */}
      {messages.length <= 2 && (
        <View style={styles.quickActions}>
          {config.quickPrompts.map((prompt, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.quickActionButton, { borderColor: config.accentColor + '40' }]}
              onPress={() => sendMessage(prompt.text)}
            >
              <Text style={[styles.quickActionText, { color: config.accentColor }]}>{prompt.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Input Area - Grok style */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.inputArea, { paddingBottom: Math.max(insets.bottom - 40, 8) }]}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask anything"
              placeholderTextColor="#8E8E93"
              multiline
              maxLength={500}
            />
            <View style={styles.inputActions}>
              <TouchableOpacity style={styles.attachButton}>
                <Ionicons name="attach" size={22} color="#8E8E93" />
              </TouchableOpacity>
              {inputText.trim() ? (
                <TouchableOpacity
                  style={styles.sendButton}
                  onPress={() => sendMessage(inputText)}
                  disabled={isTyping}
                >
                  <Ionicons name="arrow-up" size={18} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.speakButton}>
                  <Ionicons name="mic" size={18} color="#fff" />
                  <Text style={styles.speakText}>Speak</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5E5',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modeSelectorModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modeSelectorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
    textAlign: 'center',
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    marginBottom: 12,
  },
  modeOptionActive: {
    backgroundColor: '#F8F9FA',
  },
  modeOptionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  modeOptionInfo: {
    flex: 1,
  },
  modeOptionName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  modeOptionDesc: {
    fontSize: 14,
    color: '#8E8E93',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  aiBubble: {
    alignSelf: 'flex-start',
  },
  aiMessageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 4,
  },
  messageContent: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '100%',
  },
  userMessageContent: {
    backgroundColor: '#1A1A2E',
    borderBottomRightRadius: 4,
  },
  aiMessageContent: {
    backgroundColor: '#F2F2F7',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  aiMessageText: {
    color: '#000',
  },
  typingBubble: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8E8E93',
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.6,
  },
  dot3: {
    opacity: 0.8,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  inputArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: '#fff',
    borderTopWidth: 0.5,
    borderTopColor: '#E5E5E5',
  },
  inputContainer: {
    backgroundColor: '#F2F2F7',
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 56,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: '#000',
    maxHeight: 120,
    paddingTop: 4,
    paddingBottom: 4,
    lineHeight: 22,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  attachButton: {
    padding: 4,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speakButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
  },
  speakText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
