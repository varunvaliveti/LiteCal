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
import requests
from typing import Optional
from dataclasses import dataclass
import functools

load_dotenv()
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure the Gemini API with your API key
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# Initialize the model with Ethereum context
model = genai.GenerativeModel('gemini-2.0-flash')

# Ethereum dataset context
ETHEREUM_CONTEXT = """
You are analyzing calendar events in the context of Ethereum blockchain data.
Consider the following when processing events:
1. Check for blockchain-related keywords (e.g., ETH, gas, transactions)
2. Verify if event times align with typical blockchain activity periods
3. Consider timezone implications for global blockchain events
4. Look for DeFi-related scheduling patterns
5. Consider gas price optimization for transaction timing
"""

# Add these new TEE configurations
TEE_CONFIG = {
    'attestation_endpoint': 'http://metadata.google.internal/computeMetadata/v1/instance/attestation-token',
    'cpu_type': 'AMD',
    'tee_type': 'SEV-SNP',
    'required_version': '1.0'
}

# Add TEE verification class
class TEEVerification:
    _instance = None
    _attestation_token = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TEEVerification, cls).__new__(cls)
        return cls._instance

    async def get_attestation_token(self) -> Optional[str]:
        if self._attestation_token:
            return self._attestation_token

        try:
            response = requests.get(
                TEE_CONFIG['attestation_endpoint'],
                headers={'Metadata-Flavor': 'Google'},
                timeout=5
            )
            if response.status_code == 200:
                self._attestation_token = response.text
                return self._attestation_token
        except Exception as e:
            print(f"TEE Attestation failed: {e}")
        return None

    async def is_running_in_tee(self) -> bool:
        token = await self.get_attestation_token()
        return token is not None

# Initialize TEE verification
tee = TEEVerification()

# Decorator for secure operations
def require_tee(func):
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        in_tee = await tee.is_running_in_tee()
        if not in_tee:
            print(f"Warning: {func.__name__} running outside TEE")
        return await func(*args, **kwargs)
    return wrapper

# Function to parse calendar event information with Ethereum context
@require_tee
async def parse_calendar_event(user_message, chat_history=None):
    context = ""
    if chat_history:
        context = f"Previous conversation context:\n{chat_history}\n\n"
    
    # Get current date to use for the event
    current_date = datetime.now().strftime('%Y-%m-%d')
    # print(current_date)
    
    prompt = f"""
    {ETHEREUM_CONTEXT}
    
    {context}
    User message: "{user_message}"
    
    Today's date is {current_date}.
    
    If this message describes a calendar event, extract the following information in JSON format:
    {{
        "is_event": true or false,
        "event_title": "Title of the event",
        "start_date": "YYYY-MM-DD",
        "start_time": "HH:MM",
        "end_date": "YYYY-MM-DD",
        "end_time": "HH:MM",
        "location": "Location of the event",
        "description": "Description or notes for the event",
        "attendees": ["email1@example.com"],
        "requires_clarification": true or false,
        "clarification_question": "Question to ask for clarification",
        "specified_date": true or false,
        "blockchain_related": true or false,
        "gas_price_check_needed": true or false,
        "defi_related": true or false
    }}
    
    Pay special attention to:
    1. Blockchain-related keywords and context
    2. DeFi protocol names or references
    3. Gas price considerations for transaction timing
    4. Global timezone implications
    5. Smart contract deployment windows
    """
    
    response = model.generate_content(prompt)
    
    try:
        # Extract JSON from the response
        json_pattern = r'({.*})'
        match = re.search(json_pattern, response.text, re.DOTALL)
        if match:
            event_data = json.loads(match.group(1))
            
            # Add current_date to the event data for use in create_ics_file
            event_data['current_date'] = current_date
            
            # If it's an event, ensure we have the required fields
            if event_data.get('is_event', False):
                # Ensure title is properly capitalized
                if 'event_title' in event_data:
                    event_data['event_title'] = capitalize_title(event_data['event_title'])
                
                # Ensure location is properly capitalized
                if 'location' in event_data and event_data['location']:
                    event_data['location'] = capitalize_location(event_data['location'])
                
                # Ensure description has proper grammar
                if 'description' in event_data and event_data['description']:
                    event_data['description'] = fix_description_text(event_data['description'])
                
                # Use current date if no date was specified
                if not event_data.get('specified_date', False):
                    event_data['start_date'] = current_date
                    if 'end_date' in event_data:
                        event_data['end_date'] = current_date
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
    
    # Ensure proper capitalization in event title
    event_title = event_data.get('event_title', 'New Event')
    event_title = capitalize_title(event_title)
    event.add('summary', event_title)
    
    # Use current date if no specific date was requested
    current_date = event_data.get('current_date', datetime.now().strftime('%Y-%m-%d'))
    
    # Format start datetime
    start_date = event_data.get('start_date', current_date)
    start_time = event_data.get('start_time', '09:00')
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
    
    # Add location if present (with proper capitalization)
    if event_data.get('location'):
        location = capitalize_location(event_data.get('location'))
        event.add('location', location)
    
    # Add description if present
    if event_data.get('description'):
        description = event_data.get('description')
        # Clean up any grammar/capitalization issues in description
        description = fix_description_text(description)
        event.add('description', description)
    
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
    alarm.add('description', f"Reminder: {event_title}")
    alarm.add('trigger', timedelta(minutes=-10))
    event.add_component(alarm)
    
    cal.add_component(event)
    
    return cal.to_ical().decode('utf-8')

