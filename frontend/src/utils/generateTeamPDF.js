/**
 * generateTeamPDF.js
 * Executive Luxury Team-wise Player Dossier Generator
 * Designed for pixel-perfect html2canvas capture and crisp jsPDF compilation.
 */
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// ─── Theme Palettes ──────────────────────────────────────────────────────────
const THEMES = {
  black_gold: {
    bg: '#0B0B0C',
    pageGradient: 'radial-gradient(circle at 50% 0%, #1c1708 0%, #0c0b09 50%, #060606 100%)',
    headerBg: 'linear-gradient(135deg, rgba(38,30,12,0.9) 0%, rgba(18,16,10,0.95) 100%)',
    headerBorder: 'rgba(212,175,55,0.35)',
    cardBg: 'rgba(24,22,16,0.85)',
    cardBorder: 'rgba(212,175,55,0.22)',
    accent: '#E5C058',
    accentLight: '#FDF0CD',
    accentDim: 'rgba(212,175,55,0.14)',
    accentGlow: 'rgba(212,175,55,0.25)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.65)',
    textMuted: 'rgba(255,255,255,0.35)',
    rowEven: 'rgba(212,175,55,0.04)',
    rowBorder: 'rgba(212,175,55,0.12)',
    tableHeaderBg: 'rgba(30,26,14,0.9)',
    isLight: false,
    name: 'Black & Gold',
  },
  navy_gold: {
    bg: '#061124',
    pageGradient: 'radial-gradient(circle at 50% 0%, #0c2048 0%, #07142e 50%, #040916 100%)',
    headerBg: 'linear-gradient(135deg, rgba(16,38,82,0.9) 0%, rgba(9,22,50,0.95) 100%)',
    headerBorder: 'rgba(201,168,76,0.35)',
    cardBg: 'rgba(12,27,60,0.85)',
    cardBorder: 'rgba(201,168,76,0.22)',
    accent: '#D8B658',
    accentLight: '#FFF2D2',
    accentDim: 'rgba(201,168,76,0.14)',
    accentGlow: 'rgba(201,168,76,0.25)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(210,225,255,0.7)',
    textMuted: 'rgba(210,225,255,0.35)',
    rowEven: 'rgba(201,168,76,0.04)',
    rowBorder: 'rgba(201,168,76,0.12)',
    tableHeaderBg: 'rgba(14,32,70,0.9)',
    isLight: false,
    name: 'Navy & Gold',
  },
  blue_brush: {
    bg: '#EDF3FC',
    pageGradient: 'radial-gradient(circle at 50% 0%, #dbe6fa 0%, #edf3fc 60%, #e2ecf9 100%)',
    headerBg: 'linear-gradient(135deg, #ffffff 0%, #f0f5fd 100%)',
    headerBorder: 'rgba(0,71,204,0.22)',
    cardBg: '#FFFFFF',
    cardBorder: 'rgba(0,71,204,0.14)',
    accent: '#0047CC',
    accentLight: '#002E8A',
    accentDim: 'rgba(0,71,204,0.08)',
    accentGlow: 'rgba(0,71,204,0.15)',
    textPrimary: '#0A1E46',
    textSecondary: 'rgba(10,30,70,0.65)',
    textMuted: 'rgba(10,30,70,0.4)',
    rowEven: 'rgba(0,71,204,0.03)',
    rowBorder: 'rgba(0,71,204,0.09)',
    tableHeaderBg: 'rgba(230,239,255,0.95)',
    isLight: true,
    name: 'Blue Brush',
  },
  dark_teal: {
    bg: '#030E10',
    pageGradient: 'radial-gradient(circle at 50% 0%, #072228 0%, #030e12 50%, #010608 100%)',
    headerBg: 'linear-gradient(135deg, rgba(8,36,42,0.9) 0%, rgba(4,18,22,0.95) 100%)',
    headerBorder: 'rgba(12,207,190,0.35)',
    cardBg: 'rgba(6,28,34,0.85)',
    cardBorder: 'rgba(12,207,190,0.22)',
    accent: '#10DFCD',
    accentLight: '#D0FFF9',
    accentDim: 'rgba(12,207,190,0.14)',
    accentGlow: 'rgba(12,207,190,0.25)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(180,240,235,0.7)',
    textMuted: 'rgba(180,240,235,0.35)',
    rowEven: 'rgba(12,207,190,0.04)',
    rowBorder: 'rgba(12,207,190,0.12)',
    tableHeaderBg: 'rgba(8,34,40,0.9)',
    isLight: false,
    name: 'Dark Teal',
  },
  midnight_yellow: {
    bg: '#001b2b',
    pageGradient: 'radial-gradient(circle at 50% 0%, #003657 0%, #002439 50%, #00121d 100%)',
    headerBg: 'linear-gradient(135deg, rgba(0,36,57,0.9) 0%, rgba(0,27,43,0.95) 100%)',
    headerBorder: 'rgba(250,227,0,0.35)',
    cardBg: 'rgba(0,29,46,0.85)',
    cardBorder: 'rgba(250,227,0,0.22)',
    accent: '#FAE300',
    accentLight: '#FFFF80',
    accentDim: 'rgba(250,227,0,0.14)',
    accentGlow: 'rgba(250,227,0,0.25)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(240,245,255,0.7)',
    textMuted: 'rgba(240,245,255,0.35)',
    rowEven: 'rgba(250,227,0,0.04)',
    rowBorder: 'rgba(250,227,0,0.12)',
    tableHeaderBg: 'rgba(0,30,48,0.9)',
    isLight: false,
    name: 'Midnight Yellow',
  },
};

