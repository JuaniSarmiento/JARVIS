# CLAUDE.md — FutBot

> Referencia rapida para agentes de IA trabajando con el repositorio FutBot.
> Lee este archivo PRIMERO. Luego lee los docs detallados segun necesidad.

---

## Overview del Proyecto

**FutBot** es un Agente de IA Autonomo para analisis tactico de futbol. Corre 100% local en la maquina del usuario. Combina un LLM local (Ollama) con una base vectorial de teoria tactica (ChromaDB), datos de planteles en tiempo real (API-Football), y un grafo de decision inteligente (LangGraph) que orquesta el razonamiento.

**Problema que resuelve**: Los LLMs genericos no saben que pasa HOY en el futbol (lesiones, transferencias, DTs actuales) y su conocimiento tactico es superficial. FutBot inyecta datos reales + teoria especializada en cada respuesta.

---

## Metodologia

**Spec-Driven Development (SDD)**: Lee la spec → Implementa exactamente lo especificado → Verifica con los criterios de aceptacion.

---

## Documentos de Referencia

| Doc | Descripcion | Cuando leer |
|-----|-------------|-------------|
| `proyecto.md` | Vision, pilares, flujo de trabajo, decisiones tecnicas | Antes de empezar cualquier trabajo |
| `arquitectura.md` | Microservicios, grafo, componentes, ADRs, infra | Antes de crear/modificar arquitectura |
| `requirements.md` | Requisitos EARS, NFRs, MVP scope | Para validar que estas implementando lo correcto |
| `especificacion.md` | Given/When/Then, contratos API, tareas por fase | Para implementar cada feature concreta |
| `habilidades.md` | Librerias, versiones, configuraciones | Para elegir dependencias |
| `ejecucion.md` | Guia paso a paso con prompts sugeridos | Para seguir el orden de implementacion |

---

## Stack Tecnologico

| Componente | Tecnologia |
|------------|-----------|
| Lenguaje | Python >= 3.11 |
| Orquestacion | LangGraph + LangChain |
| LLM Local | Ollama (Llama 3, Mistral, Qwen) |
| Vectorstore | ChromaDB |
| API HTTP | FastAPI + Uvicorn |
| Datos deportivos | API-Football (httpx) |
| Cache | Redis 7 |
| Frontend | Streamlit |
| Validacion | Pydantic v2 |
| Testing | pytest + pytest-asyncio + respx |
| Linting | ruff |
| Deploy | Docker Compose |

---

## Estructura de Directorios

```
futbot/
├── docker-compose.yml
├── .env.example
├── .gitignore
│
├── docs/
│   ├── proyecto.md
│   ├── arquitectura.md
│   ├── requirements.md
│   ├── especificacion.md
│   ├── habilidades.md
│   ├── ejecucion.md
│   └── CLAUDE.md
│
├── gateway/                     # Puerto 8000
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                  # FastAPI app, routers, CORS
│   ├── config.py                # pydantic-settings
│   ├── routers/
│   │   ├── consulta.py          # POST /v1/consulta
│   │   ├── biblioteca.py        # /v1/biblioteca/*
│   │   └── sistema.py           # /v1/health, /v1/modelos
│   └── schemas/
│       ├── consulta_schema.py
│       ├── biblioteca_schema.py
│       └── sistema_schema.py
│
├── orchestrator/                # Puerto 8001 (interno)
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── graph_builder.py         # Define el grafo LangGraph
│   ├── state.py                 # AgentState TypedDict
│   ├── nodes/
│   │   ├── clasificador.py      # Clasifica tipo de consulta
│   │   ├── recolector.py        # Invoca Ojeador (datos)
│   │   ├── buscador_rag.py      # Busqueda semantica (RAG)
│   │   ├── razonador.py         # Genera analisis (LLM)
│   │   └── validador.py         # Valida coherencia
│   ├── tools.py                 # LangChain @tool definitions
│   └── prompts.py               # Templates de prompts
│
├── rag-service/                 # Puerto 8002 (interno)
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── routers/
│   │   ├── ingesta.py           # POST /ingestar
│   │   └── busqueda.py          # POST /buscar
│   ├── chunker.py               # Division semantica de docs
│   ├── embedder.py              # Genera embeddings (Ollama)
│   └── vectorstore.py           # ChromaDB client
│
├── data-service/                # Puerto 8003 (interno)
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── routers/
│   │   ├── equipos.py           # /equipos/{nombre}/plantel
│   │   ├── jugadores.py         # /jugadores/{id}/stats
│   │   └── fixtures.py          # /equipos/{nombre}/fixture
│   ├── api_client.py            # httpx → API-Football
│   ├── cache.py                 # Redis cache-aside
│   └── transformers.py          # API response → DTOs
│
├── frontend/                    # Puerto 8501
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app.py                   # Streamlit app
│
└── tests/
    ├── conftest.py
    ├── test_gateway/
    ├── test_orchestrator/
    ├── test_rag_service/
    └── test_data_service/
```

