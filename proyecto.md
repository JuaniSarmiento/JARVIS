# Proyecto FutBot: Especificaciones del Sistema

## Introduccion

El presente documento describe las especificaciones completas para el desarrollo de FutBot, un Agente de Inteligencia Artificial Autonomo diseñado para razonar sobre tactica futbolistica de alto nivel y aplicar ese conocimiento teorico a la realidad actual de los equipos. El sistema corre 100% en la maquina del usuario, combinando un modelo de lenguaje local (LLM) con bases de datos vectoriales, APIs de datos futbolisticos en tiempo real y un grafo de decisiones inteligente que orquesta todo el flujo de razonamiento.

El objetivo central es construir un asistente para cuerpos tecnicos capaz de: analizar sistemas de juego y sus variantes tacticas, evaluar planteles reales con datos actualizados en tiempo real, proponer formaciones y roles especificos basados en la combinacion de teoria tactica y jugadores disponibles, estudiar rivales y recomendar estrategias para contrarrestar sus esquemas, y generar analisis detallados con justificacion tactica fundamentada en bibliografica especializada.

---

## Vision General del Sistema

FutBot opera como un ecosistema de cuatro pilares integrados que resuelven las dos limitaciones fundamentales de los LLMs genericos para analisis tactico: la amnesia temporal (no saben que pasa hoy en el futbol) y la falta de profundidad tactica (conocimiento superficial de Wikipedia, no de manuales especializados).

El sistema se compone de: un Modelo LLM Local (El Cerebro) que ejecuta el razonamiento final, una Base de Datos Vectorial (La Biblioteca Tactica) que almacena conocimiento tactico especializado de fuentes como libros de Guardiola, manuales de roles y PDFs de estrategias, un conjunto de Herramientas de Datos en Tiempo Real (El Ojeador) que consultan APIs externas para obtener planteles actuales, lesiones y estadisticas, y un Grafo de Decisiones (El Director Tecnico) implementado con LangGraph que orquesta el flujo de razonamiento decidiendo que herramientas usar y en que orden.

La arquitectura esta diseñada como un sistema de microservicios donde cada pilar opera como un servicio independiente, comunicandose entre si via HTTP REST y gRPC, orquestados por el Grafo de Decisiones central.

---

## Stack Tecnologico

El sistema se construye enteramente sobre **Python >= 3.11** como lenguaje principal, aprovechando su ecosistema dominante en IA, procesamiento de lenguaje natural y frameworks de agentes autonomos.

**LangChain** y **LangGraph** conforman el framework central de orquestacion. LangChain provee las abstracciones para interactuar con LLMs, gestionar prompts, encadenar herramientas y conectar con bases de datos vectoriales. LangGraph extiende LangChain con un grafo dirigido de estados que permite definir flujos de decision complejos con ciclos, condiciones y paralelismo — esencial para que el agente decida autonomamente si necesita buscar datos, consultar la biblioteca tactica o razonar directamente.

**Ollama** funciona como el servidor de inferencia local del LLM. Permite ejecutar modelos como Llama 3, Mistral, Qwen o DeepSeek directamente en la GPU del usuario sin necesidad de conexion a la nube ni APIs de pago. La comunicacion es via HTTP REST local (puerto 11434 por defecto).

**ChromaDB** (o Qdrant como alternativa) opera como la base de datos vectorial para la Biblioteca Tactica. Almacena embeddings de documentos tacticos (PDFs, libros, articulos) y permite busqueda semantica: cuando el agente necesita teoria sobre "como romper un bloque bajo", ChromaDB retorna los fragmentos mas relevantes de la base de conocimiento.

**FastAPI** se utiliza como framework HTTP para exponer los microservicios internos y la API principal del sistema. Cada microservicio expone endpoints REST documentados con OpenAPI.

**Streamlit** (o Gradio como alternativa) funciona como la interfaz de usuario. Provee una interfaz web conversacional donde el usuario interactua con el agente, ve el proceso de razonamiento en tiempo real y recibe los analisis generados.

La obtencion de datos en tiempo real se realiza mediante la **API-Football** (o Transfermarkt como alternativa) para planteles, lesiones, estadisticas y fixtures. Se implementa como un microservicio independiente (El Ojeador) que el agente puede invocar como herramienta.

