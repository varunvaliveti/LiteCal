import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';

const ENCRYPTION_KEY_STORAGE = 'LITECAL_ENCRYPTION_KEY';
const DEFAULT_KEY = 'default-key-must-be-changed-in-production'; // Fallback only

/**
 * Encryption utility for LiteCal
 * Provides methods to encrypt and decrypt data before storing to/retrieving from Firebase
 */
export class EncryptionService {
  private static instance: EncryptionService;
  private encryptionKey: string | null = null;
  
  private constructor() {
    // Private constructor for singleton pattern
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Initialize encryption service and load or generate encryption key
   */
  public async initialize(): Promise<void> {
    try {
      // Try to retrieve existing key from secure storage
      let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE);
      
      if (!key) {
        // Generate a new random key if none exists
        key = CryptoJS.lib.WordArray.random(256/8).toString();
        // Save it to secure storage
        await SecureStore.setItemAsync(ENCRYPTION_KEY_STORAGE, key);
      }
      
      this.encryptionKey = key;
    } catch (error) {
      console.warn('Failed to initialize encryption properly, using fallback key:', error);
      this.encryptionKey = DEFAULT_KEY;
    }
  }

  /**
   * Get current encryption key or fallback to default
   */
  private getKey(): string {
    return this.encryptionKey || DEFAULT_KEY;
  }

  /**
   * Encrypt data before storing in Firebase
   */
  public encrypt(data: any): string {
    if (!data) return '';
    
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    return CryptoJS.AES.encrypt(dataStr, this.getKey()).toString();
  }

  /**
   * Decrypt data retrieved from Firebase
   */
  public decrypt(encryptedData: string): any {
    if (!encryptedData) return null;
    
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.getKey());
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      
      // Try to parse as JSON first
      try {
        return JSON.parse(decryptedString);
      } catch (e) {
        // If not valid JSON, return as string
        return decryptedString;
      }
    } catch (error) {
      console.error('Failed to decrypt data:', error);
      return null;
    }
  }

  /**
   * Encrypt a specific message for chat
   */
  public encryptMessage(message: any): { encrypted: string, isEncrypted: boolean } {
    try {
      return {
        encrypted: this.encrypt(message),
        isEncrypted: true
      };
    } catch (error) {
      console.error('Failed to encrypt message:', error);
      return {
        encrypted: typeof message === 'string' ? message : JSON.stringify(message),
        isEncrypted: false
      };
    }
  }

  /**
   * Decrypt a message from chat
   */
  public decryptMessage(message: { encrypted: string, isEncrypted: boolean }): any {
    if (!message.isEncrypted) {
      return message.encrypted;
    }
    
    try {
      return this.decrypt(message.encrypted);
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      return message.encrypted;
    }
  }
} 