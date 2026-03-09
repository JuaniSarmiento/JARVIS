# Especificacion Formal — FutBot

> Este documento contiene las especificaciones formales de cada Feature del sistema,
> incluyendo criterios de aceptacion (Given/When/Then), contratos API,
> y tareas organizadas por fase.

---

# Feature 01: Consultas Tacticas (Core del Agente)

## Descripcion General

El modulo de consultas tacticas es el corazon del sistema. Permite al usuario formular preguntas en lenguaje natural sobre tactica futbolistica y recibir respuestas fundamentadas que combinan datos reales de planteles con teoria tactica especializada. El agente clasifica la consulta, decide que herramientas usar, recolecta datos, busca teoria y genera un analisis validado.

## Aceptacion

### AC-01.1: Consulta con equipo real
> **Given** que Ollama esta corriendo con un modelo cargado y el Data Service tiene acceso a API-Football
> **When** el usuario envia "¿Como deberia formar River contra Boca el domingo?"
> **Then** el sistema clasifica como "propuesta_tactica", obtiene el plantel de River, busca teoria relevante, y genera una respuesta con jugadores reales en posiciones validas

### AC-01.2: Consulta teorica pura
> **Given** que la Biblioteca Tactica contiene documentos sobre sistemas de juego
> **When** el usuario envia "¿Que diferencia hay entre un 4-3-3 y un 4-2-3-1?"
> **Then** el sistema clasifica como "consulta_teorica", busca en la Biblioteca sin consultar APIs externas, y genera una respuesta fundamentada en los documentos

### AC-01.3: Consulta con jugador lesionado
> **Given** que un jugador del plantel esta lesionado segun la API-Football
> **When** el sistema genera una propuesta de formacion que incluye a ese jugador
> **Then** el validador detecta la inconsistencia, el grafo re-itera y genera una nueva propuesta sin el jugador lesionado

### AC-01.4: Consulta sin datos disponibles
> **Given** que API-Football no esta disponible y no hay cache
> **When** el usuario pregunta por un plantel real
> **Then** el sistema informa que no puede obtener datos actualizados y ofrece responder con teoria tactica general

### AC-01.5: Maximo de iteraciones
> **Given** que el validador detecta inconsistencias en cada iteracion
> **When** se alcanza el maximo de 3 iteraciones
> **Then** el sistema retorna la mejor respuesta generada con un disclaimer sobre posibles inconsistencias

## Contrato API

### POST /v1/consulta

**Request:**
```json
{
  "texto": "River juega contra Platense. Ellos se meten atras con un 5-4-1. ¿Como formo el mediocampo?",
  "opciones": {
    "modelo": "llama3:8b",
    "max_iteraciones": 3,
    "rag_top_k": 5,
    "streaming": true
  }
}
```

**Response 200:**
```json
{
  "id": "UUID",
  "tipo_consulta": "propuesta_tactica",
  "equipos_detectados": ["River Plate"],
  "analisis": "Para enfrentar el 5-4-1 de Platense, recomiendo...",
  "fuentes_tacticas": [
    {
      "documento": "Herr Pep - Guardiola",
      "fragmento": "Contra un bloque bajo con 5 defensores...",
      "relevancia": 0.92
    }
  ],
  "datos_utilizados": {
    "plantel_river": {
      "disponibles": 25,
      "lesionados": 2,
      "suspendidos": 1
    }
  },
  "iteraciones_realizadas": 1,
  "validacion": {
    "jugadores_validos": true,
    "posiciones_validas": true
  },
  "tokens_consumidos": 1250,
  "tiempo_total_ms": 15000,
  "created_at": "2026-02-22T18:30:00Z"
}
```

### POST /v1/consulta (streaming mode)

Cuando `streaming: true`, la respuesta se envia como Server-Sent Events (SSE):

```
event: status
data: {"nodo": "clasificar", "mensaje": "Clasificando consulta..."}

event: status
data: {"nodo": "recolectar_datos", "mensaje": "Obteniendo plantel de River Plate..."}

event: status
data: {"nodo": "buscar_tactica", "mensaje": "Buscando teoria sobre bloques bajos..."}

event: token
data: {"token": "Para"}

event: token
data: {"token": " enfrentar"}

event: token
data: {"token": " el"}

...

event: done
data: {"id": "UUID", "iteraciones": 1, "tokens": 1250}
```

