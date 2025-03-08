import React, { useState, useEffect } from 'react';
import { 
  View, 
  TextInput, 
  Button, 
  FlatList, 
  StyleSheet, 
  Text, 
  ActivityIndicator,
  TouchableOpacity,
  Image
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { FontAwesome } from '@expo/vector-icons';

// Define types for our message items
interface Message {
  text: string;
  isUser: boolean;
  image?: string; // Base64 image data
}

export default function HomeScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<string | null>(null);

  // Update with your server's address
  const API_URL = 'http://127.0.0.1:5001/chat';

  // Request permissions when component mounts
  useEffect(() => {
    (async () => {
      await Audio.requestPermissionsAsync();
      await ImagePicker.requestCameraPermissionsAsync();
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    })();
  }, []);

  // Start recording function
  const startRecording = async () => {
    try {
      // First make sure any existing recording is stopped and unloaded
      if (recording) {
        await recording.stopAndUnloadAsync();
        setRecording(null);
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };
  
  const stopRecording = async () => {
    if (!recording) return;
    
    setIsRecording(false);
    
    try {
      await recording.stopAndUnloadAsync();
      
      const uri = recording.getURI();
      setRecording(null);
      
      if (uri) {
        // Set a loading message
        setInputText("Processing your voice message...");
        
        // Convert audio file to base64
        const response = await fetch(uri);
        const blob = await response.blob();
        
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result;
            // Store the audio data to send with the next message
            setAudioData(base64data as string);
            setInputText("Voice message ready to send...");
            resolve(base64data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      setInputText("Error processing voice. Please try again.");
    }
  };

  // Pick image function
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      setSelectedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  // Take photo function
  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      setSelectedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  // Clear selected image
  const clearImage = () => {
    setSelectedImage(null);
  };

  // Send message function
  const handleSend = async () => {
    if (isRecording && recording) {
      await stopRecording();
    }


    if ((inputText.trim() || selectedImage || audioData) && !isLoading) {
      // Add user message to chat
      const userMessage = { 
        text: inputText || "I sent a voice message", 
        isUser: true,
        image: selectedImage || undefined
      };
      
      setMessages(currentMessages => [...currentMessages, userMessage]);
      setInputText('');
      setSelectedImage(null);
      setIsLoading(true);
      
      try {
        // Prepare request body
        const requestBody: any = { message: userMessage.text };
        if (userMessage.image) {
          requestBody.image = userMessage.image;
        }
        if (audioData) {
          requestBody.audio = audioData;
          // Clear audio data after sending
          setAudioData(null);
        }
        
        // Send request to Python backend
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Something went wrong');
        }
        
        // Add AI response to chat
        setMessages(currentMessages => [
          ...currentMessages, 
          { text: data.message, isUser: false }
        ]);
      } catch (error) {
        console.error('Error:', error);
        // Show error message in chat
        setMessages(currentMessages => [
          ...currentMessages, 
          { text: "Sorry, I couldn't process that request. Please try again.", isUser: false }
        ]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const renderItem = ({ item }: { item: Message }) => (
    <View style={[styles.messageBubble, item.isUser ? styles.userBubble : styles.aiBubble]}>
      {item.image && (
        <Image 
          source={{ uri: item.image }} 
          style={styles.messageImage} 
          resizeMode="cover"
        />
      )}
      <ThemedText style={[styles.messageText, item.isUser ? styles.userText : styles.aiText]}>
        {item.text}
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText style={styles.headerText}>LyteCal Assistant</ThemedText>
      </ThemedView>
      
      <FlatList
        data={messages}
        renderItem={renderItem}
        keyExtractor={(_, index) => index.toString()}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
      />
      
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      )}
      
      {selectedImage && (
        <View style={styles.selectedImageContainer}>
          <Image source={{ uri: selectedImage }} style={styles.selectedImagePreview} />
          <TouchableOpacity style={styles.clearImageButton} onPress={clearImage}>
            <FontAwesome name="times-circle" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.inputContainer}>
        <View style={styles.mediaButtons}>
          <TouchableOpacity onPress={pickImage} style={styles.mediaButton}>
            <FontAwesome name="photo" size={20} color="#007AFF" />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={takePhoto} style={styles.mediaButton}>
            <FontAwesome name="camera" size={20} color="#007AFF" />
          </TouchableOpacity>
          
          <TouchableOpacity 
  onPress={isRecording ? stopRecording : startRecording}
  style={[styles.mediaButton, isRecording && styles.recordingButton]}
>
  <FontAwesome name="microphone" size={20} color={isRecording ? "#FF3B30" : "#007AFF"} />
</TouchableOpacity>
        </View>
        
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type an event to add to calendar..."
          placeholderTextColor="#999"
          returnKeyType="send"
          onSubmitEditing={handleSend}
          editable={!isLoading}
        />
        
        <Button title="Send" onPress={handleSend} disabled={isLoading} />
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
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '500',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingVertical: 15,
  },
  loadingContainer: {
    padding: 10,
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  input: {
    flex: 1,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 20,
    padding: 10,
    marginRight: 10,
  },
  messageBubble: {
    padding: 10,
    borderRadius: 20,
    marginVertical: 5,
    marginHorizontal: 10,
    maxWidth: '80%',
  },
  userBubble: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
  },
  aiBubble: {
    backgroundColor: '#E5E5EA',
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 16,
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: '#000',
  },
  mediaButtons: {
    flexDirection: 'row',
    marginRight: 10,
  },
  mediaButton: {
    padding: 8,
    marginRight: 5,
  },
  recordingButton: {
    backgroundColor: '#FFEBE9',
    borderRadius: 20,
  },
  messageImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  selectedImageContainer: {
    marginHorizontal: 10,
    marginBottom: 10,
    position: 'relative',
  },
  selectedImagePreview: {
    width: '100%',
    height: 150,
    borderRadius: 12,
  },
  clearImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
    padding: 4,
  },
});