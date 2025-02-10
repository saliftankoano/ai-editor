import { IS_PUTER } from "./puter.js";

// Load environment variables with fallbacks
const API_KEY = import.meta.env.VITE_JUDGE0_API_KEY || "";
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";
const GROQ_API_ENDPOINT =
  import.meta.env.VITE_GROQ_API_ENDPOINT ||
  "https://api.groq.com/openai/v1/chat/completions";

const AUTHENTICATED_CE_BASE_URL =
  import.meta.env.VITE_JUDGE0_CE_BASE_URL || "https://judge0-ce.p.sulu.sh";
const AUTHENTICATED_EXTRA_CE_BASE_URL =
  import.meta.env.VITE_JUDGE0_EXTRA_CE_BASE_URL ||
  "https://judge0-extra-ce.p.sulu.sh";

// Log environment status (for debugging)
console.log("Environment Variables Status:", {
  API_KEY: !!API_KEY,
  GROQ_API_KEY: !!GROQ_API_KEY,
  GROQ_API_ENDPOINT: !!GROQ_API_ENDPOINT,
  AUTHENTICATED_CE_BASE_URL: !!AUTHENTICATED_CE_BASE_URL,
  AUTHENTICATED_EXTRA_CE_BASE_URL: !!AUTHENTICATED_EXTRA_CE_BASE_URL,
});

const AUTH_HEADERS = API_KEY
  ? {
      Authorization: `Bearer ${API_KEY}`,
    }
  : {};

const CE = "CE";
const EXTRA_CE = "EXTRA_CE";

var AUTHENTICATED_BASE_URL = {};
AUTHENTICATED_BASE_URL[CE] = AUTHENTICATED_CE_BASE_URL;
AUTHENTICATED_BASE_URL[EXTRA_CE] = AUTHENTICATED_EXTRA_CE_BASE_URL;

const UNAUTHENTICATED_CE_BASE_URL = "https://ce.judge0.com";
const UNAUTHENTICATED_EXTRA_CE_BASE_URL = "https://extra-ce.judge0.com";

var UNAUTHENTICATED_BASE_URL = {};
UNAUTHENTICATED_BASE_URL[CE] = UNAUTHENTICATED_CE_BASE_URL;
UNAUTHENTICATED_BASE_URL[EXTRA_CE] = UNAUTHENTICATED_EXTRA_CE_BASE_URL;

const INITIAL_WAIT_TIME_MS = 0;
const WAIT_TIME_FUNCTION = (i) => 100;
const MAX_PROBE_REQUESTS = 50;

var fontSize = 13;

var layout;

var sourceEditor;
var stdinEditor;
var stdoutEditor;
let chatEditor;
let $sendChatBtn;
// Composer
let composerEditor;
let $sendComposerBtn;

var $selectLanguage;
var $compilerOptions;
var $commandLineArguments;
var $runBtn;
var $statusLine;

var timeStart;

var sqliteAdditionalFiles;
var languages = {};

const ASSISTANT_NAME = "Groq";
const USER_NAME = "You";

// Add these constants for Groq models
const GROQ_MODELS = {
  "mixtral-8x7b-32768": "Mixtral 8x7B",
  "llama2-70b-4096": "LLaMA2 70B",
  "gemma2-9b-it": "Gemma 9B",
};

// Add the composer system prompt
const COMPOSER_SYSTEM_PROMPT = `You are an expert code generator and modifier. Your role is to:
1. Always return the COMPLETE code, including both existing code and your modifications
2. Generate clean, efficient, and well-documented code based on user requirements
3. Explain the code you generate with inline comments
4. Follow best practices and design patterns
5. Consider edge cases and error handling

IMPORTANT: 
- You must ALWAYS return the entire source code file, not just the new parts
- Include both the existing code and your modifications
- When modifying code, show the complete context (the entire function or class being modified)
- Wrap the complete code in a code block using triple backticks with the appropriate language

Always structure your response as:
1. Brief explanation of your changes and approach
2. Complete code with your modifications clearly marked using the special comments
3. Summary of changes made
4. Usage example (if applicable)

Example response format:
"I've modified the code to add X functionality...

Changes made:
1. Added new_helper_function to handle X
2. Modified another_function to use the new helper
3. Updated documentation
"`;

var layoutConfig = {
  settings: {
    showPopoutIcon: false,
    reorderEnabled: true,
  },
  content: [
    {
      type: "row",
      content: [
        {
          type: "column",
          width: 60,
          content: [
            {
              type: "component",
              componentName: "source",
              id: "source",
              title: "Source Code",
              isClosable: false,
              componentState: {
                readOnly: false,
              },
            },
            {
              type: "component",
              height: 30,
              componentName: "stdin",
              id: "stdin",
              title: "Input",
              isClosable: false,
              componentState: {
                readOnly: false,
              },
            },
          ],
        },
        {
          type: "column",
          width: 40,
          content: [
            {
              type: "stack",
              height: 70,
              content: [
                {
                  type: "component",
                  componentName: "chat",
                  id: "chat",
                  title: "Chat",
                  isClosable: false,
                  componentState: {
                    readOnly: false,
                  },
                },
                {
                  type: "component",
                  componentName: "composer",
                  id: "composer",
                  title: "Composer",
                  isClosable: false,
                  componentState: {
                    readOnly: false,
                  },
                },
              ],
            },
            {
              type: "component",
              height: 30,
              componentName: "stdout",
              id: "stdout",
              title: "Output",
              isClosable: false,
              componentState: {
                readOnly: true,
              },
            },
          ],
        },
      ],
    },
  ],
};

var gPuterFile;

function encode(str) {
  return btoa(unescape(encodeURIComponent(str || "")));
}

