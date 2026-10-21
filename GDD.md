# Doom Cars — Documento de diseño y bitácora para la migración a 3D

> Documento de referencia de la demo web (HTML + Canvas + JS) tal como está hoy, pensado para reconstruir el juego en **3D** en Unity o Godot. Describe qué hace cada mecánica, con qué números y por qué, y recoge las lecciones aprendidas durante el desarrollo de la demo.
>
> El código fuente de referencia es `game.js` (juego) y `net.js` (red). Los valores de este documento son los del código en el momento de escribirlo; si se cambian allí, actualizar aquí.

---

## 1. Concepto

**Género:** *friendslop* cooperativo-caótico de carros para **1-4 jugadores**, local u online.

**Pitch:** el mundo se está acabando y el suelo se derrumba detrás de ustedes. Cada uno conduce un carro y el grupo tiene que huir hacia delante por una carretera infinita. Por el camino aparecen eventos que **obligan a coordinarse** (ir cada uno por su carril, engancharse en el aire, remolcar al que se quedó sin motor…). Coordinarse bien llena una barra compartida que da **turbo a todos**. Empujarse, fallar y caerse es parte de la gracia.

**Pilares de diseño:**
1. **Presión constante:** el colapso nunca para y acelera. Cualquier error cuesta tiempo.
2. **Cooperación obligatoria, caos posible:** casi todos los eventos requieren a todo el grupo, pero los choques entre carros permiten "ayudar" o sabotear.
3. **Lectura instantánea:** colores por jugador, flechas, anillos y textos grandes. Siempre se entiende qué hay que hacer.
4. **Partidas cortas y revancha inmediata.**

**Vista actual:** 2D cenital (desde arriba). **Objetivo de la migración:** 3D, previsiblemente con cámara elevada en 3/4 siguiendo al grupo (ver §17).

---

## 2. Flujo de partida

| Pantalla | Qué pasa |
|---|---|
| **Menú** | Jugar local · Crear sala online · Unirse a sala (código de 5 letras o enlace `?sala=CÓDIGO`) |
| **Lobby** | Cada jugador se une pulsando *acelerar* en su control (sale con *frenar*). El host/local añade bots con **B** y los quita con **N**. Máx. 4 jugadores en total. Enter/Espacio/Start empieza (solo el host). |
| **Cuenta atrás** | 3-2-1-¡YA! Carros quietos, colapso quieto. |
| **Partida** | Hasta que mueren todos. |
| **Fin** | "EL MUNDO SE ACABÓ": distancia, tiempo y ranking (orden de supervivencia, metros, segundos y puntos de estilo ★). Enter = revancha (nuevo mapa), Esc = lobby. |

Los jugadores tienen un **color fijo por plaza**: P1 rojo `#ff4d5e`, P2 azul `#3fa7ff`, P3 amarillo `#ffd23f`, P4 verde `#3ddc84`. El color identifica al jugador en todos los eventos (carriles, anillos, flechas, marcador).

---

## 3. Unidades y escala

La demo trabaja en píxeles. Para pasar a 3D se recomienda **1 unidad = 1 metro** con esta equivalencia, que es la que ya usa el marcador del juego:

| Demo | Equivalencia | Notas |
|---|---|---|
| **16 px** | **1 m** | El HUD muestra metros con esta conversión |
| Baldosa 64 px | 4 m | Unidad de la rejilla del mundo |
| Carretera 13 baldosas (832 px) | 52 m de ancho | En 3D quizá convenga reducirla (ver §17) |
| Carro 24×40 px, radio de colisión 18 px | ~1,5 × 2,5 m, radio 1,1 m | |
| 330 px/s (velocidad máx.) | 20,6 m/s ≈ 74 km/h | |

El eje "hacia delante" en la demo es **−Y** (hacia arriba de la pantalla). En 3D será típicamente **+Z**.

---

## 4. El mundo

### 4.1 Carretera procedural infinita
- Carretera **recta hacia delante**, ancho fijo de 13 baldosas, con muros (rallas amarillo/negro) a los lados. Infinita y generada a partir de una **semilla** (en online, la misma semilla da el mismo mapa en todos los PCs).
- **Obstáculos:** cajas y rocas que ocupan una baldosa (con margen de 6 px). Probabilidad por baldosa ~6 %, creciendo con la distancia hasta ~12 %.
- **Camino libre garantizado:** existe siempre un pasillo de 3 baldosas sin obstáculos que serpentea suavemente (`laneCol(r) = 6 + 4·sin(r·0.11 + semilla)`), así que la pista nunca queda bloqueada de lado a lado. Los bots lo usan como ruta base.

