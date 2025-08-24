# 🌐 CipherWave - Usage Guide

## ✅ Quick Start

### 1. Start the Development Server
```bash
npm run dev
```
This runs both:
- **Frontend (Vite)**: http://localhost:3000/
- **Backend (WebSocket)**: ws://localhost:52178/

### 2. Open in Browser
🔗 Navigate to: **http://localhost:3000/**

⚠️ **Important**: CipherWave runs in the browser, not in Node.js terminal!

## 🚀 How to Use

### Creating a New Network
1. Open http://localhost:3000/ in your browser
2. Click **"Generate"** to create a random room ID
3. Click **"Connect Securely"** 
4. You'll see: "🎉 Network created successfully!"
5. Share the room ID with others to join

### Joining an Existing Network  
1. Open http://localhost:3000/ in another browser tab/window
2. Enter the room ID from the network creator
3. Click **"Connect Securely"**
4. You'll see: "🎉 Successfully joined the network!"

### Chatting
1. Once connected, type your message in the input field
2. Press **Enter** or click **Send**
3. Messages appear instantly with timestamps
4. Both encrypted and plain text messaging supported

## 🔧 Features

- ✨ **Create Networks**: Generate secure P2P networks
- 🔗 **Join Networks**: Connect to existing networks with room ID
- 💬 **Real-time Chat**: Instant messaging between peers
- 🔐 **Encryption**: End-to-end encryption support
- 📱 **Responsive UI**: Works on desktop, tablet, and mobile
- 🎨 **Telegram-like Interface**: Modern, professional design

## 🛠️ Troubleshooting

### "RTCPeerConnection is not defined"
- **Solution**: Use a web browser, not Node.js terminal
- Open http://localhost:3000/ in Chrome, Firefox, Safari, or Edge

### Connection Issues
- Check browser console (F12) for detailed logs
- Ensure both peers are using the same room ID
- Try refreshing the page and reconnecting

### Chat Not Working
- Verify both peers show "🟢 Connected - Ready to chat!"
- Check that data channel is open (see console logs)
- Try sending a test message

## 🌟 Browser Compatibility

✅ **Supported Browsers**:
- Chrome 90+
- Firefox 88+  
- Safari 14+
- Edge 90+

❌ **Not Supported**:
- Node.js terminal
- Internet Explorer
- Very old browser versions

## 📝 Development

- **Frontend**: Vanilla JavaScript with Vite
- **Backend**: Node.js WebSocket signaling server
- **P2P**: WebRTC for direct peer connections
- **Encryption**: crypto-js, libsodium-wrappers
- **UI Framework**: Custom CSS with Telegram-like design

Enjoy secure P2P messaging with CipherWave! 🎉