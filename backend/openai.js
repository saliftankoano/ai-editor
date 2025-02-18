import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function transcribeAudio(base64Audio) {
  const response = await openai.audio.transcriptions.create({
    file: Buffer.from(base64Audio, "base64"),
    model: "whisper-1",
  });

  return response.text;
}

export async function generateResponse(message) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content:
          "You are a programming mentor focused on helping users learn and grow. Your approach should:" +
          "\n1. Ask probing questions to help users think through problems" +
          "\n2. Guide users to discover solutions themselves rather than providing direct answers" +
          "\n3. Explain concepts using analogies and examples" +
          "\n4. Encourage best practices and good coding habits" +
          "\n5. Help users understand the 'why' behind programming concepts" +
          "\n6. Break down complex problems into smaller, manageable steps" +
          "\n7. Provide hints and suggestions rather than complete solutions" +
          "\n8. Celebrate user progress and encourage learning from mistakes" +
          "\nKeep responses concise and conversational, as they will be spoken.",
      },
      {
        role: "user",
        content: message,
      },
    ],
    max_tokens: 150,
  });

  return completion.choices[0].message.content;
}

export async function textToSpeech(text) {
  const mp3 = await openai.audio.speech.create({
    model: "tts-1",
    voice: "nova",
    input: text,
  });

  const buffer = Buffer.from(await mp3.arrayBuffer());
  return buffer;
}
