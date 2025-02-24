const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');

const { Schema } = mongoose;

class Database {
    constructor(url, options = { useNewUrlParser: true, useUnifiedTopology: true }) {
        this.url = url;
        this.options = options;
        this.db = null;
        this.model = null;
    }

    async connect() {
        if (!this.db) {
            this.db = await mongoose.connect(this.url, this.options);
            const schema = new Schema({
                name: String,
                data: { type: Object, default: {} }
            });

            this.model = mongoose.models.Database || mongoose.model('Database', schema);
            console.log('MongoDB connected!');
        }
    }

    async addDatabase(name) {
        await this.connect();
        const exists = await this.model.findOne({ name });
        if (exists) return `File '${name}' already available`;
        await this.model.create({ name, data: {} });
        return `Database '${name}' created`;
    }

    async rename(name, newName) {
        await this.connect();
        const db = await this.model.findOne({ name });
        if (!db) return `'${name}' not found`;
        await this.model.updateOne({ name }, { name: newName });
        return `Database renamed to '${newName}'`;
    }

    async modify(name, newData) {
        await this.connect();
        const db = await this.model.findOne({ name });
        if (!db) return `'${name}' not found`;
        db.data = { ...db.data, ...newData };
        await db.save();
        return `Data updated in '${name}'`;
    }

    async deleteDatabase(name) {
        await this.connect();
        const result = await this.model.deleteOne({ name });
        return result.deletedCount ? `Database '${name}' deleted` : `'${name}' not found`;
    }

    async checkDatabase(name, key, value) {
        await this.connect();
        const db = await this.model.findOne({ name });
        if (!db) return false;
        return key ? db.data[key] === value : db.data;
    }

    async statDatabase(name) {
        await this.connect();
        const db = await this.model.findOne({ name });
        if (!db) return `'${name}' not found`;
        return {
            name: db.name,
            size: Buffer.byteLength(JSON.stringify(db.data), 'utf8') + ' bytes',
            createdTime: moment(db._id.getTimestamp()).format('DD/MM/YY HH:mm:ss')
        };
    }
}

module.exports = Database;
