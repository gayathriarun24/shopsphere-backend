import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';import User from './models/userModel.js';
dotenv.config();

// Connect to MongoDB (ensure MONGO_URI is set in your .env)
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/shopsphere');

const importData = async () => {
  try {
    // Check if an admin already exists
    const adminExists = await User.findOne({ role: 'admin' });

    if (adminExists) {
      console.log('Admin user already exists!');
      process.exit();
    }

    // Hash a secure password for the admin
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'AdminPassword123', salt);

    const adminUser = {
      name: 'System Admin',
      email: process.env.ADMIN_EMAIL || 'admin@shopsphere.com',
      password: hashedPassword,
      role: 'admin',
      isApproved: true,
    };

    await User.create(adminUser);

    console.log('Admin user created successfully!');
    process.exit();
  } catch (error) {
    console.error(`Error with data seeder: ${error.message}`);
    process.exit(1);
  }
};

importData();