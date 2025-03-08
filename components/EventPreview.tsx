import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

interface EventData {
  event_title: string;
  start_date: string;
  start_time: string;
  end_date?: string;
  end_time?: string;
  location?: string;
  description?: string;
}

interface EventPreviewProps {
  eventData: EventData;
  icsFile: string;
}

const EventPreview = ({ eventData, icsFile }: EventPreviewProps) => {
  // Function to save and share the ICS file
  const handleExportICS = async () => {
    try {
      const fileName = `${eventData.event_title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      // Decode base64 ICS file
      const icsContent = atob(icsFile);
      
      // Write the file
      await FileSystem.writeAsStringAsync(fileUri, icsContent);
      
      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/calendar',
          dialogTitle: 'Save Calendar Event',
          UTI: 'public.calendar'
        });
      } else {
        alert('Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error exporting ICS file:', error);
      alert('Failed to export calendar event');
    }
  };

  // Function to add event to device calendar
  const handleAddToCalendar = async () => {
    try {
      // Get calendar permissions
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      
      if (status !== 'granted') {
        alert('Calendar permission is required to add events');
        return;
      }
      
      // Get available calendars
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCalendar = calendars.find(
        (cal: Calendar.Calendar) => cal.isPrimary && cal.allowsModifications
      ) || calendars[0];
      
      if (!defaultCalendar) {
        alert('No calendar found to add this event');
        return;
      }
      
      // Format dates
      const startDate = new Date(`${eventData.start_date}T${eventData.start_time}`);
      
      let endDate;
      if (eventData.end_date && eventData.end_time) {
        endDate = new Date(`${eventData.end_date}T${eventData.end_time}`);
      } else if (eventData.end_time) {
        endDate = new Date(`${eventData.start_date}T${eventData.end_time}`);
      } else {
        // Default to 1 hour after start time
        endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      }
      
      // Create event
      const eventId = await Calendar.createEventAsync(defaultCalendar.id, {
        title: eventData.event_title,
        startDate,
        endDate,
        location: eventData.location,
        notes: eventData.description,
        alarms: [{ relativeOffset: -10 }] // 10 minutes before
      });
      
      if (eventId) {
        alert('Event added to your calendar');
      }
    } catch (error) {
      console.error('Error adding to calendar:', error);
      alert('Failed to add event to calendar');
    }
  };

  // Format the date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // Format the time for display
  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const time = new Date();
    time.setHours(parseInt(hours, 10));
    time.setMinutes(parseInt(minutes, 10));
    
    return time.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <FontAwesome name="calendar" size={20} color="#4a6fff" />
        <Text style={styles.headerText}>Calendar Event</Text>
      </View>
      
      <View style={styles.eventDetails}>
        <Text style={styles.eventTitle}>{eventData.event_title}</Text>
        
        <View style={styles.detailRow}>
          <FontAwesome name="calendar-o" size={16} color="#888" style={styles.icon} />
          <Text style={styles.detailText}>{formatDate(eventData.start_date)}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <FontAwesome name="clock-o" size={16} color="#888" style={styles.icon} />
          <Text style={styles.detailText}>
            {formatTime(eventData.start_time)}
            {eventData.end_time ? ` - ${formatTime(eventData.end_time)}` : ''}
          </Text>
        </View>
        
        {eventData.location && (
          <View style={styles.detailRow}>
            <FontAwesome name="map-marker" size={16} color="#888" style={styles.icon} />
            <Text style={styles.detailText}>{eventData.location}</Text>
          </View>
        )}
        
        {eventData.description && (
          <View style={styles.detailRow}>
            <FontAwesome name="file-text-o" size={16} color="#888" style={styles.icon} />
            <Text style={styles.detailText}>{eventData.description}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={handleAddToCalendar}>
          <FontAwesome name="calendar-plus-o" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Add to Calendar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={handleExportICS}>
          <FontAwesome name="download" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Export .ICS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 15,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(74, 111, 255, 0.5)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4a6fff',
    marginLeft: 8,
  },
  eventDetails: {
    marginBottom: 15,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    width: 20,
    marginRight: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#ddd',
    flex: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    backgroundColor: '#4a6fff',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  actionButtonText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 14,
  },
});

export default EventPreview; 