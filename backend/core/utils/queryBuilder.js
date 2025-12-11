/**
 * Professional Query Builder
 * Builds optimized database queries with filtering, sorting, and pagination
 */

class QueryBuilder {
  constructor(collection, data) {
    this.collection = collection;
    this.data = data || [];
    this.filters = [];
    this.sortBy = null;
    this.sortOrder = 'asc';
    this.limit = null;
    this.offset = 0;
    this.selectFields = null;
  }

  /**
   * Add filter condition
   */
  where(field, operator, value) {
    this.filters.push({ field, operator, value });
    return this;
  }

  /**
   * Add equality filter
   */
  equals(field, value) {
    return this.where(field, '=', value);
  }

  /**
   * Add range filter
   */
  between(field, min, max) {
    this.filters.push({ field, operator: 'between', min, max });
    return this;
  }

  /**
   * Add in filter
   */
  in(field, values) {
    this.filters.push({ field, operator: 'in', values });
    return this;
  }

  /**
   * Add search filter
   */
  search(field, term) {
    this.filters.push({ field, operator: 'search', term });
    return this;
  }

  /**
   * Sort results
   */
  orderBy(field, order = 'asc') {
    this.sortBy = field;
    this.sortOrder = order.toLowerCase() === 'desc' ? 'desc' : 'asc';
    return this;
  }

  /**
   * Limit results
   */
  take(limit) {
    this.limit = limit;
    return this;
  }

  /**
   * Skip results
   */
  skip(offset) {
    this.offset = offset;
    return this;
  }

  /**
   * Paginate results
   */
  paginate(page, pageSize) {
    this.offset = (page - 1) * pageSize;
    this.limit = pageSize;
    return this;
  }

  /**
   * Select specific fields
   */
  select(fields) {
    this.selectFields = Array.isArray(fields) ? fields : [fields];
    return this;
  }

  /**
   * Execute query
   */
  execute() {
    let results = [...this.data];

    // Apply filters
    for (const filter of this.filters) {
      results = this.applyFilter(results, filter);
    }

    // Apply sorting
    if (this.sortBy) {
      results = this.applySort(results, this.sortBy, this.sortOrder);
    }

    // Get total count before pagination
    const total = results.length;

    // Apply pagination
    if (this.offset > 0) {
      results = results.slice(this.offset);
    }
    if (this.limit !== null) {
      results = results.slice(0, this.limit);
    }

    // Apply field selection
    if (this.selectFields) {
      results = results.map(item => {
        const selected = {};
        for (const field of this.selectFields) {
          if (item.hasOwnProperty(field)) {
            selected[field] = item[field];
          }
        }
        return selected;
      });
    }

    return {
      data: results,
      total,
      page: this.limit ? Math.floor(this.offset / this.limit) + 1 : 1,
      pageSize: this.limit || total,
      pages: this.limit ? Math.ceil(total / this.limit) : 1
    };
  }

  /**
   * Apply filter to results
   */
  applyFilter(results, filter) {
    return results.filter(item => {
      const value = this.getNestedValue(item, filter.field);
      
      switch (filter.operator) {
        case '=':
          return value === filter.value;
        case '!=':
          return value !== filter.value;
        case '>':
          return value > filter.value;
        case '>=':
          return value >= filter.value;
        case '<':
          return value < filter.value;
        case '<=':
          return value <= filter.value;
        case 'between':
          return value >= filter.min && value <= filter.max;
        case 'in':
          return filter.values.includes(value);
        case 'search':
          return String(value).toLowerCase().includes(String(filter.term).toLowerCase());
        case 'contains':
          return String(value).includes(String(filter.value));
        default:
          return true;
      }
    });
  }

  /**
   * Apply sorting
   */
  applySort(results, field, order) {
    return results.sort((a, b) => {
      const aValue = this.getNestedValue(a, field);
      const bValue = this.getNestedValue(b, field);
      
      if (aValue === bValue) return 0;
      
      const comparison = aValue > bValue ? 1 : -1;
      return order === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Get nested value from object
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  /**
   * Get count without executing full query
   */
  count() {
    let results = [...this.data];
    
    for (const filter of this.filters) {
      results = this.applyFilter(results, filter);
    }
    
    return results.length;
  }

  /**
   * Check if any results exist
   */
  exists() {
    return this.count() > 0;
  }

  /**
   * Get first result
   */
  first() {
    const result = this.take(1).execute();
    return result.data[0] || null;
  }
}

module.exports = QueryBuilder;