const ROLE_BADGES = {
  BATSMAN:       { bg: 'rgba(37,99,235,0.16)',   border: 'rgba(59,130,246,0.6)',  text: '#3B82F6', label: 'BATSMAN' },
  BOWLER:        { bg: 'rgba(220,38,38,0.16)',   border: 'rgba(239,68,68,0.6)',   text: '#EF4444', label: 'BOWLER' },
  ALLROUNDER:    { bg: 'rgba(147,51,234,0.16)',  border: 'rgba(168,85,247,0.6)',  text: '#A855F7', label: 'ALL-ROUNDER' },
  'ALL-ROUNDER': { bg: 'rgba(147,51,234,0.16)',  border: 'rgba(168,85,247,0.6)',  text: '#A855F7', label: 'ALL-ROUNDER' },
  WICKETKEEPER:  { bg: 'rgba(16,185,129,0.16)',  border: 'rgba(16,185,129,0.6)',  text: '#10B981', label: 'WICKET-KEEPER' },
  WK:            { bg: 'rgba(16,185,129,0.16)',  border: 'rgba(16,185,129,0.6)',  text: '#10B981', label: 'WICKET-KEEPER' },
  DEFAULT:       { bg: 'rgba(100,116,139,0.16)', border: 'rgba(148,163,184,0.6)', text: '#94A3B8', label: 'PLAYER' },
};

function getRoleBadge(role) {
  if (!role) return ROLE_BADGES.DEFAULT;
  const k = role.toUpperCase().replace(/\s+/g, '-');
  return ROLE_BADGES[k] || { ...ROLE_BADGES.DEFAULT, label: role.toUpperCase() };
}

function fmtINR(val) {
  return '\u20B9' + Number(val || 0).toLocaleString('en-IN');
}