### 4.2 Estructura que se repite
Cada **56 baldosas** (`GAP`, ~224 m) se repite una sección. La primera puerta está en la fila −34 (~136 m de la salida):

```
  ↑ hacia delante
  [abismo 6 baldosas]   ← zona de salto (§9.2), 10 baldosas después de la puerta
  [rampa]
  ...
  ═══ PUERTA (barrera) ═══
  [tramo de carriles: 18 baldosas]   ← evento de carriles (§9.1)
  ...
```

- Junto a la **barrera** (2 filas antes y después) nunca hay obstáculos.
- En el **tramo de carriles** sí puede haber obstáculos, con menos probabilidad (`LANE_OBS` = 2 %).
- La **zona de salto** (rampa + abismo + 3 filas alrededor) nunca tiene obstáculos.

---

## 5. El colapso ("el fin del mundo")

- Una línea que **avanza hacia delante** detrás de los jugadores. Empieza 380 px (~24 m) detrás de la salida.
- **Velocidad:** empieza en 200 px/s (12,5 m/s) y acelera 2 px/s cada segundo hasta un máximo de 280 px/s (17,5 m/s). Un carro a tope va a 330, así que se puede escapar, pero con poco margen.
- **Borde irregular:** cada baldosa cae en un momento un poco distinto (desfase aleatorio de ±55 px por baldosa), así el borde se ve dentado.
- **Avisos visuales:** las baldosas se **agrietan** progresivamente en los ~280 px anteriores al borde, con grietas que brillan en rojo-naranja y tiemblan. Al caer, se encogen, giran y oscurecen. Hay escombros cayendo y un resplandor rojo.
- **Muerte:** si la baldosa bajo el carro ya cayó → "cayó al vacío". Un carro en el aire muere si el colapso lo alcanza.
- **Sonido:** retumbe grave continuo cuya intensidad crece cuanto más cerca está el colapso, más golpes de derrumbe periódicos.

---

## 6. Cámara

- **Compartida:** una sola vista para todos, desplazándose solo hacia delante y atrás (el ancho de la carretera siempre cabe).
- **Objetivo:** el punto medio entre el carro más adelantado y el más atrasado, un poco desplazado hacia delante. Si el grupo está muy separado, **manda el líder**: el primero queda a ~20 % del borde superior.
- **Quedarse atrás mata:** quien sale por debajo de la pantalla muere ("se quedó atrás"). No aplica durante un salto en cadena ni a carros recién revividos.
- El líder **no se frena** contra el borde superior: la cámara lo sigue más rápido cuando se acerca a él. (Antes se le frenaba, pero eso no se puede predecir en online y causaba tirones; ver §15.)
- **Temblor de pantalla** (screen shake) en choques, muertes, parry, rayo, turbo…

---

## 7. El carro

### 7.1 Controles

| | Acelerar / Frenar-marcha atrás / Girar | ACCIÓN | Derrape |
|---|---|---|---|
| P1 | W / S / A-D | E | Espacio |
| P2 | Flechas | Shift der. o Ctrl der. | - o . |
| P3 | I / K / J-L | O | U |
| P4 | T / G / F-H (o Num 8/5/4-6) | Y (o Num 0) | R (o Num 7) |
| Mando | RT o A / LT o B / stick o cruceta | X | RB o LB |

**ACCIÓN** sirve para el parry en el aire y para cobrar el combo en el suelo.

### 7.2 Física (arcade)
Modelo propio, sin motor de física:
- La velocidad se descompone en **hacia delante** y **lateral**.
- **Acelerar:** +520 px/s² hasta 330 px/s. **Frenar:** −900 px/s². **Marcha atrás** (frenar estando parado): hasta 150 px/s. Sin acelerador, se pierde velocidad poco a poco.
- **Agarre lateral muy alto:** la velocidad lateral se amortigua rápido (factor e^(−10·dt)), así el carro va donde apunta. Tras un choque, el agarre baja 0,35 s (e^(−2·dt)) para que el empujón se note.
- **Giro:** 3,4 rad/s, escalado con la velocidad (no gira parado; a ≥140 px/s gira al máximo; en marcha atrás el volante se invierte).
- **Muros laterales:** rebote con 40 % de la velocidad.
- **Obstáculos:** colisión círculo contra caja; rebota la componente normal con factor 1,3.
- **Barreras cerradas:** bloquean y rebotan al 30 %.

### 7.3 Choques entre carros
- Colisión círculo-círculo; cada carro se aparta la mitad del solapamiento.
- Impulso **muy elástico** (restitución 1,15): los empujones se sienten exagerados, a propósito, por lo friendslop.
- Si el impacto es fuerte (>70 px/s): chispas, sonido, temblor, pequeño giro aleatorio a ambos, agarre reducido y **se rompe el combo de los dos**.

