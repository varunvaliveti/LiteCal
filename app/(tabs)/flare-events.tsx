import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import FlareNetworkService from '../../services/FlareNetworkService';

interface BlockchainEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  description: string;
  creator: string;
}

export default function FlareEventsScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [events, setEvents] = useState<BlockchainEvent[]>([]);
  
  // New event form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 3600000)); // +1 hour
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  useEffect(() => {
    checkWalletStatus();
  }, []);
  
  const checkWalletStatus = async () => {
    try {
      setIsLoading(true);
      const address = await FlareNetworkService.getWalletAddress();
      setWalletAddress(address);
      
      // Create example events using current date
      if (address) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        setEvents([
          {
            id: '1',
            title: 'Team Meeting',
            startTime: new Date(today.setHours(10, 0, 0, 0)), // 10:00 AM today
            endTime: new Date(today.setHours(11, 0, 0, 0)),  // 11:00 AM today
            description: 'Weekly team sync',
            creator: address
          },
          {
            id: '2',
            title: 'Blockchain Conference',
            startTime: new Date(tomorrow.setHours(13, 30, 0, 0)), // 1:30 PM tomorrow
            endTime: new Date(tomorrow.setHours(15, 0, 0, 0)),   // 3:00 PM tomorrow
            description: 'Annual blockchain technology conference',
            creator: address
          }
        ]);
      }
    } catch (error) {
      console.error('Error checking wallet status:', error);
      Alert.alert('Error', 'Failed to check wallet status');
    } finally {
      setIsLoading(false);
    }
  };
  
  const resetForm = () => {
    setTitle('');
    setDescription('');
    
    // Set to current date with times 
    const now = new Date();
    const anHourLater = new Date(now);
    anHourLater.setHours(now.getHours() + 1);
    
    setStartDate(now);
    setEndDate(anHourLater);
  };
  
  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true // Explicitly use 12-hour format
    });
  };
  
  const capitalizeTitle = (title: string): string => {
    if (!title) return '';
    
    // Words that should not be capitalized unless they are the first or last word
    const minorWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of'];
    
    return title.split(' ').map((word, index, array) => {
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
  
  const createEvent = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an event title');
      return;
    }
    
    if (startDate >= endDate) {
      Alert.alert('Error', 'End time must be after start time');
      return;
    }
    
    try {
      setIsLoading(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Create a properly formatted title
      const formattedTitle = capitalizeTitle(title);
      
      // In a real implementation, this would call FlareNetworkService.createCalendarEvent
      // For demo purposes, we're just simulating the creation
      setTimeout(() => {
        const newEvent: BlockchainEvent = {
          id: Math.random().toString(36).substring(2, 9),
          title: formattedTitle,
          startTime: startDate,
          endTime: endDate,
          description,
          creator: walletAddress || ''
        };
        
        setEvents([newEvent, ...events]);
        setModalVisible(false);
        resetForm();
        
        Alert.alert(
          'Success',
          'Event created successfully and stored on the Flare blockchain'
        );
        setIsLoading(false);
      }, 2000);
      
    } catch (error) {
      console.error('Error creating blockchain event:', error);
      Alert.alert('Error', 'Failed to create event on the blockchain');
      setIsLoading(false);
    }
  };
  
  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(false);
    if (selectedDate) {
      setStartDate(selectedDate);
      
      // If end date is now before start date, adjust it
      if (selectedDate >= endDate) {
        const newEndDate = new Date(selectedDate.getTime() + 3600000); // +1 hour from start
        setEndDate(newEndDate);
      }
    }
  };
  
  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(false);
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };
  
  const renderEventItem = ({ item }: { item: BlockchainEvent }) => (
    <View style={styles.eventItem}>
      <View style={styles.eventHeader}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        <View style={styles.eventBadge}>
          <Ionicons name="checkmark-circle" size={14} color="#fff" />
          <Text style={styles.eventBadgeText}>On Chain</Text>
        </View>
      </View>
      
      <View style={styles.eventTimeContainer}>
        <Ionicons name="time-outline" size={16} color="#666" style={styles.eventIcon} />
        <Text style={styles.eventTime}>
          {formatDate(item.startTime)} - {formatDate(item.endTime)}
        </Text>
      </View>
      
      {item.description ? (
        <View style={styles.eventDescriptionContainer}>
          <Ionicons name="document-text-outline" size={16} color="#666" style={styles.eventIcon} />
          <Text style={styles.eventDescription}>{item.description}</Text>
        </View>
      ) : null}
      
      <View style={styles.eventFooter}>
        <TouchableOpacity
          style={styles.eventActionButton}
          onPress={() => Alert.alert('View on Explorer', 'This will open the Flare block explorer to view this transaction.')}
        >
          <Ionicons name="open-outline" size={16} color="#007AFF" />
          <Text style={styles.eventActionText}>View on Explorer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  const renderCreateEventModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Blockchain Event</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color="#555" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalForm}>
            <Text style={styles.inputLabel}>Event Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter event title"
              value={title}
              onChangeText={setTitle}
            />
            
            <Text style={styles.inputLabel}>Start Time *</Text>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => setShowStartPicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#555" />
              <Text style={styles.datePickerText}>{formatDate(startDate)}</Text>
            </TouchableOpacity>
            
            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="datetime"
                display="default"
                onChange={handleStartDateChange}
              />
            )}
            
            <Text style={styles.inputLabel}>End Time *</Text>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => setShowEndPicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#555" />
              <Text style={styles.datePickerText}>{formatDate(endDate)}</Text>
            </TouchableOpacity>
            
            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="datetime"
                display="default"
                onChange={handleEndDateChange}
              />
            )}
            
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter event description"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
            
            <View style={styles.blockchainInfo}>
              <Ionicons name="information-circle-outline" size={16} color="#666" />
              <Text style={styles.blockchainInfoText}>
                This event will be stored on the Flare blockchain, making it immutable and verifiable.
              </Text>
            </View>
            
            <TouchableOpacity
              style={styles.createEventButton}
              onPress={createEvent}
              disabled={isLoading || !title.trim()}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={20} color="#fff" />
                  <Text style={styles.createEventButtonText}>Create Blockchain Event</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
  
  if (!walletAddress) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Flare Blockchain Events</Text>
        <View style={styles.noWalletContainer}>
          <Ionicons name="wallet-outline" size={48} color="#ccc" />
          <Text style={styles.noWalletText}>Wallet Not Connected</Text>
          <Text style={styles.noWalletSubtext}>
            Please connect your Flare Network wallet to create and view blockchain events.
          </Text>
          <TouchableOpacity
            style={styles.connectWalletButton}
            onPress={() => Alert.alert('Navigate', 'This would navigate to the Flare Wallet screen')}
          >
            <Text style={styles.connectWalletButtonText}>Connect Wallet</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Flare Blockchain Events</Text>
      
      {renderCreateEventModal()}
      
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.addButtonText}>Create Blockchain Event</Text>
      </TouchableOpacity>
      
      {isLoading && !modalVisible ? (
        <ActivityIndicator size="large" color="#FF8C00" style={styles.loader} />
      ) : events.length > 0 ? (
        <FlatList
          data={events}
          renderItem={renderEventItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.eventsList}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.noEventsContainer}>
          <Ionicons name="calendar-outline" size={48} color="#ccc" />
          <Text style={styles.noEventsText}>No Blockchain Events Yet</Text>
          <Text style={styles.noEventsSubtext}>
            Create your first event to store it on the Flare blockchain.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  loader: {
    marginTop: 40,
  },
  noWalletContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  noWalletText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    color: '#555',
  },
  noWalletSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  connectWalletButton: {
    backgroundColor: '#FF8C00',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  connectWalletButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9C27B0',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  eventsList: {
    paddingBottom: 20,
  },
  eventItem: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  eventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  eventBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  eventTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  eventIcon: {
    marginRight: 6,
  },
  eventTime: {
    color: '#666',
    fontSize: 14,
    flex: 1,
  },
  eventDescriptionContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  eventDescription: {
    color: '#666',
    fontSize: 14,
    flex: 1,
  },
  eventFooter: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
    marginTop: 4,
  },
  eventActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventActionText: {
    color: '#007AFF',
    marginLeft: 6,
    fontSize: 14,
  },
  noEventsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  noEventsText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    color: '#555',
  },
  noEventsSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalForm: {
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    fontSize: 15,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  datePickerText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 8,
  },
  blockchainInfo: {
    flexDirection: 'row',
    backgroundColor: '#f0f7ff',
    padding: 12,
    borderRadius: 8,
    marginVertical: 16,
    alignItems: 'flex-start',
  },
  blockchainInfoText: {
    color: '#555',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  createEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9C27B0',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  createEventButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
}); 