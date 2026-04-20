
Copiar

/**
 * chat.js
 */
(function () {
 
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
 
  let history   = [];
  let isLoading = false;
 
  const msgsEl  = document.getElementById("msgs");
  const inputEl = document.getElementById("inp");
  const sendBtn = document.getElementById("sbtn");
  const countEl = document.getElementById("kb-count");
 
  function scrollToBottom() { msgsEl.scrollTop = msgsEl.scrollHeight; }
 
  function setLoading(state) { isLoading = state; sendBtn.disabled = state; }
 
  function appendMessage(el) { msgsEl.appendChild(el); scrollToBottom(); }
 
  function parseReply(text) {
    const t = text.trim();
    const s = t.indexOf("{"), e = t.lastIndexOf("}");
    if (s === -1 || e === -1) return null;
    try { return JSON.parse(t.slice(s, e + 1)); } catch { return null; }
  }
 
  function errorToString(err) {
    if (!err)                    return "Error desconocido";
    if (typeof err === "string") return err;
    if (typeof err === "object") return err.message || JSON.stringify(err);
    return String(err);
  }
 
  async function callAPI(messages) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });
    const data = await res.json();
    data._status = res.status;
    return data;
  }
 
  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || isLoading) return;
 
    inputEl.value = "";
    inputEl.style.height = "auto";
    setLoading(true);
 
    appendMessage(Renderer.createMessage("user", `<div class="user-bubble">${text}</div>`));
    history.push({ role: "user", content: text });
 
    const typingEl = Renderer.createTypingIndicator();
    appendMessage(typingEl);
 
    try {
      const data = await callAPI(history);
      typingEl.remove();
 
      if (data.error || (data._status && data._status >= 400)) {
        const msg = errorToString(data.error);
        let hint = "";
        if (data._status === 401) hint = " — Verifica la ANTHROPIC_API_KEY en Vercel > Settings > Environment Variables.";
        if (data._status === 429) hint = " — Límite de tasa alcanzado, espera un momento.";
        appendMessage(Renderer.createMessage("bot", Renderer.renderSimple("❌ " + msg + hint)));
        history.pop();
        return;
      }
 
      const replyText = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : "{}";
      history.push({ role: "assistant", content: replyText });
 
      const parsed = parseReply(replyText);
      let html;
      if (parsed && !parsed.sin_resultado)    html = Renderer.renderRich(parsed);
      else if (parsed && parsed.sin_resultado) html = Renderer.renderSimple("🔍 " + (parsed.causa || "No encontré información. Escala este caso."));
      else                                     html = Renderer.renderSimple(replyText);
 
      appendMessage(Renderer.createMessage("bot", html));
 
    } catch (err) {
      typingEl.remove();
      appendMessage(Renderer.createMessage("bot", Renderer.renderSimple("❌ Error de conexión: " + errorToString(err))));
      history.pop();
    } finally {
      setLoading(false);
      inputEl.focus();
    }
  }
 
  sendBtn.addEventListener("click", sendMessage);
 
  inputEl.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
 
  inputEl.addEventListener("input", function() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 110) + "px";
  });
 
  msgsEl.addEventListener("click", function(e) {
    if (e.target.classList.contains("sug")) {
      inputEl.value = e.target.textContent;
      sendMessage();
    }
  });
 
  function init() {
    if (countEl && window.KB_COUNT) countEl.textContent = window.KB_COUNT + " casos";
    const html = Renderer.renderSimple(
      "👋 ¡Hola! Soy tu asistente de soporte interno para AtomChat.\n\n" +
      "Tengo acceso a la base de conocimiento con **" + (window.KB_COUNT || 260) + " casos reales**. " +
      "Cuéntame con tus propias palabras cómo describe el cliente el problema y te digo qué puede estar pasando."
    );
    appendMessage(Renderer.createMessage("bot", html, WELCOME_SUGGESTIONS));
    inputEl.focus();
  }
 
  init();
})();
