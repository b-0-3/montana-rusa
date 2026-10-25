/* =========================================================
   AGÁRRATE · Niveles
   Mundo de 1600 x 900. El suelo está en y = 860.
   start/goal: puntos de la estación de salida y de la meta.
   obstacles: rock = roca (no se puede construir y si chocas, adiós)
              zone = zona protegida (no se puede construir, pero se puede saltar)
   ========================================================= */
(function (root) {
  'use strict';

  const LEVELS = [
    {
      name: 'Primer viaje',
      hint: 'Dibuja con el dedo una vía desde el final de la estación hasta la meta 🏁. Pasa por las estrellas.',
      theme: 'day',
      start: [[30, 250], [250, 250]],
      goal: [[1320, 640], [1560, 640]],
      startSpeed: 160,
      budget: 2000,
      stars: [[520, 400], [860, 560], [1160, 630]],
      obstacles: []
    },
    {
      name: 'Valle',
      hint: 'La meta está casi a tu altura. Si bajas mucho, ¿llegarás a subir? La velocidad de bajada te empuja hacia arriba.',
      theme: 'day',
      start: [[30, 280], [250, 280]],
      goal: [[1340, 360], [1570, 360]],
      startSpeed: 200,
      budget: 2100,
      stars: [[540, 600], [800, 740], [1080, 560]],
      obstacles: []
    },
    {
      name: 'El barranco',
      hint: 'En la zona roja no se puede construir. Haz una rampa y ¡salta! Para aterrizar bien, la vía del otro lado tiene que ir en la misma dirección que el vagón.',
      theme: 'sunset',
      start: [[30, 280], [250, 280]],
      goal: [[1260, 560], [1560, 560]],
      startSpeed: 180,
      budget: 2000,
      stars: [[470, 585], [770, 420], [1100, 550]],
      obstacles: [{ type: 'zone', shape: 'rect', x: 640, y: 0, w: 260, h: 860 }]
    },
    {
      name: 'El looping',
      hint: 'Una estrella está muy arriba en medio del camino. Prueba a dibujar un looping. Ojo: si la curva es muy cerrada, las fuerzas G marean a los pasajeros.',
      theme: 'day',
      start: [[30, 200], [250, 200]],
      goal: [[1320, 660], [1560, 660]],
      startSpeed: 180,
      budget: 2700,
      stars: [[560, 620], [820, 330], [1100, 700]],
      obstacles: []
    },
    {
      name: 'Turbo',
      hint: '¡Nueva pieza! El TURBO empuja el vagón en la dirección en la que la dibujas. Gasta el doble de vía.',
      theme: 'sunset',
      unlockBoost: true,
      start: [[30, 640], [250, 640]],
      goal: [[1290, 260], [1560, 260]],
      startSpeed: 170,
      budget: 2300,
      stars: [[560, 700], [900, 480], [1140, 300]],
      obstacles: []
    },
    {
      name: 'El muro',
      hint: 'Hay una roca enorme en medio. Por encima, por debajo no se puede... tú verás cómo.',
      theme: 'day',
      start: [[30, 420], [250, 420]],
      goal: [[1300, 580], [1560, 580]],
      startSpeed: 200,
      budget: 2400,
      stars: [[440, 640], [790, 240], [1120, 520]],
      obstacles: [{ type: 'rock', shape: 'rect', x: 720, y: 330, w: 140, h: 530 }]
    },
    {
      name: 'El túnel',
      hint: 'Mete el vagón por el túnel sin rozar las rocas. Baja con cuidado: si caes muy rápido, la curva del fondo mareará a todos.',
      theme: 'night',
      start: [[30, 200], [250, 200]],
      goal: [[1300, 660], [1560, 660]],
      startSpeed: 160,
      budget: 2300,
      stars: [[640, 500], [940, 470], [1210, 600]],
      obstacles: [
        { type: 'rock', shape: 'rect', x: 520, y: 0, w: 560, h: 380 },
        { type: 'rock', shape: 'rect', x: 520, y: 590, w: 560, h: 270 }
      ]
    },
    {
      name: 'Doble salto',
      hint: 'Dos barrancos seguidos. Construye una isla en el medio para aterrizar y volver a despegar.',
      theme: 'sunset',
      start: [[30, 260], [250, 260]],
      goal: [[1300, 600], [1560, 600]],
      startSpeed: 200,
      budget: 2100,
      stars: [[565, 380], [900, 550], [1075, 470]],
      obstacles: [
        { type: 'zone', shape: 'rect', x: 480, y: 0, w: 170, h: 860 },
        { type: 'zone', shape: 'rect', x: 990, y: 0, w: 170, h: 860 }
      ]
    },
    {
      name: 'Pedruscos',
      hint: 'Rocas flotando por todas partes. Busca el hueco y no choques en el aire.',
      theme: 'night',
      unlockBoost: true,
      start: [[30, 700], [250, 700]],
      goal: [[1320, 300], [1560, 300]],
      startSpeed: 180,
      budget: 2500,
      stars: [[520, 760], [820, 520], [1150, 340]],
      obstacles: [
        { type: 'rock', shape: 'circle', x: 640, y: 560, r: 90 },
        { type: 'rock', shape: 'circle', x: 1000, y: 700, r: 110 },
        { type: 'rock', shape: 'circle', x: 980, y: 260, r: 80 },
        { type: 'rock', shape: 'circle', x: 360, y: 420, r: 70 }
      ]
    },
    {
      name: 'Gran final',
      hint: 'Todo junto: turbo, salto y una estrella en lo alto. Si lo pasas con 3 estrellas, eres ingeniero de montañas rusas.',
      theme: 'night',
      unlockBoost: true,
      start: [[30, 620], [250, 620]],
      goal: [[1330, 500], [1570, 500]],
      startSpeed: 180,
      budget: 2700,
      stars: [[480, 300], [880, 300], [1140, 310]],
      obstacles: [
        { type: 'rock', shape: 'rect', x: 340, y: 480, w: 120, h: 380 },
        { type: 'zone', shape: 'rect', x: 960, y: 0, w: 200, h: 860 }
      ]
    }
  ];

  // El turbo se desbloquea a partir del nivel "Turbo"
  const turboFrom = LEVELS.findIndex(l => l.unlockBoost);
  LEVELS.forEach((l, i) => { l.boost = i >= turboFrom; });

  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
  else root.LEVELS = LEVELS;
})(typeof window !== 'undefined' ? window : globalThis);
