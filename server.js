import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import OpenAI from "openai";
import dotenv from "dotenv";
import {
  transcribeAudio,
  generateResponse,
  textToSpeech,
} from "./backend/openai.js";

dotenv.config({ path: ".env.local" });

const app = express();
const httpServer = createServer(app);

// Create WebSocket server with path
const wss = new WebSocketServer({
  server: httpServer,
  path: "/openai-audio", // Match the client path
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Enable CORS
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Store active agents
const activeAgents = new Map();

// Test endpoint
app.get("/api/test", (req, res) => {
  console.log("Test endpoint hit");
  res.json({ status: "ok", message: "Server is running" });
});

// Serve static files
app.use(express.static("."));

// API endpoints
app.post("/api/agent/create", async (req, res) => {
  console.log("Create agent request received");
  try {
    const agent = await createBackendAgent();
    const agentId = Date.now().toString();
    activeAgents.set(agentId, agent);

    console.log(`Agent created with ID: ${agentId}`);
    res.json({
      agentId,
      status: "created",
    });
  } catch (error) {
    console.error("Error creating agent:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/agent/stop", async (req, res) => {
  const { agentId } = req.body;
  const agent = activeAgents.get(agentId);

  if (!agent) {
    return res.status(404).json({ error: "Agent not found" });
  }

  try {
    await agent.stop();
    activeAgents.delete(agentId);
    res.json({ status: "stopped" });
  } catch (error) {
    console.error("Error stopping agent:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/analyze", async (req, res) => {
  const { agentId, code, language, question } = req.body;
  const agent = activeAgents.get(agentId);

  if (!agent) {
    return res.status(404).json({ error: "Agent not found" });
  }

  try {
    const analysis = await agent.analyzeCode({ code, language, question });
    res.json(analysis);
  } catch (error) {
    console.error("Error analyzing code:", error);
    res.status(500).json({ error: error.message });
  }
});

// Transcribe audio to text
app.post("/api/transcribe", async (req, res) => {
  try {
    const { audio } = req.body;
    const text = await transcribeAudio(audio);
    res.json({ text });
  } catch (error) {
    console.error("Transcription error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get AI chat response
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const reply = await generateResponse(message);
    res.json({ reply });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Convert text to speech
app.post("/api/speak", async (req, res) => {
  try {
    const { text } = req.body;
    const audioBuffer = await textToSpeech(text);
    res.type("audio/mpeg");
    res.send(audioBuffer);
  } catch (error) {
    console.error("Speech error:", error);
    res.status(500).json({ error: error.message });
  }
});

// WebSocket handling
wss.on("connection", (ws) => {
  console.log("New WebSocket connection established");
  let audioBlob = null;
  let format = null;

  ws.on("message", async (message) => {
    try {
      if (message instanceof Buffer) {
        // This is the audio data
        audioBlob = new Blob([message], { type: `audio/${format}` });
        console.log("Received audio blob, size:", audioBlob.size);
      } else {
        const data = JSON.parse(message.toString());
        console.log("Received message type:", data.type);

        if (data.type === "start") {
          format = data.format;
          console.log("Starting new audio interaction, format:", format);
        } else if (data.type === "end") {
          console.log("Processing audio...");
          try {
            if (!audioBlob) {
              throw new Error("No audio data received");
            }

            console.log("Starting transcription...");
            const transcription = await openai.audio.transcriptions.create({
              file: audioBlob,
              model: "whisper-1",
            });

            console.log("Transcription:", transcription.text);

            // Get AI response
            const completion = await openai.chat.completions.create({
              model: "gpt-4-turbo-preview",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a programming mentor helping users learn and improve their coding skills.",
                },
                {
                  role: "user",
                  content: transcription.text,
                },
              ],
              temperature: 0.7,
              max_tokens: 150,
            });

            const responseText = completion.choices[0].message.content;
            console.log("AI response:", responseText);

            // Send text response
            ws.send(
              JSON.stringify({
                type: "text",
                content: responseText,
              })
            );

            // Convert to speech
            console.log("Converting to speech...");
            const speech = await openai.audio.speech.create({
              model: "tts-1",
              voice: "nova",
              input: responseText,
            });

            // Send audio response
            const audioBuffer = Buffer.from(await speech.arrayBuffer());
            ws.send(audioBuffer);

            // Reset for next interaction
            audioBlob = null;
            format = null;
          } catch (error) {
            console.error("Processing error:", error);
            ws.send(
              JSON.stringify({
                type: "error",
                message: error.message,
              })
            );
          }
        }
      }
    } catch (error) {
      console.error("WebSocket error:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: error.message,
        })
      );
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    audioBlob = null;
    format = null;
  });
});

// Helper function to convert raw audio data to WAV format
function convertToWav(buffer) {
  // Simple WAV header for 16-bit mono PCM at 44.1kHz
  const header = Buffer.alloc(44);

  // RIFF chunk descriptor
  header.write("RIFF", 0);
  header.writeUInt32LE(buffer.length + 36, 4);
  header.write("WAVE", 8);

  // fmt sub-chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(44100, 24);
  header.writeUInt32LE(44100 * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);

  // data sub-chunk
  header.write("data", 36);
  header.writeUInt32LE(buffer.length, 40);

  return Buffer.concat([header, buffer]);
}

const port = process.env.PORT || 3000;
httpServer.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(
    `Active routes:`,
    app._router.stack
      .filter((r) => r.route)
      .map((r) => `${Object.keys(r.route.methods)} ${r.route.path}`)
  );
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: err.message });
});
