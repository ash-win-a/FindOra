require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const createOrPromoteAdmin = async () => {
  const args = process.argv.slice(2);
  const email = (args[0] || 'admin@findora.com').toLowerCase().trim();
  const password = args[1] || 'Admin@123';
  const name = args[2] || 'System Administrator';
  const phone = args[3] || '9876543210';

  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/findora';

  try {
    await mongoose.connect(mongoURI);
    console.log('[Admin Setup] Connected to MongoDB.');

    let user = await User.findOne({ email });

    if (user) {
      user.role = 'admin';
      const passwordHash = await bcrypt.hash(password, 10);
      user.passwordHash = passwordHash;
      await user.save();
      console.log(`[Admin Setup] Existing user "${email}" updated to role 'admin' with updated password.`);
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      user = await User.create({
        name,
        email,
        passwordHash,
        phone,
        role: 'admin'
      });
      console.log(`[Admin Setup] New administrator created successfully!`);
    }

    console.log('----------------------------------------------------');
    console.log(` Admin Credentials:`);
    console.log(` Email:    ${email}`);
    console.log(` Password: ${password}`);
    console.log(` Role:     ${user.role}`);
    console.log('----------------------------------------------------');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Admin Setup Error]:', error.message);
    process.exit(1);
  }
};

createOrPromoteAdmin();
