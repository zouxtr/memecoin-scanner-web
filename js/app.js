// app.js — client-side monitoring engine (port of main.py monitor loop).
// Tracks graduated coins, polls DexScreener/RugCheck per coin, scores
// with scoring.js, notifies via notify.js, persists via store.js.
import { CONFIG } from './config.js';
import { getDexscreenerPairs, getRugcheckReport, extractMintAddress } from './data.js';
import { scoreToken } from './scoring.js';
import { listenForMigrations } from './pump.js';
import { loadSeen, markSeen } from './store.js';
import { requestPermissionOnLoad, notifyHighPotential, isHighPotential } from './notify.js';

const tracked = new Map(); // mint -> { firstPrice, peakPrice, polls, consecutive, rugcheck, deadline, result }
const seen = loadSeen();
let pumpHandle = null;
let pollTimer = null;

const $ = (id) => document.getElementById(id);

function safeFloat(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export async function scanCoin(mint) {
  const [pairs, rugcheck] = await Promise.all([
    getDexscreenerPairs(mint),
    getRugcheckReport(mint),
  ]);
  const best = (pairs && pairs[0]) || {};
  // On-demand scan has no price history: momentum 0 (same as first poll).
  const result = scoreToken(mint, best, rugcheck, 0);
  return { result, best, rugcheck };
}

async function pollCoin(mint, state) {
  state.polls += 1;
  if (state.polls % CONFIG.RUGCHECK_REFRESH_EVERY_N_POLLS === 0 || !state.rugcheck) {
    state.rugcheck = await getRugcheckReport(mint);
  }
  const pairs = await getDexscreenerPairs(mint);
  const best = (pairs && pairs[0]) || {};
  const price = safeFloat(best.priceUsd);
  if (state.firstPrice == null && price) state.firstPrice = price;
  if (price) state.peakPrice = state.peakPrice ? Math.max(state.peakPrice, price) : price;
  const momentum = state.firstPrice && price
    ? ((price - state.firstPrice) / state.firstPrice) * 100 : 0;
  const drawdown = state.peakPrice && price
    ? ((state.peakPrice - price) / state.peakPrice) * 100 : 0;

  const result = scoreToken(mint, best, state.rugcheck || {}, momentum);
  const volumeH1 = ((best.volume || {}).h1) || 0;
  state.result = { ...result, volume_h1: volumeH1, momentum_pct: Math.round(momentum * 10) / 10 };
  state.drawdown = Math.round(drawdown * 10) / 10;

  if (result.is_high_potential) state.consecutive += 1;
  else state.consecutive = 0;

  if (result.is_high_potential &&
      state.consecutive >= CONFIG.MIN_POLLS_BEFORE_ALERT &&
      drawdown < CONFIG.PEAK_DRAWDOWN_STOP_PCT &&
      !state.alerted) {
    state.alerted = true;
    markSeen(mint, state.result);
    notifyHighPotential(state.result);
  }
  render();
}

async function pollAll() {
  const now = Date.now();
  for (const [mint, state] of tracked) {
    if (now > state.deadline) {
      tracked.delete(mint);
      markSeen(mint, state.result);
      continue;
    }
    try {
      await pollCoin(mint, state);
    } catch (e) {
      console.warn('Poll failed for', mint, e);
    }
  }
  render();
}

function trackMint(mint) {
  if (!mint || tracked.has(mint) || seen[mint]) return;
  tracked.set(mint, {
    firstPrice: null, peakPrice: null, polls: 0, consecutive: 0,
    rugcheck: null, deadline: Date.now() + CONFIG.MONITOR_WINDOW_MINUTES * 60 * 1000,
    result: null, drawdown: 0, alerted: false,
  });
  render();
}

function riskText(result) {
  if (!result) return '-';
  const flags = (((result.raw || {}).rugcheck || {}).risks || []);
  if (flags.length) return flags.map((f) => `${f.name} (${f.level})`).join('; ');
  const noReport = (result.reasons || []).some((r) => r.includes('RugCheck has no report'));
  return noReport ? 'no report yet' : 'clean';
}

function render() {
  const tbody = $('results');
  const rows = [...tracked.entries()].map(([mint, s]) => {
    const r = s.result;
    return `<tr><td title="${mint}">${mint.slice(0, 8)}…</td>` +
      `<td><button onclick="copyMint('${mint}')" title="Copy full mint address">Copy</button></td>` +
      `<td>${r ? r.score : '…'}</td>` +
      `<td>${r ? '$' + Math.round(r.liquidity_usd).toLocaleString() : '…'}</td>` +
      `<td>${r ? (r.momentum_pct ?? 0) + '%' : '…'}</td>` +
      `<td>${riskText(r)}</td>` +
      `<td>${s.alerted ? 'alerted' : (s.consecutive + '/' + CONFIG.MIN_POLLS_BEFORE_ALERT)}</td></tr>`;
  });
  tbody.innerHTML = rows.join('') || '<tr><td colspan="7">No coins tracked yet — press Start Monitoring.</td></tr>';
  $('trackedCount').textContent = String(tracked.size);
}

export function startMonitoring() {
  if (pumpHandle) return;
  requestPermissionOnLoad();
  pumpHandle = listenForMigrations(
    (event) => {
      const mint = extractMintAddress(event);
      if (mint) trackMint(mint);
    },
    (status) => { $('wsStatus').textContent = status; },
  );
  pollTimer = setInterval(pollAll, CONFIG.POLL_INTERVAL_SECONDS * 1000);
  $('startBtn').disabled = true;
  $('stopBtn').disabled = false;
  render();
}

export function stopMonitoring() {
  if (pumpHandle) { pumpHandle.stop(); pumpHandle = null; }
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  $('startBtn').disabled = false;
  $('stopBtn').disabled = true;
  $('wsStatus').textContent = 'stopped';
}

export function scanNow() {
  pollAll();
}

// Expose for inline onclick handlers in index.html.
window.startMonitoring = startMonitoring;
window.stopMonitoring = stopMonitoring;
window.scanNow = scanNow;
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts where clipboard API is unavailable.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}
window.copyMint = async (mint) => {
  await copyText(mint);
};
let lastSingleMint = '';
window.copySingle = async () => {
  if (lastSingleMint) await copyText(lastSingleMint);
};
window.scanSingle = async () => {
  const mint = $('mintInput').value.trim();
  if (!mint) return;
  $('singleResult').textContent = 'Scanning…';
  try {
    const { result } = await scanCoin(mint);
    markSeen(mint, result);
    lastSingleMint = mint;
    $('copySingleBtn').disabled = false;
    if (isHighPotential(result)) notifyHighPotential(result);
    $('singleResult').textContent =
      `score ${result.score} | liquidity $${Math.round(result.liquidity_usd).toLocaleString()} | ` +
      `risk: ${riskText(result)} | ${(result.reasons || []).join('; ')}`;
  } catch (e) {
    $('singleResult').textContent = 'Scan failed: ' + e;
  }
};

render();
