/**
 * renderer.js
 * Convierte los datos de respuesta de Claude en elementos del DOM.
 * No hace llamadas a la API — solo renderiza.
 */

const Renderer = (function () {

  /* ── Category → CSS class & emoji map ──────────────────── */
  const CAT_MAP = {
    "Flujos y Flowbuilder" : { cls: "cat--flujos",     emoji: "⚙️"  },
    "Smartons"             : { cls: "cat--smartons",   emoji: "🤖"  },
    "Grupos y Asignacion"  : { cls: "cat--grupos",     emoji: "👥"  },
    "Plantillas y Canales" : { cls: "cat--plantillas", emoji: "📱"  },
    "Usuarios y Roles"     : { cls: "cat--usuarios",   emoji: "🔑"  },
    "Configuracion General": { cls: "cat--config",     emoji: "⚙️"  },
    "Integraciones y API"  : { cls: "cat--api",        emoji: "🔗"  },
  };

  /* Remove accents for category matching */
  function normalize(str) {
    return (str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function getCatMeta(cat) {
    const nCat = normalize(cat);
    for (const key in CAT_MAP) {
      const nKey = normalize(key).split(" ")[0];
      if (nCat.includes(nKey)) return CAT_MAP[key];
    }
    return { cls: "cat--config", emoji: "📋" };
  }

  /* Escape HTML special characters */
  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* Convert **bold** markdown to <b> tags */
  function boldify(str) {
    return esc(str).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  }

  /* ── Public render functions ─────────────────────────────── */

  /**
   * Renders a structured response from Claude into a rich card.
   * @param {Object} data - Parsed JSON from Claude
   * @returns {string} HTML string
   */
  function renderRich(data) {
    const meta = getCatMeta(data.categoria || "");
    let html = '<div class="bot-card">';

    /* Category badge */
    html += `<div>
      <span class="cat-badge ${meta.cls}">
        ${meta.emoji} ${esc(data.categoria || "General")}
      </span>
    </div>`;

    /* Symptoms */
    if (data.sintomas && data.sintomas.length) {
      html += '<div class="symptoms-card">';
      html += '<div class="section-label">🔍 Síntomas detectados</div>';
      html += '<div class="pills">';
      data.sintomas.forEach(s => {
        html += `<span class="pill">${esc(s)}</span>`;
      });
      html += "</div></div>";
    }

    /* Cause */
    if (data.causa) {
      html += `
        <div class="cause-card">
          <div class="cause-label">${esc(data.emoji_causa || "💡")} Causa probable</div>
          <div class="cause-text">${boldify(data.causa)}</div>
        </div>`;
    }

    /* Steps */
    if (data.pasos && data.pasos.length) {
      html += '<div class="steps-card">';
      html += '<div class="steps-label">🔎 Dónde buscar / Qué revisar</div>';
      data.pasos.forEach((p, i) => {
        html += `
          <div class="step">
            <div class="step-num">${i + 1}</div>
            <div class="step-text">${boldify(p)}</div>
          </div>`;
      });
      html += "</div>";
    }

    /* Follow-up question */
    if (data.followup) {
      html += `<div class="followup">💬 ${esc(data.followup)}</div>`;
    }

    html += "</div>";
    return html;
  }

  /**
   * Renders a plain text response.
   * @param {string} text
   * @returns {string} HTML string
   */
  function renderSimple(text) {
    const content = esc(text)
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/\n/g, "<br>");
    return `<div class="bot-bubble">${content}</div>`;
  }

  /**
   * Renders the typing indicator.
   * @returns {HTMLElement}
   */
  function createTypingIndicator() {
    const wrap = document.createElement("div");
    wrap.className = "msg bot";
    wrap.id = "typing-indicator";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.innerHTML = "🤖";

    const bubble = document.createElement("div");
    bubble.className = "typing-wrap";
    bubble.innerHTML = "<span></span><span></span><span></span>";

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    return wrap;
  }

  /**
   * Renders a message wrapper (bot or user).
   * @param {"bot"|"user"} role
   * @param {string} htmlContent
   * @param {string[]} [suggestions]
   * @returns {HTMLElement}
   */
  function createMessage(role, htmlContent, suggestions) {
    const wrap = document.createElement("div");
    wrap.className = `msg ${role}`;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.innerHTML = role === "bot" ? "🤖" : "👤";

    const content = document.createElement("div");
    content.style.width = "100%";
    content.innerHTML = htmlContent;

    if (suggestions && suggestions.length) {
      const sugsEl = document.createElement("div");
      sugsEl.className = "suggestions";
      suggestions.forEach(text => {
        const btn = document.createElement("button");
        btn.className = "sug";
        btn.textContent = text;
        sugsEl.appendChild(btn);
      });
      content.appendChild(sugsEl);
    }

    wrap.appendChild(avatar);
    wrap.appendChild(content);
    return wrap;
  }

  /* ── Public API ───────────────────────────────────────────── */
  return {
    renderRich,
    renderSimple,
    createMessage,
    createTypingIndicator,
  };

})();
