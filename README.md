# Veyrion Browser

Navegador independiente para Windows x64 basado en Brave Core y Chromium. Interfaz propia inspirada en Opera GX. Wallet, Rewards, Leo y VPN están excluidos mediante opciones GN.

## Estado

En 0.8.1 el inicio retira accesos rápidos, notas y promociones; coloca reloj y fecha en cabecera, usa el logo local de Google y muestra los favicons locales de los recientes, con símbolo neutro cuando no hay icono. Personalizar reúne fondo, sonido y diseño con enlaces directos a ventana, barra lateral, punteros, actualizaciones y perfil. Se eliminan los controles laterales y de actualización duplicados del panel del inicio.

La versión 0.8.0 añade cursores nativos por perfil y PNG propios (hasta 128 × 128, 100 KB, con punto de clic ajustable), bloqueo agresivo predeterminado y progreso de descarga con errores visibles. El clic de instalación espera una comprobación automática en curso en lugar de descartarse. No modifica el esquema de cursores de Windows.

La versión 0.7.1 corrige el cierre al arrastrar iconos por huecos de la barra lateral y añade botones de tableros y modo oscuro forzado en la barra lateral, muestra el indicador de actualización solo cuando existe una versión nueva y selecciona Google una vez para búsquedas normales y privadas. El asistente inicial permite importar datos y configurar el perfil local. La sincronización entre equipos queda pendiente: el servidor heredado devuelve un error y esta compilación carece de una clave de servicios autorizada. Conserva paneles en segundo plano, recientes, fondos locales y minirreproductor nativo. Descarga el instalador en [Releases](https://github.com/ElmerHerreraC/veyrion-browser/releases/latest).

## Interfaz

Las funciones nuevas y sus límites se describen en [Barra lateral, tableros y fondos](docs/SIDEBAR.md). Los tableros conservan conjuntos de pestañas por ventana; no son espacios dentro de una única ventana como en Opera GX.

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

Una tarea de Windows para el usuario consulta versiones firmadas cada 15 minutos y al iniciar sesión, sin crear ventanas de consola. Desde 0.6.0, el usuario solicita la instalación en Configuración → Aspecto visual → Actualizaciones; se descarga en segundo plano y se aplica al cerrar Veyrion. El botón de descarga lateral aparece únicamente si hay una actualización más reciente disponible o en curso. Verifica RSA-SHA256, URL, tamaño y SHA-256 y rechaza retrocesos. No envía perfiles ni historial. Véase [Actualizaciones](docs/UPDATES.md).

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
