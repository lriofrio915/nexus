# NexusReporter — puente NinjaTrader 8 → panel de Nexus

Un AddOn de NinjaScript que corre dentro de NinjaTrader 8 y envía la actividad
de las cuentas al panel privado de Nexus.

```
NT8 (tu PC Windows) ──POST──> /api/trading/events ──> Supabase ──> /panel/trading
```

## Qué reporta

| Qué | Cuándo | Tabla |
|---|---|---|
| Capital, P&L realizado y abierto, poder de compra | Cada cambio de valor de cuenta | `nexus_nt_accounts` |
| Cada fill individual | Cada ejecución | `nexus_nt_executions` |
| Posiciones abiertas | Al abrir, modificar o cerrar | `nexus_nt_positions` |
| Operaciones cerradas con P&L | Al volver la posición a flat | `nexus_nt_trades` |

NinjaTrader no expone una colección de trades cerrados en la clase `Account`, así
que el AddOn empareja los fills él mismo: acumula entradas y salidas por
cuenta+instrumento y emite una operación cuando la posición llega a cero. El P&L
se calcula con `Instrument.MasterInstrument.PointValue` y se le restan las
comisiones.

## Instalación

### 1. Generar el token

En el servidor, genera un token de al menos 32 caracteres:

```bash
openssl rand -hex 32
```

Guárdalo como variable de entorno del despliegue:

```
NT_INGEST_TOKEN=<el token generado>
```

### 2. Aplicar la migración

```bash
supabase db push
```

O ejecuta `supabase/migrations/0002_nexus_trading.sql` en el editor SQL de
Supabase.

### 3. Configurar el AddOn

Abre `NexusReporter.cs` y ajusta las dos constantes del bloque de configuración:

```csharp
private const string Endpoint = "https://nexus-ia.com.es/api/trading/events";
private const string Token    = "REEMPLAZAR_CON_NT_INGEST_TOKEN";
```

El `Token` tiene que ser idéntico a `NT_INGEST_TOKEN`.

### 4. Instalar en NinjaTrader

1. Copia `NexusReporter.cs` a:
   `Documents\NinjaTrader 8\bin\Custom\AddOns\NexusReporter.cs`
2. En NT8: **New > NinjaScript Editor**
3. Pulsa **F5** para compilar
4. Reinicia NinjaTrader

Si compiló bien, en **Control Center > Log** o en la pestaña Output verás:

```
[NexusReporter] Nexus Reporter iniciado. Endpoint: https://...
```

### 5. Verificar

Abre `https://nexus-ia.com.es/panel/trading`. Las cuentas aparecen en cuanto NT8
se conecta al broker; los primeros datos llegan en unos 5 segundos.

## Cómo se comporta

**Hilos.** Los eventos de NinjaTrader llegan en sus propios hilos. El AddOn solo
encola bajo lock y un timer de fondo hace los envíos, así que ninguna llamada
HTTP corre en un hilo de eventos: una red lenta no puede frenar el manejo de
órdenes.

**Reintentos.** Si el servidor no responde, los lotes se guardan en cola y se
reintentan cada 5 segundos. Se conservan hasta 200 lotes; pasado eso se
descartan los más viejos. Un rechazo 4xx (token equivocado, payload inválido)
descarta ese lote en vez de reintentarlo para siempre.

**Duplicados.** Cada fila lleva un id que genera el AddOn (el `ExecutionId` de
NT8 para las ejecuciones), y el servidor hace upsert sobre ese id. Reenviar un
lote no duplica nada.

**Horas.** NinjaTrader trabaja en la zona local de la plataforma; el AddOn
convierte todo a UTC antes de enviarlo.

## Límites

- **NT8 tiene que estar abierto y conectado.** Si cierras la plataforma o apagas
  la PC, deja de reportar. Para registro continuo necesitas la máquina encendida
  o un VPS con Windows.
- **Solo reporta lo que NT8 ve.** Las cuentas que aparezcan aquí son las que NT8
  tenga conectadas en ese momento.
- **El emparejamiento de trades asume posiciones simples.** Una posición que se
  abre y cierra en un instrumento a la vez se empareja correctamente. Si operas
  el mismo instrumento en direcciones opuestas simultáneamente en la misma
  cuenta, el resultado no será el esperado.

## Seguridad

El token viaja en la cabecera `x-nexus-token` sobre HTTPS y se compara en tiempo
constante. No lo comitees: vive en la configuración del despliegue y en tu copia
local de `NexusReporter.cs`, que no debe subirse con el token real dentro.

El endpoint solo acepta escrituras. Nada de lo que llega se muestra en el sitio
público: `/panel/trading` está detrás del login del panel.
