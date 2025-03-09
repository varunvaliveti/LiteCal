import React, { useState, useEffect } from 'react';
import { 
  View, 
  TextInput, 
  StyleSheet, 
  Text, 
  ActivityIndicator,
  TouchableOpacity,
  Image,
  FlatList,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useChat, ChatMessage } from '@/hooks/useChat';
import { addDoc, serverTimestamp } from 'firebase/firestore';
import { messagesRef } from '@/constants/Firebase';
import EventPreview from '@/components/EventPreview';

// Define interface for calendar event data
interface EventData {
  event_title: string;
  start_date: string;
  start_time: string;
  end_date?: string;
  end_time?: string;
  location?: string;
  description?: string;
}

// Define interface for API response with event data
interface CalendarEventResponse {
  message: string;
  is_event: boolean;
  event_data: EventData;
  ics_file?: string;
  requires_clarification?: boolean;
}

// Safe btoa function for React Native
const safeBtoa = (str: string): string => {
  try {
    // First try the standard btoa
    return btoa(str);
  } catch (e) {
    console.log("Standard btoa failed, using custom implementation");
    
    // For React Native, use a more robust base64 implementation
    // This is a more complete base64 encoding implementation
    const base64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let output = '';
    let i = 0;
    
    // Process 3 bytes at a time, and encode them as 4 base64 characters
    while (i < str.length) {
      const a = str.charCodeAt(i++);
      const b = i < str.length ? str.charCodeAt(i++) : 0;
      const c = i < str.length ? str.charCodeAt(i++) : 0;
      
      const trio = (a << 16) | (b << 8) | c;
      
      output += base64chars[(trio >> 18) & 0x3f];
      output += base64chars[(trio >> 12) & 0x3f];
      output += i > str.length + 1 ? '=' : base64chars[(trio >> 6) & 0x3f];
      output += i > str.length ? '=' : base64chars[trio & 0x3f];
    }
    
    console.log("Generated base64 with custom implementation, length:", output.length);
    return output;
  }
};

