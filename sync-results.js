// netlify/functions/sync-results.js
// Se ejecuta automáticamente cada 5 minutos via Netlify Scheduled Functions
// Obtiene resultados reales de la API y los guarda en Firebase
// Los usuarios ven los cambios en tiempo real sin hacer nada

const schedule = require("@netlify/functions").schedule;

// ── Config ──────────────────────────────────────────────────────
const WC_API_URL   = 'https://api.wc2026api.com/matches';
const WC_API_KEY   = 'wc26_XJsEmktVGmU3Y5R1bY7fJ3';
const FB_DB_URL    = 'https://surmediapolla-default-rtdb.firebaseio.com';
const FB_SECRET    = process.env.FIREBASE_SECRET; // Variable de entorno en Netlify

// ── Helpers Firebase REST API ────────────────────────────────────
async function fbRead(path) {
  const r = await fetch(`${FB_DB_URL}${path}.json?auth=${FB_SECRET}`);
  return r.ok ? r.json() : null;
}
async function fbWrite(path, data) {
  await fetch(`${FB_DB_URL}${path}.json?auth=${FB_SECRET}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

// ── Mapa de partidos (igual que en el frontend) ──────────────────
const MATCHES = [
  {id:'g24a',date:'2026-06-24',home:'SUI',away:'CAN'},
  {id:'g24b',date:'2026-06-24',home:'BIH',away:'QAT'},
  {id:'g24c',date:'2026-06-24',home:'MAR',away:'HTI'},
  {id:'g24d',date:'2026-06-24',home:'SCO',away:'BRA'},
  {id:'g24e',date:'2026-06-24',home:'RSA',away:'KOR'},
  {id:'g24f',date:'2026-06-24',home:'CZE',away:'MEX'},
  {id:'g25c',date:'2026-06-25',home:'ECU',away:'GER'},
  {id:'g25d',date:'2026-06-25',home:'CUW',away:'CIV'},
  {id:'g25e',date:'2026-06-25',home:'TUN',away:'NED'},
  {id:'g25f',date:'2026-06-25',home:'JPN',away:'SWE'},
  {id:'g25a',date:'2026-06-25',home:'TUR',away:'USA'},
  {id:'g25b',date:'2026-06-25',home:'PAR',away:'AUS'},
  {id:'g26e',date:'2026-06-26',home:'NOR',away:'FRA'},
  {id:'g26f',date:'2026-06-26',home:'SEN',away:'IRQ'},
  {id:'g26c',date:'2026-06-26',home:'CPV',away:'KSA'},
  {id:'g26d',date:'2026-06-26',home:'URU',away:'ESP'},
  {id:'g26a',date:'2026-06-26',home:'NZL',away:'BEL'},
  {id:'g26b',date:'2026-06-26',home:'EGY',away:'IRN'},
  {id:'g27e',date:'2026-06-27',home:'PAN',away:'ENG'},
  {id:'g27f',date:'2026-06-27',home:'CRO',away:'GHA'},
  {id:'g27c',date:'2026-06-27',home:'COL',away:'POR'},
  {id:'g27d',date:'2026-06-27',home:'COD',away:'UZB'},
  {id:'g27a',date:'2026-06-27',home:'JOR',away:'ARG'},
  {id:'g27b',date:'2026-06-27',home:'DZA',away:'AUT'},
  {id:'g28c',date:'2026-06-28',home:'SUI',away:'CAN'},
  {id:'g28d',date:'2026-06-28',home:'BIH',away:'QAT'},
  {id:'g28e',date:'2026-06-28',home:'SCO',away:'BRA'},
  {id:'g28f',date:'2026-06-28',home:'MAR',away:'HTI'},
  {id:'g28a',date:'2026-06-28',home:'MEX',away:'CZE'},
  {id:'g28b',date:'2026-06-28',home:'KOR',away:'RSA'},
  // R32 - TBD se llenan automáticamente
  {id:'r1',date:'2026-06-28',home:'TBD',away:'TBD'},
  {id:'r2',date:'2026-06-29',home:'TBD',away:'TBD'},
  {id:'r3',date:'2026-06-29',home:'TBD',away:'TBD'},
  {id:'r4',date:'2026-06-29',home:'TBD',away:'TBD'},
  {id:'r5',date:'2026-06-30',home:'TBD',away:'TBD'},
  {id:'r6',date:'2026-06-30',home:'TBD',away:'TBD'},
  {id:'r7',date:'2026-06-30',home:'TBD',away:'TBD'},
  {id:'r8',date:'2026-07-01',home:'TBD',away:'TBD'},
  {id:'r9',date:'2026-07-01',home:'TBD',away:'TBD'},
  {id:'r10',date:'2026-07-01',home:'TBD',away:'TBD'},
  {id:'r11',date:'2026-07-02',home:'TBD',away:'TBD'},
  {id:'r12',date:'2026-07-02',home:'TBD',away:'TBD'},
  {id:'r13',date:'2026-07-02',home:'TBD',away:'TBD'},
  {id:'r14',date:'2026-07-03',home:'TBD',away:'TBD'},
  {id:'r15',date:'2026-07-03',home:'TBD',away:'TBD'},
  {id:'r16',date:'2026-07-03',home:'TBD',away:'TBD'},
  {id:'ro16_1',date:'2026-07-04',home:'TBD',away:'TBD'},
  {id:'ro16_2',date:'2026-07-04',home:'TBD',away:'TBD'},
  {id:'ro16_3',date:'2026-07-05',home:'TBD',away:'TBD'},
  {id:'ro16_4',date:'2026-07-05',home:'TBD',away:'TBD'},
  {id:'ro16_5',date:'2026-07-06',home:'TBD',away:'TBD'},
  {id:'ro16_6',date:'2026-07-06',home:'TBD',away:'TBD'},
  {id:'ro16_7',date:'2026-07-07',home:'TBD',away:'TBD'},
  {id:'ro16_8',date:'2026-07-07',home:'TBD',away:'TBD'},
  {id:'qf1',date:'2026-07-09',home:'TBD',away:'TBD'},
  {id:'qf2',date:'2026-07-10',home:'TBD',away:'TBD'},
  {id:'qf3',date:'2026-07-11',home:'TBD',away:'TBD'},
  {id:'qf4',date:'2026-07-11',home:'TBD',away:'TBD'},
  {id:'sf1',date:'2026-07-14',home:'TBD',away:'TBD'},
  {id:'sf2',date:'2026-07-15',home:'TBD',away:'TBD'},
  {id:'third',date:'2026-07-18',home:'TBD',away:'TBD'},
  {id:'final',date:'2026-07-19',home:'TBD',away:'TBD'},
];

// ── Handler principal ────────────────────────────────────────────
const handler = async () => {
  console.log('[SYNC] Iniciando sync de resultados', new Date().toISOString());

  try {
    // 1. Obtener resultados de la API
    const r = await fetch(WC_API_URL, {
      headers: { Authorization: `Bearer ${WC_API_KEY}` }
    });
    if (!r.ok) {
      console.error('[SYNC] API error:', r.status);
      return { statusCode: 500 };
    }
    const json = await r.json();
    const games = json.games || json.matches || json.data || [];
    console.log('[SYNC] Partidos recibidos:', games.length);

    // 2. Leer estado actual de Firebase
    const currentResults  = await fbRead('/results')  || {};
    const currentResolved = await fbRead('/resolved') || {};

    const newResults  = { ...currentResults };
    const newResolved = { ...currentResolved };
    let changesR = 0, changesT = 0;

    const DONE = ['completed', 'finished', 'ft', 'ft_pen'];
    // Note: 'final' removed to avoid matching match ID 'final'
    // API uses status exactly: check for equality not includes()

    games.forEach(g => {
      const status   = (g.status || '').toLowerCase();
      // Only mark as done if status is exactly a finished state
      const isDone = status === 'final' || 
                     status === 'completed' || 
                     status === 'finished' ||
                     status === 'ft' ||
                     status === 'ft_pen' ||
                     status === 'full-time';
      // Skip if match is in progress or scheduled
      if(status === 'in_progress' || status === 'scheduled' || status === 'live') return;
      const homeCode = g.home || g.home_team;
      const awayCode = g.away || g.away_team;
      if (!homeCode || !awayCode) return;

      // Buscar partido conocido
      const local = MATCHES.find(m =>
        !m.home.startsWith('TBD') &&
        m.home === homeCode &&
        m.away === awayCode
      );

      if (local && isDone && g.score) {
        const h = g.score[homeCode] ?? null;
        const a = g.score[awayCode] ?? null;
        if (h != null && a != null) {
          const key = local.id;
          if (!newResults[key] || newResults[key].h !== h || newResults[key].a !== a) {
            newResults[key] = { h, a };
            changesR++;
            console.log(`[RESULT] ${homeCode} ${h}-${a} ${awayCode}`);
          }
        }
      }

      // Resolver llaves TBD
      if (!local) {
        const matchDate = (g.start_time || g.date || '').slice(0, 10);
        const tbd = MATCHES.find(m =>
          m.home.startsWith('TBD') &&
          m.date === matchDate &&
          !newResolved[m.id]
        );
        if (tbd && homeCode && !homeCode.startsWith('TBD')) {
          newResolved[tbd.id] = { home: homeCode, away: awayCode };
          changesT++;
          console.log(`[TBD] ${tbd.id} → ${homeCode} vs ${awayCode}`);
        }
      }
    });

    // 3. Guardar en Firebase solo si hay cambios
    if (changesR > 0) {
      await fbWrite('/results', newResults);
      console.log(`[SYNC] ${changesR} resultados actualizados en Firebase`);
    }
    if (changesT > 0) {
      await fbWrite('/resolved', newResolved);
      console.log(`[SYNC] ${changesT} llaves TBD resueltas en Firebase`);
    }
    if (changesR === 0 && changesT === 0) {
      console.log('[SYNC] Sin cambios');
    }

    return { statusCode: 200 };

  } catch (err) {
    console.error('[SYNC] Error:', err.message);
    return { statusCode: 500 };
  }
};

// Ejecutar cada 5 minutos
module.exports.handler = schedule('*/5 * * * *', handler);
