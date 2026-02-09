const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const session = require('express-session');
const connectPg = require('connect-pg-simple');
const { prisma } = require('../db');

const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

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

      // Exclude password_hash from response
      const { password_hash, ...userData } = user;
      res.json({ ...userData, permissionDetails, subscription });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Failed to fetch user' });
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
