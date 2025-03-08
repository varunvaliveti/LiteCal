from flask import Flask, request, jsonify
import google.generativeai as genai
import os
from flask_cors import CORS
from dotenv import load_dotenv
import base64

load_dotenv()
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure the Gemini API with your API key
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# Initialize the model - use gemini-1.5-pro for multimodal capabilities
model = genai.GenerativeModel('gemini-2.0-flash')

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