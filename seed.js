const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Teacher = require('./models/Teacher');
const Student = require('./models/Student');
const Parent = require('./models/Parent');
const Course = require('./models/Course');

async function seed() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🌱 Seeding database...');

    // Clear existing
    await Promise.all([
        User.deleteMany({}),
        Teacher.deleteMany({}),
        Student.deleteMany({}),
        Parent.deleteMany({}),
        Course.deleteMany({})
    ]);

    // ── Admin ──
    await User.create({
        name: 'Admin',
        email: 'admin@alnoor.com',
        password: 'Admin@1234',
        role: 'admin',
        isActive: true,
        isEmailVerified: true
    });

    // ── Teacher ──
    const teacherUser = await User.create({
        name: 'Ustaz Ibrahim Al-Qari',
        email: 'ibrahim@alnoor.com',
        password: 'Teacher@1234',
        role: 'teacher',
        phone: '+1 416 555 0192',
        country: 'Canada',
        isActive: true,
        isEmailVerified: true
    });

    await Teacher.create({
        user: teacherUser._id,
        specializations: ['Tajweed', 'Hifz', 'Quran Reading'],
        experience: 8,
        bio: 'Certified Quran teacher — Al-Azhar University graduate.',
        rating: { average: 4.9, count: 145, total: 710.5 },
        earnings: { total: 7450, thisMonth: 1200, ratePerClass: 46 },
        approvedByAdmin: true,
        isAvailable: true
    });

    // ── Parent ──
    const parentUser = await User.create({
        name: 'Mr. Yusuf Ali',
        email: 'yusuf@example.com',
        password: 'Parent@1234',
        role: 'parent',
        phone: '+1 416 555 0199',
        country: 'Canada',
        isActive: true,
        isEmailVerified: true
    });

    const parent = await Parent.create({
        user: parentUser._id,
        subscriptionPlan: 'family',
        subscription: {
            isActive: true,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            amount: 49.99
        }
    });

    // ── Students ──
    const omarUser = await User.create({
        name: 'Omar Hassan',
        email: 'omar@example.com',
        password: 'Student@1234',
        role: 'student',
        country: 'Canada',
        isActive: true,
        isEmailVerified: true
    });

    const omarStudent = await Student.create({
        user: omarUser._id,
        parent: parent._id,
        age: 12,
        gender: 'Male',
        level: 7,
        xpPoints: 680,
        streak: { current: 12, longest: 20 },
        stats: { totalClasses: 26, attendedClasses: 24, attendanceRate: 92 }
    });

    const saraUser = await User.create({
        name: 'Sara Hassan',
        email: 'sara@example.com',
        password: 'Student@1234',
        role: 'student',
        country: 'Canada',
        isActive: true,
        isEmailVerified: true
    });

    const saraStudent = await Student.create({
        user: saraUser._id,
        parent: parent._id,
        age: 9,
        gender: 'Female',
        level: 4,
        xpPoints: 320,
        streak: { current: 8, longest: 15 }
    });

    // Update parent children
    await Parent.findByIdAndUpdate(parent._id, {
        children: [omarStudent._id, saraStudent._id]
    });

    // ── Courses ──
    await Course.create([
        {
            name: 'Tajweed Course',
            nameArabic: 'علم التجويد',
            category: 'Tajweed',
            description: 'Learn proper Quran recitation with Tajweed rules',
            level: 'intermediate',
            duration: { sessionsTotal: 30, minutesPerSession: 45 },
            price: { amount: 29.99 },
            isActive: true
        },
        {
            name: 'Hifz Program',
            nameArabic: 'برنامج الحفظ',
            category: 'Hifz',
            description: 'Complete Quran memorization program',
            level: 'advanced',
            duration: { sessionsTotal: 60, minutesPerSession: 45 },
            price: { amount: 39.99 },
            isActive: true
        },
        {
            name: 'Quran Reading',
            nameArabic: 'قراءة القرآن',
            category: 'Quran Reading',
            description: 'Basic to advanced Quran reading for beginners',
            level: 'beginner',
            duration: { sessionsTotal: 20, minutesPerSession: 30 },
            price: { amount: 19.99 },
            isActive: true
        }
    ]);

    console.log('✅ Database seeded successfully!');
    console.log('');
    console.log('🔑 Test Accounts:');
    console.log('   Admin:   admin@alnoor.com   / Admin@1234');
    console.log('   Teacher: ibrahim@alnoor.com  / Teacher@1234');
    console.log('   Parent:  yusuf@example.com  / Parent@1234');
    console.log('   Student: omar@example.com   / Student@1234');

    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Seed error:', err);
    process.exit(1);
});