const db = require('../../../config/database');

class ArticleModel {
  static getAll() {
    return db.getAllArticles();
  }

  static findById(id) {
    return db.getArticleById(id);
  }

  static create(articleData) {
    return db.createArticle(articleData);
  }

  static update(id, updates) {
    return db.updateArticle(id, updates);
  }

  static delete(id) {
    return db.deleteArticle(id);
  }
}

module.exports = ArticleModel;

