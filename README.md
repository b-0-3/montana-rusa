# AGÁRRATE · Constructor de montañas rusas 3D

Juego para el navegador (pensado para el móvil en horizontal). Construyes tu montaña rusa en 3D **pieza a pieza** y luego te montas en primera persona.

Hecho con JavaScript sin frameworks + [Three.js](https://threejs.org) (incluido en `lib/`, no hace falta instalar nada). Se publica tal cual en GitHub Pages.

## Cómo se juega

- 🧩 **Piezas**: recta, curva amplia y cerrada (izquierda/derecha), subir, bajar, looping, tirabuzón (izquierda/derecha), turbo, frenos y meta. Cada pieza encaja perfecta al final de la vía: no hay zigzags.
- ⛓️ **Cadena**: interruptor. Con ella activada, las piezas que pongas suben el tren solas.
- 📐 **Peralte**: inclina la vía. En **AUTO** el juego simula el tren, mira a qué velocidad llegará a la curva y le pone la inclinación justa para que no haya fuerza lateral. También puedes elegir 0°, 30° o 60° a cada lado.
- 🔴 Si una pieza no cabe (se mete en el suelo, choca con otra parte de la vía o con un árbol), te la enseña en rojo y te dice por qué.
- 🚀 Arriba ves la longitud, la altura y a qué velocidad llegará el tren al final de lo que llevas construido.
- ▶ **MONTAR**: cámara en primera fila, detrás del tren o libre (🎥). Medidores de velocidad, G vertical, G lateral y "susto".
- 🤢 Si las fuerzas G se pasan (curvas sin peralte, loopings demasiado rápidos, bajadas que acaban de golpe) los pasajeros vomitan.
- 📊 Al terminar: notas de **emoción, intensidad y mareo** (0–10) y estadísticas.

### Modos

- **Retos**: 8 niveles con 3 objetivos cada uno (velocidad, vueltas boca abajo, airtime, fuerzas G, emoción, presupuesto de piezas, bosque con árboles…).
- **Modo libre**: construye lo que quieras. Guarda tu récord de emoción y puedes cambiar el color de la vía.

Todo (vías, estrellas, récords) se guarda en el navegador.

## Estructura

```
index.html        pantallas y HUD
css/style.css     estilos
js/track.js       piezas, peralte, choques (sin dependencias, se puede probar en Node)
js/physics.js     física del tren, fuerzas G medidas en el pecho del pasajero, notas
js/levels.js      retos y objetivos
js/scene.js       todo lo 3D (Three.js): vías, soportes, estaciones, tren, cámaras
js/audio.js       sonidos sintetizados (sin archivos de audio)
js/main.js        menús, construcción, viaje, resultados, guardado
lib/              Three.js y OrbitControls
```

## Añadir un reto

En `js/levels.js`:

```js
{
  name: 'Mi reto',
  intro: 'Texto que sale al empezar',
  tip: 'Pista',
  budget: 20,                                   // opcional: máximo de piezas
  obstacles: [{ x: 0, z: 70, r: 5, h: 18 }],    // opcional: árboles (x, z, radio, altura)
  objectives: [{ k: 'speed', v: 100 }, { k: 'inv', v: 2 }, { k: 'exc', v: 6 }]
}
```

Tipos de objetivo: `finish`, `speed` (km/h), `inv` (vueltas), `air` (segundos), `exc` (emoción), `lat` / `vert` (G máximas), `nausea`, `turn` (grados), `height` (metros).

## Probar en local

```
python3 -m http.server
```

y abre `http://localhost:8000`. Con `?ts=5` en la URL el viaje va 5 veces más rápido (útil para probar).
