import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "placeholder", // Will fail gracefully if not set
});

// API routes FIRST
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, systemPrompt } = req.body;
    
    if (!process.env.GROQ_API_KEY) {
      return res.status(400).json({ error: "GROQ_API_KEY is not set in environment variables." });
    }

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt || "You are a helpful assistant." },
        ...messages
      ],
      model: "llama3-8b-8192", // Fast and free tier model
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 1,
      stream: false,
    });

    res.json({ response: chatCompletion.choices[0]?.message?.content || "" });
  } catch (error: any) {
    console.error("Groq API Error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch from Groq API" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
