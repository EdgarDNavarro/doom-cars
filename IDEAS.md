# Ideas para Fin del Mundo Cars

Banco de mecánicas para hacerlo más caótico y divertido. Sin tienda ni cosméticos por ahora (solo demo).

Estado: ✅ hecho · 🚧 en curso · 💡 idea

## Ya implementado
- ✅ Colapso que persigue y acelera, cámara compartida, muerte al quedarse atrás
- ✅ Carriles de color antes de cada puerta (todos en su carril a la vez)
- ✅ Zona de salto con parry en cadena (enganche en el aire)
- ✅ Rayo: un carro averiado (lento y gira mal a un lado); se repara a choques
- ✅ Barra de sinergia compartida → TURBO en equipo con efecto de velocidad
- ✅ Indicador de distancia al colapso (número, minimapa y aviso rojo con latido)
- ✅ Multijugador local y online (PeerJS)

## Derrape y trucos
- ✅ **Derrape**: mantener un botón al girar para patinar. Al soltar, mini-turbo según lo largo del derrape (nivel azul / naranja).
- ✅ **Combos**: derrape, pasar al límite junto a otro carro, rozar obstáculos y aterrizar saltos suben el multiplicador (hasta x4). Chocar = combo perdido.
- ✅ **Cobrar combo**: ACCIÓN en el suelo (o solo tras 2 s sin hacer nada); una parte va a la barra de sinergia. Puntos de estilo (★) en el ranking final.
- 💡 **Trucos en el aire**: girar 360° durante el salto del abismo da bonus, pero si giras de más llegas mal colocado al parry.
- 💡 **Rebufo**: ir pegado detrás de otro da un empujón de velocidad. Provoca que todos se peguen y se choquen.

## Nuevos eventos en equipo (time events)
- ✅ **La cuerda**: dos carros atados con una cuerda elástica 15 s. Si uno frena arrastra al otro; si la cuerda pasa a cada lado de un obstáculo, se traban hasta que uno lo rodee. Sobrevivir atados da sinergia.
- 💡 **El puente que se cae**: puente estrecho que se derrumba si hay más de 2 carros encima. Cruzar de uno en uno con el colapso apretando.
- 💡 **Pulsador simultáneo**: botones en el suelo; todos deben pisar el suyo en la misma ventana de 1 s (cuenta atrás en pantalla).
- 💡 **La bomba caliente**: un carro lleva una bomba con temporizador y se la pasa a otro chocándolo. Si explota, sale volando hacia atrás, cerca del colapso. Lo contrario del rayo: chocas para librarte.
- 💡 **Conducción en espejo**: 8 s con los controles invertidos para un jugador al azar (icono visible para que los demás le guíen).
- ✅ **Remolque**: un carro se queda sin motor, amarrado al más cercano, que lo jala hasta una línea de recarga (~70 m). Llegar da sinergia.

## Caos en la carretera
- 💡 **Suelo de hielo**: tramos de poco agarre (combina con el derrape).
- 💡 **Rampas laterales / atajos**: te adelantan, pero si caes mal quedas atrás.
- 💡 **Pinchos o minas que suben y bajan**: obstáculos con ritmo.
- 💡 **Grietas que se adelantan**: el colapso lanza una grieta por delante que abre un agujero (aviso: temblor + línea roja 2 s antes).
- 💡 **Viento lateral**: empuja a todos hacia un lado y terminan amontonados contra la pared.
- 💡 **Meteoritos**: sombras marcan dónde caerán; si te da, te aturde.

## Interacción entre jugadores (traición amistosa)
- 💡 **Bocina de empujón**: onda con cooldown que empuja a los cercanos. Para salvar a alguien… o sacarlo del carril.
- 💡 **El ancla**: el último se engancha al de delante y lo frena. Te salva a ti, condena al otro.
- 💡 **Votación de camino**: bifurcación "corto con abismo" vs "largo y seguro"; gana la mayoría, pero quien quiera puede separarse.
- 💡 **Fantasmas**: quien muere sigue como fantasma y puede soltar un obstáculo pequeño o un empujón de ayuda cada X segundos.

## Escalada y ritmo
- 💡 **Fases del fin del mundo**: cada 500 m cambia el bioma y el caos (lava → hielo → tormenta con más rayos → gravedad baja).
- 💡 **Jefe final**: un gusano gigante u ola que bloquea por delante mientras el colapso aprieta por detrás.
- 💡 **Eventos encadenados**: en fases altas, carriles + rayo + otro evento a la vez.

## Prioridad sugerida para la demo
1. ~~Derrape con combos~~ ✅
2. ~~La cuerda~~ ✅ (y el remolque)
3. La bomba caliente
4. Fantasmas que ayudan o molestan
