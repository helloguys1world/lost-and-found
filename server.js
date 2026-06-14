const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const db = require('./config/db');
require('dotenv').config();

const app = express();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'public/uploads'))
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});
const upload = multer({ storage: storage });

// Helper to generate IDs
const generateId = (prefix) => {
    return prefix + Math.floor(1000 + Math.random() * 9000);
};

// Item matching logic helper
const checkAndCreateMatches = async (type, item) => {
    try {
        if (type === 'lost') {
            const [foundItems] = await db.execute(
                `SELECT item_id, user_id FROM found_items WHERE category_id = ? AND status IN ('Found', 'available') AND (item_name LIKE ? OR description LIKE ?)`,
                [item.category_id, `%${item.item_name}%`, `%${item.item_name}%`]
            );
            for (let f of foundItems) {
                await db.execute('INSERT INTO item_matches (lost_item_id, found_item_id, confidence_score) VALUES (?, ?, ?)', [item.item_id, f.item_id, 80.0]);
                // Notify finder
                await db.execute('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)', [f.user_id, 'match', `A potential match was found for an item you reported!`]);
            }
        } else if (type === 'found') {
            const [lostItems] = await db.execute(
                `SELECT item_id, user_id FROM lost_items WHERE category_id = ? AND status = 'Lost' AND (item_name LIKE ? OR description LIKE ?)`,
                [item.category_id, `%${item.item_name}%`, `%${item.item_name}%`]
            );
            for (let l of lostItems) {
                await db.execute('INSERT INTO item_matches (lost_item_id, found_item_id, confidence_score) VALUES (?, ?, ?)', [l.item_id, item.item_id, 80.0]);
                // Notify lost item owner
                await db.execute('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)', [l.user_id, 'match', `A potential match was found for your lost item!`]);
            }
        }
    } catch (e) {
        console.error('Matching Error:', e);
    }
};

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false
}));

// Middleware to pass user info to all views
app.use(async (req, res, next) => {
    res.locals.user = req.session.user || null;
    if (res.locals.user) {
        // Fetch unread notifications count
        try {
            const [notifications] = await db.execute('SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = FALSE', [req.session.user.id]);
            res.locals.unreadNotifications = notifications[0].unread_count;
        } catch (e) {
            res.locals.unreadNotifications = 0;
        }
    } else {
        res.locals.unreadNotifications = 0;
    }
    next();
});

// Auth Middleware
const requireAuth = (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Forbidden - Admins only');
    next();
};

// --- AUTH ROUTES ---
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.render('login', { error: 'Invalid credentials' });
        
        const user = users[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.render('login', { error: 'Invalid credentials' });
        
        req.session.user = { id: user.user_id, username: user.username, role: user.role };
        
        if (user.role === 'admin') {
            res.redirect('/admin/dashboard');
        } else {
            res.redirect('/dashboard');
        }
    } catch (err) {
        console.error(err);
        res.render('login', { error: 'Server error' });
    }
});

app.get('/signup', (req, res) => {
    res.render('signup', { error: null });
});

