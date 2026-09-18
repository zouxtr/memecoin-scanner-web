// Thresholds/weights ported 1:1 from config.py + scoring.py WEIGHTS.
// Do not change values here — mirror the Python backend.
export const CONFIG = {
  POLL_INTERVAL_SECONDS: 60,
  MONITOR_WINDOW_MINUTES: 45,
  MIN_POLLS_BEFORE_ALERT: 3,
  PEAK_DRAWDOWN_STOP_PCT: 10,
  FINAL_CHECK_MAX_DRAWDOWN_PCT: 8,
  MIN_LP_LOCKED_PCT: 50,
  BLOCK_ON_LOW_LIQUIDITY_RISK: true,
  MIN_LIQUIDITY_USD: 15000,
  MAX_INSIDER_CLUSTERS: 10,
  RUGCHECK_REFRESH_EVERY_N_POLLS: 2,
  MAX_MARKET_CAP_USD: 110000,
  EXTENDED_MAX_MARKET_CAP_USD: 500000,
  EXTENDED_ZONE_MIN_LIQUIDITY_USD: 40000,
  MAX_VOLUME_TO_LIQUIDITY_RATIO: 15,
  HIGH_POTENTIAL_THRESHOLD: 65,
  PUMPPORTAL_WS_URL: 'wss://pumpportal.fun/api/data',
};

export const WEIGHTS = {
  liquidity: 20,
  volume: 20,
  momentum: 30,
  no_mint_authority: 10,
  no_freeze_authority: 10,
  low_risk_flags: 10,
};

export const IMPERSONATION_KEYWORDS = (
  'elon,elonmusk,musk,spacex,neuralink,' +
  'trump,donaldtrump,maga,' +
  'biden,joebiden,kamala,kamalaharris,' +
  'obama,barackobama,putin,zelensky,zelenskyy,' +
  'kanye,yeezy,drake,kimkardashian,kardashian,' +
  'messi,ronaldo,neymar,' +
  'mrbeast,' +
  'bezos,jeffbezos,zuckerberg,markzuckerberg,gates,billgates,' +
  'buffett,warrenbuffett,cathiewood,sbf,sambankmanfried,' +
  'taylorswift,beyonce,rihanna,kimjongun,' +
  'vitalik,vitalikbuterin,buterin,satoshi,cz_binance,changpeng,zhao,' +
  'justinsun,tron'
).split(',');

export const IMPERSONATION_LEGITIMACY_WORDS = (
  'official,verified,genuine,authentic,foundation,realaccount,' +
  'confirmed,endorsed,ceo'
).split(',');
