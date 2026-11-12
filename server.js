// S.Study's — Tutor IA (Node.js 20+)
// La clave de OpenAI permanece exclusivamente en el servidor.
import express from "express";
import OpenAI from "openai";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.OPENAI_MODEL || "gpt-6-astra";

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map(x => x.trim()).filter(Boolean);

// La app y el endpoint se sirven desde el mismo origen: no hace falta habilitar CORS.
 // Se desactiva CSP aquí porque la interfaz inicial usa JavaScript inline y CDNs.
 // Antes de producción, sustituye el script inline por archivos JS y configura CSP estricto.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "same-origin" } }));
app.use(express.json({ limit: "55mb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false }));

const SYSTEM = `Eres el tutor académico de S.Study's, especialista en matemática financiera.
Enseña en español claro, con rigor, paciencia y estructura pedagógica.
Al resolver ejercicios utiliza, cuando corresponda, estos apartados:
1. Qué pide el problema.
2. Datos conocidos y unidades.
3. Incógnita.
4. Concepto financiero involucrado.
5. Fórmula y explicación de por qué aplica.
6. Definición de variables.
7. Compatibilidad de tasas y períodos (nominal/efectiva, mensual/anual,
   vencida/anticipada, capitalización y frecuencia de pagos).
8. Sustitución numérica.
9. Operaciones paso a paso.
10. Resultado, unidades e interpretación financiera.
11. Comprobación razonable y supuestos.
No inventes datos ilegibles o faltantes: pregunta antes de asumirlos. Distingue interés simple y compuesto,
valor presente y futuro, descuento, anualidades y amortización. Si hay ambigüedad de tasa o fecha focal,
explícala. No presentes una cifra como exacta si depende de supuestos. Si el usuario solo quiere entender
un concepto, utiliza analogías y ejemplos numéricos sencillos.`;

const allowedMime = new Set([
  "application/pdf", "text/plain", "text/markdown", "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);
const imageMime = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function decodeDataUrl(value) {
  if (typeof value !== "string") throw new Error("Archivo sin contenido válido.");
  const match = value.match(/^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Formato de archivo no válido.");
  return { mime: match[1].toLowerCase(), data: value };
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "S.Study's Tutor IA", model: MODEL }));

app.post("/api/ask", async (req, res) => {
  try {
    const { question, images = [], files = [] } = req.body ?? {};
    if (typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "Escribe una pregunta o ejercicio." });
    }
    if (!Array.isArray(images) || images.length > 4 || !Array.isArray(files) || files.length > 5) {
      return res.status(400).json({ error: "Máximo 4 imágenes y 5 documentos por consulta." });
    }

    const totalEncodedBytes = [...images, ...files].reduce((sum, item) =>
      sum + (typeof item?.data === "string" ? item.data.length : 0), 0);
    if (totalEncodedBytes > 50_000_000) {
      return res.status(413).json({ error: "El total de archivos supera el límite de 50 MB por consulta." });
    }
    const content = [{ type: "input_text", text: question.trim() }];

    for (const image of images) {
      const parsed = decodeDataUrl(image.data);
      if (!imageMime.has(parsed.mime)) return res.status(400).json({ error: "Imagen no compatible." });
      if (parsed.data.length > 12_000_000) return res.status(413).json({ error: "Imagen demasiado grande." });
      content.push({ type: "input_image", image_url: parsed.data, detail: "high" });
    }

    for (const file of files) {
      const parsed = decodeDataUrl(file.data);
      if (!allowedMime.has(parsed.mime)) return res.status(400).json({ error: `Tipo de documento no admitido: ${parsed.mime}` });
      if (parsed.data.length > 18_000_000) return res.status(413).json({ error: "Documento demasiado grande." });
      const safeName = String(file.name || "material").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 90);
      content.push({
        type: "input_file",
        filename: safeName,
        file_data: parsed.data,
        detail: "high"
      });
    }

    // Si el usuario incluyó una URL, habilitamos búsqueda web para intentar consultar
    // una página pública. Los sitios con login, paywall o bloqueos pueden no ser accesibles.
    const hasUrl = /https?:\/\/\S+/i.test(question);
    const response = await client.responses.create({
      model: MODEL,
      instructions: SYSTEM,
      input: [{ role: "user", content }],
      ...(hasUrl ? { tools: [{ type: "web_search" }] } : {}),
      max_output_tokens: 2200
    });

    res.json({ answer: response.output_text || "No se generó una respuesta. Intenta de nuevo." });
  } catch (error) {
    console.error("Tutor error:", error);
    const message = error?.message || "Error inesperado.";
    res.status(500).json({ error: "No fue posible procesar la consulta. Revisa el servidor y la configuración de la API.", detail: process.env.NODE_ENV === "development" ? message : undefined });
  }
});

app.use(express.static(process.cwd()));

app.listen(PORT, () => console.log(`S.Study's activa en http://localhost:${PORT} (modelo: ${MODEL})`));
