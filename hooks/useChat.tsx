import { useState, useEffect, useCallback } from 'react';
import { 
  addDoc, 
  getDocs, 
  serverTimestamp, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';
import { messagesRef, db } from '@/constants/Firebase';
import { useAuth } from './useAuth';

// Define message type
export interface ChatMessage {
  id?: string;  // Firestore document ID
  text: string;
  isUser: boolean;
  userId: string;
  timestamp: any;
  image?: string; // Base64 image data
  audioProcessed?: boolean; // Whether this message came from audio
  isEvent?: boolean; // Whether this message is a calendar event
}

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (text: string, image?: string, audioProcessed?: boolean) => Promise<void>;
  loading: boolean;
  error: string | null;
  getContextForRAG: () => Promise<string>;
}

export const useChat = (): UseChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Subscribe to messages for the current user
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    
    const q = query(
      messagesRef,
      where("userId", "==", user.uid),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const messageList: ChatMessage[] = [];
      querySnapshot.forEach((doc) => {
        messageList.push({
          id: doc.id,
          ...doc.data() as Omit<ChatMessage, 'id'>
        });
      });

      // Sort by timestamp (newest messages at the bottom)
      messageList.sort((a, b) => {
        if (!a.timestamp || !b.timestamp) return 0;
        return a.timestamp.seconds - b.timestamp.seconds;
      });

      setMessages(messageList);
      setLoading(false);
    }, (err) => {
      console.error("Error getting messages: ", err);
      setError("Failed to load chat history");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Send a message and save to Firestore
  const sendMessage = useCallback(
    async (text: string, image?: string, audioProcessed = false) => {
      if (!user) return;
      
      try {
        const newMessage: Omit<ChatMessage, 'id'> = {
          text,
          isUser: true,
          userId: user.uid,
          timestamp: serverTimestamp(),
          audioProcessed,
        };
        
        if (image) {
          newMessage.image = image;
        }
        
        // Add to Firestore
        await addDoc(messagesRef, newMessage);
      } catch (err) {
        console.error("Error sending message: ", err);
        setError("Failed to send message");
      }
    },
    [user]
  );

  // Save AI response to Firestore
  const saveAIResponse = useCallback(
    async (text: string) => {
      if (!user) return;
      
      try {
        const aiMessage: Omit<ChatMessage, 'id'> = {
          text,
          isUser: false,
          userId: user.uid,
          timestamp: serverTimestamp(),
        };
        
        // Add to Firestore
        await addDoc(messagesRef, aiMessage);
      } catch (err) {
        console.error("Error saving AI response: ", err);
      }
    },
    [user]
  );

  // Get past conversations for RAG context
  const getContextForRAG = useCallback(async (): Promise<string> => {
    if (!user) return "";
    
    try {
      const q = query(
        messagesRef,
        where("userId", "==", user.uid),
        orderBy("timestamp", "desc"),
        limit(10)
      );
      
      const querySnapshot = await getDocs(q);
      
      // Format context string - most recent messages first
      let contextString = "--- Previous conversation history ---\n";
      
      querySnapshot.forEach((doc) => {
        const message = doc.data() as ChatMessage;
        const role = message.isUser ? "User" : "Assistant";
        contextString += `${role}: ${message.text}\n`;
      });
      
      contextString += "--- End of previous conversations ---\n";
      return contextString;
    } catch (err) {
      console.error("Error getting chat context: ", err);
      return "";
    }
  }, [user]);

  return {
    messages,
    sendMessage,
    loading,
    error,
    getContextForRAG,
  };
}; 