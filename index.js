const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
const bcrypt = require('bcryptjs');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// --- DANGER: HARDCODED CREDENTIALS START ---
// WARNING: This exposes your sensitive information directly in your codebase.
// This is NOT recommended for any real-world application or public repository.

// MongoDB Connection URI (Hardcoded)
const MONGODB_URI = "mongodb+srv://ernestchukwuwikeifeadike:DyUbEGFz0mm1lA86@cluster1.dsa5czd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1";

// Gmail SMTP Credentials (Hardcoded)
const GMAIL_USER = 'carolinamichael28@gmail.com';
const GMAIL_APP_PASSWORD = 'oybz rjks tfqf mvom'; // This is a Google App Password

// --- DANGER: HARDCODED CREDENTIALS END ---


// --- Global Error Handling for Robustness ---
// Catches unhandled promise rejections (async errors not caught by try...catch)
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Application specific logging, cleanup, or exit.
    // In a production app, you might use a dedicated error monitoring tool.
    // For this example, we'll log and let the process continue for now,
    // but a robust app might choose to exit and rely on process manager to restart.
});

// Catches uncaught exceptions (synchronous errors not caught by try...catch)
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Perform synchronous cleanup if necessary, then exit.
    // Process should exit after uncaught exception to avoid inconsistent state.
    process.exit(1);
});


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// --- MongoDB Connection Setup ---
const client = new MongoClient(MONGODB_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let usersCollection; // To store a reference to the users collection

async function connectToMongoDB() {
    try {
        console.log('Attempting to connect to MongoDB...');
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("Successfully connected to MongoDB Atlas!");

        const db = client.db('auth_db'); // Use your desired database name
        usersCollection = db.collection('users'); // Use your desired collection name

        // Ensure email is unique (good practice for user management)
        await usersCollection.createIndex({ email: 1 }, { unique: true });
        console.log("MongoDB 'users' collection ready with unique email index.");

    } catch (error) {
        console.error('CRITICAL ERROR: Failed to connect to MongoDB or initialize collection:', error);
        console.error('Server cannot start without database connection. Exiting process.');
        process.exit(1); // Exit if database connection fails
    }
}

// Connect to MongoDB when the server starts
connectToMongoDB();

// Nodemailer Transporter Setup
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD
    },
    // Optional: Add a timeout for email sending to prevent hanging
    // This timeout is for the connection to the SMTP server, not the email being delivered.
    connectionTimeout: 15000, // 15 seconds
    greetingTimeout: 10000,   // 10 seconds
    socketTimeout: 30000      // 30 seconds
});

// Function to generate a secure 6-digit alphanumeric OTP
function generateOtp() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let otp = '';
    for (let i = 0; i < 6; i++) {
        otp += chars[Math.floor(Math.random() * chars.length)];
    }
    return otp;
}

