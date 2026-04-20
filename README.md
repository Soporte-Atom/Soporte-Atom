# AtomChat Soporte AI

Chatbot interno de soporte para el equipo de AtomChat.
Consulta una base de conocimiento de 260 casos reales y responde con causa probable y pasos de diagnóstico.

---

## Estructura del proyecto

```
atomchat-kb/
├── api/
│   └── chat.py              ← Función serverless (proxy seguro a Anthropic)
├── public/
│   ├── index.html           ← Estructura HTML del chatbot
│   ├── css/
│   │   └── styles.css       ← Todos los estilos visuales
│   └── js/
│       ├── kb-data.js       ← Base de conocimiento en base64 (auto-generado)
│       ├── renderer.js      ← Convierte respuestas JSON en tarjetas visuales
│       └── chat.js          ← Lógica del chat, llamadas API y eventos UI
├── vercel.json              ← Configuración de rutas para Vercel
├── requirements.txt         ← Dependencias Python (vacío, solo stdlib)
└── .gitignore
```

---

## Deploy en Vercel

### 1. Subir a GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/tu-usuario/atomchat-kb.git
git push -u origin main
```

### 2. Importar en Vercel

1. Ve a https://vercel.com → **New Project**
2. Importa el repositorio de GitHub
3. En **Environment Variables** agrega:
   - `ANTHROPIC_API_KEY` = `sk-ant-api03-...`
4. Haz clic en **Deploy**

### 3. Cada actualización

```bash
git add .
git commit -m "Actualizar KB"
git push
```
Vercel hace el redeploy automáticamente.

---

## Actualizar la base de conocimiento

La base de conocimiento vive en `public/js/kb-data.js` como texto codificado en base64.

Para actualizarla, regenera el archivo con el script de Python incluido en el repositorio (ver `scripts/generate-kb.py` si aplica), o reemplaza el contenido de la variable `raw` dentro de `kb-data.js`.

---

## Desarrollo local

Instala [Vercel CLI](https://vercel.com/docs/cli):

```bash
npm install -g vercel
```

Luego, en la carpeta del proyecto:

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # Mac/Linux
# set ANTHROPIC_API_KEY=sk-ant-...    # Windows CMD

vercel dev
```

Abre http://localhost:3000

---

## Tecnologías

- **Frontend:** HTML, CSS, JavaScript vanilla (sin frameworks)
- **Backend:** Python 3 serverless (Vercel Functions)
- **AI:** Claude claude-sonnet-4-20250514 via Anthropic API
