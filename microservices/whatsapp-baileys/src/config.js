require('dotenv').config();

const required = ['DATABASE_URL', 'API_KEY', 'MAIN_APP_URL'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  DATABASE_URL: process.env.DATABASE_URL,
  API_KEY: process.env.API_KEY,
  MAIN_APP_URL: process.env.MAIN_APP_URL,
  MAIN_APP_INTERNAL_KEY: process.env.MAIN_APP_INTERNAL_KEY || '',
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
};
