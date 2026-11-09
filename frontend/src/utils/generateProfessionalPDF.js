import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// ---------------------------------------------------------------------------
// Helpers & Typography
// ---------------------------------------------------------------------------

const FONT_STACK = 'Arial, Helvetica, sans-serif';
const SQUARE_SIZE = 840; // 840x840 px (1:1 Square Ratio)
const PAGE_SIZE_MM = 210; // 210x210 mm square in PDF

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
  if (r.includes('BAT')) return { bg: 'rgba(26,58,107,0.85)', text: '#72B6FF', border: 'rgba(96,170,255,0.45)' };
  if (r.includes('BOWL') || r.includes('BOW')) return { bg: 'rgba(107,26,26,0.85)', text: '#FF7575', border: 'rgba(255,96,96,0.45)' };
  if (r.includes('WK') || r.includes('KEEP')) return { bg: 'rgba(26,92,42,0.85)', text: '#75F094', border: 'rgba(96,232,128,0.45)' };
  if (r.includes('AR') || r.includes('ALL')) return { bg: 'rgba(74,26,107,0.85)', text: '#D27AFF', border: 'rgba(192,96,255,0.45)' };
  return { bg: 'rgba(42,42,42,0.85)', text: '#CCCCCC', border: 'rgba(170,170,170,0.45)' };
}

// ---------------------------------------------------------------------------
// Cover page (1:1 Square)
// ---------------------------------------------------------------------------

