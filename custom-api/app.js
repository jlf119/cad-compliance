// This file was moved from api/app.js to custom-api/app.js for Vercel routing compatibility.
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

// --- DYNAMIC COOKIE SETTINGS FOR HEROKU/LOCAL ---
app.set('trust proxy', 1); // To allow to run correctly behind Heroku when deployed.

app.use(session({
  secret: SESSION_SECRET,
  saveUninitialized: false,
  resave: false,
  cookie: {
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
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
app.use('/api/oauthSignin', (req, res, next) => {
  const stateObj = {
    docId: req.query.documentId,
    workId: req.query.workspaceId,
    elId: req.query.elementId
  };
  req.session.state = stateObj;
  // Encode state as base64 JSON string for round-trip
  const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');
  passport.authenticate('onshape', { state })(req, res, next);
});

// OAuth callback
app.use('/api/oauthRedirect', passport.authenticate('onshape', { failureRedirect: '/grantDenied' }), (req, res) => {
  let state = req.query.state;
  let stateObj = req.session.state;
  // If state param is present, decode it
  if (state) {
    try {
      stateObj = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    } catch (e) {
      // fallback to session
    }
  }
  res.redirect(`/?documentId=${stateObj?.docId || ''}&workspaceId=${stateObj?.workId || ''}&elementId=${stateObj?.elId || ''}`);
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

// --- DOWNLOAD STEP FILE ENDPOINT (ASYNC EXPORT) ---
app.get('/api/download-step', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const did = req.query.docId;
  const wvid = req.query.workId;
  const eid = req.query.elId;
  if (!did || !wvid || !eid) {
    return res.status(400).json({ error: 'Missing required parameters (docId, workId, elId).' });
  }
  // 1. Initiate STEP export
  const exportUrl = `https://cad.onshape.com/api/assemblies/d/${did}/w/${wvid}/e/${eid}/export/step`;
  const exportBody = {
    stepUnit: "METER",
    stepVersionString: "AP242",
    storeInDocument: false,
    notifyUser: false
  };
  try {
    const startResp = await fetch(exportUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${req.user.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(exportBody)
    });
    if (!startResp.ok) {
      const errorText = await startResp.text();
      return res.status(startResp.status).send(errorText);
    }
    const startData = await startResp.json();
    const translationId = startData.id;
    // 2. Poll for completion
    let translationResult;
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const pollResp = await fetch(`https://cad.onshape.com/api/translations/${translationId}`, {
        headers: { "Authorization": `Bearer ${req.user.accessToken}` }
      });
      translationResult = await pollResp.json();
      if (translationResult.requestState === "DONE") break;
      if (translationResult.requestState === "FAILED") {
        return res.status(500).json({ error: `Translation failed: ${translationResult.failureReason}` });
      }
    }
    if (!translationResult || translationResult.requestState !== "DONE") {
      return res.status(500).json({ error: 'STEP export timed out.' });
    }
    const externalId = translationResult.resultExternalDataIds[0];
    if (!externalId) {
      return res.status(500).json({ error: 'No external data ID found in translation result.' });
    }
    // 3. Download the STEP file
    const downloadUrl = `https://cad.onshape.com/api/documents/d/${did}/externaldata/${externalId}`;
    const fetchResp = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${req.user.accessToken}` }
    });
    if (!fetchResp.ok) {
      const errorText = await fetchResp.text();
      return res.status(fetchResp.status).send(errorText);
    }
    res.setHeader('Content-Disposition', 'attachment; filename="model.step"');
    res.setHeader('Content-Type', 'application/step');
    fetchResp.body.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
