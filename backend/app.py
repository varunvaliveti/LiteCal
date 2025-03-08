from flask import Flask, request, jsonify
import google.generativeai as genai
import os
from flask_cors import CORS
from dotenv import load_dotenv
import base64
from icalendar import Calendar, Event
from datetime import datetime, timedelta
import uuid
import json
import re

load_dotenv()
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure the Gemini API with your API key
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# Initialize the model - use gemini-1.5-pro for multimodal capabilities
model = genai.GenerativeModel('gemini-2.0-flash')

# Function to parse calendar event information
def parse_calendar_event(user_message, chat_history=None):
    context = ""
    if chat_history:
        context = f"Previous conversation for context: {chat_history}\n\n"
    
    prompt = f"""
    {context}
    User message: "{user_message}"
    
    If this message describes a calendar event, extract the following information in JSON format:
    {{
        "is_event": true or false (whether this is a calendar event request),
        "event_title": "Title of the event",
        "start_date": "YYYY-MM-DD",
        "start_time": "HH:MM" (in 24-hour format),
        "end_date": "YYYY-MM-DD" (can be the same as start_date for single-day events),
        "end_time": "HH:MM" (in 24-hour format, if not specified, assume 1 hour after start_time),
        "location": "Location of the event",
        "description": "Description or notes for the event",
        "attendees": ["email1@example.com", "email2@example.com"] (optional, can be empty),
        "requires_clarification": true or false (if something is ambiguous),
        "clarification_question": "Question to ask for clarification" (only if requires_clarification is true)
    }}
    
    If this message doesn't describe a calendar event or is inappropriate, just return:
    {{
        "is_event": false
    }}
    
    Reply with only the JSON object, no other text.
    """
    
    response = model.generate_content(prompt)
    
    try:
        # Extract JSON from the response
        json_pattern = r'({.*})'
        match = re.search(json_pattern, response.text, re.DOTALL)
        if match:
            event_data = json.loads(match.group(1))
        else:
            event_data = {"is_event": False}
        
        return event_data
    except Exception as e:
        print(f"Error parsing event data: {e}")
        return {"is_event": False}

# Function to create ICS file
def create_ics_file(event_data):
    cal = Calendar()
    cal.add('prodid', '-//LiteCal//litecal.app//')
    cal.add('version', '2.0')
    
    event = Event()
    event.add('summary', event_data.get('event_title', 'New Event'))
    
    # Format start datetime
    start_date = event_data.get('start_date')
    start_time = event_data.get('start_time', '00:00')
    start_datetime = datetime.strptime(f"{start_date} {start_time}", '%Y-%m-%d %H:%M')
    event.add('dtstart', start_datetime)
    
    # Format end datetime
    end_date = event_data.get('end_date', start_date)
    end_time = event_data.get('end_time')
    if end_time:
        end_datetime = datetime.strptime(f"{end_date} {end_time}", '%Y-%m-%d %H:%M')
    else:
        # Default to 1 hour after start time
        end_datetime = start_datetime + timedelta(hours=1)
    event.add('dtend', end_datetime)
    
    # Add location if present
    if event_data.get('location'):
        event.add('location', event_data.get('location'))
    
    # Add description if present
    if event_data.get('description'):
        event.add('description', event_data.get('description'))
    
    # Add attendees if present
    for attendee in event_data.get('attendees', []):
        event.add('attendee', f'MAILTO:{attendee}')
    
    # Add a unique identifier
    event.add('uid', str(uuid.uuid4()))
    
    # Add creation timestamp
    event.add('dtstamp', datetime.now())
    
    # Add reminder (10 minutes before)
    alarm = Event()
    alarm.add('action', 'DISPLAY')
    alarm.add('description', f"Reminder: {event_data.get('event_title', 'Event')}")
    alarm.add('trigger', timedelta(minutes=-10))
    event.add_component(alarm)
    
    cal.add_component(event)
    
    return cal.to_ical().decode('utf-8')

@app.route('/chat', methods=['POST'])
def chat():
    # Get the data from the request
    data = request.json
    user_message = data.get('message', '')
    image_data = data.get('image', None)
    audio_data = data.get('audio', None)
    chat_history = data.get('history', None)  # Get chat history for RAG
    
    if not user_message and not image_data and not audio_data:
        return jsonify({'error': 'No message, image, or audio provided'}), 400
    
    try:
        # Check if the message appears to be a calendar event request
        event_data = parse_calendar_event(user_message, chat_history)
        
        # If this is a calendar event and no clarification needed, generate ICS
        if event_data.get('is_event', False):
            if event_data.get('requires_clarification', False):
                # Return clarification question instead of generating event
                return jsonify({
                    'message': event_data.get('clarification_question'),
                    'is_event': True,
                    'requires_clarification': True,
                    'event_data': event_data
                })
            else:
                # Generate ICS file
                ics_content = create_ics_file(event_data)
                
                # Create a friendly response with event details
                friendly_response = f"""
                I've created a calendar event based on your request:
                
                📅 **{event_data.get('event_title')}**
                📆 Date: {event_data.get('start_date')}
                ⏰ Time: {event_data.get('start_time')} - {event_data.get('end_time', 'Not specified')}
                📍 Location: {event_data.get('location', 'Not specified')}
                📝 Description: {event_data.get('description', 'Not specified')}
                
                A reminder has been set for 10 minutes before the event.
                """
                
                return jsonify({
                    'message': friendly_response.strip(),
                    'is_event': True,
                    'event_data': event_data,
                    'ics_file': base64.b64encode(ics_content.encode('utf-8')).decode('utf-8')
                })

        # If not a calendar event or inappropriate, process normally
        # Initialize content_parts outside the conditional blocks
        content_parts = []
        
        # If chat history is provided, use it as context for RAG
        if chat_history:
            # Add a system message to provide context from previous conversations
            context_prompt = f"""
            You are LiteCal, an AI assistant. The user has had previous conversations with you.
            Below is the relevant history of your past conversations with this user. 
            Use this context to provide more personalized and consistent responses.
            
            {chat_history}
            
            Now, respond to the user's current message:
            """
            content_parts.append(context_prompt)
        
        # Handle image if provided
        if image_data:
            # Decode base64 image
            image_bytes = base64.b64decode(image_data.split(',')[1] if ',' in image_data else image_data)
            
            # Add image to content parts
            content_parts.append({
                "mime_type": "image/jpeg",
                "data": image_bytes
            })
        
        # Handle audio if provided
        if audio_data:
            audio_bytes = base64.b64decode(audio_data.split(',')[1] if ',' in audio_data else audio_data)
            content_parts.append({
                "mime_type": "audio/mp3",
                "data": audio_bytes
            })
        
        # Add text if provided
        if user_message:
            content_parts.append(user_message)
        
        # Generate response based on content
        if content_parts:
            response = model.generate_content(content_parts)
        else:
            # This should never happen due to the initial check, but just in case
            return jsonify({'error': 'No valid content to process'}), 400
        
        # Extract the text from the response
        ai_message = response.text
        
        # Return the AI response
        return jsonify({'message': ai_message})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)