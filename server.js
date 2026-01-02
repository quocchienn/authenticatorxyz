require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const otplib = require('otplib');
const CryptoJS = require('crypto-js');
const bodyParser = require('body-parser');
const cors = require('cors');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));  // Serve frontend

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schema cho Account
const accountSchema = new mongoose.Schema({
  name: String,
  issuer: String,
  secret: String,  // Encrypted
});

const Account = mongoose.model('Account', accountSchema);

// Encrypt/Decrypt functions
const encrypt = (text) => CryptoJS.AES.encrypt(text, process.env.ENCRYPT_KEY).toString();
const decrypt = (ciphertext) => CryptoJS.AES.decrypt(ciphertext, process.env.ENCRYPT_KEY).toString(CryptoJS.enc.Utf8);

// API: Get all accounts with TOTP
app.get('/accounts', async (req, res) => {
  try {
    const accounts = await Account.find();
    const results = accounts.map(acc => ({
      _id: acc._id,
      name: acc.name,
      issuer: acc.issuer,
      totp: otplib.authenticator.generate(decrypt(acc.secret)),
      timeRemaining: otplib.authenticator.timeRemaining(),
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Add account
app.post('/add-account', async (req, res) => {
  try {
    let { name, issuer, secret } = req.body;
    if (!secret) throw new Error('Secret required');

    // Parse otpauth URI if provided
    if (secret.startsWith('otpauth://')) {
      const url = new URL(secret);
      secret = url.searchParams.get('secret');
      issuer = url.searchParams.get('issuer') || issuer;
      name = decodeURIComponent(url.pathname.replace(/^\/totp\//, '')) || name;
    }

    const encryptedSecret = encrypt(secret);
    const newAccount = new Account({ name, issuer, secret: encryptedSecret });
    await newAccount.save();
    res.json({ message: 'Account added' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// API: Delete account
app.delete('/account/:id', async (req, res) => {
  try {
    await Account.findByIdAndDelete(req.params.id);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Generate QR (optional, if frontend needs)
app.post('/generate-qr', (req, res) => {
  const { secret, name, issuer } = req.body;
  const otpauth = otplib.authenticator.keyuri(name, issuer, secret);
  QRCode.toDataURL(otpauth, (err, url) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ qrUrl: url });
  });
});

// Fallback to serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
