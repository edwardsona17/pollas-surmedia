// netlify/functions/sync-results.js
// Corre cada 5 minutos — usa football-data.org (key válido)

const { schedule } = require("@netlify/functions");

const FD_URL    = 'https://api.football-data.org/v4/competitions/WC/matches';
const FD_TOKEN  = 'db3354148ed54c5a9fcc290f5eddfe44';
const FB_DB_URL = 'https://surmediapolla-default-rtdb.firebaseio.com';

async function fbRead(path) {
  const r = await fetch(`${FB_DB_URL}${path}.json?auth=${process.env.FIREBASE_SECRET}`);
  if (!r.ok) { console.error('FB read error:', r.status); return null; }
  return r.json();
}

async function fbPatch(path, data) {
  const r = await fetch(`${FB_DB_URL}${path}.json?auth=${process.env.FIREBASE_SECRET}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!r.ok) console.error('FB write error:', r.status, await r.text());
  return r.ok;
}

// Mapeo nombre API → código interno
const NAME_TO_CODE = {
  'Switzerland':'SUI','Canada':'CAN','Bosnia and Herzegovina':'BIH','Qatar':'QAT',
  'Morocco':'MAR','Haiti':'HTI','Scotland':'SCO','Brazil':'BRA',
  'South Africa':'RSA','Korea Republic':'KOR','Czechia':'CZE','Mexico':'MEX',
  'Ecuador':'ECU','Germany':'GER','Curacao':'CUW','Ivory Coast':'CIV',
  'Tunisia':'TUN','Netherlands':'NED','Japan':'JPN','Sweden':'SWE',
  'Turkiye':'TUR','USA':'USA','Paraguay':'PAR','Australia':'AUS',
  'Norway':'NOR','France':'FRA','Senegal':'SEN','Iraq':'IRQ',
  'Cape Verde':'CPV','Saudi Arabia':'KSA','Uruguay':'URU','Spain':'ESP',
  'New Zealand':'NZL','Belgium':'BEL','Egypt':'EGY','Iran':'IRN',
  'Panama':'PAN','England':'ENG','Croatia':'CRO','Ghana':'GHA',
  'Colombia':'COL','DR Congo':'COD','Jordan':'JOR','Algeria':'DZA',
  'Argentina':'ARG','Austria':'AUT','Portugal':'POR','Uzbekistan':'UZB',
  'Italy':'ITA','Iraq':'IRQ','South Korea':'KOR',
};

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
  // R32 en adelante — TBD por fecha
  {id:'r1',date:'2026-06-28'},{id:'r2',date:'2026-06-29'},{id:'r3',date:'2026-06-29'},
  {id:'r4',date:'2026-06-29'},{id:'r5',date:'2026-06-30'},{id:'r6',date:'2026-06-30'},
  {id:'r7',date:'2026-06-30'},{id:'r8',date:'2026-07-01'},{id:'r9',date:'2026-07-01'},
  {id:'r10',date:'2026-07-01'},{id:'r11',date:'2026-07-02'},{id:'r12',date:'2026-07-02'},
  {id:'r13',date:'2026-07-02'},{id:'r14',date:'2026-07-03'},{id:'r15',date:'2026-07-03'},
  {id:'r16',date:'2026-07-03'},{id:'ro16_1',date:'2026-07-04'},{id:'ro16_2',date:'2026-07-04'},
  {id:'ro16_3',date:'2026-07-05'},{id:'ro16_4',date:'2026-07-05'},{id:'ro16_5',date:'2026-07-06'},
  {id:'ro16_6',date:'2026-07-06'},{id:'ro16_7',date:'2026-07-07'},{id:'ro16_8',date:'2026-07-07'},
  {id:'qf1',date:'2026-07-09'},{id:'qf2',date:'2026-07-10'},
  {id:'qf3',date:'2026-07-11'},{id:'qf4',date:'2026-07-11'},
  {id:'sf1',date:'2026-07-14'},{id:'sf2',date:'2026-07-15'},
  {id:'third',date:'2026-07-18'},{id:'final',date:'2026-07-19'},
];

const handler = async () => {
  console.log('[SYNC] Iniciando', new Date().toISOString());

  try {
    const r = await fetch(FD_URL, { headers: { 'X-Auth-Token': FD_TOKEN } });
    if (!r.ok) { console.error('[SYNC] FD error:', r.status); return { statusCode: 500 }; }
    const json = await r.json();
    const games = json.matches || [];
    console.log('[SYNC] Partidos recibidos:', games.length);

    const currentResults  = await fbRead('/results')  || {};
    const currentResolved = await fbRead('/resolved') || {};
    const newResults  = { ...currentResults };
    const newResolved = { ...currentResolved };
    let changesR = 0, changesT = 0;

    // Partidos con TBD pendientes por fecha
    const tbdByDate = {};
    MATCHES.filter(m => m.date && !m.home).forEach(m => {
      if (!tbdByDate[m.date]) tbdByDate[m.date] = [];
      tbdByDate[m.date].push(m.id);
    });

    games.forEach(g => {
      const status   = (g.status || '').toUpperCase();
      const isDone   = status === 'FINISHED';
      const homeCode = NAME_TO_CODE[g.homeTeam?.name] || g.homeTeam?.tla;
      const awayCode = NAME_TO_CODE[g.awayTeam?.name] || g.awayTeam?.tla;
      if (!homeCode || !awayCode) return;

      // Buscar partido conocido
      const local = MATCHES.find(m => m.home === homeCode && m.away === awayCode);

      if (local && isDone) {
        const h = g.score?.fullTime?.home ?? null;
        const a = g.score?.fullTime?.away ?? null;
        if (h !== null && a !== null) {
          if (!newResults[local.id] || newResults[local.id].h !== h || newResults[local.id].a !== a) {
            newResults[local.id] = { h, a };
            changesR++;
            console.log(`[RESULT] ${homeCode} ${h}-${a} ${awayCode}`);
          }
        }
      }

      // Resolver TBD por fecha
      if (!local) {
        const matchDate = (g.utcDate || '').slice(0, 10);
        const tbdIds = tbdByDate[matchDate];
        if (tbdIds && tbdIds.length > 0) {
          const tbdId = tbdIds.find(id => !newResolved[id]);
          if (tbdId && homeCode) {
            newResolved[tbdId] = { home: homeCode, away: awayCode };
            changesT++;
            console.log(`[TBD] ${tbdId} → ${homeCode} vs ${awayCode}`);
          }
        }
      }
    });

    if (changesR > 0) {
      await fbPatch('/results', newResults);
      console.log(`[SYNC] ${changesR} resultados guardados en Firebase`);
    }
    if (changesT > 0) {
      await fbPatch('/resolved', newResolved);
      console.log(`[SYNC] ${changesT} llaves TBD resueltas`);
    }
    if (!changesR && !changesT) console.log('[SYNC] Sin cambios');

    return { statusCode: 200 };
  } catch (err) {
    console.error('[SYNC] Error:', err.message);
    return { statusCode: 500 };
  }
};

module.exports.handler = schedule('*/5 * * * *', handler);
