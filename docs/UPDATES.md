# Actualizaciones de Veyrion

El instalador registra una tarea para el usuario actual, sin permisos de administrador ni contraseñas guardadas. Consulta GitHub al iniciar sesión y cada 15 minutos. Necesita conexión a Internet y la sesión del usuario abierta. No necesita Node.js en la laptop.

Cada actualización debe llevar una firma RSA-SHA256 verificable con la clave pública incluida en la instalación. El actualizador comprueba el repositorio, la versión, la URL exacta, el tamaño y SHA-256 del instalador. Una firma inválida, un archivo alterado o una versión anterior no se ejecutan. Los errores quedan en `%LOCALAPPDATA%\Veyrion\Updates\status.json` y se reintentan en la siguiente comprobación.

La descarga se realiza en segundo plano. Si Veyrion está abierto, espera a su cierre normal antes de iniciar el instalador silencioso. No termina procesos, reinicia Windows ni elimina el perfil. La tarea se elimina al desinstalar Veyrion.

Brave y Chromium son dependencias fijadas en `config/upstream.json`. Una actualización del motor requiere revisar los cambios, actualizar esas referencias, volver a aplicar las integraciones de Veyrion, compilar y superar las pruebas antes de firmar y publicar una nueva versión de Veyrion. El actualizador no ejecuta instaladores de Brave. Esta integración requiere mantenimiento; una nueva versión upstream no garantiza compatibilidad automática.

Antes de publicar: ejecutar pruebas unitarias, pruebas nativas de navegación/extensiones/paneles/apariencia, prueba del modo oscuro web, comprobación de permisos AppContainer, prueba de instalación y registro de tarea, y una prueba prolongada de estabilidad. Conservar las atribuciones y licencias upstream.

## Publicación del canal

Mantener sincronizadas las versiones de `package.json`, `extension/manifest.json`, `extension/update-config.json` e `installer/veyrion.iss`. `tools/package-native.ps1` prepara el actualizador con la clave pública de `extension/update-config.json`. `tools/sign-update.mjs` firma el recibo del instalador usando la clave privada existente en `artifacts/update-signing/private.pem`; esa clave nunca debe publicarse ni reemplazarse para instalaciones existentes. Si falta, recuperar la copia del editor antes de publicar. Una clave nueva no autoriza actualizaciones para los usuarios existentes.

Publicar en el tag `v<versión>` los tres archivos de `dist`: `Veyrion-Setup-x64.exe`, `Veyrion-Setup-x64.exe.sha256` y `veyrion-update.json`. Marcar la publicación estable como latest y ejecutar `node tools/verify-release.mjs` para verificar firma, versión, tamaño y hash del canal público. El manifiesto firmado no sustituye una firma Authenticode de Windows.

## Modo oscuro web

En `chrome://settings/appearance`, activar **Forzar modo oscuro en páginas web**. Usa `webkit.webprefs.force_dark_mode_enabled`, observado por las pestañas del navegador y persistido por perfil. No depende del modo claro/oscuro de la ventana ni de scripts que lean el contenido de las páginas. Algunos sitios pueden verse mal; desactivarlo restaura su representación normal. Puede ser necesario recargar una pestaña abierta.
