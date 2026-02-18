import express from 'express';
import bcrypt from 'bcrypt';
import { requireAuth, requireAppOwner } from '../middleware/auth.js';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireAppOwner);

router.post('/update-credentials', async (req, res) => {
    const { targetRole, newUsername, newPassword } = req.body;

    if (!['admin', 'host'].includes(targetRole)) {
        return res.status(400).json({ error: 'Invalid target role. Must be admin or host.' });
    }

    if (!newUsername || !newPassword) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 1. Check if new username is taken by someone else
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id, role')
            .eq('username', newUsername)
            .maybeSingle();

        if (checkError) throw checkError;

        if (existingUser && existingUser.role !== targetRole) {
            return res.status(400).json({ error: 'Username already taken by another user' });
        }

        // 2. Find existing user with target role
        const { data: targetUser, error: targetError } = await supabase
            .from('users')
            .select('id')
            .eq('role', targetRole)
            .limit(1) // Assuming single admin/host for now
            .maybeSingle();

        if (targetError) throw targetError;

        if (targetUser) {
            // Update existing
            const { error: updateError } = await supabase
                .from('users')
                .update({ username: newUsername, password: hashedPassword })
                .eq('id', targetUser.id);

            if (updateError) throw updateError;
            res.json({ success: true, message: `${targetRole} credentials updated successfully` });
        } else {
            // Create new
            const { error: insertError } = await supabase
                .from('users')
                .insert([{ username: newUsername, password: hashedPassword, role: targetRole }]);

            if (insertError) throw insertError;
            res.json({ success: true, message: `${targetRole} created with credentials successfully` });
        }

    } catch (error) {
        console.error('Error updating credentials:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
