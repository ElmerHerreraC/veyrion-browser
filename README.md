# Veyrion Browser

Navegador independiente para Windows x64 basado en Brave Core y Chromium. Interfaz propia inspirada en Opera GX. Wallet, Rewards, Leo y VPN están excluidos mediante opciones GN.

## Estado

La versión 0.4.1 añade modo oscuro web nativo y actualizaciones automáticas, y corrige los permisos de instalación que causaban un cierre al crear procesos AppContainer. Mantiene la personalización nativa, las extensiones Chromium y los paneles móviles. Descarga el instalador en [Releases](https://github.com/ElmerHerreraC/veyrion-browser/releases/latest).

## Interfaz

- Barra lateral nativa persistente, con la lista de lectura retirada de los accesos en 0.4.0.
- En 0.4.0, `chrome://settings/appearance` contiene los temas y controles de modo claro/automático/oscuro, color de acento, tamaño, separación, visibilidad, símbolos y orden de iconos. Se guardan como preferencias nativas del perfil y se aplican fuera de la nueva pestaña.
- En 0.4.1, la misma configuración permite forzar el modo oscuro de las páginas web de forma independiente del tema de la ventana.
- Se retiran la franja de atribución «Personalizar Brave», la promoción de Brave Origin y el acceso lateral de Brave Talk. La nueva pestaña se centra también en monitores anchos.
- Paneles web para WhatsApp, Telegram, Discord, Twitch y Spotify, que se abren al seleccionarlos. Cada servicio mantiene sus propios requisitos de acceso y reproducción.
- Color de acento sincronizado con pestañas y barra de herramientas; borde lateral sigue el tema.
- El botón + acepta direcciones HTTP/HTTPS propias. El separador del panel permite arrastrar su ancho y guardarlo; el botón Celular / Escritorio guarda la vista por página. La vista móvil adapta el viewport y el agente de usuario, pero no convierte un sitio en una aplicación Android.
- Logotipos propios en ajustes y avatares, menú con símbolo Veyrion, escudo de protección neutro y pestañas más angulares.
- Inicio angular, cristal o clásico; tamaños de accesos, opacidad y tipografía configurables. Filtros cálido, nocturno y monocromo, y sonidos opcionales de clic y teclado para páginas web.
- Inicio con fondos propios, luminosidad, desenfoque, efectos, sonidos, música ambiental, notas y ambientes importables/exportables.

La apariencia está inspirada en Opera GX. No se distribuyen sus recursos propietarios ni se promete compatibilidad con sus paquetes de mods. Los filtros web y sonidos de interacción web también funcionan al navegar; los efectos de fondo y la música ambiental siguen perteneciendo al inicio. No incluye el motor de shaders de GX, su tienda de mods ni sonidos de controles nativos. Los paneles y el tema nativo permanecen al navegar.

## Actualizaciones

Desde 0.4.1, una tarea de Windows para el usuario consulta GitHub cada 15 minutos y al iniciar sesión, descarga actualizaciones firmadas y las instala al cerrar Veyrion. Verifica RSA-SHA256, la URL del repositorio, el tamaño y SHA-256, y rechaza versiones anteriores. No envía perfiles ni historial. La descarga manual sigue disponible en Configuración rápida → Actualizar; la comprobación informativa del componente interno sigue siendo cada seis horas. Instala 0.4.1 una vez para habilitar el nuevo actualizador en instalaciones anteriores.

Los instaladores y `veyrion-update.json` se publican juntos en [Releases](https://github.com/ElmerHerreraC/veyrion-browser/releases). La firma del canal de actualizaciones no equivale a una firma Authenticode de Windows.

## Código y construcción

Este repositorio contiene la personalización y los scripts que la aplican al código oficial fijado en `config/upstream.json`. No incluye dependencias descargadas, perfiles personales ni claves privadas. La licencia de Brave Core se conserva en `LICENSE`; véase `THIRD_PARTY_NOTICES.md`.

Se necesita Windows x64, Node 24, pnpm, Git, Visual Studio 2026 Build Tools con C++ y ATL/MFC, Windows SDK 28000 y Modo de desarrollador. La primera compilación necesita bastante espacio y varias horas.

1. Clona este repositorio y Brave Core en una ruta de construcción sin espacios, por ejemplo `D:\VeyrionBuild\src\brave`, usando el tag y el commit de `config/upstream.json`.
2. Ejecuta `node --test tests/*.test.mjs` para comprobar preferencias y política de actualización.
3. Configura `config/build-machine.json` local con `{"buildRoot":"D:\\VeyrionBuild"}`.
4. Ejecuta `tools\pipeline-native.ps1 -BuildRoot D:\VeyrionBuild` para sincronizar, integrar, compilar, verificar y empaquetar.
5. Para retomar una compilación preparada usa `-ResumeCompilation`. Para retomar la distribución usa `-ResumeDistribution`.

La publicación del canal requiere la clave privada del editor. No crees una clave diferente para publicar actualizaciones destinadas a instalaciones existentes. Véase `docs/UPDATES.md`.

El instalador crea accesos que abren directamente `veyrion.exe` con icono y perfil propios. No recurre al Brave instalado. Para fijar el icono permanentemente usa «Anclar a la barra de tareas».