// Endpoint 1: POST /request-otp
app.post('/request-otp', async (req, res) => {
    const { email, username, password } = req.body;
    if (!email || !username || !password) {
        return res.status(400).send('Email, username, and password are required.');
    }
    const otp = generateOtp();
    const passwordHash = await bcrypt.hash(password, 10);

    const mailOptions = {
        from: GMAIL_USER,
        to: email,
        subject: 'Your One-Time Password (OTP) for Verification',
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2>Your One-Time Password (OTP)</h2>
                <p>Hello,</p>
                <p>You requested a One-Time Password for verification. Please use the following code:</p>
                <h3 style="background-color: #f2f2f2; padding: 10px; border-radius: 5px; text-align: center; font-size: 24px; letter-spacing: 2px;">
                    <strong>${otp}</strong>
                </h3>
                <p>This OTP is valid for a single use and for a limited time (1 minute).</p>
                <p>If you did not request this OTP, please ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #eee;">
                <p style="font-size: 0.9em; color: #777;">Thank you,<br>Your Authentication System</p>
            </div>
        `
    };

    try {
        console.log(`Sending OTP to ${email}...`);
        await transporter.sendMail(mailOptions);
        console.log('OTP email sent successfully to', email);

        const otpFormHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>OTP Verification</title>
                <style>
                    .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; transition: opacity 0.3s ease-in-out; opacity: 1; }
                    .modal-content { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2); text-align: center; max-width: 400px; width: 90%; animation: fadeInScale 0.3s ease-out; }
                    @keyframes fadeInScale { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                    .modal-content h2 { color: #333; margin-bottom: 15px; }
                    .modal-content p { color: #666; margin-bottom: 20px; }
                    .modal-content input[type="text"] { width: calc(100% - 20px); padding: 10px; margin: 15px 0; border: 1px solid #ccc; border-radius: 4px; font-size: 16px; text-align: center; }
                    .modal-content button { background-color: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; transition: background-color 0.3s ease; }
                    .modal-content button:hover { background-color: #0056b3; }
                    .message { margin-top: 20px; padding: 10px; border-radius: 4px; display: block; font-weight: bold; }
                    .message.success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                    .message.error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                    .message.info { background-color: #cce5ff; color: #004085; border: 1px solid #b8daff; }
                </style>
            </head>
            <body>
                <div class="modal-overlay" id="otpModalOverlay">
                    <div class="modal-content">
                        <h2>Verify Your Email</h2>
                        <p>A 6-digit OTP has been sent to <strong>${email}</strong>. Please enter it below:</p>
                        <input type="text" id="otpInput" placeholder="Enter 6-digit OTP" maxlength="6" autocomplete="off">
                        <button id="verifyOtpBtn">Verify OTP</button>
                        <div id="messageDisplay" class="message info">OTP expires in <span id="countdown">60</span> seconds.</div>
                    </div>
                </div>

                <script>
                    localStorage.setItem('otpCode', '${otp}');
                    localStorage.setItem('tempUserEmail', '${email}');
                    localStorage.setItem('tempUsername', '${username}');
                    localStorage.setItem('tempPasswordHash', '${passwordHash}');

                    const otpInput = document.getElementById('otpInput');
                    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
                    const messageDisplay = document.getElementById('messageDisplay');
                    const otpModalOverlay = document.getElementById('otpModalOverlay');
                    const countdownSpan = document.getElementById('countdown');

                    otpInput.focus();
                    let timeLeft = 60; // Increased to 1 minute
                    let countdownInterval;

                    function startCountdown() {
                        countdownInterval = setInterval(() => {
                            timeLeft--;
                            countdownSpan.textContent = timeLeft;
                            if (timeLeft <= 0) {
                                clearInterval(countdownInterval);
                                messageDisplay.className = 'message error';
                                messageDisplay.innerHTML = 'OTP timed out. Please <a href="/" onclick="window.location.reload(); return false;">request a new OTP</a>.';
                                verifyOtpBtn.disabled = true;
                                otpInput.disabled = true;
                                localStorage.removeItem('otpCode');
                                localStorage.removeItem('tempUserEmail');
                                localStorage.removeItem('tempUsername');
                                localStorage.removeItem('tempPasswordHash');
                            }
                        }, 1000);
                    }
                    startCountdown();

                    verifyOtpBtn.addEventListener('click', async () => {
                        const userEnteredOtp = otpInput.value.trim();
                        const storedOtp = localStorage.getItem('otpCode');

                        if (!userEnteredOtp) { messageDisplay.className = 'message error'; messageDisplay.textContent = 'Please enter the OTP.'; return; }

                        if (userEnteredOtp === storedOtp) {
                            clearInterval(countdownInterval);
                            messageDisplay.className = 'message success';
                            messageDisplay.textContent = 'OTP verified successfully! Processing registration/login...';
                            verifyOtpBtn.disabled = true;
                            otpInput.disabled = true;

                            const tempEmail = localStorage.getItem('tempUserEmail');
                            const tempUsername = localStorage.getItem('tempUsername');
                            const tempPasswordHash = localStorage.getItem('tempPasswordHash');

                            try {
                                const response = await fetch('https://sgtdjbgczgg.onrender.com/register-and-verify', { // Ensure this URL matches your deployed server
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ email: tempEmail, username: tempUsername, passwordHash: tempPasswordHash })
                                });
                                const result = await response.json();
                                if (response.ok) {
                                    messageDisplay.className = 'message success';
                                    messageDisplay.textContent = result.message || 'Verification successful!';
                                    localStorage.removeItem('otpCode');
                                    localStorage.removeItem('tempUserEmail');
                                    localStorage.removeItem('tempUsername');
                                    localStorage.removeItem('tempPasswordHash');
                                    setTimeout(() => {
                                        otpModalOverlay.style.opacity = '0';
                                        setTimeout(() => {
                                            otpModalOverlay.style.display = 'none';
                                            alert(result.message || 'Action successful!');
                                            window.location.reload();
                                        }, 300);
                                    }, 1500);
                                } else {
                                    messageDisplay.className = 'message error';
                                    messageDisplay.textContent = result.message || 'Server error during registration/verification.';
                                    verifyOtpBtn.disabled = false;
                                    otpInput.disabled = false;
                                    otpInput.value = '';
                                }
                            } catch (error) {
                                console.error('Error during registration/verification request:', error);
                                messageDisplay.className = 'message error';
                                messageDisplay.textContent = 'Network error during registration/verification. Please try again.';
                                verifyOtpBtn.disabled = false;
                                otpInput.disabled = false;
                                otpInput.value = '';
                            }
                        } else {
                            messageDisplay.className = 'message error';
                            messageDisplay.textContent = 'Invalid OTP. Please try again.';
                            otpInput.value = '';
                        }
                    });
                </script>
            </body>
            </html>
        `;
        res.send(otpFormHtml);
    } catch (error) {
        console.error('Error sending OTP email:', error);
        res.status(500).send('Failed to send OTP. Please try again later.');
    }
});

