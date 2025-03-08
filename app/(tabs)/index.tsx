import React, { useState, useEffect } from 'react';
import { 
  View, 
  TextInput, 
  StyleSheet, 
  Text, 
  ActivityIndicator,
  TouchableOpacity,
  Image,
  FlatList
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

export default function HomeScreen() {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<string | null>(null);

  const { user, logout, isLoading: authLoading } = useAuth();
  const { messages, sendMessage, loading: chatLoading, error, getContextForRAG } = useChat();
  const router = useRouter();

  // Update with your server's address
  const API_URL = 'http://127.0.0.1:5001/chat';

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
      // First make sure any existing recording is stopped and unloaded
      if (recording) {
        await recording.stopAndUnloadAsync();
      }

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
      await recording.stopAndUnloadAsync();
      setIsRecording(false);
      
      const uri = recording.getURI();
      if (!uri) return;
      
      // Get the raw data of the recording as base64
      const fileData = await fetch(uri);
      const blob = await fileData.blob();
      
      // Convert to base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = reader.result as string;
        setAudioData(base64data);
      };
    } catch (err) {
      console.error('Failed to stop recording', err);
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

  // Function to send the message to the API with RAG context
  const handleSendMessage = async () => {
    if (!inputText.trim() && !selectedImage && !audioData) return;
    if (!user) return;

    setIsLoading(true);
    
    try {
      // Get message text
      const messageText = inputText.trim();
      
      // Send message to Firebase
      await sendMessage(
        messageText || "I sent a file", 
        selectedImage || undefined, 
        audioData ? true : false
      );
      
      // Clear input
      setInputText('');
      
      // Get conversation history for RAG
      const chatHistory = await getContextForRAG();
      
      // Prepare data to send to the API
      const data = {
        message: messageText,
        image: selectedImage,
        audio: audioData,
        history: chatHistory // Include RAG context
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
      
      // Save the AI's response to Firebase
      if (user) {
        await addDoc(messagesRef, {
          text: result.message,
          isUser: false,
          userId: user.uid,
          timestamp: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Don't add error message to Firebase, just show temporarily
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);
    } finally {
      setIsLoading(false);
    }
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

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>LiteCal</ThemedText>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <FontAwesome name="sign-out" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
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
          onPressIn={startRecording}
          onPressOut={stopRecording}
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
          placeholder="Type a message..."
          placeholderTextColor="#888"
          multiline
        />
        
        <TouchableOpacity 
          style={[styles.sendButton, (!inputText.trim() && !selectedImage && !audioData) ? styles.disabledButton : null]}
          onPress={handleSendMessage}
          disabled={!inputText.trim() && !selectedImage && !audioData || isLoading}
        >
          <FontAwesome name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
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
    backgroundColor: '#4a6fff',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#303030',
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
    marginBottom: 20,
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
    color: '#fff',
  },
  sendButton: {
    backgroundColor: '#4a6fff',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#666',
  },
});