---

## Los Cuatro Pilares del Sistema

### Pilar 1: El Cerebro (Modelo LLM Local)

El Cerebro es el motor de razonamiento del sistema. Es un modelo de lenguaje grande que corre localmente en la GPU del usuario a traves de Ollama. Su responsabilidad es entender la pregunta del usuario, procesar el contexto enriquecido (datos de planteles + teoria tactica) y generar una respuesta analitica coherente y fundamentada.

El Cerebro no busca datos por su cuenta ni inventa informacion. Solo razona sobre lo que le proporcionan los otros pilares. Esto resuelve el problema de las "alucinaciones" tacticas: en lugar de inventar que un jugador juega en una posicion, el sistema le proporciona datos verificados de APIs reales.

Los modelos recomendados son Llama 3 70B (para GPUs potentes), Llama 3 8B (para hardware moderado), Mistral 7B (equilibrio rendimiento/velocidad) o Qwen 2.5 (buen rendimiento en español). La seleccion del modelo es configurable y se adapta al hardware disponible.

### Pilar 2: La Biblioteca Tactica (Memoria a Largo Plazo)

La Biblioteca Tactica es una base de datos vectorial (ChromaDB) donde se almacenan documentos de tactica futbolistica procesados y vectorizados. Incluye PDFs de libros especializados, manuales de roles (mezzala, mediocentro, falso 9, carrilero), analisis de sistemas de juego (4-3-3, 3-5-2, 5-4-1), estrategias de transicion ofensiva y defensiva, y articulos de tactica avanzada.

Cuando el agente necesita teoria tactica, realiza una busqueda semantica (RAG - Retrieval-Augmented Generation) en la Biblioteca. Por ejemplo, si la pregunta es "como romper un 5-4-1 cerrado", la Biblioteca retorna los fragmentos mas relevantes de los documentos que hablan sobre ataque posicional contra bloques bajos, uso de interiores agresivos, superioridades numericas en zona de creacion, etc.

El proceso de ingesta incluye: carga de PDFs y documentos, division en chunks semanticos, generacion de embeddings con el modelo de embedding local (o SentenceTransformers), y almacenamiento indexado en ChromaDB con metadata (fuente, tema, fecha).

### Pilar 3: El Ojeador (Conexion con la Realidad)

El Ojeador es un microservicio que conecta al sistema con datos futbolisticos en tiempo real. Resuelve el problema de la amnesia temporal de los LLMs: cuando el usuario pregunta por River Plate, el Ojeador consulta APIs externas y obtiene el plantel actual, los jugadores lesionados, los suspendidos, las posiciones naturales de cada jugador, y estadisticas relevantes.

El Ojeador expone herramientas (tools) que el Grafo de Decisiones puede invocar:
- `obtener_plantel(equipo)`: Retorna la lista de jugadores disponibles del equipo con sus posiciones y estado fisico.
- `obtener_lesionados(equipo)`: Retorna jugadores lesionados o suspendidos.
- `obtener_fixture(equipo)`: Retorna los proximos partidos del equipo con rivales y competencia.
- `obtener_estadisticas_jugador(jugador)`: Retorna metricas individuales (goles, asistencias, pases clave, etc.).
- `obtener_forma_equipo(equipo)`: Retorna resultados recientes y rendimiento.

Cada herramienta implementa cache con TTL para evitar llamadas redundantes a las APIs externas y respetar los rate limits.

### Pilar 4: El Director Tecnico (Grafo de Decisiones)

El Director Tecnico es el nucleo del proyecto. Implementado con LangGraph, es un grafo dirigido de estados que orquesta todo el flujo de razonamiento. Cuando el usuario hace una pregunta, el Director Tecnico evalua la consulta y decide que pasos seguir.

El grafo tiene los siguientes nodos principales:
- **Clasificador de Consulta**: Analiza la pregunta del usuario y determina su tipo (analisis de equipo, analisis de rival, propuesta tactica, comparacion de jugadores, analisis de partido).
- **Recolector de Datos**: Si la consulta requiere datos actuales, invoca las herramientas del Ojeador.
- **Buscador Tactico**: Si la consulta requiere fundamento teorico, realiza RAG en la Biblioteca Tactica.
- **Razonador**: Combina los datos recolectados con la teoria tactica y genera el analisis final usando el LLM.
- **Validador**: Verifica que la respuesta sea coherente, que los jugadores mencionados existan en el plantel y que las posiciones asignadas sean validas.