// Endpoint 2: POST /register-and-verify
app.post('/register-and-verify', async (req, res) => {
    const { email, username, passwordHash } = req.body;
    if (!email || !username || !passwordHash) {
        return res.status(400).json({ success: false, message: 'Email, username, and hashed password are required for registration.' });
    }
    if (!usersCollection) {
        console.error('usersCollection is not initialized in /register-and-verify');
        return res.status(500).json({ success: false, message: 'Database not initialized.' });
    }
    try {
        const existingUser = await usersCollection.findOne({ email: email });
        if (existingUser) {
            await usersCollection.updateOne({ email: email }, { $set: { lastVerifiedAt: new Date() } });
            return res.status(200).json({ success: true, message: 'User already exists and verified.', userExists: true });
        } else {
            await usersCollection.insertOne({
                email: email,
                username: username,
                passwordHash: passwordHash,
                createdAt: new Date(),
                lastVerifiedAt: new Date()
            });
            return res.status(201).json({ success: true, message: 'New user registered and verified.', userExists: false });
        }
    } catch (error) {
        console.error('Error saving user to MongoDB:', error);
        if (error.code === 11000) { return res.status(409).json({ success: false, message: 'An account with this email already exists.' }); }
        return res.status(500).json({ success: false, message: 'Failed to save credentials to database.' });
    }
});

// Endpoint 3: POST /login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }
    if (!usersCollection) {
        console.error('usersCollection is not initialized in /login');
        return res.status(500).json({ success: false, message: 'Database not initialized.' });
    }
    try {
        const user = await usersCollection.findOne({ email: email });
        if (!user) { return res.status(404).json({ success: false, message: 'User not found. Please sign up.' }); }
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (isMatch) {
            await usersCollection.updateOne({ email: email }, { $set: { lastLoginAt: new Date() } });
            return res.status(200).json({ success: true, message: 'Login successful!', username: user.username, email: user.email });
        } else {
            return res.status(401).json({ success: false, message: 'Incorrect password.' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({ success: false, message: 'An error occurred during login.' });
    }
});

// Endpoint 4: GET /users
app.get('/users', async (req, res) => {
    if (!usersCollection) {
        console.error('usersCollection is not initialized in /users');
        return res.status(500).json({ success: false, message: 'Database not initialized.' });
    }
    try {
        const users = await usersCollection.find({}, { projection: { passwordHash: 0 } }).toArray();
        const formattedUsers = users.map(user => ({
            email: user.email, username: user.username,
            createdAt: user.createdAt ? user.createdAt.toISOString() : 'N/A',
            lastVerifiedAt: user.lastVerifiedAt ? user.lastVerifiedAt.toISOString() : 'N/A',
            lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : 'N/A'
        }));
        return res.status(200).json({ success: true, users: formattedUsers });
    } catch (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch users.' });
    }
});

// Endpoint 5: DELETE /users/:email
app.delete('/users/:email', async (req, res) => {
    const { email } = req.params;
    if (!email) { return res.status(400).json({ success: false, message: 'Email parameter is required for deletion.' }); }
    if (!usersCollection) {
        console.error('usersCollection is not initialized in /users/:email (DELETE)');
        return res.status(500).json({ success: false, message: 'Database not initialized.' });
    }
    try {
        const result = await usersCollection.deleteOne({ email: email });
        if (result.deletedCount === 0) { return res.status(404).json({ success: false, message: 'User with this email not found.' }); }
        return res.status(200).json({ success: true, message: `User ${email} deleted successfully.` });
    } catch (error) {
        console.error('Error deleting user from MongoDB:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete user from database.' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Access the application at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Server received SIGINT. Shutting down gracefully.');
    if (client) {
        await client.close();
        console.log('MongoDB connection closed.');
    }
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('Server received SIGTERM. Shutting down gracefully.');
    if (client) {
        await client.close();
        console.log('MongoDB connection closed.');
    }
    process.exit(0);
});