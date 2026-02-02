import { initDatabase } from './db.js';

const rawData = `
Tarun Shrivastava ( vicky)	Bowler
Swapnil jha 	Batsman
Aashish sori 	Batsman
Vipin ratre 	All rounder
Ajit verma 	Batsman
Thanu sonkar	Batsman
Swaroop Dewangan	Batsman
Abhimanyu Choubey 	All rounder
Rahul paswan 	Batsman
Yash sahu	All rounder
Aadesh jain	Bowler
Kishan ojha	All rounder
Shailesh hariharno	Bowler
Tarkesh	Batsman
Devendra	Batsman
Swarnim singh rajput 	Bowler
Salim khan 	Batsman
Ajit Chandravanshi	All rounder
ROHAN TAANK 	All rounder
Vipin Johnwells	Batsman
Rinku rathi	All rounder
Lucky Sahu 	Batsman
Arvind kumar 	All rounder
Dinesh giri goswami 	Batsman
Nitin Goswami 	All rounder
Ankur Sahu 	Bowler
Himanshu Yadav	Batsman
Moin 	All rounder
Deepak Kumar kanwar	All rounder
Devdhar kumar sahu	All rounder
Yogesh kumar (RAHUL)	All rounder
Pawan	Bowler
Bhavesh Sahu 	All rounder
Shubham Banafar 	Bowler
Satyam Singh 	Batsman
Vivek dewangan 	Batsman
Ashish Bafna 	All rounder
Suraj Paswan	Bowler
Neeraj yadav 	Bowler
RANJEET KURMI 	All rounder
Dhruv Khandelwal 	All rounder
HARI SONI	Batsman
Tikeshwar sharma 	Batsman
Aakash Sachdeva 	All rounder
Kuldeep singh thakur 	Batsman
Indrakumar lohar 	Batsman
Sanjay sahu	Bowler
Krishna nagwanshi 	Batsman
Hardik Sinha 	Bowler
KRISHNA NETAM 	All rounder
Priyanshu Kuldeep (bittu)	ALL rounder
Sayyam sagarvansi 	Batsman
Montu yadav	Batsman
Ramesh sagarwansi	Bowler
Durgesh /(DaDU)	Bowler
Sudama sahu	Bowler
Om markannde 	Batsman
Devendra sonkar (seru)	Batsman
Kamlesh sahu	All rounder
Amol	All rounder
MANISH THAKUR	Batsman
LALU BANSOD	Bowler
Hasil Khan	All rounder
Sumit Mishra 	All rounder
KHEERU Janghel 	All rounder
Ishu sahu	All rounder
Abhishek jain	Batsman
Narendra Jha 	All rounder
SANDEEP KUMAR 	Bowler
Vaseem khan 	Batsman
Mo Anish	Batsman
Pradeep Kumar Sonwani 	All rounder
Kishan thakur	Batsman
Syed Ehtesham Quadri ( Rehan)	Batsman
Krishna Kumar	Batsman
Shera khan	All rounder
Kum 	Batsman
Sandeep sinha (BUNTY)	All rounder
Chandan dewangan	Batsman
Ankit	Batsman
Aditya Sharma 	Bowler
MONU	All rounder
Shubham	Bowler
Hareshwar verma (Halle)	All rounder
Vinay Ramteke (vinnu)	Batsman
Hemant sahu	All rounder
Trishanku Sahu (jay)	batsman
Srijan patel	All rounder
Naman jain	Batsman
Avinash yadav	Batsman
Uttam verma	Batsman
Deepak Kumar yadav	Batsman
Prince 	Batsman
Shivam sahu	Batsman
Abhishek sahu	Batsman
Shubham (Pankaj)	Batsman
Ajay (Ajju) Dewangan 	Batsman
Prashant sahu	Batsman
Sachin golchha	Batsman
Shubham Mahanadiya 	Batsman
Puran tandeker	Bowler
Shanavaz khan	All rounder
Pratik tripathi 	Bowler
NUMESH VERMA	Bowler
Chetan sahu	All rounder
Lukesh kumar	Batsman
Iswer sahu	Batsman
Monu Patel (Mithlesh Kumar Patel)	Batsman
Jayant Nayak (Jerry)	Batsman
ASHVARYA SAO	Batsman
Ajay sahu	Batsman
SANDEEP KUMAR SAHU	All rounder
Rajveer sharma	Batsman
Sourabh sahu	Batsman
Dhananjay verma (bittu)	All rounder
Jonty mor	Bowler
Avinash sahu (raju) 	Batsman
Pradeep das 	Batsman
Purnanand nishad 	Batsman
RAMKRISHNA VAISHNAVA	All rounder
Makhan patel	Bowler
Suraj jawrani	Batsman
RAJA SONKAR	Batsman
DINESH DEWANGAN	Batsman
NEERAJ SHUKLA	Batsman
Daulat	All rounder
SUDAKAR GAYAKWAD 	Batsman
Neeraj sahu 	Bowler
Sunny Rewatkar (Dhananjay) 	All rounder
Sanju Sahu 	Bowler
RIZWAN KHAN 	All rounder
Vinay sahu 	Bowler
Babu	Batsman
Dev ashish jha	Batsman
Dipesh kumar 	Bowler
Umesh dekate	Bowler
KRISHAN BASFOD	Bowler
Mahendra ( Pappu )	Batsman
Yashwant 	Batsman
HIMANSHU SAGAR 	Batsman
Deva Verma	Batsman
Sahil sagar	Batsman
Shoyeb khan	All rounder
Abhishek sharma	Batsman
Gopi sahu	Batsman
Deva sonkar	Bowler
Jayesh chotiya 	All rounder
Raja mahobiya,(Sudarshan)	All rounder
Kunal vaishnav	Batsman
Gajanand Rajput (gaja)	All rounder
Yash wadhwani	All rounder
Uddeshya gadhewal 	Batsman
Arjun Yadav 	Batsman
Doojram	Batsman
Balveer janghel 	All rounder
Chandresh sinha	Batsman
Amit uike (Akku)	Bowler
Dhanjeet 	All rounder
Khemchand nishad 	Batsman
Tarun sahu	All rounder
Likeshwar Das	Batsman
Abhishek Joshi	All rounder
Silas savlam	All rounder
Prince Savlam	All rounder
Nikhil bagde	Batsman
Harshit.r Sharma	Batsman
SHEIKH IRFAN	All rounder
Dev sahu	All rounder
Komal sen	Batsman
Kamran quraishi	All rounder
Saikh saifuddin 	Batsman
Ankur Kashyap 	All rounder
Parakh kumar kunjam	Batsman
Aadarsh rajput	Batsman
Devesh Yadav	batsman
Chetan dahare	Bowler
BALIRAM SAHU	Batsman
Ranveer Singh Kang	All rounder
Taman Thakur 	Bowler
KHILESH KUMAR SAHU ( MONU SAHU )	Batsman
PRANAY MESHRAM	Batsman
Roshan Rajak	All rounder
Montu parate	All rounder
AMOL VERMA	Bowler
SAURABH KANKARAYANE	All rounder
Aryan patel 	Batsman
Ashif Khan 	All rounder
LOKESH KUMAR SINHA	All rounder
Ritesh netam 	Batsman
Sahil Sahu	Batsman
Yash Ramteke	Batsman
Avinash Bhargav 	All rounder
Dev yadav 	Batsman
Suresh Kumar yadav 	Batsman
santosh singh rajput ( bravo )	Batsman
Durgesh sahu 	Batsman
Ajay verma 	Batsman
Govardhan Yadav	Bowler
Chintu rajput	Batsman
ayush shukla	Bowler
ANUJ DWIVEDI 	Batsman
Goldy Dewangan(sheyanshu) 	Batsman
Ravi Dewanagan 	Batsman
Sandip Sahare 	Batsman
Anmol singh	Batsman
Moksha sahu	Batsman
KARAN BHARTI	Batsman
RAJKUMAR 	Batsman
RUCHIN SHARMA 	All rounder
Varun 	Batsman
GIRISH BHARTI	All rounder
Akash sahu	Bowler
Arjun mendke 	Batsman
Bhupati Sahu 	All rounder
Amol Das	Batsman
Yunus Ali ( Venus) 	Batsman
Deepak Kumar	Batsman
NIKHIL GADEWAL	Batsman
Dageshwar kumar 	Batsman
Shubham Yadav 	All rounder
Hero khan 	All rounder
SABIR SHEIKH	All rounder
Abhishek yadav	Batsman
Shashikant dhruwe	All rounder
Aditya ( mintu )	Batsman
Sourabh yadav 	Bowler
SHAHRUKH 	Batsman
Ganesh Kumar yadav 	Batsman
Abhishek Soni (Pintu) 	All rounder
Ronit Shrivastav 	All rounder
Mahendra	Batsman
KARAN KASHYAP 	Batsman
MONTU SAHU	Batsman
Gendlla (Raja) 	Batsman
Rajesh Sahu 	All rounder
Divyansh yadav	Batsman
Durgesh sinha (Rider)	Batsman
avinash Shyamkunwar 	Batsman
SURENDRA KASHYAP 	All rounder
Rahul yadav	Batsman
Murli sahu	Batsman
Hitesh soni	All rounder
Gaurav chourwahe 	Batsman
Rk yadav 	All rounder
Niraj jain	Bowler
Aman sethiya	Batsman
Saurabh jaiswal 	Batsman
Hirendra yadav	Batsman
Shivam Choudhary 	All rounder
Himanshu jha	All rounder
Aniket RM	All rounder
Irfan ( baba ) 	Batsman
SHLOCK KAMBDE	All rounder
Yash Nishad 	Batsman
Nilesh Thakur 	Batsman
Ghanshyam Dewangan 	Bowler
Amit Kumar Deshmukh 	All rounder
Rinku  Hitman 	Batsman
Ajit kanwar 	All rounder
Chandresh verma	All rounder
Tarachand 	Batsman
Akash verma 	All rounder
Komal Kamdi 	All rounder
Vinay Yadav	Batsman
Devendra Dewangan 	Bowler
Chhatrapal Dewangan 	Bowler
Surendra sahu	Batsman
Om Netam 	All rounder
Rohan	Batsman
Sunil	Batsman
Ashvani Tripathi 	Bowler
TujayThaware 	All rounder
Komal singh parihar 	Batsman
AMUK BHATNAGAR	All rounder
Dileshwar sahu ( RAJU )	Batsman
SUNIL KUMAR DEWANGAN	All rounder
Chaman	Batsman
Roshan kumar yadaw	Bowler
Sohil rangari 	Batsman
Mukund kunjam 	Batsman
Somil baghel	Batsman
RITIK 	Bowler
Sameer ali	All rounder
Yashwavnt  ( Raja)	Batsman
Dineshwar janghel 	All rounder
Rohitrana (gannu)	All rounder
Vijendra singh Thakur 	All rounder
Rajendra sahu	All rounder
Sumeet dhamgaye	Batsman
Bhunesh	All rounder
Manoj Kumar 	All rounder
Anish thakur	All rounder
Deva nishad 	Batsman
Sanjay lefty 	All rounder
Shera verma	All rounder
LILESH KUMAR	All rounder
Bhavesh sarva 	Bowler
Mithlesh verma	Batsman
HIMANSHU THAKUR L	Batsman
Deva 	Bowler
Harish Sori	All rounder
Sanskar Singh Thakur	Batsman
Nawdeep Kumar Mandavi 	All rounder
Vinayak joshi 	All rounder
Aakash gupta 	All rounder
Pawan gendre	Bowler
Ramiz khan	Bowler
Kavya Dewangan 	All rounder
Farhan Ali Doshani	All rounder
Sushil vaide	Bowler
Santosh Tandekar 	Batsman
Jeetu yadav 	Batsman
Rakesh Kumar Mandavi 	Bowler
Chandra kiran Mahipal	All rounder
MANISH YADAV	Batsman
Kuki jha 	Bowler
Sanjay kumar shrivas 	Batsman
Harsh Laharwani 	All rounder
Sidhhu badme 	Batsman
Deepak Sharma	Batsman
Dinesh devangan 	Bowler
Aishwarya Deep Sinha	All rounder
Niraj Sahu	Batsman
Mohit Sahu	Batsman
Dilip sonkar 	Bowler
Lucky Yadav 	Bowler
SANDEEP SINGH 	Batsman
Mansoor Khan	Bowler
Saurabh bohra	Bowler
VIKAS DEWANGAN 	Bowler
Gopi sahu	Batsman
Yugal Mandavi 	Batsman
Rahul dewangan 	Batsman
Ravi 	All rounder
RANJEET  KUMAR 	Bowler
RONIT SHRIWASTAVA	Bowler
RAJESH MAHANA	Batsman
Ghanshyam Gadpayle 	All rounder
SAHIL HUSAIN ANSARI 	Batsman
Poonam Netam	Bowler
Vikas shrivastav	Batsman
Nandu yadav 	All rounder
Chiku Sahu 	All rounder
Daya yadav	Bowler
Krinal (Montuu)	Batsman
Lalit Meravi	Batsman
Rahul ghandi 	Bowler
Krishna Tivari 	Bowler
Anshul Jaiswal	All rounder
Yashwant kosare	All rounder
Mahendra sahu 	
Manish sonkar 	All rounder
Shashank Soni	Batsman
Virendra shah maravi	Batsman
Somesh Singh Chouhan (Somu)	Batsman
Bobby Rewatkar	All rounder
PANKAJ SAHU	Bowler
PRAKASH SAHU	Batsman
SUSHIL WAIDE	Bowler
CHHAHAN YADAV	Batsman
Sajid Ashrafi 	Batsman
VIKAS SAHU 	Batsman
Abhay yadav 	Batsman
Sunil verma	Batsman
Pankaj netam	Batsman
Asharam	Bowler
Rahul Gadhewal	batsman
Amarjot SIngh Rangi	All rounder
Ankur Mishra	Bowling
Karan Bagga	All rounder
`;

