const DEBUG = true;

function debug(...args) {
  if (DEBUG) {
    console.log("[Mentor UI]", ...args);
  }
}

debug("Script loading...");

// Make sure module imports work
import { createAgent, stopAgent } from "./agent.mjs";
debug("Modules imported successfully");

// Handle UI interactions
let mentorSession = null;
let initialized = false;

async function startMentorSession() {
  try {
    debug("Starting mentor session...");
    const agent = await createAgent();
    debug("Agent created successfully:", agent);
    return agent;
  } catch (error) {
    console.error("Error creating agent:", error);
    throw error;
  }
}

async function endMentorSession(session) {
  if (session) {
    try {
      debug("Ending mentor session...");
      await stopAgent();
      debug("Session ended successfully");
    } catch (error) {
      console.error("Error stopping session:", error);
      throw error;
    }
  }
}

async function toggleMentorSession() {
  debug("Toggle mentor session called");
  const fab = document.querySelector("#mentor-fab button");
  const statusText = document.querySelector(".mentor-status");

  debug("Current session state:", {
    mentorSession,
    fabActive: fab?.classList.contains("active"),
    statusText: statusText?.textContent,
  });

  if (!mentorSession) {
    debug("Attempting to start session...");
    fab.classList.add("active");
    statusText.textContent = "Starting mentoring session...";

    try {
      mentorSession = await startMentorSession();
      statusText.textContent = "Mentoring session active";
      debug("Mentor session started successfully:", mentorSession);
    } catch (error) {
      console.error("Failed to start mentor session:", error);
      fab.classList.remove("active");
      statusText.textContent = "Failed to start session. Try again.";
      mentorSession = null;
    }
  } else {
    debug("Attempting to end session...");
    statusText.textContent = "Ending session...";

    try {
      await endMentorSession(mentorSession);
      mentorSession = null;
      fab.classList.remove("active");
      statusText.textContent = "Click to start mentoring session";
      debug("Mentor session ended successfully");
    } catch (error) {
      console.error("Failed to end mentor session:", error);
      statusText.textContent = "Error ending session. Try again.";
    }
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  debug("Initializing FAB...");
  const fab = document.querySelector("#mentor-fab button");
  const statusText = document.querySelector(".mentor-status");
  let isListening = false;

  // Add a chat container for feedback
  const chatContainer = document.createElement("div");
  chatContainer.className = "voice-chat-feedback";
  chatContainer.innerHTML = `
    <div class="messages"></div>
    <div class="status"></div>
  `;
  document.body.appendChild(chatContainer);

  const messagesDiv = chatContainer.querySelector(".messages");
  const statusDiv = chatContainer.querySelector(".status");

  function addMessage(text, type) {
    const msg = document.createElement("div");
    msg.className = `message ${type}`;
    msg.textContent = text;
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function updateStatus(text) {
    statusDiv.textContent = text;
    statusText.textContent = text;
  }

  if (fab) {
    debug("Found FAB, adding click handler");
    fab.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        if (!isListening) {
          if (!window.mentorSession) {
            debug("Creating new mentor session...");
            updateStatus("Starting voice chat...");
            window.mentorSession = await createAgent();
            debug("Mentor session started");
          }

          // Start listening
          isListening = true;
          fab.classList.add("recording");
          updateStatus("Listening... Click to stop");
          window.mentorSession.startListening();
          addMessage("Listening...", "system");
        } else {
          // Stop listening
          isListening = false;
          fab.classList.remove("recording");
          updateStatus("Processing...");
          addMessage("Processing your message...", "system");
          window.mentorSession.stopListening();
        }
      } catch (error) {
        console.error("Error:", error);
        isListening = false;
        fab.classList.remove("recording");
        updateStatus("Error occurred. Try again.");
        addMessage(`Error: ${error.message}`, "error");
      }
    });
    debug("Click handler added");
  }

  // Add message handler to window for agent.mjs to use
  window.addVoiceMessage = addMessage;
  window.updateVoiceStatus = updateStatus;
});

// Export for debugging
window.debugMentorUI = {
  debug,
  getState: () => ({
    mentorSession: window.mentorSession,
    fab: document.querySelector("#mentor-fab button"),
    statusText: document.querySelector(".mentor-status"),
  }),
};

debug("Script setup complete");
