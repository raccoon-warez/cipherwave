// ============================================================
// Signal Protocol - Double Ratchet Key Exchange
// ============================================================
import { randomBytes, createHash, createHmac } from 'node:crypto';
import type {
  SignalIdentity,
  SignalKeyPair,
  SignalPreKey,
  SignalSignedPreKey,
} from '../types';
import { AES256GCM } from './engine';

// DH chain: used for ratcheting keys
interface DHChain {
  inputKey: Buffer;
  chainKey: Buffer;
  chainCounter: number;
}

// Sending chain: produces message keys
interface SendingChain {
  chainKey: Buffer;
  counter: number;
}

// Receiving chain
interface ReceivingChain {
  chainKey: Buffer;
  counter: number;
}

// SignalState stores the ratchet state for a peer
export interface SignalState {
  chain: DHChain;
  sendingChains: Map<number, SendingChain>;
  receivingChain: ReceivingChain | null;
  receivingChainIndex: number;
  lastRemotePreKey: SignalKeyPair | null;
  pendingMessageKey: Buffer | null;
}

export class SignalProtocol {
  private identity: SignalIdentity;
  private state: Map<string, SignalState> = new Map();
  private oneTimePreKeys: Map<number, SignalKeyPair> = new Map();

  constructor() {
    // Generate or load identity
    const regId = Math.floor(Math.random() * 65536);
    this.identity = {
      registrationId: regId,
      identityKeyPair: this.generateKeyPairSync(),
      signedKeyPair: this.generateKeyPairSync(),
    };
    // Generate 100 one-time prekeys
    for (let i = 0; i < 100; i++) {
      this.oneTimePreKeys.set(i, this.generateKeyPairSync());
    }
  }

  getIdentityKey(): SignalKeyPair {
    return this.identity.identityKeyPair;
  }

  getSignedPreKey(): SignalSignedPreKey {
    const pair = this.identity.signedKeyPair;
    return {
      id: 0, // Signed prekey ID is always 0
      keyPair: pair,
      signature: this.signKey(pair),
    };
  }

  getOneTimePreKeys(): SignalPreKey[] {
    const keys: SignalPreKey[] = [];
    for (const [id, pair] of this.oneTimePreKeys) {
      keys.push({ id, keyPair: pair });
    }
    return keys;
  }

  removeOneTimePreKey(id: number): SignalKeyPair | undefined {
    return this.oneTimePreKeys.get(id);
  }

  // --- Key Exchange ---

  async createKeyExchangeMessage(targetState: SignalState): Promise<{
    type: 'key-exchange';
    registrationId: number;
    signedPreKey: SignalSignedPreKey;
    baseKey: SignalKeyPair;
    message: string;
    mac: string;
  }> {
    const baseKey = this.generateKeyPairSync();
    const ephemeralKey = this.generateKeyPairSync();

    // DH: identity key -> target's signed prekey
    const dh1 = await this.computeDH(
      this.identity.signedKeyPair,
      targetState.chain.inputKey
    );

    // DH: ephemeral key -> target's identity key
    const dh2 = await this.computeDH(
      ephemeralKey,
      this.identity.identityKeyPair
    );

    // DH: base key -> target's last remote prekey
    let dh3: Buffer | null = null;
    if (targetState.lastRemotePreKey) {
      dh3 = await this.computeDH(baseKey, targetState.lastRemotePreKey);
    }

    // DH: ephemeral key -> target's chain input key
    const dh4 = await this.computeDH(
      ephemeralKey,
      targetState.chain.inputKey
    );

    // DK: derive master key from all DH results
    const masterKey = this.deriveKeys([dh1, dh2, dh3, dh4].filter(Boolean) as Buffer[]);

    // Encrypt the key exchange message
    const plaintext = JSON.stringify({
      type: 'key-exchange',
      timestamp: Date.now(),
      registrationId: this.identity.registrationId,
    });

    const { ciphertext, tag, nonce } = await AES256GCM.encrypt(plaintext, await this.cryptoKeyFromBuffer(masterKey));

    const mac = this.computeMac(
      baseKey,
      this.identity.signedKeyPair,
      dh1,
      dh2,
      dh3,
      masterKey
    );

    return {
      type: 'key-exchange',
      registrationId: this.identity.registrationId,
      signedPreKey: this.getSignedPreKey(),
      baseKey,
      message: Buffer.concat([ciphertext, tag, nonce]).toString('base64'),
      mac: mac.toString('base64'),
    };
  }

  async processKeyExchange(_exchange: {
    baseKey: SignalKeyPair;
    signedPreKey: SignalSignedPreKey;
    message: string;
    mac: string;
  }): Promise<void> {
    // TODO: verify MAC, derive keys, set up ratchet
  }

  // --- Message Encryption/Decryption ---

