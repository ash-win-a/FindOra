require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const connectDB = require('./config/db');

// Route imports
const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const claimRoutes = require('./routes/claimRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Middleware imports
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;
const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/findora';

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express Session Configuration with persistent MongoDB storage
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'findora_college_project_default_secret_key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: mongoURI,
      collectionName: 'sessions',
      ttl: 24 * 60 * 60 // 1 day
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

// Serve static frontend assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/admin', adminRoutes);

// Fallback for 404
app.use(notFoundHandler);

// Central Error Handler
app.use(errorHandler);

// Start Server and Connect Database
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(` FINDORA - Smart Lost and Found Management System `);
      console.log(` Server running in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(` Access URL: http://localhost:${PORT}`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Critical failure: Could not start Findora server.', error);
    process.exit(1);
  }
};

startServer();
