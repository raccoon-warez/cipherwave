# CipherWave Multi-Device Guide

## 🔐 **Decentralized Session Persistence**

CipherWave now supports secure multi-device access while maintaining complete privacy and decentralization. Your session data stays encrypted and synchronized across your trusted devices without any central server storing your information.

## 🎯 **Key Features**

### **✅ Zero-Knowledge Architecture**
- All data encrypted locally before synchronization
- No plaintext data ever leaves your devices
- Even infrastructure cannot access your information

### **✅ Device Trust Circle**
- QR code-based device pairing
- Cryptographic identity verification
- Gradual trust building through interactions
- Automatic device removal for security

### **✅ Real-Time Synchronization**
- Messages sync instantly across devices
- Contacts and preferences stay in sync
- Offline message queuing and delivery
- Conflict resolution for simultaneous changes

### **✅ Secure Recovery System**
- Shamir's Secret Sharing (3-of-5 threshold)
- Device consensus for recovery approval
- Multiple recovery scenarios supported
- No single point of failure

## 📱 **How to Use Multi-Device Features**

### **Adding a New Device**

1. **On Existing Device:**
   - Go to Profile → "Manage Devices"
   - Click "Add New Device"
   - Choose device type (Desktop, Mobile, Tablet, Web)
   - Generate QR code (expires in 5-30 minutes)

2. **On New Device:**
   - Open CipherWave
   - Click "Join Existing Account" 
   - Scan QR code or enter data manually
   - Wait for approval from existing device

3. **Approval Process:**
   - Existing device shows pairing request
   - Review device information and trust level
   - Approve or reject the new device
   - Automatic sync begins after approval

### **Managing Trusted Devices**

- **View All Devices:** See all connected devices with trust levels
- **Sync Control:** Configure what data syncs to each device
- **Trust Adjustment:** Trust levels change based on activity
- **Device Removal:** Remove compromised or lost devices
- **Manual Sync:** Force synchronization when needed

### **Recovery Options**

If you lose access to devices or forget passwords:

1. **Device Loss Recovery:**
   - Access from any remaining trusted device
   - Requires approval from 3 of your 5 trusted devices
   - Automatic recovery share reconstruction

2. **Password Reset:**
   - Initiate from any trusted device
   - Device consensus verification required
   - New password encrypts recovered identity

3. **Emergency Access:**
   - Time-limited recovery window
   - Requires majority device approval
   - Full audit trail maintained

## 🔧 **Technical Implementation**

### **Architecture Components**

1. **DeviceTrustManager** (`device-trust-manager.js`)
   - QR code generation and processing
   - Device authorization and trust scoring
   - Cryptographic device verification

2. **SyncCoordinator** (`sync-coordinator.js`)
   - Real-time P2P data synchronization
   - Vector clocks for conflict resolution
   - Batch and manual sync modes

3. **RecoveryManager** (`recovery-manager.js`)
   - Shamir's Secret Sharing implementation
   - Device consensus protocols
   - Multiple recovery workflows

4. **DevicePairingComponent** (`DevicePairingComponent.js`)
   - Modern device management UI
   - QR code scanning and generation
   - Device approval workflows

### **Security Model**

```
Master Identity (Ed25519)
├── Device Auth Keys (per device)
│   ├── Sync Encryption (X25519 + ChaCha20)
│   └── Recovery Shares (Shamir 3-of-5)
├── Message Encryption (session keys)
└── Storage Encryption (password-derived)
```

### **Data Synchronization**

- **Messages:** Encrypted content, signatures, metadata
- **Contacts:** Trust levels, interaction history
- **Preferences:** Sync settings, UI preferences  
- **Identity:** Trusted device list, recovery shares

## 🛡️ **Security Guarantees**

### **Privacy Protection**
- **Infrastructure Blindness:** Servers cannot read any user data
- **Forward Secrecy:** Past messages safe even if keys compromised
- **Selective Disclosure:** Users control sync granularity
- **Plausible Deniability:** No ownership links in storage

### **Threat Mitigation**
- **Device Compromise:** Limited blast radius, forward secrecy
- **Man-in-the-Middle:** Cryptographic identity verification
- **Data Correlation:** Content-addressed chunking obscures patterns
- **Denial of Service:** Rate limiting and proof-of-work

## 📊 **Storage Architecture**

### **Local Storage (per device)**
```
localStorage:
├── cipherwave_identity (encrypted)
├── cipherwave_trusted_devices (encrypted)
├── cipherwave_recovery_shares (encrypted)
└── cipherwave_vector_clocks (encrypted)

IndexedDB:
├── messages (double-encrypted)
├── conversations (encrypted metadata)
├── messageQueue (offline delivery)
└── contacts (encrypted contact data)
```

### **Network Layer**
```
WebSocket Signaling Server:
├── Connection coordination only
├── Room management (temporary)
├── WebRTC signaling data
└── NO user data storage

P2P WebRTC Channels:
├── Direct device-to-device
├── Encrypted sync messages
├── Real-time data updates
└── Recovery coordination
```

## 🚀 **Getting Started**

1. **Update CipherWave:** Multi-device features included automatically
2. **Login/Register:** Standard authentication process
3. **Access Device Management:** Profile → "Manage Devices"
4. **Add Devices:** Use QR codes or manual pairing
5. **Configure Sync:** Choose what data syncs to each device

## 🔍 **Troubleshooting**

### **Common Issues**

**QR Code Won't Scan:**
- Ensure good lighting and camera access
- Try manual data entry option
- Check QR code hasn't expired

**Device Won't Sync:**
- Check internet connection on both devices
- Verify devices are still trusted (trust level > 70%)
- Try manual sync from device management

**Recovery Not Working:**
- Ensure 3+ trusted devices are online
- Check recovery shares are properly distributed
- Verify device consensus approval process

**Performance Issues:**
- Reduce sync frequency in preferences
- Disable sync for large data types temporarily
- Clear message queue if too many pending items

### **Security Best Practices**

- **Regular Audits:** Review trusted devices monthly
- **Trust Hygiene:** Remove old/unused devices promptly  
- **Recovery Testing:** Verify recovery process works
- **Strong Passwords:** Use unique, strong passwords
- **Physical Security:** Secure devices with screen locks

## 📚 **API Reference**

For developers integrating with the multi-device system:

```javascript
// Access device trust manager
const trustManager = identityManager.deviceTrustManager;

// Generate pairing QR
const qr = await trustManager.generatePairingQR('DESKTOP', 10);

// Check device trust
const isTrusted = trustManager.isDeviceTrusted(deviceId, 70);

// Start sync with device  
await syncCoordinator.connectToDevice(deviceId);

// Initiate recovery
const recovery = await recoveryManager.initiateRecovery('device_lost');
```

## 🎉 **Benefits Summary**

### **For Users:**
- ✅ Access messages and contacts from any device
- ✅ Automatic synchronization with offline support
- ✅ Secure device management with trust levels
- ✅ Recovery options for lost devices/passwords
- ✅ Complete privacy and decentralization

### **For Developers:**
- ✅ Clean, modular architecture
- ✅ Comprehensive security model
- ✅ Extensible sync protocols
- ✅ Modern cryptographic practices
- ✅ Zero-knowledge by design

---

**CipherWave Multi-Device:** Secure session persistence without compromising privacy or decentralization. Your data stays yours, synchronized securely across all your trusted devices.