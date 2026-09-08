#!/usr/bin/env bash
#
# Comprueba que el corte diario de capital se escribió, y avisa si no.
#
# El cron /api/cron/equity corre en Vercel y hasta el 2026-09-08 llevaba tres
# días escribiendo con la fecha equivocada sin que nada lo notara: el fallo solo
# se veía comparando `day` con `recorded_at` a mano. Un cron que falla en
# silencio es peor que uno que no existe, porque la curva de capital sigue
# pintándose y parece correcta.
#
# Esto se ejecuta después del corte y verifica tres cosas:
#   1. Existe fila para el día que se acaba de cerrar.
#   2. Hay una fila por cada cuenta, no un subconjunto.
#   3. Ninguna fila trae `equity` nulo.
#
# No compara importes contra `nexus_nt_accounts`: esa tabla la reescribe
# NinjaTrader durante la sesión, así que a la hora del chequeo ya no tiene por
# qué coincidir con el cierre. Lo que se vigila es que el corte exista y esté
# completo, que es justo lo que falló.
#
# Uso: verificar-corte-equity.sh [YYYY-MM-DD]
set -euo pipefail

ENV_FILE=/var/www/nexus/.env.local

# El aviso sale por el puente de OpenClaw, no por Evolution.
#
# `EVOLUTION_INSTANCE` apunta a `dr-cmadminlri`, que ya no existe en el servidor
# —la API responde 404 «The instance does not exist»—, y la única instancia viva
# ahí es la de otro negocio. El puente, en cambio, está vivo, lo usa
# dep-coberturas desde hace meses y encola en disco con reintentos cuando la
# sesión de WhatsApp se cae, así que un aviso de madrugada no se pierde.
PUENTE_URL_POR_DEFECTO=http://127.0.0.1:9091/webhook/liberty-trading
PUENTE_ENV=/root/openclaw-webhook/webhook.env

log() { echo "[corte-equity $(date -u '+%Y-%m-%d %H:%M:%S') UTC] $*"; }

if [ ! -r "$ENV_FILE" ]; then
  log "ERROR: no se puede leer $ENV_FILE"
  exit 2
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

: "${NEXT_PUBLIC_SUPABASE_URL:?falta NEXT_PUBLIC_SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?falta SUPABASE_SERVICE_ROLE_KEY}"

REST="${NEXT_PUBLIC_SUPABASE_URL%/}/rest/v1"

# El día que se acaba de cerrar. Se admite pasarlo a mano para reprocesar.
DIA="${1:-$(date -u -d 'yesterday' +%F)}"

consultar() {
  curl -sS --max-time 30 \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    "$REST/$1"
}

avisar() {
  local texto="$1"
  local url="${EQUITY_CHECK_WEBHOOK_URL:-$PUENTE_URL_POR_DEFECTO}"
  local token="${EQUITY_CHECK_WEBHOOK_TOKEN:-}"

  if [ -z "$token" ] && [ -r "$PUENTE_ENV" ]; then
    token=$(sed -n 's/^WEBHOOK_TOKEN=//p' "$PUENTE_ENV" | head -1)
  fi

  if [ -z "$token" ]; then
    log "AVISO no enviado: sin token del puente (ni EQUITY_CHECK_WEBHOOK_TOKEN ni $PUENTE_ENV)"
    return
  fi

  # 60 s y no 20: el puente no responde hasta que el CLI de OpenClaw ha
  # intentado la entrega, y eso ronda los 15 s. Con 20 s el aviso se perdía por
  # timeout justo cuando hacía falta.
  local respuesta codigo
  respuesta=$(curl -sS --max-time 60 -w '\n%{http_code}' -X POST "$url" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    --data "$(jq -nc --arg t "$texto" '{event:"corte-equity",data:{message:$t}}')" || printf '\n000')
  codigo=$(tail -1 <<<"$respuesta")

  # El cuerpo va como {event, data:{message}}, que es lo que lee `extractMessage`
  # del puente. Con `{text}` el mensaje se entrega igual —y responde
  # delivered:true— pero llega como el literal "[unknown] {}".
  #
  # El puente distingue entregado de encolado: un 202 significa «todavía no»,
  # no «se perdió». Se registra tal cual para poder auditarlo después.
  log "aviso puente -> HTTP $codigo $(head -n -1 <<<"$respuesta" | tr -d '\n' | cut -c1-160)"
}

filas=$(consultar "nexus_biz_equity_daily?select=account,equity&day=eq.$DIA")
cuentas=$(consultar "nexus_nt_accounts?select=name")

n_filas=$(jq 'length' <<<"$filas")
n_cuentas=$(jq 'length' <<<"$cuentas")
n_nulos=$(jq '[.[] | select(.equity == null)] | length' <<<"$filas")

problemas=()
[ "$n_filas" -eq 0 ] && problemas+=("no hay corte para $DIA")
[ "$n_filas" -gt 0 ] && [ "$n_filas" -ne "$n_cuentas" ] &&
  problemas+=("corte incompleto: $n_filas filas para $n_cuentas cuentas")
[ "$n_nulos" -gt 0 ] && problemas+=("$n_nulos filas con equity nulo")

if [ ${#problemas[@]} -eq 0 ]; then
  log "OK $DIA: $n_filas filas, $n_cuentas cuentas"
  exit 0
fi

detalle=$(printf '%s; ' "${problemas[@]}")
log "FALLO $DIA: ${detalle%; }"
avisar "⚠️ Nexus — corte de capital del $DIA: ${detalle%; }. Revisa /api/cron/equity en Vercel."
exit 1
