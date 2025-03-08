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
      // Get more messages for better context (increased from 10 to 20)
      const q = query(
        messagesRef,
        where("userId", "==", user.uid),
        orderBy("timestamp", "desc"),
        limit(20)
      );
      
      const querySnapshot = await getDocs(q);
      const messages: ChatMessage[] = [];
      
      querySnapshot.forEach((doc) => {
        messages.push({
          id: doc.id,
          ...doc.data() as Omit<ChatMessage, 'id'>
        });
      });
      
      // Sort by timestamp (oldest first for proper conversation flow)
      messages.sort((a, b) => {
        if (!a.timestamp || !b.timestamp) return 0;
        return a.timestamp.seconds - b.timestamp.seconds;
      });
      
      // Format context string with better structure and conversation delineation
      let contextString = "### Previous Conversation History ###\n\n";
      
      // Group messages by conversation based on timestamp proximity
      let currentConversation: ChatMessage[] = [];
      let conversationIndex = 1;
      
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const nextMessage = messages[i + 1];
        
        currentConversation.push(message);
        
        // Check if this is the end of a conversation (large time gap or last message)
        const isEndOfConversation = 
          !nextMessage || 
          (nextMessage.timestamp && message.timestamp && 
           nextMessage.timestamp.seconds - message.timestamp.seconds > 300); // 5 minute gap
        
        if (isEndOfConversation && currentConversation.length > 0) {
          contextString += `Conversation ${conversationIndex}:\n`;
          
          currentConversation.forEach(msg => {
            const role = msg.isUser ? "User" : "Assistant";
            contextString += `${role}: ${msg.text}\n`;
          });
          
          contextString += "\n---\n\n";
          currentConversation = [];
          conversationIndex++;
        }
      }
      
      contextString += "### End of Previous Conversations ###\n";
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