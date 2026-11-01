/**
 * generateTeamPDF.js
 * Renders beautiful themed HTML pages → html2canvas screenshots → jsPDF
 * Each team gets its own A4 page(s). Cover page included.
 */
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// ─── Theme tokens ────────────────────────────────────────────────────────────
const THEMES = {
  black_gold: {
    pageBg:    'linear-gradient(160deg, #0a0a0a 0%, #111108 60%, #0a0a0a 100%)',
    headerBg:  'linear-gradient(135deg, #1a1500 0%, #0a0a0a 100%)',
    cardBg:    'rgba(22,20,8,0.95)',
    cardBorder:'rgba(212,175,55,0.25)',
    accent:    '#D4AF37',
    accentDim: 'rgba(212,175,55,0.12)',
    accentLine:'rgba(212,175,55,0.35)',
    text:      '#FFFFFF',
    textDim:   'rgba(255,255,255,0.45)',
    textMuted: 'rgba(255,255,255,0.25)',
    tag:       'rgba(212,175,55,0.15)',
    tagText:   '#D4AF37',
    tagBorder: 'rgba(212,175,55,0.4)',
    rowEven:   'rgba(212,175,55,0.05)',
    rowHover:  'rgba(212,175,55,0.10)',
    separator: 'rgba(212,175,55,0.12)',
    name: 'Black & Gold',
    cover: 'linear-gradient(160deg, #0a0a0a 0%, #1a1000 50%, #0a0a0a 100%)',
  },
  navy_gold: {
    pageBg:    'linear-gradient(160deg, #071630 0%, #0b1e45 60%, #071630 100%)',
    headerBg:  'linear-gradient(135deg, #0d1e4a 0%, #071630 100%)',
    cardBg:    'rgba(13,27,68,0.95)',
    cardBorder:'rgba(201,168,76,0.25)',
    accent:    '#C9A84C',
    accentDim: 'rgba(201,168,76,0.12)',
    accentLine:'rgba(201,168,76,0.35)',
    text:      '#FFFFFF',
    textDim:   'rgba(200,215,255,0.5)',
    textMuted: 'rgba(200,215,255,0.25)',
    tag:       'rgba(201,168,76,0.15)',
    tagText:   '#C9A84C',
    tagBorder: 'rgba(201,168,76,0.4)',
    rowEven:   'rgba(201,168,76,0.05)',
    rowHover:  'rgba(201,168,76,0.10)',
    separator: 'rgba(201,168,76,0.12)',
    name: 'Navy & Gold',
    cover: 'linear-gradient(160deg, #050e22 0%, #0c1e50 50%, #050e22 100%)',
  },
  blue_brush: {
    pageBg:    'linear-gradient(160deg, #e2eaf8 0%, #edf2fc 60%, #e2eaf8 100%)',
    headerBg:  'linear-gradient(135deg, #c5d6f5 0%, #e2eaf8 100%)',
    cardBg:    'rgba(255,255,255,0.97)',
    cardBorder:'rgba(0,71,204,0.15)',
    accent:    '#0047CC',
    accentDim: 'rgba(0,71,204,0.08)',
    accentLine:'rgba(0,71,204,0.3)',
    text:      '#061E4E',
    textDim:   'rgba(6,30,78,0.55)',
    textMuted: 'rgba(6,30,78,0.3)',
    tag:       'rgba(0,71,204,0.1)',
    tagText:   '#0047CC',
    tagBorder: 'rgba(0,71,204,0.3)',
    rowEven:   'rgba(0,71,204,0.04)',
    rowHover:  'rgba(0,71,204,0.08)',
    separator: 'rgba(0,71,204,0.10)',
    name: 'Blue Brush',
    cover: 'linear-gradient(160deg, #c8d9f5 0%, #e2eaf8 50%, #c8d9f5 100%)',
  },
  dark_teal: {
    pageBg:    'linear-gradient(160deg, #040e10 0%, #061820 60%, #040e10 100%)',
    headerBg:  'linear-gradient(135deg, #071c20 0%, #040e10 100%)',
    cardBg:    'rgba(6,24,28,0.95)',
    cardBorder:'rgba(12,207,190,0.2)',
    accent:    '#0CCFBE',
    accentDim: 'rgba(12,207,190,0.1)',
    accentLine:'rgba(12,207,190,0.3)',
    text:      '#FFFFFF',
    textDim:   'rgba(180,230,225,0.5)',
    textMuted: 'rgba(180,230,225,0.25)',
    tag:       'rgba(12,207,190,0.12)',
    tagText:   '#0CCFBE',
    tagBorder: 'rgba(12,207,190,0.35)',
    rowEven:   'rgba(12,207,190,0.05)',
    rowHover:  'rgba(12,207,190,0.10)',
    separator: 'rgba(12,207,190,0.10)',
    name: 'Dark Teal',
    cover: 'linear-gradient(160deg, #020809 0%, #051418 50%, #020809 100%)',
  },
};

