const express = require('express');
const session = require('express-session');
const passport = require('passport');
const OnshapeStrategy = require('passport-onshape');
const uuid = require('uuid');

const {
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  OAUTH_CALLBACK_URL,
  OAUTH_URL,
  SESSION_SECRET
} = process.env;

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: SESSION_SECRET,
  saveUninitialized: false,
  resave: false,
  cookie: {
    sameSite: 'none',
    secure: true,
    httpOnly: true,
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new OnshapeStrategy({
    clientID: OAUTH_CLIENT_ID,
    clientSecret: OAUTH_CLIENT_SECRET,
    callbackURL: OAUTH_CALLBACK_URL,
    authorizationURL: `${OAUTH_URL}/oauth/authorize`,
    tokenURL: `${OAUTH_URL}/oauth/token`,
    userProfileURL: 'https://cad.onshape.com/api/users/sessioninfo'
  },
  (accessToken, refreshToken, profile, done) => {
    profile.accessToken = accessToken;
    profile.refreshToken = refreshToken;
    return done(null, profile);
  }
));

// OAuth sign-in
app.get('/oauthSignin', (req, res, next) => {
  const state = {
    docId: req.query.documentId,
    workId: req.query.workspaceId,
    elId: req.query.elementId
  };
  req.session.state = state;
  passport.authenticate('onshape', { state: uuid.v4(state) })(req, res, next);
});

// OAuth callback
app.get('/oauthRedirect', passport.authenticate('onshape', { failureRedirect: '/grantDenied' }), (req, res) => {
  res.redirect(`/?documentId=${req.session.state.docId}&workspaceId=${req.session.state.workId}&elementId=${req.session.state.elId}`);
});

// Grant denied
app.get('/grantDenied', (req, res) => {
  res.status(403).send('Access denied by user.');
});

// Example protected API route
app.get('/api/userinfo', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user: req.user });
});

// Proxy Onshape API calls
app.get('/api/onshape/*', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const apiPath = req.params[0];
  const url = `https://cad.onshape.com/api/${apiPath}`;
  try {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${req.user.accessToken}` } });
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- COMPLIANCE CHECK PROXY ---
app.post('/api/proxy/check-model', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { documentId, workspaceId, elementId, rules } = req.body;
  if (!documentId || !workspaceId || !elementId) {
    return res.status(400).json({ error: 'Missing required parameters (documentId, workspaceId, elementId).' });
  }
  try {
    // 1. Initiate STEP translation
    const translationUrl = `https://cad.onshape.com/api/documents/d/${documentId}/w/${workspaceId}/e/${elementId}/translations`;
    const translationBody = {
      formatName: "STEP",
      storeInDocument: false,
      flattenAssemblies: false,
      configuration: "default"
    };
    const startResp = await fetch(translationUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${req.user.accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(translationBody)
    });
    if (!startResp.ok) {
      const errorText = await startResp.text();
      throw new Error(`Failed to start translation: ${errorText}`);
    }
    const startData = await startResp.json();
    const translationId = startData.id;
    // 2. Poll for completion
    let translationResult;
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const pollResp = await fetch(`https://cad.onshape.com/api/translations/${translationId}`, {
        headers: { "Authorization": `Bearer ${req.user.accessToken}` }
      });
      translationResult = await pollResp.json();
      if (translationResult.requestState === "DONE") break;
      if (translationResult.requestState === "FAILED") {
        throw new Error(`Translation failed: ${translationResult.failureReason}`);
      }
    }
    if (!translationResult || translationResult.requestState !== "DONE") {
      throw new Error('Translation timed out');
    }
    const externalId = translationResult.resultExternalDataIds[0];
    const downloadUrl = `https://cad.onshape.com/api/documents/d/${documentId}/externaldata/${externalId}`;
    // --- Compliance check stub ---
    // Here you would analyze the STEP file, for now return mock violations
    const violations = [
      // ... you can return [] for no violations, or mock data ...
    ];
    res.json({ success: true, downloadUrl, violations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- USER PROFILE ENDPOINT ---
app.get('/api/user', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  // Defensive: Onshape profile may use different fields
  const name = req.user.displayName || req.user.name || req.user.username || req.user.email || req.user.id;
  const email = req.user.email || null;
  const id = req.user.id || req.user.userid || null;
  res.json({ user: { name, email, id } });
});

// --- LOGOUT ENDPOINT ---
app.post('/api/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });
});

module.exports = app;
