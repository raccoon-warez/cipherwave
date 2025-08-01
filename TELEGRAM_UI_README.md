# CipherWave Telegram-like UI

This is an updated version of the CipherWave application with a Telegram-like user interface. The UI has been completely redesigned to provide a more modern, intuitive messaging experience similar to Telegram.

## Features

- **Telegram-like Interface**: Clean, modern design with a sidebar for chat rooms and a main chat area
- **Splash Screen**: Animated loading screen with CipherWave branding
- **Connection Modal**: Elegant modal for joining chat rooms with nickname and avatar selection
- **Message Bubbles**: Distinct message bubbles for sent and received messages with avatars
- **Responsive Design**: Works on both desktop and mobile devices
- **Real-time Messaging**: Secure peer-to-peer messaging using WebRTC
- **Encryption**: Multiple cipher options (AES-256, RSA, ChaCha20) for end-to-end encryption

## UI Components

### 1. Splash Screen
- Animated loading screen with CipherWave logo
- Smooth transition to main interface

### 2. Sidebar
- User avatar with online status indicator
- Chat room list with previews and unread message counters
- Floating action button for creating new chats

### 3. Chat Area
- Chat header with contact information and online status
- Message history with distinct bubbles for sent/received messages
- Message input area with attachment options and send button

### 4. Connection Modal
- Form for entering nickname, selecting avatar, room ID, and encryption cipher
- Room ID generation button
- Connect button to join chat rooms

## Technical Implementation

### Frontend
- **HTML5**: Semantic markup for the application structure
- **CSS3**: Modern styling with variables, flexbox, and animations
- **JavaScript**: WebRTC implementation for peer-to-peer communication
- **CryptoJS**: Client-side encryption library

### Backend
- **Node.js**: Server-side runtime environment
- **WebSocket**: Signaling server for WebRTC connection establishment
- **HTTP Server**: Static file serving for the web interface

## How to Use

1. **Start the Server**:
   ```bash
   npm start
   ```

2. **Open the Application**:
   Navigate to `http://localhost:8080` in your browser

3. **Create a Chat Room**:
   - Click the "New Chat" button (floating action button)
   - Enter a nickname
   - Select an avatar
   - Generate or enter a room ID
   - Select an encryption cipher
   - Click "Connect"

4. **Join an Existing Chat Room**:
   - On another device/browser, open the application
   - Click the "New Chat" button
   - Enter the same room ID as the first user
   - Select the same encryption cipher
   - Click "Connect"

5. **Start Messaging**:
   - Type your message in the input field at the bottom
   - Press Enter or click the send button to send
   - Messages will appear in real-time in both chat windows

## File Structure

```
www/
├── index.html          # Main HTML file with Telegram-like UI
├── styles.css          # Telegram-like styling
├── script.js           # JavaScript for WebRTC and UI interactions
├── js/
│   └── crypto-js.min.js  # Encryption library
├── test-webrtc.html    # WebRTC testing page
└── test-webrtc-connection.js  # WebRTC testing script
```

## Design Elements

### Color Scheme
- Primary: #5682a3 (Telegram-like blue)
- Background: #ffffff (Clean white)
- Message Bubbles: 
  - Received: #f0f4f8
  - Sent: #e3f2fd
- Status Indicators: 
  - Online: #4caf50 (Green)
  - Away: #ff9800 (Orange)
  - Offline: #9e9e9e (Gray)

### Typography
- Font: Inter (with fallbacks to system fonts)
- Sizes: Responsive sizing for different elements
- Weights: 400 (Regular), 500 (Medium), 600 (Semi-bold), 700 (Bold)

### Spacing System
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px

### Border Radius
- sm: 4px
- md: 8px
- lg: 16px
- pill: 24px
- circle: 50%

## Security Features

- **End-to-End Encryption**: All messages are encrypted before transmission
- **Multiple Cipher Options**: Choose between AES-256, RSA, or ChaCha20
- **No Server Storage**: Messages are never stored on any server
- **Peer-to-Peer Communication**: Direct communication between browsers

## Browser Support

The application works in all modern browsers that support WebRTC:
- Chrome 70+
- Firefox 60+
- Safari 12+
- Edge 79+

## Mobile Support

The application is fully responsive and works on mobile devices. It can also be built as a native mobile app using Capacitor.

## Development

To modify the application:

1. Edit the HTML in `www/index.html`
2. Update styles in `www/styles.css`
3. Modify JavaScript functionality in `www/script.js`
4. Run `node build-web.js` to copy files to the www directory
5. Start the server with `npm start`

## Testing

To test WebRTC functionality:
1. Navigate to `http://localhost:8080/test-webrtc.html`
2. Click "Run WebRTC Test"
3. Check the log for test results

## Troubleshooting

### Connection Issues
- Ensure both users are using the same room ID
- Verify both users selected the same encryption cipher
- Check that the signaling server is running
- Ensure both browsers support WebRTC

### Encryption Issues
- Make sure both users selected the same cipher
- Verify that the CryptoJS library is loaded correctly
- Check the browser console for encryption errors

### UI Issues
- Ensure you're using a modern browser
- Check that all CSS files are loaded correctly
- Verify that JavaScript is enabled in your browser

## Future Improvements

- Add support for file transfers
- Implement message reactions
- Add voice and video calling
- Include group chat functionality
- Add message search capabilities
- Implement message forwarding
- Add chat themes and customization options