function normalizeRole(role) {
    if (!role) return null;
    const r = role.toUpperCase().trim();
    if (r.includes('ALL') && r.includes('ROUNDER')) return 'ALL-ROUNDER';
    if (r === 'BATSMAN') return 'BATSMAN';
    if (r === 'BOWLER' || r === 'BOWLING') return 'BOWLER';
    if (r === 'WICKET KEEPER' || r === 'WK') return 'WICKET KEEPER';
    return r;
}

function cleanName(name) {
    // Same cleaning filtering as the import script to ensure matches
    return name.replace(/[^a-zA-Z\s.]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

async function updateRoles() {
    const db = await initDatabase();

    // 1. Load all players from DB
    const players = await new Promise((resolve, reject) => {
        db.all('SELECT id, name, role, base_price FROM players', (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    // Create a map of CleanedName -> PlayerObject
    // We handle potential duplicates by just taking the last one or ignoring (assuming uniqueness based on import)
    const playerMap = new Map();
    players.forEach(p => {
        playerMap.set(cleanName(p.name), p);
    });

    console.log(`📊 Loaded ${players.length} players from DB.`);

    // 2. Parse raw data
    const updates = [];
    const lines = rawData.split('\n').filter(l => l.trim().length > 0);

    for (const line of lines) {
        // Split by tab or multiple spaces (heuristic: Name  Role)
        // Some names might have spaces, but role is usually one or two words at the end
        // Regex: (Name Part) (Separator) (Role Part)
        const match = line.match(/^(.+?)(?:\t|\s{2,}|(?=\s+(?:Bowler|Batsman|All\s*rounder|Bowling)$))(.+)$/i);

        let nameRaw, roleRaw;

        if (match) {
            nameRaw = match[1];
            roleRaw = match[2];
        } else {
            // Fallback: try splitting by last space if the last word looks like a role
            const parts = line.trim().split(/\s+/);
            const lastWord = parts[parts.length - 1].toUpperCase();
            if (['BOWLER', 'BATSMAN'].includes(lastWord) || (parts.length >= 2 && parts[parts.length - 2].toUpperCase() === 'ALL' && lastWord === 'ROUNDER')) {
                // It's likely Name Role
                if (lastWord === 'ROUNDER') {
                    roleRaw = 'All rounder';
                    nameRaw = parts.slice(0, parts.length - 2).join(' ');
                } else {
                    roleRaw = lastWord;
                    nameRaw = parts.slice(0, parts.length - 1).join(' ');
                }
            } else {
                console.warn(`⚠️  Could not parse line: "${line}"`);
                continue;
            }
        }

        const nameCleaned = cleanName(nameRaw);
        const roleNormalized = normalizeRole(roleRaw);

        if (roleNormalized) {
            updates.push({ nameCleaned, roleNormalized, originalName: nameRaw.trim() });
        }
    }

    // 3. Apply updates
    let updateCount = 0;
    let notFoundCount = 0;

    // Also enforce base_price 3000 here just in case!
    await new Promise((resolve) => db.run('UPDATE players SET base_price = 3000', resolve));

    for (const update of updates) {
        const player = playerMap.get(update.nameCleaned);

        if (player) {
            // Only update if role is different OR if it was Unspecified/undefined
            // User said: "if you encounter a name already categorized ignore it or recheck it"
            // We'll interpret this as: Update 'Unspecified', 'ALL-ROUNDER' (default import sometimes), or just verify.
            // Actually, let's just UPDATE it. The user gave this list specifically to fix things.
            // If the user said "ignore it", maybe they imply "trust the filename extraction over this text list"?
            // But this text list seems curated.
            // Let's safe-update: If DB is 'Unspecified', definitely update. 
            // If DB is DIFFERENT from new role, update (assuming list is correction).
            // If DB is SAME, no op.

            if (player.role !== update.roleNormalized) {
                await new Promise((resolve, reject) => {
                    db.run('UPDATE players SET role = ? WHERE id = ?', [update.roleNormalized, player.id], (err) => {
                        if (err) console.error(err);
                        else resolve();
                    });
                });
                console.log(`✅ Updated: "${player.name}" (${player.role} -> ${update.roleNormalized})`);
                updateCount++;
            }
        } else {
            console.log(`⚠️  Player not found in DB: "${update.originalName}" (Cleaned: "${update.nameCleaned}")`);
            notFoundCount++;

            // Fuzzy match attempt?
            // Maybe check if any player name contains this name or vice versa?
            // For now, simple matching.
        }
    }

    console.log(`\n🎉 Update complete!`);
    console.log(`✅ Updated ${updateCount} players.`);
    console.log(`⚠️  ${notFoundCount} names from list not found in DB.`);

    // Verify base price again
    db.get('SELECT COUNT(*) as count FROM players WHERE base_price != 3000', (err, row) => {
        if (row && row.count > 0) {
            console.error(`❌ ALERT: ${row.count} players still have base_price != 3000`);
        } else {
            console.log(`💰 Verified: All players have base_price = 3000`);
        }
    });

}

updateRoles().catch(console.error);
