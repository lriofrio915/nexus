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
# Número por defecto: el mismo que usa el panel (lib/site-config.ts). Se puede
# sobrescribir con EQUITY_CHECK_PHONE sin tocar el script.
TELEFONO_POR_DEFECTO=593978815129

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
TELEFONO="${EQUITY_CHECK_PHONE:-$TELEFONO_POR_DEFECTO}"

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
  if [ -z "${EVOLUTION_API_URL:-}" ] || [ -z "${EVOLUTION_INSTANCE:-}" ] || [ -z "${EVOLUTION_API_KEY:-}" ]; then
    log "AVISO no enviado: faltan credenciales de Evolution"
    return
  fi
  local codigo
  codigo=$(curl -sS --max-time 15 -o /dev/null -w '%{http_code}' \
    -X POST "${EVOLUTION_API_URL%/}/message/sendText/$EVOLUTION_INSTANCE" \
    -H "apikey: $EVOLUTION_API_KEY" \
    -H 'Content-Type: application/json' \
    --data "$(jq -nc --arg n "$TELEFONO" --arg t "$texto" '{number:$n,text:$t}')" || echo 000)
  log "aviso WhatsApp -> HTTP $codigo"
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
