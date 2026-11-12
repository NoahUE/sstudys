// S.Study's — Tutor IA con Gemini (Node.js 20+)
// La clave GEMINI_API_KEY permanece exclusivamente en el servidor.
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.GEMINI_MODEL || "gemini-3.7-flash";
const API_KEY = process.env.GEMINI_API_KEY;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "same-origin" }
}));
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

function parseDataUrl(value) {
  if (typeof value !== "string") throw new Error("Archivo sin contenido válido.");
  const match = value.match(/^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Formato de archivo no válido.");
  return { mime: match[1].toLowerCase(), base64: match[2] };
}

app.get("/health", (_req, res) => res.json({
  ok: true,
  service: "S.Study's Tutor IA",
  provider: "Google Gemini",
  model: MODEL,
  keyConfigured: Boolean(API_KEY)
}));

app.post("/api/ask", async (req, res) => {
  try {
    if (!API_KEY) return res.status(503).json({ error: "Falta configurar GEMINI_API_KEY en las variables de entorno del servidor." });
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

    const parts = [{ text: question.trim() }];
    for (const image of images) {
      const parsed = parseDataUrl(image.data);
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(parsed.mime)) {
        return res.status(400).json({ error: "Formato de imagen no compatible." });
      }
      if (parsed.base64.length > 7_000_000) return res.status(413).json({ error: "Imagen demasiado grande." });
      parts.push({ inline_data: { mime_type: parsed.mime, data: parsed.base64 } });
    }

    for (const file of files) {
      const parsed = parseDataUrl(file.data);
      if (parsed.base64.length > 12_000_000) return res.status(413).json({ error: "Documento demasiado grande." });
      if (parsed.mime === "application/pdf") {
        parts.push({ inline_data: { mime_type: parsed.mime, data: parsed.base64 } });
      } else if (["text/plain", "text/markdown", "text/csv"].includes(parsed.mime)) {
        const decoded = Buffer.from(parsed.base64, "base64").toString("utf8");
        parts.push({ text: `Contenido del archivo ${String(file.name || "material").slice(0, 100)}:\n${decoded.slice(0, 100000)}` });
      } else {
        return res.status(415).json({ error: `Por ahora Gemini acepta imágenes, PDF y archivos de texto. Este formato no está habilitado: ${parsed.mime}. Puedes convertirlo a PDF.` });
      }
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 3000 }
      })
    });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("Gemini API error:", upstream.status, result?.error?.message || "unknown");
      const status = upstream.status === 429 ? 429 : upstream.status === 400 ? 400 : 502;
      return res.status(status).json({ error: upstream.status === 429
        ? "Se alcanzó el límite gratuito temporal de Gemini. Espera un momento y vuelve a intentar."
        : "Gemini no pudo procesar la consulta. Revisa el modelo, la clave y los límites de tu cuenta." });
    }
    const answer = (result.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "").join("\n").trim();
    if (!answer) return res.status(502).json({ error: "Gemini no devolvió texto. Intenta de nuevo con una pregunta más corta." });
    res.json({ answer });
  } catch (error) {
    console.error("Tutor error:", error);
    res.status(500).json({ error: "No fue posible procesar la consulta. Revisa los archivos y la configuración del servidor." });
  }
});

app.use(express.static(process.cwd()));
app.listen(PORT, "0.0.0.0", () => console.log(`S.Study's activa en puerto ${PORT} (Gemini: ${MODEL})`));