---

# Feature 02: Biblioteca Tactica (RAG)

## Descripcion General

La Biblioteca Tactica es el sistema de memoria a largo plazo del agente. Permite ingestar documentos de tactica futbolistica (PDFs, TXT, Markdown), procesarlos en chunks semanticos, vectorizarlos y almacenarlos en ChromaDB. En tiempo de consulta, el agente busca los fragmentos mas relevantes por similaridad semantica.

## Aceptacion

### AC-02.1: Ingesta de PDF exitosa
> **Given** un archivo PDF de 50 paginas sobre tactica de Guardiola
> **When** se envia a `POST /v1/biblioteca/ingestar` con categoria="sistemas"
> **Then** el sistema extrae el texto, genera chunks, crea embeddings, almacena en ChromaDB y retorna la cantidad de chunks creados

### AC-02.2: Busqueda semantica
> **Given** documentos ingestados sobre "bloque bajo" y "presion alta"
> **When** se busca "como atacar a un equipo que se cierra atras"
> **Then** el sistema retorna fragmentos sobre "bloque bajo" (no sobre "presion alta") con score de relevancia > 0.7

### AC-02.3: Archivo invalido
> **Given** un archivo .exe renombrado a .pdf
> **When** se envia a `POST /v1/biblioteca/ingestar`
> **Then** el sistema rechaza con HTTP 400: `{detail: "Formato de archivo invalido. Se acepta: PDF, TXT, MD."}`

### AC-02.4: Eliminacion de documento
> **Given** un documento ingestado con id="doc_123"
> **When** se envia `DELETE /v1/biblioteca/doc_123`
> **Then** todos los chunks del documento se eliminan de ChromaDB

### AC-02.5: Listado de documentos
> **Given** 5 documentos ingestados en la Biblioteca
> **When** se consulta `GET /v1/biblioteca`
> **Then** retorna la lista con id, titulo, fuente, categoria, cantidad de chunks y fecha de ingesta

## Contrato API

### POST /v1/biblioteca/ingestar

**Request:** `multipart/form-data`
- `file`: Archivo PDF, TXT o MD
- `titulo`: "Tactica de Guardiola"
- `fuente`: "Herr Pep - Marti Perarnau"
- `categoria`: "sistemas" | "roles" | "transiciones" | "set_pieces" | "analisis"

**Response 201:**
```json
{
  "documento_id": "doc_uuid",
  "titulo": "Tactica de Guardiola",
  "fuente": "Herr Pep - Marti Perarnau",
  "categoria": "sistemas",
  "chunks_generados": 42,
  "paginas_procesadas": 50,
  "status": "indexado",
  "created_at": "2026-02-22T10:00:00Z"
}
```

### POST /v1/biblioteca/buscar

**Request:**
```json
{
  "query": "roles contra bloque bajo 5-4-1",
  "top_k": 5,
  "categoria_filtro": "roles",
  "score_minimo": 0.5
}
```

**Response 200:**
```json
{
  "fragmentos": [
    {
      "contenido": "La mezzala es un interior con perfil ofensivo que...",
      "fuente": "Manual de Roles Tacticos",
      "categoria": "roles",
      "pagina": 34,
      "score": 0.94
    },
    {
      "contenido": "Contra un bloque bajo, la superioridad posicional...",
      "fuente": "Herr Pep - Guardiola",
      "categoria": "sistemas",
      "pagina": 112,
      "score": 0.87
    }
  ],
  "total_resultados": 5,
  "tiempo_busqueda_ms": 150
}
```

### GET /v1/biblioteca

**Response 200:**
```json
{
  "documentos": [
    {
      "id": "doc_uuid",
      "titulo": "Tactica de Guardiola",
      "fuente": "Herr Pep",
      "categoria": "sistemas",
      "chunks": 42,
      "created_at": "2026-02-22T10:00:00Z"
    }
  ],
  "total": 5
}
```

### DELETE /v1/biblioteca/{documento_id}

**Response 200:**
```json
{
  "documento_id": "doc_uuid",
  "chunks_eliminados": 42,
  "status": "eliminado"
}
```

---