function buildProCoverPage(tournamentName, teamsWithPlayers, logoBase64) {
  const totalPlayers = teamsWithPlayers.reduce((s, t) => s + (t.players || []).length, 0);
  const totalTeams = teamsWithPlayers.length;

  const wrap = document.createElement('div');
  wrap.style.cssText = `
    width:${SQUARE_SIZE}px; height:${SQUARE_SIZE}px; overflow:hidden; position:relative;
    background:#0D0D1A; font-family:${FONT_STACK}; box-sizing:border-box;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
  `;

  // ── Radial glow behind content ──
  const glow = document.createElement('div');
  glow.style.cssText = `
    position:absolute; top:40%; left:50%; transform:translate(-50%,-50%);
    width:650px; height:650px; border-radius:50%;
    background:radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%);
    pointer-events:none;
  `;
  wrap.appendChild(glow);

  // ── Corner decorations ──
  const corners = [
    { top: '24px', left: '24px', borderTop: '2px solid #D4AF37', borderLeft: '2px solid #D4AF37' },
    { top: '24px', right: '24px', borderTop: '2px solid #D4AF37', borderRight: '2px solid #D4AF37' },
    { bottom: '24px', left: '24px', borderBottom: '2px solid #D4AF37', borderLeft: '2px solid #D4AF37' },
    { bottom: '24px', right: '24px', borderBottom: '2px solid #D4AF37', borderRight: '2px solid #D4AF37' },
  ];
  corners.forEach(style => {
    const c = document.createElement('div');
    c.style.cssText = `position:absolute; width:44px; height:44px; `;
    Object.entries(style).forEach(([k, v]) => (c.style[k] = v));
    wrap.appendChild(c);
  });

  // ── Inner content column ──
  const col = document.createElement('div');
  col.style.cssText = `
    display:flex; flex-direction:column; align-items:center;
    z-index:1; width:100%; padding:40px 60px; box-sizing:border-box;
  `;

  // Logo
  if (logoBase64) {
    const logoWrap = document.createElement('div');
    logoWrap.style.cssText = `margin-bottom:24px;`;
    const logo = document.createElement('img');
    logo.src = logoBase64;
    logo.style.cssText = `height:68px; object-fit:contain; filter:drop-shadow(0 0 16px rgba(212,175,55,0.5));`;
    logoWrap.appendChild(logo);
    col.appendChild(logoWrap);
  } else {
    const logoText = document.createElement('div');
    logoText.textContent = 'ezAuction';
    logoText.style.cssText = `
      font-size:34px; font-weight:900; color:#D4AF37;
      letter-spacing:5px; text-transform:uppercase; margin-bottom:24px;
      text-shadow:0 0 25px rgba(212,175,55,0.6); font-family:${FONT_STACK};
    `;
    col.appendChild(logoText);
  }

  // Gold divider
  const divTop = document.createElement('div');
  divTop.style.cssText = `width:180px; height:1px; background:linear-gradient(90deg,transparent,#D4AF37,transparent); margin-bottom:20px;`;
  col.appendChild(divTop);

  // Tournament name
  const tName = document.createElement('div');
  tName.textContent = tournamentName || 'Cricket Auction';
  tName.style.cssText = `
    font-size:44px; font-weight:900; color:#FFFFFF; text-align:center;
    letter-spacing:2px; line-height:1.15; margin-bottom:14px;
    text-shadow:0 2px 20px rgba(0,0,0,0.8), 0 0 30px rgba(212,175,55,0.25);
    font-family:${FONT_STACK};
  `;
  col.appendChild(tName);

  // Subtitle
  const subtitle = document.createElement('div');
  subtitle.textContent = 'TEAM WISE PLAYER LIST';
  subtitle.style.cssText = `
    font-size:15px; font-weight:800; color:#D4AF37;
    letter-spacing:5px; text-transform:uppercase; margin-bottom:28px;
    text-shadow:0 0 12px rgba(212,175,55,0.4); font-family:${FONT_STACK};
  `;
  col.appendChild(subtitle);

  // Gold divider below subtitle
  const divMid = document.createElement('div');
  divMid.style.cssText = `
    width:360px; height:2px; margin-bottom:34px;
    background:linear-gradient(90deg,transparent 0%,#D4AF37 30%,#FFD700 50%,#D4AF37 70%,transparent 100%);
  `;
  col.appendChild(divMid);

  // Stats chips
  const chipRow = document.createElement('div');
  chipRow.style.cssText = `display:flex; gap:24px; margin-bottom:40px;`;

  [[`${totalTeams}`, 'TEAMS PARTICIPATING'], [`${totalPlayers}`, 'PLAYERS ACQUIRED']].forEach(([num, label]) => {
    const chip = document.createElement('div');
    chip.style.cssText = `
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      padding:16px 32px; border-radius:14px;
      background:rgba(212,175,55,0.08);
      border:1.5px solid rgba(212,175,55,0.35);
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    `;
    const n = document.createElement('div');
    n.textContent = num;
    n.style.cssText = `font-size:36px; font-weight:900; color:#D4AF37; line-height:1; font-family:${FONT_STACK};`;
    const l = document.createElement('div');
    l.textContent = label;
    l.style.cssText = `font-size:10px; font-weight:700; color:#AAA; letter-spacing:2px; margin-top:6px; font-family:${FONT_STACK};`;
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
    d.style.cssText = `color:#D4AF37; font-size:${i === 1 ? 10 : 13}px; opacity:${i === 1 ? 0.5 : 1};`;
    diamonds.appendChild(d);
  });
  col.appendChild(diamonds);

  wrap.appendChild(col);

  // ── Footer ──
  const footer = document.createElement('div');
  footer.style.cssText = `
    position:absolute; bottom:28px; left:0; right:0;
    display:flex; flex-direction:column; align-items:center; gap:4px;
  `;
  const footerLine = document.createElement('div');
  footerLine.style.cssText = `width:100px; height:1px; background:rgba(212,175,55,0.3); margin-bottom:4px;`;
  footer.appendChild(footerLine);
  const powered = document.createElement('div');
  powered.textContent = 'POWERED BY EZAUCTION';
  powered.style.cssText = `font-size:9.5px; font-weight:700; color:#666; letter-spacing:3px; font-family:${FONT_STACK};`;
  footer.appendChild(powered);
  wrap.appendChild(footer);

  return wrap;
}

// ---------------------------------------------------------------------------
// Team page (1:1 Square, Centralized Header, Balanced Card Grid)
// ---------------------------------------------------------------------------