const ROLE_COLORS = {
  BATSMAN:       { bg: 'rgba(59,130,246,0.20)',  color: '#60A5FA', border: 'rgba(59,130,246,0.5)' },
  BOWLER:        { bg: 'rgba(239,68,68,0.18)',   color: '#F87171', border: 'rgba(239,68,68,0.5)' },
  ALLROUNDER:    { bg: 'rgba(168,85,247,0.18)',  color: '#C084FC', border: 'rgba(168,85,247,0.5)' },
  'ALL-ROUNDER': { bg: 'rgba(168,85,247,0.18)',  color: '#C084FC', border: 'rgba(168,85,247,0.5)' },
  WICKETKEEPER:  { bg: 'rgba(16,185,129,0.18)',  color: '#34D399', border: 'rgba(16,185,129,0.5)' },
  WK:            { bg: 'rgba(16,185,129,0.18)',  color: '#34D399', border: 'rgba(16,185,129,0.5)' },
  DEFAULT:       { bg: 'rgba(255,255,255,0.1)',  color: 'rgba(255,255,255,0.7)', border: 'rgba(255,255,255,0.3)' },
};

function roleStyle(role) {
  if (!role) return ROLE_COLORS.DEFAULT;
  return ROLE_COLORS[role.toUpperCase().replace(/\s+/g, '-')] || ROLE_COLORS.DEFAULT;
}

function fmt(n) {
  return '\u20B9' + Number(n || 0).toLocaleString('en-IN');
}

// ─── html2canvas helper ───────────────────────────────────────────────────────
async function captureNode(node) {
  return html2canvas(node, {
    scale: 2.5,
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
    logging: false,
    imageTimeout: 8000,
  }).then(c => c.toDataURL('image/jpeg', 0.95));
}

