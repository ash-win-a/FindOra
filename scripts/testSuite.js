require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const { calculateItemMatch, findRankedMatches } = require('../services/matchingService');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('   FINDORA AUTOMATED VERIFICATION & TEST SUITE      ');
  console.log('====================================================');

  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/findora';
  await mongoose.connect(mongoURI);

  try {
    // ----------------------------------------------------
    // TEST 1: User Registration & Duplicate Email Protection
    // ----------------------------------------------------
    console.log('\n[TEST 1] Registration & Duplicate Prevention:');
    const testEmail = `test.student.${Date.now()}@college.edu`;
    const passwordHash = await bcrypt.hash('SecurePass123', 10);

    const user1 = await User.create({
      name: 'Test Student',
      email: testEmail,
      passwordHash,
      phone: '9800000000',
      role: 'user'
    });
    assert(user1 && user1._id, 'New user successfully registered in MongoDB');

    let duplicateCaught = false;
    try {
      await User.create({
        name: 'Another Student',
        email: testEmail,
        passwordHash,
        phone: '9811111111'
      });
    } catch (err) {
      duplicateCaught = err.code === 11000 || err.name === 'MongoServerError';
    }
    assert(duplicateCaught, 'Duplicate email registration correctly rejected by MongoDB unique index');

    // ----------------------------------------------------
    // TEST 2: Password Authentication & Verification
    // ----------------------------------------------------
    console.log('\n[TEST 2] User Authentication (bcrypt):');
    const isValidPass = await user1.comparePassword('SecurePass123');
    const isInvalidPass = await user1.comparePassword('WrongPassword');
    assert(isValidPass === true, 'Valid password correctly matches hash');
    assert(isInvalidPass === false, 'Invalid password correctly rejected');

    // ----------------------------------------------------
    // TEST 3: Lost Item Report Validation & Creation
    // ----------------------------------------------------
    console.log('\n[TEST 3] Lost Item Report Validation:');
    const lostItem = await Item.create({
      itemType: 'lost',
      title: 'Sony WH-1000XM4 Headphones',
      category: 'Electronics',
      description: 'Silver wireless over-ear noise-cancelling headphones.',
      brand: 'Sony',
      color: 'Silver',
      location: 'Central Library 3rd Floor',
      reportDate: new Date(),
      ownerId: user1._id,
      status: 'active'
    });
    assert(lostItem && lostItem._id, 'Lost item successfully reported and saved to MongoDB');

    // Verify future date rejection
    let futureDateRejected = false;
    try {
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days future
      await Item.create({
        itemType: 'lost',
        title: 'Future Item',
        category: 'Electronics',
        description: 'Test description',
        location: 'Campus',
        reportDate: futureDate,
        ownerId: user1._id
      });
    } catch (err) {
      futureDateRejected = true;
    }
    assert(futureDateRejected, 'Future report date properly rejected by schema validator');

    // ----------------------------------------------------
    // TEST 4: Found Item Report Creation & Visibility
    // ----------------------------------------------------
    console.log('\n[TEST 4] Found Item Report Creation:');
    const foundItem = await Item.create({
      itemType: 'found',
      title: 'Sony Silver Wireless Headphones',
      category: 'Electronics',
      description: 'Found Sony over-ear headphones on a desk in the 3rd floor quiet zone.',
      brand: 'Sony',
      color: 'Silver',
      location: 'Central Library 3rd Floor Quiet Zone',
      reportDate: new Date(),
      ownerId: user1._id,
      privateVerificationQuestion: 'What is inside the carrying case?',
      status: 'active'
    });
    assert(foundItem && foundItem._id, 'Found item successfully reported and saved to MongoDB');

    // ----------------------------------------------------
    // TEST 5: Intelligent Matching Algorithm
    // ----------------------------------------------------
    console.log('\n[TEST 5] Intelligent Item Matching Algorithm:');
    const match = calculateItemMatch(lostItem, foundItem);
    console.log(`    -> Match Score: ${match.score}/100 [${match.matchLevel}]`);
    console.log(`    -> Explanation: ${match.explanation}`);
    assert(match.score >= 75, 'High similarity correctly yields "Strong Match" (Score >= 75)');
    assert(match.breakdown.categoryScore === 30, 'Exact category awarded full 30 points');
    assert(match.breakdown.colorScore === 15, 'Matching color awarded full 15 points');
    assert(match.breakdown.locationScore >= 10, 'Similar location awarded location points');

    // Test score sensitivity when attributes differ
    const differentItem = {
      title: 'Math Textbook',
      category: 'Books',
      color: 'Yellow',
      location: 'Science Block',
      reportDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    };
    const lowMatch = calculateItemMatch(lostItem, differentItem);
    console.log(`    -> Dissimilar Item Score: ${lowMatch.score}/100 [${lowMatch.matchLevel}]`);
    assert(lowMatch.score < 30, 'Dissimilar item correctly produces low score (< 30)');

    // ----------------------------------------------------
    // TEST 6: Verified Claim Lifecycle & Authorization
    // ----------------------------------------------------
    console.log('\n[TEST 6] Verified Claims Lifecycle:');
    const claimantUser = await User.create({
      name: 'Claimant Alice',
      email: `alice.${Date.now()}@college.edu`,
      passwordHash,
      phone: '9855555555'
    });

    // Create claim
    const claim = await Claim.create({
      itemId: foundItem._id,
      claimantId: claimantUser._id,
      claimDescription: 'These are my Sony headphones left during my study session.',
      privateVerificationAnswer: 'A black aux cable and an airplane adapter inside.',
      status: 'pending'
    });
    assert(claim.status === 'pending', 'New claim initialized with status "pending"');

    // Simulate approval by reviewer
    claim.status = 'approved';
    claim.reviewNote = 'Verified: Accessories matched.';
    claim.reviewedBy = user1._id;
    claim.reviewedAt = new Date();
    await claim.save();

    const savedClaim = await Claim.findById(claim._id);
    assert(savedClaim.status === 'approved', 'Authorized reviewer successfully approved claim');

    // Mark item returned
    foundItem.status = 'returned';
    await foundItem.save();
    const updatedItem = await Item.findById(foundItem._id);
    assert(updatedItem.status === 'returned', 'Item status successfully transitioned to "returned"');

    // Clean up temporary test data
    await User.deleteMany({ _id: { $in: [user1._id, claimantUser._id] } });
    await Item.deleteMany({ _id: { $in: [lostItem._id, foundItem._id] } });
    await Claim.deleteMany({ _id: claim._id });

    console.log('====================================================');
    console.log(` TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('====================================================');

    await mongoose.disconnect();
    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('[Test Execution Error]:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runTests();