function decode(bytes) {
  var escaped = escape(atob(bytes || ""));
  try {
    return decodeURIComponent(escaped);
  } catch {
    return unescape(escaped);
  }
}

function showError(title, content) {
  $("#judge0-site-modal #title").html(title);
  $("#judge0-site-modal .content").html(content);

  let reportTitle = encodeURIComponent(`Error on ${window.location.href}`);
  let reportBody = encodeURIComponent(
    `**Error Title**: ${title}\n` +
      `**Error Timestamp**: \`${new Date()}\`\n` +
      `**Origin**: ${window.location.href}\n` +
      `**Description**:\n${content}`
  );

  $("#report-problem-btn").attr(
    "href",
    `https://github.com/judge0/ide/issues/new?title=${reportTitle}&body=${reportBody}`
  );
  $("#judge0-site-modal").modal("show");
}

function showHttpError(jqXHR) {
  showError(
    `${jqXHR.statusText} (${jqXHR.status})`,
    `<pre>${JSON.stringify(jqXHR, null, 4)}</pre>`
  );
}

function handleRunError(jqXHR) {
  showHttpError(jqXHR);
  $runBtn.removeClass("disabled");

  window.top.postMessage(
    JSON.parse(
      JSON.stringify({
        event: "runError",
        data: jqXHR,
      })
    ),
    "*"
  );
}

function handleResult(data) {
  const tat = Math.round(performance.now() - timeStart);
  console.log(`It took ${tat}ms to get submission result.`);

  const status = data.status;
  const stdout = decode(data.stdout);
  const compileOutput = decode(data.compile_output);
  const time = data.time === null ? "-" : data.time + "s";
  const memory = data.memory === null ? "-" : data.memory + "KB";

  $statusLine.html(`${status.description}, ${time}, ${memory} (TAT: ${tat}ms)`);

  const output = [compileOutput, stdout].join("\n").trim();

  stdoutEditor.setValue(output);

  $runBtn.removeClass("disabled");

  window.top.postMessage(
    JSON.parse(
      JSON.stringify({
        event: "postExecution",
        status: data.status,
        time: data.time,
        memory: data.memory,
        output: output,
      })
    ),
    "*"
  );
}

async function getSelectedLanguage() {
  return getLanguage(getSelectedLanguageFlavor(), getSelectedLanguageId());
}

function getSelectedLanguageId() {
  return parseInt($selectLanguage.val());
}

function getSelectedLanguageFlavor() {
  return $selectLanguage.find(":selected").attr("flavor");
}

function run() {
  if (sourceEditor.getValue().trim() === "") {
    showError("Error", "Source code can't be empty!");
    return;
  } else {
    $runBtn.addClass("disabled");
  }

  stdoutEditor.setValue("");
  $statusLine.html("");

  let x = layout.root.getItemsById("stdout")[0];
  x.parent.header.parent.setActiveContentItem(x);

  let sourceValue = encode(sourceEditor.getValue());
  let stdinValue = encode(stdinEditor.getValue());
  let languageId = getSelectedLanguageId();
  let compilerOptions = $compilerOptions.val();
  let commandLineArguments = $commandLineArguments.val();

  let flavor = getSelectedLanguageFlavor();

  if (languageId === 44) {
    sourceValue = sourceEditor.getValue();
  }

  let data = {
    source_code: sourceValue,
    language_id: languageId,
    stdin: stdinValue,
    compiler_options: compilerOptions,
    command_line_arguments: commandLineArguments,
    redirect_stderr_to_stdout: true,
  };

  let sendRequest = function (data) {
    window.top.postMessage(
      JSON.parse(
        JSON.stringify({
          event: "preExecution",
          source_code: sourceEditor.getValue(),
          language_id: languageId,
          flavor: flavor,
          stdin: stdinEditor.getValue(),
          compiler_options: compilerOptions,
          command_line_arguments: commandLineArguments,
        })
      ),
      "*"
    );

    timeStart = performance.now();
    $.ajax({
      url: `${AUTHENTICATED_BASE_URL[flavor]}/submissions?base64_encoded=true&wait=false`,
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify(data),
      headers: AUTH_HEADERS,
      success: function (data, textStatus, request) {
        console.log(`Your submission token is: ${data.token}`);
        let region = request.getResponseHeader("X-Judge0-Region");
        setTimeout(
          fetchSubmission.bind(null, flavor, region, data.token, 1),
          INITIAL_WAIT_TIME_MS
        );
      },
      error: handleRunError,
    });
  };

  if (languageId === 82) {
    if (!sqliteAdditionalFiles) {
      $.ajax({
        url: `./data/additional_files_zip_base64.txt`,
        contentType: "text/plain",
        success: function (responseData) {
          sqliteAdditionalFiles = responseData;
          data["additional_files"] = sqliteAdditionalFiles;
          sendRequest(data);
        },
        error: handleRunError,
      });
    } else {
      data["additional_files"] = sqliteAdditionalFiles;
      sendRequest(data);
    }
  } else {
    sendRequest(data);
  }
}

function fetchSubmission(flavor, region, submission_token, iteration) {
  if (iteration >= MAX_PROBE_REQUESTS) {
    handleRunError(
      {
        statusText: "Maximum number of probe requests reached.",
        status: 504,
      },
      null,
      null
    );
    return;
  }

  $.ajax({
    url: `${UNAUTHENTICATED_BASE_URL[flavor]}/submissions/${submission_token}?base64_encoded=true`,
    headers: {
      "X-Judge0-Region": region,
    },
    success: function (data) {
      if (data.status.id <= 2) {
        // In Queue or Processing
        $statusLine.html(data.status.description);
        setTimeout(
          fetchSubmission.bind(
            null,
            flavor,
            region,
            submission_token,
            iteration + 1
          ),
          WAIT_TIME_FUNCTION(iteration)
        );
      } else {
        handleResult(data);
      }
    },
    error: handleRunError,
  });
}

