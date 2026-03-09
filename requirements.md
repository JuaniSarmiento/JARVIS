# Requirements — FutBot

> Este documento define los requisitos funcionales y no funcionales del sistema FutBot.
> Formato de requisitos funcionales: EARS (Easy Approach to Requirements Syntax).

---

## Indice

1. [Historias de Usuario](#1-historias-de-usuario)
2. [Requisitos Funcionales (EARS)](#2-requisitos-funcionales-ears)
3. [Requisitos No Funcionales](#3-requisitos-no-funcionales)
4. [Dependencias y Restricciones](#4-dependencias-y-restricciones)
5. [Alcance MVP](#5-alcance-mvp)
6. [Supuestos y Preguntas Abiertas](#6-supuestos-y-preguntas-abiertas)
7. [Matriz de Trazabilidad](#7-matriz-de-trazabilidad)

---

# 1. Historias de Usuario

## US-01: Proponer formacion con datos reales
**Como** director tecnico,
**quiero** preguntarle al sistema como formar mi equipo para el proximo partido basandose en los jugadores disponibles hoy,
**para** recibir una propuesta fundamentada en tactica y alineada con la realidad del plantel.

## US-02: Analizar esquema rival
**Como** analista tactico del cuerpo tecnico,
**quiero** consultar como contrarrestar el sistema de juego del rival,
**para** preparar una estrategia especifica con fundamento teorico.

## US-03: Consultar teoria tactica
**Como** estudiante de direccion tecnica,
**quiero** preguntarle al sistema sobre conceptos tacticos (roles, transiciones, sistemas),
**para** aprender con explicaciones profundas basadas en bibliografia especializada, no en Wikipedia.

## US-04: Alimentar la base de conocimiento
**Como** administrador del sistema,
**quiero** subir PDFs y documentos de tactica al sistema,
**para** que el agente tenga acceso a material especializado cuando razone sus respuestas.

## US-05: Comparar jugadores para un rol
**Como** director tecnico,
**quiero** pedirle al sistema que compare dos o mas jugadores de mi plantel para un rol especifico,
**para** decidir quien se adapta mejor a la funcion tactica que necesito.

## US-06: Analizar rendimiento reciente
**Como** preparador fisico,
**quiero** consultar la forma reciente del equipo y estadisticas individuales,
**para** cruzar el estado fisico con los requerimientos del esquema tactico propuesto.

## US-07: Ejecutar todo localmente
**Como** usuario del sistema,
**quiero** que toda la inferencia de IA corra en mi maquina sin enviar datos a la nube,
**para** garantizar privacidad y no depender de APIs de pago para la generacion de respuestas.

---

# 2. Requisitos Funcionales (EARS)

## RF-01 a RF-06: Consultas Tacticas

- **RF-01**: Cuando el usuario formula una consulta tactica, el sistema debe clasificar automaticamente el tipo de consulta (propuesta_tactica, analisis_rival, comparacion, consulta_teorica, general) sin intervencion manual.
- **RF-02**: Cuando la consulta requiere datos de un equipo real, el sistema debe obtener automaticamente el plantel actual, jugadores lesionados y suspendidos desde la API de datos deportivos.
- **RF-03**: Cuando la consulta requiere fundamento teorico, el sistema debe buscar automaticamente fragmentos relevantes en la Biblioteca Tactica via busqueda semantica (RAG).
- **RF-04**: Cuando el sistema genera una propuesta de formacion, debe validar que todos los jugadores mencionados estan en el plantel actual y disponibles (no lesionados ni suspendidos).
- **RF-05**: Cuando la validacion detecta una inconsistencia (jugador lesionado propuesto como titular), el sistema debe re-iterar el razonamiento con datos corregidos, hasta un maximo de 3 iteraciones.
- **RF-06**: Cuando el usuario pregunta sobre un concepto tactico puro (sin equipo especifico), el sistema debe responder usando exclusivamente la Biblioteca Tactica, sin consultar APIs externas.

## RF-07 a RF-10: Biblioteca Tactica

- **RF-07**: El sistema debe permitir ingestar documentos en formato PDF, TXT y Markdown para alimentar la Biblioteca Tactica.
- **RF-08**: Cuando se ingesta un documento, el sistema debe dividirlo en chunks semanticos, generar embeddings y almacenarlos en la base de datos vectorial con metadata (fuente, categoria, tema).
- **RF-09**: El sistema debe soportar al menos 5 categorias de documentos tacticos: sistemas, roles, transiciones, set_pieces, analisis.
- **RF-10**: El sistema debe permitir eliminar documentos de la Biblioteca Tactica por ID o por fuente.

## RF-11 a RF-14: Datos en Tiempo Real (Ojeador)

- **RF-11**: El sistema debe obtener el plantel completo de un equipo incluyendo nombre, posicion principal, posiciones alternativas, numero de camiseta y estado fisico.
- **RF-12**: El sistema debe obtener la lista de jugadores lesionados y suspendidos con detalle del motivo y tiempo estimado de baja.
- **RF-13**: El sistema debe obtener el fixture del equipo con fecha, rival, competencia y condicion (local/visitante).
- **RF-14**: Cuando la API de datos no esta disponible, el sistema debe reintentar con backoff exponencial (max 3 reintentos) y, si falla, responder con los datos cacheados disponibles o informar al usuario que los datos no estan actualizados.

## RF-15 a RF-18: Modelo LLM

- **RF-15**: El sistema debe ejecutar el modelo de lenguaje localmente via Ollama, sin enviar datos a servicios externos.
- **RF-16**: El sistema debe soportar streaming de tokens para que el usuario vea la respuesta generandose en tiempo real.
- **RF-17**: El sistema debe permitir cambiar el modelo LLM activo sin reiniciar el sistema (cambio de variable de entorno).
- **RF-18**: Cuando el modelo LLM no esta disponible o falla, el sistema debe informar al usuario con un mensaje claro en lugar de generar una respuesta corrupta.

## RF-19 a RF-21: Interfaz de Usuario

- **RF-19**: La interfaz debe presentar un chat conversacional donde el usuario puede escribir consultas en lenguaje natural.
- **RF-20**: La interfaz debe mostrar el proceso de razonamiento del agente en tiempo real (que nodos del grafo esta visitando, que herramientas esta usando).
- **RF-21**: La interfaz debe permitir al usuario ver el historial de consultas y respuestas de la sesion actual.

---

# 3. Requisitos No Funcionales

## 3.1 Rendimiento

| Metrica | Objetivo | Medicion |
|---------|----------|----------|
| Latencia de clasificacion de consulta | < 3 segundos | Timer en nodo clasificador |
| Latencia de busqueda semantica (RAG) | < 2 segundos para top_k=5 | Timer en RAG Service |
| Latencia de obtencion de plantel (cache hit) | < 500ms | Timer en Data Service |
| Latencia de obtencion de plantel (cache miss) | < 5 segundos | Timer en Data Service |
| Tiempo total de respuesta (consulta completa) | < 60 segundos (con LLM 8B) | Timer end-to-end |
| Tiempo de ingesta de un PDF de 100 paginas | < 5 minutos | Timer en RAG Service |
| Tokens por segundo del LLM | >= 10 tok/s (GPU moderna) | Ollama metrics |

## 3.2 Disponibilidad

| Metrica | Objetivo |
|---------|----------|
| Uptime de microservicios internos | >= 99% (Docker restart policies) |
| Tolerancia a fallo de API-Football | Sistema opera con cache; informa al usuario si datos no estan frescos |
| Tolerancia a fallo de ChromaDB | Sistema responde sin RAG; calidad reducida pero funcional |
| Tolerancia a fallo de Ollama | Sistema no puede responder; error claro al usuario |

## 3.3 Seguridad

| Requisito | Implementacion |
|-----------|----------------|
| API keys protegidas | Variables de entorno, nunca en codigo |
| Datos del usuario locales | Toda inferencia y almacenamiento en la maquina del usuario |
| Sin telemetria | No se envian metricas ni datos de uso a servicios externos |
| Validacion de entrada | Pydantic v2 en todos los endpoints |
| Validacion de archivos | MIME type check en ingesta (solo PDF, TXT, MD) |
| Rate limiting | 60 req/min hacia el Gateway; respeta limits de API-Football |

## 3.4 Mantenibilidad

| Requisito | Implementacion |
|-----------|----------------|
| Separacion de microservicios | Cada pilar en su propio servicio independiente |
| Cobertura de tests | >= 70% en orchestrator y servicios criticos |
| Linting | ruff o flake8 con configuracion estricta |
| Formato de codigo | black o ruff format |
| Type hints | Obligatorios en todas las funciones publicas |
| Documentacion de API | OpenAPI auto-generada por FastAPI |
| Logging estructurado | structlog o loguru con request_id |

## 3.5 Portabilidad

| Requisito | Implementacion |
|-----------|----------------|
| Despliegue containerizado | Docker Compose con todos los servicios |
| Independencia de hardware GPU | Funciona con GPU NVIDIA (CUDA) o CPU (mas lento) |
| Modelos intercambiables | Cambio de modelo = cambio de variable de entorno |
| Configuracion por entorno | Variables de entorno via pydantic-settings |

---

# 4. Dependencias y Restricciones

## Dependencias Externas

| Dependencia | Tipo | Impacto si no esta disponible |
|-------------|------|-------------------------------|
| Ollama | Inferencia LLM local | Sistema no puede generar respuestas |
| ChromaDB | Base de datos vectorial | Sistema responde sin RAG (calidad reducida) |
| Redis | Cache de datos | Sistema funciona sin cache (mas lento, mas API calls) |
| API-Football | Datos deportivos | Sistema responde con datos cacheados o sin datos reales |
| GPU NVIDIA (CUDA) | Aceleracion de inferencia | Sistema funciona en CPU (10-50x mas lento) |

## Restricciones

1. **Python >= 3.11**: Requerido para typing moderno y performance improvements.
2. **Ollama instalado**: Requerido para inferencia local. Debe tener al menos un modelo descargado.
3. **VRAM GPU**: Un modelo 8B requiere ~6GB VRAM; un modelo 70B requiere ~40GB VRAM.
4. **Almacenamiento**: ChromaDB y los modelos de Ollama requieren espacio en disco (5-50GB segun el modelo).
5. **Conexion a internet**: Requerida unicamente para consultas de datos deportivos (Ojeador). La inferencia y el RAG funcionan offline.

---

# 5. Alcance MVP

## Incluido en MVP

- [x] Consultas tacticas en lenguaje natural
- [x] Clasificacion automatica del tipo de consulta
- [x] Obtencion de planteles reales via API-Football
- [x] Biblioteca Tactica con ingesta de PDFs y busqueda semantica (RAG)
- [x] Grafo de decisiones con LangGraph (clasificar → recolectar → buscar → razonar → validar)
- [x] Validacion de coherencia (jugadores existen, posiciones validas)
- [x] Streaming de respuestas del LLM
- [x] Interfaz conversacional con Streamlit
- [x] Display del proceso de razonamiento en tiempo real
- [x] Cache de datos deportivos con Redis
- [x] Health checks de todos los servicios
- [x] Deploy con Docker Compose

## Excluido del MVP

- [ ] Analisis de video de partidos
- [ ] Integracion con Wyscout u Opta
- [ ] Fine-tuning del modelo con datos tacticos
- [ ] Multi-idioma (solo español en MVP)
- [ ] API publica para integracion con terceros
- [ ] Modelos predictivos (xG, xA)
- [ ] Historial persistente de consultas entre sesiones
- [ ] Autenticacion de usuarios (sistema single-user en MVP)
- [ ] Deployment en cloud con GPU rental

---

# 6. Supuestos y Preguntas Abiertas

## Supuestos

1. El usuario tiene una GPU NVIDIA con al menos 6GB de VRAM (o acepta usar CPU con rendimiento reducido).
2. El usuario tiene Docker y Docker Compose instalados.
3. Los documentos tacticos estan en español.
4. El usuario tiene acceso a una API key de API-Football (plan gratuito o de pago).
5. Un modelo 8B es suficiente para razonamiento tactico de calidad en el MVP.

## Preguntas Abiertas

1. ¿Se requiere soporte para ligas especificas o debe ser generico (cualquier liga del mundo)?
2. ¿La interfaz debe soportar visualizacion de formaciones en campo (dibujo del 4-3-3, etc.)?
3. ¿Se necesita exportar los analisis en formato PDF o Word?
4. ¿El sistema debe recordar las preferencias tacticas del DT entre sesiones (ej: "siempre uso linea de 4")?
5. ¿Se requiere un modo de simulacion tactica (que pasa si cambio a 3-5-2 en el segundo tiempo)?

---

# 7. Matriz de Trazabilidad

| Req | User Story | Feature | Componente Arquitectonico |
|-----|-----------|---------|--------------------------|
| RF-01 | US-01, US-02 | F01 Consultas | orchestrator/clasificador.py |
| RF-02 | US-01 | F01 Consultas | orchestrator/recolector.py → data-service |
| RF-03 | US-01, US-03 | F01 Consultas | orchestrator/buscador_rag.py → rag-service |
| RF-04 | US-01 | F01 Consultas | orchestrator/validador.py |
| RF-05 | US-01 | F01 Consultas | orchestrator/graph_builder.py (ciclo) |
| RF-06 | US-03 | F02 Teoria | orchestrator/clasificador.py → buscador_rag.py |
| RF-07 | US-04 | F03 Biblioteca | rag-service/ingesta.py |
| RF-08 | US-04 | F03 Biblioteca | rag-service/chunker.py + embedder.py |
| RF-11 | US-01, US-06 | F04 Ojeador | data-service/equipos.py |
| RF-12 | US-01, US-06 | F04 Ojeador | data-service/equipos.py |
| RF-15 | US-07 | F05 LLM Local | ollama (docker) |
| RF-16 | US-01 | F05 LLM Local | orchestrator/razonador.py (SSE) |
| RF-19 | US-01 | F06 Frontend | frontend/app.py (Streamlit) |
| RF-20 | US-01 | F06 Frontend | frontend/app.py (reasoning display) |
