// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const qs = require('querystring');
const app = express();
const session = require('express-session');
const cookieParser = require('cookie-parser');

const client_id = process.env.GOOGLE_CLIENT_ID;
const client_secret = process.env.GOOGLE_CLIENT_SECRET;
const redirect_uri = process.env.GOOGLE_OAUTH_REDIRECT_URL;
const session_secret = process.env.SESSION_SECRET;


const path = require('path');
app.use(express.static(path.join(__dirname, 'client')));


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Construct URL to send request to Google 
app.get('/auth/google', (req, res) => {
  const scope = [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
    ].join(' ');
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${qs.stringify({
    client_id,
    redirect_uri,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent'
  })}`;
  res.redirect(authUrl);
});

app.use(cookieParser());

app.use(session({
  secret: session_secret,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // set to true if using HTTPS
}));

// Extract code from Google redirect
app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;

  // Exchange code for token
  const { data } = await axios.post('https://oauth2.googleapis.com/token', qs.stringify({
    code,
    client_id,
    client_secret,
    redirect_uri,
    grant_type: 'authorization_code'
  }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  const { access_token } = data;

  // Fetch user profile
  const userinfo = await axios.get('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
    headers: { Authorization: `Bearer ${access_token}` }
  });

  req.session.user = userinfo.data;
  res.redirect('/dashboard.html');
});

app.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  res.json(req.session.user);
});

app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
      return res.redirect('/');
    }
  
    const user = req.session.user;
    res.send(`
      <h2>Welcome, ${user.name}</h2>
      <img src="${user.picture}" alt="Profile picture" />
      <p>Email: ${user.email}</p>
      <a href="/logout">Logout</a>
    `);
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  });

app.listen(3000, () => console.log('Running on http://localhost:3000'));
