import {
  defineAgent,
  llm,
  pipeline,
  WorkerOptions,
  cli,
} from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as elevenlabs from "@livekit/agents-plugin-elevenlabs";
import * as openai from "@livekit/agents-plugin-openai";
import * as silero from "@livekit/agents-plugin-silero";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env.local");
dotenv.config({ path: envPath });

// Export the agent creation function
export const createBackendAgent = async () => {
  const agentConfig = {
    prewarm: async (proc) => {
      proc.userData.vad = await silero.VAD.load();
    },
    entry: async (ctx) => {
      const vad = ctx.proc.userData.vad;
      const initialContext = new llm.ChatContext().append({
        role: llm.ChatRole.SYSTEM,
        text:
          "You are a programming mentor focused on helping users learn and grow. Your approach should:" +
          "\n1. Ask probing questions to help users think through problems" +
          "\n2. Guide users to discover solutions themselves rather than providing direct answers" +
          "\n3. Explain concepts using analogies and examples" +
          "\n4. Encourage best practices and good coding habits" +
          "\n5. Help users understand the 'why' behind programming concepts" +
          "\n6. Break down complex problems into smaller, manageable steps" +
          "\n7. Provide hints and suggestions rather than complete solutions" +
          "\n8. Celebrate user progress and encourage learning from mistakes" +
          "\nRemember: Your goal is to empower users to become better programmers through guided discovery.",
      });

      await ctx.connect();
      console.log("Connecting to LiveKit room...");

      const participant = await ctx.waitForParticipant();
      console.log(`Connected with participant: ${participant.identity}`);

      const agent = new pipeline.VoicePipelineAgent(
        vad,
        new deepgram.STT(),
        new openai.LLM(),
        new elevenlabs.TTS(),
        {
          chatCtx: initialContext,
          env: {
            GROQ_API_KEY: process.env.GROQ_API_KEY,
            GROQ_API_ENDPOINT: process.env.GROQ_API_ENDPOINT,
          },
        }
      );

      agent.start(ctx.room, participant);
      await agent.say(
        "Hi I'm Alex your programming mentor. What would you like to learn about today?",
        true
      );

      return agent;
    },
  };

  return await defineAgent(agentConfig);
};