function setSourceCodeName(name) {
  $(".lm_title")[0].innerText = name;
}

function getSourceCodeName() {
  return $(".lm_title")[0].innerText;
}

function openFile(content, filename) {
  clear();
  sourceEditor.setValue(content);
  selectLanguageForExtension(filename.split(".").pop());
  setSourceCodeName(filename);
}

function saveFile(content, filename) {
  const blob = new Blob([content], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

async function openAction() {
  if (IS_PUTER) {
    gPuterFile = await puter.ui.showOpenFilePicker();
    openFile(await (await gPuterFile.read()).text(), gPuterFile.name);
  } else {
    document.getElementById("open-file-input").click();
  }
}

async function saveAction() {
  if (IS_PUTER) {
    if (gPuterFile) {
      gPuterFile.write(sourceEditor.getValue());
    } else {
      gPuterFile = await puter.ui.showSaveFilePicker(
        sourceEditor.getValue(),
        getSourceCodeName()
      );
      setSourceCodeName(gPuterFile.name);
    }
  } else {
    saveFile(sourceEditor.getValue(), getSourceCodeName());
  }
}

function setFontSizeForAllEditors(fontSize) {
  sourceEditor.updateOptions({ fontSize: fontSize });
  stdinEditor.updateOptions({ fontSize: fontSize });
  stdoutEditor.updateOptions({ fontSize: fontSize });
}

async function loadLangauges() {
  return new Promise((resolve, reject) => {
    let options = [];

    $.ajax({
      url: UNAUTHENTICATED_CE_BASE_URL + "/languages",
      success: function (data) {
        for (let i = 0; i < data.length; i++) {
          let language = data[i];
          let option = new Option(language.name, language.id);
          option.setAttribute("flavor", CE);
          option.setAttribute(
            "langauge_mode",
            getEditorLanguageMode(language.name)
          );

          if (language.id !== 89) {
            options.push(option);
          }

          if (language.id === DEFAULT_LANGUAGE_ID) {
            option.selected = true;
          }
        }
      },
      error: reject,
    }).always(function () {
      $.ajax({
        url: UNAUTHENTICATED_EXTRA_CE_BASE_URL + "/languages",
        success: function (data) {
          for (let i = 0; i < data.length; i++) {
            let language = data[i];
            let option = new Option(language.name, language.id);
            option.setAttribute("flavor", EXTRA_CE);
            option.setAttribute(
              "langauge_mode",
              getEditorLanguageMode(language.name)
            );

            if (
              options.findIndex((t) => t.text === option.text) === -1 &&
              language.id !== 89
            ) {
              options.push(option);
            }
          }
        },
        error: reject,
      }).always(function () {
        options.sort((a, b) => a.text.localeCompare(b.text));
        $selectLanguage.append(options);
        resolve();
      });
    });
  });
}

async function loadSelectedLanguage(skipSetDefaultSourceCodeName = false) {
  monaco.editor.setModelLanguage(
    sourceEditor.getModel(),
    $selectLanguage.find(":selected").attr("langauge_mode")
  );

  if (!skipSetDefaultSourceCodeName) {
    setSourceCodeName((await getSelectedLanguage()).source_file);
  }
}

function selectLanguageByFlavorAndId(languageId, flavor) {
  let option = $selectLanguage.find(`[value=${languageId}][flavor=${flavor}]`);
  if (option.length) {
    option.prop("selected", true);
    $selectLanguage.trigger("change", { skipSetDefaultSourceCodeName: true });
  }
}

function selectLanguageForExtension(extension) {
  let language = getLanguageForExtension(extension);
  selectLanguageByFlavorAndId(language.language_id, language.flavor);
}

async function getLanguage(flavor, languageId) {
  return new Promise((resolve, reject) => {
    if (languages[flavor] && languages[flavor][languageId]) {
      resolve(languages[flavor][languageId]);
      return;
    }

    $.ajax({
      url: `${UNAUTHENTICATED_BASE_URL[flavor]}/languages/${languageId}`,
      success: function (data) {
        if (!languages[flavor]) {
          languages[flavor] = {};
        }

        languages[flavor][languageId] = data;
        resolve(data);
      },
      error: reject,
    });
  });
}

function setDefaults() {
  setFontSizeForAllEditors(fontSize);
  sourceEditor.setValue(DEFAULT_SOURCE);
  stdinEditor.setValue(DEFAULT_STDIN);
  $compilerOptions.val(DEFAULT_COMPILER_OPTIONS);
  $commandLineArguments.val(DEFAULT_CMD_ARGUMENTS);

  $statusLine.html("");

  loadSelectedLanguage();
}

function clear() {
  sourceEditor.setValue("");
  stdinEditor.setValue("");
  $compilerOptions.val("");
  $commandLineArguments.val("");

  $statusLine.html("");
}

function refreshSiteContentHeight() {
  const navigationHeight = document.getElementById(
    "judge0-site-navigation"
  ).offsetHeight;

  const siteContent = document.getElementById("judge0-site-content");
  siteContent.style.height = `${window.innerHeight}px`;
  siteContent.style.paddingTop = `${navigationHeight}px`;
}

function refreshLayoutSize() {
  refreshSiteContentHeight();
  layout.updateSize();
}

window.addEventListener("resize", refreshLayoutSize);
document.addEventListener("DOMContentLoaded", async function () {
  $("#select-language").dropdown();
  $("[data-content]").popup({
    lastResort: "left center",
  });

  refreshSiteContentHeight();

  console.log(
    "Hey, Judge0 IDE is open-sourced: https://github.com/judge0/ide. Have fun!"
  );

  $selectLanguage = $("#select-language");
  $selectLanguage.change(function (event, data) {
    let skipSetDefaultSourceCodeName =
      (data && data.skipSetDefaultSourceCodeName) || !!gPuterFile;
    loadSelectedLanguage(skipSetDefaultSourceCodeName);
  });

  await loadLangauges();

  $compilerOptions = $("#compiler-options");
  $commandLineArguments = $("#command-line-arguments");

  $runBtn = $("#run-btn");
  $runBtn.click(run);

  $("#open-file-input").change(function (e) {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = function (e) {
        openFile(e.target.result, selectedFile.name);
      };

      reader.onerror = function (e) {
        showError("Error", "Error reading file: " + e.target.error);
      };

      reader.readAsText(selectedFile);
    }
  });

  $statusLine = $("#judge0-status-line");

  $(document).on("keydown", "body", function (e) {
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case "Enter": // Ctrl+Enter, Cmd+Enter
          e.preventDefault();
          run();
          break;
        case "s": // Ctrl+S, Cmd+S
          e.preventDefault();
          save();
          break;
        case "o": // Ctrl+O, Cmd+O
          e.preventDefault();
          open();
          break;
        case "+": // Ctrl+Plus
        case "=": // Some layouts use '=' for '+'
          e.preventDefault();
          fontSize += 1;
          setFontSizeForAllEditors(fontSize);
          break;
        case "-": // Ctrl+Minus
          e.preventDefault();
          fontSize -= 1;
          setFontSizeForAllEditors(fontSize);
          break;
        case "0": // Ctrl+0
          e.preventDefault();
          fontSize = 13;
          setFontSizeForAllEditors(fontSize);
          break;
      }
    }
  });

  require(["vs/editor/editor.main"], function (ignorable) {
    layout = new GoldenLayout(layoutConfig, $("#judge0-site-content"));

    layout.registerComponent("source", function (container, state) {
      sourceEditor = monaco.editor.create(container.getElement()[0], {
        automaticLayout: true,
        scrollBeyondLastLine: true,
        readOnly: state.readOnly,
        language: "cpp",
        fontFamily: "JetBrains Mono",
        minimap: {
          enabled: true,
        },
        suggestOnTriggerCharacters: true,
        quickSuggestions: {
          other: true,
          comments: true,
          strings: true,
        },
        parameterHints: {
          enabled: true,
        },
        suggestSelection: "first",
        acceptSuggestionOnCommitCharacter: true,
        acceptSuggestionOnEnter: "on",
        snippetSuggestions: "inline",
      });

      sourceEditor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        run
      );

      setupAutoComplete(sourceEditor);
    });

    layout.registerComponent("stdin", function (container, state) {
      stdinEditor = monaco.editor.create(container.getElement()[0], {
        automaticLayout: true,
        scrollBeyondLastLine: false,
        readOnly: state.readOnly,
        language: "plaintext",
        fontFamily: "JetBrains Mono",
        minimap: {
          enabled: false,
        },
      });
    });

    layout.registerComponent("stdout", function (container, state) {
      stdoutEditor = monaco.editor.create(container.getElement()[0], {
        automaticLayout: true,
        scrollBeyondLastLine: false,
        readOnly: state.readOnly,
        language: "plaintext",
        fontFamily: "JetBrains Mono",
        minimap: {
          enabled: false,
        },
      });
    });

    layout.registerComponent("chat", function (container, state) {
      // Create chat container with messages area and input
      const chatContainer = $(`
        <div class="chat-container">
          <div class="chat-messages"></div>
          <div class="chat-input-container">
            <textarea class="chat-input" placeholder="Ask me anything about your code..."></textarea>
            <button id="send-chat-btn" class="ui primary button">Send</button>
          </div>
        </div>
      `);

      container.getElement().append(chatContainer);

      const $chatMessages = chatContainer.find(".chat-messages");
      const $chatInput = chatContainer.find(".chat-input");
      $sendChatBtn = chatContainer.find("#send-chat-btn");

      $sendChatBtn.click(() => sendChatMessage($chatInput, $chatMessages));

      // Handle enter key (but shift+enter for new line)
      $chatInput.on("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendChatMessage($chatInput, $chatMessages);
        }
      });
    });

    layout.registerComponent("composer", function (container, state) {
      const composerContainer = $(`
        <div class="composer-container">
          <div class="composer-header">
            <select class="ui dropdown model-selector">
              ${Object.entries(GROQ_MODELS)
                .map(([id, name]) => `<option value="${id}">${name}</option>`)
                .join("")}
            </select>
          </div>
          <div class="composer-messages"></div>
          <div class="composer-input-container">
            <textarea class="composer-input" placeholder="Describe the code you want to generate..."></textarea>
            <button id="send-composer-btn" class="ui primary button">Generate</button>
          </div>
        </div>
      `);

      container.getElement().append(composerContainer);

      const $composerMessages = composerContainer.find(".composer-messages");
      const $composerInput = composerContainer.find(".composer-input");
      const $modelSelector = composerContainer.find(".model-selector");
      $sendComposerBtn = composerContainer.find("#send-composer-btn");

      $sendComposerBtn.click(() =>
        sendComposerMessage($composerInput, $composerMessages, $modelSelector)
      );

      $composerInput.on("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendComposerMessage(
            $composerInput,
            $composerMessages,
            $modelSelector
          );
        }
      });
    });

    layout.on("initialised", function () {
      setDefaults();
      refreshLayoutSize();
      setupEditorChangeHandler();
      window.top.postMessage({ event: "initialised" }, "*");
    });

    layout.init();
  });

  let superKey = "⌘";
  if (!/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform)) {
    superKey = "Ctrl";
  }

  [$runBtn].forEach((btn) => {
    btn.attr("data-content", `${superKey}${btn.attr("data-content")}`);
  });

  document.querySelectorAll(".description").forEach((e) => {
    e.innerText = `${superKey}${e.innerText}`;
  });

  if (IS_PUTER) {
    puter.ui.onLaunchedWithItems(async function (items) {
      gPuterFile = items[0];
      openFile(await (await gPuterFile.read()).text(), gPuterFile.name);
    });
  }

  document
    .getElementById("judge0-open-file-btn")
    .addEventListener("click", openAction);
  document
    .getElementById("judge0-save-btn")
    .addEventListener("click", saveAction);

  window.onmessage = function (e) {
    if (!e.data) {
      return;
    }

    if (e.data.action === "get") {
      window.top.postMessage(
        JSON.parse(
          JSON.stringify({
            event: "getResponse",
            source_code: sourceEditor.getValue(),
            language_id: getSelectedLanguageId(),
            flavor: getSelectedLanguageFlavor(),
            stdin: stdinEditor.getValue(),
            stdout: stdoutEditor.getValue(),
            compiler_options: $compilerOptions.val(),
            command_line_arguments: $commandLineArguments.val(),
          })
        ),
        "*"
      );
    } else if (e.data.action === "set") {
      if (e.data.source_code) {
        sourceEditor.setValue(e.data.source_code);
      }
      if (e.data.language_id && e.data.flavor) {
        selectLanguageByFlavorAndId(e.data.language_id, e.data.flavor);
      }
      if (e.data.stdin) {
        stdinEditor.setValue(e.data.stdin);
      }
      if (e.data.stdout) {
        stdoutEditor.setValue(e.data.stdout);
      }
      if (e.data.compiler_options) {
        $compilerOptions.val(e.data.compiler_options);
      }
      if (e.data.command_line_arguments) {
        $commandLineArguments.val(e.data.command_line_arguments);
      }
      if (e.data.api_key) {
        AUTH_HEADERS["Authorization"] = `Bearer ${e.data.api_key}`;
      }
    }
  };

  // Add these lines near the top of the file, after the variable declarations
  window.acceptChange = acceptChange;
  window.rejectChange = rejectChange;
});

