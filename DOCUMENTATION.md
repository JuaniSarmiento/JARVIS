# 🤖 JARVIS: Sistema Operativo Multi-Agente

Bienvenido a la documentación oficial de **JARVIS**, un asistente de IA personal, local y ultra-potente diseñado para actuar como un orquestador central de tareas complejas.

---

## 🏗️ Arquitectura del Sistema

JARVIS opera bajo un modelo de **Orquestador y Subagentes Especializados**. 

### 1. El Orquestador (Jarvis Core)
El motor principal (`src/agent/loop.ts`) recibe las solicitudes vía Telegram o Webhook y decide si puede resolver la tarea directamente o si debe delegarla a un experto.
*   **Interfaz Principal**: Telegram (@bot).
*   **Memoria**: Integración con **Firebase Firestore** para persistencia de contexto histórico.

### 2. El Enjambre de Subagentes
Ubicados en `src/agent/agents_registry.ts`, cada subagente tiene un prompt de sistema único y un set de herramientas privadas.

*   **👨‍💻 DevAgent**: Experto en el sistema de archivos y ejecución de código. Puede leer, escribir, listar archivos y ejecutar scripts en `bash`, `python` o `node`.
*   **🔍 ResearchAgent**: Especialista en la web. Navega, busca y resume información en tiempo real.
*   **📅 WorkspaceAgent**: Gestiona tu productividad en Google Calendar, Drive y Gmail.

---

## 🛠️ Herramientas y Superpoderes

### 📂 Gestión de Archivos (`fs_tools`)
*   `read_file`: Lee código o texto.
*   `write_file`: Crea o modifica archivos.
*   `list_dir`: Explora la estructura de carpetas del proyecto.

### 💻 Ejecución de Código (`run_script`)
Permite al `DevAgent` ejecutar comandos directamente en tu terminal local. Soporta múltiples lenguajes, permitiendo realizar pruebas de código o automatizaciones de sistema.

### 🌐 Inteligencia Web
*   `search_web`: Búsqueda vía DuckDuckGo.
*   `read_url`: Extracción de texto limpio de cualquier sitio web usando `cheerio`.

### 🔄 Delegación (`delegate_to_agent`)
La herramienta principal del orquestador. Permite transferir el control a un subagente, quien devuelve un reporte detallado al terminar su misión.

### 🚀 Auto-Mejora (`install_skill`)
Jarvis puede dotarse a sí mismo de nuevas capacidades creando dinámicamente archivos en la carpeta `/skills`. Estas habilidades se cargan automáticamente en el prompt del sistema.

---

## 🔗 Integraciones Externas

### 🛰️ Servidor de Webhooks (n8n)
Ubicado en `src/server.ts`, JARVIS levanta un servidor Express (Puerto 3000) con el endpoint `/webhook`.
*   **Uso**: Permite que flujos de **n8n** disparen acciones en Jarvis o envíen mensajes a tu Telegram basados en eventos de terceros (ventas, alertas, etc.).

---

## 📦 Instalación y Despliegue

### Requisitos
*   Node.js v20+
*   Firebase Service Account
*   API Keys: Groq (Principal), OpenRouter (Fallback).

### Variables de Entorno (`.env`)
```env
TELEGRAM_BOT_TOKEN="tu_token"
TELEGRAM_ALLOWED_USER_IDS="tu_id"
GROQ_API_KEY="tu_key"
OPENROUTER_API_KEY="tu_key"
DB_PATH="./memory.db"
GOOGLE_APPLICATION_CREDENTIALS="./service-account.json"
```

### Comandos
*   Compilar: `npm run build`
*   Desarrollo: `npm run dev`
*   Producción: `npm start`

---

## 🛡️ Seguridad
*   **Whitelist**: Solo los IDs de Telegram en `TELEGRAM_ALLOWED_USER_IDS` pueden interactuar con Jarvis.
*   **Validaciones**: Las acciones críticas del `DevAgent` requieren confirmación del usuario antes de impactar el sistema.

---
*Documentación generada por el Asistente de Desarrollo de Jarvis.* 🫡🦾