function getProGridLayout(count) {
  if (count <= 4) {
    return {
      cols: Math.max(count, 3),
      maxW: count <= 2 ? 440 : count === 3 ? 560 : 700,
      photoH: 180,
      gapX: 18,
      gapY: 18,
      nameSize: 13,
      nameLineH: 16,
      nameBoxH: 34,
      roleSize: 10,
      roleH: 22,
      padX: 40,
      padY: 24,
      cardMinH: 260
    };
  }
  if (count <= 8) {
    return {
      cols: 4,
      maxW: 710,
      photoH: 145,
      gapX: 16,
      gapY: 16,
      nameSize: 12,
      nameLineH: 15,
      nameBoxH: 32,
      roleSize: 9.5,
      roleH: 21,
      padX: 36,
      padY: 20,
      cardMinH: 220
    };
  }
  if (count <= 10) {
    return {
      cols: 5,
      maxW: 760,
      photoH: 135,
      gapX: 12,
      gapY: 14,
      nameSize: 11,
      nameLineH: 14,
      nameBoxH: 30,
      roleSize: 9,
      roleH: 20,
      padX: 24,
      padY: 16,
      cardMinH: 205
    };
  }
  if (count <= 12) {
    return {
      cols: 4,
      maxW: 720,
      photoH: 105,
      gapX: 14,
      gapY: 10,
      nameSize: 11,
      nameLineH: 14,
      nameBoxH: 28,
      roleSize: 8.5,
      roleH: 19,
      padX: 32,
      padY: 12,
      cardMinH: 170
    };
  }
  if (count <= 15) {
    return {
      cols: 5,
      maxW: 760,
      photoH: 98,
      gapX: 10,
      gapY: 9,
      nameSize: 10.5,
      nameLineH: 13,
      nameBoxH: 26,
      roleSize: 8,
      roleH: 18,
      padX: 20,
      padY: 10,
      cardMinH: 158
    };
  }
  if (count <= 20) {
    return {
      cols: 5,
      maxW: 770,
      photoH: 72,
      gapX: 9,
      gapY: 7,
      nameSize: 9.5,
      nameLineH: 12,
      nameBoxH: 24,
      roleSize: 7.5,
      roleH: 16,
      padX: 16,
      padY: 8,
      cardMinH: 128
    };
  }
  if (count <= 25) {
    return {
      cols: 5,
      maxW: 780,
      photoH: 56,
      gapX: 7,
      gapY: 5,
      nameSize: 9,
      nameLineH: 11,
      nameBoxH: 22,
      roleSize: 7,
      roleH: 15,
      padX: 12,
      padY: 6,
      cardMinH: 106
    };
  }
  const cols = count > 30 ? 7 : 6;
  return {
    cols: cols,
    maxW: 790,
    photoH: 46,
    gapX: 6,
    gapY: 4,
    nameSize: 8,
    nameLineH: 10,
    nameBoxH: 20,
    roleSize: 6.5,
    roleH: 13,
    padX: 10,
    padY: 4,
    cardMinH: 90
  };
}

