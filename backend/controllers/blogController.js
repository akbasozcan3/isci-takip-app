// Blog Controller
const db = require('../config/database');

class BlogController {
  // Get all articles
  async getAllArticles(req, res) {
    try {
      const articles = db.getAllArticles();
      return res.json(articles);
    } catch (error) {
      console.error('Get all articles error:', error);
      return res.status(500).json({ error: 'Failed to fetch articles' });
    }
  }

  // Get single article by ID
  async getArticleById(req, res) {
    try {
      const { id } = req.params;
      const article = db.getArticleById(id);
      
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      return res.json(article);
    } catch (error) {
      console.error('Get article by ID error:', error);
      return res.status(500).json({ error: 'Failed to fetch article' });
    }
  }

  // Create new article (admin only)
  async createArticle(req, res) {
    try {
      const { title, excerpt, content, readTime, hero, tags } = req.body;
      
      if (!title || !excerpt || !content) {
        return res.status(400).json({ error: 'Title, excerpt, and content are required' });
      }

      const article = db.createArticle({
        title: title.trim(),
        excerpt: excerpt.trim(),
        content: content.trim(),
        readTime: readTime || '5 dk',
        hero: hero || null,
        tags: tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return res.status(201).json({
        success: true,
        message: 'Article created successfully',
        article
      });
    } catch (error) {
      console.error('Create article error:', error);
      return res.status(500).json({ error: 'Failed to create article' });
    }
  }

  // Update article (admin only)
  async updateArticle(req, res) {
    try {
      const { id } = req.params;
      const { title, excerpt, content, readTime, hero, tags } = req.body;
      
      const article = db.getArticleById(id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      const updatedArticle = db.updateArticle(id, {
        title: title?.trim() || article.title,
        excerpt: excerpt?.trim() || article.excerpt,
        content: content?.trim() || article.content,
        readTime: readTime || article.readTime,
        hero: hero !== undefined ? hero : article.hero,
        tags: tags || article.tags,
        updatedAt: new Date().toISOString()
      });

      return res.json({
        success: true,
        message: 'Article updated successfully',
        article: updatedArticle
      });
    } catch (error) {
      console.error('Update article error:', error);
      return res.status(500).json({ error: 'Failed to update article' });
    }
  }

  // Delete article (admin only)
  async deleteArticle(req, res) {
    try {
      const { id } = req.params;
      
      const article = db.getArticleById(id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      db.deleteArticle(id);

      return res.json({
        success: true,
        message: 'Article deleted successfully'
      });
    } catch (error) {
      console.error('Delete article error:', error);
      return res.status(500).json({ error: 'Failed to delete article' });
    }
  }
}

module.exports = new BlogController();
