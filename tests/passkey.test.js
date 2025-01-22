// Test delle Passkey rimossi perché:
// 1. WebAuthn/Passkey è una tecnologia specifica del browser
// 2. Richiede hardware reale (TPM, secure enclave, ecc.)
// 3. È difficile mockare in modo significativo in Node.js
//
// Per testare le Passkey, usa l'esempio HTML in examples/passkey-auth/ 