---

## 8. Derrape y combos

### 8.1 Derrape
- **Mantener el botón de derrape girando** a más de 140 px/s.
- El carro **siempre gira hacia el lado del derrape**; el volante solo cierra o abre la curva (factor 0,25-1,3 sobre el giro normal, ×1,15). Se pierde algo de velocidad.
- Visualmente el carro se inclina ~0,5 rad hacia dentro de la curva. Deja marcas de neumático y humo.
- **Niveles:** a 1,1 s → nivel 1 (chispas **azules**); a 2,4 s → nivel 2 (chispas **naranjas**).
- **Mini-turbo al soltar:** +70 px/s (nivel 1) o +120 px/s (nivel 2), que además permite superar la velocidad máxima durante 0,8 s. Soltar antes del nivel 1 no da nada.

### 8.2 Combos (puntos de estilo)
| Acción | Puntos | Multiplicador |
|---|---|---|
| Derrapar (continuo) | 14/s (+50 % por nivel) | — |
| Soltar derrape nivel 1 / 2 | +30 / +60 | +0,5 / +1 |
| **Al límite**: pasar a menos de ~26 px de otro carro, rápido (>160 px/s relativa) y sin tocarlo | +25 | +0,5 |
| **Roce**: pasar a menos de 14 px de un obstáculo a >180 px/s | +20 | +0,25 |
| **Aterrizaje** tras el salto | +40 | +0,5 |

- Multiplicador máximo **×4**. Encima del carro se ve "x2.5 340".
- **Cobrar:** ACCIÓN en el suelo, o automático tras 2 s sin sumar nada (parpadea antes). Valor = puntos × multiplicador. Se suma a la puntuación personal (★) y una parte a la **sinergia**: valor/1500, máximo 0,3 por combo.
- **Se pierde** al chocar con un muro, un obstáculo, una barrera u otro carro ("COMBO PERDIDO").
- Dos carros atados por cuerda/remolque no suman "al límite" entre sí.

---

## 9. Eventos de equipo

### 9.1 Carriles de color (antes de cada puerta)
- Cuando alguien llega a 7 baldosas del tramo, se **activa**. Aparece un **carril recto y vertical por cada jugador vivo**, de **90 px** (~2,5 carros) de ancho, **separados** entre sí (mín. 40 px) y en **posiciones y orden al azar**. Así casi siempre hay que cruzarse con otros, lo que provoca empujones.
- **Objetivo:** que **todos los vivos estén a la vez dentro de su carril** (en el tramo o pegados a la barrera). Mientras se cumple, la barra de sincronización sube; se llena en **2,5 s**. Si alguien se sale, **se mantiene el progreso** (no baja).
- **Al llenarse:** la barrera se abre (animación de apertura, confeti) y +30 % de sinergia.
- **Si un jugador con carril muere** durante el evento, la puerta se **bloquea 2,5 s** ("¡BLOQUEADO!") y luego los carriles se reparten de nuevo entre los supervivientes.
- **Ayudas visuales:** carriles con borde discontinuo animado y chevrones que avanzan; brillo cuando su dueño está dentro; nombre del jugador en la entrada; flecha junto a cada carro apuntando a su carril; contador "En su carril 2/4".
- **Con un remolque en curso** (§9.5) no aparecen carriles: la puerta se abre sola ("¡paso libre!"). Y un remolque no empieza durante un evento de carriles.

### 9.2 Salto con parry en cadena (después de cada puerta)
Una **rampa** amarilla seguida de un **abismo** de 6 baldosas (~24 m). Caer al abismo sin saltar es muerte.

**Reglas:**
1. Al pasar la rampa, el carro despega. **Todos vuelan hasta la misma línea de planeo** (a ~55 % del abismo desde la rampa) **y se quedan exactamente a la misma altura**, sin importar la velocidad con la que pasaron la rampa. La velocidad de llegada se suaviza para no pasarse.
2. Si quien salta **no tiene a nadie pendiente** (es el único vivo o los demás ya cruzaron), **sale lanzado automáticamente** a la otra orilla.
3. Si hay alguien pendiente, se queda **planeando** con un **temporizador de 3 s** (anillo rojo que se vacía, pitidos al final, texto "¡ENGÁNCHAME!"). El temporizador **se pausa mientras alguien vuela hacia él**.
4. **El parry:** en el aire se mueve el carro **de lado** (260 px/s) para acercarse al que planea. Cuando están a menos de **42 px** (`PARRY_WIN`), pulsar **ACCIÓN** = enganche. A menos de 18 px es "¡PARRY PERFECTO!". Un **anillo del color del jugador** se cierra alrededor del objetivo a medida que se acerca, y un círculo blanco marca la ventana. Mientras vuela hacia la línea, una ayuda suave lo arrima al que planea.
5. **Efecto del enganche:** el enganchado sale **lanzado** a la otra orilla. Quien hizo el parry **se queda planeando para el siguiente** si aún queda alguien pendiente; si era el último, sale lanzado también.
6. **Pendiente** = cualquiera que no ha cruzado: los que siguen en el suelo antes de la rampa y los que están en el aire volando o planeando.
7. **Pulsar fuera de la ventana:** "¡FALLASTE!" y 0,6 s sin poder reintentar.
8. **Si a quien planea se le acaba el tiempo**, cae. Los que planeaban a su lado quedan marcados como "fallaron" y no pasan solos por quedarse los últimos.
9. **Si quien planea ya no tiene a nadie pendiente** (los demás cruzaron o murieron) y no falló, **pasa automáticamente**.
10. **Lanzamiento:** curva de 0,75 s hasta un punto **fijo** 110 px más allá del borde del abismo (fijo para que en online sea predecible). Al aterrizar: +40 de combo y velocidad inicial.

