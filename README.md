# Doom Cars — Fin del Mundo

Demo de un juego **friendslop** de carros en 2D (vista desde arriba) para 1-4 jugadores: escapen juntos del fin del mundo mientras el suelo se derrumba detrás de ustedes.

HTML + Canvas + JavaScript puro, sin build ni dependencias (el modo online usa [PeerJS](https://peerjs.com/) desde CDN).

## Cómo jugar

Abre `index.html` en el navegador (doble clic) o sírvelo con cualquier servidor estático:

```bash
python -m http.server 8765
```

En el menú elige:

- **Jugar local**: todos en la misma pantalla (teclado y/o mandos).
- **Crear sala online**: te da un código de 5 letras para compartir.
- **Unirse a sala**: escribe el código de un amigo (o abre el enlace `?sala=CÓDIGO`).

Cada jugador se une pulsando **acelerar** en su control y el host empieza con **Enter / Espacio / Start**.

En el lobby, el host (o el modo local) puede añadir **bots** con **B** y quitarlos con **N**. Los bots conducen solos y juegan todos los eventos.

### Controles

| Jugador | Conducir | Acción (parry / cobrar combo) | Derrape |
|---|---|---|---|
| P1 | W A S D | E | Espacio |
| P2 | Flechas | Shift der. / Ctrl der. | - (o .) |
| P3 | I J K L | O | U |
| P4 | T F G H / Num 8456 | Y / Num 0 | R / Num 7 |
| Mando | Stick / cruceta, RT acelerar, LT frenar | X | RB / LB |

## Mecánicas

- **El colapso**: el suelo se agrieta y cae detrás de ustedes, cada vez más rápido. Quien se queda atrás, cae.
- **Carriles de color**: antes de cada puerta aparecen carriles rectos, separados y en orden al azar; todos deben ir por el suyo a la vez para abrirla.
- **Salto con parry**: el primero planea sobre el abismo; el siguiente lo engancha pulsando ACCIÓN en el momento justo.
- **Rayo**: un carro averiado (más lento y gira mal hacia un lado); los demás lo reparan chocándolo.
- **Cuerda**: dos carros atados 15 s; se traban en los obstáculos.
- **Remolque**: un carro sin motor debe ser jalado hasta la línea de recarga.
- **Derrape y combos**: derrapes, pasadas al límite, roces y aterrizajes suben el multiplicador; ACCIÓN cobra el combo.
- **Revivir**: si alguien cae, aparecen piezas de carro en la pista; al recoger 4 entre todos, los caídos vuelven con 2 s de invulnerabilidad.
- **Sinergia**: los eventos bien hechos llenan una barra compartida que activa el **TURBO** para todos.

## Archivos

- `index.html` — página, menú y estilos.
- `game.js` — todo el juego (simulación, render, sonido sintetizado, protocolo online). Los valores para ajustar la sensación están al inicio.
- `net.js` — conexión P2P con PeerJS (salas, mensajes).
- `IDEAS.md` — banco de ideas y mecánicas pendientes.

## Online

Un jugador hace de **host** (simula la partida) y los demás se conectan por WebRTC. Los clientes usan predicción local con corrección suave para que su carro responda al instante aunque haya ping.