// ─── Image to base64 helper ───────────────────────────────────────────────────
async function toBase64(url) {
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise(resolve => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

// Page dimensions for consistent rendering (794 x 1123 = A4 at 96dpi)
const PW = 794;
const PH = 1123;
const PAD = 48;

// ─── Build COVER PAGE ─────────────────────────────────────────────────────────
function buildCoverNode(tk, tournamentName, teams, logoBase64) {
  const d = document.createElement('div');
  d.style.cssText = `
    width:${PW}px;height:${PH}px;box-sizing:border-box;
    background:${tk.cover};
    font-family:'Segoe UI','Inter',system-ui,sans-serif;
    position:relative;overflow:hidden;
    display:flex;flex-direction:column;align-items:center;
    padding:${PAD}px;
  `;

  // Decorative left accent bar
  add(d, 'div', `position:absolute;left:0;top:0;bottom:0;width:5px;background:${tk.accent};`);

  // Top right accent corner
  add(d, 'div', `position:absolute;top:0;right:0;width:120px;height:120px;
    background:radial-gradient(circle at top right, ${tk.accent}15 0%, transparent 70%);`);

  // Bottom subtle glow
  add(d, 'div', `position:absolute;bottom:-40px;left:50%;transform:translateX(-50%);
    width:500px;height:200px;border-radius:50%;
    background:radial-gradient(circle, ${tk.accent}12 0%, transparent 70%);pointer-events:none;`);

  // Spacer
  add(d, 'div', `height:60px;flex-shrink:0;`);

  // Logo
  if (logoBase64) {
    const wrap = add(d, 'div', `margin-bottom:32px;`);
    const img = document.createElement('img');
    img.src = logoBase64;
    img.style.cssText = `height:56px;width:auto;object-fit:contain;`;
    wrap.appendChild(img);
  } else {
    add(d, 'div', `font-size:32px;font-weight:900;color:${tk.accent};letter-spacing:0.08em;margin-bottom:32px;`, 'EZAuction');
  }

  // Accent line
  add(d, 'div', `width:80px;height:3px;background:linear-gradient(90deg,transparent,${tk.accent},transparent);border-radius:2px;margin-bottom:40px;`);

  // Tournament name
  add(d, 'div', `
    font-size:42px;font-weight:900;color:${tk.text};text-align:center;
    line-height:1.15;margin-bottom:16px;letter-spacing:-0.025em;
    max-width:${PW - PAD * 2 - 40}px;word-break:break-word;
  `, tournamentName || 'Auction');

  // Tagline
  add(d, 'div', `font-size:15px;font-weight:800;color:${tk.accent};
    letter-spacing:0.4em;text-transform:uppercase;margin-bottom:10px;`, 'Team-wise Player List');

  // Date
  add(d, 'div', `font-size:11px;color:${tk.textDim};letter-spacing:0.15em;margin-bottom:50px;`,
    new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }));

  // Stats row (only teams and players — no total spent)
  const totalPlayers = teams.reduce((s, t) => s + (t.players || []).length, 0);
  const statsRow = add(d, 'div', `display:flex;gap:24px;margin-bottom:50px;`);
  [
    { label: 'Teams', value: teams.length },
    { label: 'Players Sold', value: totalPlayers },
  ].forEach(stat => {
    const box = add(statsRow, 'div', `
      flex:1;min-width:140px;background:${tk.accentDim};border:1.5px solid ${tk.accentLine};
      border-radius:16px;padding:22px 20px;text-align:center;
    `);
    add(box, 'div', `font-size:32px;font-weight:900;color:${tk.accent};line-height:1;`, String(stat.value));
    add(box, 'div', `font-size:10px;color:${tk.textDim};text-transform:uppercase;letter-spacing:0.25em;margin-top:8px;font-weight:700;`, stat.label);
  });

  // Team directory label
  add(d, 'div', `font-size:9px;color:${tk.textMuted};letter-spacing:0.4em;text-transform:uppercase;
    font-weight:800;margin-bottom:14px;align-self:flex-start;padding-left:4px;`, 'Teams Included');

  // Team directory list
  const list = add(d, 'div', `width:100%;display:flex;flex-direction:column;gap:8px;`);
  teams.forEach((t, i) => {
    const teamName = t.team?.name || t.name || 'Unknown';
    const playerCount = (t.players || []).length;
    const row = add(list, 'div', `
      display:flex;align-items:center;justify-content:space-between;
      background:${tk.accentDim};border:1.5px solid ${tk.cardBorder};
      border-radius:12px;padding:12px 18px;
    `);
    const left = add(row, 'div', `display:flex;align-items:center;gap:14px;`);
    add(left, 'div', `font-size:12px;color:${tk.textMuted};font-weight:800;min-width:24px;`, String(i + 1).padStart(2, '0'));
    add(left, 'div', `font-size:14px;color:${tk.text};font-weight:700;`, teamName);
    add(row, 'div', `font-size:12px;color:${tk.accent};font-weight:700;`, `${playerCount} player${playerCount !== 1 ? 's' : ''}`);
  });

  // Footer
  add(d, 'div', `position:absolute;bottom:24px;left:0;right:0;text-align:center;
    font-size:9px;color:${tk.textMuted};letter-spacing:0.25em;text-transform:uppercase;`, 'Powered by EZAuction');

  return d;
}