**Efectos del parry:** congelado breve (hitstop 0,11 s, o 0,18 s si es perfecto), destello blanco, temblor, chispas, línea blanca uniendo a los dos y +25 % de sinergia (+35 % si es perfecto).

**Casos:**
- 1 jugador → salto automático.
- 2 → uno engancha al otro y pasan los dos.
- 3 → P2 engancha a P1 (P1 pasa); P2 planea; P3 engancha a P2 (P2 pasa) y P3, último, pasa también.
- 4 → igual, un eslabón más.
- Cualquiera de los dos que se crucen puede pulsar el parry; quien pulsa es el que "empuja".

**Seguridad:** durante el salto, quedarse atrás en la cámara no mata.

### 9.3 Rayo
- Cada **22-35 s** cae un rayo sobre un carro al azar (en el suelo y sin avería): destello, trueno, rayo dibujado desde arriba.
- **Avería** durante 10 s: velocidad máxima −15 % y **gira mal hacia un lado al azar** (30 % del giro normal hacia ese lado). Se ven chispas eléctricas, una barra que baja y una flecha roja ◀/▶ del lado afectado.
- **Reparación en equipo:** cada choque fuerte de un compañero sin avería resta **8 s** (0,3 s de espera entre golpes). Cada golpe da +8 % de sinergia y terminar de repararlo a golpes +12 % extra.

### 9.4 La cuerda
- Cada **28-40 s**, dos carros cercanos quedan **atados 15 s** por un elástico (largo en reposo 120 px; al empezar se tensa poco a poco desde la distancia que tengan).
- **Física:** si se estiran más que el largo, un muelle (rigidez 9, amortiguado solo al separarse) tira de ambos. A partir de **230 px** arrastra sí o sí. Si uno frena, frena al otro; si uno acelera, jala al otro.
- **Trabado:** si la cuerda pasa a los dos lados de un obstáculo, se **traba**: tira de ambos hacia el obstáculo. Solo se destraba cuando uno lo **rodea** y quedan del mismo lado.
- Se **afloja** durante los saltos y si hay un abismo entre los dos (para no arrastrar a nadie al vacío).
- Si los dos sobreviven a los 15 s: "¡LIBRES!" y +15 % de sinergia.
- Visual: cuerda que cuelga cuando está floja, recta y clara cuando está tensa, y temporizador en medio.

### 9.5 Remolque
- Cada **38-55 s**, a un carro se le **apaga el motor** (no acelera; sí frena y gira) y queda **amarrado con una cadena** (largo 95, máx. 170, rigidez 14) al carro más cercano.
- Hay que **jalarlo hasta una línea de recarga** ~1100 px (~69 m) más adelante ("⚡ RECARGA", verde y animada). Debajo del carro sin motor se ve "SIN MOTOR · 39 m".
- Al llegar: "¡MOTOR RECARGADO!" y +20 % de sinergia. Si el que remolca muere, toma el remolque el siguiente más cercano.

### 9.6 Revivir
- **Mientras haya alguien muerto**, aparecen **piezas de carro** (engranajes brillantes) cada 1,6-2,8 s, en sitios libres 220-520 px por delante del primero, como máximo 3 a la vez. Desaparecen si el colapso las alcanza.
- Los vivos las **recogen pasando por encima** (34 px). El contador es **compartido**.
- Con **4 piezas**, **reviven todos los muertos a la vez**, junto al carro más adelantado que esté en el suelo, repartidos a los lados, con **2 s de invulnerabilidad**: atraviesan obstáculos y carros, no caen ni mueren por quedarse atrás, y se ven parpadeando y semitransparentes.
- Marcador: "PIEZAS PARA REVIVIR" con 4 casillas sobre la barra de sinergia.
- Si mueren todos, la partida termina.

