// Browser-compatible version using OpenAI WebSocket
let activeAgent = null;

export const createAgent = async () => {
  try {
    console.log("Creating agent...");

    // Initialize audio
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks = [];

    // Create WebSocket connection
    const ws = new WebSocket("ws://localhost:3000/openai-audio");

    await new Promise((resolve, reject) => {
      ws.onopen = () => {
        console.log("WebSocket connection established");
        resolve();
      };
      ws.onerror = reject;
    });

    activeAgent = {
      id: Date.now().toString(),
      status: "active",
      stream,
      mediaRecorder,
      ws,
      audioChunks,

      startListening() {
        console.log("Starting to listen...");
        this.audioChunks.length = 0; // Clear previous chunks

        this.mediaRecorder.ondataavailable = (event) => {
          this.audioChunks.push(event.data);
        };

        this.mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
          console.log("Audio recorded, size:", audioBlob.size);
          window.addVoiceMessage(
            `Recorded audio (${(audioBlob.size / 1024).toFixed(1)}KB)`,
            "system"
          );

          // Send the audio data
          this.ws.send(
            JSON.stringify({
              type: "start",
              format: "webm",
            })
          );

          // Send the audio blob
          this.ws.send(audioBlob);

          // Send end marker
          this.ws.send(JSON.stringify({ type: "end" }));
        };

        this.mediaRecorder.start(100); // Collect 100ms chunks
      },

      stopListening() {
        console.log("Stopping recording...");
        if (this.mediaRecorder.state === "recording") {
          this.mediaRecorder.stop();
        }
      },
    };

    // Handle incoming messages
    activeAgent.ws.onmessage = async (event) => {
      try {
        if (event.data instanceof Blob) {
          console.log("Received audio response");
          window.addVoiceMessage("Received audio response", "system");
          const audioUrl = URL.createObjectURL(event.data);
          const audio = new Audio(audioUrl);

          audio.oncanplaythrough = () => {
            window.addVoiceMessage("Playing response...", "system");
            audio.play().catch((error) => {
              console.error("Audio play error:", error);
              window.addVoiceMessage(
                `Audio play error: ${error.message}`,
                "error"
              );
            });
          };

          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            window.updateVoiceStatus("Click to start recording");
          };
        } else {
          const data = JSON.parse(event.data);
          if (data.type === "text") {
            console.log("Assistant:", data.content);
            window.addVoiceMessage(data.content, "assistant");
          } else if (data.type === "error") {
            console.error("Server error:", data.message);
            window.addVoiceMessage(`Server error: ${data.message}`, "error");
          }
        }
      } catch (error) {
        console.error("Error handling message:", error);
        window.addVoiceMessage(`Error: ${error.message}`, "error");
      }
    };

    return activeAgent;
  } catch (error) {
    console.error("Error creating agent:", error);
    throw error;
  }
};

export const stopAgent = async () => {
  try {
    if (activeAgent) {
      if (activeAgent.mediaRecorder.state === "recording") {
        activeAgent.mediaRecorder.stop();
      }
      activeAgent.stream.getTracks().forEach((track) => track.stop());
      if (activeAgent.ws.readyState === WebSocket.OPEN) {
        activeAgent.ws.close();
      }
      activeAgent = null;
    }
  } catch (error) {
    console.error("Error stopping agent:", error);
    throw error;
  }
};