// ─── Build TEAM PAGE ──────────────────────────────────────────────────────────
function buildTeamNode(tk, team, players, tournamentName, includeBidPrice, logoBase64, teamLogoBase64) {
  const teamName = team.team?.name || team.name || 'Unknown';

  const d = document.createElement('div');
  d.style.cssText = `
    width:${PW}px;height:${PH}px;box-sizing:border-box;
    background:${tk.pageBg};
    font-family:'Segoe UI','Inter',system-ui,sans-serif;
    position:relative;overflow:hidden;
  `;

  // Left accent bar
  add(d, 'div', `position:absolute;left:0;top:0;bottom:0;width:5px;background:${tk.accent};`);

  // ── Header ──────────────────────────────────────────────────────────────────
  const header = add(d, 'div', `
    background:${tk.headerBg};
    border-bottom:2px solid ${tk.accentLine};
    padding:28px ${PAD}px 28px ${PAD + 4}px;
    display:flex;align-items:center;gap:22px;position:relative;
  `);

  // Team logo
  const logoBox = add(header, 'div', `
    width:68px;height:68px;border-radius:16px;overflow:hidden;
    background:${tk.accentDim};border:2px solid ${tk.accentLine};
    display:flex;align-items:center;justify-content:center;flex-shrink:0;
  `);
  if (teamLogoBase64) {
    const img = document.createElement('img');
    img.src = teamLogoBase64;
    img.style.cssText = `width:100%;height:100%;object-fit:cover;`;
    logoBox.appendChild(img);
  } else {
    add(logoBox, 'div', `font-size:28px;font-weight:900;color:${tk.accent};`, teamName.charAt(0).toUpperCase());
  }

  // Team info
  const info = add(header, 'div', `flex:1;`);
  add(info, 'div', `font-size:26px;font-weight:900;color:${tk.text};line-height:1.1;`, teamName);
  add(info, 'div', `font-size:12px;color:${tk.textDim};margin-top:5px;font-weight:600;letter-spacing:0.06em;`,
    `${players.length} Player${players.length !== 1 ? 's' : ''}  •  ${tournamentName || 'Auction'}`);

  // EZAuction logo in header
  if (logoBase64) {
    const eLogo = document.createElement('img');
    eLogo.src = logoBase64;
    eLogo.style.cssText = `height:26px;width:auto;object-fit:contain;opacity:0.5;flex-shrink:0;`;
    header.appendChild(eLogo);
  }

  // ── Player table ────────────────────────────────────────────────────────────
  const tableWrap = add(d, 'div', `padding:22px ${PAD}px 60px ${PAD + 4}px;`);

  // Grid columns
  const cols = includeBidPrice
    ? '36px 50px 1fr 120px 54px 120px'
    : '36px 50px 1fr 130px 60px';

  // Column headers
  const colH = add(tableWrap, 'div', `
    display:grid;grid-template-columns:${cols};gap:10px;align-items:center;
    padding:8px 14px;margin-bottom:6px;
    border-bottom:2px solid ${tk.accentLine};
  `);
  const colLabels = ['#', '', 'Player', 'Role', 'Age'];
  if (includeBidPrice) colLabels.push('Sold For');
  colLabels.forEach((h, i) => {
    const el = add(colH, 'div', `font-size:9px;font-weight:800;color:${tk.textMuted};
      text-transform:uppercase;letter-spacing:0.25em;
      ${i === colLabels.length - 1 && includeBidPrice ? 'text-align:right;' : ''}`);
    el.textContent = h;
  });

  // Player rows
  players.forEach((player, idx) => {
    const row = add(tableWrap, 'div', `
      display:grid;grid-template-columns:${cols};gap:10px;align-items:center;
      padding:9px 14px;
      background:${idx % 2 === 0 ? tk.rowEven : 'transparent'};
      border-radius:10px;
      border-bottom:1px solid ${tk.separator};
      min-height:52px;
    `);

    // #
    add(row, 'div', `font-size:12px;color:${tk.textMuted};font-weight:800;`, String(idx + 1).padStart(2, '0'));

    // Photo
    const photoWrap = add(row, 'div', `
      width:42px;height:42px;border-radius:10px;overflow:hidden;
      border:1.5px solid ${tk.accentLine};background:${tk.accentDim};
      display:flex;align-items:center;justify-content:center;flex-shrink:0;
    `);
    if (player._imgBase64) {
      const pImg = document.createElement('img');
      pImg.src = player._imgBase64;
      pImg.style.cssText = `width:100%;height:100%;object-fit:cover;object-position:top center;`;
      photoWrap.appendChild(pImg);
    } else {
      add(photoWrap, 'div', `font-size:16px;font-weight:900;color:${tk.accent};`, (player.name || '?').charAt(0).toUpperCase());
    }

    // Name
    add(row, 'div', `font-size:14px;font-weight:700;color:${tk.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`, player.name || '—');

    // Role pill
    const rs = roleStyle(player.role);
    add(row, 'div', `
      font-size:9.5px;font-weight:700;padding:4px 10px;border-radius:20px;
      background:${rs.bg};color:${rs.color};border:1px solid ${rs.border};
      text-transform:uppercase;letter-spacing:0.08em;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      display:inline-block;max-width:110px;line-height:1.3;
    `, player.role || '—');

    // Age
    add(row, 'div', `font-size:13px;color:${tk.textDim};font-weight:600;`, player.age ? String(player.age) : '—');

    // Price
    if (includeBidPrice) {
      add(row, 'div', `font-size:14px;font-weight:800;color:${tk.accent};text-align:right;`,
        player.sold_price ? fmt(player.sold_price) : '—');
    }
  });

  if (players.length === 0) {
    add(tableWrap, 'div', `text-align:center;padding:50px;color:${tk.textMuted};font-size:14px;font-style:italic;`, 'No players assigned to this team yet.');
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  const footer = add(d, 'div', `
    position:absolute;bottom:0;left:0;right:0;
    padding:14px ${PAD}px 14px ${PAD + 4}px;
    border-top:1.5px solid ${tk.separator};
    display:flex;justify-content:space-between;align-items:center;
  `);
  add(footer, 'div', `font-size:9px;color:${tk.textMuted};letter-spacing:0.15em;text-transform:uppercase;font-weight:600;`,
    `${teamName}  •  ${tournamentName || 'Auction'}`);
  add(footer, 'div', `font-size:9px;color:${tk.textMuted};letter-spacing:0.15em;text-transform:uppercase;font-weight:600;`,
    'Powered by EZAuction');

  return d;
}

// Utility: add child element
function add(parent, tag, style, text) {
  const el = document.createElement(tag);
  el.style.cssText = style || '';
  if (text) el.textContent = text;
  parent.appendChild(el);
  return el;
}

// Split players into chunks that fit a page
// Header takes ~130px, footer ~40px, col header ~30px, each row ~52px
// Available: 1123 - 130 - 40 - 30 = 923px. Per row ~55px → ~16 players per page
const PLAYERS_PER_PAGE = 14; // safe with larger fonts

// ─── Main export ──────────────────────────────────────────────────────────────
export async function generateTeamPDF({
  tournamentName,
  includeBidPrice,
  themeKey,
  teamSquads,
  getImageUrl,
}) {
  const tk = THEMES[themeKey] || THEMES.black_gold;
  const teamsWithPlayers = (teamSquads || []).filter(t => (t.players || []).length > 0);

  if (teamsWithPlayers.length === 0) {
    alert('No teams with sold players to export.');
    return;
  }

  // Pre-fetch logo
  let logoBase64 = null;
  try { logoBase64 = await toBase64('/ezauction.png'); } catch {}

  // Pre-fetch all images in parallel
  const allPlayers = teamsWithPlayers.flatMap(t => t.players || []);
  await Promise.all(allPlayers.map(async p => {
    const src = p.image || p.thumb_url;
    if (src) {
      try { p._imgBase64 = await toBase64(getImageUrl(src)); } catch { p._imgBase64 = null; }
    }
  }));

  // Pre-fetch team logos
  await Promise.all(teamsWithPlayers.map(async t => {
    const logoSrc = t.team?.logo || t.logo;
    if (logoSrc) {
      try { t._logoBase64 = await toBase64(getImageUrl(logoSrc)); } catch { t._logoBase64 = null; }
    }
  }));

  // Off-screen container
  const container = document.createElement('div');
  container.style.cssText = `position:fixed;top:-9999px;left:-9999px;z-index:-1;width:${PW}px;pointer-events:none;`;
  document.body.appendChild(container);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const PAGE_W_MM = 210;
  const PAGE_H_MM = 297;

  try {
    // ── Cover page ────────────────────────────────────────────────────────────
    const coverNode = buildCoverNode(tk, tournamentName, teamsWithPlayers, logoBase64);
    container.appendChild(coverNode);
    await new Promise(r => setTimeout(r, 100));
    const coverImg = await captureNode(coverNode);
    doc.addImage(coverImg, 'JPEG', 0, 0, PAGE_W_MM, PAGE_H_MM, undefined, 'FAST');
    container.removeChild(coverNode);

    // ── Per-team pages ────────────────────────────────────────────────────────
    for (const team of teamsWithPlayers) {
      const players = team.players || [];

      // Split into page chunks to avoid overflow / text cutting
      const chunks = [];
      for (let i = 0; i < players.length; i += PLAYERS_PER_PAGE) {
        chunks.push(players.slice(i, i + PLAYERS_PER_PAGE));
      }
      if (chunks.length === 0) chunks.push([]);

      for (let ci = 0; ci < chunks.length; ci++) {
        doc.addPage();
        const chunk = chunks[ci];

        // For continuation pages, modify the team object slightly
        const teamObj = ci === 0 ? team : {
          ...team,
          team: {
            ...(team.team || {}),
            name: (team.team?.name || team.name || 'Unknown') + ` (Page ${ci + 1})`,
          },
        };

        const teamNode = buildTeamNode(
          tk, teamObj, chunk,
          tournamentName, includeBidPrice,
          logoBase64, team._logoBase64 || null
        );
        container.appendChild(teamNode);
        await new Promise(r => setTimeout(r, 100));
        const teamImg = await captureNode(teamNode);
        doc.addImage(teamImg, 'JPEG', 0, 0, PAGE_W_MM, PAGE_H_MM, undefined, 'FAST');
        container.removeChild(teamNode);
      }
    }

    const filename = `${(tournamentName || 'Auction').replace(/[^a-z0-9]/gi, '_')}_Team_Players.pdf`;
    doc.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}
