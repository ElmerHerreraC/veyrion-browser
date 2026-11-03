# Bloqueo de anuncios

Veyrion mantiene el modo agresivo como valor inicial. Las páginas de la barra
lateral utilizan también el motor nativo de bloqueo.

Desde 0.8.3 se añaden suscripciones directas a EasyList, EasyPrivacy,
EasyList Spanish y uBlock Quick Fixes. El descargador nativo obtiene las listas
por HTTPS, las guarda en caché y comprueba sus actualizaciones automáticamente.
La primera descarga requiere conexión; no se incluyen copias sin conexión.

Esta inicialización ocurre una sola vez y respeta las listas previamente
desactivadas. Si después se elimina una lista, no se vuelve a añadir al iniciar.
Las excepciones por sitio se conservan.

Las suscripciones se revisan en `chrome://settings/shields/filters`.
Si una página deja de funcionar, se puede reducir el bloqueo para ese sitio.
Ninguna lista garantiza eliminar todos los anuncios, incluidos los de YouTube.

Fuentes oficiales:
- https://easylist.to/
- https://github.com/uBlockOrigin/uAssets
