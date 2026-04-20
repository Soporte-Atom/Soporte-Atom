/**
 * chat.js
 * Controla la lógica del chat: estado, API calls y eventos de UI.
 * Depende de: kb-data.js (window.KB_TEXT) y renderer.js (window.Renderer)
 */

(function () {

  /* ── System prompt ───────────────────────────────────────── */
  const SYSTEM_PROMPT = [
    "Eres un asistente de soporte interno para AtomChat.",
    "Ayudas a agentes NUEVOS a entender y resolver casos usando la base de conocimiento.",
    "",
    "BASE DE CONOCIMIENTO:",
    window.KB_TEXT || "",
    "",
    "FORMATO DE RESPUESTA OBLIGATORIO:",
    "Responde SIEMPRE en este JSON exacto (sin markdown, sin texto fuera del JSON):",
    "{",
    '  "categoria": "nombre exacto de la categoria",',
    '  "sintomas": ["sintoma detectado 1", "sintoma detectado 2"],',
    '  "causa": "explicacion clara en 1-3 oraciones",',
    '  "pasos": ["paso 1 concreto", "paso 2", "paso 3"],',
    '  "followup": "pregunta corta de seguimiento",',
    '  "emoji_causa": "un emoji representativo",',
    '  "sin_resultado": false',
    "}",
    "",
    "Si no hay info relevante usa sin_resultado:true y en causa explica que no encontraste info.",
    "Los pasos deben ser concretos con rutas de menus si aplica.",
    "Usa emojis en los pasos para hacerlos más visuales.",
    "Responde en español. SOLO el JSON, nada más.",
  ].join("\n");

  /* ── Welcome suggestions ─────────────────────────────────── */
  const WELCOME_SUGGESTIONS = [
    "conversaciones se cierran solas",
    "triángulo rojo en mensajes",
    "el bot no asigna al agente",
    "plantilla no aparece en el flujo",
    "HubSpot no sincroniza contactos",
    "error 131049 en plantillas",
  ];

  /* ── State ───────────────────────────────────────────────── */
  let history = [];
  let isLoading = false;

  /* ── DOM refs ────────────────────────────────────────────── */
  const msgsEl  = document.getElementById("msgs");
  const inputEl = document.getElementById("inp");
  const sendBtn = document.getElementById("sbtn");
  const countEl = document.getElementById("kb-count");

  /* ── Helpers ─────────────────────────────────────────────── */

  function scrollToBottom() {
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function setLoading(state) {
    isLoading = state;
    sendBtn.disabled = state;
  }

  function appendMessage(el) {
    msgsEl.appendChild(el);
    scrollToBottom();
  }

  /** Parse JSON from Claude reply (strips surrounding text if any) */
  function parseReply(text) {
    const t = text.trim();
    const start = t.indexOf("{");
    const end   = t.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  /* ── API call ────────────────────────────────────────────── */

  async function callAPI(messages) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });
    return response.json();
  }

  /* ── Send message ────────────────────────────────────────── */

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || isLoading) return;

    /* Reset input */
    inputEl.value = "";
    inputEl.style.height = "auto";
    setLoading(true);

    /* Render user message */
    const userMsg = Renderer.createMessage("user", `<div class="user-bubble">${text}</div>`);
    appendMessage(userMsg);

    /* Add to history */
    history.push({ role: "user", content: text });

    /* Show typing indicator */
    const typingEl = Renderer.createTypingIndicator();
    appendMessage(typingEl);

    try {
      const data = await callAPI(history);

      typingEl.remove();

      /* Handle API error */
      if (data.error) {
        const errHtml = Renderer.renderSimple(`❌ Error: ${data.error}`);
        appendMessage(Renderer.createMessage("bot", errHtml));
        history.pop();
        return;
      }

      const replyText = data.content?.[0]?.text ?? "{}";
      history.push({ role: "assistant", content: replyText });

      /* Render response */
      const parsed = parseReply(replyText);
      let html;

      if (parsed && !parsed.sin_resultado) {
        html = Renderer.renderRich(parsed);
      } else if (parsed?.sin_resultado) {
        html = Renderer.renderSimple(
          `🔍 ${parsed.causa || "No encontré información en la base de conocimiento. Te recomiendo escalar este caso."}`
        );
      } else {
        html = Renderer.renderSimple(replyText);
      }

      const botMsg = Renderer.createMessage("bot", html);
      appendMessage(botMsg);

    } catch {
      typingEl.remove();
      const errHtml = Renderer.renderSimple(
        "❌ Error de conexión con el servidor. Verifica que el servidor esté activo."
      );
      appendMessage(Renderer.createMessage("bot", errHtml));
      history.pop();
    } finally {
      setLoading(false);
      inputEl.focus();
    }
  }

  /* ── Event listeners ─────────────────────────────────────── */

  sendBtn.addEventListener("click", sendMessage);

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 110) + "px";
  });

  /* Suggestion chip clicks — delegated to avoid rebinding */
  msgsEl.addEventListener("click", (e) => {
    if (e.target.classList.contains("sug")) {
      inputEl.value = e.target.textContent;
      sendMessage();
    }
  });

  /* ── Init ────────────────────────────────────────────────── */

  function init() {
    /* Update KB count in header */
    if (countEl && window.KB_COUNT) {
      countEl.textContent = `${window.KB_COUNT} casos`;
    }

    /* Welcome message */
    const welcomeHtml = Renderer.renderSimple(
      "👋 ¡Hola! Soy tu asistente de soporte interno para AtomChat.\n\n" +
      `Tengo acceso a la base de conocimiento con **${window.KB_COUNT || 260} casos reales**. ` +
      "Cuéntame con tus propias palabras cómo describe el cliente el problema " +
      "y te digo qué puede estar pasando y por dónde revisar."
    );

    const welcomeMsg = Renderer.createMessage("bot", welcomeHtml, WELCOME_SUGGESTIONS);
    appendMessage(welcomeMsg);
    inputEl.focus();
  }

  init();

})();
