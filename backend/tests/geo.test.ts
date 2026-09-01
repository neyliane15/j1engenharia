import { describe, expect, it } from 'vitest';
import { acharMunicipio, coordenadasDaCidade, dentroDoRaio, distanciaKm } from '../src/utils/geo';
import { MUNICIPIOS } from '../src/data/regiao';
import { CATALOGO, TOTAL_ITENS } from '../src/data/catalogo';

describe('região de atuação', () => {
  it('cobre Niterói, Região dos Lagos e Rio de Janeiro', () => {
    expect(acharMunicipio('Niterói')).toBeTruthy();
    expect(acharMunicipio('Cabo Frio')?.region).toBe('lagos');
    expect(acharMunicipio('Rio de Janeiro')?.region).toBe('rio');
    expect(MUNICIPIOS.every((m) => m.state === 'RJ')).toBe(true);
  });

  it('acha a cidade sem acento e em qualquer caixa', () => {
    expect(acharMunicipio('niteroi')?.name).toBe('Niterói');
    expect(acharMunicipio('SAO GONCALO')?.name).toBe('São Gonçalo');
    expect(acharMunicipio('armacao dos buzios')?.name).toBe('Armação dos Búzios');
  });

  it('devolve null para cidade fora da região', () => {
    expect(acharMunicipio('São Paulo')).toBeNull();
    expect(coordenadasDaCidade('Curitiba')).toBeNull();
  });
});

describe('distância e raio de atendimento', () => {
  it('calcula a distância entre municípios', () => {
    const nit = coordenadasDaCidade('Niterói')!;
    const cabo = coordenadasDaCidade('Cabo Frio')!;
    const d = distanciaKm(nit.latitude, nit.longitude, cabo.latitude, cabo.longitude);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });

  it('distância de um ponto a ele mesmo é zero', () => {
    const rio = coordenadasDaCidade('Rio de Janeiro')!;
    expect(distanciaKm(rio.latitude, rio.longitude, rio.latitude, rio.longitude)).toBe(0);
  });

  it('respeita o raio declarado pelo fornecedor', () => {
    const rio = coordenadasDaCidade('Rio de Janeiro')!;
    const cabo = coordenadasDaCidade('Cabo Frio')!;
    expect(dentroDoRaio({ ...rio, serviceRadiusKm: 50 }, cabo).atende).toBe(false);
    expect(dentroDoRaio({ ...rio, serviceRadiusKm: 150 }, cabo).atende).toBe(true);
  });

  it('sem coordenada ninguém é excluído', () => {
    const cabo = coordenadasDaCidade('Cabo Frio')!;
    const r = dentroDoRaio({ latitude: null, longitude: null, serviceRadiusKm: 10 }, cabo);
    expect(r.atende).toBe(true);
    expect(r.distanciaKm).toBeNull();
  });
});

describe('catálogo', () => {
  it('tem categorias e produtos sem duplicidade', () => {
    expect(CATALOGO.length).toBeGreaterThanOrEqual(20);
    expect(TOTAL_ITENS).toBeGreaterThanOrEqual(300);

    const slugs = new Set(CATALOGO.map((c) => c.slug));
    expect(slugs.size).toBe(CATALOGO.length);

    for (const categoria of CATALOGO) {
      const nomes = new Set(categoria.items.map((i) => i.name));
      expect(nomes.size).toBe(categoria.items.length);
      expect(categoria.items.every((i) => i.unit.length > 0)).toBe(true);
    }
  });
});
