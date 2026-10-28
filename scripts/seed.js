require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Item = require('../models/Item');
const Claim = require('../models/Claim');

const seedData = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/findora';

  try {
    await mongoose.connect(mongoURI);
    console.log('[Seed] Connected to MongoDB.');

    // Clear existing data for fresh demo setup
    console.log('[Seed] Clearing existing collections...');
    await User.deleteMany({});
    await Item.deleteMany({});
    await Claim.deleteMany({});

    console.log('[Seed] Creating demo users...');
    const saltRounds = 10;
    const adminHash = await bcrypt.hash('Admin@123', saltRounds);
    const rahulHash = await bcrypt.hash('Rahul@123', saltRounds);
    const priyaHash = await bcrypt.hash('Priya@123', saltRounds);
    const securityHash = await bcrypt.hash('Campus@123', saltRounds);

    const admin = await User.create({
      name: 'System Administrator',
      email: 'admin@findora.com',
      passwordHash: adminHash,
      phone: '9876543210',
      role: 'admin'
    });

    const rahul = await User.create({
      name: 'Rahul Sharma (Student)',
      email: 'rahul@college.edu',
      passwordHash: rahulHash,
      phone: '9812345678',
      role: 'user'
    });

    const priya = await User.create({
      name: 'Priya Patel (Student)',
      email: 'priya@college.edu',
      passwordHash: priyaHash,
      phone: '9876501234',
      role: 'user'
    });

    const security = await User.create({
      name: 'Campus Security Desk',
      email: 'campus.security@college.edu',
      passwordHash: securityHash,
      phone: '9123456780',
      role: 'user'
    });

    console.log('[Seed] Creating demo lost and found items...');
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // 1. Lost Laptop by Rahul
    const lostLaptop = await Item.create({
      itemType: 'lost',
      title: 'Dell Inspiron 15 Laptop',
      category: 'Electronics',
      description: 'Black Dell Inspiron laptop with a GitHub octocat sticker on the top cover. Lost near study carrels.',
      brand: 'Dell',
      color: 'Black',
      location: 'Central Library 2nd Floor',
      reportDate: twoDaysAgo,
      ownerId: rahul._id,
      status: 'active'
    });

    // 2. Found Laptop by Campus Security (Strong match with Rahul's lost laptop!)
    const foundLaptop = await Item.create({
      itemType: 'found',
      title: 'Dell Black Laptop with Stickers',
      category: 'Electronics',
      description: 'Found a Dell laptop left behind on table 14 in Central Library reading hall.',
      brand: 'Dell',
      color: 'Black',
      location: 'Central Library Reading Hall',
      reportDate: oneDayAgo,
      ownerId: security._id,
      privateVerificationQuestion: 'What specific sticker is on the top cover of this laptop?',
      status: 'active'
    });

    // 3. Lost Backpack by Priya
    const lostBackpack = await Item.create({
      itemType: 'lost',
      title: 'Fastrack Navy Blue Backpack',
      category: 'Bags',
      description: 'Navy blue backpack containing engineering notebooks and a pencil pouch.',
      brand: 'Fastrack',
      color: 'Navy Blue',
      location: 'Canteen Block B',
      reportDate: threeDaysAgo,
      ownerId: priya._id,
      status: 'active'
    });

    // 4. Found Backpack by Security (High match with Priya's backpack!)
    const foundBackpack = await Item.create({
      itemType: 'found',
      title: 'Fastrack Navy Blue Backpack',
      category: 'Bags',
      description: 'Found navy blue backpack near counter in Block B Canteen.',
      brand: 'Fastrack',
      color: 'Navy Blue',
      location: 'Canteen Block B Counter',
      reportDate: twoDaysAgo,
      ownerId: security._id,
      privateVerificationQuestion: 'What brand and color is the pencil pouch inside?',
      status: 'claimed'
    });

    // 5. Lost Watch by Rahul
    const lostWatch = await Item.create({
      itemType: 'lost',
      title: 'Titan Silver Metallic Watch',
      category: 'Accessories',
      description: 'Silver metallic analog watch with quartz movement.',
      brand: 'Titan',
      color: 'Silver',
      location: 'Sports Complex Badminton Court',
      reportDate: threeDaysAgo,
      ownerId: rahul._id,
      status: 'active'
    });

    // 6. Found Watch by Security
    const foundWatch = await Item.create({
      itemType: 'found',
      title: 'Titan Silver Watch',
      category: 'Accessories',
      description: 'Found silver wrist watch on spectator seating area.',
      brand: 'Titan',
      color: 'Silver',
      location: 'Sports Complex Bleachers',
      reportDate: twoDaysAgo,
      ownerId: security._id,
      privateVerificationQuestion: 'What engraving or text is present on the back casing?',
      status: 'active'
    });

    // 7. Found Water Bottle by Priya
    await Item.create({
      itemType: 'found',
      title: 'Milton Green Insulated Water Bottle',
      category: 'Other',
      description: 'Found green 1-litre stainless steel insulated flask in Auditorium.',
      brand: 'Milton',
      color: 'Green',
      location: 'Auditorium Hall 1',
      reportDate: oneDayAgo,
      ownerId: priya._id,
      privateVerificationQuestion: 'Is there any dent or scratch on the base?',
      status: 'active'
    });

    // 8. Found Keys
    await Item.create({
      itemType: 'found',
      title: 'Bike Key with Red Tag',
      category: 'Keys',
      description: 'Found Hero Honda bike key with a red Honda logo keychain.',
      brand: 'Hero',
      color: 'Silver',
      location: 'Parking Lot Gate 2',
      reportDate: oneDayAgo,
      ownerId: security._id,
      privateVerificationQuestion: 'What number or initials are carved on the tag?',
      status: 'active'
    });

    console.log('[Seed] Creating demo claims...');
    // Rahul claims the Dell laptop found by Security (Pending)
    await Claim.create({
      itemId: foundLaptop._id,
      claimantId: rahul._id,
      claimDescription: 'I left my laptop at table 14 while running to the CSE lab test.',
      privateVerificationAnswer: 'It has a black and white GitHub Octocat sticker in the top right corner and 8GB RAM.',
      status: 'pending'
    });

    // Priya claimed the Backpack found by Security (Approved)
    await Claim.create({
      itemId: foundBackpack._id,
      claimantId: priya._id,
      claimDescription: 'This is my college bag with my Data Structures notebooks.',
      privateVerificationAnswer: 'Inside there is a purple Camlin pencil pouch and three blue Classmate notebooks.',
      status: 'approved',
      reviewNote: 'Verified accurately with contents inside. Ownership confirmed.',
      reviewedBy: security._id,
      reviewedAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
    });

    console.log('====================================================');
    console.log(' SEEDING COMPLETED SUCCESSFULLY! ');
    console.log('====================================================');
    console.log(' Demo Accounts Created:');
    console.log(' 1. Administrator:');
    console.log('    Email:    admin@findora.com');
    console.log('    Password: Admin@123');
    console.log('');
    console.log(' 2. Student User (Rahul):');
    console.log('    Email:    rahul@college.edu');
    console.log('    Password: Rahul@123');
    console.log('');
    console.log(' 3. Student User (Priya):');
    console.log('    Email:    priya@college.edu');
    console.log('    Password: Priya@123');
    console.log('');
    console.log(' 4. Staff User (Campus Security):');
    console.log('    Email:    campus.security@college.edu');
    console.log('    Password: Campus@123');
    console.log('====================================================');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error);
    process.exit(1);
  }
};

seedData();
