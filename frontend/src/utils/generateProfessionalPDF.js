import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// ---------------------------------------------------------------------------
// Helpers & Typography (Standard A4 Portrait Ratio: 1 : 1.4142)
// ---------------------------------------------------------------------------

const FONT_STACK = 'Arial, Helvetica, sans-serif';
const PAGE_W = 1000;      // px (high-res canvas width)
const PAGE_H = 1414;      // px (high-res canvas height, 1:1.414 A4 standard)
const PAGE_W_MM = 210;    // mm (A4 width)
const PAGE_H_MM = 297;    // mm (A4 height)

/**
 * Format Indian Rupees with commas.
 */
function fmtINR(val) {
  if (!val || isNaN(val)) return '';
  return '₹' + Number(val).toLocaleString('en-IN');
}

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
  const r = (role || '').toUpperCase();
  if (r.includes('BAT')) return { bg: 'rgba(26,58,107,0.92)', text: '#72B6FF', border: 'rgba(96,170,255,0.6)' };
  if (r.includes('BOWL') || r.includes('BOW')) return { bg: 'rgba(107,26,26,0.92)', text: '#FF7575', border: 'rgba(255,96,96,0.6)' };
  if (r.includes('WK') || r.includes('KEEP')) return { bg: 'rgba(26,92,42,0.92)', text: '#75F094', border: 'rgba(96,232,128,0.6)' };
  if (r.includes('AR') || r.includes('ALL')) return { bg: 'rgba(74,26,107,0.92)', text: '#D27AFF', border: 'rgba(192,96,255,0.6)' };
  return { bg: 'rgba(42,42,42,0.92)', text: '#D4AF37', border: 'rgba(212,175,55,0.5)' };
}

// ---------------------------------------------------------------------------
// Cover page (Executive IPL Dossier Style - A4 Portrait)
// ---------------------------------------------------------------------------

