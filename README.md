# AutoCal - AI Calendar Assistant

AutoCal is a React Native mobile app that helps users manage calendar events using natural language. The app uses AI to interpret user requests and create calendar events automatically.

## Project Structure

- **Frontend**: React Native with Expo
- **Backend**: Python server for AI processing

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Expo CLI](https://docs.expo.dev/workflow/expo-cli/)
- [Python](https://www.python.org/) 3.8+ (for backend)

## Setup Instructions

### Frontend Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/LiteCal.git
   cd LiteCal
   ```

2. Install dependencies:
   ```bash
   npm install
   ```
   
   This will install all the dependencies listed in package.json, including:
   - Expo and React Native
   - Firebase authentication
   - Calendar and file system utilities
   - UI components and navigation

3. Setup environment variables:
   Create a `.env` file in the main project folder with your API key and configurations:
   ```
   GEMINI_API_KEY==[THE KEY DON'T INCLUDE THE BRACKETS]
   ```

4. Start the app:
   ```bash
   npx expo start
   ```

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment (CRUCIAL MAKE THE VIRTUAL ENVIRONMENT):
   ```bash
   python -m venv venv
   source venv/bin/activate  #windows: venv\Scripts\activate
   ```

3. Install backend dependencies (usually pip but sometimes do pip3):
   ```bash
   pip install -r requirements.txt
   ```

4. Start the backend server (if python doesn't work python3 app.py):
   ```bash
   python app.py
   ```

## Features

- Natural language calendar event creation
- Event preview with date and time display
- Export calendar events as ICS files
- Add events directly to device calendar
- Voice input for event creation
- Image upload capability

## Troubleshooting

### Common Issues

1. **Module not found errors**: Make sure you've installed all dependencies with `npm install`.

2. **API Connection Issues**: Verify the backend server is running and the API_URL in the `.env` file is correct.

3. **Firebase Configuration**: Ensure you have the proper Firebase configuration in your constants folder.

## Development

To run the development server with hot reload:

```bash
npm start
```

For iOS:
```bash
npm run ios
```

For Android:
```bash
npm run android
```







