const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const WebAuthnStrategy = require('passport-fido2-webauthn');
const SessionChallengeStore = WebAuthnStrategy.SessionChallengeStore;
// Override origin detection so it works behind Vite proxy in local dev
const webauthnUtils = require('passport-fido2-webauthn/lib/utils');
webauthnUtils.originalOrigin = function(req) {
  // Production: require explicit env var
  if (process.env.RP_ORIGIN) return process.env.RP_ORIGIN;
  // Dev only: derive from request (Vite proxy changes Host header)
  if (process.env.NODE_ENV !== 'production') {
    const proto = req.headers['x-forwarded-proto'] || (req.connection.encrypted ? 'https' : 'http');
    const host = req.headers['x-forwarded-host'] || req.headers['host'];
    return `${proto.split(',')[0].trim()}://${host}`;
  }
  // Fallback: should not reach here in production (RP_ORIGIN must be set)
  return 'https://' + (req.headers['host'] || 'localhost');
};
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const session = require('express-session');
const connectPg = require('connect-pg-simple');
const { prisma } = require('../db');

const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

// WebAuthn Relying Party config
// Production: RP_ID and RP_ORIGIN env vars REQUIRED
// Dev: falls back to deriving from request Host header
const RP_NAME = 'CabanIA';

function getRpId(req) {
  if (process.env.RP_ID) return process.env.RP_ID;
  if (process.env.NODE_ENV !== 'production') {
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost';
    return host.split(':')[0];
  }
  return req.headers['host']?.split(':')[0] || 'localhost';
}

function getSession() {
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: SESSION_TTL,
    tableName: 'sessions',
  });
  return session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_TTL * 1000,
    },
  });
}