const DEFAULT_SOURCE =
  "\
def twoSum(nums, target):\n\
    # Create a dictionary to store number:index pairs\n\
    num_dict = {}\n\
    \n\
    # Iterate through the array\n\
    for i, num in enumerate(nums):\n\
        # Calculate the complement needed\n\
        complement = target - num\n\
        \n\
        # If complement exists in dictionary, we found a solution\n\
        if complement in num_dict:\n\
            return [num_dict[complement], i]\n\
            \n\
        # Add current number and index to dictionary\n\
        num_dict[num] = i\n\
    \n\
    # No solution found\n\
    return []\n\
";

const DEFAULT_STDIN =
  "\
[2,7,11,15]\n\
9\n\
[3,2,4]\n\
6\n\
[3,3]\n\
6\n\
";

const DEFAULT_COMPILER_OPTIONS = "";
const DEFAULT_CMD_ARGUMENTS = "";
const DEFAULT_LANGUAGE_ID = 100; // Python (3.11.2) (https://ce.judge0.com/languages)

function getEditorLanguageMode(languageName) {
  const DEFAULT_EDITOR_LANGUAGE_MODE = "python";
  const LANGUAGE_NAME_TO_LANGUAGE_EDITOR_MODE = {
    Bash: "shell",
    C: "c",
    C3: "c",
    "C#": "csharp",
    "C++": "cpp",
    Clojure: "clojure",
    "F#": "fsharp",
    Go: "go",
    Java: "java",
    JavaScript: "javascript",
    Kotlin: "kotlin",
    "Objective-C": "objective-c",
    Pascal: "pascal",
    Perl: "perl",
    PHP: "php",
    Python: "python",
    R: "r",
    Ruby: "ruby",
    SQL: "sql",
    Swift: "swift",
    TypeScript: "typescript",
    "Visual Basic": "vb",
  };

  for (let key in LANGUAGE_NAME_TO_LANGUAGE_EDITOR_MODE) {
    if (languageName.toLowerCase().startsWith(key.toLowerCase())) {
      return LANGUAGE_NAME_TO_LANGUAGE_EDITOR_MODE[key];
    }
  }
  return DEFAULT_EDITOR_LANGUAGE_MODE;
}

