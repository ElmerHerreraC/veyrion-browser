# Recursos abiertos del bloqueador

Veyrion 0.9.0 carga `veyrion-components/resources.json` con el proveedor nativo
de adblock-rust. No instala una extensión ni consulta el servidor privado de
componentes de Brave para obtener esta biblioteca.

La biblioteca combina los recursos MPL-2.0 de brave/adblock-resources con
los recursos y scriptlets GPL-3.0-or-later de brave/uBlock. `provenance.json`
registra las revisiones y SHA-256; las licencias acompañan los archivos.
Se conserva el requisito de permiso de los scriptlets `requiresTrust`.
Las suscripciones ordinarias no reciben permisos privilegiados nuevos.

El catálogo soportado está en `config/open-filter-catalog.json`. Se integra
en las suscripciones nativas existentes, donde pueden desactivarse y
actualizarse sin reinicio. Se conservan las elecciones previas del usuario.
El catálogo CRX regional heredado queda vacío: no se registran paquetes de
Brave que este canal no puede descargar. Esto también permite que el motor
termine de inicializarse sin esperar ese catálogo remoto.

Los cambios a recursos ejecutables se distribuyen dentro del instalador de
una versión de Veyrion, por el canal de manifiestos firmados existente. No hay
descarga automática de JavaScript desde una rama cambiante de GitHub.
El aviso ofrece «Actualizar y reiniciar» o «Reiniciar después». Posponer
descarta el aviso durante esa ejecución; el acceso de actualización sigue
disponible. No inicia una descarga ni programa un cierre. Las listas y los
componentes de Chromium que se aplican en caliente no piden reinicios inútiles.

El campo firmado `kind` distingue `browser` de `components`; los manifiestos
anteriores sin ese campo se tratan como actualizaciones del navegador.
La publicación 0.9.0 es `browser` porque también modifica código nativo.
Una publicación solo de recursos puede marcarse `components` al firmar con
`VEYRION_UPDATE_KIND=components`; utiliza el mismo instalador verificado y
requiere una versión nueva. No es un canal de paquetes independientes.

Esto no habilita Sync, traducción remota, Local Data, Query Filter ni las
excepciones de agente de Brave; tampoco declara corregidos sus servidores.
Se retira el registro de paquetes de anuncios, fondos de nueva pestaña de
Brave y P3A: Veyrion no utiliza esas funciones. Los fondos propios se conservan.

## Reproducir los recursos

Descargar y extraer la revisión `4dfbb048607ec4fd19c1c252fd255df6cc653720`
de https://github.com/brave/uBlock. Ejecutar:

```
node tools/prepare-open-components.mjs RUTA_AL_ARBOL_UBLOCK
```

La revisión de adblock-resources está fijada en el generador. El proceso
ensambla los recursos sin instalar dependencias nuevas. Ejecutar
`tools/verify-open-components.mjs` con `NEBULA_BROWSER_EXE` apuntando a la
distribución nativa para comprobar bloqueo y scriptlets en pestaña y lateral.

Fuentes completas de los recursos distribuidos:

- https://github.com/brave/adblock-resources/tree/6da9b247c3368baa8b4f24cd02046e18702a6527
- https://github.com/brave/uBlock/tree/4dfbb048607ec4fd19c1c252fd255df6cc653720
