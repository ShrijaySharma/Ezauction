
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteTeam(teamId) {
    console.log(`Attempting to delete team ${teamId}...`);

    try {
        // 1. Get team to find owner
        const { data: team, error: fetchError } = await supabase
            .from('teams')
            .select('owner_id')
            .eq('id', teamId)
            .single();

        if (fetchError) {
            console.error('Error fetching team:', fetchError);
            return;
        }
        console.log('Target Team:', team);

        // 2. Nullify owner_id in teams table
        console.log('Nullifying owner_id in teams...');
        const { error: updateTeamError } = await supabase
            .from('teams')
            .update({ owner_id: null })
            .eq('id', teamId);

        if (updateTeamError) console.error('Error nullifying team owner:', updateTeamError);

        // 3. Delete user (handling user->team FK)
        if (team && team.owner_id) {
            console.log(`Found owner ${team.owner_id}. Nullifying team_id in users...`);
            const { error: updateUserError } = await supabase
                .from('users')
                .update({ team_id: null })
                .eq('id', team.owner_id);

            if (updateUserError) console.error('Error nullifying user team_id:', updateUserError);

            console.log(`Deleting user ${team.owner_id}...`);
            const { error: userDeleteError } = await supabase
                .from('users')
                .delete()
                .eq('id', team.owner_id);

            if (userDeleteError) console.error('Error deleting user:', userDeleteError);
        }

        // 4. Delete team
        console.log(`Deleting team ${teamId}...`);
        const { error: deleteError } = await supabase
            .from('teams')
            .delete()
            .eq('id', teamId);

        if (deleteError) {
            console.error('FINAL DELETE ERROR:', deleteError);
        } else {
            console.log('SUCCESS: Team deleted!');
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

// Check for ID argument
const id = process.argv[2];
if (!id) {
    console.log('Usage: node debug_delete_team.js <team_id>');
} else {
    deleteTeam(id);
}