async function setupAuth(app) {
  app.set('trust proxy', 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport local strategy: authenticate with email + password
  passport.use(new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      try {
        const user = await prisma.users.findFirst({
          where: { email: email.toLowerCase() }
        });

        if (!user || !user.password_hash) {
          return done(null, false, { message: 'Credenciales incorrectas' });
        }

        if (user.is_locked) {
          return done(null, false, { message: 'Cuenta bloqueada' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
          return done(null, false, { message: 'Credenciales incorrectas' });
        }

        // Return session-compatible user object
        // Keeps { claims: { sub } } structure so server/index.js needs zero changes
        return done(null, {
          claims: { sub: user.id },
          expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL,
        });
      } catch (error) {
        return done(error);
      }
    }
  ));

  // WebAuthn strategy for passkey authentication
  const challengeStore = new SessionChallengeStore();

  passport.use(new WebAuthnStrategy({
    store: challengeStore
  },
    // verify callback — called during passkey login
    async function (id, userHandle, cb) {
      try {
        const credential = await prisma.passkey_credentials.findUnique({
          where: { credential_id: id },
          include: { user: true }
        });
        if (!credential) {
          return cb(null, false, { message: 'Passkey no reconocida' });
        }
        if (credential.user.is_locked) {
          return cb(null, false, { message: 'Cuenta bloqueada' });
        }
        // Update last_used_at
        await prisma.passkey_credentials.update({
          where: { id: credential.id },
          data: { last_used_at: new Date() }
        });
        const sessionUser = {
          claims: { sub: credential.user.id },
          expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL,
        };
        return cb(null, sessionUser, credential.public_key);
      } catch (error) {
        return cb(error);
      }
    },
    // register callback — called during passkey registration
    // NOTE: `user` here is the WebAuthn user object from challenge options (NOT req.user)
    // user.id = Buffer with our DB user ID, user._passkeyDisplayName = custom field
    async function (user, id, publicKey, cb) {
      try {
        const userId = user.id.toString('utf-8');
        const displayName = user._passkeyDisplayName || user.displayName || 'Passkey';
        await prisma.passkey_credentials.create({
          data: {
            user_id: userId,
            credential_id: id,
            public_key: publicKey,
            display_name: displayName,
          }
        });
        // Return session-compatible user object
        return cb(null, {
          claims: { sub: userId },
          expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL,
        });
      } catch (error) {
        return cb(error);
      }
    }
  ));

  passport.serializeUser((user, cb) => cb(null, user));
  passport.deserializeUser((user, cb) => cb(null, user));

  // --- Auth routes ---

  app.post('/api/auth/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || 'Credenciales incorrectas' });
      }
      req.logIn(user, (err) => {
        if (err) return next(err);
        res.json({ message: 'OK' });
      });
    })(req, res, next);
  });

  app.post('/api/auth/logout', (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ message: 'OK' });
      });
    });
  });

  // Keep GET /api/logout as fallback
  app.get('/api/logout', (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/');
      });
    });
  });

  app.get('/api/auth/user', isAuthenticated, async (req, res) => {
    try {
      const userId = String(req.user.claims.sub);
      const user = await prisma.users.findUnique({
        where: { id: userId },
        include: { profile: true }
      });

      if (!user) {
        return res.status(401).json({ message: 'Usuario no encontrado' });
      }

      // Fetch permission details
      let permissionDetails = [];
      if (user?.profile?.permissions && Array.isArray(user.profile.permissions)) {
        const permissions = await prisma.permissions.findMany({
          where: { code: { in: user.profile.permissions } },
          orderBy: { code: 'asc' }
        });
        permissionDetails = permissions;
      }

      // Get user's best subscription
      const subscriptionUsers = await prisma.subscription_users.findMany({
        where: { user_id: userId },
        include: { subscription: true },
        orderBy: { added_at: 'desc' }
      });

      let subscription = null;
      let trialDaysRemaining = null;
      let isTrialExpired = false;

      if (subscriptionUsers.length > 0) {
        let bestSubscription = null;

        for (const su of subscriptionUsers) {
          const sub = su.subscription;
          const trialExpiresAt = su.trial_expires_at;

          let isActive = sub.is_active;
          let isExpired = false;

          if (trialExpiresAt) {
            const now = new Date();
            const expiresDate = new Date(trialExpiresAt);
            isExpired = expiresDate.getTime() <= now.getTime();
            if (isExpired) isActive = false;
          }

          if (!bestSubscription) {
            bestSubscription = { su, isActive, isExpired };
          } else {
            if (isActive && !bestSubscription.isActive) {
              bestSubscription = { su, isActive, isExpired };
            } else if (isActive && bestSubscription.isActive && !trialExpiresAt && bestSubscription.su.trial_expires_at) {
              bestSubscription = { su, isActive, isExpired };
            }
          }
        }

        if (bestSubscription) {
          const su = bestSubscription.su;
          const sub = su.subscription;
          const trialExpiresAt = su.trial_expires_at;

          if (trialExpiresAt) {
            const now = new Date();
            const expiresDate = new Date(trialExpiresAt);
            const diffTime = expiresDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > 0) {
              trialDaysRemaining = diffDays;
            } else {
              isTrialExpired = true;
            }
          }

          subscription = {
            id: sub.id,
            name: sub.name,
            plan_type: sub.plan_type,
            is_active: bestSubscription.isActive,
            is_owner: su.is_owner,
            role: su.role,
            expires_at: sub.expires_at,
            trial_expires_at: trialExpiresAt,
            trial_days_remaining: trialDaysRemaining,
            is_trial_expired: isTrialExpired
          };
        }
      }

      // Count passkeys for this user
      const passkeyCount = await prisma.passkey_credentials.count({
        where: { user_id: userId },
      });

      // Exclude password_hash from response
      const { password_hash, ...userData } = user;
      res.json({ ...userData, permissionDetails, subscription, has_passkeys: passkeyCount > 0, passkey_count: passkeyCount });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Failed to fetch user' });
    }
  });

  // --- Passkey routes ---

  // Registration options (requires auth) — generates challenge + creation options
  app.post('/api/auth/passkey/register/options', isAuthenticated, async (req, res, next) => {
    try {
      const userId = String(req.user.claims.sub);
      const user = await prisma.users.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

      // Use the DB user ID as the WebAuthn user handle so the register callback can read it
      const userHandle = Buffer.from(userId, 'utf-8');
      const displayName = req.body.displayName || 'Passkey';
      const options = {
        rp: { id: getRpId(req), name: RP_NAME },
        user: {
          id: userHandle,
          name: user.email,
          displayName: user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.email,
          _passkeyDisplayName: displayName,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256
          { type: 'public-key', alg: -257 },  // RS256
        ],
        authenticatorSelection: {
          residentKey: 'required',
          userVerification: 'preferred',
        },
        attestation: 'none',
        timeout: 60000,
      };

      // Exclude existing credentials to prevent re-registration
      const existing = await prisma.passkey_credentials.findMany({
        where: { user_id: userId },
        select: { credential_id: true },
      });
      if (existing.length > 0) {
        options.excludeCredentials = existing.map((c) => ({
          type: 'public-key',
          id: c.credential_id,
        }));
      }

      // The store generates its own challenge and returns it via callback
      challengeStore.challenge(req, options, (err, challenge) => {
        if (err) return next(err);
        const jsonOptions = {
          ...options,
          user: { ...options.user, id: options.user.id.toString('base64url') },
          challenge: challenge.toString('base64url'),
        };
        res.json(jsonOptions);
      });
    } catch (error) {
      next(error);
    }
  });

  // Registration (requires auth) — stores the new credential
  app.post('/api/auth/passkey/register', isAuthenticated, (req, res, next) => {
    passport.authenticate('webauthn', (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(400).json({ message: info?.message || 'Error al registrar passkey' });
      }
      req.logIn(user, (err) => {
        if (err) return next(err);
        res.json({ message: 'Passkey registrada exitosamente' });
      });
    })(req, res, next);
  });

  // Login options (public) — generates challenge for assertion
  app.post('/api/auth/passkey/login/options', (req, res, next) => {
    const options = {
      rpId: getRpId(req),
      userVerification: 'preferred',
      timeout: 60000,
    };

    // The store generates its own challenge and returns it via callback
    challengeStore.challenge(req, options, (err, challenge) => {
      if (err) return next(err);
      res.json({
        ...options,
        challenge: challenge.toString('base64url'),
      });
    });
  });

  // Login with passkey (public) — verifies assertion and creates session
  app.post('/api/auth/passkey/login', (req, res, next) => {
    passport.authenticate('webauthn', (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || 'Autenticación fallida' });
      }
      req.logIn(user, (err) => {
        if (err) return next(err);
        res.json({ message: 'OK' });
      });
    })(req, res, next);
  });

  // List passkeys (requires auth)
  app.get('/api/auth/passkeys', isAuthenticated, async (req, res) => {
    try {
      const userId = String(req.user.claims.sub);
      const passkeys = await prisma.passkey_credentials.findMany({
        where: { user_id: userId },
        select: {
          id: true,
          display_name: true,
          created_at: true,
          last_used_at: true,
        },
        orderBy: { created_at: 'desc' },
      });
      res.json(passkeys);
    } catch (error) {
      console.error('Error listing passkeys:', error);
      res.status(500).json({ message: 'Error al listar passkeys' });
    }
  });

  // Delete passkey (requires auth)
  app.delete('/api/auth/passkeys/:id', isAuthenticated, async (req, res) => {
    try {
      const userId = String(req.user.claims.sub);
      const passkey = await prisma.passkey_credentials.findFirst({
        where: { id: req.params.id, user_id: userId },
      });
      if (!passkey) {
        return res.status(404).json({ message: 'Passkey no encontrada' });
      }
      await prisma.passkey_credentials.delete({ where: { id: passkey.id } });
      res.json({ message: 'Passkey eliminada' });
    } catch (error) {
      console.error('Error deleting passkey:', error);
      res.status(500).json({ message: 'Error al eliminar passkey' });
    }
  });
}

const isAuthenticated = async (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated() || !req.user?.claims?.sub) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  return next();
};

module.exports = { setupAuth, isAuthenticated };
