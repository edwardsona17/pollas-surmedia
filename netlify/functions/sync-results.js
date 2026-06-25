// netlify/functions/sync-results.js
// Corre cada 5 minutos — obtiene resultados de la API y los guarda en Firebase

const { schedule } = require("@netlify/functions");

const WC_API_URL = 'https://api.wc2026api.com/matches';
const WC_API_KEY = 'wc26_XJsEmktVGmU3Y5R1bY7fJ3';
const FB_DB_URL  = 'https://surmediapolla-default-rtdb.firebaseio.com';

// Firebase REST API helpers
async function fbRead(path) {
  const secret = process.env.FIREBASE_SECRET;
  const r = await fetch(`${FB_DB_URL}${path}.json?auth=${secret}`);
  if (!r.ok) { console.error('Firebase read error:', r.status); return null; }
  return r.json();
}

async function fbPatch(path, data) {
  const secret = process.env.FIREBASE_SECRET;
  const r = await fetch(`${FB_DB_URL}${path}.json?auth=${secret}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!r.ok) console.error('Firebase write error:', r.status, await r.text());
  return r.ok;
}

// Partidos del torneo (home/away = códigos exactos de la API)
const MATCHES = [
  {id:'g24a',home:'SUI',away:'CAN'},{id:'g24b',home:'BIH',away:'QAT'},
  {id:'g24c',home:'MAR',away:'HTI'},{id:'g24d',home:'SCO',away:'BRA'},
  {id:'g24e',home:'RSA',away:'KOR'},{id:'g24f',home:'CZE',away:'MEX'},
  {id:'g25c',home:'ECU',away:'GER'},{id:'g25d',home:'CUW',away:'CIV'},
  {id:'g25e',home:'TUN',away:'NED'},{id:'g25f',home:'JPN',away:'SWE'},
  {id:'g25a',home:'TUR',away:'USA'},{id:'g25b',home:'PAR',away:'AUS'},
  {id:'g26e',home:'NOR',away:'FRA'},{id:'g26f',home:'SEN',away:'IRQ'},
  {id:'g26c',home:'CPV',away:'KSA'},{id:'g26d',home:'URU',away:'ESP'},
  {id:'g26a',home:'NZL',away:'BEL'},{id:'g26b',home:'EGY',away:'IRN'},
  {id:'g27e',home:'PAN',away:'ENG'},{id:'g27f',home:'CRO',away:'GHA'},
  {id:'g27c',home:'COL',away:'POR'},{id:'g27d',home:'COD',away:'UZB'},
  {id:'g27a',home:'JOR',away:'ARG'},{id:'g27b',home:'DZA',away:'AUT'},
  // R32 en adelante son TBD — se resuelven por fecha
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

const DONE_STATUS = ['final','completed','finished','ft','ft_pen','full-time'];

const handler = async () => {
  console.log('[SYNC] Iniciando', new Date().toISOString());

  if (!process.env.FIREBASE_SECRET) {
    console.error('[SYNC] FIREBASE_SECRET no configurado');
    return { statusCode: 500 };
  }

  try {
    // 1. Obtener datos de la API
    const r = await fetch(WC_API_URL, {
      headers: { Authorization: `Bearer ${WC_API_KEY}` }
    });
    if (!r.ok) { console.error('[SYNC] API error:', r.status); return { statusCode: 500 }; }
    const json = await r.json();
    const games = json.games || json.matches || json.data || [];
    console.log('[SYNC] Partidos recibidos:', games.length);

    // 2. Leer estado actual de Firebase
    const currentResults  = await fbRead('/results')  || {};
    const currentResolved = await fbRead('/resolved') || {};

    const newResults  = { ...currentResults };
    const newResolved = { ...currentResolved };
    let changesR = 0, changesT = 0;

    games.forEach(g => {
      const status   = (g.status || '').toLowerCase();
      const isDone   = DONE_STATUS.some(s => status === s || status === s.replace('-','_'));
      const homeCode = g.home || g.home_team;
      const awayCode = g.away || g.away_team;
      if (!homeCode || !awayCode) return;

      // Buscar en partidos conocidos (no TBD)
      const local = MATCHES.find(m =>
        !m.home.startsWith('TBD') &&
        m.home === homeCode &&
        m.away === awayCode
      );

      if (local && isDone && g.score) {
        const h = g.score[homeCode] ?? null;
        const a = g.score[awayCode] ?? null;
        if (h !== null && a !== null) {
          if (!newResults[local.id] || newResults[local.id].h !== h || newResults[local.id].a !== a) {
            newResults[local.id] = { h, a };
            changesR++;
            console.log(`[RESULT] ${homeCode} ${h}-${a} ${awayCode}`);
          }
        }
      }

      // Resolver llaves TBD por fecha
      if (!local && homeCode && !homeCode.startsWith('TBD')) {
        const matchDate = (g.start_time || g.date || '').slice(0, 10);
        const tbd = MATCHES.find(m =>
          m.home.startsWith('TBD') &&
          m.date === matchDate &&
          !newResolved[m.id]
        );
        if (tbd) {
          newResolved[tbd.id] = { home: homeCode, away: awayCode };
          changesT++;
          console.log(`[TBD] ${tbd.id} → ${homeCode} vs ${awayCode}`);
        }
      }
    });

    // 3. Guardar en Firebase solo si hay cambios
    if (changesR > 0) {
      const ok = await fbPatch('/results', newResults);
      console.log(`[SYNC] ${changesR} resultados → Firebase: ${ok ? 'OK' : 'ERROR'}`);
    }
    if (changesT > 0) {
      const ok = await fbPatch('/resolved', newResolved);
      console.log(`[SYNC] ${changesT} llaves TBD → Firebase: ${ok ? 'OK' : 'ERROR'}`);
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

module.exports.handler = schedule('*/5 * * * *', handler);
