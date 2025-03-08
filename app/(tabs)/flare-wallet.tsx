import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import FlareNetworkService from '../../services/FlareNetworkService';

export default function FlareWalletScreen() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [networkType, setNetworkType] = useState<'mainnet' | 'songbird' | 'coston'>('songbird');
  
  useEffect(() => {
    checkWalletStatus();
  }, []);
  
  const checkWalletStatus = async () => {
    try {
      setIsLoading(true);
      // Get the current network type
      const currentNetwork = FlareNetworkService.getNetworkType();
      setNetworkType(currentNetwork as 'mainnet' | 'songbird' | 'coston');
      
      // Check if wallet exists
      const address = await FlareNetworkService.getWalletAddress();
      setWalletAddress(address);
      
      if (address) {
        // Get wallet balance
        const balanceValue = await FlareNetworkService.getBalance();
        setBalance(balanceValue);
      }
    } catch (error) {
      console.error('Error checking wallet status:', error);
      Alert.alert('Error', 'Failed to check wallet status');
    } finally {
      setIsLoading(false);
    }
  };
  
  const createWallet = async () => {
    try {
      setIsLoading(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      const address = await FlareNetworkService.createWallet();
      setWalletAddress(address);
      Alert.alert(
        'Wallet Created',
        'Your Flare Network wallet has been created successfully. Please backup your private key.',
        [{ text: 'OK' }]
      );
      
      // Refresh balance
      const balanceValue = await FlareNetworkService.getBalance();
      setBalance(balanceValue);
    } catch (error) {
      console.error('Error creating wallet:', error);
      Alert.alert('Error', 'Failed to create wallet');
    } finally {
      setIsLoading(false);
    }
  };
  
  const importWallet = async () => {
    if (!privateKey.trim()) {
      Alert.alert('Error', 'Please enter a private key');
      return;
    }
    
    try {
      setIsLoading(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      const address = await FlareNetworkService.importWallet(privateKey);
      setWalletAddress(address);
      setPrivateKey('');
      Alert.alert('Success', 'Wallet imported successfully');
      
      // Refresh balance
      const balanceValue = await FlareNetworkService.getBalance();
      setBalance(balanceValue);
    } catch (error) {
      console.error('Error importing wallet:', error);
      Alert.alert('Error', 'Failed to import wallet. Please check the private key.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const switchNetwork = async (newNetworkType: 'mainnet' | 'songbird' | 'coston') => {
    try {
      setIsLoading(true);
      await FlareNetworkService.switchNetwork(newNetworkType);
      setNetworkType(newNetworkType);
      
      // Refresh wallet status after network change
      await checkWalletStatus();
      
      Alert.alert('Network Changed', `You are now connected to ${newNetworkType}`);
    } catch (error) {
      console.error('Error switching network:', error);
      Alert.alert('Error', 'Failed to switch network');
    } finally {
      setIsLoading(false);
    }
  };
  
  const renderNetworkSelector = () => {
    return (
      <View style={styles.networkSelector}>
        <Text style={styles.sectionTitle}>Network</Text>
        <View style={styles.networkButtons}>
          <TouchableOpacity
            style={[
              styles.networkButton,
              networkType === 'mainnet' && styles.selectedNetwork
            ]}
            onPress={() => switchNetwork('mainnet')}
          >
            <Text style={[
              styles.networkButtonText,
              networkType === 'mainnet' && styles.selectedNetworkText
            ]}>Mainnet</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.networkButton,
              networkType === 'songbird' && styles.selectedNetwork
            ]}
            onPress={() => switchNetwork('songbird')}
          >
            <Text style={[
              styles.networkButtonText,
              networkType === 'songbird' && styles.selectedNetworkText
            ]}>Songbird</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.networkButton,
              networkType === 'coston' && styles.selectedNetwork
            ]}
            onPress={() => switchNetwork('coston')}
          >
            <Text style={[
              styles.networkButtonText,
              networkType === 'coston' && styles.selectedNetworkText
            ]}>Coston</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  const renderWalletInfo = () => {
    if (!walletAddress) {
      return null;
    }
    
    return (
      <View style={styles.walletInfoContainer}>
        <Text style={styles.sectionTitle}>Wallet Information</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Address:</Text>
          <Text style={styles.infoValue}>{walletAddress}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Balance:</Text>
          <Text style={styles.infoValue}>
            {balance ? `${balance} FLR` : 'Loading...'}
          </Text>
        </View>
        
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={checkWalletStatus}
        >
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Flare Network Wallet</Text>
      
      {isLoading && (
        <ActivityIndicator size="large" color="#FF8C00" style={styles.loader} />
      )}
      
      {renderNetworkSelector()}
      
      {renderWalletInfo()}
      
      {!walletAddress ? (
        <View style={styles.walletActions}>
          <Text style={styles.sectionTitle}>Create or Import Wallet</Text>
          
          <TouchableOpacity
            style={styles.createButton}
            onPress={createWallet}
            disabled={isLoading}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.buttonText}>Create New Wallet</Text>
          </TouchableOpacity>
          
          <Text style={styles.orText}>OR</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Enter Private Key"
            value={privateKey}
            onChangeText={setPrivateKey}
            secureTextEntry
          />
          
          <TouchableOpacity
            style={styles.importButton}
            onPress={importWallet}
            disabled={isLoading || !privateKey.trim()}
          >
            <Ionicons name="key-outline" size={20} color="#fff" />
            <Text style={styles.buttonText}>Import Wallet</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.eventSection}>
          <Text style={styles.sectionTitle}>Calendar Events on Flare</Text>
          <Text style={styles.eventInfo}>
            With your Flare wallet connected, your calendar events can be stored on the blockchain, 
            providing enhanced security and decentralized access.
          </Text>
          
          <TouchableOpacity
            style={styles.eventButton}
            onPress={() => Alert.alert('Coming Soon', 'This feature will be available in the next update.')}
          >
            <Ionicons name="calendar-outline" size={20} color="#fff" />
            <Text style={styles.buttonText}>View Blockchain Events</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  loader: {
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#444',
  },
  networkSelector: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  networkButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  networkButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderRadius: 5,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  selectedNetwork: {
    backgroundColor: '#FF8C00',
  },
  networkButtonText: {
    color: '#555',
    fontWeight: '500',
  },
  selectedNetworkText: {
    color: '#fff',
  },
  walletInfoContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontWeight: '600',
    width: 70,
    color: '#555',
  },
  infoValue: {
    flex: 1,
    color: '#333',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  refreshButtonText: {
    color: '#fff',
    marginLeft: 5,
    fontWeight: '500',
  },
  walletActions: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 5,
    marginBottom: 15,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '500',
    marginLeft: 10,
  },
  orText: {
    textAlign: 'center',
    marginVertical: 10,
    color: '#888',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF8C00',
    paddingVertical: 12,
    borderRadius: 5,
  },
  eventSection: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  eventInfo: {
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  eventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9C27B0',
    paddingVertical: 12,
    borderRadius: 5,
  },
}); 