# Feature 03: Datos en Tiempo Real (Ojeador)

## Descripcion General

El Ojeador es el microservicio responsable de conectar al agente con datos futbolisticos actualizados. Consulta APIs externas (API-Football) para obtener planteles, lesiones, estadisticas y fixtures, implementando cache con Redis para respetar rate limits y mejorar latencia.

## Aceptacion

### AC-03.1: Obtener plantel
> **Given** un equipo "River Plate" existente en API-Football
> **When** se consulta `GET /v1/datos/equipos/river-plate/plantel`
> **Then** retorna la lista de jugadores con nombre, posicion, edad, numero y estado fisico

### AC-03.2: Cache hit
> **Given** el plantel de River fue consultado hace 2 horas (TTL = 6 horas)
> **When** se vuelve a consultar
> **Then** retorna datos del cache de Redis sin llamar a API-Football

### AC-03.3: Cache miss
> **Given** no hay datos cacheados de Boca Juniors
> **When** se consulta el plantel de Boca
> **Then** consulta API-Football, almacena en Redis con TTL=6h, y retorna los datos

### AC-03.4: API-Football no disponible
> **Given** API-Football esta caida y no hay cache para el equipo
> **When** se consulta el plantel
> **Then** retorna HTTP 503: `{detail: "Servicio de datos no disponible. Intente nuevamente."}`

### AC-03.5: Equipo no encontrado
> **Given** un equipo que no existe "Equipo Inventado FC"
> **When** se consulta el plantel
> **Then** retorna HTTP 404: `{detail: "Equipo no encontrado"}`

## Contrato API

### GET /v1/datos/equipos/{equipo}/plantel

**Response 200:**
```json
{
  "equipo": {
    "id": 435,
    "nombre": "River Plate",
    "pais": "Argentina",
    "liga": "Liga Profesional",
    "escudo_url": "https://...",
    "dt_actual": "Martin Demichelis"
  },
  "plantilla": [
    {
      "id": 12345,
      "nombre": "Franco Armani",
      "edad": 38,
      "posicion_principal": "Arquero",
      "posiciones_alternativas": [],
      "numero_camiseta": 1,
      "estado": "disponible",
      "detalle_estado": null,
      "nacionalidad": "Argentina"
    }
  ],
  "resumen": {
    "total_jugadores": 28,
    "disponibles": 25,
    "lesionados": 2,
    "suspendidos": 1
  },
  "fuente": "API-Football",
  "cache": true,
  "cache_edad_minutos": 120,
  "actualizado_at": "2026-02-22T14:00:00Z"
}
```

### GET /v1/datos/equipos/{equipo}/fixture

**Response 200:**
```json
{
  "equipo": "River Plate",
  "proximos_partidos": [
    {
      "fecha": "2026-02-24T21:00:00Z",
      "rival": "Platense",
      "competencia": "Liga Profesional",
      "condicion": "local",
      "estadio": "Monumental"
    }
  ]
}
```

### GET /v1/datos/jugadores/{jugador_id}/estadisticas

**Response 200:**
```json
{
  "jugador": "Enzo Fernandez",
  "temporada": "2025-2026",
  "estadisticas": {
    "partidos_jugados": 18,
    "goles": 3,
    "asistencias": 7,
    "pases_clave": 42,
    "duelos_ganados_pct": 58.5,
    "minutos_jugados": 1520
  }
}
```

---

# Feature 04: Modelo LLM Local

## Descripcion General

El sistema ejecuta modelos de lenguaje localmente via Ollama. Soporta multiples modelos, streaming de tokens y configuracion dinamica. La inferencia nunca sale de la maquina del usuario.

## Aceptacion

### AC-04.1: Inferencia exitosa
> **Given** Ollama esta corriendo con el modelo "llama3:8b" descargado
> **When** el Orchestrator envia un prompt de razonamiento
> **Then** Ollama retorna la respuesta generada con tokens por segundo >= 10

### AC-04.2: Streaming de tokens
> **Given** una consulta en modo streaming
> **When** el LLM genera la respuesta
> **Then** los tokens se envian al frontend uno por uno via SSE

### AC-04.3: Modelo no disponible
> **Given** el modelo configurado no esta descargado en Ollama
> **When** se intenta una consulta
> **Then** retorna HTTP 503 con `{detail: "Modelo llama3:70b no disponible. Descargalo con: ollama pull llama3:70b"}`

