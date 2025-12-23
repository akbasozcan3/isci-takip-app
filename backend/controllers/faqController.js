// FAQ Controller
const db = require('../config/database');

// Get all FAQs
exports.getAllFAQs = async (req, res) => {
    try {
        const [faqs] = await db.query(
            'SELECT * FROM faqs WHERE isActive = 1 ORDER BY `order` ASC, id ASC'
        );

        res.json({
            success: true,
            data: { faqs }
        });
    } catch (error) {
        console.error('[FAQ] Get all error:', error);
        res.status(500).json({
            success: false,
            error: 'FAQ listesi alınamadı'
        });
    }
};

// Create FAQ (admin only)
exports.createFAQ = async (req, res) => {
    try {
        const { category, question, answer, order = 0 } = req.body;

        if (!category || !question || !answer) {
            return res.status(400).json({
                success: false,
                error: 'Kategori, soru ve cevap gereklidir'
            });
        }

        const [result] = await db.query(
            'INSERT INTO faqs (category, question, answer, `order`) VALUES (?, ?, ?, ?)',
            [category, question, answer, order]
        );

        res.status(201).json({
            success: true,
            data: {
                id: result.insertId,
                category,
                question,
                answer,
                order
            }
        });
    } catch (error) {
        console.error('[FAQ] Create error:', error);
        res.status(500).json({
            success: false,
            error: 'FAQ oluşturulamadı'
        });
    }
};

// Update FAQ (admin only)
exports.updateFAQ = async (req, res) => {
    try {
        const { id } = req.params;
        const { category, question, answer, order, isActive } = req.body;

        const [result] = await db.query(
            'UPDATE faqs SET category = ?, question = ?, answer = ?, `order` = ?, isActive = ? WHERE id = ?',
            [category, question, answer, order, isActive, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'FAQ bulunamadı'
            });
        }

        res.json({
            success: true,
            message: 'FAQ güncellendi'
        });
    } catch (error) {
        console.error('[FAQ] Update error:', error);
        res.status(500).json({
            success: false,
            error: 'FAQ güncellenemedi'
        });
    }
};

// Delete FAQ (admin only)
exports.deleteFAQ = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query('DELETE FROM faqs WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'FAQ bulunamadı'
            });
        }

        res.json({
            success: true,
            message: 'FAQ silindi'
        });
    } catch (error) {
        console.error('[FAQ] Delete error:', error);
        res.status(500).json({
            success: false,
            error: 'FAQ silinemedi'
        });
    }
};
