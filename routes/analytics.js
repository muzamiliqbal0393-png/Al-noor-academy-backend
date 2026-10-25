const express = require('express');
const router = express.Router();

// ─────────────────────────────────────────────
// @route   GET /api/analytics/config
// @desc    Get analytics configuration for frontend integration
// @access  Public
// ─────────────────────────────────────────────
router.get('/config', (req, res) => {
    try {
        // Return configuration that frontend can use to initialize analytics
        res.json({
            success: true,
            analytics: {
                enabled: true,
                provider: 'vercel',
                package: '@vercel/analytics',
                message: 'Vercel Web Analytics is configured for this project'
            },
            integration: {
                react: {
                    package: '@vercel/analytics/react',
                    component: 'Analytics',
                    example: 'import { Analytics } from "@vercel/analytics/react"; // Add <Analytics /> to your App component'
                },
                nextjs: {
                    package: '@vercel/analytics/next',
                    component: 'Analytics',
                    example: 'import { Analytics } from "@vercel/analytics/next"; // Add <Analytics /> to your layout or _app file'
                },
                vue: {
                    package: '@vercel/analytics/vue',
                    component: 'Analytics',
                    example: 'import { Analytics } from "@vercel/analytics/vue"; // Add <Analytics /> to your App.vue'
                }
            }
        });
    } catch (err) {
        console.error('Analytics config error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────
// @route   GET /api/analytics/status
// @desc    Check if analytics is enabled
// @access  Public
// ─────────────────────────────────────────────
router.get('/status', (req, res) => {
    res.json({
        success: true,
        enabled: true,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