function buildProTeamPage(teamData, players, logoBase64, pageNum, totalPages) {
  const teamName = teamData.team?.name || teamData.name || 'Team';
  const layout = getProGridLayout(players.length);

  const wrap = document.createElement('div');
  wrap.style.cssText = `
    width:${SQUARE_SIZE}px; height:${SQUARE_SIZE}px; overflow:hidden; position:relative;
    background:#0D0D1A; font-family:${FONT_STACK}; box-sizing:border-box;
    display:flex; flex-direction:column; justify-content:space-between;
  `;

  // ── Background lighting ──
  const bgGlow = document.createElement('div');
  bgGlow.style.cssText = `
    position:absolute; top:-60px; left:50%; transform:translateX(-50%);
    width:700px; height:350px; border-radius:50%;
    background:radial-gradient(ellipse, rgba(212,175,55,0.07) 0%, transparent 70%);
    pointer-events:none;
  `;
  wrap.appendChild(bgGlow);

  // ── 1. HEADER SECTION: Centralized Logo & Large Team Name (No page number on top) ──
  const headerHeight = players.length > 12 ? 88 : 98;
  const header = document.createElement('div');
  header.style.cssText = `
    width:100%; height:${headerHeight}px; flex-shrink:0;
    background:linear-gradient(180deg, rgba(212,175,55,0.14) 0%, rgba(13,13,26,0.95) 100%);
    border-bottom:2px solid rgba(212,175,55,0.40);
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:10px 24px; box-sizing:border-box; position:relative; z-index:2;
  `;

  const centerRow = document.createElement('div');
  centerRow.style.cssText = `display:flex; align-items:center; justify-content:center; gap:16px;`;

  if (teamData._logoBase64) {
    const tLogo = document.createElement('img');
    tLogo.src = teamData._logoBase64;
    tLogo.style.cssText = `
      height:46px; width:46px; object-fit:contain; border-radius:10px;
      border:1.5px solid rgba(212,175,55,0.45); filter:drop-shadow(0 3px 10px rgba(0,0,0,0.8));
    `;
    centerRow.appendChild(tLogo);
  }

  const tNameEl = document.createElement('div');
  tNameEl.textContent = teamName.toUpperCase();
  tNameEl.style.cssText = `
    font-size:${players.length > 15 ? '28px' : '32px'}; font-weight:900; color:#FFFFFF; letter-spacing:2px; line-height:1;
    text-shadow: 0 2px 14px rgba(0,0,0,0.9), 0 0 24px rgba(212,175,55,0.35);
    font-family:${FONT_STACK};
  `;
  centerRow.appendChild(tNameEl);
  header.appendChild(centerRow);

  // Subtitle: Squad Player Count Pill
  const tSub = document.createElement('div');
  tSub.textContent = `${players.length} SQUAD PLAYER${players.length !== 1 ? 'S' : ''}`;
  tSub.style.cssText = `
    font-size:10px; font-weight:800; color:#D4AF37; letter-spacing:3px; margin-top:5px;
    text-transform:uppercase; line-height:1; font-family:${FONT_STACK};
  `;
  header.appendChild(tSub);

  wrap.appendChild(header);

  // ── 2. PLAYER GRID (Dynamically adapted so ALL players fit onto 1 single page) ──
  const gridWrap = document.createElement('div');
  gridWrap.style.cssText = `
    flex:1; display:flex; flex-direction:column; justify-content:center;
    padding:${layout.padY}px ${layout.padX}px; box-sizing:border-box; position:relative; z-index:1;
  `;

  const grid = document.createElement('div');
  grid.style.cssText = `
    display:grid; grid-template-columns:repeat(${layout.cols}, 1fr); gap:${layout.gapY}px ${layout.gapX}px;
    width:100%; max-width:${layout.maxW}px; margin:0 auto;
  `;

  players.forEach(player => {
    const card = document.createElement('div');
    card.style.cssText = `
      border-radius:10px; overflow:hidden;
      background:#161628;
      border:1px solid rgba(212,175,55,0.25);
      display:block;
      box-shadow:0 6px 18px rgba(0,0,0,0.6);
      width:100%; box-sizing:border-box;
    `;

    // Photo container with CSS background-image (preserves true aspect ratio in html2canvas without squashing)
    const photoDiv = document.createElement('div');
    if (player._imgBase64) {
      photoDiv.style.cssText = `
        width:100%; height:${layout.photoH}px; overflow:hidden;
        background-color:#0F0F1D; position:relative; display:block;
        background-image:url("${player._imgBase64}");
        background-size:cover;
        background-position:top center;
        background-repeat:no-repeat;
      `;
    } else {
      const bg = initialsColor(player.name);
      photoDiv.style.cssText = `
        width:100%; height:${layout.photoH}px; overflow:hidden;
        background:${bg}; position:relative;
        display:flex; align-items:center; justify-content:center;
      `;
      const initText = document.createElement('div');
      initText.textContent = getInitials(player.name);
      initText.style.cssText = `font-size:${Math.round(layout.photoH * 0.35)}px; font-weight:900; color:rgba(255,255,255,0.7); font-family:${FONT_STACK};`;
      photoDiv.appendChild(initText);
    }
    card.appendChild(photoDiv);

    // Info Container (Single block flow container, guaranteed zero overlap)
    const infoContainer = document.createElement('div');
    infoContainer.style.cssText = `
      width:100%; background:#141426;
      padding:${layout.padY > 10 ? 8 : 4}px 4px ${layout.padY > 10 ? 10 : 5}px 4px; box-sizing:border-box;
      text-align:center; display:block;
    `;

    const pName = (player.name || 'Player').trim();
    const isLongName = pName.length > 13 || pName.split(/\s+/).length >= 3;

    // Table-based vertical centering for Name (CSS 2.1, 100% stable in html2canvas, never cuts letters)
    const nameTable = document.createElement('div');
    nameTable.style.cssText = `
      display:table; width:100%; height:${layout.nameBoxH}px; min-height:${layout.nameBoxH}px;
      margin:0 0 ${layout.padY > 10 ? 6 : 2}px 0; box-sizing:border-box;
    `;

    const nameCell = document.createElement('div');
    nameCell.style.cssText = `
      display:table-cell; vertical-align:middle; text-align:center;
      padding:0 2px; box-sizing:border-box;
    `;

    const nameText = document.createElement('span');
    nameText.textContent = pName;
    nameText.style.cssText = `
      color:#FFFFFF;
      font-size:${isLongName ? `${layout.nameSize - 1}px` : `${layout.nameSize}px`};
      font-weight:800;
      letter-spacing:0.25px;
      line-height:${layout.nameLineH}px;
      display:block;
      text-align:center;
      word-break:break-word;
      font-family:${FONT_STACK};
      overflow:visible;
    `;
    nameCell.appendChild(nameText);
    nameTable.appendChild(nameCell);
    infoContainer.appendChild(nameTable);

    // Dedicated Role Pill (inline-block with exact matching line-height, text never slides down)
    const role = (player.role || 'PLAYER').toUpperCase();
    const rc = roleColor(role);

    const rolePill = document.createElement('div');
    rolePill.textContent = role;
    rolePill.style.cssText = `
      display:inline-block; height:${layout.roleH}px; line-height:${layout.roleH - 2}px;
      padding:0 ${layout.cols >= 6 ? 6 : 10}px; border-radius:${Math.round(layout.roleH / 2)}px;
      background:${rc.bg}; border:1px solid ${rc.border};
      color:${rc.text}; font-size:${layout.roleSize}px; font-weight:800;
      letter-spacing:0.5px; text-transform:uppercase;
      font-family:${FONT_STACK}; text-align:center;
      vertical-align:middle; box-sizing:border-box;
      white-space:nowrap;
    `;
    infoContainer.appendChild(rolePill);
    card.appendChild(infoContainer);

    grid.appendChild(card);
  });

  // Placeholder cards to keep symmetry on partial rows
  const remainder = players.length % layout.cols;
  if (remainder !== 0) {
    for (let i = 0; i < layout.cols - remainder; i++) {
      const ph = document.createElement('div');
      ph.style.cssText = `border-radius:10px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); min-height:${layout.cardMinH}px;`;
      grid.appendChild(ph);
    }
  }

  gridWrap.appendChild(grid);
  wrap.appendChild(gridWrap);

  // ── 3. FOOTER BAR: Clean ezAuction Branding Center, Page Number Right (No League Name) ──
  const footer = document.createElement('div');
  footer.style.cssText = `
    width:100%; height:46px; flex-shrink:0;
    border-top:1px solid rgba(212,175,55,0.20);
    background:rgba(0,0,0,0.5);
    display:flex; align-items:center; justify-content:space-between;
    padding:0 36px; box-sizing:border-box; position:relative; z-index:2;
  `;

  // Left space for balance
  const ftLeft = document.createElement('div');
  ftLeft.style.cssText = `width:80px;`;
  footer.appendChild(ftLeft);

  // Center: EzAuction Logo
  const ftCenter = document.createElement('div');
  ftCenter.style.cssText = `display:flex; align-items:center; gap:8px; justify-content:center;`;
  if (logoBase64) {
    const fLogo = document.createElement('img');
    fLogo.src = logoBase64;
    fLogo.style.cssText = `height:24px; object-fit:contain; opacity:0.85; filter:drop-shadow(0 2px 6px rgba(0,0,0,0.6));`;
    ftCenter.appendChild(fLogo);
  } else {
    const fText = document.createElement('span');
    fText.textContent = 'ezAuction';
    fText.style.cssText = `font-size:12px; font-weight:800; color:#D4AF37; letter-spacing:2px; font-family:${FONT_STACK};`;
    ftCenter.appendChild(fText);
  }
  footer.appendChild(ftCenter);

  // Right: Page number
  const ftRight = document.createElement('div');
  ftRight.textContent = `PAGE ${pageNum} / ${totalPages}`;
  ftRight.style.cssText = `
    font-size:11px; font-weight:700; color:#888; letter-spacing:1px;
    width:80px; text-align:right; font-family:${FONT_STACK};
  `;
  footer.appendChild(ftRight);

  wrap.appendChild(footer);

  return wrap;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate a professional IPL-style square team PDF.
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
    // Fall back to styled text
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

  // 4. Create off-screen rendering container
  const container = document.createElement('div');
  container.style.cssText = `
    position:fixed; top:-12000px; left:-12000px; z-index:-9999;
    width:${SQUARE_SIZE}px; pointer-events:none;
  `;
  document.body.appendChild(container);

  // 1:1 Square PDF: 210mm x 210mm
  const doc = new jsPDF({ unit: 'mm', format: [PAGE_SIZE_MM, PAGE_SIZE_MM], orientation: 'portrait' });

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
      'JPEG', 0, 0, PAGE_SIZE_MM, PAGE_SIZE_MM,
      undefined, 'FAST'
    );
    container.removeChild(coverNode);

    // ── Team pages (Every team fits on exactly 1 page) ──
    const totalPages = 1 + teamsWithPlayers.length;
    let pageNum = 1; // cover is page 1

    for (const team of teamsWithPlayers) {
      const players = team.players || [];
      doc.addPage();
      pageNum++;

      const node = buildProTeamPage(
        team,
        players,
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
        'JPEG', 0, 0, PAGE_SIZE_MM, PAGE_SIZE_MM,
        undefined, 'FAST'
      );
      container.removeChild(node);
    }

    const safeFilename = `${(tournamentName || 'Auction').replace(/[^a-z0-9]/gi, '_')}_IPL_Style_Squad.pdf`;
    doc.save(safeFilename);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
