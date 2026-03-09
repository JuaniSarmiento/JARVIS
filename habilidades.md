# Habilidades y Herramientas Recomendadas — FutBot

> Este documento lista las habilidades, librerias, frameworks y herramientas
> recomendadas para desarrollar FutBot.

---

## Indice

1. [Lenguaje y Runtime](#1-lenguaje-y-runtime)
2. [Framework de Agentes y Orquestacion](#2-framework-de-agentes-y-orquestacion)
3. [Modelo de Lenguaje Local](#3-modelo-de-lenguaje-local)
4. [Base de Datos Vectorial y RAG](#4-base-de-datos-vectorial-y-rag)
5. [APIs de Datos Deportivos](#5-apis-de-datos-deportivos)
6. [Framework HTTP y API](#6-framework-http-y-api)
7. [Cache y Almacenamiento](#7-cache-y-almacenamiento)
8. [Frontend e Interfaz](#8-frontend-e-interfaz)
9. [Testing](#9-testing)
10. [Calidad de Codigo](#10-calidad-de-codigo)
11. [Containerizacion y DevOps](#11-containerizacion-y-devops)
12. [Utilidades y Procesamiento](#12-utilidades-y-procesamiento)
13. [Resumen de Dependencias](#13-resumen-de-dependencias)

---

# 1. Lenguaje y Runtime

## Python >= 3.11
**Uso**: Lenguaje unico de todo el sistema.
**Porque**: Domina el ecosistema de IA, NLP y agentes autonomos. Typing moderno (TypedDict, Annotated), match/case, ExceptionGroups, y mejoras de rendimiento respecto a versiones anteriores.

```bash
# Verificar version
python --version  # >= 3.11
```

---

# 2. Framework de Agentes y Orquestacion

## LangChain
**Uso**: Framework base para interactuar con LLMs, definir tools, gestionar prompts y conectar con vectorstores.
**Porque**: Es el estandar de la industria para construir aplicaciones con LLMs. Provee abstracciones para modelos, embeddings, retrievers, y herramientas que el agente puede invocar.

```bash
pip install langchain langchain-core langchain-community
```

**Componentes clave usados**:
- `ChatOllama`: Interfaz con Ollama para inferencia local.
- `@tool`: Decorador para definir herramientas del agente.
- `ChatPromptTemplate`: Templates de prompts.
- `StrOutputParser`: Parseo de respuestas.

## LangGraph
**Uso**: Orquestador del grafo de decision del agente.
**Porque**: Extiende LangChain con grafos dirigidos de estados que permiten ciclos condicionales. A diferencia de los chains lineales, LangGraph permite que el agente vuelva atras (re-iterar si la validacion falla), ejecute nodos en paralelo y tome decisiones condicionales.

```bash
pip install langgraph
```

**Componentes clave usados**:
- `StateGraph`: Define el grafo con nodos y edges.
- `END`: Marcador de finalizacion del grafo.
- `add_conditional_edges`: Ruteo condicional entre nodos.

## langchain-ollama
**Uso**: Integracion oficial de LangChain con Ollama.
**Porque**: Provee `ChatOllama` y `OllamaEmbeddings` como interfaces nativas para inferencia y generacion de embeddings locales.

```bash
pip install langchain-ollama
```

---

# 3. Modelo de Lenguaje Local

## Ollama
**Uso**: Servidor de inferencia local. Gestiona, descarga y ejecuta modelos LLM en la GPU del usuario.
**Porque**: Simplifica la ejecucion de LLMs locales: `ollama pull llama3` descarga y configura el modelo. Expone una API REST compatible con OpenAI format, facilitando la integracion con LangChain.

```bash
# Instalacion (Windows/Mac/Linux)
# Ver https://ollama.com/download

# Descargar modelos
ollama pull llama3:8b          # 4.7GB, requiere ~6GB VRAM
ollama pull mistral:7b         # 4.1GB, requiere ~5GB VRAM
ollama pull nomic-embed-text   # Modelo de embeddings

# Verificar
ollama list    # Lista modelos descargados
ollama ps      # Modelos en memoria
```

**Modelos recomendados**:

| Modelo | Tamaño | VRAM Requerida | Mejor Para |
|--------|--------|----------------|------------|
| Llama 3 8B | 4.7 GB | 6 GB | Hardware moderado, buena calidad general |
| Llama 3 70B | 40 GB | 40 GB | Maxima calidad, hardware potente |
| Mistral 7B | 4.1 GB | 5 GB | Equilibrio velocidad/calidad |
| Qwen 2.5 7B | 4.4 GB | 5.5 GB | Buen rendimiento en español |
| DeepSeek-R1 8B | 4.9 GB | 6 GB | Razonamiento avanzado |

---

# 4. Base de Datos Vectorial y RAG

## ChromaDB
**Uso**: Base de datos vectorial para la Biblioteca Tactica.
**Porque**: La opcion mas simple para deployment local: se ejecuta como proceso Python, persistencia a disco, integracion nativa con LangChain, y soporte de metadata filtrable. No requiere configuracion de infraestructura compleja.

```bash
pip install chromadb
```

**Uso tipico**:
```python
import chromadb
client = chromadb.HttpClient(host="chromadb", port=8000)
collection = client.get_or_create_collection("biblioteca_tactica")
collection.add(
    documents=["texto del chunk..."],
    metadatas=[{"fuente": "Herr Pep", "categoria": "sistemas"}],
    ids=["chunk_001"]
)
results = collection.query(query_texts=["bloque bajo"], n_results=5)
```

## langchain-chroma
**Uso**: Wrapper de LangChain para ChromaDB.
```bash
pip install langchain-chroma
```

## Alternativa: Qdrant
Si se necesita mayor rendimiento con millones de documentos, Qdrant es una alternativa mas robusta que ChromaDB.

```bash
pip install qdrant-client
# Docker: docker run -p 6333:6333 qdrant/qdrant
```

## Embeddings

### nomic-embed-text (via Ollama)
**Uso**: Modelo de embeddings local para vectorizar documentos tacticos.
**Porque**: Corre localmente via Ollama sin dependencia externa. Calidad suficiente para RAG en español.

```bash
ollama pull nomic-embed-text
```

### Alternativa: SentenceTransformers
Si se necesitan embeddings multilingues de mayor calidad:
```bash
pip install sentence-transformers
```
Modelo recomendado: `paraphrase-multilingual-MiniLM-L12-v2` (español + ingles).

---

# 5. APIs de Datos Deportivos

## API-Football
**Uso**: Fuente principal de datos en tiempo real (planteles, lesiones, estadisticas, fixtures).
**Porque**: La API deportiva mas completa y accesible. Cubre todas las ligas del mundo. Plan gratuito con 100 requests/dia.

```bash
# No es una libreria Python, se consume via HTTP
# Documentacion: https://www.api-football.com/documentation-v3
```

**Endpoints principales**:
- `GET /v3/players/squads?team={id}` — Plantel completo
- `GET /v3/injuries?team={id}` — Lesiones actuales
- `GET /v3/fixtures?team={id}&next=5` — Proximos partidos
- `GET /v3/players?id={id}&season=2025` — Estadisticas del jugador

## httpx
**Uso**: Cliente HTTP async para consumir API-Football desde el Data Service.
**Porque**: Soporta async/await nativo, timeout configurable, retry policies. Mas moderno que `requests`.

```bash
pip install httpx
```

## Alternativa: Transfermarkt Scraping
Si no se desea pagar por API-Football:
```bash
pip install transfermarkt-api  # Wrapper no oficial
# O scraping con BeautifulSoup
pip install beautifulsoup4 lxml
```

---

# 6. Framework HTTP y API

## FastAPI
**Uso**: Framework HTTP para el Gateway API, Data Service y RAG Service.
**Porque**: Validacion automatica con Pydantic, documentacion OpenAPI generada, async nativo, inyeccion de dependencias, el framework mas popular del ecosistema Python para APIs.

```bash
pip install fastapi
```

## Uvicorn
**Uso**: Servidor ASGI para ejecutar FastAPI.
```bash
pip install uvicorn[standard]
```

## Pydantic v2
**Uso**: Validacion de datos y schemas de request/response.
**Porque**: Validacion automatica de tipos, serializacion JSON, generacion de JSON Schema. Version 2 es significativamente mas rapida que v1.

```bash
pip install pydantic pydantic-settings
```

---

# 7. Cache y Almacenamiento

## Redis
**Uso**: Cache de datos deportivos con TTL configurable.
**Porque**: Estandar de la industria para cache. Soporta TTL nativo por key, estructuras de datos avanzadas, y latencia sub-milisegundo.

```bash
pip install redis
# Docker: docker run -p 6379:6379 redis:7-alpine
```

**Patron de cache**:
```python
import redis
r = redis.Redis(host='redis', port=6379, decode_responses=True)

# Escribir con TTL
r.setex(f"plantel:{equipo_id}", 21600, json.dumps(plantel))  # TTL 6 horas

# Leer
cached = r.get(f"plantel:{equipo_id}")
if cached:
    return json.loads(cached)
```

---

# 8. Frontend e Interfaz

## Streamlit
**Uso**: Interfaz web conversacional de FutBot.
**Porque**: Permite crear interfaces de chat con Python puro, sin escribir HTML/CSS/JS. Soporta streaming, session state, file upload, y widgets configurables. Ideal para prototipos de IA.

```bash
pip install streamlit
```

**Componentes clave**:
- `st.chat_input()`: Input de chat del usuario.
- `st.chat_message()`: Burbujas de chat.
- `st.write_stream()`: Streaming de texto (efecto "maquina de escribir").
- `st.sidebar`: Panel lateral para configuracion y Biblioteca.
- `st.file_uploader()`: Subida de PDFs para la Biblioteca.
- `st.status()`: Indicador de progreso del razonamiento.

## Alternativa: Gradio
Si se prefiere una interfaz mas orientada a modelos ML:
```bash
pip install gradio
```

---

# 9. Testing

## pytest
**Uso**: Framework de testing principal.
```bash
pip install pytest pytest-asyncio pytest-cov
```

## pytest-asyncio
**Uso**: Testing de funciones async (routers FastAPI, tools LangChain, nodos LangGraph).
```bash
# pytest.ini
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

## httpx (TestClient)
**Uso**: Testing de endpoints FastAPI en lugar de `requests`.
```python
from httpx import AsyncClient
from main import app

async def test_health():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/v1/health")
    assert response.status_code == 200
```

## Mocking
```bash
pip install pytest-mock respx  # respx para mockear httpx
```
- `respx`: Mockea llamadas httpx (API-Football).
- `unittest.mock`: Mockea Ollama, ChromaDB.

---

# 10. Calidad de Codigo

## ruff
**Uso**: Linter y formatter ultrarapido para Python (reemplaza flake8 + isort + black).
```bash
pip install ruff
ruff check .    # Lint
ruff format .   # Format
```

**Configuracion en `pyproject.toml`**:
```toml
[tool.ruff]
target-version = "py311"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "W", "I", "UP", "B"]
```

## mypy
**Uso**: Type checking estatico.
```bash
pip install mypy
mypy .
```

## pre-commit
**Uso**: Hooks de Git para correr linters antes de cada commit.
```bash
pip install pre-commit
pre-commit install
```

---

# 11. Containerizacion y DevOps

## Docker + Docker Compose
**Uso**: Containerizacion de todos los microservicios.
```bash
docker compose up       # Levantar todo
docker compose down     # Bajar todo
docker compose logs -f  # Ver logs
```

## Dockerfile Template
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

# 12. Utilidades y Procesamiento

## PyPDF2 / pypdf
**Uso**: Extraccion de texto de PDFs para la Biblioteca Tactica.
```bash
pip install pypdf
```

## tiktoken
**Uso**: Conteo de tokens para gestionar la ventana de contexto del LLM.
```bash
pip install tiktoken
```

## python-dotenv
**Uso**: Carga de variables de entorno desde `.env` en desarrollo.
```bash
pip install python-dotenv
```

## structlog / loguru
**Uso**: Logging estructurado con contexto (request_id, nodo del grafo, servicio).
```bash
pip install structlog  # O: pip install loguru
```

## uuid (stdlib)
**Uso**: Generacion de IDs unicos para consultas y documentos.
```python
from uuid import uuid4
consulta_id = str(uuid4())
```

---

# 13. Resumen de Dependencias

## Core (obligatorias)

```
# requirements.txt — Core
langchain>=0.3.0
langchain-core>=0.3.0
langchain-community>=0.3.0
langchain-ollama>=0.2.0
langgraph>=0.2.0
langchain-chroma>=0.2.0
chromadb>=0.5.0
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
pydantic>=2.9.0
pydantic-settings>=2.5.0
httpx>=0.27.0
redis>=5.0.0
streamlit>=1.39.0
pypdf>=4.0.0
structlog>=24.0.0
python-dotenv>=1.0.0
```

## Testing y Dev

```
# requirements-dev.txt
pytest>=8.0.0
pytest-asyncio>=0.24.0
pytest-cov>=5.0.0
pytest-mock>=3.14.0
respx>=0.21.0
ruff>=0.7.0
mypy>=1.12.0
pre-commit>=3.8.0
```

## Docker Images

```
python:3.11-slim        # Base para microservicios
ollama/ollama:latest     # Servidor LLM
chromadb/chroma:latest   # Base de datos vectorial
redis:7-alpine           # Cache
```
