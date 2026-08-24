/**
 * E2EE Cryptography Utility for Chit Chat Telugu
 * 
 * Uses the native Web Crypto API for generating RSA-OAEP keys, 
 * encrypting/decrypting messages using a hybrid approach 
 * (AES-GCM for message content, RSA for AES key).
 */

// Generate a new RSA-OAEP Key Pair for the user
export const generateKeyPair = async () => {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
  return keyPair;
};

// Export public key to a Base64 string for storage on server
export const exportPublicKey = async (publicKey) => {
  const exported = await window.crypto.subtle.exportKey('spki', publicKey);
  const exportedAsString = String.fromCharCode.apply(null, new Uint8Array(exported));
  const exportedAsBase64 = window.btoa(exportedAsString);
  return `-----BEGIN PUBLIC KEY-----\n${exportedAsBase64}\n-----END PUBLIC KEY-----`;
};

// Export private key to a Base64 string for local storage
export const exportPrivateKey = async (privateKey) => {
  const exported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
  const exportedAsString = String.fromCharCode.apply(null, new Uint8Array(exported));
  const exportedAsBase64 = window.btoa(exportedAsString);
  return `-----BEGIN PRIVATE KEY-----\n${exportedAsBase64}\n-----END PRIVATE KEY-----`;
};

// Import public key from Base64 string
export const importPublicKey = async (pem) => {
  const b64 = pem.replace('-----BEGIN PUBLIC KEY-----', '').replace('-----END PUBLIC KEY-----', '').replace(/\n/g, '');
  const binaryDerString = window.atob(b64);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }
  
  return await window.crypto.subtle.importKey(
    'spki',
    binaryDer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );
};

// Import private key from Base64 string
export const importPrivateKey = async (pem) => {
  const b64 = pem.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\n/g, '');
  const binaryDerString = window.atob(b64);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }
  
  return await window.crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['decrypt']
  );
};

// Encrypt a message using recipient's public key (Hybrid encryption)
export const encryptMessage = async (text, recipientPublicKeyPem) => {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    // 1. Generate a random AES-GCM symmetric key
    const aesKey = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // 2. Encrypt the actual message with AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedMessage = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      data
    );

    // 3. Export the AES key
    const rawAesKey = await window.crypto.subtle.exportKey('raw', aesKey);

    // 4. Encrypt the AES key with the recipient's RSA public key
    const recipientPublicKey = await importPublicKey(recipientPublicKeyPem);
    const encryptedAesKey = await window.crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      recipientPublicKey,
      rawAesKey
    );

    // 5. Package everything into a Base64 payload
    const payload = {
      iv: window.btoa(String.fromCharCode.apply(null, iv)),
      key: window.btoa(String.fromCharCode.apply(null, new Uint8Array(encryptedAesKey))),
      data: window.btoa(String.fromCharCode.apply(null, new Uint8Array(encryptedMessage)))
    };
    
    return 'E2EE:' + JSON.stringify(payload);
  } catch (err) {
    console.error("Encryption error:", err);
    throw err;
  }
};

// Decrypt a message using my private key
export const decryptMessage = async (cipherPayload, myPrivateKeyPem) => {
  try {
    if (!cipherPayload.startsWith('E2EE:')) {
      return cipherPayload; // Not encrypted
    }
    
    const payloadStr = cipherPayload.substring(5);
    const payload = JSON.parse(payloadStr);

    const iv = new Uint8Array(window.atob(payload.iv).split('').map(c => c.charCodeAt(0)));
    const encryptedAesKey = new Uint8Array(window.atob(payload.key).split('').map(c => c.charCodeAt(0)));
    const encryptedMessage = new Uint8Array(window.atob(payload.data).split('').map(c => c.charCodeAt(0)));

    const myPrivateKey = await importPrivateKey(myPrivateKeyPem);

    // 1. Decrypt the AES key using my RSA private key
    const rawAesKey = await window.crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      myPrivateKey,
      encryptedAesKey
    );

    // 2. Import the decrypted AES key
    const aesKey = await window.crypto.subtle.importKey(
      'raw',
      rawAesKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // 3. Decrypt the actual message
    const decryptedMessageBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      encryptedMessage
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedMessageBuffer);
  } catch (err) {
    console.error("Decryption error:", err);
    return "🔒 [Encrypted Message - Could not decrypt]";
  }
};
