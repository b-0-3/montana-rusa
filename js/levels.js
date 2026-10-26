/* =========================================================
   AGÁRRATE 3D · Retos
   Objetivos posibles (k):
     speed  velocidad máxima ≥ v km/h      inv    vueltas boca abajo ≥ v
     air    tiempo flotando ≥ v segundos   exc    emoción ≥ v
     lat    fuerza lateral máxima ≤ v G     vert   fuerza vertical máxima ≤ v G
     nausea mareo ≤ v                      turn   grados de curva ≥ v
     height altura ≥ v m                   finish terminar el viaje
   Para ganar estrellas el tren tiene que llegar a la meta sin que nadie vomite.
   ========================================================= */

export const LEVELS = [
  {
    name: 'Primera montaña',
    intro: 'Activa la ⛓ cadena, sube la vía, déjate caer y termina con unos 🛑 frenos y la 🏁 meta.',
    tip: 'Truco: con la cadena puesta, todas las piezas que añadas suben el tren solas.',
    objectives: [{ k: 'finish' }, { k: 'speed', v: 60 }, { k: 'exc', v: 3.5 }]
  },
  {
    name: 'Curvas con peralte',
    intro: 'En una curva el tren empuja a la gente hacia fuera. El peralte inclina la vía hacia dentro para que no se estampen contra el lateral.',
    tip: 'Con el peralte en AUTO el juego calcula la inclinación perfecta según la velocidad.',
    objectives: [{ k: 'turn', v: 360 }, { k: 'lat', v: 1.0 }, { k: 'nausea', v: 2.5 }]
  },
  {
    name: 'Tu primer looping',
    intro: 'Un looping necesita velocidad: entra a unos 80–100 km/h. Si vas lento, el tren no llega arriba. Si vas muy rápido, la gente aguanta demasiadas G.',
    tip: 'Antes del looping la vía tiene que estar plana: termina la bajada con piezas de "Subir".',
    objectives: [{ k: 'inv', v: 1 }, { k: 'vert', v: 5 }, { k: 'exc', v: 5.5 }]
  },
  {
    name: 'A toda pastilla',
    intro: 'Cuanto más alta la caída, más velocidad. El turbo ⚡ también ayuda. Pero ojo con frenar a tiempo.',
    tip: 'A mucha velocidad las curvas cerradas aplastan a la gente: usa curvas amplias o frenos.',
    objectives: [{ k: 'speed', v: 90 }, { k: 'speed', v: 110 }, { k: 'speed', v: 125 }]
  },
  {
    name: 'Flotando',
    intro: 'El "airtime" es esa sensación de que te levantas del asiento al pasar por encima de una colina rápida.',
    tip: 'Haz colinas: Subir, Subir, Bajar, Bajar… La parte de arriba de cada colina es donde se flota.',
    objectives: [{ k: 'air', v: 1.5 }, { k: 'air', v: 3 }, { k: 'nausea', v: 4 }]
  },
  {
    name: 'Patas arriba',
    intro: 'Loopings y tirabuzones: cada uno es una vuelta boca abajo.',
    tip: 'El tirabuzón no necesita tanta velocidad como el looping.',
    objectives: [{ k: 'inv', v: 3 }, { k: 'inv', v: 5 }, { k: 'exc', v: 7 }]
  },
  {
    name: 'Con poco dinero',
    intro: 'Solo tienes 24 piezas. Haz la montaña rusa más emocionante que puedas con ellas.',
    tip: 'Las piezas largas (looping, curvas amplias) dan mucho juego por una sola pieza.',
    budget: 24,
    objectives: [{ k: 'finish' }, { k: 'exc', v: 5 }, { k: 'exc', v: 6.2 }]
  },
  {
    name: 'El bosque',
    intro: 'Hay árboles por todas partes. Esquívalos y monta algo espectacular.',
    tip: 'Si una pieza no cabe, el juego te enseña en rojo dónde chocaría.',
    obstacles: [
      { x: -14, z: 62, r: 4, h: 16 }, { x: 0, z: 70, r: 5, h: 18 }, { x: 14, z: 64, r: 4, h: 15 },
      { x: 28, z: 74, r: 5, h: 17 }, { x: -28, z: 76, r: 5, h: 17 }, { x: 40, z: 40, r: 5, h: 16 },
      { x: -40, z: 34, r: 5, h: 18 }, { x: 55, z: 90, r: 6, h: 19 }, { x: -55, z: 92, r: 6, h: 19 },
      { x: 20, z: 110, r: 5, h: 16 }, { x: -20, z: 112, r: 5, h: 16 }, { x: 70, z: 30, r: 5, h: 15 }
    ],
    objectives: [{ k: 'finish' }, { k: 'inv', v: 2 }, { k: 'exc', v: 6.5 }]
  }
];

export function objectiveText(o) {
  switch (o.k) {
    case 'finish': return 'Llegar a la meta';
    case 'speed': return `Llegar a ${o.v} km/h`;
    case 'inv': return o.v === 1 ? 'Dar 1 vuelta boca abajo' : `Dar ${o.v} vueltas boca abajo`;
    case 'air': return `Flotar ${String(o.v).replace('.', ',')} s en total`;
    case 'exc': return `Emoción de ${String(o.v).replace('.', ',')} o más`;
    case 'lat': return `Fuerza lateral máx. ${String(o.v).replace('.', ',')} G`;
    case 'vert': return `Fuerza vertical máx. ${o.v} G`;
    case 'nausea': return `Mareo de ${String(o.v).replace('.', ',')} o menos`;
    case 'turn': return `Girar ${o.v}° en total`;
    case 'height': return `Subir a ${o.v} m`;
    default: return '?';
  }
}

// ¿Se cumple un objetivo? (res = resultado del viaje)
export function objectiveMet(o, res) {
  if (!res.ok) return false;
  const s = res.stats, m = res.metrics, r = res.ratings;
  switch (o.k) {
    case 'finish': return true;
    case 'speed': return s.maxV * 3.6 >= o.v;
    case 'inv': return s.inversions >= o.v;
    case 'air': return s.airtime >= o.v;
    case 'exc': return r.excitement >= o.v;
    case 'lat': return s.maxLat <= o.v;
    case 'vert': return s.maxVert <= o.v;
    case 'nausea': return r.nausea <= o.v;
    case 'turn': return m.turn >= o.v;
    case 'height': return m.maxY >= o.v;
    default: return false;
  }
}

// Progreso hacia un objetivo (para mostrarlo)
export function objectiveValue(o, res) {
  const s = res.stats, m = res.metrics, r = res.ratings;
  switch (o.k) {
    case 'speed': return Math.round(s.maxV * 3.6) + ' km/h';
    case 'inv': return s.inversions;
    case 'air': return s.airtime.toFixed(1).replace('.', ',') + ' s';
    case 'exc': return r.excitement.toFixed(1).replace('.', ',');
    case 'lat': return s.maxLat.toFixed(2).replace('.', ',') + ' G';
    case 'vert': return s.maxVert.toFixed(1).replace('.', ',') + ' G';
    case 'nausea': return r.nausea.toFixed(1).replace('.', ',');
    case 'turn': return m.turn + '°';
    case 'height': return Math.round(m.maxY) + ' m';
    default: return '';
  }
}