const EXTENSIONS_TABLE = {
  asm: { flavor: CE, language_id: 45 }, // Assembly (NASM 2.14.02)
  c: { flavor: CE, language_id: 103 }, // C (GCC 14.1.0)
  cpp: { flavor: CE, language_id: 105 }, // C++ (GCC 14.1.0)
  cs: { flavor: EXTRA_CE, language_id: 29 }, // C# (.NET Core SDK 7.0.400)
  go: { flavor: CE, language_id: 95 }, // Go (1.18.5)
  java: { flavor: CE, language_id: 91 }, // Java (JDK 17.0.6)
  js: { flavor: CE, language_id: 102 }, // JavaScript (Node.js 22.08.0)
  lua: { flavor: CE, language_id: 64 }, // Lua (5.3.5)
  pas: { flavor: CE, language_id: 67 }, // Pascal (FPC 3.0.4)
  php: { flavor: CE, language_id: 98 }, // PHP (8.3.11)
  py: { flavor: EXTRA_CE, language_id: 25 }, // Python for ML (3.11.2)
  r: { flavor: CE, language_id: 99 }, // R (4.4.1)
  rb: { flavor: CE, language_id: 72 }, // Ruby (2.7.0)
  rs: { flavor: CE, language_id: 73 }, // Rust (1.40.0)
  scala: { flavor: CE, language_id: 81 }, // Scala (2.13.2)
  sh: { flavor: CE, language_id: 46 }, // Bash (5.0.0)
  swift: { flavor: CE, language_id: 83 }, // Swift (5.2.3)
  ts: { flavor: CE, language_id: 101 }, // TypeScript (5.6.2)
  txt: { flavor: CE, language_id: 43 }, // Plain Text
};