---

## 10. Sinergia y turbo

Barra **compartida** que se llena con el trabajo en equipo:

| Fuente | Suma |
|---|---|
| Abrir una puerta (carriles) | +30 % |
| Enganche / parry perfecto | +25 % / +35 % |
| Choque que ayuda a reparar el rayo / terminar de repararlo | +8 % / +12 % |
| Sobrevivir atados (cuerda) / completar el remolque | +15 % / +20 % |
| Cobrar un combo | valor/1500, máx. +30 % |

**Al llenarse → TURBO para todos durante 7 s:** velocidad y aceleración ×1,3 (velocidad máx. 429). La barra se vacía mientras dura y no se puede volver a llenar en ese tiempo. Efecto de velocidad: líneas que pasan rápido por los bordes, viñeta naranja que late, estelas de color, motor más agudo y sonido de arranque.

---

## 11. Puntuación

- **Distancia** del grupo (el más lejos llegado), en metros.
- **Ranking final** por orden de supervivencia (quien murió más tarde primero), con metros, tiempo y **puntos de estilo ★** de cada uno.
- Motivos de muerte que se muestran: "cayó al vacío", "cayó al abismo", "se quedó atrás", "no lo engancharon", "se lo tragó el colapso".

---

## 12. HUD e interfaz

- **Arriba izquierda:** metros recorridos; **"Colapso a 23 m"** con color según peligro (verde ≥40 m, amarillo 15-40 m, rojo <15 m parpadeando); velocidad del colapso.
- **Arriba derecha:** fichas de jugadores (P1-P4), atenuadas con ✕ si murieron y con ⚡ si tienen rayo.
- **Borde derecho:** **minimapa vertical** de los próximos 160 m: el colapso como franja roja abajo, los carros como puntos de color, las puertas como rayas (moradas, verdes si están abiertas, rojas si están bloqueadas) y las zonas de salto como un hueco negro.
- **Arriba centro:** barra del evento de carriles ("En su carril 2/4" o "BLOQUEADO 1.4s").
- **Abajo centro:** barra de **SINERGIA** (o "¡TURBO! 4.2s") y encima, si hay muertos, las piezas para revivir.
- **Centro:** mensajes grandes y temporales ("¡CADA UNO POR SU CARRIL!", "¡ENGANCHE!", "¡RAYO a P2!", "¡TURBO EN EQUIPO!"…).
- **Mundo:** textos flotantes (combos, "+640", "¡TRABADOS!", "+1 pieza (2/4)"), nombre sobre cada carro, flechas a los carriles, anillos de parry y temporizadores.
- **Peligro:** a menos de 15 m del colapso, el borde inferior se tiñe de rojo y late; a menos de 10 m, sonido de **latido** que se acelera.
- **Barra de sala (online):** código, "Copiar enlace", nº de jugadores, ping y si la conexión es **directa o vía relay**.

---

## 13. Audio

Todo está sintetizado con WebAudio (no hay archivos). Lista de sonidos a sustituir por assets en 3D:

| Momento | Sonido actual |
|---|---|
| Unirse / salir del lobby | Glissando corto hacia arriba / abajo |
| Cuenta atrás / ¡YA! | Pitido / sierra aguda |
| Motor (global) | Sierra grave cuyo tono sube con la velocidad media (más aguda en turbo) |
| Colapso | Retumbe de ruido marrón continuo + derrumbes aleatorios |
| Choque carro-carro / con obstáculo | Golpe de ruido filtrado + tono grave |
| Derrape | Chirrido corto repetido; "ding" al subir de nivel; silbido del mini-turbo |
| Combo: sumar / cobrar / perder | Pitido que sube con el multiplicador / arpegio tipo moneda / tono que cae |
| Evento de carriles / tick de progreso / puerta abierta / bloqueo | Arpegio / pitidos crecientes / fanfarria / zumbido grave |
| Salto / aterrizaje | Barrido ascendente / golpe |
| Parry / fallo / aviso de tiempo | Golpe metálico + grave / soplido / pitidos rápidos |
| Rayo / chispa de reparación / reparado | Trueno / zap eléctrico / arpegio |
| Cuerda / trabado / suelta · motor apagado | Crujido / golpe / chasquido · motor que se apaga |
| Pieza / revivir | Ding doble / arpegio luminoso |
| Turbo / fin del turbo | Barrido + arpegio / caída |
| Latido de peligro | Dos golpes graves |
| Fin de partida | Arpegio descendente |

---

## 14. Multijugador

### 14.1 Local
1-4 jugadores en la misma pantalla con teclado (4 esquemas) y/o mandos. Bots opcionales.

