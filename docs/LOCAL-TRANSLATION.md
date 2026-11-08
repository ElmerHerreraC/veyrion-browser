# Traducción local y componentes de Veyrion

La traducción de páginas inglés ↔ español usa Bergamot 0.4.9 y los modelos
fijados en `config/local-translation.json`. Ambos modelos se incluyen en el
instalador. El texto se procesa en el equipo, sin servicios de traducción.
La primera ejecución carga WebAssembly y el modelo; el motor se libera tras
60 segundos sin trabajo. Se usa un solo trabajador.

La interfaz de traducción y «Mostrar original» pertenecen al navegador. Esta
primera integración traduce el texto inicial del documento principal HTTP(S).
No traduce formularios, campos editables, código, PDF ni marcos incrustados.
Los cambios posteriores de una aplicación web requieren volver a traducir.
Se limitan las páginas a 500 000 caracteres y 10 000 nodos de texto.

Preparación reproducible:

```
node tools/prepare-open-components.mjs
node tools/prepare-open-browser-data.mjs
node tools/prepare-local-translation.mjs
node tools/integrate-native.mjs D:/VeyrionBuild/src/brave
```

Los generadores verifican hashes fijados. Los modelos y el motor generados no
se guardan en Git: se distribuyen dentro del instalador, junto a sus avisos y
licencia MPL 2.0. El código original de Bergamot permanece sin modificar.

Las excepciones de compatibilidad del agente de usuario, el filtro de parámetros
y los datos locales usan archivos abiertos de `brave/adblock-lists`, fijados al
commit registrado en `browser-data-provenance.json`. Los analizadores nativos
consumen los archivos incluidos en `veyrion-components`. Se actualizan mediante
versiones firmadas de Veyrion, sin simular versiones de componentes remotos.

Las actualizaciones del navegador muestran el progreso del instalador nativo.
El proceso PowerShell permanece oculto. Un acuse de inicio distingue «se creó
el proceso» de «arrancó el actualizador». El seguimiento del reinicio pertenece
a la ventana principal y funciona con la barra lateral oculta.
