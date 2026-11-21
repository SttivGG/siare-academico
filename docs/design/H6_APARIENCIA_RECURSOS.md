# Recursos locales de Apariencia

Verificados individualmente el 21 de noviembre de 2026. Las cuatro páginas indican licencia gratuita Pexels y las dimensiones originales que coinciden con los archivos descargados. La [licencia Pexels](https://www.pexels.com/license/) permite descarga, uso web y modificación; se conservan autor y procedencia aunque no exige atribución. No se atribuye patrocinio, no se redistribuyen originales como catálogo fotográfico y no se utilizan las fotos como marca.

| Fondo | Autor y página | Original verificado | WebP 1920 × 1080 | Miniatura 360 × 210 |
| --- | --- | --- | --- | --- |
| Biblioteca moderna | [Marcus Lenk](https://www.pexels.com/photo/modern-library-interior-18587779/) | 7780 × 5187 | 78.020 bytes | 7.074 bytes |
| Estudio minimalista | [Mikhail Nilov](https://www.pexels.com/photo/a-laptop-on-table-with-books-beside-window-7594652/) | 6000 × 4000 | 128.654 bytes | 8.166 bytes |
| Aprendizaje colaborativo | [Yusuf Çelik](https://www.pexels.com/photo/students-studying-in-modern-library-setting-35545648/) | 4480 × 5952 | 161.326 bytes | 8.668 bytes |
| Sala de lectura | [Ludovic Delot](https://www.pexels.com/photo/modern-library-lounge-with-books-and-seating-37349911/) | 3672 × 2066 | 230.806 bytes | 11.194 bytes |

Las cuatro imágenes completas suman 598.806 bytes. No se guardan los originales JPEG de varios MB en la aplicación. El fondo educativo aprobado se conserva byte por byte; solo se deriva su miniatura. «Sin imagen» no descarga una fotografía. Los recursos publicados están en `frontend/public/images/backgrounds/`; la aplicación utiliza rutas locales y una lista cerrada de identificadores.

Cada miniatura utiliza carga diferida, dimensiones reservadas y decodificación asíncrona. Seleccionar un fondo solicita solo su WebP completo; no se precargan las otras imágenes completas. La versión vertical de Yusuf Çelik se recorta al ambiente de trabajo con los colores originales. Los tamaños, origen de descarga, resolución y transformación exacta constan en [assets.json](evidencias/h6-appearance/assets.json).

El fondo educativo heredado mide 1536 × 1024 y 62.294 bytes; fue generado con `image_gen` en la fase de landing, según [su procedencia ya registrada](evidencias/h6-landing/README.md). No se atribuye a Pexels. Su miniatura nueva mide 360 × 210 y 6.746 bytes. Los nueve WebP añadidos suman 640.654 bytes.