### AC-04.4: Listar modelos disponibles
> **Given** Ollama tiene 3 modelos descargados
> **When** se consulta `GET /v1/modelos`
> **Then** retorna lista de modelos con nombre, tamaño, y VRAM requerida

## Contrato API

### GET /v1/modelos

**Response 200:**
```json
{
  "modelos_disponibles": [
    {
      "nombre": "llama3:8b",
      "tamaño_gb": 4.7,
      "vram_requerida_gb": 6,
      "familia": "Llama 3",
      "activo": true
    },
    {
      "nombre": "mistral:7b",
      "tamaño_gb": 4.1,
      "vram_requerida_gb": 5,
      "familia": "Mistral",
      "activo": false
    }
  ],
  "modelo_activo": "llama3:8b",
  "ollama_version": "0.3.1"
}
```

---

# Feature 05: Interfaz de Usuario (Frontend)

## Descripcion General

La interfaz de FutBot es una aplicacion web conversacional construida con Streamlit. Permite al usuario formular consultas en lenguaje natural, ver el proceso de razonamiento del agente en tiempo real, y gestionar la Biblioteca Tactica.

## Aceptacion

### AC-05.1: Chat conversacional
> **Given** la interfaz cargada
> **When** el usuario escribe una consulta y presiona Enter
> **Then** la consulta se envia al Gateway API y la respuesta aparece en el chat

### AC-05.2: Display de razonamiento
> **Given** una consulta en proceso
> **When** el agente visita los nodos del grafo
> **Then** la interfaz muestra en tiempo real: "🔍 Clasificando consulta...", "📡 Obteniendo plantel...", "📚 Buscando teoria tactica...", "🧠 Generando analisis..."

### AC-05.3: Streaming de respuesta
> **Given** el LLM esta generando tokens
> **When** cada token es producido
> **Then** aparece inmediatamente en la interfaz (efecto "maquina de escribir")

### AC-05.4: Panel de configuracion
> **Given** un usuario que quiere cambiar el modelo
> **When** accede al sidebar de configuracion
> **Then** puede seleccionar el modelo LLM, ajustar max_iteraciones y rag_top_k

### AC-05.5: Ingesta de documentos
> **Given** un usuario con un PDF de tactica
> **When** sube el archivo via el panel lateral de Biblioteca
> **Then** el archivo se envia al RAG Service, se procesa, y se muestra confirmacion con cantidad de chunks

---

# Feature 06: Sistema y Operaciones

## Descripcion General

El sistema expone endpoints de salud, configuracion y diagnostico para monitorear el estado de todos los microservicios.

## Aceptacion

### AC-06.1: Health check completo
> **Given** todos los servicios levantados
> **When** se consulta `GET /v1/health`
> **Then** retorna el estado de cada servicio: orchestrator, rag, data, ollama, redis, chromadb

### AC-06.2: Servicio degradado
> **Given** Redis esta caido pero el resto funciona
> **When** se consulta `GET /v1/health`
> **Then** retorna status "degraded" con redis: "down" y los demas: "up"

## Contrato API

### GET /v1/health

**Response 200:**
```json
{
  "status": "healthy",
  "services": {
    "orchestrator": "up",
    "rag_service": "up",
    "data_service": "up",
    "ollama": "up",
    "chromadb": "up",
    "redis": "up"
  },
  "modelo_activo": "llama3:8b",
  "documentos_en_biblioteca": 142,
  "uptime_seconds": 86400
}
```

---

# Tareas por Fase

## Fase 1: Infraestructura, Configuracion y LLM

| ID | Tarea | Criterio de Completitud |
|----|-------|------------------------|
| T-1.1 | Scaffold del proyecto microservicios | Estructura de directorios, docker-compose.yml, configuracion base de cada servicio. `docker compose up` levanta todo. |
| T-1.2 | Integracion con Ollama | LLM Service conectado. `GET /v1/health` confirma modelo cargado. Inferencia basica funciona. |
| T-1.3 | Gateway API con FastAPI | Endpoint `GET /v1/health` funciona. Validacion Pydantic implementada. Rate limiting configurado. |

