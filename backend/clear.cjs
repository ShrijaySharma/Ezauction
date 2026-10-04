require('dotenv').config({path: './.env'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function clearEverything() {
  console.log('Clearing DB tables...');
  await supabase.from('bids').delete().neq('id', 0);
  await supabase.from('players').delete().neq('id', 0);
  await supabase.from('teams').delete().neq('id', 0);
  
  console.log('DB cleared. Now clearing storage...');
  
  const folders = ['main', 'thumb'];
  let totalDeleted = 0;
  
  for (const folder of folders) {
    let hasMore = true;
    let offset = 0;
    while(hasMore) {
      const { data, error } = await supabase.storage.from('auction-images').list(folder, { limit: 100, offset: offset });
      if (error) {
        console.error(error);
        break;
      }
      
      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }
      
      const files = data
        .filter(f => f.name !== '.emptyFolderPlaceholder' && f.id !== null)
        .map(f => folder ? `${folder}/${f.name}` : f.name);
        
      if(files.length > 0) {
        const { error: removeError } = await supabase.storage.from('auction-images').remove(files);
        if (removeError) {
           console.error('Remove Error:', removeError);
        } else {
           totalDeleted += files.length;
           console.log(`Deleted ${files.length} from ${folder}`);
        }
      } else {
        offset += 100;
        if (offset > 10000) break; // safety
      }
    }
  }
  
  console.log('Total files deleted: ' + totalDeleted);
}
clearEverything().then(() => process.exit(0));
