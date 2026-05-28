const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Course = require('../models/Course');

// ─────────────────────────────────────────────
// @route   GET /api/public/search
// @desc    Public search: teachers and courses (no auth required)
// @access  Public
// ─────────────────────────────────────────────
router.get('/search', async (req, res) => {
    try {
        const { q, type } = req.query;

        if (!q || q.trim().length < 1) {
            return res.json({ success: true, teachers: [], courses: [] });
        }

        const keyword = q.trim();
        const regex = new RegExp(keyword, 'i');

        let teachers = [];
        let courses = [];

        if (!type || type === 'teacher' || type === 'all') {
            // Find teacher users whose names match
            const teacherUsers = await User.find({
                role: 'teacher',
                isActive: true,
                $or: [{ name: regex }, { email: regex }]
            }).select('_id name email avatar').limit(20);

            // Enrich with teacher profile data
            const teacherUserIds = teacherUsers.map(u => u._id);
            const teacherProfiles = await Teacher.find({
                user: { $in: teacherUserIds },
                approvedByAdmin: true
            }).populate('user', 'name email avatar');

            teachers = teacherProfiles.map(t => ({
                _id: t._id,
                userId: t.user._id,
                name: t.user.name,
                email: t.user.email,
                avatar: t.user.avatar,
                specializations: t.specializations,
                experience: t.experience,
                rating: t.rating,
                bio: t.bio,
                isAvailable: t.isAvailable
            }));

            // Also search by specialization
            const bySpec = await Teacher.find({
                approvedByAdmin: true,
                specializations: { $in: [regex] }
            }).populate('user', 'name email avatar').limit(10);

            for (const t of bySpec) {
                if (!teachers.find(x => x._id.toString() === t._id.toString())) {
                    teachers.push({
                        _id: t._id,
                        userId: t.user._id,
                        name: t.user.name,
                        email: t.user.email,
                        avatar: t.user.avatar,
                        specializations: t.specializations,
                        experience: t.experience,
                        rating: t.rating,
                        bio: t.bio,
                        isAvailable: t.isAvailable
                    });
                }
            }
        }

        if (!type || type === 'course' || type === 'all') {
            courses = await Course.find({
                $or: [
                    { title: regex },
                    { description: regex },
                    { subject: regex }
                ]
            }).populate('teacher', 'name').limit(20);
        }

        res.json({
            success: true,
            query: keyword,
            teachers,
            courses
        });

    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   GET /api/public/teachers
// @desc    Get all approved teachers for public listing
// @access  Public
// ─────────────────────────────────────────────
router.get('/teachers', async (req, res) => {
    try {
        const teachers = await Teacher.find({ approvedByAdmin: true })
            .populate('user', 'name email avatar')
            .select('specializations experience rating bio isAvailable languages')
            .limit(50);

        const result = teachers.map(t => ({
            _id: t._id,
            userId: t.user._id,
            name: t.user.name,
            avatar: t.user.avatar,
            specializations: t.specializations,
            experience: t.experience,
            rating: t.rating,
            bio: t.bio,
            isAvailable: t.isAvailable,
            languages: t.languages
        }));

        res.json({ success: true, count: result.length, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   GET /api/public/teacher/:userId
// @desc    Get individual teacher public profile
// @access  Public
// ─────────────────────────────────────────────
router.get('/teacher/:userId', async (req, res) => {
    try {
        const teacher = await Teacher.findOne({ user: req.params.userId })
            .populate('user', 'name email avatar createdAt')
            .populate('courses');

        if (!teacher || !teacher.approvedByAdmin) {
            return res.status(404).json({ success: false, message: 'Teacher not found.' });
        }

        res.json({ success: true, data: teacher });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
