# Veyrion Browser

Navegador independiente para Windows x64 basado en Brave Core y Chromium. Interfaz propia inspirada en Opera GX. Wallet, Rewards, Leo y VPN están excluidos mediante opciones GN.

## Estado

La versión local 0.1.0 terminó sus pruebas e instalación. La versión 0.2.0 incorpora una barra lateral nativa a la izquierda y actualizaciones firmadas desde GitHub; se está compilando y comprobando. No debe considerarse publicada hasta que exista su Release con el instalador y el manifiesto firmado.

## Interfaz

- Barra lateral nativa persistente: marcadores, historial y lista de lectura.
- Paneles web para WhatsApp, Telegram, Discord, Twitch y Spotify, que se abren al seleccionarlos. Cada servicio mantiene sus propios requisitos de acceso y reproducción.
- Color de acento sincronizado con pestañas y barra de herramientas; borde lateral sigue el tema.
- Inicio con fondos propios, luminosidad, desenfoque, efectos, sonidos, música ambiental, notas y ambientes importables/exportables.

La apariencia está inspirada en Opera GX. No se distribuyen sus recursos propietarios ni se promete compatibilidad con sus paquetes de mods. Los efectos y sonidos actuales pertenecen al inicio; los paneles y el tema nativo permanecen al navegar.

## Actualizaciones

El componente interno consulta cada seis horas el canal público de GitHub Releases. Comprueba una firma RSA-SHA256 con clave pública incorporada y la huella SHA-256 y el tamaño del instalador. La descarga verificada se ofrece en Personalizar → Actualizar. El usuario ejecuta el instalador para completar la actualización conservando su perfil. No se instalan versiones inferiores ni se envían perfiles o historial a GitHub.

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
