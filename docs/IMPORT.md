# Importar datos en Veyrion

En Configuración → Comenzar → Importar favoritos y configuración se muestran los perfiles detectados y las opciones **Brave**, **Opera**, **Opera GX** y **Firefox (seleccionar carpeta)**. La selección manual sirve también para instalaciones portátiles o perfiles que no se detectan.

Cierra el navegador de origen antes de importar. Para navegadores Chromium, selecciona el perfil que contiene `Bookmarks`, `History` y `Web Data`; normalmente se llama `Default` o `Profile 1`. También se acepta la carpeta `User Data` cuando contiene `Default`. Opera puede guardar esos archivos directamente en `Opera Stable` u `Opera GX Stable`. En Firefox elige el perfil que contiene `places.sqlite`, dentro de `Mozilla\Firefox\Profiles`. No selecciones la carpeta de instalación del programa.

Se importan únicamente los elementos seleccionados y compatibles. La selección manual ofrece favoritos e historial y, para perfiles Chromium, autocompletado disponible. Los perfiles detectados automáticamente conservan los servicios que admite el importador nativo. No se promete importar cookies, sesiones iniciadas ni todas las extensiones.

## Contraseñas

El mismo diálogo ofrece **Importar contraseñas desde CSV**, que abre el administrador nativo. Exporta el CSV desde el navegador de origen y selecciona el archivo allí. En Windows, Veyrion verifica tu identidad antes de abrir el selector de contraseñas; cancelar o no superar la verificación cancela la operación. No requiere permisos de administrador.

No se intenta eludir el cifrado de otros navegadores. En Windows, la importación directa de contraseñas de Brave no está disponible mediante este importador. El CSV contiene contraseñas sin cifrar: no lo envíes por el chat ni lo subas al repositorio y elimínalo cuando hayas terminado de importarlo.

## Sincronización

La importación es local y no sincroniza equipos. El servicio de Sync sigue pendiente de acceso autorizado o de un servidor propio. La pantalla de configuración lo indica y no ofrece crear cadenas que esta compilación no puede conectar.
