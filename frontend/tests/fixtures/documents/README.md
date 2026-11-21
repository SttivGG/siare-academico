# PDF sintéticos para regresión de cliente

Tres archivos de `services/content-ai/tests/fixture_factory.py`, generados previamente por el flujo oficial `scripts/Test-Phase2.ps1`. El contenido académico y la imagen solo dicen «Aprender ciencias con SIARE»; el tercer archivo está vacío. No contienen documentos personales ni credenciales.

`playwright.release.config.ts` los copia a `.cache/phase2-fixtures/` del worktree para que las suites existentes los encuentren. El proveedor HTTP de release conserva los bytes en memoria y devuelve los estados/textos controlados; esta corrida no ejecuta extracción u OCR reales. El generador Python es la fuente de procedencia, no una dependencia nueva del frontend.
