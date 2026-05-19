/ routes/prayer.js
const express5 = require('express');
const router5 = express5.Router();
router5.get('/', (req, res) => {
    const { lat, lng } = req.query;
    res.json({
        success: true,
        data: {
            fajr: '4:12 AM', sunrise: '5:45 AM', dhuhr: '1:15 PM',
            asr: '5:30 PM', maghrib: '8:45 PM', isha: '10:10 PM',
            date: new Date().toDateString()
        }
    });
});
module.exports = router5;