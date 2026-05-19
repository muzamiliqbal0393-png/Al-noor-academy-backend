const Resource = require('../models/Resource');

exports.getResources = async (req, res, next) => {
    try {
        const { category, type, level, childId } = req.query;
        let query = {};

        if (req.user.role !== 'admin') {
            query.$or = [{ isPublic: true }, { assignedTo: childId }];
        }

        if (category) query.category = category;
        if (type) query.type = type;
        if (level) query.level = level;

        const resources = await Resource.find(query).sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: resources.length, data: resources });
    } catch (error) { next(error); }
};

exports.createResource = async (req, res, next) => {
    try {
        const resource = await Resource.create({ ...req.body, uploadedBy: req.user.id });
        res.status(201).json({ success: true, data: resource });
    } catch (error) { next(error); }
};

exports.updateResource = async (req, res, next) => {
    try {
        const resource = await Resource.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({ success: true, data: resource });
    } catch (error) { next(error); }
};

exports.deleteResource = async (req, res, next) => {
    try {
        await Resource.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Resource deleted' });
    } catch (error) { next(error); }
};

exports.downloadResource = async (req, res, next) => {
    try {
        await Resource.findByIdAndUpdate(req.params.id, { $inc: { downloads: 1 } });
        const resource = await Resource.findById(req.params.id);
        res.status(200).json({ success: true, data: resource });
    } catch (error) { next(error); }
};