---

## Invariantes de Arquitectura

1. **Orquestador como hub**: Solo el Orchestrator invoca a otros servicios. Los servicios NO se comunican entre si directamente.
2. **LLM local siempre**: La inferencia NUNCA sale de la maquina del usuario. No se usan APIs de OpenAI/Anthropic.
3. **Validacion obligatoria**: Pydantic v2 en todos los endpoints, sin excepciones.
4. **Config via env vars**: Nunca hardcodear URLs, API keys, puertos ni TTLs.
5. **Async everywhere**: Todos los handlers FastAPI, tools LangChain y nodos LangGraph son async.
6. **Max 3 iteraciones**: El grafo LangGraph tiene un limite duro de iteraciones para evitar loops infinitos.
7. **Cache-aside**: El Data Service SIEMPRE consulta Redis antes de API-Football.
8. **Streaming default**: Las respuestas del LLM usan streaming (SSE) por defecto.
9. **Type hints**: Obligatorios en todas las funciones publicas. Python 3.11+ typing.
10. **Sin funcionalidad inventada**: Solo se implementa lo que esta en `especificacion.md`.

---

## Fases de Implementacion

| Fase | Nombre | Servicios | Ref |
|------|--------|-----------|-----|
| 1 | Infraestructura Base | Gateway, Docker Compose, Ollama | T-1.1 a T-1.3 |
| 2 | Biblioteca Tactica (RAG) | RAG Service, ChromaDB | T-2.1 a T-2.3 |
| 3 | Datos Tiempo Real (Ojeador) | Data Service, Redis, API-Football | T-3.1 a T-3.3 |
| 4 | Orquestador (Grafo) | Orchestrator (LangGraph) | T-4.1 a T-4.5 |
| 5 | Frontend | Streamlit | T-5.1 a T-5.4 |
| 6 | Integracion | Tests, Docker final | T-6.1 a T-6.3 |

---

## Comandos Esenciales

```bash
# Levantar todo
docker compose up -d

# Ver logs
docker compose logs -f gateway
docker compose logs -f orchestrator

# Health check
curl http://localhost:8000/v1/health

# Modelos disponibles
curl http://localhost:8000/v1/modelos

# Consulta tactica
curl -X POST http://localhost:8000/v1/consulta \
  -H "Content-Type: application/json" \
  -d '{"texto": "¿Como formo River contra un 5-4-1?"}'

# Ingestar PDF
curl -X POST http://localhost:8000/v1/biblioteca/ingestar \
  -F "file=@tactica.pdf" \
  -F "titulo=Tactica" -F "fuente=Libro" -F "categoria=sistemas"

# Buscar en Biblioteca
curl -X POST http://localhost:8000/v1/biblioteca/buscar \
  -H "Content-Type: application/json" \
  -d '{"query": "mezzala contra bloque bajo", "top_k": 5}'

# Tests
pytest tests/ -v --cov

# Lint
ruff check .
ruff format .

# Frontend
# Abrir http://localhost:8501
```

---

## Puertos de Servicios

| Servicio | Puerto | Interno/Externo |
|----------|--------|-----------------|
| Gateway API | 8000 | Externo |
| Orchestrator | 8001 | Interno |
| RAG Service | 8002 | Interno |
| Data Service | 8003 | Interno |
| Ollama | 11434 | Externo |
| ChromaDB | 8100 | Externo |
| Redis | 6379 | Interno |
| Frontend | 8501 | Externo |

---

## Reglas de Seguridad

- API keys solo en variables de entorno (`.env` en `.gitignore`).
- No enviar datos del usuario a servicios externos (excepto nombre de equipo a API-Football).
- Validar MIME type de archivos subidos (solo PDF, TXT, MD).
- Rate limiting en Gateway: 60 req/min.
- No loggear contenido de consultas ni respuestas completas del LLM.
- Sanitizar nombres de equipos/jugadores antes de usar en queries.
