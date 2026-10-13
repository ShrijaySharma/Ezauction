import express from 'express';
import bcrypt from 'bcrypt';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireSuperAdmin);

// Super Admin: Change their own password
router.post('/change-password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.userId;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    try {
        // Fetch the super admin record
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('id, username, password, role')
            .eq('id', userId)
            .eq('role', 'super_admin')
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!user) return res.status(404).json({ error: 'Super admin account not found' });

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash and update the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const { error: updateError } = await supabase
            .from('users')
            .update({ password: hashedPassword })
            .eq('id', userId);

        if (updateError) throw updateError;

        res.json({ success: true, message: 'Super Admin password updated successfully' });
    } catch (error) {
        console.error('Error changing super admin password:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Super Admin: Change username
router.post('/change-username', async (req, res) => {
    const { newUsername, currentPassword } = req.body;
    const userId = req.session.userId;

    if (!newUsername || !currentPassword) {
        return res.status(400).json({ error: 'New username and current password are required' });
    }

    if (newUsername.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    try {
        // Fetch current user
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('id, username, password, role')
            .eq('id', userId)
            .eq('role', 'super_admin')
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!user) return res.status(404).json({ error: 'Super admin account not found' });

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Check if username is taken
        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('username', newUsername)
            .neq('id', userId)
            .maybeSingle();

        if (existing) {
            return res.status(409).json({ error: 'Username already taken. Choose a different one.' });
        }

        // Update username
        const { error: updateError } = await supabase
            .from('users')
            .update({ username: newUsername })
            .eq('id', userId);

        if (updateError) throw updateError;

        // Update session
        req.session.username = newUsername;

        res.json({ success: true, message: 'Username updated successfully', newUsername });
    } catch (error) {
        console.error('Error changing super admin username:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