export default function HomeScreen() {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<string | null>(null);
  const [currentEvent, setCurrentEvent] = useState<{ data: EventData; ics: string } | null>(null);
  const flatListRef = React.useRef<FlatList>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [debugEventInfo, setDebugEventInfo] = useState<string | null>(null);

  const { user, logout, isLoading: authLoading } = useAuth();
  const { messages, sendMessage, loading: chatLoading, error, getContextForRAG } = useChat();
  const router = useRouter();

  // Update with your server's address
  const API_URL = 'http://127.0.0.1:5001/chat';

  // Update current date every minute
  useEffect(() => {
    // Initialize current date
    setCurrentDate(new Date());
    
    // Update current date every minute to ensure it's accurate
    const intervalId = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Check if user is authenticated
  useEffect(() => {
    const checkAuth = () => {
      if (!user) {
        // Use setTimeout to avoid navigation during render
        setTimeout(() => {
          router.replace('/login');
        }, 0);
      }
    };
    
    // Only check after initial loading is complete
    if (!authLoading) {
      checkAuth();
    }
  }, [user, authLoading]);

  // Request permissions when component mounts
  useEffect(() => {
    (async () => {
      await Audio.requestPermissionsAsync();
      await ImagePicker.requestCameraPermissionsAsync();
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    })();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100); // Small delay to ensure the UI has updated
    }
  }, [messages]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current && !chatLoading) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 300); // Slightly longer delay for initial load to ensure messages are rendered
    }
  }, [chatLoading]);

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/login');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Start recording function
  const startRecording = async () => {
    try {
      // If already recording, stop recording
      if (isRecording) {
        await stopRecording();
        return;
      }

      // First make sure any existing recording is stopped and unloaded
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
        } catch (error) {
          // If the recording was already unloaded, just continue
          console.log('Recording was already unloaded');
        }
      }

      // Configure audio mode for recording - required for iOS
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeIOS: 1, // DoNotMix = 1
        interruptionModeAndroid: 1, // DoNotMix = 1
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      // Need to set up the recording object
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  // Stop recording function
  const stopRecording = async () => {
    if (!recording) return;

    try {
      // First set the recording state to false so UI updates immediately
      setIsRecording(false);
      
      try {
        await recording.stopAndUnloadAsync();
      } catch (error) {
        // If the recording was already unloaded, just continue
        console.log('Recording was already unloaded');
      }
      
      const uri = recording.getURI();
      if (!uri) {
        // Clear the recording reference since we can't use it
        setRecording(null);
        return;
      }
      
      // Get the raw data of the recording as base64
      const fileData = await fetch(uri);
      const blob = await fileData.blob();
      
      // Convert to base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = reader.result as string;
        
        // Set audioData state first
        setAudioData(base64data);
        
        // Create a default event that will show immediately
        const today = new Date();
        const hour = today.getHours();
        const endHour = (hour + 1) > 23 ? 23 : (hour + 1);
        
        // Create a temporary event data object
        const tempEventData = {
          event_title: "Calendar Event",
          start_date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
          start_time: `${String(hour).padStart(2, '0')}:00`,
          end_time: `${String(endHour).padStart(2, '0')}:00`,
          location: "None",
          description: "None"
        };
        
        // Generate ICS file for the temporary event
        const icsFile = generateICSFile(tempEventData);
        
        console.log("Creating default calendar event after voice input with ICS file");
        
        // Set the event preview with our temporary data and ICS file
        setCurrentEvent({
          data: tempEventData,
          ics: icsFile // Now we have a proper ICS file
        });
        
        // Now send the audio data to process
        setTimeout(() => {
          handleSendMessage(base64data);
        }, 300);
        
        // Clear the recording reference after we're done with it
        setRecording(null);
      };
    } catch (err) {
      console.error('Failed to stop recording', err);
      // Even if there's an error, we should clear the recording reference
      setRecording(null);
    }
  };

  // Image picker function
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setSelectedImage(base64Image);
    }
  };

  // Camera function
  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setSelectedImage(base64Image);
    }
  };

  // Function to save an AI message to Firestore
  const saveAIResponse = async (text: string, isEvent: boolean = false) => {
    if (!user) return;
    
    try {
      await addDoc(messagesRef, {
        text,
        isUser: false,
        userId: user.uid,
        timestamp: serverTimestamp(),
        isEvent
      });
    } catch (err) {
      console.error("Error saving AI response: ", err);
    }
  };

  // Function to send the message to the API with RAG context
  const handleSendMessage = async (audioDataParam?: string) => {
    // Use either passed audio data or state audio data
    const audioToSend = audioDataParam || audioData;
    
    if (!inputText.trim() && !selectedImage && !audioToSend) return;
    if (!user) return;

    setIsLoading(true);
    
    // Is this a voice message?
    const isVoiceMessage = !!audioToSend && !inputText.trim();
    
    // For text messages (not voice), reset the current event
    if (!isVoiceMessage) {
      setCurrentEvent(null);
    }
    // For voice messages, we keep the existing event preview that was created in stopRecording
    
    try {
      // Get message text
      const messageText = inputText.trim();
      
      // Send message to Firebase
      await sendMessage(
        messageText || "I sent a voice message", 
        selectedImage || undefined, 
        audioToSend ? true : false
      );
      
      // Clear input
      setInputText('');
      
      // Get conversation history for RAG
      const chatHistory = await getContextForRAG();
      
      // Format current date in multiple formats for the LLM to understand context
      const today = currentDate;
      const formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
      const readableDate = today.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      // Prepare data to send to the API
      const data = {
        message: messageText,
        image: selectedImage,
        audio: audioToSend,
        is_voice_message: isVoiceMessage, // Explicitly flag this as a voice message
        extract_calendar_from_voice: isVoiceMessage, // Instruct server to look for calendar in voice
        voice_to_calendar: true, // Signal that voice should be checked for calendar events
        history: chatHistory, // Include RAG context
        user_id: user.uid, // Add user ID for better personalization
        timestamp: new Date().toISOString(), // Add timestamp for better context
        current_date: formattedDate, // Send current date for calendar events
        current_date_readable: readableDate, // Send readable current date
        current_day_of_week: today.toLocaleDateString('en-US', { weekday: 'long' }), // Current day name
        use_12h_format: true // Explicitly request 12-hour time format
      };
      
      // Clear the image and audio after sending
      setSelectedImage(null);
      setAudioData(null);
      
      // Call your API
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('API request failed');
      }
      
      const result = await response.json();
      
      // Comprehensive debugging logs
      console.log('API Response:', JSON.stringify(result));
      console.log('Is voice input:', !!audioToSend);
      
      // Extract calendar information regardless of format
      let eventData = null;
      let icsFile = null;
      let isEvent = false;
      let requiresClarification = false;
      let responseMessage = '';
      
      // Check for event in all possible locations
      if (result.is_event || (result.calendar_event && result.calendar_event.is_event)) {
        isEvent = true;
        responseMessage = result.message || (result.calendar_event ? result.calendar_event.message : "I've detected a calendar event.");
        
        // Get event data from either location
        eventData = result.event_data || (result.calendar_event ? result.calendar_event.event_data : null);
        icsFile = result.ics_file || (result.calendar_event ? result.calendar_event.ics_file : null);
        requiresClarification = result.requires_clarification || (result.calendar_event ? result.calendar_event.requires_clarification : false);
        
        console.log("API returned event data:", JSON.stringify(eventData));
        
        // Format and validate event data
        if (eventData && !requiresClarification) {
          // Ensure proper capitalization in title and location
          if (eventData.event_title) {
            eventData.event_title = capitalizeWords(eventData.event_title);
          }
          
          if (eventData.location) {
            eventData.location = capitalizeWords(eventData.location);
          }
          
          // If no ICS file is provided by the API, generate one with the latest event data
          if (!icsFile) {
            console.log("No ICS file from API, generating one with updated event data");
            icsFile = generateICSFile(eventData);
          } else {
            // Even if ICS is provided, regenerate it to ensure consistency
            console.log("Regenerating ICS file to ensure it matches the event data");
            icsFile = generateICSFile(eventData);
          }
          
          console.log("Updating event with real data from API:", JSON.stringify(eventData));
          console.log("ICS data length:", icsFile ? icsFile.length : 0);
          
          // Update the current event with real data
          setCurrentEvent({
            data: eventData,
            ics: icsFile
          });
        }
      } else {
        // Not a calendar event from API
        responseMessage = result.message || "I've processed your request.";
        
        // If it was a voice message but not detected as an event by the API,
        // keep showing the placeholder event anyway for demonstration purposes
        if (isVoiceMessage && currentEvent) {
          console.log("Voice input, keeping calendar event preview even though API didn't return event data");
          // Keep existing event preview
        } else {
          // Clear the event for non-voice messages
          setCurrentEvent(null);
        }
      }
      
      // Save the event response to Firebase
      await saveAIResponse(responseMessage, isEvent);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Save a friendly error message to chat
      await saveAIResponse("I'm sorry, I'm having trouble processing your request right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper function to capitalize words properly
  const capitalizeWords = (text: string): string => {
    if (!text) return '';
    
    // Words that should not be capitalized unless they are the first or last word
    const minorWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of'];
    
    return text.split(' ').map((word, index, array) => {
      // Always capitalize first and last words
      if (index === 0 || index === array.length - 1) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      
      // Check for minor words
      if (minorWords.includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      
      // Capitalize other words
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  };

  // Render each message in the chat
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    return (
      <View style={[
        styles.messageBubble, 
        item.isUser ? styles.userMessage : styles.aiMessage
      ]}>
        {item.image && (
          <Image source={{ uri: item.image }} style={styles.messageImage} />
        )}
        <ThemedText style={styles.messageText}>{item.text}</ThemedText>
      </View>
    );
  };

  // Function to generate a basic ICS file
  const generateICSFile = (eventData: any): string => {
    try {
      console.log("Generating ICS file with data:", JSON.stringify(eventData));
      
      // Get current timestamp for UID
      const timestamp = new Date().getTime();
      const uid = `event-${timestamp}@litecal.app`;
      
      // Convert date and time strings to Date objects
      const startDateParts = eventData.start_date.split('-').map((n: string) => parseInt(n, 10));
      const startTimeParts = eventData.start_time.split(':').map((n: string) => parseInt(n, 10));
      
      // Create date objects with explicit parts to avoid timezone issues
      const startDate = new Date();
      startDate.setFullYear(startDateParts[0], startDateParts[1] - 1, startDateParts[2]);
      startDate.setHours(startTimeParts[0], startTimeParts[1], 0, 0);
      
      let endDate = new Date();
      if (eventData.end_date && eventData.end_time) {
        // If we have both end date and time
        const endDateParts = eventData.end_date.split('-').map((n: string) => parseInt(n, 10));
        const endTimeParts = eventData.end_time.split(':').map((n: string) => parseInt(n, 10));
        
        endDate.setFullYear(endDateParts[0], endDateParts[1] - 1, endDateParts[2]);
        endDate.setHours(endTimeParts[0], endTimeParts[1], 0, 0);
      } else if (eventData.end_time) {
        // If we only have end time but not end date, use same date as start
        const endTimeParts = eventData.end_time.split(':').map((n: string) => parseInt(n, 10));
        
        endDate.setFullYear(startDateParts[0], startDateParts[1] - 1, startDateParts[2]);
        endDate.setHours(endTimeParts[0], endTimeParts[1], 0, 0);
      } else {
        // Default to 1 hour event
        endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      }
      
      console.log("ICS Start Date:", startDate.toISOString());
      console.log("ICS End Date:", endDate.toISOString());
      
      // Format dates for ICS
      const formatDateForICS = (date: Date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        
        // Note: We use 'Z' to indicate UTC time - this ensures consistent timezone handling
        return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
      };
      
      const startDateFormatted = formatDateForICS(startDate);
      const endDateFormatted = formatDateForICS(endDate);
      
      // Ensure proper formatting of fields for ICS
      const formatICSValue = (value: string | undefined): string => {
        if (!value || value === 'None' || value === 'Not specified') return '';
        // Replace any linebreaks with proper ICS line breaks and escaping
        return value.replace(/\n/g, '\\n').replace(/,/g, '\\,');
      };
      
      const summary = formatICSValue(eventData.event_title) || 'Calendar Event';
      const location = formatICSValue(eventData.location);
      const description = formatICSValue(eventData.description);
      
      // Build ICS content
      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//LiteCal//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${startDateFormatted}`,
        `DTSTART:${startDateFormatted}`,
        `DTEND:${endDateFormatted}`,
        `SUMMARY:${summary}`,
        location ? `LOCATION:${location}` : '',
        description ? `DESCRIPTION:${description}` : '',
        'END:VEVENT',
        'END:VCALENDAR'
      ].filter(Boolean).join('\r\n');
      
      console.log("Generated ICS content:", icsContent);
      
      // Base64 encode the ICS content
      return safeBtoa(icsContent);
    } catch (error) {
      console.error('Error generating ICS file:', error);
      // Return a simple default ICS in case of errors
      return safeBtoa('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nSUMMARY:Calendar Event\r\nEND:VEVENT\r\nEND:VCALENDAR');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>LiteCal</ThemedText>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <FontAwesome name="sign-out" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={10}
      >
        {/* Current calendar event preview - placed at the top of messages for better visibility */}
        {currentEvent && currentEvent.data && (
          <View style={styles.eventPreviewContainer}>
            <EventPreview 
              eventData={currentEvent.data} 
              icsFile={currentEvent.ics} 
            />
          </View>
        )}
        
        {/* Message list */}
        {chatLoading && messages.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4a6fff" />
            <Text style={styles.loadingText}>Loading conversations...</Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id || Math.random().toString()}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            ref={flatListRef}
          />
        )}
        
        {/* Loading indicator */}
        {isLoading && (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="large" color="#4a6fff" />
          </View>
        )}
        
        {/* Selected image preview */}
        {selectedImage && (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
            <TouchableOpacity 
              style={styles.removeImageButton}
              onPress={() => setSelectedImage(null)}
            >
              <FontAwesome name="times-circle" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        
        {/* Input area */}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
            <FontAwesome name="image" size={20} color="#4a6fff" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
            <FontAwesome name="camera" size={20} color="#4a6fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.mediaButton}
            onPress={startRecording}
          >
            <FontAwesome 
              name="microphone" 
              size={20} 
              color={isRecording ? "#ff4a4a" : "#4a6fff"} 
            />
          </TouchableOpacity>
          
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message or an event to add to calendar..."
            placeholderTextColor="#888"
            multiline
            editable={!isRecording} // Disable text input during recording
          />
          
          <TouchableOpacity 
            style={[
              styles.sendButton, 
              isRecording ? styles.recordButton : (!inputText.trim() && !selectedImage && !audioData) ? styles.disabledButton : null
            ]}
            onPress={isRecording ? stopRecording : () => handleSendMessage()}
            disabled={!isRecording && !inputText.trim() && !selectedImage && !audioData || isLoading}
          >
            <FontAwesome 
              name={isRecording ? "stop-circle" : "send"} 
              size={20} 
              color="#fff" 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    paddingTop: 50,
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  logoutButton: {
    padding: 8,
  },
  chatContainer: {
    flex: 1,
    padding: 10,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 18,
    marginVertical: 5,
    marginHorizontal: 10,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007aff',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#A9A9A9',
  },
  messageText: {
    fontSize: 16,
  },
  messageImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#888',
  },
  loadingIndicator: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  imagePreviewContainer: {
    margin: 10,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  imagePreview: {
    width: 150,
    height: 150,
    borderRadius: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 5,
  },
  mediaButton: {
    padding: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginHorizontal: 5,
    maxHeight: 100,
    color: '#000',
  },
  sendButton: {
    width: 40,
    height: 40,
    backgroundColor: '#4a6fff',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#666',
  },
  recordButton: {
    backgroundColor: '#ff4a4a',
  },
  eventPreviewContainer: {
    margin: 10,
    marginTop: 20,
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    width: '95%',
    alignSelf: 'center',
    zIndex: 100,
  },
  debugContainer: {
    margin: 10,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
});