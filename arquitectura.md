# Arquitectura de Software — FutBot

> Version: 1.0.0
> Fecha: 2026-02-22
> Estado: Propuesta para revision
> Documentos de referencia: proyecto.md, especificacion.md

---

## Indice

1. [Vision Arquitectonica](#1-vision-arquitectonica)
2. [Estilo Arquitectonico](#2-estilo-arquitectonico)
3. [Vista de Contexto](#3-vista-de-contexto)
4. [Vista de Contenedores](#4-vista-de-contenedores)
5. [Vista de Componentes](#5-vista-de-componentes)
6. [Vista de Codigo](#6-vista-de-codigo)
7. [Flujos de Datos](#7-flujos-de-datos)
8. [Patrones de Diseño Aplicados](#8-patrones-de-diseño-aplicados)
9. [Modelo de Datos](#9-modelo-de-datos)
10. [Decisiones Arquitectonicas](#10-decisiones-arquitectonicas)
11. [Infraestructura y Despliegue](#11-infraestructura-y-despliegue)
12. [Seguridad](#12-seguridad)
13. [Observabilidad](#13-observabilidad)
14. [Escalabilidad y Evolucion](#14-escalabilidad-y-evolucion)

---

# 1. Vision Arquitectonica

La arquitectura de FutBot responde a un conjunto de fuerzas que moldean cada decision estructural. En primer lugar, la autonomia del agente impone que el sistema sea capaz de decidir por si mismo que herramientas usar, en que orden, y cuando ya tiene suficiente informacion para responder, sin intervencion humana en el flujo de razonamiento. En segundo lugar, la ejecucion local exige que el modelo de lenguaje y la base de datos vectorial corran integramente en la maquina del usuario, sin dependencia de APIs de nube para la inferencia, garantizando privacidad y eliminando costos recurrentes. En tercer lugar, la precision tactica requiere que las respuestas esten fundamentadas en dos fuentes verificables: datos reales de planteles (APIs externas) y teoria tactica especializada (documentos vectorizados), evitando alucinaciones y generalidades.

Estas tres fuerzas convergen en una arquitectura de microservicios orientada a agentes, donde cada pilar del sistema opera como un servicio independiente, orquestado por un grafo de decisiones central (LangGraph) que implementa el patron de agente autonomo con herramientas. Python, como lenguaje con el ecosistema mas maduro en IA y procesamiento de lenguaje natural, es ideal para esta arquitectura: ofrece integracion nativa con LangChain y LangGraph, compatibilidad directa con Ollama y ChromaDB, y un ecosistema de scraping y APIs de datos deportivos extenso.

---

# 2. Estilo Arquitectonico

El sistema adopta una combinacion de tres estilos arquitectonicos complementarios.

## 2.1 Arquitectura de Microservicios (Service-Oriented)

La estructura horizontal del sistema se organiza como un conjunto de microservicios independientes, cada uno con su propia responsabilidad, runtime y puerto. Los microservicios se comunican exclusivamente via HTTP REST interno.

```
+================================================================+
|                    CAPA DE PRESENTACION                         |
|  Streamlit Frontend (UI Conversacional + Visualizaciones)      |
|  Protocolo: HTTP (sesion de Streamlit)                         |
+================================================================+
                              |
                     HTTP REST (JSON)
                              |
+================================================================+
|                    CAPA DE GATEWAY (API)                        |
|  FastAPI: Endpoints REST (routers)                             |
|  Responsabilidad: Validacion de entrada (Pydantic v2),         |
|  ruteo de consultas, gestion de sesiones, rate limiting        |
+================================================================+
                              |
                    invocacion interna
                              |
+================================================================+
|                    CAPA DE ORQUESTACION (Core)                  |
|  LangGraph: Grafo de Decision del Agente                       |
|  - Clasificador de Consulta                                    |
|  - Recolector de Datos (invoca Ojeador)                        |
|  - Buscador Tactico (invoca RAG Service)                       |
|  - Razonador (invoca LLM Service)                              |
|  - Validador de Coherencia                                     |
+================================================================+
                              |
              invocacion de herramientas (tools)
                              |
+================================================================+
|                    CAPA DE SERVICIOS ESPECIALIZADOS             |
|  Adaptadores a servicios externos e internos:                  |
|  - Ollama (LLM inference local, HTTP REST)                     |
|  - ChromaDB (vectorstore, HTTP REST)                           |
|  - Data Service / Ojeador (APIs futbolisticas, FastAPI)        |
|  - Cache Layer (Redis, cache de datos deportivos)              |
+================================================================+
```

Cada microservicio solo conoce su propia responsabilidad. El Orchestrator es el unico servicio que invoca a los demas; no hay comunicacion directa entre servicios especializados.

## 2.2 Agente Autonomo (Agentic Architecture)

Las operaciones de razonamiento siguen el patron de Agente Autonomo con Herramientas: el LLM recibe un contexto enriquecido y puede decidir que herramientas invocar, en que orden, y cuantas veces iterar antes de producir una respuesta final. LangGraph implementa este patron como un grafo de estados con ciclos condicionales.

## 2.3 RAG (Retrieval-Augmented Generation)

La interaccion con la Biblioteca Tactica sigue el patron RAG: en lugar de depender exclusivamente del conocimiento interno del LLM, el sistema busca fragmentos relevantes en una base de datos vectorial y los inyecta como contexto antes de generar la respuesta. Esto combina la capacidad generativa del LLM con la precision del conocimiento curado.

## 2.4 Combinacion Resultante

La arquitectura resultante es un hibrido que utiliza microservicios para la estructura de despliegue, agente autonomo para el flujo de razonamiento, y RAG para la gestion del conocimiento tactico. Los microservicios gobiernan la independencia y escalabilidad de cada pilar; el patron de agente gobierna como el sistema decide que hacer en cada paso; el RAG gobierna como se inyecta conocimiento especializado en las respuestas.

---

# 3. Vista de Contexto

La vista de contexto muestra el sistema como una caja negra y las entidades externas con las que interactua.

```
                   +-------------------+
                   |  Director Tecnico |
                   |  (Usuario         |
                   |   principal)      |
                   +--------+----------+
                            |
                   Formular preguntas tacticas,
                   recibir analisis fundamentados
                            |
                   +--------v----------+
                   |                   |
                   |     FutBot        |
                   |     Platform      |
                   |  (AI Agent)       |
                   +---+-------+---+---+
                       |       |   |
          +------------+   +---+   +------------+
          |                |                    |
+---------v----+   +-------v------+   +---------v--------+
| Analista     |   | Preparador   |   | API-Football     |
| Tactico      |   | Fisico       |   | (Datos en tiempo |
| (consultas   |   | (consulta    |   |  real: planteles,|
| de sistemas) |   |  fitness)    |   |  lesiones, stats)|
+--------------+   +--------------+   +------------------+

                   +-------------------+
                   |  Biblioteca       |
                   |  Tactica          |
                   |  (PDFs, libros,   |
                   |   manuales)       |
                   +-------------------+
```

**Actores:**

- **Director Tecnico**: Usuario principal. Formula preguntas sobre formaciones, sistemas de juego, matchups tacticos y recibe analisis detallados con fundamento teorico y datos reales.
- **Analista Tactico**: Miembro del cuerpo tecnico que consulta sobre sistemas de juego, roles especificos, transiciones y estrategias sin necesidad de datos en tiempo real.
- **Preparador Fisico**: Consulta disponibilidad de jugadores y cruza con requerimientos fisicos de roles tacticos.
- **API-Football**: Servicio externo que provee datos de planteles, lesiones, estadisticas y fixtures en tiempo real.
- **Biblioteca Tactica**: Fuente de conocimiento especializado ingresada por el usuario (PDFs, libros, manuales de tactica).

---

# 4. Vista de Contenedores

La vista de contenedores descompone el sistema en sus unidades desplegables independientes y los protocolos de comunicacion entre ellas.

```
+------------------------------------------------------------------+
|                     ENTORNO DE DESPLIEGUE                        |
|                                                                  |
|  +-----------------------+     +-----------------------------+   |
|  | Streamlit Frontend    |     | Gateway API (FastAPI)       |   |
|  | (UI Conversacional)   |     |                             |   |
|  |                       |     | - POST /v1/consulta         |   |
|  | - Chat interface      | HTTP| - POST /v1/biblioteca/      |   |
|  | - Reasoning display   +----->   ingestar                  |   |
|  | - History             | JSON| - GET /v1/health            |   |
|  | - Config panel        <-----+ - GET /v1/modelos           |   |
|  +-----------------------+     +------+------+---------------+   |
|                                       |      |                   |
|                              +--------+  +---+--------+         |
|                              |           |             |         |
|                  +-----------v-+  +------v------+      |         |
|                  | Orchestrator|  | RAG Service  |     |         |
|                  | (LangGraph) |  | (ChromaDB +  |     |         |
|                  | Grafo de    |  |  LangChain)  |     |         |
|                  | decision    |  | Busqueda     |     |         |
|                  | del agente  |  | semantica    |     |         |
|                  +------+------+  +------+-------+     |         |
|                         |                |             |         |
|                  +------v------+  +------v-------+     |         |
|                  | Data Service|  | Ollama        |     |         |
|                  | (Ojeador)   |  | (LLM Server)  |     |         |
|                  | FastAPI +   |  | Llama3/Mistral|     |         |
|                  | httpx       |  | GPU inference |     |         |
|                  +------+------+  +--------------+     |         |
|                         |                              |         |
|                  +------v------+               +-------v------+  |
|                  | Redis       |               | ChromaDB     |  |
|                  | Cache de    |               | Vectorstore  |  |
|                  | datos       |               | persistente  |  |
|                  | deportivos  |               |              |  |
|                  +-------------+               +--------------+  |
|                         |                                        |
|                  +------v-----------+                            |
|                  | API-Football     |                            |
|                  | (externo)        |                            |
|                  +------------------+                            |
|                                                                  |
+------------------------------------------------------------------+
```

**Contenedores y responsabilidades:**

| Contenedor | Tecnologia | Responsabilidad | Puerto |
|------------|-----------|-----------------|--------|
| Frontend | Streamlit >= 1.30 | Interfaz conversacional, display de razonamiento, configuracion, historial | 8501 |
| Gateway API | FastAPI + Uvicorn | Punto de entrada REST, validacion Pydantic, ruteo, rate limiting, gestion de sesiones | 8000 |
| Orchestrator | LangGraph + LangChain | Grafo de estados del agente, decision de herramientas, ciclos de razonamiento | 8001 (interno) |
| RAG Service | ChromaDB + LangChain | Ingesta de documentos, chunking, embedding, busqueda semantica | 8002 (interno) |
| Data Service (Ojeador) | FastAPI + httpx | Conexion con APIs deportivas, cache, transformacion de datos | 8003 (interno) |
| LLM Service | Ollama | Inferencia local del modelo de lenguaje, gestion de modelos, streaming de tokens | 11434 |
| ChromaDB | ChromaDB Server | Base de datos vectorial persistente para la Biblioteca Tactica | 8100 |
| Redis | Redis >= 7.0 | Cache de datos deportivos con TTL, cache de embeddings frecuentes | 6379 |
| API-Football | Servicio externo | Datos de planteles, lesiones, estadisticas, fixtures en tiempo real | N/A |

**Protocolos de comunicacion:**

| Origen | Destino | Protocolo | Formato |
|--------|---------|-----------|---------|
| Frontend | Gateway API | HTTP REST | JSON |
| Gateway API | Orchestrator | HTTP REST interno | JSON |
| Orchestrator | RAG Service | HTTP REST interno | JSON |
| Orchestrator | Data Service | HTTP REST interno | JSON |
| Orchestrator | LLM Service (Ollama) | HTTP REST (Ollama API) | JSON + SSE (streaming) |
| Data Service | API-Football | HTTPS REST | JSON |
| Data Service | Redis | TCP (redis protocol) | Comandos Redis |
| RAG Service | ChromaDB | HTTP REST | JSON |

---

# 5. Vista de Componentes

La vista de componentes descompone los contenedores principales en sus modulos internos.

```
+------------------------------------------------------------------+
|                    Gateway API (FastAPI)                           |
|                                                                  |
|  +------------------------------------------------------------+  |
|  |                    CAPA ROUTER (HTTP)                       |  |
|  |                                                             |  |
|  |  +--------------+  +------------------+  +---------------+ |  |
|  |  | consulta.py  |  | biblioteca.py    |  | sistema.py    | |  |
|  |  | POST /v1/    |  | POST /v1/        |  | GET /v1/      | |  |
|  |  | consulta     |  | biblioteca/      |  | health        | |  |
|  |  |              |  | ingestar         |  | GET /v1/      | |  |
|  |  |              |  | DELETE /v1/      |  | modelos       | |  |
|  |  |              |  | biblioteca/{id}  |  |               | |  |
|  |  +--------------+  +------------------+  +---------------+ |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +------------------------------------------------------------+  |
|  |                    CAPA SCHEMAS (Pydantic)                  |  |
|  |                                                             |  |
|  |  +--------------+  +------------------+  +---------------+ |  |
|  |  | consulta_    |  | biblioteca_      |  | sistema_      | |  |
|  |  | schema.py    |  | schema.py        |  | schema.py     | |  |
|  |  +--------------+  +------------------+  +---------------+ |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+

+------------------------------------------------------------------+
|                    Orchestrator (LangGraph)                        |
|                                                                  |
|  +------------------------------------------------------------+  |
|  |                    GRAFO DE ESTADOS                          |  |
|  |                                                             |  |
|  |  +------------------+  +-------------------+               |  |
|  |  | clasificador.py  |  | recolector.py     |               |  |
|  |  | Clasifica tipo   |  | Invoca Ojeador    |               |  |
|  |  | de consulta      |  | para datos reales |               |  |
|  |  +------------------+  +-------------------+               |  |
|  |  +------------------+  +-------------------+               |  |
|  |  | buscador_rag.py  |  | razonador.py      |               |  |
|  |  | Invoca busqueda  |  | Invoca LLM con    |               |  |
|  |  | en Biblioteca    |  | contexto completo |               |  |
|  |  +------------------+  +-------------------+               |  |
|  |  +------------------+                                      |  |
|  |  | validador.py     |                                      |  |
|  |  | Verifica         |                                      |  |
|  |  | coherencia       |                                      |  |
|  |  +------------------+                                      |  |
|  +------------------------------------------------------------+  |
|  |                                                             |  |
|  |  +------------------+  +-------------------+               |  |
|  |  | graph_builder.py |  | state.py          |               |  |
|  |  | Define nodos,    |  | Estado compartido |               |  |
|  |  | edges, ciclos    |  | del grafo         |               |  |
|  |  +------------------+  +-------------------+               |  |
|  |  +------------------+  +-------------------+               |  |
|  |  | tools.py         |  | prompts.py        |               |  |
|  |  | Herramientas     |  | Templates de      |               |  |
|  |  | LangChain        |  | prompts           |               |  |
|  |  +------------------+  +-------------------+               |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+

+------------------------------------------------------------------+
|                    Data Service / Ojeador (FastAPI)                |
|                                                                  |
|  +------------------------------------------------------------+  |
|  |                    ROUTERS                                  |  |
|  |                                                             |  |
|  |  +------------------+  +-------------------+               |  |
|  |  | equipos.py       |  | jugadores.py      |               |  |
|  |  | GET /equipos/    |  | GET /jugadores/   |               |  |
|  |  | {nombre}/plantel |  | {id}/stats        |               |  |
|  |  +------------------+  +-------------------+               |  |
|  |  +------------------+  +-------------------+               |  |
|  |  | fixtures.py      |  | health.py         |               |  |
|  |  | GET /equipos/    |  | GET /health       |               |  |
|  |  | {nombre}/fixture |  |                   |               |  |
|  |  +------------------+  +-------------------+               |  |
|  +------------------------------------------------------------+  |
|  |                                                             |  |
|  |  +------------------+  +-------------------+               |  |
|  |  | api_client.py    |  | cache.py          |               |  |
|  |  | httpx client →   |  | Redis cache con   |               |  |
|  |  | API-Football     |  | TTL configurable  |               |  |
|  |  +------------------+  +-------------------+               |  |
|  |  +------------------+                                      |  |
|  |  | transformers.py  |                                      |  |
|  |  | Mapeo API → DTOs |                                      |  |
|  |  +------------------+                                      |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+

+------------------------------------------------------------------+
|                    RAG Service (ChromaDB + LangChain)              |
|                                                                  |
|  +------------------------------------------------------------+  |
|  |                    ROUTERS                                  |  |
|  |                                                             |  |
|  |  +------------------+  +-------------------+               |  |
|  |  | ingesta.py       |  | busqueda.py       |               |  |
|  |  | POST /ingestar   |  | POST /buscar      |               |  |
|  |  | Procesa PDFs +   |  | Busqueda          |               |  |
|  |  | genera embeddings|  | semantica         |               |  |
|  |  +------------------+  +-------------------+               |  |
|  +------------------------------------------------------------+  |
|  |                                                             |  |
|  |  +------------------+  +-------------------+               |  |
|  |  | chunker.py       |  | embedder.py       |               |  |
|  |  | Division         |  | Genera embeddings |               |  |
|  |  | semantica de     |  | con modelo local  |               |  |
|  |  | documentos       |  | o SentenceTransf  |               |  |
|  |  +------------------+  +-------------------+               |  |
|  |  +------------------+                                      |  |
|  |  | vectorstore.py   |                                      |  |
|  |  | ChromaDB client  |                                      |  |
|  |  | CRUD colecciones |                                      |  |
|  |  +------------------+                                      |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

### Inventario de Componentes

| Componente | Servicio | Responsabilidad | Dependencias Internas |
|------------|----------|-----------------|----------------------|
| `main.py` | Gateway | Entry point, inicializa FastAPI, registra routers, CORS | Todos los routers |
| `config.py` | Gateway | Variables de entorno via pydantic-settings | Ninguna |
| `consulta.py` | Gateway Router | Endpoint POST /v1/consulta, delega al Orchestrator | Orchestrator client |
| `biblioteca.py` | Gateway Router | Endpoints de ingesta y gestion de documentos tacticos | RAG Service client |
| `sistema.py` | Gateway Router | Health check, listado de modelos disponibles, configuracion | Ollama client |
| `graph_builder.py` | Orchestrator | Define el grafo LangGraph: nodos, edges, condiciones | Todos los nodos |
| `state.py` | Orchestrator | Define el TypedDict del estado compartido del grafo | Ninguna |
| `clasificador.py` | Orchestrator Nodo | Clasifica la consulta del usuario por tipo | LLM Service |
| `recolector.py` | Orchestrator Nodo | Invoca herramientas del Ojeador para datos reales | Data Service client |
| `buscador_rag.py` | Orchestrator Nodo | Realiza busqueda semantica en la Biblioteca Tactica | RAG Service client |
| `razonador.py` | Orchestrator Nodo | Genera el analisis final combinando datos + teoria | LLM Service |
| `validador.py` | Orchestrator Nodo | Verifica coherencia: jugadores existen, posiciones validas | State |
| `tools.py` | Orchestrator | Define herramientas LangChain (obtener_plantel, buscar_tactica, etc.) | Clients externos |
| `prompts.py` | Orchestrator | Templates de prompts para cada nodo del grafo | Ninguna |
| `api_client.py` | Data Service | Cliente httpx para API-Football con retry y backoff | config |
| `cache.py` | Data Service | Cache Redis con TTL configurable por tipo de dato | Redis client |
| `transformers.py` | Data Service | Mapeo de respuestas crudas de API → DTOs internos | Schemas |
| `chunker.py` | RAG Service | Division semantica de PDFs en chunks (por seccion/tema) | Ninguna |
| `embedder.py` | RAG Service | Genera embeddings con modelo local (Ollama) o SentenceTransformers | LLM Service |
| `vectorstore.py` | RAG Service | Cliente ChromaDB: CRUD de colecciones y documentos | ChromaDB |

---

# 6. Vista de Codigo

## 6.1 Estado del Grafo (LangGraph)

```python
# orchestrator/state.py
from typing import TypedDict, Annotated
from operator import add

class AgentState(TypedDict):
    """Estado compartido entre todos los nodos del grafo."""
    consulta_usuario: str
    tipo_consulta: str  # "propuesta_tactica", "analisis_rival", "comparacion", "general"
    equipos_detectados: list[str]
    
    # Datos del Ojeador
    datos_planteles: dict  # {equipo: [jugadores]}
    datos_lesionados: dict  # {equipo: [jugadores]}
    datos_estadisticas: dict
    datos_fixture: dict
    
    # Contexto de la Biblioteca
    fragmentos_tacticos: Annotated[list[str], add]  # Se acumulan con cada busqueda
    
    # Razonamiento
    contexto_enriquecido: str  # Datos + teoria listos para el LLM
    respuesta_generada: str
    
    # Control de flujo
    necesita_datos: bool
    necesita_teoria: bool
    validacion_ok: bool
    iteraciones: int
    max_iteraciones: int  # Default: 3
    errores: list[str]
```

## 6.2 Definicion del Grafo (LangGraph)

```python
# orchestrator/graph_builder.py
from langgraph.graph import StateGraph, END
from .state import AgentState
from .clasificador import clasificar_consulta
from .recolector import recolectar_datos
from .buscador_rag import buscar_tactica
from .razonador import generar_analisis
from .validador import validar_respuesta

def construir_grafo() -> StateGraph:
    grafo = StateGraph(AgentState)
    
    # Definir nodos
    grafo.add_node("clasificar", clasificar_consulta)
    grafo.add_node("recolectar_datos", recolectar_datos)
    grafo.add_node("buscar_tactica", buscar_tactica)
    grafo.add_node("razonar", generar_analisis)
    grafo.add_node("validar", validar_respuesta)
    
    # Definir edges
    grafo.set_entry_point("clasificar")
    
    # Despues de clasificar, decidir si necesita datos, teoria o ambos
    grafo.add_conditional_edges(
        "clasificar",
        decidir_siguiente_paso,
        {
            "recolectar": "recolectar_datos",
            "buscar": "buscar_tactica",
            "razonar_directo": "razonar",
        }
    )
    
    # Despues de recolectar datos, buscar teoria
    grafo.add_edge("recolectar_datos", "buscar_tactica")
    
    # Despues de buscar teoria, razonar
    grafo.add_edge("buscar_tactica", "razonar")
    
    # Despues de razonar, validar
    grafo.add_edge("razonar", "validar")
    
    # Despues de validar, terminar o re-iterar
    grafo.add_conditional_edges(
        "validar",
        decidir_si_reiterar,
        {
            "finalizar": END,
            "re_recolectar": "recolectar_datos",
        }
    )
    
    return grafo.compile()


def decidir_siguiente_paso(state: AgentState) -> str:
    if state["necesita_datos"]:
        return "recolectar"
    elif state["necesita_teoria"]:
        return "buscar"
    else:
        return "razonar_directo"


def decidir_si_reiterar(state: AgentState) -> str:
    if state["validacion_ok"] or state["iteraciones"] >= state["max_iteraciones"]:
        return "finalizar"
    return "re_recolectar"
```

## 6.3 Nodo Clasificador

```python
# orchestrator/clasificador.py
from langchain_ollama import ChatOllama
from .state import AgentState
from .prompts import PROMPT_CLASIFICADOR

async def clasificar_consulta(state: AgentState) -> dict:
    llm = ChatOllama(model="llama3", temperature=0)
    
    respuesta = await llm.ainvoke(
        PROMPT_CLASIFICADOR.format(consulta=state["consulta_usuario"])
    )
    
    # Parsear la clasificacion
    clasificacion = parsear_clasificacion(respuesta.content)
    
    return {
        "tipo_consulta": clasificacion["tipo"],
        "equipos_detectados": clasificacion["equipos"],
        "necesita_datos": clasificacion["requiere_datos_reales"],
        "necesita_teoria": clasificacion["requiere_teoria_tactica"],
        "iteraciones": 0,
        "max_iteraciones": 3,
    }
```

## 6.4 Herramienta del Ojeador (LangChain Tool)

```python
# orchestrator/tools.py
from langchain_core.tools import tool
import httpx

DATA_SERVICE_URL = "http://data-service:8003"

@tool
async def obtener_plantel(equipo: str) -> dict:
    """Obtiene el plantel actual de un equipo con estado fisico de cada jugador."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{DATA_SERVICE_URL}/equipos/{equipo}/plantel",
            timeout=30.0
        )
        response.raise_for_status()
        return response.json()

@tool
async def buscar_tactica(consulta: str) -> list[str]:
    """Busca fragmentos relevantes en la Biblioteca Tactica."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://rag-service:8002/buscar",
            json={"query": consulta, "top_k": 5},
            timeout=15.0
        )
        response.raise_for_status()
        return response.json()["fragmentos"]
```

---

# 7. Flujos de Datos

## 7.1 Flujo Principal: Consulta Tactica Completa

```
Usuario
     |
     | POST /v1/consulta
     | { texto: "River juega contra Platense... 5-4-1... como formo?" }
     v
+-----------+     +--------------------+
| Gateway   |     | Orchestrator:      |
| API       | --> | graph_builder.py   |
| Valida    |     | Inicia grafo       |
+-----------+     +--------+-----------+
                           |
              1. Nodo: Clasificar
                           |
                   tipo = "propuesta_tactica"
                   equipos = ["River Plate"]
                   necesita_datos = true
                   necesita_teoria = true
                           |
              2. Nodo: Recolectar Datos
                           |
                  +--------v----------+
                  | Data Service      |
                  | (Ojeador)         |
                  | GET /equipos/     |
                  | river/plantel     |
                  +--------+----------+
                           |
                  Plantel: 28 jugadores
                  Lesionados: 2
                  Suspendidos: 1
                           |
              3. Nodo: Buscar Tactica
                           |
                  +--------v----------+
                  | RAG Service       |
                  | POST /buscar      |
                  | "romper 5-4-1     |
                  |  bloque bajo"     |
                  +--------+----------+
                           |
                  5 fragmentos relevantes:
                  - "Mezzalas agresivas..."
                  - "Superioridad posicional..."
                  - "Laterales al ataque..."
                           |
              4. Nodo: Razonar
                           |
                  +--------v----------+
                  | LLM Service       |
                  | (Ollama)          |
                  | Prompt: datos +   |
                  | teoria + pregunta |
                  +--------+----------+
                           |
                  Analisis generado:
                  "Recomiendo 4-2-3-1 con
                   X como mezzala derecha..."
                           |
              5. Nodo: Validar
                           |
              Jugadores existen? SI
              Posiciones validas? SI
              validacion_ok = true
                           |
                  +--------v----------+
                  | Response 200      |
                  | { analisis: "..." }|
                  +-------------------+
```

## 7.2 Flujo de Ingesta de Documentos Tacticos

```
Administrador
     |
     | POST /v1/biblioteca/ingestar
     | multipart/form-data: file = "tactica_guardiola.pdf"
     v
+-----------+     +--------------------+
| Gateway   |     | RAG Service:       |
| API       | --> | ingesta.py         |
| Valida    |     |                    |
| archivo   |     | 1. Extraer texto   |
+-----------+     |    (PyPDF2)        |
                  | 2. Chunking        |
                  |    semantico       |
                  | 3. Generar         |
                  |    embeddings      |
                  |    (Ollama)        |
                  | 4. Almacenar en    |
                  |    ChromaDB        |
                  +--------+-----------+
                           |
                  Response 200:
                  { documento_id: "...",
                    chunks_generados: 42,
                    status: "indexado" }
```

## 7.3 Flujo de Re-iteracion (Validacion Fallida)

```
              Nodo: Validar
                   |
          validacion_ok = false
          error: "Jugador X esta lesionado"
          iteraciones < max_iteraciones
                   |
          Regresa al nodo: Recolectar Datos
                   |
          Re-obtiene plantel actualizado
                   |
          Nodo: Buscar Tactica (mismas queries)
                   |
          Nodo: Razonar (con datos corregidos)
                   |
          Nodo: Validar (segunda iteracion)
                   |
          validacion_ok = true → END
```

---

# 8. Patrones de Diseño Aplicados

## 8.1 Agent Pattern (LangGraph)

El sistema implementa el patron de Agente Autonomo con Herramientas: el LLM tiene acceso a un conjunto de herramientas (tools) y puede decidir cual usar en cada paso. LangGraph extiende este patron con un grafo de estados que permite ciclos condicionales, evitando los loops infinitos mediante un contador de iteraciones maximo.

## 8.2 RAG Pattern (Retrieval-Augmented Generation)

La Biblioteca Tactica implementa RAG: documentos se preprocesan en chunks, se vectorizan y se almacenan en ChromaDB. En tiempo de consulta, se realiza busqueda semantica por similaridad coseno y los fragmentos mas relevantes se inyectan como contexto del LLM. Esto combina la capacidad generativa del modelo con precision de conocimiento curado.

## 8.3 Tool Use Pattern

Las herramientas del Ojeador se definen como `@tool` de LangChain, con descripcion en docstring que el LLM usa para decidir cuando invocarlas. Cada herramienta es una funcion async que encapsula la comunicacion HTTP con el servicio correspondiente.

## 8.4 Sidecar Pattern (Data Service)

El Ojeador opera como un sidecar del Orchestrator: encapsula toda la complejidad de conexion con APIs externas (autenticacion, paginacion, rate limiting, cache) y expone una interfaz limpia al grafo de decisiones. Si se cambia de API-Football a Opta, solo se modifica el Data Service.

## 8.5 Cache-Aside Pattern (Redis)

El Data Service implementa cache-aside: primero consulta Redis por datos cacheados; si hay cache hit, retorna inmediatamente. Si hay cache miss, consulta la API externa, almacena en Redis con TTL configurable (ej: planteles = 6 horas, lesiones = 1 hora, fixture = 24 horas) y retorna.

## 8.6 Dependency Injection (FastAPI)

FastAPI utiliza inyeccion de dependencias nativa para proveer clientes de servicios, conexiones Redis y configuracion a los routers. Esto facilita testing con mocks y sustitucion de implementaciones.

---

# 9. Modelo de Datos

## 9.1 Colecciones de ChromaDB

| Coleccion | Contenido | Metadata |
|-----------|-----------|----------|
| `biblioteca_tactica` | Chunks de documentos tacticos (PDFs, libros, articulos) | fuente, categoria, pagina, tema, fecha_ingesta |
| `historial_consultas` | Embeddings de consultas pasadas para sugerencias | tipo, equipos, fecha, rating_usuario |

## 9.2 Esquema Redis (Cache)

| Key Pattern | TTL | Contenido |
|-------------|-----|-----------|
| `plantel:{equipo_id}` | 6 horas | JSON con lista de jugadores |
| `lesionados:{equipo_id}` | 1 hora | JSON con jugadores lesionados/suspendidos |
| `fixture:{equipo_id}` | 24 horas | JSON con proximos partidos |
| `stats:{jugador_id}` | 12 horas | JSON con estadisticas del jugador |
| `forma:{equipo_id}` | 6 horas | JSON con resultados recientes |

---

# 10. Decisiones Arquitectonicas

## ADR-001: Python como lenguaje unico del sistema

**Contexto**: El sistema requiere integracion con LLMs locales, bases de datos vectoriales, frameworks de agentes autonomos y APIs de datos deportivos.

**Decision**: Usar Python >= 3.11 como lenguaje unico para todos los microservicios.

**Justificacion**: Python domina el ecosistema de IA: LangChain, LangGraph, Ollama Python SDK, ChromaDB, sentence-transformers y la mayoria de herramientas de NLP son Python-first. Usar otro lenguaje agregaria complejidad de integracion sin beneficio real, ya que el cuello de botella de rendimiento es la inferencia del LLM (GPU-bound), no el lenguaje de la aplicacion.

**Consecuencias**: El sistema es mas lento que una implementacion en Go o Rust para operaciones CPU-bound, pero esto es irrelevante dado que la latencia dominante es la generacion de tokens del LLM (segundos).

## ADR-002: LangGraph como orquestador del agente

**Contexto**: Se necesita un framework que permita al agente tomar decisiones de ruteo autonomamente, con ciclos condicionales.

**Decision**: Usar LangGraph (extension de LangChain) como framework de orquestacion.

**Justificacion**: A diferencia de los chains lineales de LangChain (secuencia fija A→B→C), LangGraph permite grafos dirigidos con ciclos: el agente puede decidir volver a buscar datos si la validacion falla, lo cual es esencial para un sistema que debe iterar hasta producir una respuesta coherente. Alternativas como CrewAI o AutoGen son mas opinados y menos flexibles en la definicion del flujo.

**Consecuencias**: Mayor complejidad en la definicion del grafo, pero mayor control sobre el flujo de razonamiento.

## ADR-003: Ollama como servidor de inferencia local

**Contexto**: El sistema debe ejecutar LLMs localmente sin depender de APIs de nube.

**Decision**: Usar Ollama como servidor de inferencia.

**Justificacion**: Ollama simplifica la gestion de modelos locales: descarga, instalacion, cuantizacion y serving con un solo comando. Soporta todos los modelos relevantes (Llama 3, Mistral, Qwen, DeepSeek). Expone una API REST compatible con OpenAI format, lo que facilita la integracion con LangChain. Alternativas como vLLM o llama.cpp ofrecen mayor rendimiento pero menos ergonomia.

**Consecuencias**: Dependencia de Ollama como runtime. Si Ollama deja de mantenerse, se puede migrar a vLLM o llama.cpp con cambios minimos en la capa de integracion.

## ADR-004: ChromaDB como base de datos vectorial

**Contexto**: Se necesita una base de datos vectorial para almacenar y buscar documentos tacticos por similaridad semantica.

**Decision**: Usar ChromaDB como vectorstore principal.

**Justificacion**: ChromaDB es la opcion mas simple y ligera para deployments locales: se ejecuta como un proceso Python sin dependencias externas, soporta persistencia a disco, tiene integracion nativa con LangChain y permite colecciones con metadata filtrable. Para un sistema que corre en la maquina del usuario, la simplicidad de ChromaDB es mas valiosa que el rendimiento superior de Qdrant o Milvus.

**Consecuencias**: Limitado a millones (no miles de millones) de documentos. Para la Biblioteca Tactica de un cuerpo tecnico, esto es mas que suficiente.

## ADR-005: FastAPI para microservicios internos

**Contexto**: Se necesita un framework HTTP para exponer los microservicios internos.

**Decision**: Usar FastAPI para todos los microservicios.

**Justificacion**: FastAPI ofrece validacion automatica con Pydantic, documentacion OpenAPI generada, soporte async nativo y es el framework mas popular del ecosistema Python para APIs. La uniformidad de stack simplifica el mantenimiento.

## ADR-006: Redis como cache de datos deportivos

**Contexto**: Los datos de APIs externas (planteles, lesiones) no cambian frecuentemente y las APIs tienen rate limits.

**Decision**: Usar Redis como cache con TTL configurable.

**Justificacion**: Redis es el estandar de la industria para cache. TTL configurable por tipo de dato (planteles cada 6h, lesiones cada 1h) balancea frescura de datos con eficiencia de API calls.

---

# 11. Infraestructura y Despliegue

## 11.1 Docker Compose Desarrollo

```yaml
# docker-compose.yml
services:
  gateway:
    build: ./gateway
    ports:
      - "8000:8000"
    depends_on: [orchestrator, rag-service, data-service]
    env_file: .env
    volumes:
      - ./gateway:/app
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  orchestrator:
    build: ./orchestrator
    expose:
      - "8001"
    depends_on: [ollama, rag-service, data-service]
    env_file: .env
    volumes:
      - ./orchestrator:/app

  rag-service:
    build: ./rag-service
    expose:
      - "8002"
    depends_on: [chromadb, ollama]
    env_file: .env
    volumes:
      - ./rag-service:/app
      - biblioteca_data:/data/biblioteca

  data-service:
    build: ./data-service
    expose:
      - "8003"
    depends_on: [redis]
    env_file: .env
    volumes:
      - ./data-service:/app

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_models:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8100:8000"
    volumes:
      - chroma_data:/chroma/chroma

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  frontend:
    build: ./frontend
    ports:
      - "8501:8501"
    depends_on: [gateway]
    env_file: .env
    volumes:
      - ./frontend:/app

volumes:
  ollama_models:
  chroma_data:
  biblioteca_data:
```

## 11.2 Dockerfile Microservicio (Ejemplo Gateway)

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 11.3 Variables de Entorno Criticas

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| OLLAMA_BASE_URL | URL del servidor Ollama | http://ollama:11434 |
| OLLAMA_MODEL | Modelo LLM a utilizar | llama3:8b |
| OLLAMA_EMBEDDING_MODEL | Modelo para embeddings | nomic-embed-text |
| CHROMADB_HOST | Host de ChromaDB | chromadb |
| CHROMADB_PORT | Puerto de ChromaDB | 8000 |
| REDIS_URL | Conexion Redis | redis://redis:6379/0 |
| API_FOOTBALL_KEY | API key de API-Football | (secreto) |
| API_FOOTBALL_BASE_URL | URL base de API-Football | https://v3.football.api-sports.io |
| CACHE_TTL_PLANTEL | TTL cache planteles (seg) | 21600 |
| CACHE_TTL_LESIONES | TTL cache lesiones (seg) | 3600 |
| MAX_GRAPH_ITERATIONS | Iteraciones max del grafo | 3 |
| RAG_TOP_K | Fragmentos a retornar en busqueda | 5 |
| RAG_CHUNK_SIZE | Tamaño de chunk para ingesta | 1000 |
| RAG_CHUNK_OVERLAP | Overlap entre chunks | 200 |
| LOG_LEVEL | Nivel de logging | INFO |

---

# 12. Seguridad

## 12.1 API Keys y Secretos

- Las API keys de servicios externos (API-Football) se almacenan exclusivamente como variables de entorno, nunca en codigo.
- El archivo `.env` se incluye en `.gitignore`.
- En produccion, se usan Docker secrets o un gestor de secretos.

## 12.2 Proteccion de Datos

- Los documentos de la Biblioteca Tactica son propiedad del usuario y se almacenan localmente.
- No se envian datos a servicios externos excepto las consultas a API-Football (equipo, jugador).
- Los logs nunca incluyen contenido completo de queries del usuario ni respuestas del LLM.

## 12.3 Validacion de Entrada

- Todos los payloads se validan con Pydantic v2 antes de procesarse.
- Los archivos subidos para ingesta se validan por MIME type (solo PDF, TXT, MD).
- Los nombres de equipos y jugadores se sanitizan antes de usarse en queries.

## 12.4 Rate Limiting

- El Gateway implementa rate limiting (60 requests/minuto por IP) via middleware.
- El Data Service implementa rate limiting hacia API-Football segun los limites del plan contratado.

---

# 13. Observabilidad

## 13.1 Logging

Cada microservicio utiliza logging estructurado con `structlog` o `loguru`. Se registra:

- Inicio y fin de cada consulta con su `request_id` (UUID).
- Nodos del grafo visitados y decisiones de ruteo.
- Llamadas a servicios externos (API-Football) con latencia.
- Ingesta de documentos con cantidad de chunks generados.
- Errores con contexto completo (sin datos sensibles).

## 13.2 Health Checks

```
Gateway:      GET /v1/health -> { "ok": true, "services": { "orchestrator": "up", "rag": "up", "data": "up", "ollama": "up" } }
Orchestrator: GET /health    -> { "ok": true, "graph": "compiled" }
RAG Service:  GET /health    -> { "ok": true, "chromadb": "connected", "documentos": 142 }
Data Service: GET /health    -> { "ok": true, "redis": "connected", "api_football": "reachable" }
```

## 13.3 Trazabilidad del Grafo

Cada ejecucion del grafo genera un trace con:
- Nodos visitados en orden.
- Tiempo de ejecucion de cada nodo.
- Herramientas invocadas.
- Tokens consumidos por el LLM.
- Resultado de la validacion.

Esto permite debuggear por que el agente tomo ciertas decisiones y optimizar el diseño del grafo.

---

# 14. Escalabilidad y Evolucion

## 14.1 Escalabilidad Inmediata

- **Modelos intercambiables**: Cambiar de Llama 3 8B a 70B (o a Mistral, Qwen) es un cambio de variable de entorno. No se modifica codigo.
- **Biblioteca expandible**: Agregar mas documentos tacticos es simplemente ingestarlos via la API. ChromaDB escala a millones de documentos.
- **Fuentes de datos adicionales**: Agregar nuevas APIs deportivas (Opta, Wyscout) es agregar un nuevo client en el Data Service, sin tocar el Orchestrator.
- **Cache distributable**: Redis puede escalarse a un cluster si se necesita cache compartido entre multiples instancias.

## 14.2 Evoluciones Futuras

- **Video Analysis**: Integracion con modelos de vision (video de partidos) para analisis tactico visual.
- **Multi-idioma**: Soporte para consultas en ingles, portugues y otros idiomas.
- **Analisis estadistico avanzado**: Integracion con xG, xA, modelos predictivos.
- **API publica**: Exponer FutBot como servicio para integracion con apps de terceros.
- **Fine-tuning**: Entrenamiento especializado del LLM con datos tacticos para mejorar la calidad del razonamiento.
- **Cloud deployment**: Migracion opcional a cloud (GPU rental) para equipos sin hardware potente.
- **Prometheus + Grafana**: Metricas de rendimiento del agente, uso de GPU, latencia por nodo del grafo.