### 14.2 Online (arquitectura actual)
- **Host autoritativo P2P:** un jugador hace de host y **simula todo**. Los demás envían sus controles y reciben el estado. Implementado con **PeerJS (WebRTC)**: el servidor gratuito de PeerJS solo pone en contacto a los PCs; los datos viajan directos (o por un relay TURN si la red no lo permite).
- **Mixto:** cada PC puede meter varios jugadores locales, hasta 4 en total. Los bots corren en el host.
- **Canales:**
  - **Fiable y ordenado:** lobby, efectos (sonidos, partículas, mensajes), pulsaciones de ACCIÓN.
  - **Rápido, sin orden ni reenvíos** (como UDP): posiciones del host a **60/s** con número de secuencia (se descartan los que llegan tarde), controles del cliente (al cambiar, y cada 50 ms) y ping. Puertas, cuerdas y piezas van cada 4 envíos.
- **Efectos como eventos:** la simulación no reproduce sonidos ni partículas directamente; dispara eventos (`fx(nombre, args)`) que se ejecutan en el host y se reenvían a los clientes. Esto mantiene todo sincronizado y es un patrón a conservar.
- **Parry con margen para el lag:** el cliente envía la distancia que ve **en su pantalla** al pulsar. El host la acepta si él también ve a los dos razonablemente cerca (ventana + 110 px de tolerancia). Así el lag no arruina el parry.
- **Si el host cambia de pestaña**, un worker mantiene la simulación a ritmo (el navegador pausa la animación en segundo plano).
- **Predicción del cliente:** implementada pero **desactivada** (`PREDICTION = false`), ver §15.

### 14.3 Bots
Corren en el host o en local y usan la misma entrada que un jugador (acelerar, girar, derrape, acción):
- Siguen el **camino libre** mirando unas filas por delante y **esquivan** el obstáculo que tengan justo delante.
- **Carriles:** van al suyo; si quedan pegados a la barrera fuera de su carril, **retroceden girando** hacia él (un carro parado no puede girar); si ya están dentro, frenan antes de chocar.
- **Salto:** al acercarse a la rampa se alinean con quien planea; en el aire se acercan de lado y pulsan el parry con una **probabilidad de acierto** propia (65-90 %), reintentando.
- **Rayo:** embisten al compañero averiado. **Remolque:** sin motor, siguen al que remolca. **Piezas:** van a por ellas si no tienen nada más prioritario.
- **Atascos:** si están casi parados más de 0,8 s, marcha atrás girando medio segundo.
- **Combos:** cobran cuando el combo lleva medio segundo sin sumar.

---

## 15. Lecciones aprendidas (importante para la migración)

**Red y lag**
1. **Ping real:** jugadores en España y Venezuela tienen **~170 ms** de ping, y es básicamente la distancia física. No se puede eliminar, solo esconder.
2. **La predicción del cliente** (mover tu carro al instante y corregir con el host) se implementó con historial, calibración automática de latencia y despegues/parry locales. Funcionó en pruebas, pero **al jugador no le gustó la sensación** y se volvió a "las teclas van al host y vuelven". Con amigos cercanos (mismo país) esto se siente bien. **Para la versión 3D:** decidir pronto el modelo. Si se usa predicción, diseñar la simulación desde el principio para que sea **determinista y repetible** (rebobinar y resimular), en vez de añadirla al final.
3. **Todo lo aleatorio que afecte a la posición debe decidirlo el host o ser determinista.** Ejemplo: el punto de aterrizaje del salto era aleatorio y el cliente no podía predecirlo; se fijó.
4. **No modificar posiciones con reglas que dependen de la vista local** (p. ej. la cámara frenando al líder): en online cada PC tiene una cámara distinta. Se cambió por una cámara que sigue al líder.
5. **Mostrar a todos los carros en el mismo instante** es crucial: si tu carro va "adelantado" y los demás "atrasados", los choques parecen ocurrir a distancia.
6. **Efectos locales inmediatos** (sonido y chispas de tus choques) mejoran mucho la sensación aunque la lógica la decida el host. Luego hay que ignorar el aviso duplicado del host.
7. **Bug real encontrado:** un contador de congelado (hitstop) quedaba en un número negativo minúsculo y las comprobaciones del tipo `!hitstop` lo tomaban como activo, apagando la predicción para siempre tras el primer parry. Usar comparaciones explícitas (`> 0`) y fijar a 0.
8. **Conectividad:** un amigo con **Opera** no podía conectarse a ninguna sala (WebRTC bloqueado o red con CGNAT). Opera tiene un ajuste de privacidad de WebRTC que conviene revisar. A largo plazo: **TURN propio** o, en Steam, **Steam Datagram Relay**.

