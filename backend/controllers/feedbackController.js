// Feedback Controller
const db = require('../config/database');

// Submit feedback
exports.submitFeedback = async (req, res) => {
    try {
        const { type, title, description } = req.body;

        if (!type || !title || !description) {
            return res.status(400).json({
                success: false,
                error: 'Tüm alanlar gereklidir'
            });
        }

        const validTypes = ['bug', 'feature', 'improvement', 'other'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: 'Geçersiz geri bildirim türü'
            });
        }

        // Save to database
        await db.query(
            'INSERT INTO feedback (type, title, description, userId) VALUES (?, ?, ?, ?)',
            [type, title, description, req.user?.id || null]
        );

        res.json({
            success: true,
            message: 'Geri bildiriminiz için teşekkürler'
        });
    } catch (error) {
        console.error('[Feedback] Submit error:', error);
        res.status(500).json({
            success: false,
            error: 'Geri bildirim gönderilemedi'
        });
    }
};

// Get all feedback (admin only)
exports.getAllFeedback = async (req, res) => {
    try {
        const { type } = req.query;

        let query = 'SELECT * FROM feedback';
        const params = [];

        if (type) {
            query += ' WHERE type = ?';
            params.push(type);
        }

        query += ' ORDER BY createdAt DESC';

        const [feedback] = await db.query(query, params);

        res.json({
            success: true,
            data: { feedback }
        });
    } catch (error) {
        console.error('[Feedback] Get all error:', error);
        res.status(500).json({
            success: false,
            error: 'Geri bildirimler alınamadı'
        });
    }
};
