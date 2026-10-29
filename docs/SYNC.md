# Sync en Veyrion

Veyrion conserva el cliente cifrado de Brave Sync. La última prueba de dos perfiles no pudo sincronizar contra el servicio predeterminado. La compilación no incluye una clave de servicios autorizada para Veyrion; el cliente adjunta `BRAVE_SERVICES_KEY` en sus solicitudes (`brave/components/sync/service/brave_sync_auth_manager.cc`). El código abierto no concede automáticamente acceso al servicio alojado.

Para habilitarlo se necesita acceso autorizado por Brave o desplegar un servicio compatible y configurar un endpoint HTTPS propio. El cliente ya admite `--sync-url` y una política de URL personalizada. No se extraen ni reutilizan credenciales de otra distribución, ni se desactiva el cifrado. No hay servidor propio desplegado ni sincronización entre equipos verificada. La importación local de Samsung no equivale a Sync.

Antes de anunciar Sync: comprobar con dos perfiles temporales una cadena nueva, un marcador y una contraseña ficticios, edición y eliminación, reinicio y recuperación de la conexión. Nunca usar contraseñas reales ni publicar palabras de la cadena en los informes.
