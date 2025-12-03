// Test script to create a dummy user directly in MongoDB
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/forex';

const UserSchema = new mongoose.Schema({
  email: String,
  password: String,
  name: String,
  phone: String,
  aadharNo: String,
  pan: String,
  gender: String,
  dob: Date,
  nomineeName: String,
  nomineeRelation: String,
  nomineeDob: Date,
  bankName: String,
  accountNumber: String,
  accountHolder: String,
  ifscCode: String,
  aadharPhoto: String,
  panPhoto: String,
  userPhoto: String,
  address: String,
  isVerified: { type: Boolean, default: false },
  role: { type: String, default: 'user' },
  status: { type: String, default: 'active' },
  lastLogin: { type: Date, default: null }
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

const User = mongoose.model('User', UserSchema);

async function createDummyUser() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Check if user already exists
    const existingUser = await User.findOne({ email: 'testuser@forex.com' });
    if (existingUser) {
      console.log('╔═══════════════════════════════════════╗');
      console.log('║   EXISTING TEST USER FOUND            ║');
      console.log('╚═══════════════════════════════════════╝\n');
      console.log('📧 Email:    testuser@forex.com');
      console.log('🔑 Password: Test@123');
      console.log('✅ Status:   Verified\n');
      console.log('⚠️  User already exists in database!');
      await mongoose.connection.close();
      return;
    }

    console.log('Creating test user...');
    
    const dummyUser = new User({
      email: 'testuser@forex.com',
      password: 'Test@123',
      name: 'Test User',
      phone: '9876543210',
      aadharNo: '123456789012',
      pan: 'ABCDE1234F',
      gender: 'Male',
      dob: new Date('1990-01-01'),
      nomineeName: 'John Doe',
      nomineeRelation: 'Spouse',
      nomineeDob: new Date('1992-01-01'),
      bankName: 'Test Bank',
      accountNumber: '1234567890123456',
      accountHolder: 'Test User',
      ifscCode: 'TEST0001234',
      aadharPhoto: 'https://via.placeholder.com/400x300?text=Aadhar',
      panPhoto: 'https://via.placeholder.com/400x300?text=PAN',
      userPhoto: 'https://via.placeholder.com/400x300?text=User',
      address: '123 Test Street, Test City, Test State - 123456',
      isVerified: true,
      role: 'user'
    });

    await dummyUser.save();
    
    console.log('\n╔═══════════════════════════════════════╗');
    console.log('║   TEST USER CREATED SUCCESSFULLY! ✓   ║');
    console.log('╚═══════════════════════════════════════╝\n');
    console.log('Login Credentials:');
    console.log('─────────────────────────────────────────');
    console.log('📧 Email:    testuser@forex.com');
    console.log('🔑 Password: Test@123');
    console.log('✅ Status:   Verified (can login immediately)');
    console.log('👤 Role:     User');
    console.log('─────────────────────────────────────────\n');
    console.log('🚀 You can now login at: http://localhost:3000/login\n');

    await mongoose.connection.close();
    console.log('✓ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating dummy user:', error.message);
    if (error.code === 11000) {
      console.log('\n⚠️  A user with these details already exists.');
      console.log('Try using different email, phone, aadhar, or PAN number.');
    }
    process.exit(1);
  }
}

createDummyUser();
