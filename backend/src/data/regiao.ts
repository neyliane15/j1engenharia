/**
 * Região de atuação do Emptra: Niterói, Região dos Lagos e Rio de Janeiro.
 *
 * As coordenadas são o centro aproximado de cada município — precisão
 * suficiente para o raio de atendimento do fornecedor, que trabalha em
 * dezenas de quilômetros, não em metros. Se um dia for preciso mais
 * precisão, o lugar de trocar é aqui: geocodificar o endereço da empresa e
 * gravar em `companies.latitude/longitude`.
 */
export interface Municipio {
  name: string;
  state: string;
  region: RegionSlug;
  lat: number;
  lng: number;
}

export type RegionSlug = 'niteroi' | 'lagos' | 'rio' | 'metropolitana';

export const REGIOES: Record<RegionSlug, string> = {
  niteroi: 'Niterói',
  lagos: 'Região dos Lagos',
  rio: 'Rio de Janeiro',
  metropolitana: 'Região Metropolitana',
};

export const MUNICIPIOS: Municipio[] = [
  // ── Niterói ────────────────────────────────────────────────
  { name: 'Niterói', state: 'RJ', region: 'niteroi', lat: -22.8832, lng: -43.1034 },

  // ── Rio de Janeiro ─────────────────────────────────────────
  { name: 'Rio de Janeiro', state: 'RJ', region: 'rio', lat: -22.9068, lng: -43.1729 },

  // ── Região dos Lagos ───────────────────────────────────────
  { name: 'Maricá', state: 'RJ', region: 'lagos', lat: -22.9194, lng: -42.8186 },
  { name: 'Saquarema', state: 'RJ', region: 'lagos', lat: -22.92, lng: -42.51 },
  { name: 'Araruama', state: 'RJ', region: 'lagos', lat: -22.8728, lng: -42.343 },
  { name: 'Iguaba Grande', state: 'RJ', region: 'lagos', lat: -22.8394, lng: -42.2286 },
  { name: 'São Pedro da Aldeia', state: 'RJ', region: 'lagos', lat: -22.8397, lng: -42.1028 },
  { name: 'Cabo Frio', state: 'RJ', region: 'lagos', lat: -22.8894, lng: -42.0286 },
  { name: 'Arraial do Cabo', state: 'RJ', region: 'lagos', lat: -22.9661, lng: -42.0278 },
  { name: 'Armação dos Búzios', state: 'RJ', region: 'lagos', lat: -22.7469, lng: -41.8817 },
  { name: 'Rio das Ostras', state: 'RJ', region: 'lagos', lat: -22.5269, lng: -41.945 },
  { name: 'Casimiro de Abreu', state: 'RJ', region: 'lagos', lat: -22.4806, lng: -42.2044 },
  { name: 'Silva Jardim', state: 'RJ', region: 'lagos', lat: -22.6489, lng: -42.3919 },

  // ── Região Metropolitana ───────────────────────────────────
  { name: 'São Gonçalo', state: 'RJ', region: 'metropolitana', lat: -22.8268, lng: -43.0634 },
  { name: 'Itaboraí', state: 'RJ', region: 'metropolitana', lat: -22.7444, lng: -42.8592 },
  { name: 'Rio Bonito', state: 'RJ', region: 'metropolitana', lat: -22.7181, lng: -42.6136 },
  { name: 'Tanguá', state: 'RJ', region: 'metropolitana', lat: -22.7392, lng: -42.7139 },
  { name: 'Magé', state: 'RJ', region: 'metropolitana', lat: -22.6531, lng: -43.0408 },
  { name: 'Guapimirim', state: 'RJ', region: 'metropolitana', lat: -22.5372, lng: -42.9822 },
  { name: 'Duque de Caxias', state: 'RJ', region: 'metropolitana', lat: -22.7858, lng: -43.3117 },
  { name: 'São João de Meriti', state: 'RJ', region: 'metropolitana', lat: -22.8039, lng: -43.3722 },
  { name: 'Nova Iguaçu', state: 'RJ', region: 'metropolitana', lat: -22.7592, lng: -43.4511 },
  { name: 'Belford Roxo', state: 'RJ', region: 'metropolitana', lat: -22.7642, lng: -43.3997 },
  { name: 'Nilópolis', state: 'RJ', region: 'metropolitana', lat: -22.8058, lng: -43.4136 },
  { name: 'Mesquita', state: 'RJ', region: 'metropolitana', lat: -22.7833, lng: -43.4292 },
  { name: 'Queimados', state: 'RJ', region: 'metropolitana', lat: -22.7156, lng: -43.5556 },
  { name: 'Japeri', state: 'RJ', region: 'metropolitana', lat: -22.6433, lng: -43.6533 },
  { name: 'Seropédica', state: 'RJ', region: 'metropolitana', lat: -22.7442, lng: -43.7078 },
  { name: 'Itaguaí', state: 'RJ', region: 'metropolitana', lat: -22.8522, lng: -43.7753 },
  { name: 'Petrópolis', state: 'RJ', region: 'metropolitana', lat: -22.505, lng: -43.1789 },
  { name: 'Teresópolis', state: 'RJ', region: 'metropolitana', lat: -22.4125, lng: -42.9661 },
  { name: 'Cachoeiras de Macacu', state: 'RJ', region: 'metropolitana', lat: -22.4628, lng: -42.6528 },
];

/** Normaliza para comparar nome de cidade digitado à mão. */
function chave(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const PORCHAVE = new Map(MUNICIPIOS.map((m) => [chave(m.name), m]));

/** Encontra o município pelo nome, tolerando acento e caixa. */
export function acharMunicipio(nome?: string | null): Municipio | null {
  if (!nome) return null;
  return PORCHAVE.get(chave(nome)) ?? null;
}

export const MUNICIPIOS_POR_REGIAO = (Object.keys(REGIOES) as RegionSlug[]).map((slug) => ({
  slug,
  name: REGIOES[slug],
  municipios: MUNICIPIOS.filter((m) => m.region === slug),
}));