  async createMessage(message: string, peerId: string): Promise<{
    ciphertext: Buffer;
    counter: number;
  }> {
    let signalState = this.state.get(peerId);
    if (!signalState) {
      signalState = this.initializeState(peerId);
    }

    let chain = signalState.sendingChains.get(0);
    if (!chain) {
      // Seed a new sending chain from the DH chain state.
      chain = { chainKey: signalState.chain.chainKey, counter: signalState.chain.chainCounter };
    }
    const messageKey = this.getMessageKey(chain.chainKey, chain.counter);

    const { ciphertext, tag, nonce } = await AES256GCM.encrypt(
      message,
      await this.cryptoKeyFromBuffer(messageKey),
      randomBytes(12)
    );

    // Push forward the chain
    chain.chainKey = this.getChainKey(messageKey);
    chain.counter++;

    signalState.sendingChains.set(0, chain);
    this.state.set(peerId, signalState);

    return {
      ciphertext: Buffer.concat([ciphertext, tag, nonce]),
      counter: chain.counter,
    };
  }

  async decryptMessage(ciphertext: Buffer, peerId: string): Promise<string> {
    const signalState = this.state.get(peerId);
    if (!signalState || !signalState.receivingChain) {
      throw new Error('No receiving chain established');
    }

    const messageKey = this.getMessageKey(
      signalState.receivingChain.chainKey,
      signalState.receivingChain.counter
    );

    const plaintext = await AES256GCM.decrypt(
      ciphertext.subarray(0, -28),
      await this.cryptoKeyFromBuffer(messageKey),
      ciphertext.subarray(ciphertext.length - 12),
      ciphertext.subarray(12, 28)
    );

    signalState.receivingChain.chainKey = this.getChainKey(messageKey);
    signalState.receivingChain.counter++;
    this.state.set(peerId, signalState);

    return plaintext;
  }

  // --- Ratchet ---

  createRatchetMessage(peerId: string): Buffer {
    const signalState = this.state.get(peerId);
    if (!signalState) throw new Error('No state for peer');

    const chain = signalState.sendingChains.get(0);
    if (!chain) throw new Error('No sending chain');

    const messageKey = this.getMessageKey(chain.chainKey, chain.counter);

    chain.chainKey = this.getChainKey(messageKey);
    chain.counter++;

    this.state.set(peerId, signalState);

    return messageKey;
  }

  // --- Key Derivation ---

  private deriveKeys(dhResults: Buffer[]): Buffer {
    let key: Buffer = Buffer.from([0x01]); // DK function
    for (const dh of dhResults) {
      key = this.kdf16(key, dh);
    }
    return key;
  }

  private kdf16(key: Buffer, data: Buffer): Buffer {
    return createHmac('sha256', key).update(data).digest();
  }

  private getMessageKey(chainKey: Buffer, counter: number): Buffer {
    const counterBytes = Buffer.alloc(4);
    counterBytes.writeUInt32BE(counter, 0);
    return createHmac('sha256', chainKey).update(counterBytes).digest();
  }

  private getChainKey(messageKey: Buffer): Buffer {
    return createHmac('sha256', messageKey).update(Buffer.from([0x01])).digest();
  }

  private computeMac(
    baseKey: SignalKeyPair,
    signedPreKey: SignalKeyPair,
    dh1: Buffer,
    dh2: Buffer,
    dh3: Buffer | null,
    masterKey: Buffer
  ): Buffer {
    const data = Buffer.concat([
      baseKey.publicKey,
      signedPreKey.publicKey,
      dh1,
      dh2,
      ...(dh3 ? [dh3] : []),
      masterKey,
    ]);
    return createHmac('sha256', masterKey).update(data).digest();
  }

  // --- Helpers ---

  private generateKeyPairSync(): SignalKeyPair {
    return {
      publicKey: randomBytes(32),
      privateKey: randomBytes(32),
    };
  }

  private async computeDH(local: SignalKeyPair, remote: SignalKeyPair | Buffer): Promise<Buffer> {
    // Simplified X25519 - in production use sodium-native or @noble/curves
    // This is a placeholder for the DH computation
    const remotePublic = Buffer.isBuffer(remote) ? remote : remote.publicKey;
    const combined = Buffer.concat([local.privateKey, remotePublic]);
    return createHash('sha256').update(combined).digest();
  }

  private signKey(keyPair: SignalKeyPair): string {
    const data = Buffer.concat([
      Buffer.from([0x05]), // signature type
      keyPair.publicKey,
    ]);
    // Simplified signature - use sodium-native in production
    return createHmac('sha256', keyPair.privateKey)
      .update(data)
      .digest('hex');
  }

  private initializeState(peerId: string): SignalState {
    const state: SignalState = {
      chain: {
        inputKey: randomBytes(32),
        chainKey: randomBytes(32),
        chainCounter: 0,
      },
      sendingChains: new Map(),
      receivingChain: null,
      receivingChainIndex: 0,
      lastRemotePreKey: null,
      pendingMessageKey: null,
    };
    this.state.set(peerId, state);
    return state;
  }

  private async cryptoKeyFromBuffer(buffer: Buffer): Promise<CryptoKey> {
    const bytes = new Uint8Array(buffer.length);
    bytes.set(buffer);
    return await crypto.subtle.importKey(
      'raw',
      bytes,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
}

// Export singleton
export const signalProtocol = new SignalProtocol();