El Director Tecnico puede ejecutar multiples ciclos: si el Validador detecta una inconsistencia (por ejemplo, proponer un jugador que esta lesionado), el grafo vuelve al nodo de recoleccion de datos para obtener informacion actualizada y regenera la respuesta.

---

## El Flujo de Trabajo (Caso de Uso Principal)

Imaginate esta situacion:

**Usuario**: "River juega contra Platense este finde. Ellos se van a meter atras con un 5-4-1. ¿Como formo el mediocampo para romper esa defensa, sabiendo la plantilla que tengo hoy?"

**El sistema reacciona:**

1. **Clasificador de Consulta**: Detecta que es una consulta de tipo "propuesta tactica con formacion" que requiere datos del plantel de River y teoria sobre ataque contra 5-4-1.

2. **Recolector de Datos (El Ojeador)**: Se conecta a la API-Football y obtiene el plantel actual de River. Detecta que un jugador clave del mediocampo esta lesionado. Obtiene las posiciones naturales y alternativas de cada jugador disponible.

3. **Buscador Tactico (La Biblioteca)**: Realiza busqueda semantica y encuentra fragmentos sobre: roles necesarios contra bloques bajos (mezzalas agresivas, interiores con llegada), superioridades posicionales en el ultimo tercio, liberacion de laterales al ataque, uso de mediapuntas entre lineas.

4. **Razonador (El Cerebro)**: Recibe el plantel completo con disponibilidad + la teoria tactica + la pregunta del usuario. Genera un analisis detallado: propone una formacion especifica (ej: 4-2-3-1), asigna jugadores reales a cada posicion justificando por que ese perfil encaja con la teoria (ej: "Poner a X como interior derecho porque su perfil de jugador con llegada al gol encaja con el rol de mezzala necesario para generar superioridad contra el 5-4-1"), y explica la logica tactica detrás de cada decision.

5. **Validador**: Verifica que todos los jugadores mencionados estan en el plantel actual y disponibles. Si detecta que propuso un jugador lesionado, el grafo vuelve a iterar para corregir.

---

## Modelo de Microservicios

FutBot se organiza como un sistema de microservicios containerizados:

| Microservicio | Tecnologia | Responsabilidad | Puerto |
|---------------|-----------|-----------------|--------|
| Gateway API | FastAPI | Punto de entrada principal, ruteo de consultas, autenticacion basica | 8000 |
| Orchestrator | LangGraph + LangChain | Grafo de decisiones, orquestacion del flujo de razonamiento | 8001 |
| RAG Service | ChromaDB + LangChain | Ingesta de documentos, busqueda semantica, gestion de la Biblioteca Tactica | 8002 |
| Data Service (Ojeador) | FastAPI + httpx | Conexion con APIs externas, cache de datos, herramientas de datos en tiempo real | 8003 |
| LLM Service | Ollama | Servidor de inferencia local, gestion de modelos | 11434 |
| Frontend | Streamlit | Interfaz web conversacional, visualizacion de razonamiento | 8501 |

La comunicacion entre microservicios es via HTTP REST interno. El Orchestrator es el unico servicio que invoca a los demas; los microservicios individuales no se comunican entre si directamente.

---

## Desafios Tecnicos Criticos

### 1. Ruteo Inteligente del Grafo
El mayor riesgo no es que la IA sea "tonta", sino que el Director Tecnico se maree buscando datos innecesarios o entre en loops infinitos. El diseño del grafo debe incluir limites de iteracion (max 3 ciclos), condiciones de salida claras y manejo de timeouts por nodo.

### 2. Calidad del RAG
La calidad de las respuestas depende directamente de la calidad de la Biblioteca Tactica. Documentos mal chunkeados, embeddings de baja calidad o falta de metadata generan respuestas superficiales. El chunking debe ser semantico (por seccion/tema, no por cantidad de caracteres) y los embeddings deben capturar la semantica tactica del español futbolistico.