**Diseño**
9. **El salto en cadena** necesitó varias iteraciones: primero la distancia de vuelo dependía de la velocidad y el segundo no alcanzaba al primero; luego cruzaban en vertical demasiado rápido. La solución final: **todos planean a la misma altura** y el parry se hace acercándose de lado, con ayuda para alinearse, temporizador que se pausa si alguien viene y regla clara de "pendientes".
10. **Carriles:** empezaron curvos y anchos (dependiendo del nº de jugadores). El jugador prefirió **rectos, de ancho fijo y separados al azar**, con obstáculos posibles, y que **el progreso no baje** al salirse.
11. **El jugador sube la dificultad:** colapso rápido (empieza en 200, máx. 280, casi tan rápido como un carro). Los eventos tienen que ser jugables bajo esa presión.
12. **No cruzar eventos incompatibles** (remolque + carriles, cuerda + abismo).

---

## 16. Tabla de parámetros actuales

| Parámetro | Valor | Descripción |
|---|---|---|
| `T` / `COLS` | 64 px / 13 | Baldosa y ancho de la carretera |
| `CAR_R` | 18 px | Radio de colisión del carro |
| `CAR_MAX`, `CAR_REV` | 330 / 150 px/s | Velocidad máx. adelante / atrás |
| `CAR_ACC`, `CAR_BRAKE` | 520 / 900 px/s² | Aceleración / frenada |
| `CAR_TURN` | 3,4 rad/s | Giro |
| `DOOM_START` | 380 px | Ventaja inicial |
| `DOOM_SPEED0` / `DOOM_ACCEL` / `DOOM_MAX` | 200 / 2 / 280 | Colapso: inicial, aceleración por s, máx. |
| `G0` / `GAP` | −34 / 56 filas | Primera puerta / distancia entre secciones |
| `LANE_ROWS` / `LANE_W` / `LANE_GAP` / `LANE_OBS` | 18 / 90 px / 40 px / 2 % | Tramo de carriles |
| `HOLD_TIME` / `LOCK_TIME` | 2,5 s / 2,5 s | Sincronizar carriles / bloqueo por muerte |
| `CHASM_ROWS` | 6 | Largo del abismo |
| `GLIDE_POINT` / `GLIDE_TIME` | 0,55 / 3 s | Línea de planeo / tiempo de espera |
| `AIR_STEER` | 260 px/s | Movimiento lateral en el aire |
| `PARRY_WIN` / `PARRY_RANGE` | 42 / 170 px | Ventana del parry / distancia del anillo |
| `LAG_TOLERANCE` | 110 px | Margen del host para aceptar parrys remotos |
| `ZAP_EVERY` / `ZAP_TIME` / `ZAP_HIT` | 22-35 s / 10 s / 8 s | Rayo |
| `ZAP_SPEED` / `ZAP_TURN` | 0,85 / 0,3 | Penalización del rayo |
| `ROPE_EVERY` / `ROPE_TIME` | 28-40 s / 15 s | Cuerda |
| `ROPE_LEN` / `ROPE_MAX` / `ROPE_K` | 120 / 230 px / 9 | Elástico de la cuerda |
| `TOW_EVERY` / `TOW_DIST` | 38-55 s / 1100 px | Remolque |
| `TOW_LEN` / `TOW_MAX` / `TOW_K` | 95 / 170 px / 14 | Cadena del remolque |
| `PARTS_NEEDED` / `PART_EVERY` / `MAX_PARTS` | 4 / 1,6-2,8 s / 3 | Revivir |
| `PART_PICK_R` / `REVIVE_GHOST` | 34 px / 2 s | Recogida / invulnerabilidad |
| `DRIFT_MIN_SPEED` / `DRIFT_LEVELS` / `DRIFT_BOOST` | 140 / 1,1-2,4 s / 70-120 | Derrape |
| `COMBO_IDLE` / `COMBO_MAX` | 2 s / ×4 | Combos |
| `TURBO_TIME` / `TURBO_BOOST` | 7 s / ×1,3 | Turbo |
| `BOT_PARRY_SKILL` | 65-90 % | Acierto de los bots en el parry |

---

## 17. Guía para la migración a 3D

