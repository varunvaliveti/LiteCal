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
      
      // Log ICS file info for debugging
      console.log("Processing ICS file export with data:", JSON.stringify({
        event_title: eventData.event_title,
        start_date: eventData.start_date,
        start_time: eventData.start_time,
        end_date: eventData.end_date,
        end_time: eventData.end_time
      }));
      console.log("ICS file length:", icsFile ? icsFile.length : 0);
      
      // Safely decode base64 ICS file
      let icsContent;
      try {
        icsContent = atob(icsFile);
        console.log("Successfully decoded ICS content, length:", icsContent.length);
      } catch (e) {
        console.error("Error decoding ICS file:", e);
        // Try to fix common encoding issues or use a fallback
        icsContent = generateFallbackICSContent(eventData);
      }
      
      // Verify ICS content has required elements
      if (!icsContent.includes('BEGIN:VCALENDAR') || !icsContent.includes('END:VCALENDAR')) {
        console.warn("ICS content is missing required elements, using fallback");
        icsContent = generateFallbackICSContent(eventData);
      }
      
      // Write the file
      await FileSystem.writeAsStringAsync(fileUri, icsContent);
      console.log("ICS file written to:", fileUri);
      
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
  
  // Generate a fallback ICS content if there are issues with the provided one
  const generateFallbackICSContent = (eventData: EventData): string => {
    // Get current timestamp for UID
    const timestamp = new Date().getTime();
    const uid = `event-${timestamp}@litecal.app`;
    
    // Parse dates and times
    const [year, month, day] = eventData.start_date.split('-').map(num => parseInt(num, 10));
    const [startHour, startMinute] = eventData.start_time.split(':').map(num => parseInt(num, 10));
    
    // Create formatted date strings for ICS
    const formatDateForICS = (year: number, month: number, day: number, hour: number, minute: number) => {
      return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}00Z`;
    };
    
    const startDateFormatted = formatDateForICS(year, month, day, startHour, startMinute);
    
    // For end time, use end_time if provided, otherwise default to 1 hour later
    let endDateFormatted;
    if (eventData.end_time) {
      const [endHour, endMinute] = eventData.end_time.split(':').map(num => parseInt(num, 10));
      endDateFormatted = formatDateForICS(year, month, day, endHour, endMinute);
    } else {
      // Default to 1 hour event
      endDateFormatted = formatDateForICS(year, month, day, startHour + 1, startMinute);
    }
    
    // Build basic ICS content
    return [
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
      `SUMMARY:${eventData.event_title || 'Calendar Event'}`,
      eventData.location ? `LOCATION:${eventData.location}` : '',
      eventData.description ? `DESCRIPTION:${eventData.description}` : '',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');
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
      
      // Parse date parts
      const [startYear, startMonth, startDay] = eventData.start_date.split('-').map(num => parseInt(num, 10));
      
      // Format dates - using explicit date construction to avoid timezone issues
      // Set hours, minutes, seconds explicitly from the time string
      const [startHours, startMinutes] = eventData.start_time.split(':').map(num => parseInt(num, 10));
      
      // Create date with explicit parts to avoid timezone issues
      const startDate = new Date();
      startDate.setFullYear(startYear, startMonth - 1, startDay);
      startDate.setHours(startHours, startMinutes, 0, 0);
      
      console.log("Calendar event start date:", startDate.toString());
      
      let endDate;
      if (eventData.end_date && eventData.end_time) {
        const [endYear, endMonth, endDay] = eventData.end_date.split('-').map(num => parseInt(num, 10));
        const [endHours, endMinutes] = eventData.end_time.split(':').map(num => parseInt(num, 10));
        
        endDate = new Date();
        endDate.setFullYear(endYear, endMonth - 1, endDay);
        endDate.setHours(endHours, endMinutes, 0, 0);
      } else if (eventData.end_time) {
        const [endHours, endMinutes] = eventData.end_time.split(':').map(num => parseInt(num, 10));
        
        endDate = new Date();
        endDate.setFullYear(startYear, startMonth - 1, startDay);
        endDate.setHours(endHours, endMinutes, 0, 0);
      } else {
        // Default to 1 hour after start time
        endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      }
      
      console.log("Calendar event end date:", endDate.toString());
      
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
    try {
      console.log("Formatting date:", dateStr);
      
      // Parse the date string manually
      const [year, month, day] = dateStr.split('-').map(num => parseInt(num, 10));
      
      // Direct mapping for month names
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June', 
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      // Direct mapping for day of week calculation
      // This is a precise implementation of Zeller's Congruence algorithm
      const getWeekdayName = (year: number, month: number, day: number): string => {
        // Adjust month and year for Zeller's Congruence (Jan & Feb are considered month 13 & 14 of previous year)
        if (month < 3) {
          month += 12;
          year -= 1;
        }
        
        //shoutout Zeller's Congruence
        const h = (day + Math.floor((13 * (month + 1)) / 5) + year + Math.floor(year / 4) - 
                  Math.floor(year / 100) + Math.floor(year / 400)) % 7;
        
        // Convert h to standard day of week (0 = Sunday, 6 = Saturday)
        const dayNames = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        return dayNames[h];
      };
      
      const weekday = getWeekdayName(year, month, day);
      const monthName = monthNames[month - 1]; // Adjust for 0-indexed array
      
      // Format the date string manually
      return `${weekday}, ${monthName} ${day}, ${year}`;
    } catch (error) {
      console.error("Error formatting date:", error, dateStr);
      return dateStr; // Fallback to the original string
    }
  };
  
  // Format the time for display in 12-hour format
  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const time = new Date();
    time.setHours(parseInt(hours, 10));
    time.setMinutes(parseInt(minutes, 10));
    
    return time.toLocaleTimeString(undefined, { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true // Explicitly use 12-hour format
    });
  };

  // Function to format the event location with proper capitalization
  const formatLocation = (location: string | undefined) => {
    if (!location) return '';
    
    // Split by commas for address components
    return location.split(',').map(part => {
      return part.trim().split(' ').map(word => {
        // Don't capitalize certain words in addresses
        const lowercaseWords = ['and', 'or', 'the', 'a', 'an', 'of', 'to', 'in', 'for', 'on', 'by', 'at'];
        if (lowercaseWords.includes(word.toLowerCase()) && word !== part.trim().split(' ')[0]) {
          return word.toLowerCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }).join(' ');
    }).join(', ');
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
            <Text style={styles.detailText}>{formatLocation(eventData.location)}</Text>
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