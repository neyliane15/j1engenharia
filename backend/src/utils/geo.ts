import { MUNICIPIOS, acharMunicipio, type Municipio } from '../data/regiao';

export { MUNICIPIOS, acharMunicipio };
export type { Municipio };

const RAIO_TERRA_KM = 6371;
const rad = (graus: number) => (graus * Math.PI) / 180;

/**
 * Distância em linha reta entre dois pontos, em quilômetros.
 *
 * É a distância do mapa, não a da estrada. Para raio de atendimento serve:
 * o fornecedor pensa em "atendo até 60km", não em quilometragem rodada.
 */
export function distanciaKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(RAIO_TERRA_KM * 2 * Math.asin(Math.sqrt(h)) * 10) / 10;
}

export interface Coordenada {
  latitude: number | null;
  longitude: number | null;
}

/** Distância entre dois registros que podem não ter coordenada. */
export function distanciaEntre(a: Coordenada, b: Coordenada): number | null {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return null;
  return distanciaKm(Number(a.latitude), Number(a.longitude), Number(b.latitude), Number(b.longitude));
}

/**
 * Coordenadas de uma cidade da região de atuação.
 * Devolve null para cidade fora da região — que é informação útil: o
 * cadastro segue, mas sem raio de atendimento calculável.
 */
export function coordenadasDaCidade(cidade?: string | null): { latitude: number; longitude: number } | null {
  const m = acharMunicipio(cidade);
  return m ? { latitude: m.lat, longitude: m.lng } : null;
}

/** true quando o ponto está dentro do raio que o fornecedor declarou. */
export function dentroDoRaio(
  fornecedor: Coordenada & { serviceRadiusKm: number },
  destino: Coordenada,
): { atende: boolean; distanciaKm: number | null } {
  const d = distanciaEntre(fornecedor, destino);
  // Sem coordenada de um dos lados não dá para excluir ninguém: o fornecedor
  // continua elegível e o comprador decide.
  if (d === null) return { atende: true, distanciaKm: null };
  return { atende: d <= fornecedor.serviceRadiusKm, distanciaKm: d };
}
