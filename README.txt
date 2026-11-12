# S.Study's — Etapa 2: Tutor IA

## Incluye
- Interfaz web adaptable y PWA.
- Biblioteca de fórmulas y calculadora local.
- Tutor IA mediante OpenAI Responses API.
- Entrada de imágenes (visión) y documentos PDF, TXT, Markdown, DOCX, PPTX, XLSX y CSV.
- OCR local opcional en fotografías para extraer texto además de enviar la imagen original.
- Búsqueda web habilitada en solicitudes que contienen una URL pública.
- Controles básicos de seguridad: clave solo en servidor, Helmet, límite de solicitudes y límites de tamaño.

## Requisitos
- Node.js 20 o superior.
- Proyecto de OpenAI Platform con facturación y acceso a un modelo compatible con visión y archivos.
- Navegador moderno.

## Ejecutar localmente
1. Descomprime el ZIP.
2. Abre una terminal dentro de la carpeta `SStudys`.
3. Ejecuta `npm install`.
4. Configura tu clave de API:
   - macOS/Linux: `export OPENAI_API_KEY="TU_CLAVE"`
   - PowerShell: `$env:OPENAI_API_KEY="TU_CLAVE"`
5. (Opcional) selecciona el modelo: `OPENAI_MODEL="gpt-6-astra"`.
6. Ejecuta `npm start`.
7. Ejecuta `npm start`.
8. Abre `http://localhost:3000`. El mismo servidor entrega la web y el endpoint `/api/ask`, por lo que no debes cambiar `API_URL`.
9. Para producción, publica este servidor detrás de HTTPS y usa el mismo dominio para la web y la API.

## Importante
- Nunca pegues la API Key en `index.html`, GitHub público o mensajes.
- El nombre del modelo predeterminado es `gpt-6-astra`, según los ejemplos actuales de la documentación oficial consultada. Si tu proyecto no tiene acceso a ese modelo, configura `OPENAI_MODEL` con un modelo habilitado que admita los tipos de entrada que necesitas.
- Los PDF y documentos se envían a la API como archivos; el uso de archivos e imágenes puede incrementar el costo.
- La búsqueda web intenta consultar URLs públicas. No garantiza acceso a páginas con inicio de sesión, paywall, enlaces temporales, robots o restricciones geográficas.
- Esta es una base funcional de desarrollo, no una aplicación lista para producción. Antes de publicar para terceros, añade autenticación, aislamiento por usuario, cuotas, almacenamiento privado, política de privacidad, borrado de archivos, observabilidad y pruebas de seguridad.
- El historial de conversación se guarda localmente en el navegador del dispositivo mediante localStorage. No se sincroniza entre dispositivos. Los archivos adjuntos no se guardan como biblioteca permanente.
