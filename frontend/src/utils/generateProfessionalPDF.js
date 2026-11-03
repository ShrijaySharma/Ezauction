import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a URL and return a base-64 data-URL string.
 */
function toBase64(url) {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      })
      .catch(reject);
  });
}

/**
 * Return initials (up to 2 letters) from a player name.
 */
function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');
}

/**
 * Deterministic background colour for initials placeholder.
 */
function initialsColor(name = '') {
  const palette = [
    '#1E3A5F', '#3B1E5F', '#5F1E2A', '#1E5F3B',
    '#5F4A1E', '#1E4A5F', '#5F1E4A', '#2A5F1E',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

/**
 * Role pill colour mapping.
 */
function roleColor(role = '') {
  const r = role.toUpperCase();
  if (r.includes('BAT')) return { bg: '#1A3A6B', text: '#60AAFF' };
  if (r.includes('BOWL') || r.includes('BOW')) return { bg: '#6B1A1A', text: '#FF6060' };
  if (r.includes('WK') || r.includes('KEEP')) return { bg: '#1A5C2A', text: '#60E880' };
  if (r.includes('AR') || r.includes('ALL')) return { bg: '#4A1A6B', text: '#C060FF' };
  return { bg: '#2A2A2A', text: '#AAAAAA' };
}

// ---------------------------------------------------------------------------
// Cover page
// ---------------------------------------------------------------------------

function buildProCoverPage(tournamentName, teamsWithPlayers, logoBase64) {
  const A4_W = 794;
  const A4_H = 1123;

  const totalPlayers = teamsWithPlayers.reduce((s, t) => s + (t.players || []).length, 0);
  const totalTeams = teamsWithPlayers.length;

  const wrap = document.createElement('div');
  wrap.style.cssText = `
    width:${A4_W}px; height:${A4_H}px; overflow:hidden; position:relative;
    background:#0D0D1A; font-family:'Segoe UI',Arial,sans-serif; box-sizing:border-box;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
  `;

  // ── Radial glow behind content ──
  const glow = document.createElement('div');
  glow.style.cssText = `
    position:absolute; top:30%; left:50%; transform:translate(-50%,-50%);
    width:600px; height:600px; border-radius:50%;
    background:radial-gradient(circle, rgba(212,175,55,0.10) 0%, transparent 70%);
    pointer-events:none;
  `;
  wrap.appendChild(glow);

  // ── Corner decorations ──
  const corners = [
    { top: '20px', left: '20px', borderTop: '2px solid #D4AF37', borderLeft: '2px solid #D4AF37' },
    { top: '20px', right: '20px', borderTop: '2px solid #D4AF37', borderRight: '2px solid #D4AF37' },
    { bottom: '20px', left: '20px', borderBottom: '2px solid #D4AF37', borderLeft: '2px solid #D4AF37' },
    { bottom: '20px', right: '20px', borderBottom: '2px solid #D4AF37', borderRight: '2px solid #D4AF37' },
  ];
  corners.forEach(style => {
    const c = document.createElement('div');
    c.style.cssText = `position:absolute; width:48px; height:48px; `;
    Object.entries(style).forEach(([k, v]) => (c.style[k] = v));
    wrap.appendChild(c);
  });

  // ── Inner content column ──
  const col = document.createElement('div');
  col.style.cssText = `
    display:flex; flex-direction:column; align-items:center; gap:0;
    z-index:1; width:100%; padding:60px 80px; box-sizing:border-box;
  `;

  // Logo
  if (logoBase64) {
    const logoWrap = document.createElement('div');
    logoWrap.style.cssText = `margin-bottom:32px;`;
    const logo = document.createElement('img');
    logo.src = logoBase64;
    logo.style.cssText = `height:72px; object-fit:contain; filter:drop-shadow(0 0 16px rgba(212,175,55,0.5));`;
    logoWrap.appendChild(logo);
    col.appendChild(logoWrap);
  } else {
    // Text fallback
    const logoText = document.createElement('div');
    logoText.textContent = 'EzAuction';
    logoText.style.cssText = `
      font-size:36px; font-weight:900; color:#D4AF37;
      letter-spacing:6px; text-transform:uppercase; margin-bottom:32px;
      text-shadow:0 0 30px rgba(212,175,55,0.6);
    `;
    col.appendChild(logoText);
  }

  // Gold divider above tournament name
  const divTop = document.createElement('div');
  divTop.style.cssText = `width:200px; height:1px; background:linear-gradient(90deg,transparent,#D4AF37,transparent); margin-bottom:28px;`;
  col.appendChild(divTop);

  // Tournament name
  const tName = document.createElement('div');
  tName.textContent = tournamentName || 'Auction';
  tName.style.cssText = `
    font-size:52px; font-weight:900; color:#FFFFFF; text-align:center;
    letter-spacing:2px; line-height:1.1; margin-bottom:24px;
    text-shadow:0 2px 20px rgba(255,255,255,0.15);
  `;
  col.appendChild(tName);

  // Subtitle
  const subtitle = document.createElement('div');
  subtitle.textContent = 'TEAM WISE PLAYER LIST';
  subtitle.style.cssText = `
    font-size:16px; font-weight:700; color:#D4AF37;
    letter-spacing:6px; text-transform:uppercase; margin-bottom:36px;
    text-shadow:0 0 12px rgba(212,175,55,0.4);
  `;
  col.appendChild(subtitle);

  // Gold divider below subtitle
  const divMid = document.createElement('div');
  divMid.style.cssText = `
    width:420px; height:2px; margin-bottom:40px;
    background:linear-gradient(90deg,transparent 0%,#D4AF37 30%,#FFD700 50%,#D4AF37 70%,transparent 100%);
  `;
  col.appendChild(divMid);

  // Stats chips
  const chipRow = document.createElement('div');
  chipRow.style.cssText = `display:flex; gap:24px; margin-bottom:60px;`;

  [[`${totalTeams}`, 'TEAMS'], [`${totalPlayers}`, 'PLAYERS ACQUIRED']].forEach(([num, label]) => {
    const chip = document.createElement('div');
    chip.style.cssText = `
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      padding:18px 36px; border-radius:12px;
      background:rgba(212,175,55,0.08);
      border:1px solid rgba(212,175,55,0.35);
    `;
    const n = document.createElement('div');
    n.textContent = num;
    n.style.cssText = `font-size:40px; font-weight:900; color:#D4AF37; line-height:1;`;
    const l = document.createElement('div');
    l.textContent = label;
    l.style.cssText = `font-size:11px; color:#999; letter-spacing:3px; margin-top:6px;`;
    chip.appendChild(n);
    chip.appendChild(l);
    chipRow.appendChild(chip);
  });
  col.appendChild(chipRow);

  // Decorative diamond row
  const diamonds = document.createElement('div');
  diamonds.style.cssText = `display:flex; align-items:center; gap:10px; margin-bottom:0;`;
  ['◆', '◇', '◆'].forEach((sym, i) => {
    const d = document.createElement('span');
    d.textContent = sym;
    d.style.cssText = `color:#D4AF37; font-size:${i === 1 ? 10 : 14}px; opacity:${i === 1 ? 0.5 : 1};`;
    diamonds.appendChild(d);
  });
  col.appendChild(diamonds);

  wrap.appendChild(col);

  // ── Footer ──
  const footer = document.createElement('div');
  footer.style.cssText = `
    position:absolute; bottom:36px; left:0; right:0;
    display:flex; flex-direction:column; align-items:center; gap:6px;
  `;
  const footerLine = document.createElement('div');
  footerLine.style.cssText = `width:120px; height:1px; background:rgba(212,175,55,0.3); margin-bottom:4px;`;
  footer.appendChild(footerLine);
  const powered = document.createElement('div');
  powered.textContent = 'POWERED BY EZAUCTION';
  powered.style.cssText = `font-size:10px; color:#555; letter-spacing:4px;`;
  footer.appendChild(powered);
  wrap.appendChild(footer);

  return wrap;
}

// ---------------------------------------------------------------------------
// Team page
// ---------------------------------------------------------------------------

function buildProTeamPage(teamData, players, tournamentName, logoBase64, pageNum, totalPages) {
  const A4_W = 794;
  const A4_H = 1123;

  const teamName = teamData.team?.name || teamData.name || 'Team';

  const wrap = document.createElement('div');
  wrap.style.cssText = `
    width:${A4_W}px; height:${A4_H}px; overflow:hidden; position:relative;
    background:#0D0D1A; font-family:'Segoe UI',Arial,sans-serif; box-sizing:border-box;
    display:flex; flex-direction:column;
  `;

  // ── Subtle background texture / glow ──
  const bgGlow = document.createElement('div');
  bgGlow.style.cssText = `
    position:absolute; top:-100px; left:50%; transform:translateX(-50%);
    width:700px; height:400px; border-radius:50%;
    background:radial-gradient(ellipse, rgba(212,175,55,0.05) 0%, transparent 70%);
    pointer-events:none;
  `;
  wrap.appendChild(bgGlow);

  // ── HEADER BAR ──
  const header = document.createElement('div');
  header.style.cssText = `
    width:100%; height:68px; flex-shrink:0;
    background:linear-gradient(90deg, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.03) 100%);
    border-bottom:2px solid rgba(212,175,55,0.4);
    display:flex; align-items:center; justify-content:space-between;
    padding:0 24px; box-sizing:border-box; position:relative; z-index:2;
  `;

  // Team logo + name (left)
  const headerLeft = document.createElement('div');
  headerLeft.style.cssText = `display:flex; align-items:center; gap:14px;`;

  if (teamData._logoBase64) {
    const tLogo = document.createElement('img');
    tLogo.src = teamData._logoBase64;
    tLogo.style.cssText = `height:42px; width:42px; object-fit:contain; border-radius:6px;`;
    headerLeft.appendChild(tLogo);
  }

  const teamTitle = document.createElement('div');
  teamTitle.style.cssText = `display:flex; flex-direction:column;`;
  const tNameEl = document.createElement('div');
  tNameEl.textContent = teamName.toUpperCase();
  tNameEl.style.cssText = `font-size:22px; font-weight:900; color:#FFFFFF; letter-spacing:1.5px; line-height:1;`;
  const tSub = document.createElement('div');
  tSub.textContent = `${players.length} PLAYER${players.length !== 1 ? 'S' : ''}`;
  tSub.style.cssText = `font-size:10px; color:#D4AF37; letter-spacing:3px; margin-top:3px;`;
  teamTitle.appendChild(tNameEl);
  teamTitle.appendChild(tSub);
  headerLeft.appendChild(teamTitle);
  header.appendChild(headerLeft);

  // Page info (right)
  const pageInfo = document.createElement('div');
  pageInfo.style.cssText = `font-size:11px; color:#666; letter-spacing:2px;`;
  pageInfo.textContent = `PAGE ${pageNum} / ${totalPages}`;
  header.appendChild(pageInfo);
  wrap.appendChild(header);

  // ── PLAYER GRID ──
  const gridWrap = document.createElement('div');
  gridWrap.style.cssText = `
    flex:1; overflow:hidden; padding:16px 20px 0 20px; box-sizing:border-box; position:relative; z-index:1;
  `;

  const grid = document.createElement('div');
  grid.style.cssText = `
    display:grid; grid-template-columns:repeat(4,1fr); gap:12px;
    width:100%;
  `;

  players.forEach(player => {
    const card = document.createElement('div');
    card.style.cssText = `
      border-radius:10px; overflow:hidden;
      background:#1A1A2E;
      border:1px solid rgba(212,175,55,0.28);
      display:flex; flex-direction:column;
      box-shadow:0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04);
    `;

    // Photo area
    const photoDiv = document.createElement('div');
    photoDiv.style.cssText = `
      width:100%; height:210px; overflow:hidden;
      background:#111122; position:relative; flex-shrink:0;
    `;

    if (player._imgBase64) {
      const img = document.createElement('img');
      img.src = player._imgBase64;
      img.style.cssText = `
        width:100%; height:100%; object-fit:cover; object-position:top center;
        display:block;
      `;
      photoDiv.appendChild(img);
    } else {
      // Initials fallback
      const initDiv = document.createElement('div');
      const bg = initialsColor(player.name);
      initDiv.style.cssText = `
        width:100%; height:100%; display:flex; align-items:center; justify-content:center;
        background:${bg};
      `;
      const initText = document.createElement('div');
      initText.textContent = getInitials(player.name);
      initText.style.cssText = `font-size:54px; font-weight:900; color:rgba(255,255,255,0.7);`;
      initDiv.appendChild(initText);
      photoDiv.appendChild(initDiv);
    }

    // Gradient fade at bottom of photo
    const photoFade = document.createElement('div');
    photoFade.style.cssText = `
      position:absolute; bottom:0; left:0; right:0; height:50px;
      background:linear-gradient(transparent, #1A1A2E);
      pointer-events:none;
    `;
    photoDiv.appendChild(photoFade);
    card.appendChild(photoDiv);

    // Name
    const nameDiv = document.createElement('div');
    nameDiv.textContent = player.name || 'Player';
    nameDiv.style.cssText = `
      padding:7px 8px 3px 8px; color:#FFFFFF; font-size:11px; font-weight:700;
      text-align:center; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;
      letter-spacing:0.3px;
    `;
    card.appendChild(nameDiv);

    // Role badge
    const role = player.role || '';
    const rc = roleColor(role);
    const roleDiv = document.createElement('div');
    roleDiv.style.cssText = `padding:2px 8px 9px 8px; display:flex; justify-content:center;`;
    const rolePill = document.createElement('div');
    rolePill.textContent = role || 'PLAYER';
    rolePill.style.cssText = `
      display:inline-block; padding:2px 10px; border-radius:20px;
      background:${rc.bg}; color:${rc.text}; font-size:9px; font-weight:700;
      letter-spacing:1px; text-transform:uppercase;
      border:1px solid ${rc.text}40;
    `;
    roleDiv.appendChild(rolePill);
    card.appendChild(roleDiv);

    grid.appendChild(card);
  });

  // Placeholder cards to fill incomplete last row
  const remainder = players.length % 4;
  if (remainder !== 0) {
    for (let i = 0; i < 4 - remainder; i++) {
      const ph = document.createElement('div');
      ph.style.cssText = `border-radius:10px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04);`;
      grid.appendChild(ph);
    }
  }

  gridWrap.appendChild(grid);
  wrap.appendChild(gridWrap);

  // ── FOOTER BAR ──
  const footer = document.createElement('div');
  footer.style.cssText = `
    width:100%; height:52px; flex-shrink:0;
    border-top:1px solid rgba(212,175,55,0.25);
    background:rgba(0,0,0,0.4);
    display:flex; align-items:center; justify-content:space-between;
    padding:0 20px; box-sizing:border-box; position:relative; z-index:2;
  `;

  // Left: small tournament name
  const ftLeft = document.createElement('div');
  ftLeft.textContent = (tournamentName || '').toUpperCase();
  ftLeft.style.cssText = `font-size:9px; color:#444; letter-spacing:2px; max-width:220px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;`;
  footer.appendChild(ftLeft);

  // Center: logo
  const ftCenter = document.createElement('div');
  ftCenter.style.cssText = `display:flex; align-items:center; gap:6px;`;
  if (logoBase64) {
    const fLogo = document.createElement('img');
    fLogo.src = logoBase64;
    fLogo.style.cssText = `height:22px; object-fit:contain; opacity:0.7;`;
    ftCenter.appendChild(fLogo);
  } else {
    const fText = document.createElement('span');
    fText.textContent = 'EzAuction';
    fText.style.cssText = `font-size:11px; font-weight:700; color:#555; letter-spacing:2px;`;
    ftCenter.appendChild(fText);
  }
  footer.appendChild(ftCenter);

  // Right: page number
  const ftRight = document.createElement('div');
  ftRight.textContent = `${pageNum} / ${totalPages}`;
  ftRight.style.cssText = `font-size:10px; color:#444; letter-spacing:1px;`;
  footer.appendChild(ftRight);

  wrap.appendChild(footer);

  return wrap;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate a professional IPL-style team PDF.
 *
 * @param {object} opts
 * @param {string} opts.tournamentName
 * @param {Array}  opts.teamSquads  – [{team:{name,logo}, players:[{name,role,image,thumb_url}]}]
 * @param {Function} opts.getImageUrl – (src) => full URL string
 */
export async function generateProfessionalTeamPDF({ tournamentName, teamSquads, getImageUrl }) {
  const teamsWithPlayers = (teamSquads || []).filter(t => (t.players || []).length > 0);
  if (!teamsWithPlayers.length) {
    alert('No teams with sold players found.');
    return;
  }

  // 1. Pre-fetch EzAuction logo
  let logoBase64 = null;
  try {
    logoBase64 = await toBase64('/ezauction.png');
  } catch {
    // Logo is optional — fall back to text
  }

  // 2. Pre-fetch all player images in parallel
  const allPlayers = teamsWithPlayers.flatMap(t => t.players || []);
  await Promise.all(
    allPlayers.map(async p => {
      const src = p.image || p.thumb_url;
      if (src) {
        try {
          p._imgBase64 = await toBase64(getImageUrl(src));
        } catch {
          p._imgBase64 = null;
        }
      }
    })
  );

  // 3. Pre-fetch all team logos in parallel
  await Promise.all(
    teamsWithPlayers.map(async t => {
      const lSrc = t.team?.logo || t.logo;
      if (lSrc) {
        try {
          t._logoBase64 = await toBase64(getImageUrl(lSrc));
        } catch {
          t._logoBase64 = null;
        }
      }
    })
  );

  // 4. Off-screen container
  const container = document.createElement('div');
  container.style.cssText = `
    position:fixed; top:-9999px; left:-9999px; z-index:-1;
    width:794px; overflow:visible; pointer-events:none;
  `;
  document.body.appendChild(container);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const PAGE_W_MM = 210;
  const PAGE_H_MM = 297;
  const PLAYERS_PER_PAGE = 12;

  try {
    // ── Cover page ──
    const coverNode = buildProCoverPage(tournamentName, teamsWithPlayers, logoBase64);
    container.appendChild(coverNode);
    await new Promise(r => setTimeout(r, 120));
    const coverCanvas = await html2canvas(coverNode, {
      scale: 2.2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#0D0D1A',
      logging: false,
    });
    doc.addImage(
      coverCanvas.toDataURL('image/jpeg', 0.96),
      'JPEG', 0, 0, PAGE_W_MM, PAGE_H_MM,
      undefined, 'FAST'
    );
    container.removeChild(coverNode);

    // ── Team pages ──
    const totalPages =
      1 + // cover
      teamsWithPlayers.reduce(
        (s, t) => s + Math.max(1, Math.ceil((t.players || []).length / PLAYERS_PER_PAGE)),
        0
      );

    let pageNum = 1; // cover is page 1

    for (const team of teamsWithPlayers) {
      const players = team.players || [];

      // Chunk into groups of PLAYERS_PER_PAGE
      const chunks = [];
      for (let i = 0; i < players.length; i += PLAYERS_PER_PAGE) {
        chunks.push(players.slice(i, i + PLAYERS_PER_PAGE));
      }
      if (!chunks.length) chunks.push([]);

      for (let ci = 0; ci < chunks.length; ci++) {
        doc.addPage();
        pageNum++;

        const node = buildProTeamPage(
          team,
          chunks[ci],
          tournamentName,
          logoBase64,
          pageNum,
          totalPages
        );
        container.appendChild(node);
        await new Promise(r => setTimeout(r, 120));

        const canvas = await html2canvas(node, {
          scale: 2.2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#0D0D1A',
          logging: false,
        });
        doc.addImage(
          canvas.toDataURL('image/jpeg', 0.96),
          'JPEG', 0, 0, PAGE_W_MM, PAGE_H_MM,
          undefined, 'FAST'
        );
        container.removeChild(node);
      }
    }

    const safeFilename = `${(tournamentName || 'Auction').replace(/[^a-z0-9]/gi, '_')}_IPL_Style_Squad.pdf`;
    doc.save(safeFilename);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
