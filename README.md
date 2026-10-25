# AGÁRRATE · El juego de la montaña rusa

Juego para el navegador (pensado para el móvil en horizontal): dibujas la vía con el dedo, pulsas **¡PROBAR!** y el vagón tiene que llegar a la meta cogiendo las estrellas… sin que los pasajeros vomiten.

Vanilla JS, sin frameworks, sin dependencias y sin paso de compilación. Se publica tal cual en GitHub Pages.

## Cómo se juega

- ✏️ **Vía**: arrastra el dedo para dibujar. Empieza en el círculo verde de la salida. Si un trazo empieza o acaba cerca de otro, se unen solos con una curva suave.
- ⚡ **Turbo** (desde el nivel 5): empuja el vagón en la dirección en la que lo dibujas. Gasta el doble de vía.
- 🧽 **Borrar**: toca un trozo de vía para quitarlo. ↶ deshace el último.
- ⭐ Hay 3 estrellas por nivel. Se pueden coger también volando.
- 🤢 Si una curva es muy cerrada a mucha velocidad, las fuerzas G suben, el medidor de **susto** se llena y los pasajeros vomitan (pierdes).
- 💥 Si la vía se acaba, el vagón sale volando. Para aterrizar bien, la vía de abajo tiene que ir en la misma dirección en la que cae.

En ordenador: `Espacio` probar/parar, `Ctrl+Z` deshacer, `1` `2` `3` herramientas, `Esc` salir.

El progreso (estrellas, niveles desbloqueados y la vía que has dibujado en cada nivel) se guarda en el navegador.

## Estructura

```
index.html        pantallas (menú, niveles, HUD, ventanas)
css/style.css     estilos
js/engine.js      motor: suavizado de trazos, uniones, física del vagón (sin DOM, se puede probar en Node)
js/levels.js      los 10 niveles
js/render.js      dibujado en canvas (fondos, vías, vagón, estrellas, obstáculos)
js/audio.js       sonidos sintetizados con Web Audio (no hay archivos de audio)
js/game.js        pantallas, controles táctiles, partida, guardado
icons/            iconos para "Añadir a pantalla de inicio"
manifest.json     para instalarlo como app
```

## Añadir un nivel

Copia uno de `js/levels.js` y cambia los números. El mundo mide 1600 × 900 y el suelo está en `y = 860` (la `y` crece hacia abajo).

```js
{
  name: 'Mi nivel',
  hint: 'Texto de ayuda que sale al empezar',
  theme: 'day',                 // 'day' | 'sunset' | 'night'
  start: [[30, 250], [250, 250]],  // estación de salida
  goal: [[1320, 640], [1560, 640]], // meta
  startSpeed: 160,              // velocidad con la que sale el vagón
  budget: 2000,                 // vía disponible (40 = 1 metro)
  stars: [[520, 400], [860, 560], [1160, 630]],
  obstacles: [
    { type: 'rock', shape: 'rect', x: 720, y: 330, w: 140, h: 530 }, // roca: no se construye y se choca
    { type: 'zone', shape: 'rect', x: 640, y: 0, w: 260, h: 860 },   // zona roja: no se construye, se puede saltar
    { type: 'rock', shape: 'circle', x: 640, y: 560, r: 90 }
  ]
}
```

Ajustes de física (gravedad, rozamiento, potencia del turbo, límite de G…) arriba del todo en `js/engine.js`.

## Probar en local

```
python3 -m http.server
```

y abre `http://localhost:8000`.
