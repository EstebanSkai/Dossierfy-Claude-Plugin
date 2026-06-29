# Dossierfy — Claude Desktop Extension

Extensión para [Claude Desktop](https://claude.ai/download) que conecta Claude con el servicio de grafo de conocimiento Dossierfy. Actúa como proxy transparente: descubre las herramientas disponibles en el servidor remoto y las re-expone localmente sin hardcodear ninguna tool.

## Herramientas expuestas

La extensión descubre las tools del servidor automáticamente. En la versión actual el servidor remoto publica:

| Tool | Descripción |
|------|-------------|
| `get_schema_mcp` | Devuelve el esquema del grafo Neo4j |
| `read_neo4j_cypher_mcp` | Ejecuta una consulta Cypher de solo lectura |

---

## Instalación para usuarios

### Requisitos previos
- **Claude Desktop** ≥ 0.10.0 ([descargar aquí](https://claude.ai/download))
- Una **API Key** válida para el servicio Dossierfy

### Paso 1: Descarga

Descarga el archivo `dossierfy.mcpb` desde el enlace que te hayan proporcionado.

### Paso 2: Instala en Claude Desktop

#### macOS

**Método principal — Doble clic en Finder:**  
Abre Claude Desktop. Después, navega hasta `dossierfy.mcpb` en el Finder y haz doble clic. El sistema lo abrirá automáticamente y mostrará el diálogo de instalación.

**Método alternativo** (si el doble clic no abre Claude Desktop):  
En Claude Desktop ve a **Settings → Extensions → Advanced settings → "Install Extension…"** y selecciona el archivo `dossierfy.mcpb`.

#### Windows

> ⚠️ **El doble clic no funciona en Windows.** Claude Desktop no registra la asociación del archivo `.mcpb` en el registro del sistema. Usa uno de los métodos siguientes.

**Método 1 (recomendado) — Menú interno:**  
En Claude Desktop ve a **Settings → Extensions → Advanced settings → "Install Extension…"** y selecciona el archivo `dossierfy.mcpb`.


### Paso 3: Configura la API Key

Cuando Claude Desktop muestre el diálogo de configuración, introduce tu API Key. El campo es de tipo contraseña y se almacena de forma segura en el sistema operativo:
- **macOS**: Keychain de macOS
- **Windows**: Credential Manager de Windows

### Paso 4: Verifica

Confirma la instalación. Si todo es correcto verás la extensión activa en **Settings → Extensions**. Abre una conversación y pide a Claude algo como `"¿Qué nodos hay en el grafo?"` — debería invocar `get_schema_mcp` automáticamente.

---

## Guía para desarrolladores

### Build local

```bash
# Desde el directorio raíz del repositorio
bash extension/scripts/build.sh
```

Esto ejecuta en orden:
1. `npm install --omit=dev` — instala solo dependencias de producción
2. `npx @anthropic-ai/mcpb validate` — valida el manifest.json
3. `npx @anthropic-ai/mcpb pack . dossierfy.mcpb` — genera el bundle

Alternativamente, desde el directorio `extension/`:
```bash
npm run build
```

El artefacto generado es `extension/dossierfy.mcpb`.

### Testear sin empaquetar (modo desarrollo)

Puedes apuntar Claude Desktop directamente al código fuente editando su archivo de configuración JSON.

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "dossierfy-dev": {
      "command": "node",
      "args": ["/ruta/absoluta/a/graphApi/extension/server/index.js"],
      "env": {
        "API_KEY": "tu-api-key-aqui",
        "API_URL": "https://su1r02w48a.execute-api.eu-west-1.amazonaws.com/v1/graphApi/mcp/"
      }
    }
  }
}
```

Reinicia Claude Desktop después de modificar el archivo. Cualquier cambio en `server/index.js` se recarga en el siguiente reinicio (no hay hot-reload).

> **Nota**: Recuerda ejecutar `npm install` en el directorio `extension/` antes de arrancar en modo desarrollo para que el SDK esté disponible.

### Cambiar el nombre para otro servicio

Para adaptar esta extensión a un servicio diferente, modifica estos campos:

| Archivo | Campo | Descripción |
|---------|-------|-------------|
| `manifest.json` | `name` | Identificador interno (sin espacios) |
| `manifest.json` | `display_name` | Nombre que ve el usuario |
| `manifest.json` | `description` | Texto del diálogo de instalación |
| `manifest.json` | `author.name` | Tu organización |
| `manifest.json` | `user_config.api_url.default` | URL del servidor remoto |
| `package.json` | `name` | Nombre del paquete npm |
| `scripts/build.sh` | Nombre del archivo de salida | Nombre del artefacto de salida |
| `server/index.js` | `PRODUCTION_URL` | URL de producción por defecto |
| `server/index.js` | `SERVER_INFO` / `CLIENT_INFO` | Nombre/versión reportados en la negociación MCP |

El `server/index.js` es genérico por diseño: descubre las tools del servidor remoto en tiempo de ejecución. No necesitas modificarlo salvo que quieras cambiar la lógica de proxy.

---

## Arquitectura

```
Claude Desktop (proceso padre)
        │  stdio (JSON-RPC)
        ▼
  server/index.js           ← servidor MCP local (stdio)
        │  HTTP POST + x-api-key
        ▼
  AWS API Gateway
        │
        ▼
  AWS Lambda (FastAPI + fastmcp)
        │
        ▼
  Neo4j (grafo de conocimiento)
```

El proxy realiza la negociación MCP con el servidor remoto en el arranque, descarga la lista de tools y las sirve a Claude Desktop. Cada llamada a tool se reenvía al remoto y la respuesta se devuelve sin modificación.

---

## Requisitos

- Claude Desktop **≥ 0.10.0**
- Plataformas soportadas: **macOS** y **Windows**
- Node.js **≥ 18.0.0** (incluido en Claude Desktop, no requiere instalación separada)

---

## Troubleshooting

### La extensión no aparece / muestra error
Revisa los logs de Claude Desktop:
- **macOS**: `~/Library/Logs/Claude/mcp-server-dossierfy.log`
- **Windows**: `%APPDATA%\Claude\logs\mcp-server-dossierfy.log`

También puedes ver los logs generales en:
- **macOS**: `~/Library/Logs/Claude/`
- **Windows**: `%APPDATA%\Claude\logs\`

### Error "API Key inválida" (401/403)
Comprueba la API key en **Claude Desktop → Configuración → Extensiones → Dossierfy → Editar configuración**.

### Error de conexión al servidor remoto
Verifica que tienes acceso a internet y que la URL del servidor es correcta. La URL por defecto es:
```
https://su1r02w48a.execute-api.eu-west-1.amazonaws.com/v1/graphApi/mcp/
```

### No se encuentran tools
El servidor remoto podría estar en mantenimiento. Los logs del proxy mostrarán `tools/list returned 0 tool(s)` en este caso.
