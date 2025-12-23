// JSON database based step model (no Mongoose)
const db = require('../../config/database');

class Step {
    static async create(data) {
        if (!db.data.steps) db.data.steps = {};

        const key = `${data.userId}_${data.date}`;
        db.data.steps[key] = {
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await db.scheduleSave();
        return db.data.steps[key];
    }

    static async findOne(query) {
        if (!db.data.steps) return null;

        const { userId, date } = query;
        const key = `${userId}_${date}`;
        return db.data.steps[key] || null;
    }

    static async findOneAndUpdate(query, update, options = {}) {
        const { userId, date } = query;
        const key = `${userId}_${date}`;

        if (!db.data.steps) db.data.steps = {};

        if (!db.data.steps[key] && options.upsert) {
            // Create new
            db.data.steps[key] = {
                userId,
                date,
                ...update.$setOnInsert,
                ...update,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        } else if (db.data.steps[key]) {
            // Update existing
            db.data.steps[key] = {
                ...db.data.steps[key],
                ...update,
                updatedAt: new Date().toISOString()
            };
        }

        await db.scheduleSave();
        return db.data.steps[key];
    }

    static async find(query) {
        if (!db.data.steps) return [];

        const { userId, date } = query;
        const results = [];

        for (const key in db.data.steps) {
            const step = db.data.steps[key];

            if (step.userId !== userId) continue;

            if (date && date.$gte) {
                if (step.date >= date.$gte) {
                    results.push(step);
                }
            } else if (date) {
                if (step.date === date) {
                    results.push(step);
                }
            } else {
                results.push(step);
            }
        }

        return results;
    }

    static sort(results, sortKey) {
        if (sortKey.date === -1) {
            return results.sort((a, b) => b.date.localeCompare(a.date));
        }
        return results;
    }

    static limit(results, count) {
        return results.slice(0, count);
    }
}

// Add sort and limit methods to arrays returned by find
Step.find = async (query) => {
    if (!db.data.steps) return [];

    const { userId, date } = query;
    const results = [];

    for (const key in db.data.steps) {
        const step = db.data.steps[key];

        if (step.userId !== userId) continue;

        if (date && date.$gte) {
            if (step.date >= date.$gte) {
                results.push(step);
            }
        } else if (date) {
            if (step.date === date) {
                results.push(step);
            }
        } else {
            results.push(step);
        }
    }

    return {
        results,
        sort: function (sortObj) {
            const sortKey = Object.keys(sortObj)[0];
            const sortDir = sortObj[sortKey];

            if (sortKey === 'date') {
                this.results = this.results.sort((a, b) => {
                    return sortDir === -1
                        ? b.date.localeCompare(a.date)
                        : a.date.localeCompare(b.date);
                });
            }
            return this;
        },
        limit: function (count) {
            this.results = this.results.slice(0, count);
            return this.results;
        }
    };
};

module.exports = Step;
