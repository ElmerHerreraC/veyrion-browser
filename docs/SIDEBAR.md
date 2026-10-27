# Barra lateral y tableros

El botón de tres puntos situado sobre el engranaje abre únicamente la configuración de la barra lateral en un panel compacto. El engranaje abre la apariencia general del navegador. Los accesos a Descargas y Extensiones se pueden mostrar, ocultar y reordenar junto con los demás iconos.

Favoritos y los paneles web comparten el espacio lateral: al abrir uno se oculta el anterior. Desde 0.6.0, los documentos laterales permanecen abiertos en segundo plano al cambiar de pestaña o de servicio. Al volver se reutiliza el mismo documento, conservando texto, sesión y navegación. La caché pertenece a la ventana y acaba al cerrarla; no promete conservar formularios sin guardar después de reiniciar. Las páginas internas de configuración, descargas y extensiones tienen estilos adaptados a anchos pequeños. Los sitios HTTP/HTTPS nuevos usan vista móvil por defecto; el botón Celular/Escritorio conserva la elección por sitio. La adaptación de sitios externos también depende de su diseño; un sitio sin diseño adaptable puede verse reducido o requerir desplazamiento.

Los tableros de esta versión son ventanas nombradas con conjuntos de pestañas independientes. Puedes crearlos y nombrarlos desde el panel. Desde 0.7.0 también aparecen botones numerados directamente en la barra para cambiar entre los tableros abiertos. Cambiar no cierra ni recarga los demás. Esta implementación difiere de los espacios de Opera GX dentro de una sola ventana. La restauración al reiniciar sigue la opción de inicio y recuperación de ventanas de Chromium; para recuperarlas al abrir, configura la continuación de la sesión anterior en Al inicio. Los tableros no se mezclan con ventanas privadas.

# Inicio y fondos locales

El inicio muestra hasta ocho páginas recientes del historial local de los últimos 30 días, ordenadas por última visita, sin consultar servidores de iconos. Se pueden ocultar y no se muestran en contexto privado. Incluye cuatro ilustraciones estáticas locales: cumbres, costa, planeta y nebulosa. No necesitan conexión ni reproducen animaciones.

Personalizar inicio permite elegir una imagen PNG/JPEG/WebP/GIF o un vídeo WebM/MP4. Se guarda un archivo en IndexedDB del perfil, sin subirlo a un servidor. El límite es 12 MB y hasta 4K para imágenes; 25 MB y hasta 1080p para vídeo. Se recomienda vídeo corto WebM/MP4 a 24 o 30 fps frente a GIF para reducir el coste de reproducción.

Los vídeos se reproducen sin sonido y se pausan cuando la pestaña queda oculta. Las imágenes animadas pasan a una captura estática al ocultarse o pausarse. El ajuste de movimiento reducido impide la reproducción automática; el usuario puede iniciarla expresamente. Quitar fondo elimina el archivo guardado. El fondo animado se aplica al inicio; no se dibuja sobre las páginas visitadas ni sobre las barras nativas.

La reproducción tiene un coste de CPU/GPU y memoria que depende del archivo y del equipo. No se garantiza impacto cero. Las pausas, los límites y la liberación de recursos al salir evitan mantener decodificadores activos en pestañas ocultas. Las pruebas verifican persistencia, silencio, pausa manual, movimiento reducido y ausencia de avance del vídeo en segundo plano.

# Ventanas con Tor

Se conserva el motor de conexión y el estado real de Tor. La identidad visual del inicio privado es Veyrion. Un estado Desconectada no indica un túnel Tor activo. El buscador Brave Search es un proveedor externo diferente del nombre del navegador. Esta función heredada no equivale al conjunto de protecciones del navegador oficial Tor Browser.

# Minirreproductor

Configuración → Aspecto visual permite activar el minirreproductor automático. Utiliza el PiP nativo de Chromium al abandonar una pestaña con vídeo en reproducción compatible. Conserva los permisos por sitio, las restricciones de ventanas privadas y la comprobación de seguridad de la URL. Puede pedir autorización del sitio la primera vez. Los controles nativos incluyen reproducción/pausa, salto de diez segundos hacia delante y atrás cuando el vídeo permite buscar, volver a la pestaña y ocultar la ventana sin enfocar la pestaña. No se garantiza en todos los reproductores, vídeos incrustados, emisiones en directo o contenido protegido.

# Perfil y búsqueda (0.7.0)

El primer inicio ofrece importar datos, cambiar nombre y foto del perfil y gestionar contraseñas mediante las herramientas nativas. El botón Perfil y sincronización vuelve a abrir el asistente. La sincronización heredada genera códigos, pero las pruebas de conexión informaron error de servidor; esta compilación no incorpora una clave de servicios autorizada. No se ha validado transferencia de marcadores ni contraseñas entre equipos.

Google se selecciona una vez como buscador de inicio, ventanas normales y privadas; después se conserva la elección del usuario. Tor mantiene su configuración separada. El botón de medio círculo del lateral alterna el mismo modo oscuro forzado de Aspecto visual. Los sitios añadidos al panel reciben inicialmente protección nativa activa con filtrado agresivo; los cambios posteriores por sitio se respetan. No se garantiza eliminar todos los anuncios de YouTube.

La caché experimental DAT de filtros queda desactivada: en un perfil nuevo su espera del catálogo impedía cargar incluso los filtros personalizados. El bloqueo sigue usando el motor nativo; las pruebas no desactivan Shields. Las listas descargadas se vuelven a procesar al iniciar.