### 17.1 Qué cambia al pasar a 3D
- **Cámara:** recomendada en **3/4 elevada** detrás del grupo, mirando hacia delante, con la misma lógica de §6 (sigue al punto medio, manda el líder, quien sale por detrás muere). Un FOV o altura dinámicos según la separación del grupo ayudan a que quepan todos.
- **Ancho de la carretera:** 52 m es mucho en 3D. Probar con 24-32 m y ajustar el tamaño de carriles, obstáculos y abismos en proporción.
- **El colapso se luce en 3D:** baldosas (o trozos de terreno) que se agrietan, tiemblan y **caen al vacío con física** (rigidbodies que se activan al pasar el frente), polvo, rocas y un vacío oscuro con niebla debajo.
- **El salto gana mucho:** altura real con una parábola visible, sombra proyectada en el abismo, y la línea de planeo como un "punto de suspensión" visible. Mantener la regla de **todos a la misma altura y distancia** del borde para que el parry siga siendo una cuestión de alinearse de lado.
- **Carriles:** pintados en el suelo con luz y, quizá, columnas o arcos en la barrera.
- **Rayo, turbo, revivir:** efectos de partículas y postprocesado (destello, viñeta, desenfoque radial en turbo).

### 17.2 Física de los carros
- Para conservar la sensación arcade, **no usar la física realista de ruedas** (WheelCollider o VehicleBody). Mejor un **controlador cinemático propio** como el de §7.2: velocidad hacia delante y lateral con agarre alto, giro escalado por la velocidad, colisiones resueltas a mano o con un Rigidbody/CharacterBody muy amortiguado.
- Mantener separada la **física de conducción** (una función pura "mover el carro") de los **efectos**. En la demo, `drive()` la usan tanto el host como la predicción del cliente.

### 17.3 Correspondencia de sistemas

| Sistema de la demo | Unity | Godot |
|---|---|---|
| Bucle `simulate` (host/local) | `GameManager` con `FixedUpdate` | Nodo `GameManager` con `_physics_process` |
| Carro (`makeCar`, `updateCar`, `drive`) | Prefab `Car` + `CarController` | Escena `Car.tscn` (CharacterBody3D) + script |
| Generación procedural (semilla, `isObstacle`, secciones) | `TrackGenerator` con *chunks* que aparecen y desaparecen | Igual, con `PackedScene` por chunk |
| Colapso (`doomY`, `fallP`) | `CollapseFront` que activa rigidbodies de los chunks | Ídem con RigidBody3D |
| Eventos (carriles, salto, rayo, cuerda, remolque, revivir) | Un componente por evento + `EventDirector` (temporizadores, compatibilidad) | Nodos hijos de un `EventDirector` |
| Cuerda/remolque | `SpringJoint`/`ConfigurableJoint`, o el muelle manual (más controlable) | `Generic6DOFJoint3D` o muelle manual; render con `Line3D`/malla |
| `fx(...)` → efectos | Eventos/`UnityEvent` → partículas y audio; replicados por red (RPC "unreliable" o "reliable" según el efecto) | Señales + `@rpc` |
| Red (host autoritativo) | **Netcode for GameObjects** o **Mirror/FishNet**; Steam con **Facepunch.Steamworks** + SDR | **High-level multiplayer** (`MultiplayerSynchronizer`/`@rpc`) + **GodotSteam** |
| Bots | `BotDriver` que produce la misma entrada que un jugador | Ídem |
| HUD | UI Toolkit o uGUI | `Control` / `CanvasLayer` |

### 17.4 Red en la versión 3D
- **Mantener host autoritativo P2P** para 4 amigos: es el modelo de la mayoría de friendslop en Steam. Un servidor dedicado no compensa y no baja el ping por sí solo.
- **En Steam:** lobbies e invitaciones de amigos, conexión por **Steam Datagram Relay** (mejores rutas, sin problemas de NAT ni IPs expuestas). Y **Remote Play Together** gratis gracias al multijugador local.
- **Replicación:** posiciones por canal no fiable a 30-60 Hz con interpolación; eventos importantes por canal fiable; efectos cosméticos como eventos.
- Decidir pronto si habrá **predicción del cliente** (ver §15, punto 2).

### 17.5 Orden sugerido para la migración
1. Carro, controles y física arcade, y cámara compartida en una carretera recta.
2. Colapso y muerte.
3. Generación procedural por chunks con obstáculos y camino libre.
4. Multijugador local (varios controles).
5. Evento de carriles y puertas.
6. Salto con parry en cadena.
7. Sinergia y turbo; derrape y combos.
8. Rayo, cuerda, remolque, revivir.
9. Online (host autoritativo) y bots.
10. Pulido: audio, efectos, HUD, menús.

---

## 18. Ideas pendientes

Ver [IDEAS.md](IDEAS.md). Las principales sin hacer: **bomba caliente** (pasarla chocando), **fantasmas** que ayudan o molestan desde la muerte, **conducción en espejo**, **puente que se cae**, **pulsador simultáneo**, **hielo**, **viento lateral**, **meteoritos**, **fases/biomas** del fin del mundo y **jefe final**. Fuera de la demo quedaron también la tienda y los cosméticos.