app.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        await db.execute('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [username, email, hash]);
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        res.render('signup', { error: 'Username or email might already exist.' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- USER DASHBOARD ---
app.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const [lostItems] = await db.execute('SELECT * FROM lost_items WHERE user_id = ? ORDER BY created_at DESC', [req.session.user.id]);
        const [foundItems] = await db.execute('SELECT * FROM found_items WHERE user_id = ? ORDER BY created_at DESC', [req.session.user.id]);
        
        const [myClaims] = await db.execute(`
            SELECT c.*, f.item_name, f.unique_item_id as item_unique_id 
            FROM claims c 
            JOIN found_items f ON c.found_item_id = f.item_id 
            WHERE c.claimer_user_id = ? ORDER BY c.created_at DESC`, [req.session.user.id]);
            
        const [claimsOnMyFoundItems] = await db.execute(`
            SELECT c.*, f.item_name, f.unique_item_id as item_unique_id, u.username as claimer_name
            FROM claims c 
            JOIN found_items f ON c.found_item_id = f.item_id 
            JOIN users u ON c.claimer_user_id = u.user_id
            WHERE f.user_id = ? ORDER BY c.created_at DESC`, [req.session.user.id]);

        res.render('dashboard', { lostItems, foundItems, myClaims, claimsOnMyFoundItems });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// --- REPORTING ROUTES ---
app.get('/report-lost', requireAuth, async (req, res) => {
    try {
        const [categories] = await db.execute('SELECT * FROM item_categories');
        res.render('report_lost', { categories });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.post('/report-lost', requireAuth, async (req, res) => {
    const { category_id, item_name, description, brand, color, identifying_marks, location_lost, date_lost } = req.body;
    const unique_id = generateId('LF');
    try {
        const [result] = await db.execute(
            'INSERT INTO lost_items (unique_item_id, user_id, category_id, item_name, description, brand, color, identifying_marks, location_lost, date_lost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [unique_id, req.session.user.id, category_id, item_name, description, brand, color, identifying_marks, location_lost, date_lost]
        );
        const item_id = result.insertId;
        await checkAndCreateMatches('lost', { item_id, category_id, item_name });
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.get('/report-found', requireAuth, async (req, res) => {
    try {
        const [categories] = await db.execute('SELECT * FROM item_categories');
        res.render('report_found', { categories });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.post('/report-found', requireAuth, async (req, res) => {
    const { category_id, item_name, description, brand, color, identifying_marks, location_found, date_found } = req.body;
    const unique_id = generateId('LF');
    const tracking_id = 'TRK-' + Date.now() + Math.floor(Math.random() * 1000);
    try {
        const [result] = await db.execute(
            'INSERT INTO found_items (unique_item_id, user_id, category_id, item_name, description, brand, color, identifying_marks, location_found, date_found, tracking_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [unique_id, req.session.user.id, category_id, item_name, description, brand, color, identifying_marks, location_found, date_found, tracking_id]
        );
        const item_id = result.insertId;
        await checkAndCreateMatches('found', { item_id, category_id, item_name });
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// --- FEED & SEARCH ---
app.get('/feed', async (req, res) => {
    const search = req.query.search || '';
    const unique_id = req.query.unique_id || '';
    const category_id = req.query.category_id || '';
    const status = req.query.status || '';
    const location = req.query.location || '';
    const date = req.query.date || '';
    try {
        let queryParams = [];
        let lostWhere = [];
        let foundWhere = [];
        
        // Advanced filtering logic
        if (search) {
            lostWhere.push(`(item_name LIKE ? OR description LIKE ?)`);
            foundWhere.push(`(item_name LIKE ? OR description LIKE ?)`);
            queryParams.push(`%${search}%`, `%${search}%`);
        }
        if (unique_id) {
            lostWhere.push(`unique_item_id = ?`);
            foundWhere.push(`unique_item_id = ?`);
            queryParams.push(unique_id);
        }
        if (category_id) {
            lostWhere.push(`category_id = ?`);
            foundWhere.push(`category_id = ?`);
            queryParams.push(category_id);
        }
        if (status) {
            lostWhere.push(`status = ?`);
            foundWhere.push(`status = ?`);
            queryParams.push(status);
        }
        if (location) {
            lostWhere.push(`location_lost LIKE ?`);
            foundWhere.push(`location_found LIKE ?`);
            queryParams.push(`%${location}%`);
        }
        if (date) {
            lostWhere.push(`date_lost = ?`);
            foundWhere.push(`date_found = ?`);
            queryParams.push(date);
        }

        let lostConditions = lostWhere.length > 0 ? 'WHERE ' + lostWhere.join(' AND ') : '';
        let foundConditions = foundWhere.length > 0 ? 'WHERE ' + foundWhere.join(' AND ') : '';

        // For UNION ALL, the parameters need to be duplicated for both queries
        const query = `
            SELECT 'Lost' as item_type, item_id, unique_item_id, item_name, description, location_lost as location, date_lost as date, status, created_at 
            FROM lost_items ${lostConditions}
            UNION ALL
            SELECT 'Found' as item_type, item_id, unique_item_id, item_name, description, location_found as location, date_found as date, status, created_at 
            FROM found_items ${foundConditions}
            ORDER BY created_at DESC
        `;
        
        const finalParams = [...queryParams, ...queryParams];
        const [items] = await db.execute(query, finalParams);
        const [categories] = await db.execute('SELECT * FROM item_categories');

        res.render('feed', { items, search, unique_id, category_id, status, location, date, categories });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// --- CLAIM ROUTES ---
app.get('/claims/new', requireAuth, async (req, res) => {
    const item_id = req.query.item_id;
    if (!item_id) return res.status(400).send('Item ID is required');

    try {
        const [items] = await db.execute('SELECT * FROM found_items WHERE item_id = ?', [item_id]);
        if (items.length === 0) return res.status(404).send('Item not found');
        res.render('claim-form', { item: items[0] });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.post('/claims/submit', requireAuth, async (req, res) => {
    const { found_item_id, proof_description } = req.body;
    const claim_unique_id = generateId('CL');

    try {
        const [items] = await db.execute('SELECT * FROM found_items WHERE item_id = ?', [found_item_id]);
        if (items.length === 0) return res.status(404).send('Item not found');
        const item = items[0];

        await db.execute(
            `INSERT INTO claims (claim_unique_id, found_item_id, claimer_user_id, proof_description, status) VALUES (?, ?, ?, ?, 'Pending')`,
            [claim_unique_id, found_item_id, req.session.user.id, proof_description]
        );

        // Notify finder
        await db.execute('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)', 
            [item.user_id, 'claim', `Someone has submitted a claim for your found item: ${item.item_name}`]);

        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// --- ANNOUNCEMENTS / NOTIFICATIONS ROUTES ---
app.get('/announcements', requireAuth, async (req, res) => {
    try {
        const [notifications] = await db.execute('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC', [req.session.user.id]);
        // Mark as read
        await db.execute('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.session.user.id]);
        res.render('notifications', { notifications });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// --- ADMIN ROUTES ---
app.get('/admin/dashboard', requireAdmin, async (req, res) => {
    try {
        const [userCount] = await db.execute('SELECT COUNT(*) as count FROM users');
        const [lostCount] = await db.execute('SELECT COUNT(*) as count FROM lost_items');
        const [foundCount] = await db.execute('SELECT COUNT(*) as count FROM found_items');
        
        const [categoryStats] = await db.execute(`
            SELECT c.category_name, 
                   COUNT(l.item_id) as lost_count, 
                   COUNT(f.item_id) as found_count
            FROM item_categories c
            LEFT JOIN lost_items l ON c.category_id = l.category_id
            LEFT JOIN found_items f ON c.category_id = f.category_id
            GROUP BY c.category_id, c.category_name
        `);

        const [claims] = await db.execute(`
            SELECT c.*, f.item_name, f.unique_item_id as item_unique_id, u.username as claimer_name
            FROM claims c 
            JOIN found_items f ON c.found_item_id = f.item_id 
            JOIN users u ON c.claimer_user_id = u.user_id
            ORDER BY c.created_at DESC
        `);

        const [allUsers] = await db.execute(`
            SELECT u.user_id, u.username, u.email, u.role, u.created_at, p.full_name
            FROM users u
            LEFT JOIN profiles p ON u.user_id = p.user_id
            ORDER BY u.created_at DESC
        `);

        res.render('admin-dashboard', {
            stats: {
                users: userCount[0].count,
                lost: lostCount[0].count,
                found: foundCount[0].count
            },
            categoryStats,
            claims,
            allUsers
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.post('/admin/claims/:id/action', requireAdmin, async (req, res) => {
    const { action } = req.body;
    try {
        if (action === 'approved') {
            await db.execute("UPDATE claims SET status = 'Approved' WHERE claim_id = ?", [req.params.id]);
            const [claims] = await db.execute('SELECT * FROM claims WHERE claim_id = ?', [req.params.id]);
            if (claims.length > 0) {
                const claim = claims[0];
                await db.execute("UPDATE found_items SET status = 'Claimed' WHERE item_id = ?", [claim.found_item_id]);
                await db.execute('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)', 
                    [claim.claimer_user_id, 'claim_approved', `Your claim for item ${claim.claim_unique_id} has been approved!`]);
            }
        } else if (action === 'rejected') {
            await db.execute("UPDATE claims SET status = 'Rejected' WHERE claim_id = ?", [req.params.id]);
            const [claims] = await db.execute('SELECT * FROM claims WHERE claim_id = ?', [req.params.id]);
            if (claims.length > 0) {
                const claim = claims[0];
                await db.execute('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)', 
                    [claim.claimer_user_id, 'claim_rejected', `Your claim for item ${claim.claim_unique_id} has been rejected.`]);
            }
        }
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.post('/admin/announcements', requireAdmin, async (req, res) => {
    const { message } = req.body;
    try {
        const [users] = await db.execute('SELECT user_id FROM users');
        for (let u of users) {
            await db.execute('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)', 
                [u.user_id, 'announcement', message]);
        }
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// --- DB SEEDING ---
const seedAdmin = async () => {
    try {
        const [users] = await db.execute('SELECT * FROM users WHERE username = ?', ['admin']);
        if (users.length === 0) {
            const hash = await bcrypt.hash('admin123', 10);
            const [result] = await db.execute(
                "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
                ['admin', 'admin@lostandfound.com', hash]
            );
            await db.execute(
                "INSERT INTO profiles (user_id, full_name) VALUES (?, ?)",
                [result.insertId, 'System Admin']
            );
            console.log('Admin user seeded successfully.');
        }
    } catch (e) {
        console.error('Error seeding admin user:', e);
    }
};
seedAdmin();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
