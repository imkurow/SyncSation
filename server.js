const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path')
const session = require('express-session')


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.use(session({
    secret: 'w4nFsLd3Xo7K9#1@0$G!bZqP*&yR', // Change this to a secure key
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        maxAge: 1000 * 60 * 60, // 1 hour session expiration
    },
}));

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'syncsation'
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed: ' + err.stack);
        return;
    }
    console.log('Connected to database.');
});


// Serve static files from the dist folder
app.use('/dist', express.static(path.join(__dirname, 'dist')));

// Register 
app.post('/register', async (req, res) => {
    const { first_name, last_name, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = 'INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)';
    db.query(sql, [first_name, last_name, email, hashedPassword], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: result.insertId, first_name, last_name, email });
    });
});

// Login endpoint
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ error: 'Internal server error.' });
        }

        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const user = results[0];
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Create session for user
        req.session.user = { id: user.id, first_name: user.first_name, last_name: user.last_name };
        
        // Send success response
        res.status(200).json({
            message: 'Login successful!',
            user: { first_name: user.first_name, last_name: user.last_name }
        });
    });
});



// check if user is logged in
function isAuthenticated(req, res, next) {
    console.log('Session:', req.session);
    if (req.session.user) {
        next();
    } else {
        res.redirect('/dist/NonUser/Login.html'); // Redirect to login page
    }
}

// Protected Route Example
app.get('/dist/User/Home.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist/User', 'Home.html')); // Serve HomeLogin HTML
});

app.get('/dist/FaceRecog.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'FaceRecog.html')); // Serve FaceRecog HTML
});

app.get('/session/user', (req, res) => {
    if (req.session.user) {
        res.status(200).json(req.session.user);
    } else {
        res.status(401).json({ error: 'User not logged in' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
