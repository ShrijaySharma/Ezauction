import express from 'express';
import bcrypt from 'bcrypt';
import { requireAuth, requireAppOwner } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireAppOwner);

router.post('/update-credentials', async (req, res) => {
    const { targetRole, newUsername, newPassword } = req.body;
    const db = req.app.locals.db;

    if (!['admin', 'host'].includes(targetRole)) {
        return res.status(400).json({ error: 'Invalid target role. Must be admin or host.' });
    }

    if (!newUsername || !newPassword) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Check if user exists with this role
        // Tricky part: if we have multiple admins, this updates ALL of them? 
        // Or just the first one? Or should we delete others?
        // For this simple app, we assume one admin and one host.

        // We'll first check if a user with the *new* username already exists (and is NOT the target role)
        // to avoid unique constraint violations if we are just renaming.

        db.get('SELECT id, role FROM users WHERE username = ?', [newUsername], (err, existingUser) => {
            if (err) return res.status(500).json({ error: 'Database error' });

            if (existingUser && existingUser.role !== targetRole) {
                return res.status(400).json({ error: 'Username already taken by another user' });
            }

            // Now updert
            db.get('SELECT id FROM users WHERE role = ?', [targetRole], (err, user) => {
                if (err) return res.status(500).json({ error: 'Database error' });

                if (user) {
                    // Update the existing user
                    db.run('UPDATE users SET username = ?, password = ? WHERE id = ?',
                        [newUsername, hashedPassword, user.id],
                        (err) => {
                            if (err) return res.status(500).json({ error: 'Database update failed: ' + err.message });
                            res.json({ success: true, message: `${targetRole} credentials updated successfully` });
                        });
                } else {
                    // Create new user
                    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                        [newUsername, hashedPassword, targetRole],
                        (err) => {
                            if (err) return res.status(500).json({ error: 'Database insert failed: ' + err.message });
                            res.json({ success: true, message: `${targetRole} created with credentials successfully` });
                        });
                }
            });
        });

    } catch (error) {
        console.error('Error updating credentials:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