## Fase 2: Biblioteca Tactica (RAG)

| ID | Tarea | Criterio de Completitud |
|----|-------|------------------------|
| T-2.1 | Servicio RAG con ChromaDB | Ingesta de PDFs funciona. Chunking semantico implementado. Embeddings generados y almacenados. |
| T-2.2 | Busqueda semantica | POST /v1/biblioteca/buscar retorna fragmentos relevantes con score. Filtro por categoria funciona. |
| T-2.3 | CRUD de documentos | Ingesta, listado y eliminacion de documentos funcionan correctamente. |

## Fase 3: Datos en Tiempo Real (Ojeador)

| ID | Tarea | Criterio de Completitud |
|----|-------|------------------------|
| T-3.1 | Data Service con API-Football | Obtencion de planteles, lesionados, fixtures funciona. Cache Redis implementado con TTL. |
| T-3.2 | Herramientas LangChain (Tools) | Tools definidos como @tool de LangChain. El Orchestrator puede invocarlos. |
| T-3.3 | Manejo de errores y retry | Backoff exponencial ante fallos de API. Fallback a cache. Error claro al usuario. |

## Fase 4: Orquestador (Grafo LangGraph)

| ID | Tarea | Criterio de Completitud |
|----|-------|------------------------|
| T-4.1 | Grafo de estados del agente | Nodos (clasificar, recolectar, buscar, razonar, validar) definidos. Edges y condiciones. |
| T-4.2 | Nodo Clasificador | Clasifica correctamente: propuesta_tactica, analisis_rival, comparacion, consulta_teorica, general. |
| T-4.3 | Nodo Razonador con streaming | El LLM genera respuestas con streaming de tokens. Contexto enriquecido (datos + teoria). |
| T-4.4 | Nodo Validador con re-iteracion | Detecta jugadores lesionados o posiciones invalidas. Re-itera correctamente. Max 3 ciclos. |

## Fase 5: Frontend (Streamlit)

| ID | Tarea | Criterio de Completitud |
|----|-------|------------------------|
| T-5.1 | Chat conversacional | Interfaz de chat funciona. Consultas se envian y respuestas se muestran. |
| T-5.2 | Display de razonamiento | Se muestra en tiempo real que nodos visita el agente. Streaming de tokens funciona. |
| T-5.3 | Panel de configuracion | Cambio de modelo, ajuste de parametros (max_iteraciones, rag_top_k). |
| T-5.4 | Gestion de Biblioteca | Subida de PDFs, listado de documentos, eliminacion. |

## Fase 6: Integracion y Validacion

| ID | Tarea | Criterio de Completitud |
|----|-------|------------------------|
| T-6.1 | Tests de integracion | Flujo completo: consulta → clasificar → recolectar → buscar → razonar → validar → respuesta. |
| T-6.2 | Tests de tolerancia a fallos | API-Football caida → cache funciona. Ollama caido → error claro. ChromaDB caido → respuesta sin RAG. |
| T-6.3 | Docker Compose final | Todos los servicios levantan con `docker compose up`. Health checks pasan. |

---

## Casos de Borde Criticos

1. **Consulta sobre equipo que no existe en API-Football**: Retornar error claro en lugar de alucinar un plantel.
2. **Consulta sin Biblioteca Tactica vacia**: El agente responde usando solo su conocimiento base, con disclaimer de que no hay fuentes tacticas disponibles.
3. **Modelo LLM con contexto insuficiente**: Si el plantel + teoria + prompt excede la ventana de contexto, truncar los fragmentos tacticos menos relevantes.
4. **Jugador con nombre ambiguo**: Si hay dos jugadores con el mismo nombre en el plantel, el agente debe desambiguar por posicion o numero.
5. **Consulta en otro idioma**: En MVP, el sistema solo soporta español. Consultas en otros idiomas se responden en español con nota.
6. **Multiples equipos en una consulta**: El Ojeador debe obtener datos de todos los equipos mencionados.
7. **Grafo en loop infinito**: El max_iteraciones impone un limite duro. Si se alcanza, retorna la mejor respuesta disponible.
8. **PDF sin texto extraible (escaneado)**: Rechazar con mensaje claro: "El PDF no contiene texto extraible. Use un PDF con texto nativo."
