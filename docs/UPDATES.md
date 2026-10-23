# Publicar una actualización

Repositorio del canal: ElmerHerreraC/veyrion-browser.

1. Cambiar de forma coherente la versión en package.json, installer/veyrion.iss y extension/update-config.json.
2. Mantener la misma clave pública incorporada en el navegador. La clave privada se guarda únicamente en artifacts/update-signing/private.pem y debe tener una copia de respaldo privada. Nunca subirla a GitHub ni incluirla en el instalador.
3. Ejecutar las pruebas y la canalización de compilación. El instalador se genera en dist/Veyrion-Setup-x64.exe. package-native.ps1 registra su versión y SHA256 en release-build.json; sign-update.mjs rechaza discrepancias antes de crear el manifiesto firmado.
4. Crear una GitHub Release estable con etiqueta v seguida de la versión, por ejemplo v0.2.0.
5. Subir exactamente el instalador validado, Veyrion-Setup-x64.exe.sha256 y veyrion-update.json de esa misma ejecución. Mantener los nombres de archivo.
6. Publicar la Release como versión más reciente. El cliente comprobará la firma, el repositorio, la versión, la URL del instalador y su SHA256 antes de ofrecer una descarga.

La consulta automática ocurre al iniciar y cada seis horas. También se puede solicitar desde Configuración rápida → Actualizar. No hay instalación silenciosa: el usuario guarda la descarga verificada y ejecuta el instalador. Los sitios y extensiones ajenos no tienen acceso a la clave de publicación.

Si se pierde la clave privada, será necesario un plan de rotación y distribuir una versión que incorpore la nueva clave por un canal de confianza. No regenerar la clave automáticamente.

La firma RSA del manifiesto verifica al editor para Veyrion. Windows SmartScreen y los antivirus aplican sus propias políticas; esta firma no sustituye Authenticode.

Después de publicar, ejecuta node tools/verify-release.mjs para contrastar la firma y el SHA-256 del archivo público con el instalador local.