### 3. Latencia del LLM Local
Un modelo de 70B parametros puede tardar 30-60 segundos en generar una respuesta completa en hardware modesto. El sistema debe implementar streaming de tokens para que el usuario vea la respuesta generandose en tiempo real, y considerar modelos mas pequeños (8B) para hardware limitado.

### 4. Confiabilidad de los Datos
Las APIs de datos futbolisticos pueden tener rate limits, downtime o datos inconsistentes. El Ojeador debe implementar retry con backoff exponencial, cache con TTL configurable, y fallbacks (si una API falla, intentar con otra fuente).

### 5. Contexto del LLM
Los modelos locales tienen ventanas de contexto limitadas (4K-128K tokens). El sistema debe gestionar cuidadosamente cuanto contexto le pasa al LLM: resumir datos de planteles en lugar de enviar JSONs completos, seleccionar solo los fragmentos de la Biblioteca mas relevantes, y comprimir el historial de conversacion.

---

## Esquemas de Datos Principales

### Modelo Jugador (del Ojeador)
```python
class Jugador(BaseModel):
    id: int
    nombre: str
    nombre_completo: str
    edad: int
    nacionalidad: str
    posicion_principal: str       # "Mediocampista Central", "Extremo Derecho"
    posiciones_alternativas: list[str]
    numero_camiseta: int | None
    estado: str                   # "disponible", "lesionado", "suspendido", "convocado_seleccion"
    detalle_estado: str | None    # "Desgarro muscular - 3 semanas"
    foto_url: str | None
    estadisticas: EstadisticasJugador | None
```

### Modelo Equipo (del Ojeador)
```python
class Equipo(BaseModel):
    id: int
    nombre: str
    nombre_corto: str
    pais: str
    liga: str
    escudo_url: str | None
    dt_actual: str | None
    formacion_habitual: str | None  # "4-3-3", "3-5-2"
    plantilla: list[Jugador]
    forma_reciente: list[ResultadoPartido]
```

### Modelo Consulta (del Orchestrator)
```python
class ConsultaTactica(BaseModel):
    id: UUID
    texto_usuario: str
    tipo: str                      # "propuesta_tactica", "analisis_rival", "comparacion", "general"
    equipos_involucrados: list[str]
    datos_recolectados: dict       # Datos del Ojeador
    contexto_tactico: list[str]    # Fragmentos de la Biblioteca
    respuesta_generada: str
    metadata: dict
    created_at: datetime
```

### Modelo Documento Tactico (de la Biblioteca)
```python
class DocumentoTactico(BaseModel):
    id: str
    titulo: str
    fuente: str                    # "Guardiola - Herr Pep", "Manual de Roles Tacticos"
    categoria: str                 # "sistemas", "roles", "transiciones", "set_pieces"
    contenido_chunk: str
    embedding: list[float]
    metadata: dict                 # pagina, seccion, tema
```

---

## Decisiones Tecnicas Fundamentales

La arquitectura de microservicios permite escalar cada pilar de forma independiente: si la Biblioteca Tactica crece, se escala ChromaDB sin tocar el resto. Si se necesita un LLM mas potente, se cambia el modelo en Ollama sin modificar el codigo.

El uso de Ollama como servidor de inferencia separa la logica de aplicacion de la gestion del modelo de IA. Esto permite cambiar de modelo (Llama 3 a Mistral a Qwen) sin tocar una linea de codigo del agente.

LangGraph como orquestador fue una decision critica: a diferencia de los chains lineales de LangChain, LangGraph permite ciclos y decisiones condicionales, lo cual es esencial para un agente que debe decidir autonomamente si necesita mas datos o si ya puede responder.

El RAG (Retrieval-Augmented Generation) sobre la Biblioteca Tactica es lo que diferencia a FutBot de un chatbot generico: en lugar de depender exclusivamente del conocimiento del LLM (que es superficial en tactica), el sistema inyecta conocimiento especializado verificado en cada respuesta.

La separacion del Ojeador como microservicio independiente permite agregar nuevas fuentes de datos sin modificar el core del agente. Hoy puede ser API-Football; mañana se puede agregar Wyscout, Opta o scraping de sitios especializados.
