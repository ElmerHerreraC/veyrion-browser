# Servicios heredados: revisión de Veyrion 0.8.5 / corrección 0.8.6

Esta revisión distingue una función visible de una conexión comprobada. No se
considera operativa una función solo porque su pantalla se abra.

| Función | Evidencia | Estado |
| --- | --- | --- |
| Instalación de extensiones | Perfil vacío: Bitwarden habilitado y descarga oficial HTTP 200, informe `webstore-install-verification.json` | Corregida y comprobada en 0.8.5 |
| Actualización de extensiones | Se separó `ChromeUpdateClientConfig` del override de componentes | Corregida en código; falta observar una actualización real de versión |
| Componentes estándar, certificados y Widevine | El proxy de consulta rechazaba solicitudes y el proxy de descargas reescribía los paquetes Google | Corregido en 0.8.6; nueve componentes instalados mediante el actualizador nativo en un perfil vacío |
| Oferta oficial de Widevine | Consulta sin claves ni datos personales al servicio Google, protocolo 4.0, Windows x64: HTTP 200, versión ofrecida 4.10.3112.0 | Confirma disponibilidad de descarga, no reproducción ni aceptación de licencias de vídeo |
| Catálogo y biblioteca de recursos del bloqueador | Componentes exclusivos Brave afectados por el mismo proxy; cambiar a Google no crea esos paquetes | Pendientes de una fuente autorizada; no se declara paridad con Brave |
| Listas de bloqueo directas | EasyList, EasyPrivacy, español y quick-fixes descargadas; prueba de bloqueo en pestaña y lateral con recursos normales permitidos | Operativas en la prueba 0.8.5, independientes del catálogo |
| Sincronización | Endpoint heredado sync-v2.brave.com; no hay servicio autorizado habilitado para Veyrion | Pendiente y anunciado como no disponible; no prometer sincronización por generar códigos |
| Traducción integrada | Dependencia de translate.brave.com; fallo anterior de acceso | Pendiente; alternativa explícita Google para páginas públicas, sin afirmar traducción nativa |
| Ads, fondos patrocinados y P3A | Siguen apareciendo registros de componentes heredados aunque no forman parte de las funciones solicitadas | Revisar su registro; no usarlos para aparentar soporte ni redirigir paquetes a otra identidad |
| Safe Browsing | El registro de prueba muestra consultas a safebrowsing.brave.com y sb-ssl.brave.com con un token de desarrollo; no hay respuesta de listas verificada | Requiere comprobar acceso autorizado y actualización real; no se declara protección en línea comprobada |
| Geolocalización, autocompletado remoto e iconos remotos | El helper heredado conserva redirecciones a servicios de Brave | Dependencias detectadas, funcionamiento no verificado; no se sustituyen endpoints sin contrato compatible |
| Contraseñas y marcadores locales | No requieren Sync para guardar datos en el equipo | Independientes del acceso al servidor Sync; la auditoría no lee ni prueba datos privados |
| Tor | La interfaz no demuestra descarga del cliente ni establecimiento de circuito | No verificado en esta revisión; no afirmar anonimato operativo |
| Actualizaciones Veyrion | Release 0.8.5: firma de manifiesto, digest público y descarga comprobados | Canal propio operativo; publicación no demuestra una actualización automática completa en todos los equipos |

La corrección de componentes conserva CUP y la verificación CRX; exige HTTPS.
No utiliza claves de otros productos, no copia CDM de otro navegador y no
modifica las versiones registradas para ocultar una descarga fallida.

La comprobación ampliada instaló PKI Metadata 1830, Crowd Deny 2026.11.5.146,
Certificate Error Assistant 7, CRLSet 10889, Hyphenation 120.0.6050.0,
Safety Tips 3092, File Type Policies 145.0.7584.0, Widevine 4.10.3112.0
y Zxcvbn Data Dictionaries 3. OnDeviceHeadSuggest quedó sin versión descargada
en esa muestra; no se declara corregido. El registro de versiones está en el
informe local `artifacts/component-verification-086.json`.

La reproducción DRM también puede requerir reconocimiento del navegador por
el proveedor; instalar Widevine no garantiza por sí solo Crunchyroll/Netflix.