function getLanguageForExtension(extension) {
  return EXTENSIONS_TABLE[extension] || { flavor: CE, language_id: 43 }; // Plain Text (https://ce.judge0.com/languages/43)
}

const markedInstance = window.marked;

function formatMessage(text) {
  // Simple markdown-like formatting
  return (
    text
      // Code blocks with language
      .replace(/```(\w+)?\n([\s\S]*?)```/g, function (match, lang, code) {
        return `<pre class="code-block"><code class="language-${
          lang || "text"
        }">${escapeHtml(code.trim())}</code></pre>`;
      })
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      // Italic
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      // Lists
      .replace(/^- (.+)$/gm, "<li>$1</li>")
      // Line breaks
      .replace(/\n/g, "<br>")
  );
}

// Helper function to escape HTML special characters
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function sendChatMessage($chatInput, $chatMessages) {
  const message = $chatInput.val().trim();
  if (!message) return;

  appendMessage($chatMessages, message, true);
  $chatInput.val("");

  let typingIndicator = null;

  try {
    typingIndicator = showTypingIndicator($chatMessages);

    const response = await fetch(GROQ_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mixtral-8x7b-32768",
        messages: [
          {
            role: "system",
            content:
              "You are programming tutor. You help users with their code by providing explanations, suggestions, and corrections. Never give the user the answer, nudge and help them to find the answer themselves. You have access to their current code and programming language context. You can also use emojis to make the conversation more engaging.",
          },
          {
            role: "user",
            content: `Current code:\n\`\`\`${$selectLanguage
              .find(":selected")
              .text()}\n${sourceEditor.getValue()}\n\`\`\`\n\nUser question: ${message}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${
          errorData.error?.message || "Unknown error"
        }`
      );
    }

    const data = await response.json();

    if (typingIndicator) {
      typingIndicator.remove();
    }
    appendMessage($chatMessages, data.choices[0].message.content, false);
  } catch (error) {
    if (typingIndicator) {
      typingIndicator.remove();
    }
    appendMessage(
      $chatMessages,
      `Error: ${error.message || "Failed to get response from assistant"}`,
      false
    );
    console.error("Chat error:", error);
  }
}

function appendMessage($messages, content, isUser) {
  const $message = $(
    `<div class="message ${isUser ? "user" : "assistant"}"></div>`
  );

  if (isUser) {
    $message.text(content);
  } else {
    formatComposerMessage($message, content);
  }

  $messages.append($message);
  $messages.scrollTop($messages[0].scrollHeight);
}

function showTypingIndicator($chatMessages) {
  const $typingIndicator = $(`
    <div class="chat-message assistant-message">
      <div class="message-header">${ASSISTANT_NAME}</div>
      <div class="message-content">
        <div class="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  `);

  $chatMessages.append($typingIndicator);
  $chatMessages.scrollTop($chatMessages[0].scrollHeight);
  return $typingIndicator;
}

// Update the handleComposerCodeChange function
function handleComposerCodeChange(newCode) {
  const model = sourceEditor.getModel();
  const changeId = Date.now().toString();

  // Store original code
  const originalCode = model.getValue();

  // Analyze changes and get decorations
  const changeType = analyzeCodeChange(model, 1, newCode);

  // Apply the new code
  sourceEditor.executeEdits("composer", [
    {
      range: changeType.range,
      text: changeType.newText,
    },
  ]);

  // Apply decorations
  const decorations = sourceEditor.deltaDecorations([], changeType.decorations);

  // Show the control panel
  const controlPanel = document.getElementById("code-change-controls");

  // Get the source editor's DOM element
  const editorElement = sourceEditor.getDomNode();

  // Move the control panel into the editor container
  if (editorElement && editorElement.parentElement) {
    editorElement.parentElement.appendChild(controlPanel);
    controlPanel.style.display = "flex";
  }

  // Store change metadata
  sourceEditor._currentChange = {
    decorations,
    originalCode,
    range: changeType.range,
  };
}

// Update the acceptChange and rejectChange functions to handle the new positioning
function acceptChange() {
  if (!sourceEditor._currentChange) return;

  // Remove decorations
  sourceEditor.deltaDecorations(sourceEditor._currentChange.decorations, []);

  // Hide control panel
  const controlPanel = document.getElementById("code-change-controls");
  if (controlPanel) {
    controlPanel.style.display = "none";
    // Move back to body if needed
    document.body.appendChild(controlPanel);
  }

  // Clear current change
  sourceEditor._currentChange = null;

  // Notify user
  $statusLine.html(`Changes accepted`);
}

function rejectChange() {
  if (!sourceEditor._currentChange) return;

  try {
    // Simply restore the entire original content
    sourceEditor.setValue(sourceEditor._currentChange.originalCode);

    // Remove decorations
    sourceEditor.deltaDecorations(sourceEditor._currentChange.decorations, []);

    // Hide control panel
    const controlPanel = document.getElementById("code-change-controls");
    if (controlPanel) {
      controlPanel.style.display = "none";
      // Move back to body if needed
      document.body.appendChild(controlPanel);
    }

    // Clear current change
    sourceEditor._currentChange = null;

    // Notify user
    $statusLine.html(`Changes rejected`);
  } catch (error) {
    console.error("Error rejecting changes:", error);
    $statusLine.html(`Error rejecting changes: ${error.message}`);
  }
}

// Add cleanup function for when editor content changes
function setupEditorChangeHandler() {
  sourceEditor.onDidChangeModelContent((event) => {
    // If change is not from composer, clean up
    if (event.changes.some((change) => change.origin !== "composer")) {
      if (sourceEditor._currentChange) {
        sourceEditor.deltaDecorations(
          sourceEditor._currentChange.decorations,
          []
        );
        document.getElementById("code-change-controls").style.display = "none";
        sourceEditor._currentChange = null;
      }
    }
  });
}

// Modify the existing sendComposerMessage function to handle code changes
async function sendComposerMessage(
  $composerInput,
  $composerMessages,
  $modelSelector
) {
  const message = $composerInput.val().trim();
  if (!message) return;

  appendMessage($composerMessages, message, true);
  $composerInput.val("");

  let typingIndicator = null;

  try {
    typingIndicator = showTypingIndicator($composerMessages);

    const response = await fetch(GROQ_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: $modelSelector.val(),
        messages: [
          {
            role: "system",
            content: COMPOSER_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: `Current programming language: ${$selectLanguage
              .find(":selected")
              .text()}\n\nRequirement: ${message}
              \n\n
              Current source code:
              ${sourceEditor.getValue()}
              `,
          },
        ],
        temperature: 0.3, // Lower temperature for more focused code generation
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${
          errorData.error?.message || "Unknown error"
        }`
      );
    }

    const data = await response.json();

    if (typingIndicator) {
      typingIndicator.remove();
    }

    // Extract and apply code changes if present
    const generatedCode = extractCodeFromMessage(
      data.choices[0].message.content
    );
    if (generatedCode) {
      handleComposerCodeChange(generatedCode);
    }

    appendMessage($composerMessages, data.choices[0].message.content, false);
  } catch (error) {
    if (typingIndicator) {
      typingIndicator.remove();
    }
    appendMessage(
      $composerMessages,
      `Error: ${error.message || "Failed to generate code"}`,
      false
    );
    console.error("Composer error:", error);
  }
}

// Add this function to format code blocks in messages
function formatComposerMessage($message, content) {
  // First, escape any HTML in the non-code parts
  const escapedContent = content.replace(/[<>&]/g, function (c) {
    return { "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c];
  });

  // Then handle code blocks
  const formattedContent = escapedContent.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    (match, language, code) => {
      // Create a Monaco editor instance for the code block
      const containerId = "code-" + Math.random().toString(36).substr(2, 9);
      const container = `<div id="${containerId}" class="code-container" style="height: 300px; margin: 10px 0; border-radius: 4px; overflow: hidden;"></div>`;

      // Schedule the editor creation after the container is added to DOM
      setTimeout(() => {
        const containerElement = document.getElementById(containerId);
        if (containerElement) {
          const editor = monaco.editor.create(containerElement, {
            value: code.trim(),
            language: language || "plaintext",
            theme: "vs-dark",
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderLineHighlight: "none",
            contextmenu: false,
            lineNumbers: "on",
            scrollbar: {
              vertical: "visible",
              horizontal: "visible",
            },
            automaticLayout: true, // Add this to handle container resizing
          });

          // Adjust editor height to content
          const lineCount = code.trim().split("\n").length;
          const height = Math.min(lineCount * 19 + 20, 300);
          containerElement.style.height = `${height}px`;
          editor.layout();
        }
      }, 0);

      return container;
    }
  );

  // Convert newlines to <br> tags for proper formatting
  const htmlContent = formattedContent.replace(/\n/g, "<br>");
  $message.html(htmlContent);
}

// Add this function back before sendComposerMessage
function extractCodeFromMessage(message) {
  const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/;
  const match = message.match(codeBlockRegex);
  return match ? match[1].trim() : null;
}

function analyzeCodeChange(model, startLine, newCode) {
  const currentContent = model.getValue();
  const currentLines = currentContent.split("\n");
  const newLines = newCode.split("\n");

  // Use diff-match-patch or similar algorithm to detect changes
  const decorations = [];

  // Track blocks of changes
  let inChangeBlock = false;
  let changeBlockStart = 0;

  // Compare lines and detect structural changes
  for (let i = 0; i < Math.max(currentLines.length, newLines.length); i++) {
    const currentLine = currentLines[i] || "";
    const newLine = newLines[i] || "";

    // Check if lines are different
    if (currentLine !== newLine) {
      // Start of a change block
      if (!inChangeBlock) {
        inChangeBlock = true;
        changeBlockStart = i + 1; // Monaco editor is 1-based
      }

      // Handle removed line
      if (i < currentLines.length) {
        decorations.push({
          range: new monaco.Range(i + 1, 1, i + 1, currentLine.length + 1),
          options: {
            isWholeLine: true,
            className: "suggested-change remove-change",
            glyphMarginClassName: "change-glyph remove-glyph",
            linesDecorationsClassName: "line-decoration remove-decoration",
          },
        });
      }

      // Handle added/modified line
      if (i < newLines.length) {
        decorations.push({
          range: new monaco.Range(i + 1, 1, i + 1, newLine.length + 1),
          options: {
            isWholeLine: true,
            className: "suggested-change insert-change",
            glyphMarginClassName: "change-glyph insert-glyph",
            linesDecorationsClassName: "line-decoration insert-decoration",
          },
        });
      }
    } else {
      // End of a change block
      if (inChangeBlock) {
        inChangeBlock = false;
      }
    }
  }

  // Special handling for completely new functions or blocks
  const newFunctionMatches =
    newCode.match(/^(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*{[\s\S]*?^}/gm) ||
    [];
  const currentFunctionMatches =
    currentContent.match(
      /^(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*{[\s\S]*?^}/gm
    ) || [];

  // Find new functions that don't exist in current content
  newFunctionMatches.forEach((newFunc) => {
    if (
      !currentFunctionMatches.some((currentFunc) => currentFunc === newFunc)
    ) {
      const startLine = newCode
        .substring(0, newCode.indexOf(newFunc))
        .split("\n").length;
      const endLine = startLine + newFunc.split("\n").length - 1;

      decorations.push({
        range: new monaco.Range(startLine, 1, endLine, 1),
        options: {
          isWholeLine: true,
          className: "suggested-change insert-change",
          glyphMarginClassName: "change-glyph insert-glyph",
          linesDecorationsClassName: "line-decoration insert-decoration",
        },
      });
    }
  });

  return {
    type: "modify",
    range: new monaco.Range(
      1,
      1,
      Math.max(model.getLineCount(), newLines.length),
      1
    ),
    newText: newCode,
    decorations: decorations,
  };
}

// Update these constants for better autocomplete behavior
const COMPLETION_TRIGGER_CHARACTERS = [
  ".",
  "(",
  "{",
  "[",
  '"',
  "'",
  " ",
  "\n",
  "_",
  ":",
  ">",
];
const MAX_COMPLETIONS = 8;

// Add these constants near the top with other constants
const INLINE_SUGGESTION_DELAY = 100; // ms delay before showing inline suggestions
let lastInlineRequest = null;

function setupAutoComplete(editor) {
  // Register the inline suggestions provider
  monaco.languages.registerInlineCompletionsProvider("*", {
    provideInlineCompletions: async (model, position, context, token) => {
      try {
        // Don't show suggestions if we're not at the end of a line/word
        const lineContent = model.getLineContent(position.lineNumber);
        if (position.column < lineContent.length) {
          return { items: [] };
        }

        // Debounce suggestions
        if (lastInlineRequest) {
          clearTimeout(lastInlineRequest);
        }

        const result = await new Promise((resolve) => {
          lastInlineRequest = setTimeout(async () => {
            const wordInfo = model.getWordUntilPosition(position);
            const prefix = lineContent.substring(0, position.column - 1);

            // Get context
            const previousLines = model
              .getLinesContent()
              .slice(
                Math.max(0, position.lineNumber - 3),
                position.lineNumber - 1
              );
            const nextLines = model
              .getLinesContent()
              .slice(position.lineNumber, position.lineNumber + 2);

            const currentLanguage = $selectLanguage.find(":selected").text();

            const response = await fetch(GROQ_API_ENDPOINT, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${GROQ_API_KEY}`,
              },
              body: JSON.stringify({
                model: "mixtral-8x7b-32768",
                messages: [
                  {
                    role: "system",
                    content: `You are an inline code completion assistant. Return ONLY a JSON array with a SINGLE completion item containing:
                    - text: The suggested completion text (only the part that should be added)
                    - description: A very brief description of what this completion does
                    
                    The completion should:
                    1. Be a natural continuation of the current code
                    2. Be contextually relevant
                    3. Complete the current line or add a new line if appropriate
                    4. Consider the surrounding code context
                    
                    Keep suggestions concise and relevant. Return ONLY the JSON array.`,
                  },
                  {
                    role: "user",
                    content: `Language: ${currentLanguage}
                    Previous lines: ${previousLines.join("\n")}
                    Current line: ${lineContent}
                    Next lines: ${nextLines.join("\n")}
                    Cursor position: Column ${position.column}`,
                  },
                ],
                temperature: 0.1,
                max_tokens: 150,
              }),
            });

            const data = await response.json();
            const suggestion = JSON.parse(data.choices[0].message.content)[0];

            resolve({
              items: [
                {
                  insertText: suggestion.text,
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                  },
                  command: {
                    id: "editor.action.inlineSuggest.commit",
                    arguments: [],
                  },
                },
              ],
              enableForwardStability: true,
            });
          }, INLINE_SUGGESTION_DELAY);
        });

        return result;
      } catch (error) {
        console.error("Inline completion error:", error);
        return { items: [] };
      }
    },
  });

  // Update editor options specifically for inline suggestions
  editor.updateOptions({
    inlineSuggest: {
      enabled: true,
      mode: "prefix",
      showToolbar: "always",
    },
    suggest: {
      preview: true,
      previewMode: "prefix",
      showInlineDetails: true,
      showMethods: true,
      showFunctions: true,
      showVariables: true,
      showConstants: true,
      showConstructors: true,
      showFields: true,
      showProperties: true,
      showEvents: true,
      showOperators: true,
      showUnits: true,
      showValues: true,
      showWords: true,
      showColors: true,
      showFiles: true,
      showReferences: true,
      showFolders: true,
      showTypeParameters: true,
      showSnippets: true,
    },
    quickSuggestions: {
      other: "inline",
      comments: "inline",
      strings: "inline",
    },
    parameterHints: {
      enabled: true,
      cycle: true,
    },
    tabCompletion: "on",
    acceptSuggestionOnEnter: "off",
  });

  // Add keyboard shortcuts
  editor.addCommand(monaco.KeyCode.Tab, () => {
    editor.trigger("keyboard", "editor.action.inlineSuggest.commit", {});
  });

  editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.RightArrow, () => {
    editor.trigger(
      "keyboard",
      "editor.action.inlineSuggest.acceptNextWord",
      {}
    );
  });
}
