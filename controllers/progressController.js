const Progress = require('../models/Progress');
const Child = require('../models/Child');
const Notification = require('../models/Notification');

exports.getProgress = async (req, res, next) => {
    try {
        const progress = await Progress.find({ child: req.params.childId })
            .sort({ year: -1, month: -1 }).limit(6)
            .populate({ path: 'teacher', populate: { path: 'user', select: 'name avatar' } });

        res.status(200).json({ success: true, count: progress.length, data: progress, latest: progress[0] });
    } catch (error) { next(error); }
};

exports.getMonthlyReport = async (req, res, next) => {
    try {
        const report = await Progress.findOne({
            child: req.params.childId,
            month: req.params.month,
            year: req.params.year
        }).populate('child', 'name age level')
          .populate({ path: 'teacher', populate: { path: 'user', select: 'name avatar' } });

        if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
        res.status(200).json({ success: true, data: report });
    } catch (error) { next(error); }
};

exports.updateProgress = async (req, res, next) => {
    try {
        const { month, year, scores, surahsCompleted, teacherRemarks, areasOfImprovement, strengths, overallGrade } = req.body;
        const Teacher = require('../models/Teacher');
        const teacher = await Teacher.findOne({ user: req.user.id });

        let progress = await Progress.findOne({ child: req.params.childId, month, year });

        if (progress) {
            Object.assign(progress, { scores, teacherRemarks, areasOfImprovement, strengths, overallGrade });
            if (surahsCompleted) progress.surahsCompleted.push(...surahsCompleted);
            await progress.save();
        } else {
            progress = await Progress.create({
                child: req.params.childId, teacher: teacher?._id,
                month, year, scores, surahsCompleted, teacherRemarks,
                areasOfImprovement, strengths, overallGrade
            });
        }

        const scoreValues = Object.values(scores).filter(v => v > 0);
        const overallProgress = scoreValues.length
            ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) : 0;

        await Child.findByIdAndUpdate(req.params.childId, { 'stats.overallProgress': overallProgress });

        const child = await Child.findById(req.params.childId);
        await Notification.create({
            user: child.parent,
            title: '📊 Progress Report Updated',
            message: `${child.name}'s progress report has been updated by the teacher.`,
            type: 'progress_report',
            data: { childId: child._id, progressId: progress._id }
        });

        res.status(200).json({ success: true, message: 'Progress updated!', data: progress });
    } catch (error) { next(error); }
};