// ─── Base64 Fetcher ──────────────────────────────────────────────────────────
async function toBase64(url) {
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

// Fixed A4 dimensions at standard 96 DPI
const A4_W = 794;
const A4_H = 1123;
const FONT_STACK = 'Arial, Helvetica, sans-serif';

// ─── Node Builder Helpers ────────────────────────────────────────────────────
function createEl(tag, styles, content) {
  const el = document.createElement(tag);
  if (styles) el.style.cssText = styles;
  if (content !== undefined && content !== null) el.innerHTML = content;
  return el;
}

// ─── COVER PAGE BUILDER ──────────────────────────────────────────────────────
function buildCoverPage(tk, tournamentName, teams, logoBase64) {
  const page = createEl('div', `
    width: ${A4_W}px;
    height: ${A4_H}px;
    box-sizing: border-box;
    background: ${tk.pageGradient};
    position: relative;
    overflow: hidden;
    padding: 60px 56px 44px;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: ${FONT_STACK};
  `);

  // Outer Luxury Border Frame
  const frame = createEl('div', `
    position: absolute;
    inset: 20px;
    border: 1px solid ${tk.headerBorder};
    border-radius: 20px;
    pointer-events: none;
    box-shadow: inset 0 0 40px ${tk.accentDim};
  `);
  page.appendChild(frame);

  // Inner Accent Corner Notches
  const cornerSize = 16;
  const corners = [
    `top: 24px; left: 24px; border-top: 2px solid ${tk.accent}; border-left: 2px solid ${tk.accent};`,
    `top: 24px; right: 24px; border-top: 2px solid ${tk.accent}; border-right: 2px solid ${tk.accent};`,
    `bottom: 24px; left: 24px; border-bottom: 2px solid ${tk.accent}; border-left: 2px solid ${tk.accent};`,
    `bottom: 24px; right: 24px; border-bottom: 2px solid ${tk.accent}; border-right: 2px solid ${tk.accent};`,
  ];
  corners.forEach(c => {
    page.appendChild(createEl('div', `position: absolute; width: ${cornerSize}px; height: ${cornerSize}px; ${c}`));
  });

  // Top Atmosphere Glow
  page.appendChild(createEl('div', `
    position: absolute;
    top: -120px;
    left: 50%;
    transform: translateX(-50%);
    width: 500px;
    height: 350px;
    border-radius: 50%;
    background: radial-gradient(circle, ${tk.accentGlow} 0%, transparent 70%);
    pointer-events: none;
  `));

  // Top Brand Section
  const brandSection = createEl('div', `
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 40px;
    margin-bottom: 24px;
  `);

  if (logoBase64) {
    const img = createEl('img', `
      height: 60px;
      width: auto;
      object-fit: contain;
      filter: drop-shadow(0 4px 16px ${tk.accentDim});
      margin-bottom: 12px;
    `);
    img.src = logoBase64;
    brandSection.appendChild(img);
  } else {
    brandSection.appendChild(createEl('div', `
      font-size: 32px;
      font-weight: 900;
      color: ${tk.accent};
      line-height: 38px;
      letter-spacing: 2px;
    `, 'EZAuction'));
  }

  const liveBadge = createEl('div', `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: ${tk.accentDim};
    border: 1px solid ${tk.headerBorder};
    border-radius: 14px;
    height: 26px;
    padding: 0 14px;
    margin-top: 8px;
    box-sizing: border-box;
  `);
  liveBadge.appendChild(createEl('span', `
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: ${tk.accent};
    display: inline-block;
  `));
  liveBadge.appendChild(createEl('span', `
    font-size: 10px;
    font-weight: 800;
    color: ${tk.accent};
    letter-spacing: 1.5px;
    line-height: 14px;
  `, 'OFFICIAL AUCTION RECORD'));
  brandSection.appendChild(liveBadge);

  page.appendChild(brandSection);

  // Tournament Title & Subtitle Card
  const titleBox = createEl('div', `
    text-align: center;
    max-width: 620px;
    margin-bottom: 32px;
    padding: 0 16px;
  `);

  titleBox.appendChild(createEl('div', `
    font-size: 40px;
    font-weight: 900;
    color: ${tk.textPrimary};
    line-height: 48px;
    margin-bottom: 10px;
    text-shadow: 0 2px 14px rgba(0,0,0,0.4);
  `, tournamentName || 'Premier Auction'));

  titleBox.appendChild(createEl('div', `
    font-size: 15px;
    font-weight: 800;
    color: ${tk.accent};
    letter-spacing: 3px;
    line-height: 22px;
    margin-bottom: 6px;
  `, 'TEAM-WISE PLAYER DOSSIER'));

  titleBox.appendChild(createEl('div', `
    font-size: 12px;
    font-weight: 600;
    color: ${tk.textSecondary};
    line-height: 18px;
  `, `Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`));

  page.appendChild(titleBox);

  // Key Summary Metrics Bar
  const totalPlayersSold = teams.reduce((s, t) => s + (t.players || []).length, 0);
  const metricsBar = createEl('div', `
    display: flex;
    justify-content: center;
    gap: 20px;
    width: 100%;
    max-width: 440px;
    margin-bottom: 36px;
  `);

  const statItems = [
    { label: 'TEAMS PARTICIPATING', val: teams.length },
    { label: 'PLAYERS ACQUIRED', val: totalPlayersSold },
  ];

  statItems.forEach(s => {
    const card = createEl('div', `
      flex: 1;
      background: ${tk.cardBg};
      border: 1px solid ${tk.cardBorder};
      border-radius: 14px;
      padding: 16px 20px;
      text-align: center;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    `);
    card.appendChild(createEl('div', `
      font-size: 30px;
      font-weight: 900;
      color: ${tk.accent};
      line-height: 36px;
    `, String(s.val)));
    card.appendChild(createEl('div', `
      font-size: 10px;
      font-weight: 800;
      color: ${tk.textSecondary};
      letter-spacing: 1px;
      line-height: 14px;
      margin-top: 2px;
    `, s.label));
    metricsBar.appendChild(card);
  });

  page.appendChild(metricsBar);

  // Team Directory Section
  const dirContainer = createEl('div', `
    width: 100%;
    max-width: 640px;
    background: ${tk.cardBg};
    border: 1px solid ${tk.cardBorder};
    border-radius: 16px;
    padding: 20px 24px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  `);

  const dirHeader = createEl('div', `
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid ${tk.rowBorder};
    padding-bottom: 10px;
    margin-bottom: 12px;
  `);
  dirHeader.appendChild(createEl('div', `
    font-size: 11px;
    font-weight: 800;
    color: ${tk.accent};
    letter-spacing: 1.5px;
    line-height: 16px;
  `, 'TEAMS INCLUDED IN THIS REPORT'));
  dirHeader.appendChild(createEl('div', `
    font-size: 11px;
    font-weight: 700;
    color: ${tk.textMuted};
    line-height: 16px;
  `, 'PLAYERS SOLD'));
  dirContainer.appendChild(dirHeader);

  const teamList = createEl('div', `
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 300px;
  `);

  teams.forEach((t, idx) => {
    const tName = t.team?.name || t.name || 'Team';
    const count = (t.players || []).length;
    const row = createEl('div', `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: ${idx % 2 === 0 ? tk.rowEven : 'transparent'};
      border-radius: 8px;
    `);

    const left = createEl('div', `display: flex; align-items: center; gap: 12px;`);
    left.appendChild(createEl('span', `
      font-size: 11px;
      font-weight: 800;
      color: ${tk.accent};
      min-width: 20px;
      line-height: 16px;
    `, `#${String(idx + 1).padStart(2, '0')}`));
    left.appendChild(createEl('span', `
      font-size: 13px;
      font-weight: 700;
      color: ${tk.textPrimary};
      line-height: 18px;
    `, tName));

    const right = createEl('div', `
      display: inline-block;
      text-align: center;
      vertical-align: middle;
      background: ${tk.accentDim};
      height: 24px;
      line-height: 22px;
      padding: 0 12px;
      border-radius: 12px;
      border: 1px solid ${tk.cardBorder};
      box-sizing: border-box;
      font-size: 11px;
      font-weight: 800;
      color: ${tk.accent};
      font-family: ${FONT_STACK};
      white-space: nowrap;
    `, `${count} Player${count !== 1 ? 's' : ''}`);

    row.appendChild(left);
    row.appendChild(right);
    teamList.appendChild(row);
  });

  dirContainer.appendChild(teamList);
  page.appendChild(dirContainer);

  // Footer branding
  page.appendChild(createEl('div', `
    position: absolute;
    bottom: 30px;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 10px;
    font-weight: 700;
    color: ${tk.textMuted};
    letter-spacing: 2px;
    line-height: 14px;
  `, 'POWERED BY EZAUCTION BROADCAST ENGINE'));

  return page;
}

// ─── TEAM SQUAD PAGE BUILDER ─────────────────────────────────────────────────
function buildTeamPage(tk, team, players, tournamentName, includeBidPrice, logoBase64, teamLogoBase64, pageNumber, totalPages) {
  const teamName = team.team?.name || team.name || 'Team';

  const page = createEl('div', `
    width: ${A4_W}px;
    height: ${A4_H}px;
    box-sizing: border-box;
    background: ${tk.pageGradient};
    position: relative;
    overflow: hidden;
    padding: 32px 36px 30px;
    display: flex;
    flex-direction: column;
    font-family: ${FONT_STACK};
  `);

  // Outer Border Frame
  page.appendChild(createEl('div', `
    position: absolute;
    inset: 14px;
    border: 1px solid ${tk.headerBorder};
    border-radius: 16px;
    pointer-events: none;
  `));

  // Top Left Decorative Stripe
  page.appendChild(createEl('div', `
    position: absolute;
    top: 14px;
    left: 14px;
    width: 6px;
    height: 160px;
    background: ${tk.accent};
    border-radius: 16px 0 0 0;
  `));

  // Header banner sizing adapts when squad has many players
  const count = players.length;
  let rowH = 54;
  let avatarSize = 40;
  let fontSizeName = 13;
  let fontSizeRole = 10;
  let fontSizeAge = 13;
  let fontSizePrice = 14;
  let roleBadgeH = 22;
  let roleBadgePad = 12;

  if (count > 10 && count <= 13) {
    rowH = 45;
    avatarSize = 34;
    fontSizeName = 12;
    fontSizeRole = 9.5;
    fontSizeAge = 12;
    fontSizePrice = 13;
    roleBadgeH = 20;
    roleBadgePad = 10;
  } else if (count > 13 && count <= 16) {
    rowH = 38;
    avatarSize = 30;
    fontSizeName = 11.5;
    fontSizeRole = 9;
    fontSizeAge = 11.5;
    fontSizePrice = 12;
    roleBadgeH = 19;
    roleBadgePad = 8;
  } else if (count > 16 && count <= 20) {
    rowH = 32;
    avatarSize = 25;
    fontSizeName = 11;
    fontSizeRole = 8.5;
    fontSizeAge = 11;
    fontSizePrice = 11;
    roleBadgeH = 17;
    roleBadgePad = 6;
  } else if (count > 20) {
    rowH = Math.max(22, Math.floor(660 / count));
    avatarSize = Math.max(16, rowH - 6);
    fontSizeName = 10;
    fontSizeRole = 8;
    fontSizeAge = 10;
    fontSizePrice = 10;
    roleBadgeH = Math.max(14, rowH - 6);
    roleBadgePad = 4;
  }

  // ── HEADER BANNER ──────────────────────────────────────────────────────────
  const header = createEl('div', `
    background: ${tk.headerBg};
    border: 1px solid ${tk.headerBorder};
    border-radius: 14px;
    padding: ${count > 14 ? '12px 20px' : '18px 24px'};
    margin-bottom: ${count > 14 ? '12px' : '20px'};
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 6px 20px rgba(0,0,0,0.15);
  `);

  const headerLeft = createEl('div', `display: flex; align-items: center; gap: 18px;`);

  // Team Logo container
  const logoWrap = createEl('div', `
    width: 68px;
    height: 68px;
    border-radius: 14px;
    overflow: hidden;
    background: ${tk.cardBg};
    border: 2px solid ${tk.accent};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 14px ${tk.accentDim};
  `);

  if (teamLogoBase64) {
    const tImg = createEl('img', `width: 100%; height: 100%; object-fit: cover; display: block;`);
    tImg.src = teamLogoBase64;
    logoWrap.appendChild(tImg);
  } else {
    logoWrap.appendChild(createEl('div', `
      font-size: 28px;
      font-weight: 900;
      color: ${tk.accent};
      line-height: 32px;
    `, teamName.charAt(0).toUpperCase()));
  }
  headerLeft.appendChild(logoWrap);

  // Team Title info
  const titleInfo = createEl('div', `display: flex; flex-direction: column; justify-content: center;`);
  titleInfo.appendChild(createEl('div', `
    font-size: 26px;
    font-weight: 900;
    color: ${tk.textPrimary};
    line-height: 32px;
    letter-spacing: -0.3px;
  `, teamName));

  const subRow = createEl('div', `display: flex; align-items: center; gap: 10px; margin-top: 4px;`);
  subRow.appendChild(createEl('div', `
    display: inline-block;
    background: ${tk.accentDim};
    color: ${tk.accent};
    border: 1px solid ${tk.cardBorder};
    height: 22px;
    line-height: 20px;
    padding: 0 12px;
    border-radius: 11px;
    font-size: 11px;
    font-weight: 800;
    text-align: center;
    vertical-align: middle;
    box-sizing: border-box;
    white-space: nowrap;
    font-family: ${FONT_STACK};
  `, `${players.length} PLAYER${players.length !== 1 ? 'S' : ''}`));

  subRow.appendChild(createEl('span', `
    color: ${tk.textSecondary};
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
  `, tournamentName || 'Official Auction Squad'));

  titleInfo.appendChild(subRow);
  headerLeft.appendChild(titleInfo);
  header.appendChild(headerLeft);

  // Header Right: Official ezAuction badge
  const headerRight = createEl('div', `display: flex; flex-direction: column; align-items: flex-end;`);
  if (logoBase64) {
    const ezImg = createEl('img', `height: 32px; width: auto; object-fit: contain; opacity: 0.85;`);
    ezImg.src = logoBase64;
    headerRight.appendChild(ezImg);
  } else {
    headerRight.appendChild(createEl('div', `
      font-size: 18px;
      font-weight: 900;
      color: ${tk.accent};
      line-height: 22px;
    `, 'EZAuction'));
  }
  headerRight.appendChild(createEl('div', `
    font-size: 9px;
    font-weight: 800;
    color: ${tk.textMuted};
    letter-spacing: 1.5px;
    margin-top: 4px;
    line-height: 12px;
  `, 'OFFICIAL ROSTER'));
  header.appendChild(headerRight);

  page.appendChild(header);

  // ── SQUAD TABLE ────────────────────────────────────────────────────────────
  const tableContainer = createEl('div', `
    background: ${tk.cardBg};
    border: 1px solid ${tk.cardBorder};
    border-radius: 14px;
    overflow: hidden;
    margin-bottom: 20px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.1);
  `);

  // Table Columns Width Calculation
  // Total usable width ~ 720px
  // Col 1 (#): 40px
  // Col 2 (Photo): 52px
  // Col 3 (Player Name): flex: 1 (~260px)
  // Col 4 (Role): 160px
  // Col 5 (Age): 50px
  // Col 6 (Price - optional): 120px

  const priceColHtml = includeBidPrice ? `
    <div style="width: 120px; text-align: right; padding-right: 18px; font-size: 10px; font-weight: 800; color: ${tk.accent}; letter-spacing: 1px; line-height: 14px;">
      SOLD PRICE
    </div>
  ` : '';

  const tableHeader = createEl('div', `
    display: flex;
    align-items: center;
    background: ${tk.tableHeaderBg};
    border-bottom: 1.5px solid ${tk.headerBorder};
    padding: 10px 0;
  `, `
    <div style="width: 44px; text-align: center; font-size: 10px; font-weight: 800; color: ${tk.textMuted}; line-height: 14px;">#</div>
    <div style="width: 52px; text-align: center; font-size: 10px; font-weight: 800; color: ${tk.textMuted}; line-height: 14px;">PHOTO</div>
    <div style="flex: 1; padding-left: 14px; font-size: 10px; font-weight: 800; color: ${tk.textMuted}; letter-spacing: 1px; line-height: 14px;">PLAYER NAME</div>
    <div style="width: 160px; text-align: center; font-size: 10px; font-weight: 800; color: ${tk.textMuted}; letter-spacing: 1px; line-height: 14px;">ROLE</div>
    <div style="width: 54px; text-align: center; font-size: 10px; font-weight: 800; color: ${tk.textMuted}; line-height: 14px;">AGE</div>
    ${priceColHtml}
  `);

  tableContainer.appendChild(tableHeader);

  // Table Body Rows
  const tableBody = createEl('div', `display: flex; flex-direction: column;`);

  players.forEach((player, idx) => {
    const roleMeta = getRoleBadge(player.role);
    const rowBg = idx % 2 === 0 ? tk.rowEven : 'transparent';
    const isLast = idx === players.length - 1;

    const row = createEl('div', `
      display: flex;
      align-items: center;
      height: ${rowH}px;
      background: ${rowBg};
      border-bottom: ${isLast ? 'none' : `1px solid ${tk.rowBorder}`};
      box-sizing: border-box;
    `);

    // Rank #
    row.appendChild(createEl('div', `
      width: 44px;
      text-align: center;
      font-size: ${fontSizeName}px;
      font-weight: 800;
      color: ${tk.accent};
      line-height: 16px;
    `, `#${String(idx + 1).padStart(2, '0')}`));

    // Photo avatar
    const photoCell = createEl('div', `
      width: 52px;
      display: flex;
      justify-content: center;
      align-items: center;
    `);

    const avatarBox = createEl('div', `
      width: ${avatarSize}px;
      height: ${avatarSize}px;
      border-radius: ${Math.round(avatarSize * 0.25)}px;
      overflow: hidden;
      background: ${tk.cardBg};
      border: 1.5px solid ${tk.cardBorder};
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    `);

    if (player._imgBase64) {
      const pImg = createEl('img', `width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block;`);
      pImg.src = player._imgBase64;
      avatarBox.appendChild(pImg);
    } else {
      avatarBox.appendChild(createEl('span', `
        font-size: ${Math.round(avatarSize * 0.45)}px;
        font-weight: 900;
        color: ${tk.accent};
        line-height: ${Math.round(avatarSize * 0.5)}px;
      `, (player.name || '?').charAt(0).toUpperCase()));
    }
    photoCell.appendChild(avatarBox);
    row.appendChild(photoCell);

    // Player Name
    const nameCell = createEl('div', `
      flex: 1;
      padding-left: 14px;
      display: flex;
      align-items: center;
      box-sizing: border-box;
      min-width: 0;
    `);
    nameCell.appendChild(createEl('div', `
      font-size: ${fontSizeName}px;
      font-weight: 800;
      color: ${tk.textPrimary};
      line-height: ${rowH < 35 ? '14px' : '18px'};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `, player.name || 'Unnamed Player'));
    row.appendChild(nameCell);

    // Role Badge (Guaranteed to stay strictly centered inside colored box)
    const roleCell = createEl('div', `
      width: 160px;
      text-align: center;
      box-sizing: border-box;
    `);
    const roleBadge = createEl('div', `
      display: inline-block;
      height: ${roleBadgeH}px;
      line-height: ${roleBadgeH - 2}px;
      padding: 0 ${roleBadgePad}px;
      border-radius: ${Math.round(roleBadgeH / 2)}px;
      background: ${roleMeta.bg};
      border: 1px solid ${roleMeta.border};
      color: ${roleMeta.text};
      font-size: ${fontSizeRole}px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      text-align: center;
      vertical-align: middle;
      box-sizing: border-box;
      white-space: nowrap;
      font-family: ${FONT_STACK};
    `, roleMeta.label);
    roleCell.appendChild(roleBadge);
    row.appendChild(roleCell);

    // Age Cell
    row.appendChild(createEl('div', `
      width: 54px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${fontSizeAge}px;
      font-weight: 700;
      color: ${tk.textSecondary};
      line-height: 18px;
      box-sizing: border-box;
    `, player.age ? String(player.age) : '—'));

    // Price Cell (optional)
    if (includeBidPrice) {
      row.appendChild(createEl('div', `
        width: 120px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-right: 18px;
        font-size: ${fontSizePrice}px;
        font-weight: 900;
        color: ${tk.accent};
        line-height: 18px;
        box-sizing: border-box;
      `, player.sold_price ? fmtINR(player.sold_price) : '—'));
    }

    tableBody.appendChild(row);
  });

  tableContainer.appendChild(tableBody);
  page.appendChild(tableContainer);

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const footer = createEl('div', `
    margin-top: auto;
    border-top: 1px solid ${tk.rowBorder};
    padding-top: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `);

  // Left space for balance (removed team dossier line per request)
  footer.appendChild(createEl('div', `width: 80px;`));

  footer.appendChild(createEl('div', `
    font-size: 10px;
    font-weight: 800;
    color: ${tk.accent};
    letter-spacing: 1px;
    line-height: 14px;
  `, `PAGE ${pageNumber} OF ${totalPages}`));

  page.appendChild(footer);

  return page;
}

// ─── Main PDF Export Function ────────────────────────────────────────────────
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
    alert('No teams with sold players found to export.');
    return;
  }

  // Pre-fetch EZAuction logo
  let logoBase64 = null;
  try { logoBase64 = await toBase64('/ezauction.png'); } catch {}

  // Pre-fetch all player images in parallel
  const allPlayers = teamsWithPlayers.flatMap(t => t.players || []);
  await Promise.all(allPlayers.map(async p => {
    const src = p.image || p.thumb_url;
    if (src) {
      try { p._imgBase64 = await toBase64(getImageUrl(src)); } catch { p._imgBase64 = null; }
    }
  }));

  // Pre-fetch team logos in parallel
  await Promise.all(teamsWithPlayers.map(async t => {
    const lSrc = t.team?.logo || t.logo;
    if (lSrc) {
      try { t._logoBase64 = await toBase64(getImageUrl(lSrc)); } catch { t._logoBase64 = null; }
    }
  }));

  // Create isolated off-screen rendering canvas container
  const container = createEl('div', `
    position: fixed;
    top: -12000px;
    left: -12000px;
    z-index: -9999;
    width: ${A4_W}px;
    pointer-events: none;
  `);
  document.body.appendChild(container);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const PAGE_W_MM = 210;
  const PAGE_H_MM = 297;

  // Calculate total pages: 1 cover + 1 per team (every team fits on 1 page)
  const totalReportPages = 1 + teamsWithPlayers.length;
  let currentPageIndex = 1;

  try {
    // ── 1. RENDER COVER PAGE ──────────────────────────────────────────────────
    const coverNode = buildCoverPage(tk, tournamentName, teamsWithPlayers, logoBase64);
    container.appendChild(coverNode);
    await new Promise(r => setTimeout(r, 120));

    const coverCanvas = await html2canvas(coverNode, {
      scale: 2.2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: tk.bg,
      logging: false,
      imageTimeout: 8000,
    });
    const coverData = coverCanvas.toDataURL('image/jpeg', 0.96);
    doc.addImage(coverData, 'JPEG', 0, 0, PAGE_W_MM, PAGE_H_MM, undefined, 'FAST');
    container.removeChild(coverNode);

    // ── 2. RENDER TEAM SQUAD PAGES (1 page per team) ─────────────────────────
    for (const team of teamsWithPlayers) {
      currentPageIndex++;
      doc.addPage();
      const players = team.players || [];

      const teamPageNode = buildTeamPage(
        tk,
        team,
        players,
        tournamentName,
        includeBidPrice,
        logoBase64,
        team._logoBase64 || null,
        currentPageIndex,
        totalReportPages
      );

      container.appendChild(teamPageNode);
      await new Promise(r => setTimeout(r, 120));

      const teamCanvas = await html2canvas(teamPageNode, {
        scale: 2.2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: tk.bg,
        logging: false,
        imageTimeout: 8000,
      });
      const teamData = teamCanvas.toDataURL('image/jpeg', 0.96);
      doc.addImage(teamData, 'JPEG', 0, 0, PAGE_W_MM, PAGE_H_MM, undefined, 'FAST');
      container.removeChild(teamPageNode);
    }

    const safeFilename = `${(tournamentName || 'Auction').replace(/[^a-z0-9]/gi, '_')}_Official_Squad_List.pdf`;
    doc.save(safeFilename);
  } finally {
    document.body.removeChild(container);
  }
}
