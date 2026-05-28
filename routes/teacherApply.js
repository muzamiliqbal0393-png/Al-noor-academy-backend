const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Notification = require('../models/Notification');

// Ensure upload dirs exist
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const baseUploadDir = path.join(__dirname, '../uploads/teacher');
ensureDir(baseUploadDir);

const avatarsDir = path.join(baseUploadDir, 'avatars');
const docsDir = path.join(baseUploadDir, 'docs');
const videosDir = path.join(baseUploadDir, 'videos');
ensureDir(avatarsDir);
ensureDir(docsDir);
ensureDir(videosDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'profilePicture') return cb(null, avatarsDir);
    if (file.fieldname === 'introVideo') return cb(null, videosDir);
    return cb(null, docsDir); // cnicPassport, certificates
  },
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${file.fieldname}-${req.user._id}-${Date.now()}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Accept images/docs/videos broadly; backend can refine
    const ok =
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/') ||
      file.mimetype === 'application/pdf' ||
      file.mimetype.startsWith('application/');
    cb(ok ? null : new Error('Invalid file type'), ok);
  }
});

/**
 * POST /api/admin/teacher-apply
 * Teacher application (multipart)
 * Requires: user exists and is logged in with role=teacher.
 * Creates/updates Teacher profile with approvedByAdmin=false (pending) and isAvailable=false.
 */
router.post(
  '/teacher-apply',
  protect,
  authorize('teacher'),
  upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'cnicPassport', maxCount: 1 },
    { name: 'certificates', maxCount: 20 },
    { name: 'introVideo', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const me = await Teacher.findOne({ user: req.user._id });

      // If teacher profile doesn't exist yet, create a minimal one.
      const teacher = me || (await Teacher.create({
        user: req.user._id,
        approvedByAdmin: false,
        isAvailable: false,
        specializations: [],
        experience: 0,
        qualificationText: '',
        qualificationFiles: []
      }));

      const subjects = (req.body.subjects || '')
        .toString()
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const profilePictureFile = req.files?.profilePicture?.[0];
      const cnicPassportFile = req.files?.cnicPassport?.[0];
      const certificatesFiles = req.files?.certificates || [];
      const introVideoFile = req.files?.introVideo?.[0];

      // Store main qualification docs as qualificationFiles (URLs)
      const qualificationFiles = [
        cnicPassportFile ? `/uploads/teacher/docs/${path.basename(cnicPassportFile.filename)}` : null,
        ...certificatesFiles.map(f => `/uploads/teacher/docs/${path.basename(f.filename)}`)
      ].filter(Boolean);

      // Update fields from request
      const update = {
        specializations: subjects,
        experience: Number(req.body.experience || 0) || 0,
        qualificationText: req.body.qualification || '',
        bio: req.body.about || '',
        languages: req.body.languages ? req.body.languages.toString().split(',').map(x=>x.trim()).filter(Boolean) : [],
        schedule: req.body.schedule ? [{ day: 'Monday', startTime: req.body.schedule, endTime: '' }] : teacher.schedule,
        approvedByAdmin: false,
        isAvailable: false
      };

      if (req.body.fullName) {
        await User.findByIdAndUpdate(req.user._id, { name: req.body.fullName });
      }

      if (profilePictureFile) {
        const avatarUrl = `/uploads/teacher/avatars/${path.basename(profilePictureFile.filename)}`;
        await User.findByIdAndUpdate(req.user._id, { avatar: avatarUrl });
        // also keep in teacher doc if you want later
      }

      if (introVideoFile) {
        const videoUrl = `/uploads/teacher/videos/${path.basename(introVideoFile.filename)}`;
        // store as a certification-ish entry so it isn't lost
        update.qualificationFiles = [...qualificationFiles, videoUrl];
      } else {
        update.qualificationFiles = qualificationFiles;
      }

      const updated = await Teacher.findOneAndUpdate(
        { user: req.user._id },
        update,
        { new: true, runValidators: true }
      ).populate('user', 'name email');

      await Notification.create({
        recipient: req.user._id,
        title: '📨 Teacher Application Received',
        body: 'Your teacher application has been submitted. Admin will review it shortly, inshaAllah.',
        type: 'announcement'
      });

      return res.json({ success: true, message: 'Teacher application received', data: { approvedByAdmin: updated.approvedByAdmin } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;

