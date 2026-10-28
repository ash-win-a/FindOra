const mongoose = require('mongoose');

/**
 * Connect to MongoDB database
 * Uses environment variable MONGODB_URI if provided,
 * otherwise falls back to local MongoDB instance.
 */
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/findora';
    
    const conn = await mongoose.connect(mongoURI);

    console.log(`[Database] MongoDB Connected successfully to host: ${conn.connection.host}`);
    console.log(`[Database] Database name: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MongoDB: ${error.message}`);
    console.error('Troubleshooting Tip: Make sure MongoDB service is running (e.g. net start MongoDB or mongod).');
    // Exit process with failure in production, or throw for handling
    throw error;
  }
};

module.exports = connectDB;