# Helper function to capitalize event title properly
def capitalize_title(title):
    if not title:
        return 'New Event'
    
    # Words that should not be capitalized unless they are the first or last word
    minor_words = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of']
    
    words = title.split()
    result = []
    
    for i, word in enumerate(words):
        # Always capitalize first and last words
        if i == 0 or i == len(words) - 1:
            result.append(word[0].upper() + word[1:].lower() if word else '')
        # Don't capitalize minor words
        elif word.lower() in minor_words:
            result.append(word.lower())
        # Capitalize other words
        else:
            result.append(word[0].upper() + word[1:].lower() if word else '')
    
    return ' '.join(result)

# Helper function to capitalize location properly
def capitalize_location(location):
    if not location:
        return ''
    
    # Split by commas for address components
    address_parts = location.split(',')
    capitalized_parts = []
    
    for part in address_parts:
        words = part.strip().split()
        result = []
        
        for i, word in enumerate(words):
            # Always capitalize first word in each part
            if i == 0:
                result.append(word[0].upper() + word[1:].lower() if word else '')
            # Don't capitalize certain words in addresses
            elif word.lower() in ['and', 'or', 'the', 'a', 'an', 'of', 'to', 'in', 'for', 'on', 'by', 'at']:
                result.append(word.lower())
            # Keep acronyms in uppercase
            elif word.upper() == word and len(word) <= 3:
                result.append(word.upper())
            # Capitalize other words
            else:
                result.append(word[0].upper() + word[1:].lower() if word else '')
        
        capitalized_parts.append(' '.join(result))
    
    return ', '.join(capitalized_parts)

# Helper function to fix grammar and capitalization in description
def fix_description_text(text):
    if not text:
        return ''
    
    # Split into sentences
    sentences = re.split(r'(?<=[.!?])\s+', text)
    fixed_sentences = []
    
    for sentence in sentences:
        if sentence:
            # Capitalize first letter of each sentence
            fixed = sentence[0].upper() + sentence[1:] if sentence else ''
            fixed_sentences.append(fixed)
    
    return ' '.join(fixed_sentences)

