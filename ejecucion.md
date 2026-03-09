# Guia de Ejecucion — FutBot

> Este documento proporciona una guia paso a paso para implementar FutBot
> utilizando un agente de IA como asistente de desarrollo.
> Sigue la metodologia SDD (Spec-Driven Development).

---

## Indice

1. [Filosofia de Ejecucion](#1-filosofia-de-ejecucion)
2. [Pre-requisitos](#2-pre-requisitos)
3. [Fase 1: Infraestructura Base](#3-fase-1-infraestructura-base)
4. [Fase 2: Biblioteca Tactica (RAG)](#4-fase-2-biblioteca-tactica-rag)
5. [Fase 3: Datos en Tiempo Real (Ojeador)](#5-fase-3-datos-en-tiempo-real-ojeador)
6. [Fase 4: Orquestador (Grafo LangGraph)](#6-fase-4-orquestador-grafo-langgraph)
7. [Fase 5: Frontend Streamlit](#7-fase-5-frontend-streamlit)
8. [Fase 6: Integracion y Validacion](#8-fase-6-integracion-y-validacion)
9. [Tips para el Agente](#9-tips-para-el-agente)
10. [Resumen de Ejecucion](#10-resumen-de-ejecucion)

---

# 1. Filosofia de Ejecucion

## Leer PRIMERO, Codear DESPUES

Antes de escribir una sola linea de codigo, el agente **DEBE** leer todos los documentos de referencia en este orden:

1. `proyecto.md` — Vision general, pilares, flujo de trabajo.
2. `arquitectura.md` — Microservicios, grafo, componentes, puertos, protocolos.
3. `requirements.md` — Requisitos funcionales y no funcionales.
4. `especificacion.md` — Criterios de aceptacion (Given/When/Then), contratos API, tareas.
5. `habilidades.md` — Librerias, versiones, configuraciones.
6. `CLAUDE.md` — Resumen rapido, invariantes, comandos.

## Spec-Driven Development (SDD)

La metodologia es: **Lee la spec → Implementa exactamente lo que dice → Verifica con los criterios de aceptacion → Avanza a la siguiente tarea.**

No se inventa funcionalidad. No se optimiza prematuramente. No se cambia la arquitectura sin justificacion documentada.

## Progresion por Fases

El sistema se construye de abajo hacia arriba (bottom-up): primero la infraestructura, luego los servicios individuales (RAG, Ojeador), despues el orquestador que los conecta, y finalmente el frontend que lo expone.

Cada fase tiene:
- **Objetivo**: Que debe funcionar al terminar esta fase.
- **Pre-condicion**: Que debe estar funcionando antes de empezar.
- **Tareas**: Lista de tareas con IDs que refieren a `especificacion.md`.
- **Prompt sugerido**: Prompt para el agente de IA.
- **Verificacion**: Como confirmar que la fase esta completa.

---

# 2. Pre-requisitos

Antes de iniciar la ejecucion, verificar:

```bash
# Python
python --version  # >= 3.11

# Docker
docker --version
docker compose version

# Ollama (instalado en el host, no en Docker para desarrollo)
ollama --version
ollama pull llama3:8b
ollama pull nomic-embed-text

# API-Football key (configurada en .env)
echo $API_FOOTBALL_KEY

# GPU NVIDIA (opcional, para rendimiento)
nvidia-smi
```

---

# 3. Fase 1: Infraestructura Base

## Objetivo
Al finalizar, `docker compose up` levanta todos los contenedores y `GET /v1/health` responde con el estado de cada servicio.

## Pre-condicion
Docker, Ollama y al menos un modelo instalado.

## Tareas

### T-1.1: Scaffold del Proyecto

**Prompt sugerido para el agente:**
> Lee `arquitectura.md` seccion 4 (Vista de Contenedores) y seccion 11 (Infraestructura). Crea la estructura de directorios del proyecto con los siguientes microservicios: gateway, orchestrator, rag-service, data-service, frontend. Cada microservicio debe tener su propio `Dockerfile`, `requirements.txt` y `main.py`. Crea el `docker-compose.yml` con todos los servicios (incluyendo Ollama, ChromaDB y Redis). Crea el archivo `.env.example` con todas las variables de entorno de la seccion 11.3.

**Verificacion:**
```bash
docker compose up -d
docker compose ps  # Todos los servicios "running"
```

### T-1.2: Gateway API

**Prompt sugerido para el agente:**
> Lee `especificacion.md` Feature 06 (Sistema y Operaciones). Implementa el Gateway API con FastAPI: crea el router `sistema.py` con `GET /v1/health` que verifica la conectividad con cada microservicio y retorna el JSON especificado en el contrato API. Implementa validacion Pydantic para todos los schemas. Agrega middleware CORS y rate limiting.

**Verificacion:**
```bash
curl http://localhost:8000/v1/health
# Debe retornar JSON con status de cada servicio

curl http://localhost:8000/docs
# Swagger UI funciona
```

### T-1.3: Conexion con Ollama

**Prompt sugerido para el agente:**
> Lee `habilidades.md` seccion 3 (Ollama) y seccion 2 (langchain-ollama). Implementa el endpoint `GET /v1/modelos` en el Gateway que consulta Ollama via su API REST y retorna la lista de modelos disponibles con nombre, tamaño y VRAM requerida. Verifica que puedes hacer una inferencia basica: enviar un prompt simple y recibir respuesta.

**Verificacion:**
```bash
curl http://localhost:8000/v1/modelos
# Lista de modelos con llama3:8b (o el modelo instalado)
```

---

# 4. Fase 2: Biblioteca Tactica (RAG)

## Objetivo
Al finalizar, se pueden ingestar PDFs de tactica, buscar fragmentos por similaridad semantica, y gestionar documentos (CRUD).

## Pre-condicion
Fase 1 completada. ChromaDB y Ollama corriendo.

## Tareas

### T-2.1: Servicio RAG — Ingesta

**Prompt sugerido para el agente:**
> Lee `especificacion.md` Feature 02 (Biblioteca Tactica), especificamente AC-02.1 y AC-02.3. Lee `habilidades.md` secciones 4 (ChromaDB) y 12 (pypdf). Implementa el RAG Service con FastAPI: crea el endpoint `POST /ingestar` que recibe un archivo PDF via multipart/form-data, extrae el texto con pypdf, divide en chunks semanticos (por seccion/titulo, chunk_size=1000, overlap=200), genera embeddings con Ollama (nomic-embed-text), y almacena en ChromaDB con metadata (fuente, categoria, pagina, tema). Valida que el archivo sea PDF/TXT/MD.

**Verificacion:**
```bash
# Ingestar un PDF de prueba
curl -X POST http://localhost:8002/ingestar \
  -F "file=@tactica_test.pdf" \
  -F "titulo=Tactica de Prueba" \
  -F "fuente=Test" \
  -F "categoria=sistemas"
# Debe retornar: chunks_generados > 0
```

### T-2.2: Servicio RAG — Busqueda Semantica

**Prompt sugerido para el agente:**
> Lee `especificacion.md` AC-02.2. Implementa `POST /buscar` que recibe una query en lenguaje natural, genera su embedding, busca en ChromaDB por similaridad coseno (top_k configurable), filtra por score minimo y categoria, y retorna los fragmentos con contenido, fuente, pagina y score. El contrato de respuesta esta en `especificacion.md` Feature 02.

**Verificacion:**
```bash
# Buscar en la Biblioteca
curl -X POST http://localhost:8002/buscar \
  -H "Content-Type: application/json" \
  -d '{"query": "bloque bajo", "top_k": 3}'
# Debe retornar fragmentos relevantes con score
```

### T-2.3: Servicio RAG — CRUD

**Prompt sugerido para el agente:**
> Implementa `GET /documentos` para listar todos los documentos ingestados con su metadata. Implementa `DELETE /documentos/{id}` para eliminar un documento y todos sus chunks de ChromaDB. Integra estos endpoints en el Gateway API bajo `/v1/biblioteca/`.

**Verificacion:**
```bash
curl http://localhost:8000/v1/biblioteca       # Lista documentos
curl -X DELETE http://localhost:8000/v1/biblioteca/{id}  # Elimina documento
```

---

# 5. Fase 3: Datos en Tiempo Real (Ojeador)

## Objetivo
Al finalizar, se pueden consultar planteles, lesiones y fixtures de equipos reales con cache Redis.

## Pre-condicion
Fase 1 completada. Redis corriendo. API-Football key configurada.

## Tareas

### T-3.1: Data Service — API-Football

**Prompt sugerido para el agente:**
> Lee `especificacion.md` Feature 03 (Ojeador), especificamente AC-03.1 y los contratos API. Lee `habilidades.md` seccion 5 (API-Football, httpx). Implementa el Data Service con FastAPI: crea el cliente httpx async para API-Football con autenticacion via header. Implementa los endpoints: `GET /equipos/{nombre}/plantel` (obtiene jugadores con posicion, edad, estado), `GET /equipos/{nombre}/fixture` (proximos partidos), `GET /jugadores/{id}/estadisticas`. Mapea las respuestas crudas de API-Football a DTOs limpios de Pydantic.

**Verificacion:**
```bash
curl http://localhost:8003/equipos/river-plate/plantel
# Debe retornar plantel con jugadores reales
```

### T-3.2: Data Service — Cache Redis

**Prompt sugerido para el agente:**
> Lee `especificacion.md` AC-03.2 y AC-03.3. Lee `arquitectura.md` seccion 9.2 (esquema Redis). Implementa cache-aside con Redis: antes de llamar a API-Football, consulta Redis por key `plantel:{equipo_id}`. Si existe (cache hit), retorna sin llamar a la API. Si no existe (cache miss), llama a la API, almacena en Redis con TTL configurable (plantel=6h, lesiones=1h, fixture=24h), y retorna. Incluye el flag `cache: true/false` y `cache_edad_minutos` en la respuesta.

**Verificacion:**
```bash
# Primera llamada: cache miss
curl http://localhost:8003/equipos/river-plate/plantel
# Response debe tener "cache": false

# Segunda llamada: cache hit
curl http://localhost:8003/equipos/river-plate/plantel
# Response debe tener "cache": true
```

### T-3.3: Data Service — Manejo de Errores

**Prompt sugerido para el agente:**
> Lee `especificacion.md` AC-03.4 y AC-03.5. Lee `requirements.md` RF-14. Implementa retry con backoff exponencial (max 3 reintentos) cuando API-Football falla. Si todos los reintentos fallan y hay cache, retorna datos cacheados con warning. Si no hay cache, retorna HTTP 503 con mensaje claro. Si el equipo no existe, retorna HTTP 404.

**Verificacion:**
```bash
# Simular API caida (cortar red o cambiar API key)
curl http://localhost:8003/equipos/river-plate/plantel
# Debe retornar datos cacheados con warning, o 503 si no hay cache
```

---

# 6. Fase 4: Orquestador (Grafo LangGraph)

## Objetivo
Al finalizar, el grafo de decision del agente funciona end-to-end: clasifica la consulta, decide que herramientas usar, recolecta datos, busca teoria, razona y valida.

## Pre-condicion
Fases 1-3 completadas. RAG Service, Data Service y Ollama funcionando.

## Tareas

### T-4.1: Definicion del Grafo

**Prompt sugerido para el agente:**
> Lee `arquitectura.md` secciones 5 (Vista de Componentes - Orchestrator), 6 (Vista de Codigo), y 7 (Flujos de Datos). Implementa el grafo LangGraph con los nodos: clasificar, recolectar_datos, buscar_tactica, razonar, validar. Define el TypedDict de estado (AgentState) con los campos especificados en la seccion 6.1. Define los edges condicionales: despues de clasificar, decidir si necesita datos/teoria/ambos; despues de validar, decidir si finalizar o re-iterar.

**Verificacion:**
```python
# Test unitario
grafo = construir_grafo()
assert grafo is not None
# Visualizar grafo (LangGraph soporta .draw())
```

### T-4.2: Nodo Clasificador

**Prompt sugerido para el agente:**
> Lee `especificacion.md` AC-01.1 y AC-01.2. Implementa el nodo clasificador que recibe la consulta del usuario y usa el LLM (via Ollama) para clasificar el tipo de consulta en: propuesta_tactica, analisis_rival, comparacion, consulta_teorica, general. El clasificador tambien debe detectar nombres de equipos en la consulta. Crea el prompt template en `prompts.py`.

**Verificacion:**
```python
# Input: "¿Como formo River contra Boca?"
# Output: tipo="propuesta_tactica", equipos=["River Plate", "Boca Juniors"], necesita_datos=True
```

### T-4.3: Nodos Recolector y Buscador

**Prompt sugerido para el agente:**
> Implementa el nodo `recolectar_datos` que invoca las herramientas del Data Service (obtener_plantel, obtener_lesionados) para cada equipo detectado. Implementa el nodo `buscar_tactica` que realiza busqueda semantica en el RAG Service usando la consulta del usuario reformulada. Ambos nodos deben actualizar el estado compartido del grafo.

### T-4.4: Nodo Razonador con Streaming

**Prompt sugerido para el agente:**
> Lee `especificacion.md` AC-04.2 (Streaming). Implementa el nodo `razonador` que construye el prompt final combinando: la consulta del usuario, los datos del plantel, los fragmentos tacticos, e instrucciones de formato. Envia el prompt al LLM via Ollama con streaming habilitado. Los tokens deben poder transmitirse al frontend via SSE.

### T-4.5: Nodo Validador

**Prompt sugerido para el agente:**
> Lee `especificacion.md` AC-01.3 y AC-01.5. Implementa el nodo `validador` que verifica: todos los jugadores mencionados en la respuesta estan en el plantel actual, ningun jugador propuesto esta lesionado o suspendido, las posiciones asignadas son validas. Si la validacion falla y no se alcanzo max_iteraciones, marca el estado para re-iterar. Si se alcanzo el maximo, retorna con disclaimer.

**Verificacion:**
```bash
# Consulta completa end-to-end
curl -X POST http://localhost:8000/v1/consulta \
  -H "Content-Type: application/json" \
  -d '{"texto": "¿Como formo River contra un 5-4-1?", "opciones": {"streaming": false}}'
# Debe retornar analisis con jugadores reales y fuentes tacticas
```

---

# 7. Fase 5: Frontend Streamlit

## Objetivo
Al finalizar, el usuario puede interactuar con FutBot via una interfaz web conversacional con display de razonamiento en tiempo real.

## Pre-condicion
Fases 1-4 completadas. El endpoint `POST /v1/consulta` funciona.

## Tareas

### T-5.1: Chat Conversacional

**Prompt sugerido para el agente:**
> Lee `especificacion.md` Feature 05 (Frontend), AC-05.1. Implementa la interfaz de chat con Streamlit: usa `st.chat_input()` para capturar mensajes del usuario, `st.chat_message()` para mostrar mensajes de usuario y agente, y `st.session_state` para mantener el historial de la sesion.

### T-5.2: Display de Razonamiento + Streaming

**Prompt sugerido para el agente:**
> Lee `especificacion.md` AC-05.2 y AC-05.3. Implementa el display de razonamiento: cuando el agente procesa una consulta, muestra en la interfaz que nodo esta visitando (🔍 Clasificando..., 📡 Obteniendo plantel..., 📚 Buscando teoria..., 🧠 Generando analisis...) usando `st.status()`. Implementa streaming de la respuesta del LLM con `st.write_stream()`.

### T-5.3: Panel de Configuracion

**Prompt sugerido para el agente:**
> Lee `especificacion.md` AC-05.4. Implementa un sidebar con Streamlit que permita: seleccionar el modelo LLM (dropdown con modelos de `GET /v1/modelos`), ajustar max_iteraciones (slider 1-5), ajustar rag_top_k (slider 1-10), y ver el estado del sistema (health check).

### T-5.4: Gestion de Biblioteca

**Prompt sugerido para el agente:**
> Lee `especificacion.md` AC-05.5. Agrega al sidebar un panel de Biblioteca: `st.file_uploader()` para subir PDFs con campos de titulo, fuente y categoria. Al subir, envia al endpoint `/v1/biblioteca/ingestar`. Muestra la lista de documentos ingestados con opcion de eliminar.

---

# 8. Fase 6: Integracion y Validacion

## Objetivo
Al finalizar, el sistema completo funciona end-to-end, los tests pasan, y el deploy con Docker Compose es reproducible.

## Pre-condicion
Fases 1-5 completadas.

## Tareas

### T-6.1: Tests de Integracion

**Prompt sugerido para el agente:**
> Crea tests de integracion que cubran el flujo completo: enviar consulta al Gateway → verificar que el grafo se ejecuta correctamente → verificar que la respuesta contiene jugadores reales y fuentes tacticas. Mockea API-Football con `respx` y Ollama con respuestas predefinidas.

### T-6.2: Tests de Tolerancia a Fallos

**Prompt sugerido para el agente:**
> Lee `requirements.md` seccion 3.2 (Disponibilidad). Crea tests que verifiquen: API-Football caida → sistema responde con cache. Ollama caido → error claro (no crash). ChromaDB caido → respuesta sin RAG (calidad reducida). Redis caido → sistema funciona sin cache.

### T-6.3: Docker Compose Final

**Prompt sugerido para el agente:**
> Revisa el `docker-compose.yml` final. Verifica que todos los servicios levantan correctamente, los health checks pasan, los volumenes persisten datos, y el sistema es reproducible con `docker compose up` desde cero.

**Verificacion final:**
```bash
docker compose down -v    # Borrar todo
docker compose up -d      # Levantar desde cero
sleep 30                  # Esperar inicializacion

# Health check
curl http://localhost:8000/v1/health

# Ingestar un documento de prueba
curl -X POST http://localhost:8000/v1/biblioteca/ingestar \
  -F "file=@test_tactica.pdf" \
  -F "titulo=Test" -F "fuente=Test" -F "categoria=sistemas"

# Consulta completa
curl -X POST http://localhost:8000/v1/consulta \
  -H "Content-Type: application/json" \
  -d '{"texto": "¿Como deberia formar River contra un 5-4-1?"}'

# Abrir frontend
# http://localhost:8501
```

---

# 9. Tips para el Agente

1. **Siempre lee la spec antes de implementar.** Si un endpoint no esta en `especificacion.md`, no lo crees.
2. **Usa los contratos API como tests.** El JSON de request/response en la spec ES el expected output de tus tests.
3. **No inventes funcionalidad.** Si no esta en la spec, no lo hagas. Si crees que falta algo, pregunta.
4. **Mantene consistencia de puertos.** Gateway: 8000, Orchestrator: 8001, RAG: 8002, Data: 8003, Ollama: 11434, ChromaDB: 8100, Redis: 6379, Frontend: 8501.
5. **Config via variables de entorno.** Nunca hardcodees URLs, API keys o puertos.
6. **Type hints en todo.** Python 3.11+ typing moderno. Pydantic para schemas.
7. **Async en todo.** FastAPI async handlers, httpx async client, LangChain async invocations.

---

# 10. Resumen de Ejecucion

| Fase | Tareas | Resultado |
|------|--------|-----------|
| 1. Infraestructura | T-1.1, T-1.2, T-1.3 | Docker Compose levanta. Health check funciona. Ollama conectado. |
| 2. Biblioteca | T-2.1, T-2.2, T-2.3 | Ingesta de PDFs. Busqueda semantica. CRUD de documentos. |
| 3. Ojeador | T-3.1, T-3.2, T-3.3 | Planteles reales. Cache Redis. Retry y fallback. |
| 4. Orquestador | T-4.1 - T-4.5 | Grafo LangGraph funcional. Clasificar → Recolectar → Buscar → Razonar → Validar. |
| 5. Frontend | T-5.1 - T-5.4 | Chat conversacional. Streaming. Config. Biblioteca. |
| 6. Integracion | T-6.1 - T-6.3 | Tests pasan. Tolerancia a fallos. Deploy reproducible. |
