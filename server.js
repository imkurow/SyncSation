const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path')
const session = require('express-session');
const SpotifyWebApi = require('spotify-web-api-node');


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


const spotifyApi = new SpotifyWebApi({
    clientId: 'a4c8819ddee947b08c70c3473efda476',
    clientSecret: '1ff6e5967c7f43989f0e33a311a112f2',
    redirectUri: 'http://localhost:3000/callback'
  });
  
  // token endpoint
  app.get('/spotify/token', async (req, res) => {
    try {
      console.log('Getting Spotify token...');
      const data = await spotifyApi.clientCredentialsGrant();
      console.log('Token received:', data.body['access_token']);
      spotifyApi.setAccessToken(data.body['access_token']);
      res.json({ token: data.body['access_token'] });
    } catch (error) {
      console.error('Error getting token:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  
  // Endpoint untuk mendapatkan playlist berdasarkan mood
  app.get('/spotify/mood-playlist/:mood', async (req, res) => {
    try {
      const mood = req.params.mood;
      console.log('Fetching playlist for mood:', mood);
      
      // Pastikan token masih valid
      if (!spotifyApi.getAccessToken()) {
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body['access_token']);
      }
  
      let searchQuery;
      switch(mood) {
        case 'happy':
          searchQuery = 'mood:happy genre:pop';
          break;
        case 'sad':
          searchQuery = 'mood:sad genre:indie';
          break;
        case 'furious':
          searchQuery = 'genre:rock genre:metal';
          break;
        case 'meh':
          searchQuery = 'genre:chill mood:peaceful';
          break;
        default:
          searchQuery = 'genre:pop';
      }
  
      console.log('Search query:', searchQuery);
      const data = await spotifyApi.searchTracks(searchQuery, { limit: 50 });
      res.json(data.body.tracks.items);
    } catch (error) {
      console.error('Error getting playlist:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/spotify/playlist/:type', async (req, res) => {
    try {
        const vibeType = req.params.type;
        console.log('Fetching playlist for vibe:', vibeType);
        
        if (!spotifyApi.getAccessToken()) {
            const data = await spotifyApi.clientCredentialsGrant();
            spotifyApi.setAccessToken(data.body['access_token']);
        }
  
        let playlistId;
        switch(vibeType) {
            case 'lounge':
                playlistId = '37i9dQZF1DX0SM0LYsmbMT'; // Jazz Lounge playlist
                break;
            case 'comfy':
                playlistId = '37i9dQZF1DWWQRwui0ExPn'; // Cozy Acoustic playlist
                break;
            default:
                throw new Error('Invalid vibe type');
        }
  
        const data = await spotifyApi.getPlaylist(playlistId);
        const tracks = data.body.tracks.items
            .filter(item => item.track && item.track.preview_url)
            .map(item => item.track)
            .slice(0, 20);
  
        res.json(tracks);
    } catch (error) {
        console.error('Error getting playlist:', error);
        res.status(500).json({ error: error.message });
    }
  });


  app.get('/api/user-profile', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    
    const sql = 'SELECT first_name, last_name, email FROM users WHERE id = ?';
    db.query(sql, [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Internal server error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(results[0]);
    });
});

// Logout endpoint
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Error logging out' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out successfully' });
    });
});

