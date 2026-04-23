/**
 * chat.js
 * Lógica del chat con historial persistente en localStorage.
 * Depende de: renderer.js (window.Renderer)
 */
(function () {

  // ── Configuración ──────────────────────────────────────────────────
  const STORAGE_KEY    = "atomchat_history";       // Clave en localStorage
  const MAX_MESSAGES   = 40;                        // Máximo de mensajes guardados
  const SESSION_HOURS  = 8;                         // Horas antes de limpiar el historial

  // ── System prompt ──────────────────────────────────────────────────
  // Nota: con Notion como KB, el system prompt lo construye api/chat.py
  // Este array solo se usa como fallback si window.KB_TEXT está disponible
  const SYSTEM_PROMPT = [
    "Eres un asistente de soporte interno para AtomChat.",
    "Ayudas a agentes NUEVOS a entender y resolver casos usando la base de conocimiento.",
    "",
    "FORMATO DE RESPUESTA OBLIGATORIO:",
    "Responde SIEMPRE en este JSON exacto (sin markdown, sin texto fuera del JSON):",
    "{",
    "  \"categoria\": \"nombre exacto de la categoria\",",
    "  \"sintomas\": [\"sintoma detectado 1\", \"sintoma detectado 2\"],",
    "  \"causa\": \"explicacion clara en 1-3 oraciones\",",
    "  \"pasos\": [\"paso 1 concreto\", \"paso 2\", \"paso 3\"],",
    "  \"followup\": \"pregunta corta de seguimiento\",",
    "  \"emoji_causa\": \"un emoji representativo\",",
    "  \"sin_resultado\": false",
    "}",
    "",
    "Si no hay info relevante usa sin_resultado:true.",
    "Pasos concretos con rutas de menus si aplica.",
    "Responde en espanol. SOLO el JSON.",
  ].join("\n");

  const WELCOME_SUGGESTIONS = [
    "conversaciones se cierran solas",
    "triángulo rojo en mensajes",
    "el bot no asigna al agente",
    "plantilla no aparece en el flujo",
    "HubSpot no sincroniza contactos",
    "error 131049 en plantillas",
  ];

  // ── Estado ─────────────────────────────────────────────────────────
  let history   = [];   // Array de { role, content } para la API
  let rendered  = [];   // Array de { role, html } para restaurar en pantalla
  let isLoading = false;

  // ── DOM refs ────────────────────────────────────────────────────────
  const msgsEl  = document.getElementById("msgs");
  const inputEl = document.getElementById("inp");
  const sendBtn = document.getElementById("sbtn");
  const countEl = document.getElementById("kb-count");

  // ── localStorage helpers ────────────────────────────────────────────

  /**
   * Guarda el historial actual en localStorage con timestamp.
   */
  function saveToStorage() {
    try {
      const payload = {
        savedAt:  Date.now(),
        history:  history,
        rendered: rendered,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      // localStorage puede estar lleno o bloqueado — falla silenciosamente
      console.warn("No se pudo guardar el historial:", e);
    }
  }

  /**
   * Carga el historial desde localStorage.
   * Retorna null si no hay historial o si expiró la sesión.
   */
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const payload = JSON.parse(raw);
      const ageHours = (Date.now() - payload.savedAt) / (1000 * 60 * 60);

      // Si la sesión expiró, borrar y retornar null
      if (ageHours > SESSION_HOURS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return payload;
    } catch (e) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  /**
   * Limpia el historial del localStorage y reinicia la conversación.
   */
  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    history  = [];
    rendered = [];
    msgsEl.innerHTML = "";
    showWelcome();
  }

  // ── UI helpers ──────────────────────────────────────────────────────

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

  function parseReply(text) {
    const t = text.trim();
    const s = t.indexOf("{");
    const e = t.lastIndexOf("}");
    if (s === -1 || e === -1) return null;
    try { return JSON.parse(t.slice(s, e + 1)); } catch { return null; }
  }

  function errorToString(err) {
    if (!err)                    return "Error desconocido";
    if (typeof err === "string") return err;
    if (typeof err === "object") return err.message || JSON.stringify(err);
    return String(err);
  }

  // ── Renderizado de mensajes guardados ───────────────────────────────

  /**
   * Restaura los mensajes guardados en pantalla sin llamar a la API.
   */
  function restoreMessages(savedRendered) {
    savedRendered.forEach(function (item) {
      const el = Renderer.createMessage(item.role, item.html);
      msgsEl.appendChild(el);
    });
    scrollToBottom();
  }

  /**
   * Muestra el mensaje de bienvenida con sugerencias.
   */
  function showWelcome() {
    const html = Renderer.renderSimple(
      "👋 ¡Hola! Soy tu asistente de soporte interno para AtomChat.\n\n" +
      "Cuéntame con tus propias palabras cómo describe el cliente el problema " +
      "y te digo qué puede estar pasando y por dónde revisar."
    );
    const welcomeEl = Renderer.createMessage("bot", html, WELCOME_SUGGESTIONS);
    appendMessage(welcomeEl);
  }

  // ── API ─────────────────────────────────────────────────────────────

  async function callAPI(messages) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system:     SYSTEM_PROMPT,
        messages:   messages,
      }),
    });
    const data = await res.json();
    data._status = res.status;
    return data;
  }

  // ── Enviar mensaje ──────────────────────────────────────────────────

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || isLoading) return;

    inputEl.value = "";
    inputEl.style.height = "auto";
    setLoading(true);

    // Renderizar y guardar mensaje del usuario
    const userHtml = "<div class=\"user-bubble\">" + text + "</div>";
    appendMessage(Renderer.createMessage("user", userHtml));
    history.push({ role: "user", content: text });
    rendered.push({ role: "user", html: userHtml });

    // Indicador de escritura
    const typingEl = Renderer.createTypingIndicator();
    appendMessage(typingEl);

    try {
      const data = await callAPI(history);
      typingEl.remove();

      // Error de la API
      if (data.error || (data._status && data._status >= 400)) {
        const msg  = errorToString(data.error);
        let hint   = "";
        if (data._status === 401) hint = " — Verifica la API key en Vercel > Settings > Environment Variables.";
        if (data._status === 429) hint = " — Límite de tasa alcanzado, espera un momento.";
        const errHtml = Renderer.renderSimple("❌ " + msg + hint);
        appendMessage(Renderer.createMessage("bot", errHtml));
        // Revertir el último mensaje del usuario del historial
        history.pop();
        rendered.pop();
        return;
      }

      const replyText = (data.content && data.content[0] && data.content[0].text)
        ? data.content[0].text
        : "{}";

      history.push({ role: "assistant", content: replyText });

      // Renderizar respuesta
      const parsed = parseReply(replyText);
      let botHtml;
      if (parsed && !parsed.sin_resultado) {
        botHtml = Renderer.renderRich(parsed);
      } else if (parsed && parsed.sin_resultado) {
        botHtml = Renderer.renderSimple(
          "🔍 " + (parsed.causa || "No encontré información en la base de conocimiento. Escala este caso.")
        );
      } else {
        botHtml = Renderer.renderSimple(replyText);
      }

      appendMessage(Renderer.createMessage("bot", botHtml));
      rendered.push({ role: "bot", html: botHtml });

      // Mantener solo los últimos MAX_MESSAGES mensajes
      if (history.length > MAX_MESSAGES) {
        history  = history.slice(-MAX_MESSAGES);
        rendered = rendered.slice(-MAX_MESSAGES);
      }

      // Guardar en localStorage después de cada intercambio completo
      saveToStorage();

    } catch (err) {
      typingEl.remove();
      appendMessage(Renderer.createMessage("bot",
        Renderer.renderSimple("❌ Error de conexión: " + errorToString(err))
      ));
      history.pop();
      rendered.pop();
    } finally {
      setLoading(false);
      inputEl.focus();
    }
  }

  // ── Botón de limpiar historial ──────────────────────────────────────

  function addClearButton() {
    const topbar = document.querySelector(".topbar");
    if (!topbar) return;

    const btn = document.createElement("button");
    btn.title     = "Limpiar conversación";
    btn.innerHTML = "🗑️";
    btn.style.cssText = [
      "background: rgba(255,255,255,0.15)",
      "border: none",
      "border-radius: 8px",
      "cursor: pointer",
      "font-size: 16px",
      "padding: 5px 8px",
      "margin-left: 8px",
      "transition: background 0.15s",
    ].join(";");

    btn.addEventListener("mouseenter", function () {
      btn.style.background = "rgba(255,255,255,0.25)";
    });
    btn.addEventListener("mouseleave", function () {
      btn.style.background = "rgba(255,255,255,0.15)";
    });
    btn.addEventListener("click", function () {
      if (confirm("¿Limpiar el historial de la conversación?")) {
        clearHistory();
      }
    });

    topbar.appendChild(btn);
  }

  // ── Event listeners ─────────────────────────────────────────────────

  sendBtn.addEventListener("click", sendMessage);

  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  inputEl.addEventListener("input", function () {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 110) + "px";
  });

  msgsEl.addEventListener("click", function (e) {
    if (e.target.classList.contains("sug")) {
      inputEl.value = e.target.textContent;
      sendMessage();
    }
  });

  // ── Init ─────────────────────────────────────────────────────────────

  function init() {
    if (countEl) countEl.textContent = (window.KB_COUNT || 260) + " casos";

    addClearButton();

    // Intentar restaurar historial guardado
    const saved = loadFromStorage();

    if (saved && saved.rendered && saved.rendered.length > 0) {
      // Restaurar historial de API (para continuar la conversación con contexto)
      history  = saved.history  || [];
      rendered = saved.rendered || [];

      // Mostrar bienvenida resumida con indicador de sesión restaurada
      const resumeHtml = Renderer.renderSimple(
        "🔄 Conversación restaurada — tienes " + rendered.length +
        " mensajes anteriores.\n\nPuedes continuar donde lo dejaste o pulsar 🗑️ para empezar de cero."
      );
      appendMessage(Renderer.createMessage("bot", resumeHtml));

      // Restaurar mensajes en pantalla
      restoreMessages(rendered);

    } else {
      // Primera vez o historial expirado — mostrar bienvenida normal
      showWelcome();
    }

    inputEl.focus();
  }

  init();

})();
