const Teacher = require('../models/Teacher');
const Child = require('../models/Child');
const Class = require('../models/Class');

exports.getAllTeachers = async (req, res, next) => {
    try {
        const teachers = await Teacher.find({ isAvailable: true })
            .populate('user', 'name avatar email')
            .populate('students', 'name');
        res.status(200).json({ success: true, count: teachers.length, data: teachers });
    } catch (error) { next(error); }
};

exports.getTeacherProfile = async (req, res, next) => {
    try {
        const teacher = await Teacher.findById(req.params.id)
            .populate('user', 'name avatar email phone')
            .populate('students', 'name age');
        if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });
        res.status(200).json({ success: true, data: teacher });
    } catch (error) { next(error); }
};

exports.getMyProfile = async (req, res, next) => {
    try {
        const teacher = await Teacher.findOne({ user: req.user.id })
            .populate('user', 'name avatar email phone')
            .populate('students', 'name age avatar level');
        if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found' });
        res.status(200).json({ success: true, data: teacher });
    } catch (error) { next(error); }
};

exports.updateTeacherProfile = async (req, res, next) => {
    try {
        const teacher = await Teacher.findOneAndUpdate(
            { user: req.user.id }, req.body, { new: true }
        ).populate('user', 'name avatar email');
        res.status(200).json({ success: true, data: teacher });
    } catch (error) { next(error); }
};

exports.assignTeacher = async (req, res, next) => {
    try {
        const { childId, teacherId } = req.body;

        await Child.findByIdAndUpdate(childId, { teacher: teacherId });
        await Teacher.findByIdAndUpdate(teacherId, { $addToSet: { students: childId } });

        const child = await Child.findById(childId);
        const Notification = require('../models/Notification');

        await Notification.create({
            user: child.parent,
            title: '👨‍🏫 Teacher Assigned',
            message: `A teacher has been assigned to ${child.name}!`,
            type: 'announcement'
        });

        res.status(200).json({ success: true, message: 'Teacher assigned successfully' });
    } catch (error) { next(error); }
};

exports.getTeacherStudents = async (req, res, next) => {
    try {
        const teacher = await Teacher.findOne({ user: req.user.id });
        if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });

        const students = await Child.find({ teacher: teacher._id, isActive: true })
            .populate('parent', 'name email phone');

        res.status(200).json({ success: true, count: students.length, data: students });
    } catch (error) { next(error); }
};