function buildProCoverPage(tournamentName, teamsWithPlayers, logoBase64) {
  const totalPlayers = teamsWithPlayers.reduce((s, t) => s + (t.players || []).length, 0);
  const totalTeams = teamsWithPlayers.length;

  const wrap = document.createElement('div');
  wrap.style.cssText = `
    width:${PAGE_W}px; height:${PAGE_H}px; overflow:hidden; position:relative;
    background:#0B0B14; font-family:${FONT_STACK}; box-sizing:border-box;
    display:flex; flex-direction:column; align-items:center; justify-content:space-between;
    padding:60px 50px 40px;
  `;

  // ── Radial glow behind content ──
  const glow = document.createElement('div');
  glow.style.cssText = `
    position:absolute; top:35%; left:50%; transform:translate(-50%,-50%);
    width:850px; height:850px; border-radius:50%;
    background:radial-gradient(circle, rgba(212,175,55,0.14) 0%, transparent 68%);
    pointer-events:none;
  `;
  wrap.appendChild(glow);

  // ── Outer decorative border ──
  const frame = document.createElement('div');
  frame.style.cssText = `
    position:absolute; inset:20px; border:1px solid rgba(212,175,55,0.25);
    border-radius:18px; pointer-events:none;
  `;
  wrap.appendChild(frame);

  // ── Corner gold brackets ──
  const corners = [
    { top: '24px', left: '24px', borderTop: '3px solid #D4AF37', borderLeft: '3px solid #D4AF37' },
    { top: '24px', right: '24px', borderTop: '3px solid #D4AF37', borderRight: '3px solid #D4AF37' },
    { bottom: '24px', left: '24px', borderBottom: '3px solid #D4AF37', borderLeft: '3px solid #D4AF37' },
    { bottom: '24px', right: '24px', borderBottom: '3px solid #D4AF37', borderRight: '3px solid #D4AF37' },
  ];
  corners.forEach(style => {
    const c = document.createElement('div');
    c.style.cssText = `position:absolute; width:48px; height:48px; `;
    Object.entries(style).forEach(([k, v]) => (c.style[k] = v));
    wrap.appendChild(c);
  });

  // ── Top Header Brand ──
  const topBrand = document.createElement('div');
  topBrand.style.cssText = `
    display:flex; flex-direction:column; align-items:center; z-index:2;
    margin-top:20px;
  `;

  if (logoBase64) {
    const logoImg = document.createElement('img');
    logoImg.src = logoBase64;
    logoImg.style.cssText = `height:72px; object-fit:contain; filter:drop-shadow(0 0 20px rgba(212,175,55,0.5)); margin-bottom:14px;`;
    topBrand.appendChild(logoImg);
  } else {
    const logoText = document.createElement('div');
    logoText.textContent = 'ezAuction';
    logoText.style.cssText = `
      font-size:38px; font-weight:900; color:#D4AF37;
      letter-spacing:5px; text-transform:uppercase; margin-bottom:14px;
      text-shadow:0 0 25px rgba(212,175,55,0.6);
    `;
    topBrand.appendChild(logoText);
  }

  const liveBadge = document.createElement('div');
  liveBadge.style.cssText = `
    display:inline-flex; align-items:center; gap:8px;
    background:rgba(212,175,55,0.12); border:1px solid rgba(212,175,55,0.45);
    border-radius:16px; padding:5px 18px;
  `;
  liveBadge.innerHTML = `
    <span style="width:7px; height:7px; border-radius:50%; background:#D4AF37; display:inline-block;"></span>
    <span style="font-size:11px; font-weight:800; color:#D4AF37; letter-spacing:2px;">OFFICIAL AUCTION SQUAD DOSSIER</span>
  `;
  topBrand.appendChild(liveBadge);
  wrap.appendChild(topBrand);

  // ── Tournament Title & Subtitle ──
  const titleBox = document.createElement('div');
  titleBox.style.cssText = `text-align:center; max-width:820px; z-index:2; margin:20px 0;`;

  const tName = document.createElement('div');
  tName.textContent = (tournamentName || 'Cricket Auction').toUpperCase();
  tName.style.cssText = `
    font-size:46px; font-weight:900; color:#FFFFFF; text-align:center;
    letter-spacing:2px; line-height:1.15; margin-bottom:14px;
    text-shadow:0 4px 24px rgba(0,0,0,0.9), 0 0 35px rgba(212,175,55,0.3);
  `;
  titleBox.appendChild(tName);

  const subGoldLine = document.createElement('div');
  subGoldLine.style.cssText = `
    width:320px; height:2px; margin:0 auto 16px;
    background:linear-gradient(90deg, transparent, #D4AF37, #FFE885, #D4AF37, transparent);
  `;
  titleBox.appendChild(subGoldLine);

  const subText = document.createElement('div');
  subText.textContent = 'TEAM-WISE PLAYER ROSTER & ACQUISITIONS';
  subText.style.cssText = `
    font-size:14px; font-weight:800; color:#D4AF37; letter-spacing:4px;
    text-transform:uppercase; text-shadow:0 0 10px rgba(212,175,55,0.4);
  `;
  titleBox.appendChild(subText);
  wrap.appendChild(titleBox);

  // ── Stat Chips ──
  const chipRow = document.createElement('div');
  chipRow.style.cssText = `display:flex; gap:28px; z-index:2; margin:10px 0 24px;`;

  [[`${totalTeams}`, 'TEAMS PARTICIPATING'], [`${totalPlayers}`, 'PLAYERS ACQUIRED']].forEach(([num, label]) => {
    const chip = document.createElement('div');
    chip.style.cssText = `
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      padding:16px 36px; border-radius:14px; min-width:180px;
      background:rgba(212,175,55,0.08); border:1.5px solid rgba(212,175,55,0.35);
      box-shadow: 0 6px 24px rgba(0,0,0,0.5);
    `;
    chip.innerHTML = `
      <div style="font-size:38px; font-weight:900; color:#D4AF37; line-height:1;">${num}</div>
      <div style="font-size:10.5px; font-weight:800; color:#CCCCCC; letter-spacing:2px; margin-top:6px;">${label}</div>
    `;
    chipRow.appendChild(chip);
  });
  wrap.appendChild(chipRow);

  // ── Team Directory Grid (Overview) ──
  const dirCard = document.createElement('div');
  dirCard.style.cssText = `
    width:100%; max-width:820px; background:rgba(22,23,40,0.85);
    border:1px solid rgba(212,175,55,0.25); border-radius:16px;
    padding:20px 28px; z-index:2; box-shadow:0 8px 30px rgba(0,0,0,0.4);
  `;

  const dirHeader = document.createElement('div');
  dirHeader.style.cssText = `
    display:flex; justify-content:space-between; align-items:center;
    border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:10px; margin-bottom:12px;
  `;
  dirHeader.innerHTML = `
    <span style="font-size:12px; font-weight:800; color:#D4AF37; letter-spacing:2px;">OFFICIAL TEAM DIRECTORY</span>
    <span style="font-size:11px; font-weight:700; color:#888;">SQUAD STRENGTH</span>
  `;
  dirCard.appendChild(dirHeader);

  const teamList = document.createElement('div');
  teamList.style.cssText = `
    display:grid; grid-template-columns:repeat(${totalTeams > 6 ? 2 : 1}, 1fr); gap:8px 24px;
    max-height:320px;
  `;

  teamsWithPlayers.forEach((t, idx) => {
    const tName = t.team?.name || t.name || 'Team';
    const count = (t.players || []).length;
    const row = document.createElement('div');
    row.style.cssText = `
      display:flex; justify-content:space-between; align-items:center;
      padding:7px 12px; background:${idx % 2 === 0 ? 'rgba(212,175,55,0.04)' : 'transparent'};
      border-radius:8px;
    `;
    row.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:11px; font-weight:800; color:#D4AF37;">#${String(idx + 1).padStart(2, '0')}</span>
        <span style="font-size:13px; font-weight:700; color:#FFFFFF;">${tName}</span>
      </div>
      <div style="background:rgba(212,175,55,0.14); border:1px solid rgba(212,175,55,0.3); border-radius:12px; padding:2px 10px; font-size:11px; font-weight:800; color:#D4AF37;">
        ${count} Player${count !== 1 ? 's' : ''}
      </div>
    `;
    teamList.appendChild(row);
  });

  dirCard.appendChild(teamList);
  wrap.appendChild(dirCard);

  // ── Footer ──
  const footer = document.createElement('div');
  footer.style.cssText = `
    width:100%; display:flex; flex-direction:column; align-items:center;
    gap:6px; z-index:2; margin-top:16px;
  `;
  footer.innerHTML = `
    <div style="width:120px; height:1px; background:rgba(212,175,55,0.3);"></div>
    <div style="font-size:10px; font-weight:800; color:#666; letter-spacing:3px;">POWERED BY EZAUCTION BROADCAST ENGINE</div>
  `;
  wrap.appendChild(footer);

  return wrap;
}

// ---------------------------------------------------------------------------
// Dynamic Grid Configuration: Ensures ALL players fit gracefully on 1 page
// with generous breathing room, proper portrait photo heights, and zero cutting.
// ---------------------------------------------------------------------------

function getProGridLayout(count) {
  // Available height in A4 Portrait (PAGE_H = 1414px):
  // Header (112px) + Footer (46px) leaves 1256px vertical canvas.
  // Generous gaps (22-28px) and paddings provide high-end card breathing room.

  if (count <= 4) {
    return {
      cols: 2,
      photoH: 300,
      gapX: 36, gapY: 32,
      nameSize: 17, nameLineH: 22, nameBoxH: 42,
      roleSize: 12, roleH: 26,
      padX: 60, padY: 30,
    };
  }
  if (count <= 8) {
    return {
      cols: 4,
      photoH: 220,
      gapX: 26, gapY: 26,
      nameSize: 14.5, nameLineH: 19, nameBoxH: 36,
      roleSize: 11, roleH: 24,
      padX: 46, padY: 26,
    };
  }
  if (count <= 12) {
    return {
      cols: 4,
      photoH: 185,
      gapX: 24, gapY: 24,
      nameSize: 13.5, nameLineH: 18, nameBoxH: 34,
      roleSize: 10, roleH: 23,
      padX: 44, padY: 24,
    };
  }
  if (count <= 16) {
    // 4 columns x 4 rows = 16 cards (perfect full grid for 16 players)
    return {
      cols: 4,
      photoH: 165,
      gapX: 24, gapY: 22,
      nameSize: 13, nameLineH: 17, nameBoxH: 32,
      roleSize: 9.5, roleH: 22,
      padX: 42, padY: 22,
    };
  }
  if (count <= 20) {
    // 5 columns x 4 rows = 20 cards
    return {
      cols: 5,
      photoH: 150,
      gapX: 18, gapY: 18,
      nameSize: 12, nameLineH: 16, nameBoxH: 30,
      roleSize: 9, roleH: 21,
      padX: 36, padY: 20,
    };
  }
  if (count <= 25) {
    // 5 columns x 5 rows = 25 cards
    return {
      cols: 5,
      photoH: 125,
      gapX: 16, gapY: 16,
      nameSize: 11, nameLineH: 15, nameBoxH: 28,
      roleSize: 8.5, roleH: 20,
      padX: 34, padY: 16,
    };
  }
  if (count <= 30) {
    // 6 columns x 5 rows = 30 cards
    return {
      cols: 6,
      photoH: 110,
      gapX: 14, gapY: 14,
      nameSize: 10.5, nameLineH: 14, nameBoxH: 26,
      roleSize: 8, roleH: 18,
      padX: 30, padY: 14,
    };
  }
  // 31+ players
  return {
    cols: 7,
    photoH: 95,
    gapX: 12, gapY: 12,
    nameSize: 9.5, nameLineH: 13, nameBoxH: 24,
    roleSize: 7.5, roleH: 17,
    padX: 24, padY: 12,
  };
}

// ---------------------------------------------------------------------------
// Team page (Executive IPL Dossier Style - A4 Portrait)
// ---------------------------------------------------------------------------

function buildProTeamPage(teamData, players, logoBase64, pageNum, totalPages) {
  const teamName = teamData.team?.name || teamData.name || 'Team';
  const layout = getProGridLayout(players.length);

  const wrap = document.createElement('div');
  wrap.style.cssText = `
    width:${PAGE_W}px; height:${PAGE_H}px; overflow:hidden; position:relative;
    background:#0B0B14; font-family:${FONT_STACK}; box-sizing:border-box;
    display:flex; flex-direction:column; justify-content:space-between;
  `;

  // ── Background Atmosphere Glow ──
  const bgGlow = document.createElement('div');
  bgGlow.style.cssText = `
    position:absolute; top:-80px; left:50%; transform:translateX(-50%);
    width:850px; height:450px; border-radius:50%;
    background:radial-gradient(ellipse, rgba(212,175,55,0.08) 0%, transparent 70%);
    pointer-events:none;
  `;
  wrap.appendChild(bgGlow);

  // ── 1. HEADER SECTION: Centralized Logo & Large Team Name ──
  const headerHeight = 112;
  const header = document.createElement('div');
  header.style.cssText = `
    width:100%; height:${headerHeight}px; flex-shrink:0;
    background:linear-gradient(180deg, rgba(212,175,55,0.18) 0%, rgba(11,11,20,0.98) 100%);
    border-bottom:2px solid rgba(212,175,55,0.45);
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:12px 28px; box-sizing:border-box; position:relative; z-index:2;
  `;

  const centerRow = document.createElement('div');
  centerRow.style.cssText = `display:flex; align-items:center; justify-content:center; gap:16px;`;

  if (teamData._logoBase64) {
    const tLogo = document.createElement('img');
    tLogo.src = teamData._logoBase64;
    tLogo.style.cssText = `
      height:54px; width:54px; object-fit:contain; border-radius:12px;
      border:2px solid rgba(212,175,55,0.55); filter:drop-shadow(0 3px 12px rgba(0,0,0,0.8));
      background:rgba(255,255,255,0.04);
    `;
    centerRow.appendChild(tLogo);
  }

  const tNameEl = document.createElement('div');
  tNameEl.textContent = teamName.toUpperCase();
  tNameEl.style.cssText = `
    font-size:${players.length > 18 ? '30px' : '34px'}; font-weight:900; color:#FFFFFF; letter-spacing:2px; line-height:1;
    text-shadow: 0 2px 16px rgba(0,0,0,0.9), 0 0 28px rgba(212,175,55,0.4);
    font-family:${FONT_STACK};
  `;
  centerRow.appendChild(tNameEl);
  header.appendChild(centerRow);

  // Subtitle: Squad Player Count Pill
  const tSub = document.createElement('div');
  tSub.textContent = `${players.length} SQUAD PLAYER${players.length !== 1 ? 'S' : ''} • OFFICIAL ROSTER`;
  tSub.style.cssText = `
    font-size:10.5px; font-weight:800; color:#D4AF37; letter-spacing:3px; margin-top:8px;
    text-transform:uppercase; line-height:1; font-family:${FONT_STACK};
  `;
  header.appendChild(tSub);

  wrap.appendChild(header);

  // ── 2. PLAYER GRID (Generous card breathing room, proportional un-stretched photos) ──
  const gridWrap = document.createElement('div');
  gridWrap.style.cssText = `
    flex:1; display:flex; flex-direction:column; justify-content:center;
    padding:${layout.padY}px ${layout.padX}px; box-sizing:border-box; position:relative; z-index:1;
  `;

  const grid = document.createElement('div');
  grid.style.cssText = `
    display:grid; grid-template-columns:repeat(${layout.cols}, 1fr); gap:${layout.gapY}px ${layout.gapX}px;
    width:100%; box-sizing:border-box;
  `;

  players.forEach(player => {
    const card = document.createElement('div');
    card.style.cssText = `
      border-radius:12px; overflow:hidden;
      background:linear-gradient(180deg, #18192E 0%, #111222 100%);
      border:1.5px solid rgba(212,175,55,0.30);
      border-top:3px solid #D4AF37;
      display:block;
      box-shadow:0 8px 24px rgba(0,0,0,0.55);
      width:100%; box-sizing:border-box;
    `;

    // Photo container with CSS background-image
    // (html2canvas preserves exact aspect ratio without stretching, unlike <img> tags)
    const photoBox = document.createElement('div');
    if (player._imgBase64) {
      photoBox.style.cssText = `
        width:100%; height:${layout.photoH}px;
        background-color:#0D0E1C;
        background-image:url("${player._imgBase64}");
        background-size:cover;
        background-position:center top;
        background-repeat:no-repeat;
        position:relative; display:block; overflow:hidden;
      `;

      // Subtle bottom gradient fade for seamless broadcast look
      const vignette = document.createElement('div');
      vignette.style.cssText = `
        position:absolute; bottom:0; left:0; right:0; height:32%;
        background:linear-gradient(180deg, transparent 0%, rgba(19,20,38,0.96) 100%);
        pointer-events:none;
      `;
      photoBox.appendChild(vignette);
    } else {
      const bg = initialsColor(player.name);
      photoBox.style.cssText = `
        width:100%; height:${layout.photoH}px;
        background:${bg};
        position:relative; display:flex; align-items:center; justify-content:center;
        overflow:hidden;
      `;
      const initText = document.createElement('div');
      initText.textContent = getInitials(player.name);
      initText.style.cssText = `
        font-size:${Math.round(layout.photoH * 0.38)}px; font-weight:900;
        color:rgba(255,255,255,0.75); font-family:${FONT_STACK};
      `;
      photoBox.appendChild(initText);
    }

    // Sold price tag: rigidly sized & vertically centered (text NEVER slips out at bottom)
    if (player.sold_price) {
      const priceTag = document.createElement('div');
      priceTag.textContent = fmtINR(player.sold_price);
      priceTag.style.cssText = `
        position:absolute; top:8px; right:8px;
        height:22px; line-height:20px;
        padding:0 10px;
        background:rgba(8,9,18,0.92);
        border:1.5px solid #D4AF37;
        border-radius:11px;
        font-size:10px; font-weight:800; color:#FFE885;
        letter-spacing:0.5px; font-family:${FONT_STACK};
        box-sizing:border-box; text-align:center;
        display:block; z-index:3;
        box-shadow:0 3px 8px rgba(0,0,0,0.7);
        white-space:nowrap;
      `;
      photoBox.appendChild(priceTag);
    }

    card.appendChild(photoBox);

    // Info Container (Player Name & Role Pill)
    // Uses standard block flow layout (no nested flex flex:1) so text never slips out of cards
    const infoContainer = document.createElement('div');
    infoContainer.style.cssText = `
      width:100%; background:#131426;
      padding:8px 8px 12px; box-sizing:border-box;
      text-align:center; display:block;
    `;

    const pName = (player.name || 'Player').trim();
    const isLongName = pName.length > 13 || pName.split(/\s+/).length >= 3;

    // Name Box (Table layout for robust vertical centering)
    const nameTable = document.createElement('div');
    nameTable.style.cssText = `
      display:table; width:100%; height:${layout.nameBoxH}px; min-height:${layout.nameBoxH}px;
      margin:0 0 6px 0; box-sizing:border-box;
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

    // Dedicated Role Pill (Sufficient bottom margin guarantees zero overlap/slipping)
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

  gridWrap.appendChild(grid);
  wrap.appendChild(gridWrap);

  // ── 3. FOOTER BAR: Clean ezAuction Branding Center, Page Number Right ──
  // (Removed redundant team dossier text per user request)
  const footer = document.createElement('div');
  footer.style.cssText = `
    width:100%; height:46px; flex-shrink:0;
    border-top:1px solid rgba(212,175,55,0.25);
    background:rgba(0,0,0,0.65);
    display:flex; align-items:center; justify-content:space-between;
    padding:0 36px; box-sizing:border-box; position:relative; z-index:2;
  `;

  // Left (Clean spacer for balance)
  const ftLeft = document.createElement('div');
  ftLeft.style.cssText = `width:120px;`;
  footer.appendChild(ftLeft);

  // Center: EzAuction Logo / Text
  const ftCenter = document.createElement('div');
  ftCenter.style.cssText = `display:flex; align-items:center; gap:8px; justify-content:center;`;
  if (logoBase64) {
    const fLogo = document.createElement('img');
    fLogo.src = logoBase64;
    fLogo.style.cssText = `height:26px; object-fit:contain; opacity:0.9; filter:drop-shadow(0 2px 6px rgba(0,0,0,0.6));`;
    ftCenter.appendChild(fLogo);
  } else {
    const fText = document.createElement('span');
    fText.textContent = 'ezAuction';
    fText.style.cssText = `font-size:13px; font-weight:800; color:#D4AF37; letter-spacing:2px; font-family:${FONT_STACK};`;
    ftCenter.appendChild(fText);
  }
  footer.appendChild(ftCenter);

  // Right: Page number
  const ftRight = document.createElement('div');
  ftRight.textContent = `PAGE ${pageNum} / ${totalPages}`;
  ftRight.style.cssText = `
    font-size:11px; font-weight:800; color:#D4AF37; letter-spacing:1px;
    width:120px; text-align:right; font-family:${FONT_STACK};
  `;
  footer.appendChild(ftRight);

  wrap.appendChild(footer);

  return wrap;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate a professional IPL-style team PDF (A4 Portrait, 1 page per team).
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
    width:${PAGE_W}px; pointer-events:none;
  `;
  document.body.appendChild(container);

  // Standard A4 Portrait PDF: 210mm x 297mm
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  try {
    // ── Cover page ──
    const coverNode = buildProCoverPage(tournamentName, teamsWithPlayers, logoBase64);
    container.appendChild(coverNode);
    await new Promise(r => setTimeout(r, 120));
    const coverCanvas = await html2canvas(coverNode, {
      scale: 2.0,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#0B0B14',
      logging: false,
    });
    doc.addImage(
      coverCanvas.toDataURL('image/jpeg', 0.96),
      'JPEG', 0, 0, PAGE_W_MM, PAGE_H_MM,
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
        scale: 2.0,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0B0B14',
        logging: false,
      });
      doc.addImage(
        canvas.toDataURL('image/jpeg', 0.96),
        'JPEG', 0, 0, PAGE_W_MM, PAGE_H_MM,
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