@app.route('/chat', methods=['POST'])
@require_tee
async def chat():
    # Get TEE status
    in_tee = await tee.is_running_in_tee()
    attestation_token = await tee.get_attestation_token()

    # Get the data from the request
    data = request.json
    user_message = data.get('message', '')
    image_data = data.get('image', None)
    audio_data = data.get('audio', None)
    chat_history = data.get('history', None)  # Get chat history for RAG
    user_id = data.get('user_id', 'anonymous')  # Get user ID for personalization
    current_date = data.get('current_date', datetime.now().strftime('%Y-%m-%d'))  # Get current date
    use_12h_format = data.get('use_12h_format', True)  # Whether to use 12-hour time format
    
    if not user_message and not image_data and not audio_data:
        return jsonify({'error': 'No message, image, or audio provided'}), 400
    
    try:
        # Check if the message appears to be a calendar event request
        event_data = await parse_calendar_event(user_message, chat_history)
        
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
                
                # Format times for display in 12-hour format if requested
                start_time_display = format_time_12h(event_data.get('start_time', '09:00')) if use_12h_format else event_data.get('start_time', '09:00')
                end_time_display = format_time_12h(event_data.get('end_time', '10:00')) if use_12h_format and event_data.get('end_time') else event_data.get('end_time', 'Not specified')
                
                # Format date for display
                date_display = format_date_long(event_data.get('start_date', current_date))
                
                # Create a friendly response with event details
                friendly_response = f"""
                I've created a calendar event based on your request:
                
                📅 **{event_data.get('event_title')}**
                📆 Date: {date_display}
                ⏰ Time: {start_time_display} - {end_time_display}
                📍 Location: {event_data.get('location', 'Not specified')}
                📝 Description: {event_data.get('description', 'Not specified')}
                
                The event has been created and a reminder has been set for 10 minutes before the event.
                You can add this event to your calendar using the options below.
                """
                
                return jsonify({
                    'message': friendly_response.strip(),
                    'is_event': True,
                    'event_data': event_data,
                    'ics_file': base64.b64encode(ics_content.encode('utf-8')).decode('utf-8'),
                    'tee_status': {
                        'in_tee': in_tee,
                        'attestation_available': attestation_token is not None,
                        'tee_type': TEE_CONFIG['tee_type'],
                        'cpu_type': TEE_CONFIG['cpu_type']
                    }
                })

        # If not a calendar event or inappropriate, process normally
        # Initialize content_parts outside the conditional blocks
        content_parts = []
        
        # If chat history is provided, use it as context for RAG
        if chat_history:
            # Add a system message to provide context from previous conversations
            context_prompt = f"""
            You are LiteCal, an AI assistant specialized in managing calendars and events.
            
            Today's date is {current_date}.
            
            The user ID is {user_id}.
            
            Below is the relevant history of your past conversations with this user:
            
            {chat_history}
            
            When creating calendar events:
            1. Use proper capitalization for event titles and locations
            2. Use {current_date} as the default date if no date is specified
            3. Use specific start and end times, not all-day events unless explicitly requested
            4. Format times in 12-hour format (e.g., "2:00 PM" not "14:00")
            5. Ensure proper grammar and punctuation in all responses
            
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

# Helper function to format time in 12-hour format
def format_time_12h(time_str):
    if not time_str or time_str == 'Not specified':
        return 'Not specified'
    
    try:
        # Parse the time string
        hours, minutes = map(int, time_str.split(':'))
        
        # Convert to 12-hour format
        period = 'AM' if hours < 12 else 'PM'
        hours_12 = hours % 12
        if hours_12 == 0:
            hours_12 = 12
        
        return f"{hours_12}:{minutes:02d} {period}"
    except:
        return time_str

# Helper function to format date in a long format
def format_date_long(date_str):
    if not date_str:
        return 'Not specified'
    
    try:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        return date_obj.strftime('%A, %B %d, %Y')  # Example: Monday, January 1, 2023
    except:
        return date_str

if __name__ == '__main__':
    # Initialize TEE verification on startup
    import asyncio
    loop = asyncio.get_event_loop()
    tee_status = loop.run_until_complete(tee.is_running_in_tee())
    print(f"Running in TEE: {tee_status}")
    print(f"TEE Type: {TEE_CONFIG['tee_type']}")
    print(f"CPU Type: {TEE_CONFIG['cpu_type']}")
    
    app.run(host='0.0.0.0', port=5001, debug=True)