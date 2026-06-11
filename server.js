import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'db.json');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the root directory
app.use(express.static('.'));

// Helper to read DB
async function readDB() {
    try {
        const data = await fs.readFile(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading DB:', error);
        return { customers: [], payments: [], saasTypes: ["Hora Clínica", "Hora Barber", "Hora Pet"], config: {} };
    }
}

// Helper to write DB
async function writeDB(data) {
    try {
        await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
        console.log('✅ DB saved successfully to:', DB_PATH);
    } catch (error) {
        console.error('❌ Error writing DB:', error);
    }
}

// API Routes
app.get('/api/data', async (req, res) => {
    console.log('GET /api/data - Loading database');
    const db = await readDB();
    res.json(db);
});

app.post('/api/save', async (req, res) => {
    console.log('POST /api/save - Saving data...');
    try {
        const { customers, payments, saasTypes, config } = req.body;
        
        // Basic validation to prevent saving empty object
        if (!customers && !saasTypes) {
            console.warn('⚠️ Warning: Received empty or invalid data in save request');
        }

        const db = { 
            customers: customers || [], 
            payments: payments || [], 
            saasTypes: saasTypes || ["Hora Clínica", "Hora Barber", "Hora Pet"], 
            config: config || {} 
        };
        
        await writeDB(db);
        res.json({ success: true });
    } catch (error) {
        console.error('Error in /api/save:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📁 Database path: ${DB_PATH}`);
});
